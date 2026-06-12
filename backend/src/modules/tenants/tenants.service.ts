import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SessionContext } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import {
  ResourceLimitsService,
  TenantLimits,
  resourceLimitKeys,
} from '../database/resource-limits.service';

export type CreateTenantInput = {
  name: string;
  slug: string;
  domain: string;
  limits: TenantLimits;
};

@Injectable()
export class TenantsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly resourceLimits: ResourceLimitsService,
  ) {}

  async list(session: SessionContext) {
    if (!session.permissions.includes('tenant.manage')) {
      return session.availableTenants.map((tenant) => ({
        ...tenant,
        status: 'active',
        active: tenant.id === session.tenant.id,
      }));
    }

    const result = await this.database.query<{
      id: string;
      name: string;
      slug: string;
      domain: string;
      status: string;
    }>(
      `SELECT id, name, slug, domain, status
       FROM core.tenants
       WHERE status <> 'closed'
       ORDER BY name`,
    );

    return Promise.all(
      result.rows.map(async (tenant) => {
        const resources = await this.database.transaction((client) =>
          this.resourceLimits.get(client, tenant.id),
        );

        return {
          ...tenant,
          ...resources,
          active: tenant.id === session.tenant.id,
          role:
            session.availableTenants.find((item) => item.id === tenant.id)?.role ??
            null,
        };
      }),
    );
  }

  resources(session: SessionContext) {
    return this.database.tenantTransaction(
      session.tenant.id,
      session.user.id,
      session.membershipId,
      (client) => this.resourceLimits.get(client, session.tenant.id),
    );
  }

  async create(session: SessionContext, input: CreateTenantInput) {
    this.ensureSuperAdmin(session);

    try {
      return await this.database.transaction(async (client) => {
        const tenantResult = await client.query<{
          id: string;
          name: string;
          slug: string;
          domain: string;
          status: string;
        }>(
          `INSERT INTO core.tenants (name, slug, domain, status)
           VALUES ($1, lower($2), lower($3), 'active')
           RETURNING id, name, slug, domain, status`,
          [input.name.trim(), input.slug.trim(), input.domain.trim()],
        );
        const tenant = tenantResult.rows[0];

        await client.query(
          `INSERT INTO core.tenant_limits (
             tenant_id,
             max_users,
             max_extensions,
             max_trunks,
             max_inbound_routes,
             max_outbound_routes,
             max_pickup_groups,
             max_ring_groups,
             max_voicemail_boxes
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            tenant.id,
            input.limits.users,
            input.limits.extensions,
            input.limits.trunks,
            input.limits.inboundRoutes,
            input.limits.outboundRoutes,
            input.limits.pickupGroups,
            input.limits.ringGroups,
            input.limits.voicemailBoxes,
          ],
        );
        await client.query(
          `SELECT core.set_request_context($1::uuid, $2::uuid, NULL)`,
          [tenant.id, session.user.id],
        );
        await client.query(`SELECT iam.bootstrap_tenant_roles($1::uuid)`, [
          tenant.id,
        ]);
        const roleResult = await client.query<{ id: string }>(
          `SELECT id
           FROM iam.roles
           WHERE tenant_id = $1
             AND code = 'super_admin'`,
          [tenant.id],
        );
        await client.query(
          `INSERT INTO iam.memberships (
             tenant_id,
             user_id,
             role_id,
             status,
             is_default
           )
           VALUES ($1, $2, $3, 'active', false)`,
          [tenant.id, session.user.id, roleResult.rows[0].id],
        );

        return { ...tenant, limits: input.limits };
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Slug ou domínio já está em uso.');
      }
      throw error;
    }
  }

  async updateLimits(
    session: SessionContext,
    tenantId: string,
    limits: TenantLimits,
  ) {
    this.ensureSuperAdmin(session);

    return this.database.transaction(async (client) => {
      const resources = await this.resourceLimits.get(client, tenantId);
      const exceeded = resourceLimitKeys.find(
        (key) => limits[key] < resources.usage[key],
      );

      if (exceeded) {
        throw new ConflictException(
          `O limite não pode ser menor que o uso atual (${resources.usage[exceeded]}).`,
        );
      }

      await client.query(
        `UPDATE core.tenant_limits
         SET max_users = $2,
             max_extensions = $3,
             max_trunks = $4,
             max_inbound_routes = $5,
             max_outbound_routes = $6,
             max_pickup_groups = $7,
             max_ring_groups = $8,
             max_voicemail_boxes = $9
         WHERE tenant_id = $1`,
        [
          tenantId,
          limits.users,
          limits.extensions,
          limits.trunks,
          limits.inboundRoutes,
          limits.outboundRoutes,
          limits.pickupGroups,
          limits.ringGroups,
          limits.voicemailBoxes,
        ],
      );

      return { limits, usage: resources.usage };
    });
  }

  async setStatus(tenantId: string, status: 'active' | 'suspended') {
    const result = await this.database.query(
      `UPDATE core.tenants
       SET status = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, name, slug, domain, status`,
      [status, tenantId],
    );
    return result.rows[0];
  }

  async close(tenantId: string) {
    await this.database.query(
      `UPDATE core.tenants
       SET status = 'closed', updated_at = now()
       WHERE id = $1`,
      [tenantId],
    );
  }

  private ensureSuperAdmin(session: SessionContext) {
    if (session.role !== 'super_admin') {
      throw new ForbiddenException(
        'Somente Super Admin pode alterar recursos contratados.',
      );
    }
  }
}
