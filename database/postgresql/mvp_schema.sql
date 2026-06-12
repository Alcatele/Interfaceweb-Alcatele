-- Alcatele UCaaS MVP
-- PostgreSQL 16+
-- Recorte: login, multiempresa, usuários, RBAC, dashboard, FusionPBX,
-- ramais, troncos, rotas e WebPhone.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS iam;
CREATE SCHEMA IF NOT EXISTS telephony;
CREATE SCHEMA IF NOT EXISTS integration;
CREATE SCHEMA IF NOT EXISTS audit;

CREATE OR REPLACE FUNCTION core.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION core.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION core.current_membership_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.membership_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION core.set_request_context(
  p_tenant_id uuid,
  p_user_id uuid,
  p_membership_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.tenant_id', COALESCE(p_tenant_id::text, ''), true);
  PERFORM set_config('app.user_id', COALESCE(p_user_id::text, ''), true);
  PERFORM set_config(
    'app.membership_id',
    COALESCE(p_membership_id::text, ''),
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION core.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TABLE core.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(180) NOT NULL,
  slug citext NOT NULL UNIQUE,
  domain citext NOT NULL UNIQUE,
  status varchar(20) NOT NULL DEFAULT 'active',
  timezone varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_slug_ck
    CHECK (slug::text ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  CONSTRAINT tenants_status_ck
    CHECK (status IN ('active', 'suspended', 'closed'))
);

CREATE TABLE iam.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username citext NOT NULL UNIQUE,
  email citext NOT NULL UNIQUE,
  display_name varchar(160) NOT NULL,
  password_hash text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_status_ck
    CHECK (status IN ('active', 'locked', 'disabled'))
);

CREATE TABLE iam.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(100) NOT NULL UNIQUE,
  name varchar(140) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE iam.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  code varchar(40) NOT NULL,
  name varchar(100) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_tenant_id_id_uk UNIQUE (tenant_id, id),
  CONSTRAINT roles_code_uk UNIQUE (tenant_id, code)
);

CREATE TABLE iam.role_permissions (
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL REFERENCES iam.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, role_id, permission_id),
  CONSTRAINT role_permissions_role_fk
    FOREIGN KEY (tenant_id, role_id)
    REFERENCES iam.roles (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE iam.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_tenant_id_id_uk UNIQUE (tenant_id, id),
  CONSTRAINT memberships_tenant_user_uk UNIQUE (tenant_id, user_id),
  CONSTRAINT memberships_role_fk
    FOREIGN KEY (tenant_id, role_id)
    REFERENCES iam.roles (tenant_id, id),
  CONSTRAINT memberships_status_ck
    CHECK (status IN ('active', 'suspended', 'disabled'))
);

CREATE UNIQUE INDEX memberships_one_default_uq
  ON iam.memberships (user_id)
  WHERE is_default AND status = 'active';

CREATE TABLE iam.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  active_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  active_membership_id uuid NOT NULL REFERENCES iam.memberships(id),
  token_hash char(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT sessions_expiry_ck CHECK (expires_at > created_at)
);

