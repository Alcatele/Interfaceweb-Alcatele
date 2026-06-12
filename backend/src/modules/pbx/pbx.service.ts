import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { SessionContext } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { ResourceLimitsService } from '../database/resource-limits.service';

type ResourceType =
  | 'extension'
  | 'trunk'
  | 'inbound_route'
  | 'outbound_route'
  | 'pickup_group'
  | 'ring_group'
  | 'voicemail_box';

@Injectable()
export class PbxService {
  constructor(
    private readonly database: DatabaseService,
    private readonly resourceLimits: ResourceLimitsService,
  ) {}

  listExtensions(session: SessionContext) {
    return this.inTenant(session, async (client) => {
      const result = await client.query(
        `SELECT
           id,
           tenant_id AS "tenantId",
           extension_number AS number,
           display_name AS name,
           department,
           device,
           status,
           COALESCE(last_ip::text, '-') AS ip,
           CASE
             WHEN last_seen_at IS NULL THEN 'Nunca'
             ELSE to_char(last_seen_at, 'DD/MM/YYYY HH24:MI')
           END AS "lastSeen",
           sync_status AS "syncStatus"
         FROM telephony.extensions
         WHERE tenant_id = $1 AND deleted_at IS NULL
         ORDER BY extension_number`,
        [session.tenant.id],
      );
      return result.rows;
    });
  }

  createExtension(
    session: SessionContext,
    input: {
      number: string;
      name: string;
      department: string;
      device: string;
    },
  ) {
    return this.mutate(session, async (client) => {
      await this.resourceLimits.assertAvailable(
        client,
        session.tenant.id,
        'extensions',
      );
      const result = await client.query(
        `INSERT INTO telephony.extensions AS e (
           tenant_id,
           extension_number,
           display_name,
           department,
           device,
           auth_username,
           status,
           sync_status
         )
         VALUES ($1, $2, $3, $4, $5, $2, 'offline', 'pending')
         RETURNING e.id, to_jsonb(e) AS state`,
        [
          session.tenant.id,
          input.number.trim(),
          input.name.trim(),
          input.department.trim(),
          input.device.trim(),
        ],
      );
      await this.enqueue(
        client,
        session.tenant.id,
        'extension',
        result.rows[0].id as string,
        'create',
        result.rows[0].state as Record<string, unknown>,
      );
      return result.rows[0];
    });
  }

  updateExtension(
    session: SessionContext,
    resourceId: string,
    input: {
      number: string;
      name: string;
      department: string;
      device: string;
      status?: string;
    },
  ) {
    return this.mutate(session, async (client) => {
      await this.resourceLimits.assertAvailable(
        client,
        session.tenant.id,
        'trunks',
      );
      const result = await client.query(
        `UPDATE telephony.extensions AS e
         SET extension_number = $3,
             display_name = $4,
             department = $5,
             device = $6,
             status = COALESCE($7, status),
             sync_status = 'pending'
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING e.id, to_jsonb(e) AS state`,
        [
          session.tenant.id,
          resourceId,
          input.number.trim(),
          input.name.trim(),
          input.department.trim(),
          input.device.trim(),
          input.status ?? null,
        ],
      );
      this.ensureFound(result.rows[0]);
      await this.enqueue(
        client,
        session.tenant.id,
        'extension',
        resourceId,
        'update',
        result.rows[0].state as Record<string, unknown>,
      );
      return result.rows[0];
    });
  }

  removeExtension(session: SessionContext, resourceId: string) {
    return this.softDelete(session, 'telephony.extensions', 'extension', resourceId);
  }

  listTrunks(session: SessionContext) {
    return this.inTenant(session, async (client) => {
      const result = await client.query(
        `SELECT
           id,
           tenant_id AS "tenantId",
           name,
           provider,
           host,
           max_channels AS channels,
           status,
           latency_ms AS latency,
           sync_status AS "syncStatus"
         FROM telephony.sip_trunks
         WHERE tenant_id = $1 AND deleted_at IS NULL
         ORDER BY name`,
        [session.tenant.id],
      );
      return result.rows;
    });
  }

