import { ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SessionContext } from '../auth/auth.types';

export type CreateTenantInput = {
  name: string;
  slug: string;
  domain: string;
};

@Injectable()
export class TenantsService {
  constructor(private readonly database: DatabaseService) {}

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

    return result.rows.map((tenant) => ({
      ...tenant,
      active: tenant.id === session.tenant.id,
      role:
        session.availableTenants.find((item) => item.id === tenant.id)?.role ??
        null,
    }));
  }

  async create(session: SessionContext, input: CreateTenantInput) {
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

        return tenant;
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Slug ou domínio já está em uso.');
      }
      throw error;
    }
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
}