CREATE INDEX sessions_user_active_idx
  ON iam.sessions (user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE telephony.extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  membership_id uuid,
  extension_number varchar(32) NOT NULL,
  display_name varchar(120) NOT NULL,
  department varchar(120) NOT NULL DEFAULT 'Geral',
  device varchar(120) NOT NULL DEFAULT 'Webphone',
  auth_username varchar(120) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'offline',
  last_ip inet,
  last_seen_at timestamptz,
  sync_status varchar(20) NOT NULL DEFAULT 'pending',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT extensions_tenant_id_id_uk UNIQUE (tenant_id, id),
  CONSTRAINT extensions_number_uk UNIQUE (tenant_id, extension_number),
  CONSTRAINT extensions_auth_uk UNIQUE (tenant_id, auth_username),
  CONSTRAINT extensions_membership_fk
    FOREIGN KEY (tenant_id, membership_id)
    REFERENCES iam.memberships (tenant_id, id),
  CONSTRAINT extensions_status_ck
    CHECK (status IN ('online', 'offline', 'warning')),
  CONSTRAINT extensions_sync_ck
    CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

CREATE UNIQUE INDEX extensions_membership_uq
  ON telephony.extensions (tenant_id, membership_id)
  WHERE membership_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE telephony.sip_trunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  provider varchar(120) NOT NULL,
  host varchar(255) NOT NULL,
  max_channels integer NOT NULL DEFAULT 10,
  status varchar(20) NOT NULL DEFAULT 'warning',
  latency_ms integer NOT NULL DEFAULT 0,
  sync_status varchar(20) NOT NULL DEFAULT 'pending',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sip_trunks_tenant_id_id_uk UNIQUE (tenant_id, id),
  CONSTRAINT sip_trunks_name_uk UNIQUE (tenant_id, name),
  CONSTRAINT sip_trunks_channels_ck CHECK (max_channels > 0),
  CONSTRAINT sip_trunks_status_ck
    CHECK (status IN ('registered', 'failed', 'warning')),
  CONSTRAINT sip_trunks_sync_ck
    CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

CREATE TABLE telephony.inbound_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  did_pattern varchar(120) NOT NULL,
  description varchar(180) NOT NULL,
  destination varchar(180) NOT NULL,
  schedule varchar(120) NOT NULL DEFAULT 'Sempre',
  enabled boolean NOT NULL DEFAULT true,
  sync_status varchar(20) NOT NULL DEFAULT 'pending',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inbound_routes_tenant_id_id_uk UNIQUE (tenant_id, id),
  CONSTRAINT inbound_routes_did_uk UNIQUE (tenant_id, did_pattern),
  CONSTRAINT inbound_routes_sync_ck
    CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

CREATE TABLE telephony.outbound_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  pattern varchar(180) NOT NULL,
  trunk_id uuid NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  sync_status varchar(20) NOT NULL DEFAULT 'pending',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outbound_routes_tenant_id_id_uk UNIQUE (tenant_id, id),
  CONSTRAINT outbound_routes_name_uk UNIQUE (tenant_id, name),
  CONSTRAINT outbound_routes_trunk_fk
    FOREIGN KEY (tenant_id, trunk_id)
    REFERENCES telephony.sip_trunks (tenant_id, id),
  CONSTRAINT outbound_routes_priority_ck CHECK (priority >= 0),
  CONSTRAINT outbound_routes_sync_ck
    CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

CREATE TABLE integration.fusionpbx_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES core.tenants(id) ON DELETE CASCADE,
  mode varchar(12) NOT NULL DEFAULT 'mock',
  base_url text,
  api_key_ref text,
  status varchar(20) NOT NULL DEFAULT 'active',
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fusionpbx_accounts_tenant_id_id_uk UNIQUE (tenant_id, id),
  CONSTRAINT fusionpbx_accounts_mode_ck CHECK (mode IN ('mock', 'live')),
  CONSTRAINT fusionpbx_accounts_status_ck
    CHECK (status IN ('active', 'degraded', 'disabled', 'not_configured'))
);

CREATE TABLE integration.provisioning_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  resource_type varchar(40) NOT NULL,
  resource_id uuid NOT NULL,
  operation varchar(12) NOT NULL,
  idempotency_key varchar(255) NOT NULL,
  desired_state jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provisioning_jobs_tenant_id_id_uk UNIQUE (tenant_id, id),
  CONSTRAINT provisioning_jobs_idempotency_uk
    UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT provisioning_jobs_resource_ck CHECK (
    resource_type IN ('extension', 'trunk', 'inbound_route', 'outbound_route')
  ),
  CONSTRAINT provisioning_jobs_operation_ck
    CHECK (operation IN ('create', 'update', 'delete')),
  CONSTRAINT provisioning_jobs_status_ck CHECK (
    status IN ('pending', 'running', 'succeeded', 'failed')
  ),
  CONSTRAINT provisioning_jobs_state_ck
    CHECK (jsonb_typeof(desired_state) = 'object')
);