  createTrunk(
    session: SessionContext,
    input: {
      name: string;
      provider: string;
      host: string;
      channels: number;
    },
  ) {
    return this.mutate(session, async (client) => {
      await this.resourceLimits.assertAvailable(
        client,
        session.tenant.id,
        'inboundRoutes',
      );
      const result = await client.query(
        `INSERT INTO telephony.sip_trunks AS t (
           tenant_id, name, provider, host, max_channels, status, sync_status
         )
         VALUES ($1, $2, $3, $4, $5, 'warning', 'pending')
         RETURNING t.id, to_jsonb(t) AS state`,
        [
          session.tenant.id,
          input.name.trim(),
          input.provider.trim(),
          input.host.trim(),
          input.channels,
        ],
      );
      await this.enqueue(
        client,
        session.tenant.id,
        'trunk',
        result.rows[0].id as string,
        'create',
        result.rows[0].state as Record<string, unknown>,
      );
      return result.rows[0];
    });
  }

  updateTrunk(
    session: SessionContext,
    resourceId: string,
    input: {
      name: string;
      provider: string;
      host: string;
      channels: number;
      status?: string;
    },
  ) {
    return this.mutate(session, async (client) => {
      await this.resourceLimits.assertAvailable(
        client,
        session.tenant.id,
        'outboundRoutes',
      );
      const result = await client.query(
        `UPDATE telephony.sip_trunks AS t
         SET name = $3,
             provider = $4,
             host = $5,
             max_channels = $6,
             status = COALESCE($7, status),
             sync_status = 'pending'
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING t.id, to_jsonb(t) AS state`,
        [
          session.tenant.id,
          resourceId,
          input.name.trim(),
          input.provider.trim(),
          input.host.trim(),
          input.channels,
          input.status ?? null,
        ],
      );
      this.ensureFound(result.rows[0]);
      await this.enqueue(
        client,
        session.tenant.id,
        'trunk',
        resourceId,
        'update',
        result.rows[0].state as Record<string, unknown>,
      );
      return result.rows[0];
    });
  }

  removeTrunk(session: SessionContext, resourceId: string) {
    return this.softDelete(session, 'telephony.sip_trunks', 'trunk', resourceId);
  }

  listInboundRoutes(session: SessionContext) {
    return this.inTenant(session, async (client) => {
      const result = await client.query(
        `SELECT
           id,
           did_pattern AS did,
           description,
           destination,
           schedule,
           enabled,
           sync_status AS "syncStatus"
         FROM telephony.inbound_routes
         WHERE tenant_id = $1 AND deleted_at IS NULL
         ORDER BY did_pattern`,
        [session.tenant.id],
      );
      return result.rows;
    });
  }

  createInboundRoute(
    session: SessionContext,
    input: {
      did: string;
      description: string;
      destination: string;
      schedule: string;
      enabled: boolean;
    },
  ) {
    return this.mutate(session, async (client) => {
      const result = await client.query(
        `INSERT INTO telephony.inbound_routes AS r (
           tenant_id,
           did_pattern,
           description,
           destination,
           schedule,
           enabled,
           sync_status
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING r.id, to_jsonb(r) AS state`,
        [
          session.tenant.id,
          input.did.trim(),
          input.description.trim(),
          input.destination.trim(),
          input.schedule.trim(),
          input.enabled,
        ],
      );
      await this.enqueue(
        client,
        session.tenant.id,
        'inbound_route',
        result.rows[0].id as string,
        'create',
        result.rows[0].state as Record<string, unknown>,
      );
      return result.rows[0];
    });
  }

  updateInboundRoute(
    session: SessionContext,
    resourceId: string,
    input: {
      did: string;
      description: string;
      destination: string;
      schedule: string;
      enabled: boolean;
    },
  ) {
    return this.updateSimpleRoute(
      session,
      'telephony.inbound_routes',
      'inbound_route',
      resourceId,
      `did_pattern = $3, description = $4, destination = $5,
       schedule = $6, enabled = $7`,
      [
        input.did.trim(),
        input.description.trim(),
        input.destination.trim(),
        input.schedule.trim(),
        input.enabled,
      ],
    );
  }

  removeInboundRoute(session: SessionContext, resourceId: string) {
    return this.softDelete(
      session,
      'telephony.inbound_routes',
      'inbound_route',
      resourceId,
    );
  }

  listOutboundRoutes(session: SessionContext) {
    return this.inTenant(session, async (client) => {
      const result = await client.query(
        `SELECT
           r.id,
           r.name,
           r.pattern,
           r.trunk_id AS "trunkId",
           t.name AS trunk,
           r.priority,
           r.enabled,
           r.sync_status AS "syncStatus"
         FROM telephony.outbound_routes r
         JOIN telephony.sip_trunks t
           ON t.tenant_id = r.tenant_id
          AND t.id = r.trunk_id
         WHERE r.tenant_id = $1 AND r.deleted_at IS NULL
         ORDER BY r.priority, r.name`,
        [session.tenant.id],
      );
      return result.rows;
    });
  }

