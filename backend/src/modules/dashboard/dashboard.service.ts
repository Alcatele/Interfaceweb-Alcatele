import { Injectable } from '@nestjs/common';
import { SessionContext } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseService) {}

  getSummary(session: SessionContext) {
    return this.database.tenantTransaction(
      session.tenant.id,
      session.user.id,
      session.membershipId,
      async (client) => {
        const result = await client.query<{
          extensions_total: string;
          extensions_online: string;
          trunks_total: string;
          trunks_registered: string;
          inbound_routes: string;
          outbound_routes: string;
          users_total: string;
          pending_sync: string;
        }>(
          `SELECT
             (
               SELECT count(*) FROM telephony.extensions
               WHERE tenant_id = $1 AND deleted_at IS NULL
             )::text AS extensions_total,
             (
               SELECT count(*) FROM telephony.extensions
               WHERE tenant_id = $1 AND deleted_at IS NULL AND status = 'online'
             )::text AS extensions_online,
             (
               SELECT count(*) FROM telephony.sip_trunks
               WHERE tenant_id = $1 AND deleted_at IS NULL
             )::text AS trunks_total,
             (
               SELECT count(*) FROM telephony.sip_trunks
               WHERE tenant_id = $1 AND deleted_at IS NULL
                 AND status = 'registered'
             )::text AS trunks_registered,
             (
               SELECT count(*) FROM telephony.inbound_routes
               WHERE tenant_id = $1 AND deleted_at IS NULL AND enabled
             )::text AS inbound_routes,
             (
               SELECT count(*) FROM telephony.outbound_routes
               WHERE tenant_id = $1 AND deleted_at IS NULL AND enabled
             )::text AS outbound_routes,
             (
               SELECT count(*) FROM iam.memberships
               WHERE tenant_id = $1 AND status = 'active'
             )::text AS users_total,
             (
               SELECT count(*) FROM integration.provisioning_jobs
               WHERE tenant_id = $1 AND status IN ('pending', 'failed')
             )::text AS pending_sync`,
          [session.tenant.id],
        );
        const row = result.rows[0];

        return {
          tenant: session.tenant,
          metrics: {
            extensionsTotal: Number(row.extensions_total),
            extensionsOnline: Number(row.extensions_online),
            trunksTotal: Number(row.trunks_total),
            trunksRegistered: Number(row.trunks_registered),
            inboundRoutes: Number(row.inbound_routes),
            outboundRoutes: Number(row.outbound_routes),
            usersTotal: Number(row.users_total),
            pendingSync: Number(row.pending_sync),
          },
        };
      },
    );
  }
}
