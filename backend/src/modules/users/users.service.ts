import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { SessionContext } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { ResourceLimitsService } from '../database/resource-limits.service';

export type CreateUserInput = {
  name: string;
  username: string;
  email: string;
  password: string;
  role: string;
  extension?: string;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly resourceLimits: ResourceLimitsService,
  ) {}

  list(session: SessionContext) {
    return this.database.tenantTransaction(
      session.tenant.id,
      session.user.id,
      session.membershipId,
      async (client) => {
        const result = await client.query(
          `SELECT
             u.id,
             u.display_name AS name,
             u.username,
             u.email,
             r.code AS role,
             m.status,
             e.extension_number AS extension,
             u.last_login_at AS "lastAccess"
           FROM iam.memberships m
           JOIN iam.users u ON u.id = m.user_id
           JOIN iam.roles r ON r.id = m.role_id
           LEFT JOIN telephony.extensions e
             ON e.membership_id = m.id
            AND e.deleted_at IS NULL
           WHERE m.tenant_id = $1
           ORDER BY u.display_name`,
          [session.tenant.id],
        );
        return result.rows;
      },
    );
  }

  async create(session: SessionContext, input: CreateUserInput) {
    try {
      return await this.database.tenantTransaction(
        session.tenant.id,
        session.user.id,
        session.membershipId,
        async (client) => {
          await this.resourceLimits.assertAvailable(
            client,
            session.tenant.id,
            'users',
          );

          if (input.extension) {
            await this.resourceLimits.assertAvailable(
              client,
              session.tenant.id,
              'extensions',
            );
          }

          const roleResult = await client.query<{ id: string }>(
            `SELECT id
             FROM iam.roles
             WHERE tenant_id = $1
               AND code = $2`,
            [session.tenant.id, input.role],
          );

          if (!roleResult.rows[0]) {
            throw new NotFoundException('Perfil não encontrado.');
          }

          const userResult = await client.query<{ id: string }>(
            `INSERT INTO iam.users (
               username,
               email,
               display_name,
               password_hash,
               status
             )
             VALUES (
               lower($1),
               lower($2),
               $3,
               crypt($4, gen_salt('bf', 12)),
               'active'
             )
             RETURNING id`,
            [
              input.username.trim(),
              input.email.trim(),
              input.name.trim(),
              input.password,
            ],
          );
          const membershipResult = await client.query<{ id: string }>(
            `INSERT INTO iam.memberships (
               tenant_id,
               user_id,
               role_id,
               status
             )
             VALUES ($1, $2, $3, 'active')
             RETURNING id`,
            [
              session.tenant.id,
              userResult.rows[0].id,
              roleResult.rows[0].id,
            ],
          );

          if (input.extension) {
            await client.query(
              `INSERT INTO telephony.extensions (
                 tenant_id,
                 membership_id,
                 extension_number,
                 display_name,
                 department,
                 device,
                 auth_username,
                 status,
                 sync_status
               )
               VALUES ($1, $2, $3, $4, 'Geral', 'Webphone', $3, 'offline', 'pending')`,
              [
                session.tenant.id,
                membershipResult.rows[0].id,
                input.extension.trim(),
                input.name.trim(),
              ],
            );
          }

          return { id: userResult.rows[0].id };
        },
      );
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Usuário, e-mail ou ramal já cadastrado.');
      }
      throw error;
    }
  }

  resetPassword(session: SessionContext, userId: string, password: string) {
    return this.database.tenantTransaction(
      session.tenant.id,
      session.user.id,
      session.membershipId,
      async (client) => {
        await this.ensureManageableTarget(client, session, userId);
        const result = await client.query(
          `UPDATE iam.users u
           SET password_hash = crypt($1, gen_salt('bf', 12)),
               updated_at = now()
           FROM iam.memberships m
           WHERE m.user_id = u.id
             AND m.tenant_id = $2
             AND u.id = $3
           RETURNING u.id`,
          [password, session.tenant.id, userId],
        );

        if (!result.rows[0]) {
          throw new NotFoundException('Usuário não encontrado.');
        }
      },
    );
  }

  remove(session: SessionContext, userId: string) {
    if (userId === session.user.id) {
      throw new ConflictException('Você não pode remover o próprio acesso.');
    }

    return this.database.tenantTransaction(
      session.tenant.id,
      session.user.id,
      session.membershipId,
      async (client) => {
        await this.ensureManageableTarget(client, session, userId);
        const result = await client.query(
          `UPDATE iam.memberships
           SET status = 'disabled', updated_at = now()
           WHERE tenant_id = $1
             AND user_id = $2
           RETURNING id`,
          [session.tenant.id, userId],
        );

        if (!result.rows[0]) {
          throw new NotFoundException('Usuário não encontrado.');
        }
      },
    );
  }

  permissions(session: SessionContext) {
    return this.database.tenantTransaction(
      session.tenant.id,
      session.user.id,
      session.membershipId,
      async (client) => {
        const result = await client.query(
          `SELECT
             r.code AS role,
             r.name,
             r.description,
             COALESCE(
               array_agg(p.code ORDER BY p.code)
                 FILTER (WHERE p.code IS NOT NULL),
               ARRAY[]::text[]
             ) AS permissions
           FROM iam.roles r
           LEFT JOIN iam.role_permissions rp ON rp.role_id = r.id
           LEFT JOIN iam.permissions p ON p.id = rp.permission_id
           WHERE r.tenant_id = $1
           GROUP BY r.id
           ORDER BY r.name`,
          [session.tenant.id],
        );
        return result.rows;
      },
    );
  }

  private async ensureManageableTarget(
    client: PoolClient,
    session: SessionContext,
    userId: string,
  ) {
    const result = await client.query<{ role: string }>(
      `SELECT r.code AS role
       FROM iam.memberships m
       JOIN iam.roles r ON r.id = m.role_id
       WHERE m.tenant_id = $1
         AND m.user_id = $2`,
      [session.tenant.id, userId],
    );
    const target = result.rows[0];

    if (!target) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (target.role === 'super_admin' && session.role !== 'super_admin') {
      throw new ForbiddenException(
        'Somente Super Admin pode alterar outro Super Admin.',
      );
    }
  }
}