  createOutboundRoute(
    session: SessionContext,
    input: {
      name: string;
      pattern: string;
      trunkId: string;
      priority: number;
      enabled: boolean;
    },
  ) {
    return this.mutate(session, async (client) => {
      const result = await client.query(
        `INSERT INTO telephony.outbound_routes AS r (
           tenant_id, name, pattern, trunk_id, priority, enabled, sync_status
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING r.id, to_jsonb(r) AS state`,
        [
          session.tenant.id,
          input.name.trim(),
          input.pattern.trim(),
          input.trunkId,
          input.priority,
          input.enabled,
        ],
      );
      await this.enqueue(
        client,
        session.tenant.id,
        'outbound_route',
        result.rows[0].id as string,
        'create',
        result.rows[0].state as Record<string, unknown>,
      );
      return result.rows[0];
    });
  }

  updateOutboundRoute(
    session: SessionContext,
    resourceId: string,
    input: {
      name: string;
      pattern: string;
      trunkId: string;
      priority: number;
      enabled: boolean;
    },
  ) {
    return this.updateSimpleRoute(
      session,
      'telephony.outbound_routes',
      'outbound_route',
      resourceId,
      `name = $3, pattern = $4, trunk_id = $5,
       priority = $6, enabled = $7`,
      [
        input.name.trim(),
        input.pattern.trim(),
        input.trunkId,
        input.priority,
        input.enabled,
      ],
    );
  }

  removeOutboundRoute(session: SessionContext, resourceId: string) {
    return this.softDelete(
      session,
      'telephony.outbound_routes',
      'outbound_route',
      resourceId,
    );
  }

  listPickupGroups(session: SessionContext) {
    return this.inTenant(session, async (client) => {
      const result = await client.query(
        `SELECT
           id,
           tenant_id AS "tenantId",
           name,
           feature_code AS code,
           members,
           enabled,
           sync_status AS "syncStatus"
         FROM telephony.pickup_groups
         WHERE tenant_id = $1 AND deleted_at IS NULL
         ORDER BY name`,
        [session.tenant.id],
      );
      return result.rows;
    });
  }

  createPickupGroup(
    session: SessionContext,
    input: {
      name: string;
      code: string;
      members: string[];
      enabled: boolean;
    },
  ) {
    return this.mutate(session, async (client) => {
      await this.resourceLimits.assertAvailable(
        client,
        session.tenant.id,
        'pickupGroups',
      );
      await this.ensureExtensions(client, session.tenant.id, input.members);
      const result = await client.query(
        `INSERT INTO telephony.pickup_groups AS group_resource (
           tenant_id, name, feature_code, members, enabled, sync_status
         )
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING group_resource.id, to_jsonb(group_resource) AS state`,
        [
          session.tenant.id,
          input.name.trim(),
          input.code.trim(),
          input.members,
          input.enabled,
        ],
      );
      await this.enqueue(
        client,
        session.tenant.id,
        'pickup_group',
        result.rows[0].id as string,
        'create',
        result.rows[0].state as Record<string, unknown>,
      );
      return result.rows[0];
    });
  }

  updatePickupGroup(
    session: SessionContext,
    resourceId: string,
    input: {
      name: string;
      code: string;
      members: string[];
      enabled: boolean;
    },
  ) {
    return this.mutate(session, async (client) => {
      await this.ensureExtensions(client, session.tenant.id, input.members);
      const result = await client.query(
        `UPDATE telephony.pickup_groups AS group_resource
         SET name = $3,
             feature_code = $4,
             members = $5,
             enabled = $6,
             sync_status = 'pending'
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING group_resource.id, to_jsonb(group_resource) AS state`,
        [
          session.tenant.id,
          resourceId,
          input.name.trim(),
          input.code.trim(),
          input.members,
          input.enabled,
        ],
      );
      this.ensureFound(result.rows[0]);
      await this.enqueue(
        client,
        session.tenant.id,
        'pickup_group',
        resourceId,
        'update',
        result.rows[0].state as Record<string, unknown>,
      );
      return result.rows[0];
    });
  }

  removePickupGroup(session: SessionContext, resourceId: string) {
    return this.softDelete(
      session,
      'telephony.pickup_groups',
      'pickup_group',
      resourceId,
    );
  }

  listRingGroups(session: SessionContext) {
    return this.inTenant(session, async (client) => {
      const result = await client.query(
        `SELECT
           id,
           tenant_id AS "tenantId",
           name,
           group_number AS number,
           strategy,
           timeout_seconds AS timeout,
           members,
           fallback,
           enabled,
           sync_status AS "syncStatus"
         FROM telephony.ring_groups
         WHERE tenant_id = $1 AND deleted_at IS NULL
         ORDER BY name`,
        [session.tenant.id],
      );
      return result.rows;
    });
  }

