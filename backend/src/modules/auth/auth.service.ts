import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  async login(identifier: string, password: string, remember: boolean) {
    const userResult = await this.database.query<{
      id: string;
    }>(
      `SELECT id
       FROM iam.users
       WHERE status = 'active'
         AND (username = $1 OR email = $1)
         AND password_hash = crypt($2, password_hash)`,
      [identifier.trim().toLowerCase(), password],
    );
    const user = userResult.rows[0];

    if (!user) {
      throw new UnauthorizedException('Usuário ou senha inválidos.');
    }

    const membership = await this.database.identityTransaction(
      user.id,
      async (client) => {
        const result = await client.query<{
          id: string;
          tenant_id: string;
        }>(
          `SELECT m.id, m.tenant_id
           FROM iam.memberships m
           JOIN core.tenants t ON t.id = m.tenant_id
           WHERE m.user_id = $1
             AND m.status = 'active'
             AND t.status = 'active'
           ORDER BY m.is_default DESC, t.name
           LIMIT 1`,
          [user.id],
        );
        return result.rows[0];
      },
    );

    if (!membership) {
      throw new UnauthorizedException('Usuário sem empresa ativa.');
    }

    const token = randomBytes(32).toString('base64url');
    const hours = remember ? 24 * 30 : 8;
    const sessionResult = await this.database.query<{ id: string }>(
      `INSERT INTO iam.sessions (
         user_id,
         active_tenant_id,
         active_membership_id,
         token_hash,
         expires_at
       )
       VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5))
       RETURNING id`,
      [
        user.id,
        membership.tenant_id,
        membership.id,
        hashToken(token),
        hours,
      ],
    );
    await this.database.query(
      `UPDATE iam.users SET last_login_at = now() WHERE id = $1`,
      [user.id],
    );

    return {
      token,
      sessionId: sessionResult.rows[0].id,
      maxAgeMs: remember ? hours * 60 * 60 * 1000 : undefined,
    };
  }

  async logout(sessionId: string) {
    await this.database.query(
      `UPDATE iam.sessions SET revoked_at = now() WHERE id = $1`,
      [sessionId],
    );
  }

  async switchTenant(sessionId: string, userId: string, tenantId: string) {
    const membership = await this.database.identityTransaction(
      userId,
      async (client) => {
        const result = await client.query<{ id: string }>(
          `SELECT id
           FROM iam.memberships
           WHERE user_id = $1
             AND tenant_id = $2
             AND status = 'active'`,
          [userId, tenantId],
        );
        return result.rows[0];
      },
    );

    if (!membership) {
      throw new UnauthorizedException('Empresa não disponível para o usuário.');
    }

    await this.database.query(
      `UPDATE iam.sessions
       SET active_tenant_id = $1,
           active_membership_id = $2,
           last_seen_at = now()
       WHERE id = $3
         AND user_id = $4`,
      [tenantId, membership.id, sessionId, userId],
    );
  }
}
