import { BadGatewayException, Injectable } from '@nestjs/common';
import { SessionContext } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';

type ProvisioningJob = {
  id: string;
  resource_type: string;
  resource_id: string;
  operation: string;
  desired_state: Record<string, unknown>;
};

const resourceTables: Record<string, string> = {
  extension: 'telephony.extensions',
  trunk: 'telephony.sip_trunks',
  inbound_route: 'telephony.inbound_routes',
  outbound_route: 'telephony.outbound_routes',
  pickup_group: 'telephony.pickup_groups',
  ring_group: 'telephony.ring_groups',
  voicemail_box: 'telephony.voicemail_boxes',
};

@Injectable()
export class FusionPbxService {
  constructor(private readonly database: DatabaseService) {}

  async status(session: SessionContext) {
    return this.database.tenantTransaction(
      session.tenant.id,
      session.user.id,
      session.membershipId,
      async (client) => {
        const result = await client.query<{
          mode: string;
          status: string;
          base_url: string | null;
          last_sync_at: Date | null;
          pending_jobs: string;
          failed_jobs: string;
        }>(
          `SELECT
             COALESCE(a.mode, 'mock') AS mode,
             COALESCE(a.status, 'not_configured') AS status,
             a.base_url,
             a.last_sync_at,
             count(j.id) FILTER (
               WHERE j.status IN ('pending', 'running')
             )::text AS pending_jobs,
             count(j.id) FILTER (WHERE j.status = 'failed')::text AS failed_jobs
           FROM core.tenants t
           LEFT JOIN integration.fusionpbx_accounts a ON a.tenant_id = t.id
           LEFT JOIN integration.provisioning_jobs j ON j.tenant_id = t.id
           WHERE t.id = $1
           GROUP BY a.id`,
          [session.tenant.id],
        );
        const row = result.rows[0];

        return {
          mode: row?.mode ?? 'mock',
          status: row?.status ?? 'not_configured',
          baseUrl: row?.base_url ?? null,
          lastSyncAt: row?.last_sync_at ?? null,
          pendingJobs: Number(row?.pending_jobs ?? 0),
          failedJobs: Number(row?.failed_jobs ?? 0),
        };
      },
    );
  }

  async sync(session: SessionContext) {
    const account = await this.database.tenantTransaction(
      session.tenant.id,
      session.user.id,
      session.membershipId,
      async (client) => {
        const accountResult = await client.query<{
          id: string;
          mode: string;
          base_url: string | null;
          api_key_ref: string | null;
        }>(
          `SELECT id, mode, base_url, api_key_ref
           FROM integration.fusionpbx_accounts
           WHERE tenant_id = $1`,
          [session.tenant.id],
        );
        const jobResult = await client.query<ProvisioningJob>(
          `SELECT id, resource_type, resource_id, operation, desired_state
           FROM integration.provisioning_jobs
           WHERE tenant_id = $1
             AND (
               (
                 status IN ('pending', 'failed')
                 AND scheduled_at <= now()
               )
               OR (
                 status = 'running'
                 AND updated_at < now() - interval '5 minutes'
               )
             )
           ORDER BY created_at
           FOR UPDATE SKIP LOCKED
           LIMIT 100`,
          [session.tenant.id],
        );
        const jobs = jobResult.rows;

        if (jobs.length > 0) {
          await client.query(
            `UPDATE integration.provisioning_jobs
             SET status = 'running',
                 started_at = now(),
                 completed_at = NULL,
                 updated_at = now()
             WHERE tenant_id = $1
               AND id = ANY($2::uuid[])`,
            [session.tenant.id, jobs.map((job) => job.id)],
          );
        }

        return {
          account: accountResult.rows[0] ?? {
            id: '',
            mode: 'mock',
            base_url: null,
            api_key_ref: null,
          },
          jobs,
        };
      },
    );

    let synchronized = 0;

    for (const job of account.jobs) {
      try {
        if (account.account.mode === 'live') {
          await this.sendLiveCommand(account.account.base_url, job);
        }

        await this.markSucceeded(session, job);
        synchronized += 1;
      } catch (error) {
        await this.markFailed(session, job.id, error);
      }
    }

    await this.database.tenantTransaction(
      session.tenant.id,
      session.user.id,
      session.membershipId,
      async (client) => {
        await client.query(
          `UPDATE integration.fusionpbx_accounts
           SET last_sync_at = now(),
               status = CASE WHEN $2::int > 0 THEN 'active' ELSE status END,
               updated_at = now()
           WHERE tenant_id = $1`,
          [session.tenant.id, synchronized],
        );
      },
    );

    return { synchronized, total: account.jobs.length };
  }