  createRingGroup(
    session: SessionContext,
    input: {
      name: string;
      number: string;
      strategy: 'simultaneous' | 'sequential' | 'random';
      timeout: number;
      members: string[];
      fallback: string;
      enabled: boolean;
    },
  ) {
    return this.mutate(session, async (client) => {
      await this.resourceLimits.assertAvailable(
        client,
        session.tenant.id,
        'ringGroups',
      );
      await this.ensureExtensions(client, session.tenant.id, input.members);
      const result = await client.query(
        `INSERT INTO telephony.ring_groups AS group_resource (
           tenant_id,
           name,
           group_number,
           strategy,
           timeout_seconds,
           members,
           fallback,
           enabled,
           sync_status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
         RETURNING group_resource.id, to_jsonb(group_resource) AS state`,
        [
          session.tenant.id,
          input.name.trim(),
          input.number.trim(),
          input.strategy,
          input.timeout,
          input.members,
          input.fallback.trim(),
          input.enabled,
        ],
      );
      await this.enqueue(
        client,
        session.tenant.id,
        'ring_group',
        result.rows[0].id as string,
        'create',
        result.rows[0].state as Record<string, unknown>,
      );
      return result.rows[0];
    });
  }

  updateRingGroup(
    session: SessionContext,
    resourceId: string,
    input: {
      name: string;
      number: string;
      strategy: 'simultaneous' | 'sequential' | 'random';
      timeout: number;
      members: string[];
      fallback: string;
      enabled: boolean;
    },
  ) {
    return this.mutate(session, async (client) => {
      await this.ensureExtensions(client, session.tenant.id, input.members);
      const result = await client.query(
        `UPDATE telephony.ring_groups AS group_resource
         SET name = $3,
             group_number = $4,
             strategy = $5,
             timeout_seconds = $6,
             members = $7,
             fallback = $8,
             enabled = $9,
             sync_status = 'pending'
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING group_resource.id, to_jsonb(group_resource) AS state`,
        [
          session.tenant.id,
          resourceId,
          input.name.trim(),
          input.number.trim(),
          input.strategy,
          input.timeout,
          input.members,
          input.fallback.trim(),
          input.enabled,
        ],
      );
      this.ensureFound(result.rows[0]);
      await this.enqueue(
        client,
        session.tenant.id,
        'ring_group',
        resourceId,
        'update',
        result.rows[0].state as Record<string, unknown>,
      );
      return result.rows[0];
    });
  }

  removeRingGroup(session: SessionContext, resourceId: string) {
    return this.softDelete(
      session,
      'telephony.ring_groups',
      'ring_group',
      resourceId,
    );
  }

  listVoicemailBoxes(session: SessionContext) {
    return this.inTenant(session, async (client) => {
      const result = await client.query(
        `SELECT
           id,
           tenant_id AS "tenantId",
           mailbox,
           display_name AS name,
           notification_email AS "notificationEmail",
           transcription_enabled AS "transcriptionEnabled",
           enabled,
           sync_status AS "syncStatus"
         FROM telephony.voicemail_boxes
         WHERE tenant_id = $1 AND deleted_at IS NULL
         ORDER BY mailbox`,
        [session.tenant.id],
      );
      return result.rows;
    });
  }

  createVoicemailBox(
    session: SessionContext,
    input: {
      mailbox: string;
      name: string;
      notificationEmail?: string;
      transcriptionEnabled: boolean;
      enabled: boolean;
    },
  ) {
    return this.mutate(session, async (client) => {
      await this.resourceLimits.assertAvailable(
        client,
        session.tenant.id,
        'voicemailBoxes',
      );
      const result = await client.query(
        `INSERT INTO telephony.voicemail_boxes AS mailbox_resource (
           tenant_id,
           mailbox,
           display_name,
           notification_email,
           transcription_enabled,
           enabled,
           sync_status
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING mailbox_resource.id, to_jsonb(mailbox_resource) AS state`,
        [
          session.tenant.id,
          input.mailbox.trim(),
          input.name.trim(),
          input.notificationEmail?.trim() || null,
          input.transcriptionEnabled,
          input.enabled,
        ],
      );
      await this.enqueue(
        client,
        session.tenant.id,
        'voicemail_box',
        result.rows[0].id as string,
        'create',
        result.rows[0].state as Record<string, unknown>,
      );
      return result.rows[0];
    });
  }

