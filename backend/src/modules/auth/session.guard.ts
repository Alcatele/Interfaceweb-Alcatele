import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './auth.decorators';
import { AuthenticatedRequest, SessionContext } from './auth.types';

function readCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');

    if (key === name) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly database: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request.headers.cookie, 'mvp_session');

    if (!token) {
      throw new UnauthorizedException('Sessão ausente.');
    }

    const sessionResult = await this.database.query<{
      id: string;
      user_id: string;
      active_tenant_id: string;
      active_membership_id: string;
    }>(
      `SELECT id, user_id, active_tenant_id, active_membership_id
       FROM iam.sessions
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > now()`,
      [hashToken(token)],
    );
    const storedSession = sessionResult.rows[0];

    if (!storedSession) {
      throw new UnauthorizedException('Sessão expirada.');
    }

    const session = await this.loadSession(storedSession);
    request.session = session;

    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      required?.length &&
      !required.every((permission) => session.permissions.includes(permission))
    ) {
      throw new ForbiddenException('Permissão insuficiente.');
    }

    void this.database
      .query(`UPDATE iam.sessions SET last_seen_at = now() WHERE id = $1`, [
        storedSession.id,
      ])
      .catch(() => undefined);

    return true;
  }

  private loadSession(storedSession: {
    id: string;
    user_id: string;
    active_tenant_id: string;
    active_membership_id: string;
  }): Promise<SessionContext> {
    return this.database.tenantTransaction(
      storedSession.active_tenant_id,
      storedSession.user_id,
      storedSession.active_membership_id,
      async (client) => {
        const currentResult = await client.query<{
          user_id: string;
          display_name: string;
          username: string;
          email: string;
          membership_id: string;
          tenant_id: string;
          tenant_name: string;
          tenant_slug: string;
          tenant_domain: string;
          role_code: string;
          permissions: string[];
        }>(
          `SELECT
             u.id AS user_id,
             u.display_name,
             u.username,
             u.email,
             m.id AS membership_id,
             t.id AS tenant_id,
             t.name AS tenant_name,
             t.slug AS tenant_slug,
             t.domain AS tenant_domain,
             r.code AS role_code,
             COALESCE(
               array_agg(p.code ORDER BY p.code)
                 FILTER (WHERE p.code IS NOT NULL),
               ARRAY[]::text[]
             ) AS permissions
           FROM iam.users u
           JOIN iam.memberships m ON m.user_id = u.id
           JOIN core.tenants t ON t.id = m.tenant_id
           JOIN iam.roles r ON r.id = m.role_id
           LEFT JOIN iam.role_permissions rp ON rp.role_id = r.id
           LEFT JOIN iam.permissions p ON p.id = rp.permission_id
           WHERE u.id = $1
             AND m.id = $2
             AND m.tenant_id = $3
             AND u.status = 'active'
             AND m.status = 'active'
             AND t.status = 'active'
           GROUP BY u.id, m.id, t.id, r.code`,
          [
            storedSession.user_id,
            storedSession.active_membership_id,
            storedSession.active_tenant_id,
          ],
        );
        const current = currentResult.rows[0];

        if (!current) {
          throw new UnauthorizedException('Acesso ao tenant indisponível.');
        }

        const tenantResult = await client.query<{
          id: string;
          name: string;
          slug: string;
          domain: string;
          membership_id: string;
          role: string;
        }>(
          `SELECT
             t.id,
             t.name,
             t.slug,
             t.domain,
             m.id AS membership_id,
             r.code AS role
           FROM iam.memberships m
           JOIN core.tenants t ON t.id = m.tenant_id
           JOIN iam.roles r ON r.id = m.role_id
           WHERE m.user_id = $1
             AND m.status = 'active'
             AND t.status = 'active'
           ORDER BY t.name`,
          [storedSession.user_id],
        );

        return {
          sessionId: storedSession.id,
          user: {
            id: current.user_id,
            name: current.display_name,
            username: current.username,
            email: current.email,
          },
          tenant: {
            id: current.tenant_id,
            name: current.tenant_name,
            slug: current.tenant_slug,
            domain: current.tenant_domain,
          },
          membershipId: current.membership_id,
          role: current.role_code,
          permissions: current.permissions,
          availableTenants: tenantResult.rows.map((tenant) => ({
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            domain: tenant.domain,
            membershipId: tenant.membership_id,
            role: tenant.role,
          })),
        };
      },
    );
  }
}