  async issueWebphoneCredentials(
    session: SessionContext,
    extension: string,
    authUsername: string,
  ) {
    const bridgeUrl = process.env.FUSIONPBX_BRIDGE_URL;

    if (bridgeUrl) {
      const bridgeApiKey = process.env.FUSIONPBX_BRIDGE_API_KEY;

      if (!bridgeApiKey) {
        throw new BadGatewayException(
          'Chave do bridge FusionPBX nao configurada.',
        );
      }

      const response = await fetch(
        `${bridgeUrl.replace(/\/$/, '')}/webphone/credentials`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-bridge-api-key': bridgeApiKey,
          },
          body: JSON.stringify({
            tenantId: session.tenant.id,
            extension,
            authUsername,
          }),
        },
      );

      if (!response.ok) {
        throw new BadGatewayException(
          'Bridge FusionPBX não emitiu a credencial WebRTC.',
        );
      }

      return (await response.json()) as { password: string };
    }

    if (process.env.WEBPHONE_ALLOW_MOCK !== 'true') {
      throw new BadGatewayException(
        'Bridge FusionPBX nao configurado para emitir credenciais WebRTC.',
      );
    }

    const mockPassword = process.env.WEBPHONE_MOCK_PASSWORD;

    if (!mockPassword) {
      throw new BadGatewayException(
        'Senha WebRTC de desenvolvimento nao configurada.',
      );
    }

    return {
      password: mockPassword,
    };
  }

  private async sendLiveCommand(
    baseUrl: string | null,
    job: ProvisioningJob,
  ) {
    const bridgeUrl = process.env.FUSIONPBX_BRIDGE_URL ?? baseUrl;

    if (!bridgeUrl) {
      throw new Error('FusionPBX bridge URL não configurada.');
    }
    const bridgeApiKey = process.env.FUSIONPBX_BRIDGE_API_KEY;

    if (!bridgeApiKey) {
      throw new Error('FusionPBX bridge API key nao configurada.');
    }

    const response = await fetch(`${bridgeUrl.replace(/\/$/, '')}/commands`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bridge-api-key': bridgeApiKey,
      },
      body: JSON.stringify(job),
    });

    if (!response.ok) {
      throw new Error(`FusionPBX bridge respondeu ${response.status}.`);
    }
  }

  private markSucceeded(session: SessionContext, job: ProvisioningJob) {
    return this.database.tenantTransaction(
      session.tenant.id,
      session.user.id,
      session.membershipId,
      async (client) => {
        const table = resourceTables[job.resource_type];

        if (table) {
          await client.query(
            `UPDATE ${table}
             SET sync_status = 'synced', updated_at = now()
             WHERE tenant_id = $1 AND id = $2`,
            [session.tenant.id, job.resource_id],
          );
        }

        await client.query(
          `UPDATE integration.provisioning_jobs
           SET status = 'succeeded',
               completed_at = now(),
               attempt_count = attempt_count + 1,
               last_error = NULL,
               updated_at = now()
           WHERE tenant_id = $1 AND id = $2`,
          [session.tenant.id, job.id],
        );
      },
    );
  }

  private markFailed(
    session: SessionContext,
    jobId: string,
    error: unknown,
  ) {
    return this.database.tenantTransaction(
      session.tenant.id,
      session.user.id,
      session.membershipId,
      async (client) => {
        await client.query(
          `UPDATE integration.provisioning_jobs
           SET status = 'failed',
               attempt_count = attempt_count + 1,
               last_error = $3,
               scheduled_at = now() + interval '1 minute',
               updated_at = now()
           WHERE tenant_id = $1 AND id = $2`,
          [
            session.tenant.id,
            jobId,
            error instanceof Error ? error.message : 'Falha desconhecida',
          ],
        );
      },
    );
  }
}
