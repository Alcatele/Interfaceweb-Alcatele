import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      'postgresql://alcatele:alcatele@localhost:5432/alcatele_mvp',
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    statement_timeout: Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS ?? 10000),
  });

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async tenantTransaction<T>(
    tenantId: string,
    userId: string,
    membershipId: string,
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.transaction(async (client) => {
      await client.query(
        `SELECT core.set_request_context($1::uuid, $2::uuid, $3::uuid)`,
        [tenantId, userId, membershipId],
      );
      return callback(client);
    });
  }

  async identityTransaction<T>(
    userId: string,
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.transaction(async (client) => {
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId]);
      return callback(client);
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