  updateVoicemailBox(
    session: SessionContext,
    resourceId: string,
    input: {
      mailbox: string;
      name: string;
      notificationEmail?: string;
      transcriptionEnabled: boolean;
      enabled: boolean;
    },
  ) {
    return this.mutate(session, async (client) => {
      const result = await client.query(
        `UPDATE telephony.voicemail_boxes AS mailbox_resource
         SET mailbox = $3,
             display_name = $4,
             notification_email = $5,
             transcription_enabled = $6,
             enabled = $7,
             sync_status = 'pending'
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING mailbox_resource.id, to_jsonb(mailbox_resource) AS state`,
        [
          session.tenant.id,
          resourceId,
          input.mailbox.trim(),
          input.name.trim(),
          input.notificationEmail?.trim() || null,
          input.transcriptionEnabled,
          input.enabled,
        ],
      );
      this.ensureFound(result.rows[0]);
      await this.enqueue(
        client,
        session.tenant.id,
        'voicemail_box',
        resourceId,
        'update',
        result.rows[0].state as Record<string, unknown>,
      );
      return result.rows[0];
    });
  }

  removeVoicemailBox(session: SessionContext, resourceId: string) {
    return this.softDelete(
      session,
      'telephony.voicemail_boxes',
      'voicemail_box',
      resourceId,
    );
  }

  private inTenant<T>(
    session: SessionContext,
    callback: (client: PoolClient) => Promise<T>,
  ) {
    return this.database.tenantTransaction(
      session.tenant.id,
      session.user.id,
      session.membershipId,
      callback,
    );
  }

  private async mutate<T>(
    session: SessionContext,
    callback: (client: PoolClient) => Promise<T>,
  ) {
    try {
      return await this.inTenant(session, callback);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Já existe um recurso com estes dados.');
      }
      throw error;
    }
  }

  private async updateSimpleRoute(
    session: SessionContext,
    table: string,
    resourceType: ResourceType,
    resourceId: string,
    assignments: string,
    values: unknown[],
  ) {
    return this.mutate(session, async (client) => {
      const placeholders = values.map((_, index) => `$${index + 3}`);
      void placeholders;
      const result = await client.query(
        `UPDATE ${table} AS resource
         SET ${assignments}, sync_status = 'pending'
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING resource.id, to_jsonb(resource) AS state`,
        [session.tenant.id, resourceId, ...values],
      );
      this.ensureFound(result.rows[0]);
      await this.enqueue(
        client,
        session.tenant.id,
        resourceType,
        resourceId,
        'update',
        result.rows[0].state as Record<string, unknown>,
      );
      return result.rows[0];
    });
  }

  private softDelete(
    session: SessionContext,
    table: string,
    resourceType: ResourceType,
    resourceId: string,
  ) {
    return this.mutate(session, async (client) => {
      const result = await client.query(
        `UPDATE ${table}
         SET deleted_at = now(), sync_status = 'pending'
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING id`,
        [session.tenant.id, resourceId],
      );
      this.ensureFound(result.rows[0]);
      await this.enqueue(
        client,
        session.tenant.id,
        resourceType,
        resourceId,
        'delete',
        { id: resourceId },
      );
    });
  }

  private enqueue(
    client: PoolClient,
    tenantId: string,
    resourceType: ResourceType,
    resourceId: string,
    operation: 'create' | 'update' | 'delete',
    state: Record<string, unknown>,
  ) {
    return client.query(
      `INSERT INTO integration.provisioning_jobs (
         tenant_id,
         resource_type,
         resource_id,
         operation,
         idempotency_key,
         desired_state,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
      [
        tenantId,
        resourceType,
        resourceId,
        operation,
        `${resourceType}:${resourceId}:${operation}:${Date.now()}`,
        JSON.stringify(state),
      ],
    );
  }

  private ensureFound(value: unknown) {
    if (!value) {
      throw new NotFoundException('Recurso não encontrado.');
    }
  }

  private async ensureExtensions(
    client: PoolClient,
    tenantId: string,
    members: string[],
  ) {
    const result = await client.query<{ total: number }>(
      `SELECT count(DISTINCT extension_number)::int AS total
       FROM telephony.extensions
       WHERE tenant_id = $1
         AND deleted_at IS NULL
         AND extension_number = ANY($2::varchar[])`,
      [tenantId, members],
    );

    if (Number(result.rows[0]?.total ?? 0) !== members.length) {
      throw new BadRequestException(
        'Um ou mais ramais selecionados não pertencem à empresa ativa.',
      );
    }
  }
}
