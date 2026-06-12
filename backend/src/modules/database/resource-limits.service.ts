import { ConflictException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';

export const resourceLimitKeys = [
  'users',
  'extensions',
  'trunks',
  'inboundRoutes',
  'outboundRoutes',
  'pickupGroups',
  'ringGroups',
  'voicemailBoxes',
] as const;

export type ResourceLimitKey = (typeof resourceLimitKeys)[number];

export type TenantLimits = Record<ResourceLimitKey, number>;
export type TenantUsage = Record<ResourceLimitKey, number>;

const resourceDefinitions: Record<
  ResourceLimitKey,
  { column: string; countSql: string; label: string }
> = {
  users: {
    column: 'max_users',
    countSql:
      "SELECT count(*)::int AS total FROM iam.memberships WHERE tenant_id = $1 AND status = 'active'",
    label: 'usuários',
  },
  extensions: {
    column: 'max_extensions',
    countSql:
      'SELECT count(*)::int AS total FROM telephony.extensions WHERE tenant_id = $1 AND deleted_at IS NULL',
    label: 'ramais',
  },
  trunks: {
    column: 'max_trunks',
    countSql:
      'SELECT count(*)::int AS total FROM telephony.sip_trunks WHERE tenant_id = $1 AND deleted_at IS NULL',
    label: 'troncos SIP',
  },
  inboundRoutes: {
    column: 'max_inbound_routes',
    countSql:
      'SELECT count(*)::int AS total FROM telephony.inbound_routes WHERE tenant_id = $1 AND deleted_at IS NULL',
    label: 'rotas de entrada',
  },
  outboundRoutes: {
    column: 'max_outbound_routes',
    countSql:
      'SELECT count(*)::int AS total FROM telephony.outbound_routes WHERE tenant_id = $1 AND deleted_at IS NULL',
    label: 'rotas de saída',
  },
  pickupGroups: {
    column: 'max_pickup_groups',
    countSql:
      'SELECT count(*)::int AS total FROM telephony.pickup_groups WHERE tenant_id = $1 AND deleted_at IS NULL',
    label: 'grupos de captura',
  },
  ringGroups: {
    column: 'max_ring_groups',
    countSql:
      'SELECT count(*)::int AS total FROM telephony.ring_groups WHERE tenant_id = $1 AND deleted_at IS NULL',
    label: 'grupos de chamada',
  },
  voicemailBoxes: {
    column: 'max_voicemail_boxes',
    countSql:
      'SELECT count(*)::int AS total FROM telephony.voicemail_boxes WHERE tenant_id = $1 AND deleted_at IS NULL',
    label: 'caixas postais',
  },
};

@Injectable()
export class ResourceLimitsService {
  async assertAvailable(
    client: PoolClient,
    tenantId: string,
    resource: ResourceLimitKey,
  ) {
    const definition = resourceDefinitions[resource];
    const limitResult = await client.query<{ limit: number }>(
      `SELECT ${definition.column} AS "limit"
       FROM core.tenant_limits
       WHERE tenant_id = $1
       FOR UPDATE`,
      [tenantId],
    );
    const usageResult = await client.query<{ total: number }>(
      definition.countSql,
      [tenantId],
    );
    const limit = Number(limitResult.rows[0]?.limit ?? 0);
    const used = Number(usageResult.rows[0]?.total ?? 0);

    if (used >= limit) {
      throw new ConflictException(
        `Limite contratado de ${definition.label} atingido (${used}/${limit}).`,
      );
    }
  }

  async get(client: PoolClient, tenantId: string) {
    const result = await client.query<{
      max_users: number;
      max_extensions: number;
      max_trunks: number;
      max_inbound_routes: number;
      max_outbound_routes: number;
      max_pickup_groups: number;
      max_ring_groups: number;
      max_voicemail_boxes: number;
      users: number;
      extensions: number;
      trunks: number;
      inbound_routes: number;
      outbound_routes: number;
      pickup_groups: number;
      ring_groups: number;
      voicemail_boxes: number;
    }>(
      `SELECT
         limits.max_users,
         limits.max_extensions,
         limits.max_trunks,
         limits.max_inbound_routes,
         limits.max_outbound_routes,
         limits.max_pickup_groups,
         limits.max_ring_groups,
         limits.max_voicemail_boxes,
         (
           SELECT count(*) FROM iam.memberships
           WHERE tenant_id = $1 AND status = 'active'
         )::int AS users,
         (
           SELECT count(*) FROM telephony.extensions
           WHERE tenant_id = $1 AND deleted_at IS NULL
         )::int AS extensions,
         (
           SELECT count(*) FROM telephony.sip_trunks
           WHERE tenant_id = $1 AND deleted_at IS NULL
         )::int AS trunks,
         (
           SELECT count(*) FROM telephony.inbound_routes
           WHERE tenant_id = $1 AND deleted_at IS NULL
         )::int AS inbound_routes,
         (
           SELECT count(*) FROM telephony.outbound_routes
           WHERE tenant_id = $1 AND deleted_at IS NULL
         )::int AS outbound_routes,
         (
           SELECT count(*) FROM telephony.pickup_groups
           WHERE tenant_id = $1 AND deleted_at IS NULL
         )::int AS pickup_groups,
         (
           SELECT count(*) FROM telephony.ring_groups
           WHERE tenant_id = $1 AND deleted_at IS NULL
         )::int AS ring_groups,
         (
           SELECT count(*) FROM telephony.voicemail_boxes
           WHERE tenant_id = $1 AND deleted_at IS NULL
         )::int AS voicemail_boxes
       FROM core.tenant_limits limits
       WHERE limits.tenant_id = $1`,
      [tenantId],
    );
    const row = result.rows[0];

    return {
      limits: {
        users: Number(row.max_users),
        extensions: Number(row.max_extensions),
        trunks: Number(row.max_trunks),
        inboundRoutes: Number(row.max_inbound_routes),
        outboundRoutes: Number(row.max_outbound_routes),
        pickupGroups: Number(row.max_pickup_groups),
        ringGroups: Number(row.max_ring_groups),
        voicemailBoxes: Number(row.max_voicemail_boxes),
      } satisfies TenantLimits,
      usage: {
        users: Number(row.users),
        extensions: Number(row.extensions),
        trunks: Number(row.trunks),
        inboundRoutes: Number(row.inbound_routes),
        outboundRoutes: Number(row.outbound_routes),
        pickupGroups: Number(row.pickup_groups),
        ringGroups: Number(row.ring_groups),
        voicemailBoxes: Number(row.voicemail_boxes),
      } satisfies TenantUsage,
    };
  }
}