CREATE INDEX provisioning_jobs_claim_idx
  ON integration.provisioning_jobs (status, scheduled_at, created_at)
  WHERE status IN ('pending', 'failed', 'running');

CREATE TABLE audit.events (
  id bigserial PRIMARY KEY,
  tenant_id uuid,
  user_id uuid,
  schema_name name NOT NULL,
  table_name name NOT NULL,
  operation varchar(10) NOT NULL,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_tenant_time_idx
  ON audit.events (tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION audit.capture_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, audit, core
AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_row := to_jsonb(OLD) - ARRAY['password_hash', 'api_key_ref']::text[];
  END IF;

  IF TG_OP <> 'DELETE' THEN
    new_row := to_jsonb(NEW) - ARRAY['password_hash', 'api_key_ref']::text[];
  END IF;

  INSERT INTO audit.events (
    tenant_id,
    user_id,
    schema_name,
    table_name,
    operation,
    record_id,
    old_data,
    new_data
  )
  VALUES (
    COALESCE(
      NULLIF(new_row ->> 'tenant_id', '')::uuid,
      NULLIF(old_row ->> 'tenant_id', '')::uuid,
      core.current_tenant_id()
    ),
    core.current_user_id(),
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    lower(TG_OP),
    COALESCE(new_row ->> 'id', old_row ->> 'id'),
    old_row,
    new_row
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION iam.bootstrap_tenant_roles(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO iam.roles (
    tenant_id,
    code,
    name,
    description
  )
  VALUES
    (p_tenant_id, 'super_admin', 'Super Admin', 'Controle da plataforma e empresas'),
    (p_tenant_id, 'admin', 'Administrador', 'Administração da empresa e PABX'),
    (p_tenant_id, 'user', 'Usuário', 'Webphone e recursos pessoais')
  ON CONFLICT (tenant_id, code) DO NOTHING;

  INSERT INTO iam.role_permissions (
    tenant_id,
    role_id,
    permission_id
  )
  SELECT p_tenant_id, r.id, p.id
  FROM iam.roles r
  CROSS JOIN iam.permissions p
  WHERE r.tenant_id = p_tenant_id
    AND (
      r.code = 'super_admin'
      OR (
        r.code = 'admin'
        AND p.code IN (
          'dashboard.view',
          'users.manage',
          'permissions.view',
          'pbx.view',
          'pbx.configure',
          'webphone.use'
        )
      )
      OR (
        r.code = 'user'
        AND p.code IN (
          'dashboard.view',
          'pbx.view',
          'webphone.use'
        )
      )
    )
  ON CONFLICT DO NOTHING;
END;
$$;

INSERT INTO iam.permissions (code, name, description)
VALUES
  ('tenant.manage', 'Gerenciar empresas', 'Criar, suspender e encerrar empresas'),
  ('dashboard.view', 'Ver dashboard', 'Consultar indicadores do tenant'),
  ('users.manage', 'Gerenciar usuários', 'Criar, remover e redefinir senhas'),
  ('permissions.view', 'Ver permissões', 'Consultar matriz de acesso'),
  ('pbx.view', 'Ver PABX', 'Consultar ramais, troncos e rotas'),
  ('pbx.configure', 'Configurar PABX', 'Alterar e sincronizar o PABX'),
  ('webphone.use', 'Usar WebPhone', 'Registrar e realizar chamadas WebRTC')
ON CONFLICT (code) DO NOTHING;

-- Seed determinístico para ambiente local.
INSERT INTO core.tenants (id, name, slug, domain, status)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'Alcatele Tecnologia',
    'alcatele',
    'pbx.alcatele.local',
    'active'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Empresa Demonstração',
    'demo',
    'demo.alcatele.local',
    'active'
  )
ON CONFLICT (id) DO NOTHING;

SELECT iam.bootstrap_tenant_roles('11111111-1111-4111-8111-111111111111');
SELECT iam.bootstrap_tenant_roles('22222222-2222-4222-8222-222222222222');

INSERT INTO iam.users (
  id,
  username,
  email,
  display_name,
  password_hash,
  status
)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    'superadmin',
    'superadmin@alcatele.local',
    'Super Admin',
    crypt('Cloud@2026', gen_salt('bf', 12)),
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'admin',
    'admin@alcatele.local',
    'Administrador',
    crypt('Admin@2026', gen_salt('bf', 12)),
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'usuario',
    'usuario@alcatele.local',
    'Usuário WebPhone',
    crypt('Usuario@2026', gen_salt('bf', 12)),
    'active'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO iam.memberships (
  id,
  tenant_id,
  user_id,
  role_id,
  status,
  is_default
)
SELECT
  '20000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  '10000000-0000-4000-8000-000000000001',
  r.id,
  'active',
  true
FROM iam.roles r
WHERE r.tenant_id = '11111111-1111-4111-8111-111111111111'
  AND r.code = 'super_admin'
ON CONFLICT (tenant_id, user_id) DO NOTHING;

INSERT INTO iam.memberships (
  id,
  tenant_id,
  user_id,
  role_id,
  status,
  is_default
)
SELECT
  '20000000-0000-4000-8000-000000000002',
  '22222222-2222-4222-8222-222222222222',
  '10000000-0000-4000-8000-000000000001',
  r.id,
  'active',
  false
FROM iam.roles r
WHERE r.tenant_id = '22222222-2222-4222-8222-222222222222'
  AND r.code = 'super_admin'
ON CONFLICT (tenant_id, user_id) DO NOTHING;

INSERT INTO iam.memberships (
  id,
  tenant_id,
  user_id,
  role_id,
  status,
  is_default
)
SELECT
  '20000000-0000-4000-8000-000000000003',
  '11111111-1111-4111-8111-111111111111',
  '10000000-0000-4000-8000-000000000002',
  r.id,
  'active',
  false
FROM iam.roles r
WHERE r.tenant_id = '11111111-1111-4111-8111-111111111111'
  AND r.code = 'admin'
ON CONFLICT (tenant_id, user_id) DO NOTHING;

INSERT INTO iam.memberships (
  id,
  tenant_id,
  user_id,
  role_id,
  status,
  is_default
)
SELECT
  '20000000-0000-4000-8000-000000000004',
  '11111111-1111-4111-8111-111111111111',
  '10000000-0000-4000-8000-000000000003',
  r.id,
  'active',
  false
FROM iam.roles r
WHERE r.tenant_id = '11111111-1111-4111-8111-111111111111'
  AND r.code = 'user'
ON CONFLICT (tenant_id, user_id) DO NOTHING;

INSERT INTO telephony.extensions (
  id,
  tenant_id,
  membership_id,
  extension_number,
  display_name,
  department,
  device,
  auth_username,
  status,
  last_ip,
  last_seen_at,
  sync_status
)
VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    '20000000-0000-4000-8000-000000000001',
    '1000',
    'Super Admin',
    'Administração',
    'Webphone',
    '1000',
    'online',
    '127.0.0.1',
    now(),
    'synced'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    '20000000-0000-4000-8000-000000000003',
    '1001',
    'Administrador',
    'TI',
    'Webphone',
    '1001',
    'online',
    '127.0.0.1',
    now(),
    'synced'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '11111111-1111-4111-8111-111111111111',
    '20000000-0000-4000-8000-000000000004',
    '1002',
    'Usuário WebPhone',
    'Comercial',
    'Webphone',
    '1002',
    'offline',
    NULL,
    NULL,
    'synced'
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '22222222-2222-4222-8222-222222222222',
    '20000000-0000-4000-8000-000000000002',
    '2000',
    'Super Admin Demo',
    'Administração',
    'Webphone',
    '2000',
    'offline',
    NULL,
    NULL,
    'synced'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO telephony.sip_trunks (
  id,
  tenant_id,
  name,
  provider,
  host,
  max_channels,
  status,
  latency_ms,
  sync_status
)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'Tronco Demonstração',
  'Operadora SIP',
  'sip.provider.local',
  30,
  'registered',
  35,
  'synced'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO telephony.inbound_routes (
  tenant_id,
  did_pattern,
  description,
  destination,
  schedule,
  enabled,
  sync_status
)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  '+551130000000',
  'Número principal',
  '1001',
  'Sempre',
  true,
  'synced'
)
ON CONFLICT (tenant_id, did_pattern) DO NOTHING;

INSERT INTO telephony.outbound_routes (
  tenant_id,
  name,
  pattern,
  trunk_id,
  priority,
  enabled,
  sync_status
)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'Saída nacional',
  '^0?[1-9][0-9]{9,10}$',
  '40000000-0000-4000-8000-000000000001',
  100,
  true,
  'synced'
)
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO integration.fusionpbx_accounts (
  tenant_id,
  mode,
  status
)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'mock', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'mock', 'active')
ON CONFLICT (tenant_id) DO NOTHING;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'roles',
    'memberships',
    'extensions',
    'sip_trunks',
    'inbound_routes',
    'outbound_routes',
    'fusionpbx_accounts',
    'provisioning_jobs'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE %s ENABLE ROW LEVEL SECURITY',
      CASE
        WHEN table_name IN ('roles', 'memberships')
          THEN 'iam.' || table_name
        WHEN table_name IN ('extensions', 'sip_trunks', 'inbound_routes', 'outbound_routes')
          THEN 'telephony.' || table_name
        ELSE 'integration.' || table_name
      END
    );
    EXECUTE format(
      'ALTER TABLE %s FORCE ROW LEVEL SECURITY',
      CASE
        WHEN table_name IN ('roles', 'memberships')
          THEN 'iam.' || table_name
        WHEN table_name IN ('extensions', 'sip_trunks', 'inbound_routes', 'outbound_routes')
          THEN 'telephony.' || table_name
        ELSE 'integration.' || table_name
      END
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s
       USING (tenant_id = core.current_tenant_id())
       WITH CHECK (tenant_id = core.current_tenant_id())',
      CASE
        WHEN table_name IN ('roles', 'memberships')
          THEN 'iam.' || table_name
        WHEN table_name IN ('extensions', 'sip_trunks', 'inbound_routes', 'outbound_routes')
          THEN 'telephony.' || table_name
        ELSE 'integration.' || table_name
      END
    );
  END LOOP;
