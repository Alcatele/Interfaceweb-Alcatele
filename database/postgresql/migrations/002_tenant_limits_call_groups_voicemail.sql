BEGIN;

CREATE TABLE IF NOT EXISTS core.tenant_limits (
  tenant_id uuid PRIMARY KEY REFERENCES core.tenants(id) ON DELETE CASCADE,
  max_users integer NOT NULL DEFAULT 10,
  max_extensions integer NOT NULL DEFAULT 10,
  max_trunks integer NOT NULL DEFAULT 2,
  max_inbound_routes integer NOT NULL DEFAULT 5,
  max_outbound_routes integer NOT NULL DEFAULT 5,
  max_pickup_groups integer NOT NULL DEFAULT 3,
  max_ring_groups integer NOT NULL DEFAULT 3,
  max_voicemail_boxes integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_limits_nonnegative_ck CHECK (
    max_users >= 0
    AND max_extensions >= 0
    AND max_trunks >= 0
    AND max_inbound_routes >= 0
    AND max_outbound_routes >= 0
    AND max_pickup_groups >= 0
    AND max_ring_groups >= 0
    AND max_voicemail_boxes >= 0
  )
);

INSERT INTO core.tenant_limits (tenant_id)
SELECT id
FROM core.tenants
ON CONFLICT (tenant_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS telephony.pickup_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  feature_code varchar(32) NOT NULL,
  members varchar(32)[] NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sync_status varchar(20) NOT NULL DEFAULT 'pending',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pickup_groups_tenant_id_id_uk UNIQUE (tenant_id, id),
  CONSTRAINT pickup_groups_name_uk UNIQUE (tenant_id, name),
  CONSTRAINT pickup_groups_code_uk UNIQUE (tenant_id, feature_code),
  CONSTRAINT pickup_groups_members_ck CHECK (cardinality(members) > 0),
  CONSTRAINT pickup_groups_sync_ck
    CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

CREATE TABLE IF NOT EXISTS telephony.ring_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  group_number varchar(32) NOT NULL,
  strategy varchar(20) NOT NULL DEFAULT 'simultaneous',
  timeout_seconds integer NOT NULL DEFAULT 25,
  members varchar(32)[] NOT NULL,
  fallback varchar(180) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sync_status varchar(20) NOT NULL DEFAULT 'pending',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ring_groups_tenant_id_id_uk UNIQUE (tenant_id, id),
  CONSTRAINT ring_groups_name_uk UNIQUE (tenant_id, name),
  CONSTRAINT ring_groups_number_uk UNIQUE (tenant_id, group_number),
  CONSTRAINT ring_groups_strategy_ck
    CHECK (strategy IN ('simultaneous', 'sequential', 'random')),
  CONSTRAINT ring_groups_timeout_ck CHECK (timeout_seconds BETWEEN 5 AND 120),
  CONSTRAINT ring_groups_members_ck CHECK (cardinality(members) > 0),
  CONSTRAINT ring_groups_sync_ck
    CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

CREATE TABLE IF NOT EXISTS telephony.voicemail_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  mailbox varchar(32) NOT NULL,
  display_name varchar(120) NOT NULL,
  notification_email citext,
  transcription_enabled boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  sync_status varchar(20) NOT NULL DEFAULT 'pending',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voicemail_boxes_tenant_id_id_uk UNIQUE (tenant_id, id),
  CONSTRAINT voicemail_boxes_mailbox_uk UNIQUE (tenant_id, mailbox),
  CONSTRAINT voicemail_boxes_sync_ck
    CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

ALTER TABLE integration.provisioning_jobs
  DROP CONSTRAINT IF EXISTS provisioning_jobs_resource_ck;

ALTER TABLE integration.provisioning_jobs
  ADD CONSTRAINT provisioning_jobs_resource_ck CHECK (
    resource_type IN (
      'extension',
      'trunk',
      'inbound_route',
      'outbound_route',
      'pickup_group',
      'ring_group',
      'voicemail_box'
    )
  );

DO $$
DECLARE
  target regclass;
  policy_name text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'telephony.pickup_groups'::regclass,
    'telephony.ring_groups'::regclass,
    'telephony.voicemail_boxes'::regclass
  ]
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', target);

    policy_name := 'tenant_isolation';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = split_part(target::text, '.', 1)
        AND tablename = split_part(target::text, '.', 2)
        AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %s
         USING (tenant_id = core.current_tenant_id())
         WITH CHECK (tenant_id = core.current_tenant_id())',
        target
      );
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  target regclass;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'core.tenant_limits'::regclass,
    'telephony.pickup_groups'::regclass,
    'telephony.ring_groups'::regclass,
    'telephony.voicemail_boxes'::regclass
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgrelid = target
        AND tgname = 'audit_change'
        AND NOT tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER audit_change
         AFTER INSERT OR UPDATE OR DELETE ON %s
         FOR EACH ROW EXECUTE FUNCTION audit.capture_change()',
        target
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgrelid = target
        AND tgname = 'set_updated_at'
        AND NOT tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER set_updated_at
         BEFORE UPDATE ON %s
         FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()',
        target
      );
    END IF;
  END LOOP;
END;
$$;

INSERT INTO telephony.pickup_groups (
  id,
  tenant_id,
  name,
  feature_code,
  members,
  enabled,
  sync_status
)
VALUES (
  '51000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'Administrativo',
  '*81',
  ARRAY['1000', '1001'],
  true,
  'synced'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO telephony.ring_groups (
  id,
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
VALUES (
  '52000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'Atendimento geral',
  '7000',
  'simultaneous',
  25,
  ARRAY['1000', '1001'],
  'Correio de voz 1000',
  true,
  'synced'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO telephony.voicemail_boxes (
  id,
  tenant_id,
  mailbox,
  display_name,
  notification_email,
  transcription_enabled,
  enabled,
  sync_status
)
VALUES (
  '53000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  '1000',
  'Caixa postal administrativa',
  'superadmin@alcatele.local',
  false,
  true,
  'synced'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