END;
$$;

ALTER TABLE iam.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.role_permissions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON iam.role_permissions
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());

CREATE POLICY membership_self_lookup ON iam.memberships
  FOR SELECT
  USING (user_id = core.current_user_id());

CREATE POLICY role_for_current_user ON iam.roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM iam.memberships membership
      WHERE membership.role_id = iam.roles.id
        AND membership.user_id = core.current_user_id()
        AND membership.status = 'active'
    )
  );

DO $$
DECLARE
  target regclass;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'core.tenants'::regclass,
    'iam.users'::regclass,
    'iam.roles'::regclass,
    'iam.memberships'::regclass,
    'telephony.extensions'::regclass,
    'telephony.sip_trunks'::regclass,
    'telephony.inbound_routes'::regclass,
    'telephony.outbound_routes'::regclass,
    'integration.fusionpbx_accounts'::regclass
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER audit_change
       AFTER INSERT OR UPDATE OR DELETE ON %s
       FOR EACH ROW EXECUTE FUNCTION audit.capture_change()',
      target
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  target regclass;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'core.tenants'::regclass,
    'iam.users'::regclass,
    'iam.roles'::regclass,
    'iam.memberships'::regclass,
    'telephony.extensions'::regclass,
    'telephony.sip_trunks'::regclass,
    'telephony.inbound_routes'::regclass,
    'telephony.outbound_routes'::regclass,
    'integration.fusionpbx_accounts'::regclass,
    'integration.provisioning_jobs'::regclass
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at
       BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()',
      target
    );
  END LOOP;
END;
$$;

COMMIT;
