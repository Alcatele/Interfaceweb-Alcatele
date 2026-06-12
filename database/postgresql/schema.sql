-- Plataforma UCaaS + CCaaS White Label
-- PostgreSQL 16+
-- Schema físico de referência.
--
-- Convenções:
--   * UUIDs são gerados com gen_random_uuid().
--   * Tabelas de negócio possuem tenant_id.
--   * FKs internas ao tenant usam (tenant_id, id).
--   * Valores monetários usam numeric e currency ISO 4217.
--   * Datas são timestamptz e armazenadas em UTC.
--   * JSONB é reservado para configuração extensível, não para relações centrais.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS iam;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS telephony;
CREATE SCHEMA IF NOT EXISTS callcenter;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS omnichannel;
CREATE SCHEMA IF NOT EXISTS chat;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS reporting;
CREATE SCHEMA IF NOT EXISTS integration;
CREATE SCHEMA IF NOT EXISTS eventing;
CREATE SCHEMA IF NOT EXISTS audit;

-- ---------------------------------------------------------------------------
-- Shared functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION core.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION core.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION core.current_membership_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    SELECT NULLIF(current_setting('app.membership_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION core.current_correlation_id()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    SELECT NULLIF(current_setting('app.correlation_id', true), '')
$$;

CREATE OR REPLACE FUNCTION core.set_request_context(
    p_tenant_id uuid,
    p_user_id uuid,
    p_membership_id uuid,
    p_correlation_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, core
AS $$
BEGIN
    PERFORM set_config('app.tenant_id', COALESCE(p_tenant_id::text, ''), true);
    PERFORM set_config('app.user_id', COALESCE(p_user_id::text, ''), true);
    PERFORM set_config(
        'app.membership_id',
        COALESCE(p_membership_id::text, ''),
        true
    );
    PERFORM set_config(
        'app.correlation_id',
        COALESCE(p_correlation_id, ''),
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

CREATE OR REPLACE FUNCTION core.normalize_e164(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT CASE
        WHEN p_value IS NULL THEN NULL
        ELSE regexp_replace(p_value, '[^0-9+]', '', 'g')
    END
$$;

-- ---------------------------------------------------------------------------
-- Core: regiões, células, empresas e white label
-- ---------------------------------------------------------------------------

CREATE TABLE core.regions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(32) NOT NULL UNIQUE,
    name varchar(120) NOT NULL,
    cloud_provider varchar(40),
    country_code char(2) NOT NULL,
    timezone varchar(64) NOT NULL DEFAULT 'UTC',
    data_residency_code varchar(40),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT regions_code_format_ck
        CHECK (code ~ '^[a-z0-9][a-z0-9-]{1,31}$'),
    CONSTRAINT regions_country_code_ck
        CHECK (country_code ~ '^[A-Z]{2}$')
);

CREATE TABLE core.cells (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id uuid NOT NULL REFERENCES core.regions(id),
    code varchar(40) NOT NULL UNIQUE,
    name varchar(120) NOT NULL,
    status varchar(24) NOT NULL DEFAULT 'provisioning',
    capacity_channels integer NOT NULL DEFAULT 0,
    capacity_tenants integer NOT NULL DEFAULT 0,
    sip_domain citext,
    api_base_url text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cells_status_ck CHECK (
        status IN ('provisioning', 'active', 'draining', 'maintenance', 'offline')
    ),
    CONSTRAINT cells_capacity_ck CHECK (
        capacity_channels >= 0 AND capacity_tenants >= 0
    ),
    CONSTRAINT cells_metadata_object_ck
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE core.tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    legal_name varchar(180) NOT NULL,
    trade_name varchar(180) NOT NULL,
    slug citext NOT NULL UNIQUE,
    document_type varchar(16),
    document_number varchar(32),
    status varchar(24) NOT NULL DEFAULT 'provisioning',
    region_id uuid NOT NULL REFERENCES core.regions(id),
    cell_id uuid REFERENCES core.cells(id),
    locale varchar(16) NOT NULL DEFAULT 'pt-BR',
    timezone varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    currency char(3) NOT NULL DEFAULT 'BRL',
    data_classification varchar(24) NOT NULL DEFAULT 'standard',
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    activated_at timestamptz,
    suspended_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tenants_slug_format_ck
        CHECK (slug::text ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
    CONSTRAINT tenants_status_ck CHECK (
        status IN ('provisioning', 'active', 'suspended', 'closing', 'closed')
    ),
    CONSTRAINT tenants_currency_ck CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT tenants_data_classification_ck CHECK (
        data_classification IN ('standard', 'sensitive', 'regulated')
    ),
    CONSTRAINT tenants_settings_object_ck
        CHECK (jsonb_typeof(settings) = 'object')
);

CREATE UNIQUE INDEX tenants_document_uq
    ON core.tenants (document_type, document_number)
    WHERE document_type IS NOT NULL AND document_number IS NOT NULL;

CREATE TABLE core.tenant_domains (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    hostname citext NOT NULL UNIQUE,
    domain_type varchar(20) NOT NULL DEFAULT 'platform',
    verification_status varchar(20) NOT NULL DEFAULT 'pending',
    verification_token_hash text,
    is_primary boolean NOT NULL DEFAULT false,
    verified_at timestamptz,
    certificate_expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tenant_domains_type_ck
        CHECK (domain_type IN ('platform', 'custom')),
    CONSTRAINT tenant_domains_verification_ck CHECK (
        verification_status IN ('pending', 'verified', 'failed', 'disabled')
    ),
    CONSTRAINT tenant_domains_hostname_ck CHECK (
        hostname::text ~
        '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
    )
);

CREATE UNIQUE INDEX tenant_domains_one_primary_uq
    ON core.tenant_domains (tenant_id)
    WHERE is_primary;

CREATE TABLE core.tenant_branding (
    tenant_id uuid PRIMARY KEY
        REFERENCES core.tenants(id) ON DELETE CASCADE,
    product_name varchar(100) NOT NULL,
    logo_light_object_key text,
    logo_dark_object_key text,
    favicon_object_key text,
    primary_color varchar(9) NOT NULL DEFAULT '#2563EB',
    secondary_color varchar(9) NOT NULL DEFAULT '#0F172A',
    support_email citext,
    support_url text,
    email_from_name varchar(120),
    email_from_address citext,
    custom_css text,
    login_message text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tenant_branding_primary_color_ck
        CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$'),
    CONSTRAINT tenant_branding_secondary_color_ck
        CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$'),
    CONSTRAINT tenant_branding_metadata_object_ck
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE core.tenant_settings (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    setting_key varchar(100) NOT NULL,
    setting_value jsonb NOT NULL,
    is_secret boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, setting_key),
    CONSTRAINT tenant_settings_key_ck
        CHECK (setting_key ~ '^[a-z][a-z0-9_.-]{1,99}$')
);

-- ---------------------------------------------------------------------------
-- IAM: usuários, identidades, memberships, perfis e permissões
-- ---------------------------------------------------------------------------

CREATE TABLE iam.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    email citext NOT NULL UNIQUE,
    display_name varchar(160) NOT NULL,
    given_name varchar(100),
    family_name varchar(100),
    phone_e164 varchar(20),
    avatar_object_key text,
    locale varchar(16) NOT NULL DEFAULT 'pt-BR',
    timezone varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    status varchar(20) NOT NULL DEFAULT 'pending',
    email_verified_at timestamptz,
    phone_verified_at timestamptz,
    last_login_at timestamptz,
    locked_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT users_status_ck CHECK (
        status IN ('pending', 'active', 'locked', 'disabled', 'deleted')
    ),
    CONSTRAINT users_phone_e164_ck CHECK (
        phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
    )
);

CREATE TABLE iam.identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
    provider varchar(40) NOT NULL,
    provider_subject varchar(255) NOT NULL,
    provider_tenant varchar(255),
    claims jsonb NOT NULL DEFAULT '{}'::jsonb,
    last_authenticated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT identities_provider_subject_uk
        UNIQUE (provider, provider_tenant, provider_subject),
    CONSTRAINT identities_claims_object_ck
        CHECK (jsonb_typeof(claims) = 'object')
);

CREATE TABLE iam.user_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
    tenant_id uuid REFERENCES core.tenants(id) ON DELETE SET NULL,
    session_token_hash text NOT NULL UNIQUE,
    refresh_family_id uuid NOT NULL,
    device_id varchar(255),
    device_name varchar(255),
    ip_address inet,
    user_agent text,
    auth_level varchar(20) NOT NULL DEFAULT 'password',
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    revocation_reason varchar(120),
    CONSTRAINT user_sessions_auth_level_ck CHECK (
        auth_level IN ('password', 'mfa', 'passkey', 'federated')
    ),
    CONSTRAINT user_sessions_expiry_ck CHECK (expires_at > created_at)
);

CREATE TABLE iam.memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
    status varchar(20) NOT NULL DEFAULT 'invited',
    job_title varchar(120),
    department varchar(120),
    employee_code varchar(80),
    is_owner boolean NOT NULL DEFAULT false,
    joined_at timestamptz,
    last_access_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT memberships_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT memberships_tenant_user_uk UNIQUE (tenant_id, user_id),
    CONSTRAINT memberships_status_ck CHECK (
        status IN ('invited', 'active', 'suspended', 'disabled')
    )
);

CREATE UNIQUE INDEX memberships_one_owner_uq
    ON iam.memberships (tenant_id)
    WHERE is_owner AND deleted_at IS NULL;

CREATE TABLE iam.invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    email citext NOT NULL,
    invited_by_membership_id uuid,
    token_hash text NOT NULL UNIQUE,
    status varchar(20) NOT NULL DEFAULT 'pending',
    expires_at timestamptz NOT NULL,
    accepted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT invitations_tenant_inviter_fk FOREIGN KEY (
        tenant_id,
        invited_by_membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT invitations_status_ck CHECK (
        status IN ('pending', 'accepted', 'expired', 'revoked')
    ),
    CONSTRAINT invitations_expiry_ck CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX invitations_pending_email_uq
    ON iam.invitations (tenant_id, email)
    WHERE status = 'pending';

CREATE TABLE iam.permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(120) NOT NULL UNIQUE,
    module varchar(60) NOT NULL,
    resource varchar(80) NOT NULL,
    action varchar(40) NOT NULL,
    description text,
    is_system boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT permissions_code_ck CHECK (
        code ~ '^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$'
    )
);

CREATE TABLE iam.roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES core.tenants(id) ON DELETE CASCADE,
    code varchar(80) NOT NULL,
    name varchar(120) NOT NULL,
    description text,
    scope varchar(20) NOT NULL DEFAULT 'tenant',
    is_system boolean NOT NULL DEFAULT false,
    is_editable boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT roles_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT roles_scope_ck CHECK (
        scope IN ('platform', 'tenant', 'team', 'resource')
    ),
    CONSTRAINT roles_tenant_scope_ck CHECK (
        (scope = 'platform' AND tenant_id IS NULL)
        OR (scope <> 'platform' AND tenant_id IS NOT NULL)
    ),
    CONSTRAINT roles_code_ck CHECK (code ~ '^[a-z][a-z0-9_-]{1,79}$')
);

CREATE UNIQUE INDEX roles_platform_code_uq
    ON iam.roles (code)
    WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX roles_tenant_code_uq
    ON iam.roles (tenant_id, code)
    WHERE tenant_id IS NOT NULL;

CREATE TABLE iam.role_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES core.tenants(id) ON DELETE CASCADE,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
        REFERENCES iam.permissions(id) ON DELETE CASCADE,
    effect varchar(8) NOT NULL DEFAULT 'allow',
    conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT role_permissions_assignment_uk UNIQUE NULLS NOT DISTINCT (
        tenant_id,
        role_id,
        permission_id
    ),
    CONSTRAINT role_permissions_role_id_fk FOREIGN KEY (role_id)
        REFERENCES iam.roles (id) ON DELETE CASCADE,
    CONSTRAINT role_permissions_role_fk FOREIGN KEY (tenant_id, role_id)
        REFERENCES iam.roles (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT role_permissions_effect_ck CHECK (effect IN ('allow', 'deny')),
    CONSTRAINT role_permissions_conditions_object_ck
        CHECK (jsonb_typeof(conditions) = 'object')
);

CREATE TABLE iam.membership_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    membership_id uuid NOT NULL,
    role_id uuid NOT NULL,
    resource_type varchar(60),
    resource_id uuid,
    granted_by_membership_id uuid,
    granted_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    CONSTRAINT membership_roles_assignment_uk UNIQUE NULLS NOT DISTINCT (
        tenant_id,
        membership_id,
        role_id,
        resource_type,
        resource_id
    ),
    CONSTRAINT membership_roles_membership_fk FOREIGN KEY (
        tenant_id,
        membership_id
    ) REFERENCES iam.memberships (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT membership_roles_role_fk FOREIGN KEY (
        tenant_id,
        role_id
    ) REFERENCES iam.roles (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT membership_roles_granted_by_fk FOREIGN KEY (
        tenant_id,
        granted_by_membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT membership_roles_resource_ck CHECK (
        (resource_type IS NULL AND resource_id IS NULL)
        OR (resource_type IS NOT NULL AND resource_id IS NOT NULL)
    ),
    CONSTRAINT membership_roles_expiry_ck CHECK (
        expires_at IS NULL OR expires_at > granted_at
    )
);

CREATE TABLE iam.service_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES core.tenants(id) ON DELETE CASCADE,
    name varchar(120) NOT NULL,
    client_id varchar(120) NOT NULL UNIQUE,
    secret_hash text NOT NULL,
    scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
    status varchar(20) NOT NULL DEFAULT 'active',
    expires_at timestamptz,
    last_used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT service_accounts_status_ck CHECK (
        status IN ('active', 'disabled', 'expired')
    )
);

-- ---------------------------------------------------------------------------
-- Billing: planos, recursos, assinaturas, licenças e consumo
-- ---------------------------------------------------------------------------

CREATE TABLE billing.plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(60) NOT NULL UNIQUE,
    name varchar(120) NOT NULL,
    description text,
    version integer NOT NULL DEFAULT 1,
    billing_period varchar(20) NOT NULL DEFAULT 'monthly',
    currency char(3) NOT NULL DEFAULT 'BRL',
    base_price numeric(14, 2) NOT NULL DEFAULT 0,
    status varchar(20) NOT NULL DEFAULT 'draft',
    is_public boolean NOT NULL DEFAULT false,
    effective_from timestamptz,
    effective_to timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT plans_version_ck CHECK (version > 0),
    CONSTRAINT plans_period_ck CHECK (
        billing_period IN ('monthly', 'quarterly', 'yearly', 'custom')
    ),
    CONSTRAINT plans_currency_ck CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT plans_price_ck CHECK (base_price >= 0),
    CONSTRAINT plans_status_ck CHECK (
        status IN ('draft', 'active', 'retired')
    ),
    CONSTRAINT plans_effective_dates_ck CHECK (
        effective_to IS NULL OR effective_from IS NULL
        OR effective_to > effective_from
    )
);

CREATE TABLE billing.features (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(80) NOT NULL UNIQUE,
    name varchar(120) NOT NULL,
    module varchar(60) NOT NULL,
    value_type varchar(20) NOT NULL,
    unit varchar(40),
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT features_value_type_ck CHECK (
        value_type IN ('boolean', 'integer', 'decimal', 'text')
    )
);

CREATE TABLE billing.plan_features (
    plan_id uuid NOT NULL REFERENCES billing.plans(id) ON DELETE CASCADE,
    feature_id uuid NOT NULL
        REFERENCES billing.features(id) ON DELETE CASCADE,
    enabled boolean NOT NULL DEFAULT true,
    limit_value numeric(18, 4),
    text_value text,
    overage_price numeric(14, 6),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (plan_id, feature_id),
    CONSTRAINT plan_features_limit_ck CHECK (
        limit_value IS NULL OR limit_value >= 0
    ),
    CONSTRAINT plan_features_overage_ck CHECK (
        overage_price IS NULL OR overage_price >= 0
    ),
    CONSTRAINT plan_features_metadata_object_ck
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE billing.subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE RESTRICT,
    plan_id uuid NOT NULL REFERENCES billing.plans(id) ON DELETE RESTRICT,
    status varchar(20) NOT NULL DEFAULT 'trialing',
    external_customer_id varchar(255),
    external_subscription_id varchar(255),
    trial_ends_at timestamptz,
    current_period_start timestamptz NOT NULL,
    current_period_end timestamptz NOT NULL,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    canceled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT subscriptions_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT subscriptions_status_ck CHECK (
        status IN (
            'trialing',
            'active',
            'past_due',
            'suspended',
            'canceled',
            'expired'
        )
    ),
    CONSTRAINT subscriptions_period_ck CHECK (
        current_period_end > current_period_start
    )
);

CREATE UNIQUE INDEX subscriptions_one_current_uq
    ON billing.subscriptions (tenant_id)
    WHERE status IN ('trialing', 'active', 'past_due', 'suspended');

CREATE TABLE billing.subscription_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    subscription_id uuid NOT NULL,
    feature_id uuid NOT NULL REFERENCES billing.features(id),
    enabled boolean,
    limit_value numeric(18, 4),
    text_value text,
    valid_from timestamptz NOT NULL DEFAULT now(),
    valid_until timestamptz,
    reason text,
    created_by_user_id uuid REFERENCES iam.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT subscription_overrides_subscription_fk FOREIGN KEY (
        tenant_id,
        subscription_id
    ) REFERENCES billing.subscriptions (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT subscription_overrides_dates_ck CHECK (
        valid_until IS NULL OR valid_until > valid_from
    ),
    CONSTRAINT subscription_overrides_limit_ck CHECK (
        limit_value IS NULL OR limit_value >= 0
    )
);

CREATE TABLE billing.licenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    subscription_id uuid NOT NULL,
    feature_id uuid NOT NULL REFERENCES billing.features(id),
    license_type varchar(24) NOT NULL DEFAULT 'named',
    quantity_purchased integer NOT NULL,
    quantity_reserved integer NOT NULL DEFAULT 0,
    status varchar(20) NOT NULL DEFAULT 'active',
    valid_from timestamptz NOT NULL DEFAULT now(),
    valid_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT licenses_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT licenses_subscription_fk FOREIGN KEY (
        tenant_id,
        subscription_id
    ) REFERENCES billing.subscriptions (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT licenses_type_ck CHECK (
        license_type IN ('named', 'concurrent', 'capacity', 'usage')
    ),
    CONSTRAINT licenses_quantity_ck CHECK (
        quantity_purchased >= 0
        AND quantity_reserved >= 0
        AND quantity_reserved <= quantity_purchased
    ),
    CONSTRAINT licenses_status_ck CHECK (
        status IN ('active', 'suspended', 'expired', 'canceled')
    ),
    CONSTRAINT licenses_dates_ck CHECK (
        valid_until IS NULL OR valid_until > valid_from
    )
);

CREATE TABLE billing.license_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    license_id uuid NOT NULL,
    membership_id uuid,
    resource_type varchar(60),
    resource_id uuid,
    quantity integer NOT NULL DEFAULT 1,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    released_at timestamptz,
    CONSTRAINT license_assignments_license_fk FOREIGN KEY (
        tenant_id,
        license_id
    ) REFERENCES billing.licenses (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT license_assignments_membership_fk FOREIGN KEY (
        tenant_id,
        membership_id
    ) REFERENCES iam.memberships (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT license_assignments_target_ck CHECK (
        membership_id IS NOT NULL
        OR (resource_type IS NOT NULL AND resource_id IS NOT NULL)
    ),
    CONSTRAINT license_assignments_quantity_ck CHECK (quantity > 0),
    CONSTRAINT license_assignments_release_ck CHECK (
        released_at IS NULL OR released_at >= assigned_at
    )
);

CREATE UNIQUE INDEX license_assignments_active_member_uq
    ON billing.license_assignments (tenant_id, license_id, membership_id)
    WHERE membership_id IS NOT NULL AND released_at IS NULL;

CREATE UNIQUE INDEX license_assignments_active_resource_uq
    ON billing.license_assignments (
        tenant_id,
        license_id,
        resource_type,
        resource_id
    )
    WHERE resource_id IS NOT NULL AND released_at IS NULL;

CREATE TABLE billing.usage_counters (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    feature_id uuid NOT NULL REFERENCES billing.features(id),
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    quantity numeric(20, 6) NOT NULL DEFAULT 0,
    last_event_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, feature_id, period_start),
    CONSTRAINT usage_counters_period_ck CHECK (period_end > period_start),
    CONSTRAINT usage_counters_quantity_ck CHECK (quantity >= 0)
);

COMMIT;

BEGIN;

-- ---------------------------------------------------------------------------
-- Call Center: agentes, skills, filas, estados e campanhas
-- ---------------------------------------------------------------------------

CREATE TABLE callcenter.skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    code varchar(60) NOT NULL,
    name varchar(120) NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT skills_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT skills_code_uk UNIQUE (tenant_id, code),
    CONSTRAINT skills_code_ck CHECK (code ~ '^[a-z][a-z0-9_-]{1,59}$')
);

CREATE TABLE callcenter.agents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    membership_id uuid NOT NULL,
    extension_id uuid,
    agent_code varchar(60) NOT NULL,
    display_name varchar(120) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'offline',
    max_voice_interactions smallint NOT NULL DEFAULT 1,
    max_digital_interactions smallint NOT NULL DEFAULT 3,
    supervisor_membership_id uuid,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT agents_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT agents_membership_uk UNIQUE (tenant_id, membership_id),
    CONSTRAINT agents_code_uk UNIQUE (tenant_id, agent_code),
    CONSTRAINT agents_membership_fk FOREIGN KEY (
        tenant_id,
        membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT agents_supervisor_fk FOREIGN KEY (
        tenant_id,
        supervisor_membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT agents_status_ck CHECK (
        status IN (
            'offline',
            'available',
            'busy',
            'wrap_up',
            'break',
            'training'
        )
    ),
    CONSTRAINT agents_capacity_ck CHECK (
        max_voice_interactions BETWEEN 1 AND 10
        AND max_digital_interactions BETWEEN 1 AND 50
    ),
    CONSTRAINT agents_settings_object_ck
        CHECK (jsonb_typeof(settings) = 'object')
);

CREATE TABLE callcenter.agent_skills (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL,
    skill_id uuid NOT NULL,
    proficiency smallint NOT NULL DEFAULT 50,
    priority smallint NOT NULL DEFAULT 100,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, agent_id, skill_id),
    CONSTRAINT agent_skills_agent_fk FOREIGN KEY (tenant_id, agent_id)
        REFERENCES callcenter.agents (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT agent_skills_skill_fk FOREIGN KEY (tenant_id, skill_id)
        REFERENCES callcenter.skills (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT agent_skills_proficiency_ck
        CHECK (proficiency BETWEEN 0 AND 100),
    CONSTRAINT agent_skills_priority_ck CHECK (priority BETWEEN 0 AND 1000)
);

CREATE TABLE callcenter.queues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    name varchar(120) NOT NULL,
    extension_number varchar(32),
    description text,
    channel_type varchar(20) NOT NULL DEFAULT 'voice',
    routing_strategy varchar(30) NOT NULL DEFAULT 'longest_idle',
    max_wait_seconds integer NOT NULL DEFAULT 900,
    service_level_seconds integer NOT NULL DEFAULT 20,
    wrap_up_seconds integer NOT NULL DEFAULT 30,
    max_interactions integer,
    music_on_hold varchar(120),
    fallback_destination_id uuid,
    abandoned_callback_enabled boolean NOT NULL DEFAULT false,
    status varchar(20) NOT NULL DEFAULT 'provisioning',
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT queues_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT queues_name_uk UNIQUE (tenant_id, name),
    CONSTRAINT queues_extension_uk UNIQUE (tenant_id, extension_number),
    CONSTRAINT queues_channel_ck CHECK (
        channel_type IN ('voice', 'digital', 'blended')
    ),
    CONSTRAINT queues_strategy_ck CHECK (
        routing_strategy IN (
            'longest_idle',
            'round_robin',
            'least_talk_time',
            'fewest_interactions',
            'random',
            'ring_all',
            'skills_based'
        )
    ),
    CONSTRAINT queues_time_ck CHECK (
        max_wait_seconds BETWEEN 1 AND 86400
        AND service_level_seconds BETWEEN 1 AND 3600
        AND wrap_up_seconds BETWEEN 0 AND 3600
    ),
    CONSTRAINT queues_max_interactions_ck CHECK (
        max_interactions IS NULL OR max_interactions > 0
    ),
    CONSTRAINT queues_status_ck CHECK (
        status IN ('provisioning', 'active', 'paused', 'failed', 'disabled')
    ),
    CONSTRAINT queues_settings_object_ck
        CHECK (jsonb_typeof(settings) = 'object')
);

CREATE TABLE callcenter.queue_agents (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    queue_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    priority smallint NOT NULL DEFAULT 100,
    penalty smallint NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, queue_id, agent_id),
    CONSTRAINT queue_agents_queue_fk FOREIGN KEY (tenant_id, queue_id)
        REFERENCES callcenter.queues (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT queue_agents_agent_fk FOREIGN KEY (tenant_id, agent_id)
        REFERENCES callcenter.agents (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT queue_agents_priority_ck CHECK (priority BETWEEN 0 AND 1000),
    CONSTRAINT queue_agents_penalty_ck CHECK (penalty BETWEEN 0 AND 100)
);

CREATE TABLE callcenter.queue_skills (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    queue_id uuid NOT NULL,
    skill_id uuid NOT NULL,
    minimum_proficiency smallint NOT NULL DEFAULT 0,
    is_required boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, queue_id, skill_id),
    CONSTRAINT queue_skills_queue_fk FOREIGN KEY (tenant_id, queue_id)
        REFERENCES callcenter.queues (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT queue_skills_skill_fk FOREIGN KEY (tenant_id, skill_id)
        REFERENCES callcenter.skills (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT queue_skills_proficiency_ck
        CHECK (minimum_proficiency BETWEEN 0 AND 100)
);

CREATE TABLE callcenter.business_hours (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    name varchar(120) NOT NULL,
    timezone varchar(64) NOT NULL,
    weekly_schedule jsonb NOT NULL,
    holidays jsonb NOT NULL DEFAULT '[]'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT business_hours_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT business_hours_name_uk UNIQUE (tenant_id, name),
    CONSTRAINT business_hours_weekly_object_ck
        CHECK (jsonb_typeof(weekly_schedule) = 'object'),
    CONSTRAINT business_hours_holidays_array_ck
        CHECK (jsonb_typeof(holidays) = 'array')
);

CREATE TABLE callcenter.queue_schedules (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    queue_id uuid NOT NULL,
    business_hours_id uuid NOT NULL,
    closed_destination_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, queue_id),
    CONSTRAINT queue_schedules_queue_fk FOREIGN KEY (tenant_id, queue_id)
        REFERENCES callcenter.queues (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT queue_schedules_hours_fk FOREIGN KEY (
        tenant_id,
        business_hours_id
    ) REFERENCES callcenter.business_hours (tenant_id, id)
);

CREATE TABLE callcenter.agent_state_history (
    changed_at timestamptz NOT NULL DEFAULT now(),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL,
    previous_status varchar(20),
    new_status varchar(20) NOT NULL,
    reason_code varchar(80),
    source varchar(30) NOT NULL DEFAULT 'agent',
    correlation_id varchar(120),
    PRIMARY KEY (changed_at, id),
    CONSTRAINT agent_state_history_agent_fk FOREIGN KEY (
        tenant_id,
        agent_id
    ) REFERENCES callcenter.agents (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT agent_state_history_previous_ck CHECK (
        previous_status IS NULL OR previous_status IN (
            'offline',
            'available',
            'busy',
            'wrap_up',
            'break',
            'training'
        )
    ),
    CONSTRAINT agent_state_history_new_ck CHECK (
        new_status IN (
            'offline',
            'available',
            'busy',
            'wrap_up',
            'break',
            'training'
        )
    ),
    CONSTRAINT agent_state_history_source_ck CHECK (
        source IN ('agent', 'supervisor', 'system', 'telephony')
    )
) PARTITION BY RANGE (changed_at);

CREATE TABLE callcenter.campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    name varchar(160) NOT NULL,
    campaign_type varchar(24) NOT NULL,
    queue_id uuid,
    outbound_route_id uuid,
    status varchar(20) NOT NULL DEFAULT 'draft',
    starts_at timestamptz,
    ends_at timestamptz,
    dialing_ratio numeric(6, 2) NOT NULL DEFAULT 1,
    max_attempts smallint NOT NULL DEFAULT 3,
    retry_delay_seconds integer NOT NULL DEFAULT 3600,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT campaigns_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT campaigns_name_uk UNIQUE (tenant_id, name),
    CONSTRAINT campaigns_queue_fk FOREIGN KEY (tenant_id, queue_id)
        REFERENCES callcenter.queues (tenant_id, id),
    CONSTRAINT campaigns_type_ck CHECK (
        campaign_type IN ('preview', 'progressive', 'power', 'predictive')
    ),
    CONSTRAINT campaigns_status_ck CHECK (
        status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'canceled')
    ),
    CONSTRAINT campaigns_dates_ck CHECK (
        ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at
    ),
    CONSTRAINT campaigns_ratio_ck CHECK (dialing_ratio > 0),
    CONSTRAINT campaigns_attempts_ck CHECK (max_attempts BETWEEN 1 AND 20),
    CONSTRAINT campaigns_retry_ck CHECK (retry_delay_seconds >= 0),
    CONSTRAINT campaigns_settings_object_ck
        CHECK (jsonb_typeof(settings) = 'object')
);

CREATE TABLE callcenter.campaign_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    campaign_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    contact_channel_id uuid,
    status varchar(24) NOT NULL DEFAULT 'pending',
    attempt_count smallint NOT NULL DEFAULT 0,
    next_attempt_at timestamptz,
    last_attempt_at timestamptz,
    disposition_code varchar(80),
    assigned_agent_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT campaign_contacts_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT campaign_contacts_target_uk
        UNIQUE (tenant_id, campaign_id, contact_id),
    CONSTRAINT campaign_contacts_campaign_fk FOREIGN KEY (
        tenant_id,
        campaign_id
    ) REFERENCES callcenter.campaigns (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT campaign_contacts_agent_fk FOREIGN KEY (
        tenant_id,
        assigned_agent_id
    ) REFERENCES callcenter.agents (tenant_id, id),
    CONSTRAINT campaign_contacts_status_ck CHECK (
        status IN (
            'pending',
            'reserved',
            'dialing',
            'connected',
            'retry',
            'completed',
            'do_not_call',
            'failed'
        )
    ),
    CONSTRAINT campaign_contacts_attempts_ck CHECK (attempt_count >= 0)
);

-- ---------------------------------------------------------------------------
-- Telephony operational data: calls, legs, events, recordings and voicemail
-- ---------------------------------------------------------------------------

CREATE TABLE telephony.calls (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    external_uuid uuid,
    direction varchar(16) NOT NULL,
    status varchar(24) NOT NULL DEFAULT 'initiated',
    from_number varchar(64),
    from_name varchar(160),
    to_number varchar(64),
    to_name varchar(160),
    contact_id uuid,
    queue_id uuid,
    campaign_id uuid,
    parent_call_id uuid,
    started_at timestamptz NOT NULL,
    ringing_at timestamptz,
    answered_at timestamptz,
    ended_at timestamptz,
    duration_seconds integer NOT NULL DEFAULT 0,
    billable_seconds integer NOT NULL DEFAULT 0,
    hangup_cause varchar(80),
    sip_response_code integer,
    recording_status varchar(20) NOT NULL DEFAULT 'not_requested',
    disposition_code varchar(80),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT calls_external_uuid_uk UNIQUE (tenant_id, external_uuid),
    CONSTRAINT calls_queue_fk FOREIGN KEY (tenant_id, queue_id)
        REFERENCES callcenter.queues (tenant_id, id),
    CONSTRAINT calls_campaign_fk FOREIGN KEY (tenant_id, campaign_id)
        REFERENCES callcenter.campaigns (tenant_id, id),
    CONSTRAINT calls_parent_fk FOREIGN KEY (tenant_id, parent_call_id)
        REFERENCES telephony.calls (tenant_id, id),
    CONSTRAINT calls_direction_ck CHECK (
        direction IN ('inbound', 'outbound', 'internal')
    ),
    CONSTRAINT calls_status_ck CHECK (
        status IN (
            'initiated',
            'ringing',
            'answered',
            'bridged',
            'completed',
            'busy',
            'no_answer',
            'failed',
            'canceled'
        )
    ),
    CONSTRAINT calls_timeline_ck CHECK (
        (ringing_at IS NULL OR ringing_at >= started_at)
        AND (answered_at IS NULL OR answered_at >= started_at)
        AND (ended_at IS NULL OR ended_at >= started_at)
        AND (ended_at IS NULL OR answered_at IS NULL OR ended_at >= answered_at)
    ),
    CONSTRAINT calls_duration_ck CHECK (
        duration_seconds >= 0
        AND billable_seconds >= 0
        AND billable_seconds <= duration_seconds
    ),
    CONSTRAINT calls_sip_response_ck CHECK (
        sip_response_code IS NULL OR sip_response_code BETWEEN 100 AND 699
    ),
    CONSTRAINT calls_recording_status_ck CHECK (
        recording_status IN (
            'not_requested',
            'pending',
            'recording',
            'available',
            'failed',
            'deleted'
        )
    ),
    CONSTRAINT calls_metadata_object_ck
        CHECK (jsonb_typeof(metadata) = 'object')
) PARTITION BY HASH (tenant_id);

CREATE TABLE telephony.call_legs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    call_id uuid NOT NULL,
    external_leg_uuid uuid,
    leg_type varchar(20) NOT NULL,
    sequence_number integer NOT NULL DEFAULT 0,
    extension_id uuid,
    trunk_id uuid,
    agent_id uuid,
    queue_id uuid,
    remote_number varchar(64),
    status varchar(24) NOT NULL DEFAULT 'initiated',
    started_at timestamptz NOT NULL,
    answered_at timestamptz,
    ended_at timestamptz,
    codec varchar(40),
    remote_ip inet,
    hangup_cause varchar(80),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT call_legs_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT call_legs_external_uuid_uk
        UNIQUE (tenant_id, external_leg_uuid),
    CONSTRAINT call_legs_sequence_uk
        UNIQUE (tenant_id, call_id, sequence_number),
    CONSTRAINT call_legs_call_fk FOREIGN KEY (tenant_id, call_id)
        REFERENCES telephony.calls (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT call_legs_agent_fk FOREIGN KEY (tenant_id, agent_id)
        REFERENCES callcenter.agents (tenant_id, id),
    CONSTRAINT call_legs_queue_fk FOREIGN KEY (tenant_id, queue_id)
        REFERENCES callcenter.queues (tenant_id, id),
    CONSTRAINT call_legs_type_ck CHECK (
        leg_type IN ('originator', 'destination', 'transfer', 'conference', 'ai')
    ),
    CONSTRAINT call_legs_status_ck CHECK (
        status IN (
            'initiated',
            'ringing',
            'answered',
            'bridged',
            'completed',
            'failed'
        )
    ),
    CONSTRAINT call_legs_timeline_ck CHECK (
        (answered_at IS NULL OR answered_at >= started_at)
        AND (ended_at IS NULL OR ended_at >= started_at)
        AND (ended_at IS NULL OR answered_at IS NULL OR ended_at >= answered_at)
    ),
    CONSTRAINT call_legs_metadata_object_ck
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE telephony.event_deduplication (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    source_node varchar(120) NOT NULL,
    external_event_id varchar(255) NOT NULL,
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    PRIMARY KEY (tenant_id, source_node, external_event_id),
    CONSTRAINT event_deduplication_expiry_ck CHECK (expires_at > first_seen_at)
);

CREATE TABLE telephony.call_events (
    event_at timestamptz NOT NULL,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    call_id uuid NOT NULL,
    call_leg_id uuid,
    event_type varchar(80) NOT NULL,
    source_node varchar(120),
    sequence_number bigint,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    correlation_id varchar(120),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (event_at, id),
    CONSTRAINT call_events_call_fk FOREIGN KEY (tenant_id, call_id)
        REFERENCES telephony.calls (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT call_events_leg_fk FOREIGN KEY (tenant_id, call_leg_id)
        REFERENCES telephony.call_legs (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT call_events_payload_object_ck
        CHECK (jsonb_typeof(payload) = 'object')
) PARTITION BY RANGE (event_at);

CREATE TABLE telephony.recordings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    call_id uuid NOT NULL,
    call_leg_id uuid,
    storage_provider varchar(40) NOT NULL DEFAULT 's3',
    bucket_name varchar(255) NOT NULL,
    object_key text NOT NULL,
    content_type varchar(120) NOT NULL,
    size_bytes bigint,
    duration_seconds integer,
    checksum_sha256 char(64),
    encryption_key_ref text,
    status varchar(20) NOT NULL DEFAULT 'pending',
    retention_until timestamptz,
    legal_hold boolean NOT NULL DEFAULT false,
    transcription_status varchar(20) NOT NULL DEFAULT 'not_requested',
    created_at timestamptz NOT NULL DEFAULT now(),
    available_at timestamptz,
    deleted_at timestamptz,
    CONSTRAINT recordings_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT recordings_object_uk
        UNIQUE (storage_provider, bucket_name, object_key),
    CONSTRAINT recordings_call_fk FOREIGN KEY (tenant_id, call_id)
        REFERENCES telephony.calls (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT recordings_leg_fk FOREIGN KEY (tenant_id, call_leg_id)
        REFERENCES telephony.call_legs (tenant_id, id),
    CONSTRAINT recordings_size_ck CHECK (size_bytes IS NULL OR size_bytes >= 0),
    CONSTRAINT recordings_duration_ck CHECK (
        duration_seconds IS NULL OR duration_seconds >= 0
    ),
    CONSTRAINT recordings_checksum_ck CHECK (
        checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT recordings_status_ck CHECK (
        status IN ('pending', 'uploading', 'available', 'quarantined', 'failed', 'deleted')
    ),
    CONSTRAINT recordings_transcription_ck CHECK (
        transcription_status IN (
            'not_requested',
            'pending',
            'processing',
            'completed',
            'failed'
        )
    )
);

CREATE TABLE telephony.voicemail_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    extension_id uuid NOT NULL,
    call_id uuid,
    caller_number varchar(64),
    caller_name varchar(160),
    storage_provider varchar(40) NOT NULL DEFAULT 's3',
    bucket_name varchar(255) NOT NULL,
    object_key text NOT NULL,
    duration_seconds integer NOT NULL DEFAULT 0,
    is_read boolean NOT NULL DEFAULT false,
    read_at timestamptz,
    transcription text,
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT voicemail_messages_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT voicemail_messages_call_fk FOREIGN KEY (tenant_id, call_id)
        REFERENCES telephony.calls (tenant_id, id),
    CONSTRAINT voicemail_messages_object_uk
        UNIQUE (storage_provider, bucket_name, object_key),
    CONSTRAINT voicemail_messages_duration_ck CHECK (duration_seconds >= 0),
    CONSTRAINT voicemail_messages_read_ck CHECK (
        (is_read AND read_at IS NOT NULL) OR NOT is_read
    )
);

CREATE TABLE callcenter.queue_interactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    queue_id uuid NOT NULL,
    agent_id uuid,
    call_id uuid,
    channel_type varchar(20) NOT NULL,
    external_interaction_id uuid,
    status varchar(24) NOT NULL DEFAULT 'waiting',
    enqueued_at timestamptz NOT NULL,
    assigned_at timestamptz,
    answered_at timestamptz,
    ended_at timestamptz,
    wait_seconds integer NOT NULL DEFAULT 0,
    handle_seconds integer NOT NULL DEFAULT 0,
    wrap_up_seconds integer NOT NULL DEFAULT 0,
    sla_met boolean,
    disposition_code varchar(80),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT queue_interactions_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT queue_interactions_queue_fk FOREIGN KEY (tenant_id, queue_id)
        REFERENCES callcenter.queues (tenant_id, id),
    CONSTRAINT queue_interactions_agent_fk FOREIGN KEY (tenant_id, agent_id)
        REFERENCES callcenter.agents (tenant_id, id),
    CONSTRAINT queue_interactions_call_fk FOREIGN KEY (tenant_id, call_id)
        REFERENCES telephony.calls (tenant_id, id),
    CONSTRAINT queue_interactions_channel_ck CHECK (
        channel_type IN ('voice', 'whatsapp', 'chat', 'sms', 'email')
    ),
    CONSTRAINT queue_interactions_reference_ck CHECK (
        (channel_type = 'voice' AND call_id IS NOT NULL)
        OR (channel_type <> 'voice' AND external_interaction_id IS NOT NULL)
    ),
    CONSTRAINT queue_interactions_status_ck CHECK (
        status IN (
            'waiting',
            'reserved',
            'ringing',
            'active',
            'wrap_up',
            'completed',
            'abandoned',
            'failed'
        )
    ),
    CONSTRAINT queue_interactions_timeline_ck CHECK (
        (assigned_at IS NULL OR assigned_at >= enqueued_at)
        AND (answered_at IS NULL OR answered_at >= enqueued_at)
        AND (ended_at IS NULL OR ended_at >= enqueued_at)
    ),
    CONSTRAINT queue_interactions_duration_ck CHECK (
        wait_seconds >= 0
        AND handle_seconds >= 0
        AND wrap_up_seconds >= 0
    )
);

COMMIT;

BEGIN;

-- ---------------------------------------------------------------------------
-- Integration: providers, secrets references and provisioning
-- ---------------------------------------------------------------------------

CREATE TABLE integration.provider_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    provider_type varchar(40) NOT NULL,
    provider_name varchar(80) NOT NULL,
    display_name varchar(120) NOT NULL,
    secret_ref text NOT NULL,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    status varchar(20) NOT NULL DEFAULT 'pending',
    health_status varchar(20) NOT NULL DEFAULT 'unknown',
    last_health_check_at timestamptz,
    last_error_code varchar(80),
    last_error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT provider_accounts_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT provider_accounts_name_uk
        UNIQUE (tenant_id, provider_type, display_name),
    CONSTRAINT provider_accounts_type_ck CHECK (
        provider_type IN (
            'fusionpbx',
            'sip_carrier',
            'whatsapp',
            'email',
            'sms',
            'storage',
            'stt',
            'llm',
            'tts',
            'crm',
            'billing',
            'webhook'
        )
    ),
    CONSTRAINT provider_accounts_status_ck CHECK (
        status IN ('pending', 'active', 'disabled', 'error')
    ),
    CONSTRAINT provider_accounts_health_ck CHECK (
        health_status IN ('unknown', 'healthy', 'degraded', 'unhealthy')
    ),
    CONSTRAINT provider_accounts_config_object_ck
        CHECK (jsonb_typeof(config) = 'object')
);

CREATE TABLE integration.external_bindings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    provider_account_id uuid NOT NULL,
    resource_type varchar(80) NOT NULL,
    resource_id uuid NOT NULL,
    external_type varchar(80),
    external_id varchar(255) NOT NULL,
    external_revision varchar(255),
    desired_hash varchar(128),
    observed_hash varchar(128),
    sync_status varchar(20) NOT NULL DEFAULT 'pending',
    last_synced_at timestamptz,
    last_observed_at timestamptz,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT external_bindings_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT external_bindings_provider_fk FOREIGN KEY (
        tenant_id,
        provider_account_id
    ) REFERENCES integration.provider_accounts (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT external_bindings_resource_uk UNIQUE (
        tenant_id,
        provider_account_id,
        resource_type,
        resource_id
    ),
    CONSTRAINT external_bindings_external_uk UNIQUE (
        tenant_id,
        provider_account_id,
        external_type,
        external_id
    ),
    CONSTRAINT external_bindings_status_ck CHECK (
        sync_status IN ('pending', 'synced', 'drifted', 'failed', 'deleted')
    ),
    CONSTRAINT external_bindings_metadata_object_ck
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE integration.provisioning_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    provider_account_id uuid NOT NULL,
    resource_type varchar(80) NOT NULL,
    resource_id uuid NOT NULL,
    operation varchar(20) NOT NULL,
    idempotency_key varchar(180) NOT NULL,
    desired_state jsonb NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending',
    priority smallint NOT NULL DEFAULT 100,
    attempt_count integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 10,
    scheduled_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz,
    last_error_code varchar(80),
    last_error_message text,
    correlation_id varchar(120),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT provisioning_jobs_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT provisioning_jobs_provider_fk FOREIGN KEY (
        tenant_id,
        provider_account_id
    ) REFERENCES integration.provider_accounts (tenant_id, id),
    CONSTRAINT provisioning_jobs_idempotency_uk
        UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT provisioning_jobs_operation_ck CHECK (
        operation IN ('create', 'update', 'delete', 'reconcile', 'reload')
    ),
    CONSTRAINT provisioning_jobs_status_ck CHECK (
        status IN (
            'pending',
            'running',
            'succeeded',
            'failed',
            'dead_letter',
            'canceled'
        )
    ),
    CONSTRAINT provisioning_jobs_attempts_ck CHECK (
        attempt_count >= 0 AND max_attempts > 0
        AND attempt_count <= max_attempts
    ),
    CONSTRAINT provisioning_jobs_priority_ck CHECK (priority BETWEEN 0 AND 1000),
    CONSTRAINT provisioning_jobs_state_object_ck
        CHECK (jsonb_typeof(desired_state) = 'object')
);

CREATE INDEX provisioning_jobs_claim_idx
    ON integration.provisioning_jobs (status, scheduled_at, priority, id)
    WHERE status IN ('pending', 'failed');

CREATE TABLE integration.webhook_endpoints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    name varchar(120) NOT NULL,
    url text NOT NULL,
    secret_ref text NOT NULL,
    event_patterns text[] NOT NULL DEFAULT ARRAY[]::text[],
    status varchar(20) NOT NULL DEFAULT 'active',
    timeout_ms integer NOT NULL DEFAULT 5000,
    max_attempts integer NOT NULL DEFAULT 8,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT webhook_endpoints_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT webhook_endpoints_name_uk UNIQUE (tenant_id, name),
    CONSTRAINT webhook_endpoints_status_ck CHECK (
        status IN ('active', 'paused', 'disabled')
    ),
    CONSTRAINT webhook_endpoints_timeout_ck
        CHECK (timeout_ms BETWEEN 100 AND 30000),
    CONSTRAINT webhook_endpoints_attempts_ck
        CHECK (max_attempts BETWEEN 1 AND 30),
    CONSTRAINT webhook_endpoints_https_ck CHECK (url ~ '^https://')
);

-- ---------------------------------------------------------------------------
-- CRM: contas, contatos, pipeline, negócios e atividades
-- ---------------------------------------------------------------------------

CREATE TABLE crm.accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    name varchar(180) NOT NULL,
    legal_name varchar(180),
    document_type varchar(16),
    document_number varchar(32),
    industry varchar(100),
    website text,
    owner_membership_id uuid,
    status varchar(20) NOT NULL DEFAULT 'active',
    custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT crm_accounts_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT crm_accounts_owner_fk FOREIGN KEY (
        tenant_id,
        owner_membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT crm_accounts_status_ck CHECK (
        status IN ('prospect', 'active', 'inactive', 'blocked')
    ),
    CONSTRAINT crm_accounts_custom_fields_object_ck
        CHECK (jsonb_typeof(custom_fields) = 'object')
);

CREATE UNIQUE INDEX crm_accounts_document_uq
    ON crm.accounts (tenant_id, document_type, document_number)
    WHERE document_type IS NOT NULL
      AND document_number IS NOT NULL
      AND deleted_at IS NULL;

CREATE TABLE crm.contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    account_id uuid,
    owner_membership_id uuid,
    display_name varchar(180) NOT NULL,
    given_name varchar(100),
    family_name varchar(100),
    company_name varchar(180),
    job_title varchar(120),
    notes text,
    lifecycle_stage varchar(24) NOT NULL DEFAULT 'contact',
    source varchar(80),
    is_blocked boolean NOT NULL DEFAULT false,
    custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT crm_contacts_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT crm_contacts_account_fk FOREIGN KEY (tenant_id, account_id)
        REFERENCES crm.accounts (tenant_id, id) ON DELETE SET NULL,
    CONSTRAINT crm_contacts_owner_fk FOREIGN KEY (
        tenant_id,
        owner_membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT crm_contacts_lifecycle_ck CHECK (
        lifecycle_stage IN (
            'subscriber',
            'lead',
            'qualified',
            'opportunity',
            'customer',
            'contact',
            'inactive'
        )
    ),
    CONSTRAINT crm_contacts_custom_fields_object_ck
        CHECK (jsonb_typeof(custom_fields) = 'object')
);

CREATE TABLE crm.contact_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL,
    channel_type varchar(24) NOT NULL,
    channel_value citext NOT NULL,
    normalized_value citext NOT NULL,
    label varchar(60),
    is_primary boolean NOT NULL DEFAULT false,
    is_verified boolean NOT NULL DEFAULT false,
    can_contact boolean NOT NULL DEFAULT true,
    opt_in_source varchar(80),
    opt_in_at timestamptz,
    opt_out_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT contact_channels_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT contact_channels_contact_fk FOREIGN KEY (
        tenant_id,
        contact_id
    ) REFERENCES crm.contacts (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT contact_channels_identity_uk UNIQUE (
        tenant_id,
        channel_type,
        normalized_value
    ),
    CONSTRAINT contact_channels_type_ck CHECK (
        channel_type IN (
            'phone',
            'email',
            'whatsapp',
            'sms',
            'instagram',
            'telegram',
            'other'
        )
    ),
    CONSTRAINT contact_channels_opt_dates_ck CHECK (
        opt_out_at IS NULL OR opt_in_at IS NULL OR opt_out_at >= opt_in_at
    )
);

CREATE UNIQUE INDEX contact_channels_one_primary_uq
    ON crm.contact_channels (tenant_id, contact_id, channel_type)
    WHERE is_primary;

CREATE TABLE crm.tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    name varchar(80) NOT NULL,
    color varchar(9),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT crm_tags_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT crm_tags_name_uk UNIQUE (tenant_id, name),
    CONSTRAINT crm_tags_color_ck CHECK (
        color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$'
    )
);

CREATE TABLE crm.contact_tags (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, contact_id, tag_id),
    CONSTRAINT contact_tags_contact_fk FOREIGN KEY (tenant_id, contact_id)
        REFERENCES crm.contacts (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT contact_tags_tag_fk FOREIGN KEY (tenant_id, tag_id)
        REFERENCES crm.tags (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE crm.pipelines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    name varchar(120) NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT crm_pipelines_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT crm_pipelines_name_uk UNIQUE (tenant_id, name)
);

CREATE UNIQUE INDEX crm_pipelines_one_default_uq
    ON crm.pipelines (tenant_id)
    WHERE is_default;

CREATE TABLE crm.pipeline_stages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    pipeline_id uuid NOT NULL,
    name varchar(120) NOT NULL,
    position integer NOT NULL,
    probability numeric(5, 2) NOT NULL DEFAULT 0,
    stage_type varchar(20) NOT NULL DEFAULT 'open',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pipeline_stages_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT pipeline_stages_pipeline_id_id_uk
        UNIQUE (tenant_id, pipeline_id, id),
    CONSTRAINT pipeline_stages_pipeline_fk FOREIGN KEY (
        tenant_id,
        pipeline_id
    ) REFERENCES crm.pipelines (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT pipeline_stages_position_uk
        UNIQUE (tenant_id, pipeline_id, position),
    CONSTRAINT pipeline_stages_name_uk
        UNIQUE (tenant_id, pipeline_id, name),
    CONSTRAINT pipeline_stages_position_ck CHECK (position >= 0),
    CONSTRAINT pipeline_stages_probability_ck
        CHECK (probability BETWEEN 0 AND 100),
    CONSTRAINT pipeline_stages_type_ck CHECK (
        stage_type IN ('open', 'won', 'lost')
    )
);

CREATE TABLE crm.deals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    pipeline_id uuid NOT NULL,
    stage_id uuid NOT NULL,
    account_id uuid,
    primary_contact_id uuid,
    owner_membership_id uuid,
    title varchar(180) NOT NULL,
    amount numeric(16, 2),
    currency char(3) NOT NULL DEFAULT 'BRL',
    status varchar(20) NOT NULL DEFAULT 'open',
    expected_close_date date,
    closed_at timestamptz,
    lost_reason text,
    custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT crm_deals_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT crm_deals_pipeline_fk FOREIGN KEY (tenant_id, pipeline_id)
        REFERENCES crm.pipelines (tenant_id, id),
    CONSTRAINT crm_deals_stage_fk FOREIGN KEY (
        tenant_id,
        pipeline_id,
        stage_id
    ) REFERENCES crm.pipeline_stages (tenant_id, pipeline_id, id),
    CONSTRAINT crm_deals_account_fk FOREIGN KEY (tenant_id, account_id)
        REFERENCES crm.accounts (tenant_id, id),
    CONSTRAINT crm_deals_contact_fk FOREIGN KEY (
        tenant_id,
        primary_contact_id
    ) REFERENCES crm.contacts (tenant_id, id),
    CONSTRAINT crm_deals_owner_fk FOREIGN KEY (
        tenant_id,
        owner_membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT crm_deals_amount_ck CHECK (amount IS NULL OR amount >= 0),
    CONSTRAINT crm_deals_currency_ck CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT crm_deals_status_ck CHECK (
        status IN ('open', 'won', 'lost', 'canceled')
    ),
    CONSTRAINT crm_deals_custom_fields_object_ck
        CHECK (jsonb_typeof(custom_fields) = 'object')
);

CREATE TABLE crm.activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    activity_type varchar(30) NOT NULL,
    subject varchar(180) NOT NULL,
    description text,
    contact_id uuid,
    account_id uuid,
    deal_id uuid,
    assigned_membership_id uuid,
    created_by_membership_id uuid,
    status varchar(20) NOT NULL DEFAULT 'open',
    due_at timestamptz,
    started_at timestamptz,
    completed_at timestamptz,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT crm_activities_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT crm_activities_contact_fk FOREIGN KEY (tenant_id, contact_id)
        REFERENCES crm.contacts (tenant_id, id),
    CONSTRAINT crm_activities_account_fk FOREIGN KEY (tenant_id, account_id)
        REFERENCES crm.accounts (tenant_id, id),
    CONSTRAINT crm_activities_deal_fk FOREIGN KEY (tenant_id, deal_id)
        REFERENCES crm.deals (tenant_id, id),
    CONSTRAINT crm_activities_assigned_fk FOREIGN KEY (
        tenant_id,
        assigned_membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT crm_activities_created_by_fk FOREIGN KEY (
        tenant_id,
        created_by_membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT crm_activities_type_ck CHECK (
        activity_type IN (
            'task',
            'call',
            'meeting',
            'email',
            'note',
            'message',
            'follow_up'
        )
    ),
    CONSTRAINT crm_activities_status_ck CHECK (
        status IN ('open', 'in_progress', 'completed', 'canceled')
    ),
    CONSTRAINT crm_activities_metadata_object_ck
        CHECK (jsonb_typeof(metadata) = 'object')
);

-- ---------------------------------------------------------------------------
-- Telephony configuration: extensions, trunks, routes, IVR and groups
-- ---------------------------------------------------------------------------

CREATE TABLE telephony.extensions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    membership_id uuid,
    extension_number varchar(32) NOT NULL,
    display_name varchar(120) NOT NULL,
    auth_username varchar(120) NOT NULL,
    sip_secret_ref text NOT NULL,
    voicemail_enabled boolean NOT NULL DEFAULT true,
    voicemail_pin_hash text,
    outbound_caller_id_name varchar(120),
    outbound_caller_id_number varchar(32),
    max_registrations smallint NOT NULL DEFAULT 3,
    max_concurrent_calls smallint NOT NULL DEFAULT 2,
    recording_policy varchar(20) NOT NULL DEFAULT 'tenant_default',
    status varchar(20) NOT NULL DEFAULT 'provisioning',
    desired_version bigint NOT NULL DEFAULT 1,
    applied_version bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT extensions_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT extensions_number_uk
        UNIQUE (tenant_id, extension_number),
    CONSTRAINT extensions_auth_username_uk
        UNIQUE (tenant_id, auth_username),
    CONSTRAINT extensions_membership_fk FOREIGN KEY (
        tenant_id,
        membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT extensions_number_ck
        CHECK (extension_number ~ '^[0-9A-Za-z*#_.-]{1,32}$'),
    CONSTRAINT extensions_limits_ck CHECK (
        max_registrations BETWEEN 1 AND 20
        AND max_concurrent_calls BETWEEN 1 AND 100
    ),
    CONSTRAINT extensions_recording_ck CHECK (
        recording_policy IN (
            'tenant_default',
            'always',
            'never',
            'on_demand'
        )
    ),
    CONSTRAINT extensions_status_ck CHECK (
        status IN (
            'provisioning',
            'active',
            'suspended',
            'failed',
            'deleted'
        )
    ),
    CONSTRAINT extensions_version_ck CHECK (
        desired_version > 0
        AND applied_version >= 0
        AND applied_version <= desired_version
    )
);

CREATE UNIQUE INDEX extensions_one_active_membership_uq
    ON telephony.extensions (tenant_id, membership_id)
    WHERE membership_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE telephony.extension_devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    extension_id uuid NOT NULL,
    device_type varchar(20) NOT NULL,
    device_name varchar(120) NOT NULL,
    mac_address macaddr,
    user_agent text,
    push_token_ref text,
    status varchar(20) NOT NULL DEFAULT 'active',
    last_registered_at timestamptz,
    last_ip inet,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT extension_devices_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT extension_devices_extension_fk FOREIGN KEY (
        tenant_id,
        extension_id
    ) REFERENCES telephony.extensions (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT extension_devices_type_ck CHECK (
        device_type IN ('webphone', 'desk_phone', 'softphone', 'mobile')
    ),
    CONSTRAINT extension_devices_status_ck CHECK (
        status IN ('active', 'revoked', 'expired', 'offline')
    )
);

CREATE UNIQUE INDEX extension_devices_mac_uq
    ON telephony.extension_devices (tenant_id, mac_address)
    WHERE mac_address IS NOT NULL;

CREATE TABLE telephony.sip_trunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    provider_account_id uuid,
    name varchar(120) NOT NULL,
    direction varchar(16) NOT NULL DEFAULT 'bidirectional',
    transport varchar(8) NOT NULL DEFAULT 'udp',
    host varchar(255) NOT NULL,
    port integer NOT NULL DEFAULT 5060,
    auth_username varchar(255),
    auth_secret_ref text,
    registration_required boolean NOT NULL DEFAULT false,
    from_domain varchar(255),
    codec_preferences text[] NOT NULL DEFAULT ARRAY['PCMA', 'PCMU']::text[],
    max_channels integer NOT NULL DEFAULT 10,
    cps_limit numeric(8, 2),
    status varchar(20) NOT NULL DEFAULT 'provisioning',
    failover_priority integer NOT NULL DEFAULT 100,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT sip_trunks_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT sip_trunks_name_uk UNIQUE (tenant_id, name),
    CONSTRAINT sip_trunks_provider_fk FOREIGN KEY (
        tenant_id,
        provider_account_id
    ) REFERENCES integration.provider_accounts (tenant_id, id),
    CONSTRAINT sip_trunks_direction_ck CHECK (
        direction IN ('inbound', 'outbound', 'bidirectional')
    ),
    CONSTRAINT sip_trunks_transport_ck CHECK (
        transport IN ('udp', 'tcp', 'tls', 'ws', 'wss')
    ),
    CONSTRAINT sip_trunks_port_ck CHECK (port BETWEEN 1 AND 65535),
    CONSTRAINT sip_trunks_channels_ck CHECK (max_channels > 0),
    CONSTRAINT sip_trunks_cps_ck CHECK (cps_limit IS NULL OR cps_limit > 0),
    CONSTRAINT sip_trunks_status_ck CHECK (
        status IN (
            'provisioning',
            'active',
            'degraded',
            'suspended',
            'failed'
        )
    ),
    CONSTRAINT sip_trunks_priority_ck CHECK (failover_priority >= 0),
    CONSTRAINT sip_trunks_settings_object_ck
        CHECK (jsonb_typeof(settings) = 'object')
);

CREATE TABLE telephony.routing_destinations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    destination_type varchar(30) NOT NULL,
    resource_id uuid,
    literal_value varchar(255),
    display_name varchar(160) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT routing_destinations_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT routing_destinations_target_ck CHECK (
        (resource_id IS NOT NULL AND literal_value IS NULL)
        OR (resource_id IS NULL AND literal_value IS NOT NULL)
    ),
    CONSTRAINT routing_destinations_type_ck CHECK (
        destination_type IN (
            'extension',
            'queue',
            'ivr',
            'ring_group',
            'voicemail',
            'external_number',
            'hangup',
            'time_condition',
            'voice_ai'
        )
    )
);

CREATE UNIQUE INDEX routing_destinations_resource_uq
    ON telephony.routing_destinations (
        tenant_id,
        destination_type,
        resource_id
    )
    WHERE resource_id IS NOT NULL;

CREATE TABLE telephony.inbound_routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    trunk_id uuid,
    destination_id uuid NOT NULL,
    name varchar(120) NOT NULL,
    did_pattern varchar(180) NOT NULL,
    caller_id_pattern varchar(180),
    priority integer NOT NULL DEFAULT 100,
    enabled boolean NOT NULL DEFAULT true,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT inbound_routes_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT inbound_routes_name_uk UNIQUE (tenant_id, name),
    CONSTRAINT inbound_routes_trunk_fk FOREIGN KEY (tenant_id, trunk_id)
        REFERENCES telephony.sip_trunks (tenant_id, id),
    CONSTRAINT inbound_routes_destination_fk FOREIGN KEY (
        tenant_id,
        destination_id
    ) REFERENCES telephony.routing_destinations (tenant_id, id),
    CONSTRAINT inbound_routes_priority_ck CHECK (priority >= 0),
    CONSTRAINT inbound_routes_settings_object_ck
        CHECK (jsonb_typeof(settings) = 'object')
);

CREATE TABLE telephony.outbound_routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    name varchar(120) NOT NULL,
    priority integer NOT NULL DEFAULT 100,
    caller_id_name varchar(120),
    caller_id_number varchar(32),
    pin_set_hash text,
    enabled boolean NOT NULL DEFAULT true,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT outbound_routes_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT outbound_routes_name_uk UNIQUE (tenant_id, name),
    CONSTRAINT outbound_routes_priority_ck CHECK (priority >= 0),
    CONSTRAINT outbound_routes_settings_object_ck
        CHECK (jsonb_typeof(settings) = 'object')
);

CREATE TABLE telephony.outbound_route_patterns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    outbound_route_id uuid NOT NULL,
    match_pattern varchar(180) NOT NULL,
    prepend_digits varchar(32),
    strip_digits smallint NOT NULL DEFAULT 0,
    position integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT outbound_route_patterns_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT outbound_route_patterns_route_fk FOREIGN KEY (
        tenant_id,
        outbound_route_id
    ) REFERENCES telephony.outbound_routes (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT outbound_route_patterns_position_uk
        UNIQUE (tenant_id, outbound_route_id, position),
    CONSTRAINT outbound_route_patterns_strip_ck
        CHECK (strip_digits BETWEEN 0 AND 32)
);

CREATE TABLE telephony.outbound_route_trunks (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    outbound_route_id uuid NOT NULL,
    trunk_id uuid NOT NULL,
    priority integer NOT NULL DEFAULT 100,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, outbound_route_id, trunk_id),
    CONSTRAINT outbound_route_trunks_route_fk FOREIGN KEY (
        tenant_id,
        outbound_route_id
    ) REFERENCES telephony.outbound_routes (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT outbound_route_trunks_trunk_fk FOREIGN KEY (
        tenant_id,
        trunk_id
    ) REFERENCES telephony.sip_trunks (tenant_id, id),
    CONSTRAINT outbound_route_trunks_priority_ck CHECK (priority >= 0)
);

CREATE TABLE telephony.ivrs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    name varchar(120) NOT NULL,
    greeting_object_key text,
    direct_dial_enabled boolean NOT NULL DEFAULT false,
    digit_timeout_ms integer NOT NULL DEFAULT 3000,
    inter_digit_timeout_ms integer NOT NULL DEFAULT 2000,
    max_failures smallint NOT NULL DEFAULT 3,
    max_timeouts smallint NOT NULL DEFAULT 3,
    invalid_destination_id uuid,
    timeout_destination_id uuid,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT ivrs_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT ivrs_name_uk UNIQUE (tenant_id, name),
    CONSTRAINT ivrs_invalid_destination_fk FOREIGN KEY (
        tenant_id,
        invalid_destination_id
    ) REFERENCES telephony.routing_destinations (tenant_id, id),
    CONSTRAINT ivrs_timeout_destination_fk FOREIGN KEY (
        tenant_id,
        timeout_destination_id
    ) REFERENCES telephony.routing_destinations (tenant_id, id),
    CONSTRAINT ivrs_timeout_ck CHECK (
        digit_timeout_ms BETWEEN 250 AND 60000
        AND inter_digit_timeout_ms BETWEEN 250 AND 60000
    ),
    CONSTRAINT ivrs_failures_ck CHECK (
        max_failures BETWEEN 1 AND 20
        AND max_timeouts BETWEEN 1 AND 20
    )
);

CREATE TABLE telephony.ivr_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    ivr_id uuid NOT NULL,
    digits varchar(12) NOT NULL,
    destination_id uuid NOT NULL,
    description varchar(180),
    position integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ivr_options_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT ivr_options_ivr_fk FOREIGN KEY (tenant_id, ivr_id)
        REFERENCES telephony.ivrs (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT ivr_options_destination_fk FOREIGN KEY (
        tenant_id,
        destination_id
    ) REFERENCES telephony.routing_destinations (tenant_id, id),
    CONSTRAINT ivr_options_digits_uk UNIQUE (tenant_id, ivr_id, digits),
    CONSTRAINT ivr_options_digits_ck CHECK (digits ~ '^[0-9*#]{1,12}$'),
    CONSTRAINT ivr_options_position_ck CHECK (position >= 0)
);

CREATE TABLE telephony.ring_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    name varchar(120) NOT NULL,
    extension_number varchar(32),
    strategy varchar(24) NOT NULL DEFAULT 'simultaneous',
    ring_timeout_seconds integer NOT NULL DEFAULT 30,
    fallback_destination_id uuid,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT ring_groups_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT ring_groups_name_uk UNIQUE (tenant_id, name),
    CONSTRAINT ring_groups_extension_uk
        UNIQUE (tenant_id, extension_number),
    CONSTRAINT ring_groups_fallback_fk FOREIGN KEY (
        tenant_id,
        fallback_destination_id
    ) REFERENCES telephony.routing_destinations (tenant_id, id),
    CONSTRAINT ring_groups_strategy_ck CHECK (
        strategy IN ('simultaneous', 'sequential', 'random', 'round_robin')
    ),
    CONSTRAINT ring_groups_timeout_ck
        CHECK (ring_timeout_seconds BETWEEN 1 AND 600)
);

CREATE TABLE telephony.ring_group_members (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    ring_group_id uuid NOT NULL,
    extension_id uuid NOT NULL,
    position integer NOT NULL DEFAULT 0,
    delay_seconds integer NOT NULL DEFAULT 0,
    timeout_seconds integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, ring_group_id, extension_id),
    CONSTRAINT ring_group_members_group_fk FOREIGN KEY (
        tenant_id,
        ring_group_id
    ) REFERENCES telephony.ring_groups (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT ring_group_members_extension_fk FOREIGN KEY (
        tenant_id,
        extension_id
    ) REFERENCES telephony.extensions (tenant_id, id),
    CONSTRAINT ring_group_members_position_ck CHECK (position >= 0),
    CONSTRAINT ring_group_members_delay_ck CHECK (delay_seconds >= 0),
    CONSTRAINT ring_group_members_timeout_ck CHECK (
        timeout_seconds IS NULL OR timeout_seconds > 0
    )
);

CREATE TABLE telephony.pickup_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    name varchar(120) NOT NULL,
    pickup_code varchar(32),
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pickup_groups_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT pickup_groups_name_uk UNIQUE (tenant_id, name),
    CONSTRAINT pickup_groups_code_uk UNIQUE (tenant_id, pickup_code)
);

CREATE TABLE telephony.pickup_group_members (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    pickup_group_id uuid NOT NULL,
    extension_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, pickup_group_id, extension_id),
    CONSTRAINT pickup_group_members_group_fk FOREIGN KEY (
        tenant_id,
        pickup_group_id
    ) REFERENCES telephony.pickup_groups (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT pickup_group_members_extension_fk FOREIGN KEY (
        tenant_id,
        extension_id
    ) REFERENCES telephony.extensions (tenant_id, id)
);

-- Cross-module constraints are added after all referenced modules exist.

ALTER TABLE callcenter.agents
    ADD CONSTRAINT agents_extension_fk
    FOREIGN KEY (tenant_id, extension_id)
    REFERENCES telephony.extensions (tenant_id, id);

ALTER TABLE callcenter.queues
    ADD CONSTRAINT queues_fallback_fk
    FOREIGN KEY (tenant_id, fallback_destination_id)
    REFERENCES telephony.routing_destinations (tenant_id, id);

ALTER TABLE callcenter.queue_schedules
    ADD CONSTRAINT queue_schedules_destination_fk
    FOREIGN KEY (tenant_id, closed_destination_id)
    REFERENCES telephony.routing_destinations (tenant_id, id);

ALTER TABLE callcenter.campaigns
    ADD CONSTRAINT campaigns_outbound_route_fk
    FOREIGN KEY (tenant_id, outbound_route_id)
    REFERENCES telephony.outbound_routes (tenant_id, id);

ALTER TABLE callcenter.campaign_contacts
    ADD CONSTRAINT campaign_contacts_contact_fk
    FOREIGN KEY (tenant_id, contact_id)
    REFERENCES crm.contacts (tenant_id, id);

ALTER TABLE callcenter.campaign_contacts
    ADD CONSTRAINT campaign_contacts_channel_fk
    FOREIGN KEY (tenant_id, contact_channel_id)
    REFERENCES crm.contact_channels (tenant_id, id);

ALTER TABLE telephony.calls
    ADD CONSTRAINT calls_contact_fk
    FOREIGN KEY (tenant_id, contact_id)
    REFERENCES crm.contacts (tenant_id, id);

ALTER TABLE telephony.call_legs
    ADD CONSTRAINT call_legs_extension_fk
    FOREIGN KEY (tenant_id, extension_id)
    REFERENCES telephony.extensions (tenant_id, id);

ALTER TABLE telephony.call_legs
    ADD CONSTRAINT call_legs_trunk_fk
    FOREIGN KEY (tenant_id, trunk_id)
    REFERENCES telephony.sip_trunks (tenant_id, id);

ALTER TABLE telephony.voicemail_messages
    ADD CONSTRAINT voicemail_messages_extension_fk
    FOREIGN KEY (tenant_id, extension_id)
    REFERENCES telephony.extensions (tenant_id, id);

COMMIT;

BEGIN;

-- ---------------------------------------------------------------------------
-- Omnichannel and WhatsApp
-- ---------------------------------------------------------------------------

CREATE TABLE omnichannel.whatsapp_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    provider_account_id uuid NOT NULL,
    provider varchar(30) NOT NULL,
    business_account_external_id varchar(255) NOT NULL,
    display_name varchar(160) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending',
    quality_rating varchar(20),
    messaging_limit_tier varchar(40),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT whatsapp_accounts_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT whatsapp_accounts_provider_fk FOREIGN KEY (
        tenant_id,
        provider_account_id
    ) REFERENCES integration.provider_accounts (tenant_id, id),
    CONSTRAINT whatsapp_accounts_external_uk UNIQUE (
        provider,
        business_account_external_id
    ),
    CONSTRAINT whatsapp_accounts_provider_ck CHECK (
        provider IN ('meta_cloud', 'twilio', 'bsp')
    ),
    CONSTRAINT whatsapp_accounts_status_ck CHECK (
        status IN ('pending', 'active', 'restricted', 'disabled', 'error')
    ),
    CONSTRAINT whatsapp_accounts_quality_ck CHECK (
        quality_rating IS NULL
        OR quality_rating IN ('green', 'yellow', 'red', 'unknown')
    )
);

CREATE TABLE omnichannel.whatsapp_numbers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    whatsapp_account_id uuid NOT NULL,
    phone_number_external_id varchar(255) NOT NULL,
    phone_e164 varchar(20) NOT NULL,
    display_name varchar(160),
    verified_name varchar(160),
    status varchar(20) NOT NULL DEFAULT 'pending',
    quality_rating varchar(20),
    throughput_tier varchar(40),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT whatsapp_numbers_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT whatsapp_numbers_account_fk FOREIGN KEY (
        tenant_id,
        whatsapp_account_id
    ) REFERENCES omnichannel.whatsapp_accounts (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT whatsapp_numbers_external_uk
        UNIQUE (whatsapp_account_id, phone_number_external_id),
    CONSTRAINT whatsapp_numbers_phone_uk UNIQUE (phone_e164),
    CONSTRAINT whatsapp_numbers_phone_ck
        CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
    CONSTRAINT whatsapp_numbers_status_ck CHECK (
        status IN ('pending', 'active', 'restricted', 'disabled', 'error')
    )
);

CREATE TABLE omnichannel.whatsapp_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    whatsapp_account_id uuid NOT NULL,
    external_id varchar(255),
    name varchar(512) NOT NULL,
    language_code varchar(16) NOT NULL,
    category varchar(24) NOT NULL,
    status varchar(24) NOT NULL DEFAULT 'pending',
    components jsonb NOT NULL,
    rejection_reason text,
    last_synced_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT whatsapp_templates_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT whatsapp_templates_account_fk FOREIGN KEY (
        tenant_id,
        whatsapp_account_id
    ) REFERENCES omnichannel.whatsapp_accounts (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT whatsapp_templates_name_language_uk UNIQUE (
        tenant_id,
        whatsapp_account_id,
        name,
        language_code
    ),
    CONSTRAINT whatsapp_templates_category_ck CHECK (
        category IN ('marketing', 'utility', 'authentication')
    ),
    CONSTRAINT whatsapp_templates_status_ck CHECK (
        status IN (
            'pending',
            'approved',
            'rejected',
            'paused',
            'disabled',
            'deleted'
        )
    ),
    CONSTRAINT whatsapp_templates_components_array_ck
        CHECK (jsonb_typeof(components) = 'array')
);

CREATE TABLE omnichannel.conversations (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    channel_type varchar(20) NOT NULL,
    provider_account_id uuid,
    contact_id uuid,
    queue_id uuid,
    subject varchar(255),
    status varchar(24) NOT NULL DEFAULT 'open',
    priority smallint NOT NULL DEFAULT 100,
    first_message_at timestamptz,
    last_message_at timestamptz,
    waiting_since timestamptz,
    resolved_at timestamptz,
    closed_at timestamptz,
    assigned_agent_id uuid,
    unread_count integer NOT NULL DEFAULT 0,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT conversations_public_id_uk UNIQUE (tenant_id, public_id),
    CONSTRAINT conversations_provider_fk FOREIGN KEY (
        tenant_id,
        provider_account_id
    ) REFERENCES integration.provider_accounts (tenant_id, id),
    CONSTRAINT conversations_contact_fk FOREIGN KEY (tenant_id, contact_id)
        REFERENCES crm.contacts (tenant_id, id),
    CONSTRAINT conversations_queue_fk FOREIGN KEY (tenant_id, queue_id)
        REFERENCES callcenter.queues (tenant_id, id),
    CONSTRAINT conversations_agent_fk FOREIGN KEY (
        tenant_id,
        assigned_agent_id
    ) REFERENCES callcenter.agents (tenant_id, id),
    CONSTRAINT conversations_channel_ck CHECK (
        channel_type IN (
            'whatsapp',
            'sms',
            'email',
            'instagram',
            'messenger',
            'webchat'
        )
    ),
    CONSTRAINT conversations_status_ck CHECK (
        status IN (
            'open',
            'waiting',
            'assigned',
            'active',
            'pending_customer',
            'resolved',
            'closed',
            'spam'
        )
    ),
    CONSTRAINT conversations_priority_ck CHECK (priority BETWEEN 0 AND 1000),
    CONSTRAINT conversations_unread_ck CHECK (unread_count >= 0),
    CONSTRAINT conversations_timeline_ck CHECK (
        (last_message_at IS NULL OR first_message_at IS NULL
            OR last_message_at >= first_message_at)
        AND (closed_at IS NULL OR resolved_at IS NULL
            OR closed_at >= resolved_at)
    ),
    CONSTRAINT conversations_metadata_object_ck
        CHECK (jsonb_typeof(metadata) = 'object')
) PARTITION BY HASH (tenant_id);

ALTER TABLE callcenter.queue_interactions
    ADD CONSTRAINT queue_interactions_conversation_fk
    FOREIGN KEY (tenant_id, external_interaction_id)
    REFERENCES omnichannel.conversations (tenant_id, id);

CREATE TABLE omnichannel.conversation_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    conversation_id uuid NOT NULL,
    participant_type varchar(20) NOT NULL,
    contact_id uuid,
    membership_id uuid,
    agent_id uuid,
    external_identifier varchar(255),
    joined_at timestamptz NOT NULL DEFAULT now(),
    left_at timestamptz,
    CONSTRAINT conversation_participants_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT conversation_participants_conversation_fk FOREIGN KEY (
        tenant_id,
        conversation_id
    ) REFERENCES omnichannel.conversations (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT conversation_participants_contact_fk FOREIGN KEY (
        tenant_id,
        contact_id
    ) REFERENCES crm.contacts (tenant_id, id),
    CONSTRAINT conversation_participants_membership_fk FOREIGN KEY (
        tenant_id,
        membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT conversation_participants_agent_fk FOREIGN KEY (
        tenant_id,
        agent_id
    ) REFERENCES callcenter.agents (tenant_id, id),
    CONSTRAINT conversation_participants_type_ck CHECK (
        participant_type IN ('contact', 'user', 'agent', 'bot', 'external')
    ),
    CONSTRAINT conversation_participants_identity_ck CHECK (
        num_nonnulls(contact_id, membership_id, agent_id, external_identifier) = 1
    ),
    CONSTRAINT conversation_participants_dates_ck CHECK (
        left_at IS NULL OR left_at >= joined_at
    )
);

CREATE TABLE omnichannel.conversation_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    conversation_id uuid NOT NULL,
    queue_id uuid,
    agent_id uuid,
    assigned_by_membership_id uuid,
    assignment_type varchar(20) NOT NULL DEFAULT 'automatic',
    status varchar(20) NOT NULL DEFAULT 'active',
    assigned_at timestamptz NOT NULL DEFAULT now(),
    accepted_at timestamptz,
    ended_at timestamptz,
    end_reason varchar(80),
    CONSTRAINT conversation_assignments_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT conversation_assignments_conversation_fk FOREIGN KEY (
        tenant_id,
        conversation_id
    ) REFERENCES omnichannel.conversations (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT conversation_assignments_queue_fk FOREIGN KEY (
        tenant_id,
        queue_id
    ) REFERENCES callcenter.queues (tenant_id, id),
    CONSTRAINT conversation_assignments_agent_fk FOREIGN KEY (
        tenant_id,
        agent_id
    ) REFERENCES callcenter.agents (tenant_id, id),
    CONSTRAINT conversation_assignments_assigned_by_fk FOREIGN KEY (
        tenant_id,
        assigned_by_membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT conversation_assignments_type_ck CHECK (
        assignment_type IN ('automatic', 'manual', 'transfer', 'claim')
    ),
    CONSTRAINT conversation_assignments_status_ck CHECK (
        status IN ('offered', 'active', 'rejected', 'expired', 'completed')
    ),
    CONSTRAINT conversation_assignments_dates_ck CHECK (
        (accepted_at IS NULL OR accepted_at >= assigned_at)
        AND (ended_at IS NULL OR ended_at >= assigned_at)
    )
);

CREATE UNIQUE INDEX conversation_assignments_one_active_uq
    ON omnichannel.conversation_assignments (tenant_id, conversation_id)
    WHERE status IN ('offered', 'active');

CREATE TABLE omnichannel.message_deduplication (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    provider_account_id uuid NOT NULL,
    provider_message_id varchar(255) NOT NULL,
    message_id uuid NOT NULL,
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    PRIMARY KEY (tenant_id, provider_account_id, provider_message_id),
    CONSTRAINT message_deduplication_provider_fk FOREIGN KEY (
        tenant_id,
        provider_account_id
    ) REFERENCES integration.provider_accounts (tenant_id, id),
    CONSTRAINT message_deduplication_expiry_ck CHECK (
        expires_at IS NULL OR expires_at > first_seen_at
    )
);

CREATE TABLE omnichannel.messages (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL,
    provider_account_id uuid,
    provider_message_id varchar(255),
    client_message_id uuid,
    reply_to_message_id uuid,
    direction varchar(12) NOT NULL,
    sender_type varchar(20) NOT NULL,
    sender_contact_id uuid,
    sender_membership_id uuid,
    sender_agent_id uuid,
    message_type varchar(24) NOT NULL DEFAULT 'text',
    text_body text,
    structured_content jsonb,
    status varchar(24) NOT NULL DEFAULT 'pending',
    sent_at timestamptz,
    delivered_at timestamptz,
    read_at timestamptz,
    failed_at timestamptz,
    failure_code varchar(80),
    failure_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT messages_conversation_fk FOREIGN KEY (
        tenant_id,
        conversation_id
    ) REFERENCES omnichannel.conversations (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT messages_provider_fk FOREIGN KEY (
        tenant_id,
        provider_account_id
    ) REFERENCES integration.provider_accounts (tenant_id, id),
    CONSTRAINT messages_reply_fk FOREIGN KEY (
        tenant_id,
        reply_to_message_id
    ) REFERENCES omnichannel.messages (tenant_id, id),
    CONSTRAINT messages_sender_contact_fk FOREIGN KEY (
        tenant_id,
        sender_contact_id
    ) REFERENCES crm.contacts (tenant_id, id),
    CONSTRAINT messages_sender_membership_fk FOREIGN KEY (
        tenant_id,
        sender_membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT messages_sender_agent_fk FOREIGN KEY (
        tenant_id,
        sender_agent_id
    ) REFERENCES callcenter.agents (tenant_id, id),
    CONSTRAINT messages_direction_ck CHECK (
        direction IN ('inbound', 'outbound', 'internal')
    ),
    CONSTRAINT messages_sender_type_ck CHECK (
        sender_type IN ('contact', 'user', 'agent', 'bot', 'system')
    ),
    CONSTRAINT messages_type_ck CHECK (
        message_type IN (
            'text',
            'image',
            'audio',
            'video',
            'document',
            'location',
            'contact',
            'template',
            'interactive',
            'system'
        )
    ),
    CONSTRAINT messages_content_ck CHECK (
        text_body IS NOT NULL OR structured_content IS NOT NULL
        OR message_type = 'system'
    ),
    CONSTRAINT messages_sender_identity_ck CHECK (
        (
            sender_type = 'contact'
            AND sender_contact_id IS NOT NULL
            AND num_nonnulls(
                sender_contact_id,
                sender_membership_id,
                sender_agent_id
            ) = 1
        )
        OR (
            sender_type = 'user'
            AND sender_membership_id IS NOT NULL
            AND num_nonnulls(
                sender_contact_id,
                sender_membership_id,
                sender_agent_id
            ) = 1
        )
        OR (
            sender_type = 'agent'
            AND sender_agent_id IS NOT NULL
            AND num_nonnulls(
                sender_contact_id,
                sender_membership_id,
                sender_agent_id
            ) = 1
        )
        OR (
            sender_type IN ('bot', 'system')
            AND num_nonnulls(
                sender_contact_id,
                sender_membership_id,
                sender_agent_id
            ) = 0
        )
    ),
    CONSTRAINT messages_status_ck CHECK (
        status IN (
            'pending',
            'queued',
            'sent',
            'delivered',
            'read',
            'failed',
            'deleted'
        )
    ),
    CONSTRAINT messages_timeline_ck CHECK (
        (delivered_at IS NULL OR sent_at IS NULL OR delivered_at >= sent_at)
        AND (read_at IS NULL OR delivered_at IS NULL OR read_at >= delivered_at)
        AND (failed_at IS NULL OR failed_at >= created_at)
    ),
    CONSTRAINT messages_structured_object_ck CHECK (
        structured_content IS NULL OR jsonb_typeof(structured_content) = 'object'
    )
) PARTITION BY HASH (tenant_id);

ALTER TABLE omnichannel.message_deduplication
    ADD CONSTRAINT message_deduplication_message_fk
    FOREIGN KEY (tenant_id, message_id)
    REFERENCES omnichannel.messages (tenant_id, id)
    ON DELETE CASCADE;

CREATE UNIQUE INDEX messages_client_id_uq
    ON omnichannel.messages (tenant_id, client_message_id)
    WHERE client_message_id IS NOT NULL;

CREATE TABLE omnichannel.message_media (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    message_id uuid NOT NULL,
    media_type varchar(24) NOT NULL,
    storage_provider varchar(40) NOT NULL DEFAULT 's3',
    bucket_name varchar(255) NOT NULL,
    object_key text NOT NULL,
    original_filename varchar(255),
    content_type varchar(120),
    size_bytes bigint,
    checksum_sha256 char(64),
    scan_status varchar(20) NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT message_media_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT message_media_message_fk FOREIGN KEY (tenant_id, message_id)
        REFERENCES omnichannel.messages (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT message_media_object_uk
        UNIQUE (storage_provider, bucket_name, object_key),
    CONSTRAINT message_media_type_ck CHECK (
        media_type IN ('image', 'audio', 'video', 'document', 'sticker', 'other')
    ),
    CONSTRAINT message_media_size_ck CHECK (size_bytes IS NULL OR size_bytes >= 0),
    CONSTRAINT message_media_checksum_ck CHECK (
        checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT message_media_scan_ck CHECK (
        scan_status IN ('pending', 'clean', 'infected', 'failed', 'skipped')
    )
);

CREATE TABLE omnichannel.message_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    message_id uuid NOT NULL,
    receipt_type varchar(20) NOT NULL,
    provider_timestamp timestamptz,
    provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT message_receipts_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT message_receipts_message_fk FOREIGN KEY (
        tenant_id,
        message_id
    ) REFERENCES omnichannel.messages (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT message_receipts_type_uk
        UNIQUE (tenant_id, message_id, receipt_type),
    CONSTRAINT message_receipts_type_ck CHECK (
        receipt_type IN ('accepted', 'sent', 'delivered', 'read', 'failed')
    ),
    CONSTRAINT message_receipts_payload_object_ck
        CHECK (jsonb_typeof(provider_payload) = 'object')
);

CREATE TABLE omnichannel.webhook_events (
    received_at timestamptz NOT NULL DEFAULT now(),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES core.tenants(id) ON DELETE CASCADE,
    provider_account_id uuid,
    provider varchar(40) NOT NULL,
    event_external_id varchar(255),
    signature_valid boolean NOT NULL DEFAULT false,
    processing_status varchar(20) NOT NULL DEFAULT 'received',
    payload jsonb NOT NULL,
    processed_at timestamptz,
    error_message text,
    PRIMARY KEY (received_at, id),
    CONSTRAINT webhook_events_status_ck CHECK (
        processing_status IN (
            'received',
            'validated',
            'processed',
            'duplicate',
            'rejected',
            'failed'
        )
    ),
    CONSTRAINT webhook_events_payload_object_ck
        CHECK (jsonb_typeof(payload) = 'object')
) PARTITION BY RANGE (received_at);

ALTER TABLE omnichannel.webhook_events
    ADD CONSTRAINT webhook_events_provider_fk
    FOREIGN KEY (tenant_id, provider_account_id)
    REFERENCES integration.provider_accounts (tenant_id, id);

-- ---------------------------------------------------------------------------
-- Corporate chat
-- ---------------------------------------------------------------------------

CREATE TABLE chat.channels (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    channel_type varchar(20) NOT NULL,
    direct_key char(64),
    name varchar(160),
    description text,
    created_by_membership_id uuid,
    is_private boolean NOT NULL DEFAULT true,
    is_archived boolean NOT NULL DEFAULT false,
    last_message_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT chat_channels_created_by_fk FOREIGN KEY (
        tenant_id,
        created_by_membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT chat_channels_type_ck CHECK (
        channel_type IN ('direct', 'group', 'team', 'announcement')
    ),
    CONSTRAINT chat_channels_direct_key_ck CHECK (
        (channel_type = 'direct' AND direct_key IS NOT NULL)
        OR (channel_type <> 'direct' AND direct_key IS NULL)
    ),
    CONSTRAINT chat_channels_direct_key_format_ck CHECK (
        direct_key IS NULL OR direct_key ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT chat_channels_name_ck CHECK (
        channel_type = 'direct' OR name IS NOT NULL
    )
) PARTITION BY HASH (tenant_id);

CREATE UNIQUE INDEX chat_channels_direct_key_uq
    ON chat.channels (tenant_id, direct_key)
    WHERE direct_key IS NOT NULL;

CREATE TABLE chat.channel_members (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    channel_id uuid NOT NULL,
    membership_id uuid NOT NULL,
    member_role varchar(20) NOT NULL DEFAULT 'member',
    notification_level varchar(20) NOT NULL DEFAULT 'all',
    joined_at timestamptz NOT NULL DEFAULT now(),
    last_read_at timestamptz,
    left_at timestamptz,
    PRIMARY KEY (tenant_id, channel_id, membership_id),
    CONSTRAINT channel_members_channel_fk FOREIGN KEY (
        tenant_id,
        channel_id
    ) REFERENCES chat.channels (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT channel_members_membership_fk FOREIGN KEY (
        tenant_id,
        membership_id
    ) REFERENCES iam.memberships (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT channel_members_role_ck CHECK (
        member_role IN ('owner', 'moderator', 'member', 'guest')
    ),
    CONSTRAINT channel_members_notification_ck CHECK (
        notification_level IN ('all', 'mentions', 'none')
    ),
    CONSTRAINT channel_members_dates_ck CHECK (
        left_at IS NULL OR left_at >= joined_at
    )
);

CREATE TABLE chat.messages (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    channel_id uuid NOT NULL,
    sender_membership_id uuid,
    client_message_id uuid,
    reply_to_message_id uuid,
    sequence_number bigint NOT NULL,
    message_type varchar(20) NOT NULL DEFAULT 'text',
    body text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    edited_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT chat_messages_channel_fk FOREIGN KEY (
        tenant_id,
        channel_id
    ) REFERENCES chat.channels (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_sender_fk FOREIGN KEY (
        tenant_id,
        sender_membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT chat_messages_reply_fk FOREIGN KEY (
        tenant_id,
        reply_to_message_id
    ) REFERENCES chat.messages (tenant_id, id),
    CONSTRAINT chat_messages_sequence_uk
        UNIQUE (tenant_id, channel_id, sequence_number),
    CONSTRAINT chat_messages_client_uk
        UNIQUE (tenant_id, channel_id, client_message_id),
    CONSTRAINT chat_messages_type_ck CHECK (
        message_type IN ('text', 'file', 'image', 'audio', 'video', 'system')
    ),
    CONSTRAINT chat_messages_body_ck CHECK (
        body IS NOT NULL OR message_type = 'system'
        OR metadata <> '{}'::jsonb
    ),
    CONSTRAINT chat_messages_sequence_ck CHECK (sequence_number > 0),
    CONSTRAINT chat_messages_metadata_object_ck
        CHECK (jsonb_typeof(metadata) = 'object')
) PARTITION BY HASH (tenant_id);

CREATE TABLE chat.message_receipts (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    message_id uuid NOT NULL,
    membership_id uuid NOT NULL,
    delivered_at timestamptz,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, message_id, membership_id),
    CONSTRAINT chat_receipts_message_fk FOREIGN KEY (tenant_id, message_id)
        REFERENCES chat.messages (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT chat_receipts_membership_fk FOREIGN KEY (
        tenant_id,
        membership_id
    ) REFERENCES iam.memberships (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT chat_receipts_dates_ck CHECK (
        read_at IS NULL OR delivered_at IS NULL OR read_at >= delivered_at
    )
);

CREATE TABLE chat.attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    message_id uuid NOT NULL,
    storage_provider varchar(40) NOT NULL DEFAULT 's3',
    bucket_name varchar(255) NOT NULL,
    object_key text NOT NULL,
    original_filename varchar(255),
    content_type varchar(120),
    size_bytes bigint,
    checksum_sha256 char(64),
    scan_status varchar(20) NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chat_attachments_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT chat_attachments_message_fk FOREIGN KEY (
        tenant_id,
        message_id
    ) REFERENCES chat.messages (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT chat_attachments_object_uk
        UNIQUE (storage_provider, bucket_name, object_key),
    CONSTRAINT chat_attachments_size_ck
        CHECK (size_bytes IS NULL OR size_bytes >= 0),
    CONSTRAINT chat_attachments_checksum_ck CHECK (
        checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT chat_attachments_scan_ck CHECK (
        scan_status IN ('pending', 'clean', 'infected', 'failed', 'skipped')
    )
);

COMMIT;

BEGIN;

-- ---------------------------------------------------------------------------
-- Voice AI
-- ---------------------------------------------------------------------------

CREATE TABLE ai.voice_agents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    name varchar(160) NOT NULL,
    description text,
    language_code varchar(16) NOT NULL DEFAULT 'pt-BR',
    status varchar(20) NOT NULL DEFAULT 'draft',
    stt_provider_account_id uuid,
    llm_provider_account_id uuid,
    tts_provider_account_id uuid,
    voice_external_id varchar(255),
    greeting_text text,
    fallback_destination_id uuid,
    max_call_seconds integer NOT NULL DEFAULT 1800,
    max_cost_amount numeric(14, 6),
    currency char(3) NOT NULL DEFAULT 'USD',
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT voice_agents_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT voice_agents_name_uk UNIQUE (tenant_id, name),
    CONSTRAINT voice_agents_stt_provider_fk FOREIGN KEY (
        tenant_id,
        stt_provider_account_id
    ) REFERENCES integration.provider_accounts (tenant_id, id),
    CONSTRAINT voice_agents_llm_provider_fk FOREIGN KEY (
        tenant_id,
        llm_provider_account_id
    ) REFERENCES integration.provider_accounts (tenant_id, id),
    CONSTRAINT voice_agents_tts_provider_fk FOREIGN KEY (
        tenant_id,
        tts_provider_account_id
    ) REFERENCES integration.provider_accounts (tenant_id, id),
    CONSTRAINT voice_agents_fallback_fk FOREIGN KEY (
        tenant_id,
        fallback_destination_id
    ) REFERENCES telephony.routing_destinations (tenant_id, id),
    CONSTRAINT voice_agents_status_ck CHECK (
        status IN ('draft', 'testing', 'published', 'paused', 'archived')
    ),
    CONSTRAINT voice_agents_duration_ck
        CHECK (max_call_seconds BETWEEN 10 AND 14400),
    CONSTRAINT voice_agents_cost_ck CHECK (
        max_cost_amount IS NULL OR max_cost_amount >= 0
    ),
    CONSTRAINT voice_agents_currency_ck CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT voice_agents_settings_object_ck
        CHECK (jsonb_typeof(settings) = 'object')
);

CREATE TABLE ai.prompt_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    voice_agent_id uuid NOT NULL,
    version integer NOT NULL,
    system_prompt text NOT NULL,
    opening_prompt text,
    guardrails jsonb NOT NULL DEFAULT '{}'::jsonb,
    model_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    status varchar(20) NOT NULL DEFAULT 'draft',
    checksum_sha256 char(64) NOT NULL,
    created_by_membership_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    CONSTRAINT prompt_versions_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT prompt_versions_agent_version_uk
        UNIQUE (tenant_id, voice_agent_id, version),
    CONSTRAINT prompt_versions_agent_fk FOREIGN KEY (
        tenant_id,
        voice_agent_id
    ) REFERENCES ai.voice_agents (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT prompt_versions_created_by_fk FOREIGN KEY (
        tenant_id,
        created_by_membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT prompt_versions_version_ck CHECK (version > 0),
    CONSTRAINT prompt_versions_status_ck CHECK (
        status IN ('draft', 'testing', 'published', 'retired')
    ),
    CONSTRAINT prompt_versions_checksum_ck
        CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT prompt_versions_guardrails_object_ck
        CHECK (jsonb_typeof(guardrails) = 'object'),
    CONSTRAINT prompt_versions_model_config_object_ck
        CHECK (jsonb_typeof(model_config) = 'object')
);

CREATE TABLE ai.tools (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    name varchar(120) NOT NULL,
    description text NOT NULL,
    tool_type varchar(24) NOT NULL,
    input_schema jsonb NOT NULL,
    output_schema jsonb,
    endpoint_url text,
    secret_ref text,
    timeout_ms integer NOT NULL DEFAULT 5000,
    approval_mode varchar(20) NOT NULL DEFAULT 'automatic',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ai_tools_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT ai_tools_name_uk UNIQUE (tenant_id, name),
    CONSTRAINT ai_tools_type_ck CHECK (
        tool_type IN ('http', 'crm', 'calendar', 'transfer', 'database', 'custom')
    ),
    CONSTRAINT ai_tools_input_schema_object_ck
        CHECK (jsonb_typeof(input_schema) = 'object'),
    CONSTRAINT ai_tools_output_schema_object_ck CHECK (
        output_schema IS NULL OR jsonb_typeof(output_schema) = 'object'
    ),
    CONSTRAINT ai_tools_timeout_ck CHECK (timeout_ms BETWEEN 100 AND 30000),
    CONSTRAINT ai_tools_approval_ck CHECK (
        approval_mode IN ('automatic', 'confirm_with_caller', 'human_approval')
    ),
    CONSTRAINT ai_tools_endpoint_ck CHECK (
        endpoint_url IS NULL OR endpoint_url ~ '^https://'
    )
);

CREATE TABLE ai.agent_tools (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    voice_agent_id uuid NOT NULL,
    tool_id uuid NOT NULL,
    is_enabled boolean NOT NULL DEFAULT true,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, voice_agent_id, tool_id),
    CONSTRAINT agent_tools_agent_fk FOREIGN KEY (
        tenant_id,
        voice_agent_id
    ) REFERENCES ai.voice_agents (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT agent_tools_tool_fk FOREIGN KEY (tenant_id, tool_id)
        REFERENCES ai.tools (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT agent_tools_config_object_ck
        CHECK (jsonb_typeof(config) = 'object')
);

CREATE TABLE ai.voice_runs (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    voice_agent_id uuid NOT NULL,
    prompt_version_id uuid NOT NULL,
    call_id uuid NOT NULL,
    contact_id uuid,
    status varchar(24) NOT NULL DEFAULT 'starting',
    started_at timestamptz NOT NULL DEFAULT now(),
    first_response_at timestamptz,
    ended_at timestamptz,
    handoff_at timestamptz,
    handoff_reason varchar(120),
    input_audio_seconds numeric(12, 3) NOT NULL DEFAULT 0,
    output_audio_seconds numeric(12, 3) NOT NULL DEFAULT 0,
    input_tokens bigint NOT NULL DEFAULT 0,
    output_tokens bigint NOT NULL DEFAULT 0,
    cost_amount numeric(16, 6) NOT NULL DEFAULT 0,
    currency char(3) NOT NULL DEFAULT 'USD',
    summary text,
    outcome_code varchar(80),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT voice_runs_agent_fk FOREIGN KEY (tenant_id, voice_agent_id)
        REFERENCES ai.voice_agents (tenant_id, id),
    CONSTRAINT voice_runs_prompt_fk FOREIGN KEY (
        tenant_id,
        prompt_version_id
    ) REFERENCES ai.prompt_versions (tenant_id, id),
    CONSTRAINT voice_runs_call_fk FOREIGN KEY (tenant_id, call_id)
        REFERENCES telephony.calls (tenant_id, id),
    CONSTRAINT voice_runs_contact_fk FOREIGN KEY (tenant_id, contact_id)
        REFERENCES crm.contacts (tenant_id, id),
    CONSTRAINT voice_runs_call_uk UNIQUE (tenant_id, call_id),
    CONSTRAINT voice_runs_status_ck CHECK (
        status IN (
            'starting',
            'active',
            'handoff',
            'completed',
            'failed',
            'canceled'
        )
    ),
    CONSTRAINT voice_runs_timeline_ck CHECK (
        (first_response_at IS NULL OR first_response_at >= started_at)
        AND (handoff_at IS NULL OR handoff_at >= started_at)
        AND (ended_at IS NULL OR ended_at >= started_at)
    ),
    CONSTRAINT voice_runs_usage_ck CHECK (
        input_audio_seconds >= 0
        AND output_audio_seconds >= 0
        AND input_tokens >= 0
        AND output_tokens >= 0
        AND cost_amount >= 0
    ),
    CONSTRAINT voice_runs_currency_ck CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT voice_runs_metadata_object_ck
        CHECK (jsonb_typeof(metadata) = 'object')
) PARTITION BY HASH (tenant_id);

CREATE TABLE ai.transcript_segments (
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    voice_run_id uuid NOT NULL,
    sequence_number integer NOT NULL,
    speaker varchar(20) NOT NULL,
    text_content text NOT NULL,
    started_offset_ms integer NOT NULL,
    ended_offset_ms integer NOT NULL,
    confidence numeric(6, 5),
    is_final boolean NOT NULL DEFAULT true,
    redacted_content text,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT transcript_segments_run_fk FOREIGN KEY (
        tenant_id,
        voice_run_id
    ) REFERENCES ai.voice_runs (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT transcript_segments_sequence_uk
        UNIQUE (tenant_id, voice_run_id, sequence_number),
    CONSTRAINT transcript_segments_speaker_ck CHECK (
        speaker IN ('caller', 'agent', 'system', 'tool')
    ),
    CONSTRAINT transcript_segments_offset_ck CHECK (
        started_offset_ms >= 0 AND ended_offset_ms >= started_offset_ms
    ),
    CONSTRAINT transcript_segments_confidence_ck CHECK (
        confidence IS NULL OR confidence BETWEEN 0 AND 1
    )
) PARTITION BY HASH (tenant_id);

CREATE TABLE ai.tool_executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    voice_run_id uuid NOT NULL,
    tool_id uuid NOT NULL,
    sequence_number integer NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'requested',
    input_payload jsonb NOT NULL,
    output_payload jsonb,
    error_code varchar(80),
    error_message text,
    requested_at timestamptz NOT NULL DEFAULT now(),
    approved_at timestamptz,
    completed_at timestamptz,
    duration_ms integer,
    CONSTRAINT tool_executions_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT tool_executions_run_fk FOREIGN KEY (
        tenant_id,
        voice_run_id
    ) REFERENCES ai.voice_runs (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT tool_executions_tool_fk FOREIGN KEY (tenant_id, tool_id)
        REFERENCES ai.tools (tenant_id, id),
    CONSTRAINT tool_executions_sequence_uk
        UNIQUE (tenant_id, voice_run_id, sequence_number),
    CONSTRAINT tool_executions_status_ck CHECK (
        status IN ('requested', 'awaiting_approval', 'running', 'succeeded', 'failed', 'denied')
    ),
    CONSTRAINT tool_executions_input_object_ck
        CHECK (jsonb_typeof(input_payload) = 'object'),
    CONSTRAINT tool_executions_output_object_ck CHECK (
        output_payload IS NULL OR jsonb_typeof(output_payload) = 'object'
    ),
    CONSTRAINT tool_executions_duration_ck
        CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

CREATE TABLE ai.run_evaluations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    voice_run_id uuid NOT NULL,
    evaluator_type varchar(20) NOT NULL,
    evaluator_membership_id uuid,
    score numeric(6, 3),
    rubric_version varchar(40),
    result jsonb NOT NULL DEFAULT '{}'::jsonb,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT run_evaluations_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT run_evaluations_run_fk FOREIGN KEY (
        tenant_id,
        voice_run_id
    ) REFERENCES ai.voice_runs (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT run_evaluations_evaluator_fk FOREIGN KEY (
        tenant_id,
        evaluator_membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT run_evaluations_type_ck CHECK (
        evaluator_type IN ('automatic', 'human', 'customer')
    ),
    CONSTRAINT run_evaluations_score_ck CHECK (
        score IS NULL OR score BETWEEN 0 AND 100
    ),
    CONSTRAINT run_evaluations_result_object_ck
        CHECK (jsonb_typeof(result) = 'object')
);

-- ---------------------------------------------------------------------------
-- Reporting
-- ---------------------------------------------------------------------------

CREATE TABLE reporting.report_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES core.tenants(id) ON DELETE CASCADE,
    code varchar(100) NOT NULL,
    name varchar(160) NOT NULL,
    description text,
    module varchar(60) NOT NULL,
    query_key varchar(120) NOT NULL,
    default_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
    allowed_formats text[] NOT NULL DEFAULT ARRAY['csv']::text[],
    is_system boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT report_definitions_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT report_definitions_filters_object_ck
        CHECK (jsonb_typeof(default_filters) = 'object')
);

CREATE UNIQUE INDEX report_definitions_platform_code_uq
    ON reporting.report_definitions (code)
    WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX report_definitions_tenant_code_uq
    ON reporting.report_definitions (tenant_id, code)
    WHERE tenant_id IS NOT NULL;

CREATE TABLE reporting.report_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    report_definition_id uuid NOT NULL,
    name varchar(160) NOT NULL,
    cron_expression varchar(120) NOT NULL,
    timezone varchar(64) NOT NULL,
    filters jsonb NOT NULL DEFAULT '{}'::jsonb,
    output_format varchar(20) NOT NULL DEFAULT 'csv',
    recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    last_run_at timestamptz,
    next_run_at timestamptz,
    created_by_membership_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT report_schedules_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT report_schedules_name_uk UNIQUE (tenant_id, name),
    CONSTRAINT report_schedules_definition_fk FOREIGN KEY (
        tenant_id,
        report_definition_id
    ) REFERENCES reporting.report_definitions (tenant_id, id),
    CONSTRAINT report_schedules_created_by_fk FOREIGN KEY (
        tenant_id,
        created_by_membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT report_schedules_format_ck CHECK (
        output_format IN ('csv', 'xlsx', 'pdf', 'json')
    ),
    CONSTRAINT report_schedules_filters_object_ck
        CHECK (jsonb_typeof(filters) = 'object'),
    CONSTRAINT report_schedules_recipients_array_ck
        CHECK (jsonb_typeof(recipients) = 'array')
);

CREATE TABLE reporting.export_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    report_definition_id uuid NOT NULL,
    report_schedule_id uuid,
    requested_by_membership_id uuid,
    output_format varchar(20) NOT NULL,
    filters jsonb NOT NULL DEFAULT '{}'::jsonb,
    status varchar(20) NOT NULL DEFAULT 'pending',
    progress_percent numeric(5, 2) NOT NULL DEFAULT 0,
    row_count bigint,
    storage_provider varchar(40),
    bucket_name varchar(255),
    object_key text,
    expires_at timestamptz,
    started_at timestamptz,
    completed_at timestamptz,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT export_jobs_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT export_jobs_definition_fk FOREIGN KEY (
        tenant_id,
        report_definition_id
    ) REFERENCES reporting.report_definitions (tenant_id, id),
    CONSTRAINT export_jobs_schedule_fk FOREIGN KEY (
        tenant_id,
        report_schedule_id
    ) REFERENCES reporting.report_schedules (tenant_id, id),
    CONSTRAINT export_jobs_requested_by_fk FOREIGN KEY (
        tenant_id,
        requested_by_membership_id
    ) REFERENCES iam.memberships (tenant_id, id),
    CONSTRAINT export_jobs_format_ck CHECK (
        output_format IN ('csv', 'xlsx', 'pdf', 'json')
    ),
    CONSTRAINT export_jobs_status_ck CHECK (
        status IN ('pending', 'running', 'completed', 'failed', 'expired', 'canceled')
    ),
    CONSTRAINT export_jobs_progress_ck
        CHECK (progress_percent BETWEEN 0 AND 100),
    CONSTRAINT export_jobs_row_count_ck CHECK (row_count IS NULL OR row_count >= 0),
    CONSTRAINT export_jobs_storage_ck CHECK (
        (status <> 'completed')
        OR (storage_provider IS NOT NULL AND bucket_name IS NOT NULL AND object_key IS NOT NULL)
    ),
    CONSTRAINT export_jobs_filters_object_ck
        CHECK (jsonb_typeof(filters) = 'object')
);

CREATE TABLE reporting.metric_snapshots (
    bucket_at timestamptz NOT NULL,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    metric_name varchar(120) NOT NULL,
    dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
    dimension_hash char(64) NOT NULL,
    metric_value numeric(24, 8) NOT NULL,
    sample_count bigint NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (bucket_at, id),
    CONSTRAINT metric_snapshots_sample_count_ck CHECK (sample_count > 0),
    CONSTRAINT metric_snapshots_hash_ck
        CHECK (dimension_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT metric_snapshots_dimensions_object_ck
        CHECK (jsonb_typeof(dimensions) = 'object')
) PARTITION BY RANGE (bucket_at);

-- ---------------------------------------------------------------------------
-- Eventing: transactional outbox, inbox and webhook deliveries
-- ---------------------------------------------------------------------------

CREATE TABLE eventing.outbox_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES core.tenants(id) ON DELETE CASCADE,
    aggregate_type varchar(100) NOT NULL,
    aggregate_id uuid NOT NULL,
    event_type varchar(180) NOT NULL,
    event_version integer NOT NULL DEFAULT 1,
    payload jsonb NOT NULL,
    headers jsonb NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key varchar(255),
    correlation_id varchar(120),
    causation_id uuid,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    available_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    attempt_count integer NOT NULL DEFAULT 0,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT outbox_events_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT outbox_events_version_ck CHECK (event_version > 0),
    CONSTRAINT outbox_events_attempts_ck CHECK (attempt_count >= 0),
    CONSTRAINT outbox_events_payload_object_ck
        CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT outbox_events_headers_object_ck
        CHECK (jsonb_typeof(headers) = 'object')
);

CREATE UNIQUE INDEX outbox_events_idempotency_uq
    ON eventing.outbox_events (tenant_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX outbox_events_publish_idx
    ON eventing.outbox_events (available_at, occurred_at, id)
    WHERE published_at IS NULL;

CREATE TABLE eventing.inbox_messages (
    consumer_name varchar(120) NOT NULL,
    message_id uuid NOT NULL,
    tenant_id uuid REFERENCES core.tenants(id) ON DELETE CASCADE,
    event_type varchar(180) NOT NULL,
    payload_hash char(64),
    received_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    status varchar(20) NOT NULL DEFAULT 'received',
    error_message text,
    expires_at timestamptz,
    PRIMARY KEY (consumer_name, message_id),
    CONSTRAINT inbox_messages_status_ck CHECK (
        status IN ('received', 'processing', 'processed', 'failed', 'dead_letter')
    ),
    CONSTRAINT inbox_messages_hash_ck CHECK (
        payload_hash IS NULL OR payload_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT inbox_messages_expiry_ck CHECK (
        expires_at IS NULL OR expires_at > received_at
    )
);

CREATE TABLE eventing.webhook_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    webhook_endpoint_id uuid NOT NULL,
    outbox_event_id uuid NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending',
    attempt_count integer NOT NULL DEFAULT 0,
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    request_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
    response_status integer,
    response_body_excerpt text,
    duration_ms integer,
    delivered_at timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT webhook_deliveries_tenant_id_id_uk UNIQUE (tenant_id, id),
    CONSTRAINT webhook_deliveries_endpoint_fk FOREIGN KEY (
        tenant_id,
        webhook_endpoint_id
    ) REFERENCES integration.webhook_endpoints (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT webhook_deliveries_outbox_fk FOREIGN KEY (
        tenant_id,
        outbox_event_id
    ) REFERENCES eventing.outbox_events (tenant_id, id),
    CONSTRAINT webhook_deliveries_event_uk
        UNIQUE (webhook_endpoint_id, outbox_event_id),
    CONSTRAINT webhook_deliveries_status_ck CHECK (
        status IN ('pending', 'delivering', 'delivered', 'failed', 'dead_letter')
    ),
    CONSTRAINT webhook_deliveries_attempts_ck CHECK (attempt_count >= 0),
    CONSTRAINT webhook_deliveries_response_ck CHECK (
        response_status IS NULL OR response_status BETWEEN 100 AND 599
    ),
    CONSTRAINT webhook_deliveries_duration_ck
        CHECK (duration_ms IS NULL OR duration_ms >= 0),
    CONSTRAINT webhook_deliveries_headers_object_ck
        CHECK (jsonb_typeof(request_headers) = 'object')
);

CREATE INDEX webhook_deliveries_claim_idx
    ON eventing.webhook_deliveries (status, next_attempt_at, id)
    WHERE status IN ('pending', 'failed');

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

CREATE TABLE audit.audit_events (
    occurred_at timestamptz NOT NULL DEFAULT now(),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid,
    actor_user_id uuid,
    actor_membership_id uuid,
    actor_type varchar(20) NOT NULL DEFAULT 'user',
    action varchar(120) NOT NULL,
    schema_name name,
    table_name name,
    record_id text,
    old_data jsonb,
    new_data jsonb,
    changed_fields text[],
    ip_address inet,
    user_agent text,
    correlation_id varchar(120),
    trace_id varchar(64),
    request_method varchar(12),
    request_path text,
    result varchar(20) NOT NULL DEFAULT 'success',
    reason text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (occurred_at, id),
    CONSTRAINT audit_events_actor_type_ck CHECK (
        actor_type IN ('user', 'service', 'support', 'system')
    ),
    CONSTRAINT audit_events_result_ck CHECK (
        result IN ('success', 'denied', 'failed')
    ),
    CONSTRAINT audit_events_metadata_object_ck
        CHECK (jsonb_typeof(metadata) = 'object')
) PARTITION BY RANGE (occurred_at);

CREATE OR REPLACE FUNCTION audit.redact_sensitive(p_data jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT CASE
        WHEN p_data IS NULL THEN NULL
        ELSE p_data - ARRAY[
            'password',
            'password_hash',
            'secret',
            'secret_hash',
            'secret_ref',
            'session_token_hash',
            'verification_token_hash',
            'sip_secret_ref',
            'voicemail_pin_hash',
            'auth_secret_ref',
            'encryption_key_ref',
            'push_token_ref'
        ]::text[]
    END
$$;

CREATE OR REPLACE FUNCTION audit.capture_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, audit, core
AS $$
DECLARE
    v_old jsonb;
    v_new jsonb;
    v_tenant_id uuid;
    v_record_id text;
    v_changed_fields text[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_new := audit.redact_sensitive(to_jsonb(NEW));
        v_tenant_id := NULLIF(v_new ->> 'tenant_id', '')::uuid;
        v_record_id := COALESCE(v_new ->> 'id', v_new ->> 'tenant_id');
    ELSIF TG_OP = 'UPDATE' THEN
        v_old := audit.redact_sensitive(to_jsonb(OLD));
        v_new := audit.redact_sensitive(to_jsonb(NEW));
        v_tenant_id := COALESCE(
            NULLIF(v_new ->> 'tenant_id', '')::uuid,
            NULLIF(v_old ->> 'tenant_id', '')::uuid
        );
        v_record_id := COALESCE(
            v_new ->> 'id',
            v_old ->> 'id',
            v_new ->> 'tenant_id',
            v_old ->> 'tenant_id'
        );

        SELECT array_agg(key ORDER BY key)
        INTO v_changed_fields
        FROM (
            SELECT key
            FROM jsonb_each(v_old)
            UNION
            SELECT key
            FROM jsonb_each(v_new)
        ) fields
        WHERE v_old -> key IS DISTINCT FROM v_new -> key;
    ELSE
        v_old := audit.redact_sensitive(to_jsonb(OLD));
        v_tenant_id := NULLIF(v_old ->> 'tenant_id', '')::uuid;
        v_record_id := COALESCE(v_old ->> 'id', v_old ->> 'tenant_id');
    END IF;

    IF TG_TABLE_SCHEMA = 'core' AND TG_TABLE_NAME = 'tenants' THEN
        v_tenant_id := COALESCE(
            NULLIF(v_new ->> 'id', '')::uuid,
            NULLIF(v_old ->> 'id', '')::uuid
        );
    END IF;

    INSERT INTO audit.audit_events (
        tenant_id,
        actor_user_id,
        actor_membership_id,
        actor_type,
        action,
        schema_name,
        table_name,
        record_id,
        old_data,
        new_data,
        changed_fields,
        correlation_id
    )
    VALUES (
        COALESCE(v_tenant_id, core.current_tenant_id()),
        core.current_user_id(),
        core.current_membership_id(),
        CASE WHEN core.current_user_id() IS NULL THEN 'system' ELSE 'user' END,
        lower(TG_OP),
        TG_TABLE_SCHEMA,
        TG_TABLE_NAME,
        v_record_id,
        v_old,
        v_new,
        v_changed_fields,
        core.current_correlation_id()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;

BEGIN;

-- ---------------------------------------------------------------------------
-- Partition management
-- ---------------------------------------------------------------------------

CREATE OR REPLACE PROCEDURE core.ensure_hash_partitions(
    p_parent regclass,
    p_partition_schema text,
    p_partition_prefix text,
    p_modulus integer DEFAULT 32
)
LANGUAGE plpgsql
AS $$
DECLARE
    i integer;
BEGIN
    IF p_modulus < 1 OR p_modulus > 256 THEN
        RAISE EXCEPTION 'Invalid hash partition modulus: %', p_modulus;
    END IF;

    FOR i IN 0..(p_modulus - 1) LOOP
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I.%I PARTITION OF %s
             FOR VALUES WITH (MODULUS %s, REMAINDER %s)',
            p_partition_schema,
            p_partition_prefix || i,
            p_parent,
            p_modulus,
            i
        );
    END LOOP;
END;
$$;

CREATE OR REPLACE PROCEDURE core.ensure_monthly_partitions(
    p_parent regclass,
    p_partition_schema text,
    p_partition_prefix text,
    p_start_month date,
    p_month_count integer
)
LANGUAGE plpgsql
AS $$
DECLARE
    i integer;
    v_from date;
    v_to date;
    v_name text;
BEGIN
    IF p_month_count < 1 OR p_month_count > 120 THEN
        RAISE EXCEPTION 'Invalid month count: %', p_month_count;
    END IF;

    FOR i IN 0..(p_month_count - 1) LOOP
        v_from := (
            date_trunc('month', p_start_month)::date
            + make_interval(months => i)
        )::date;
        v_to := (v_from + interval '1 month')::date;
        v_name := p_partition_prefix || to_char(v_from, 'YYYYMM');

        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I.%I PARTITION OF %s
             FOR VALUES FROM (%L) TO (%L)',
            p_partition_schema,
            v_name,
            p_parent,
            v_from,
            v_to
        );
    END LOOP;
END;
$$;

CALL core.ensure_hash_partitions(
    'telephony.calls',
    'telephony',
    'calls_p',
    32
);
CALL core.ensure_hash_partitions(
    'omnichannel.conversations',
    'omnichannel',
    'conversations_p',
    32
);
CALL core.ensure_hash_partitions(
    'omnichannel.messages',
    'omnichannel',
    'messages_p',
    32
);
CALL core.ensure_hash_partitions(
    'chat.channels',
    'chat',
    'channels_p',
    32
);
CALL core.ensure_hash_partitions(
    'chat.messages',
    'chat',
    'messages_p',
    32
);
CALL core.ensure_hash_partitions(
    'ai.voice_runs',
    'ai',
    'voice_runs_p',
    32
);
CALL core.ensure_hash_partitions(
    'ai.transcript_segments',
    'ai',
    'transcript_segments_p',
    32
);

CALL core.ensure_monthly_partitions(
    'callcenter.agent_state_history',
    'callcenter',
    'agent_state_history_y',
    (date_trunc('month', current_date) - interval '1 month')::date,
    15
);
CALL core.ensure_monthly_partitions(
    'telephony.call_events',
    'telephony',
    'call_events_y',
    (date_trunc('month', current_date) - interval '1 month')::date,
    15
);
CALL core.ensure_monthly_partitions(
    'omnichannel.webhook_events',
    'omnichannel',
    'webhook_events_y',
    (date_trunc('month', current_date) - interval '1 month')::date,
    15
);
CALL core.ensure_monthly_partitions(
    'reporting.metric_snapshots',
    'reporting',
    'metric_snapshots_y',
    (date_trunc('month', current_date) - interval '1 month')::date,
    15
);
CALL core.ensure_monthly_partitions(
    'audit.audit_events',
    'audit',
    'audit_events_y',
    (date_trunc('month', current_date) - interval '1 month')::date,
    15
);

CREATE TABLE callcenter.agent_state_history_default
    PARTITION OF callcenter.agent_state_history DEFAULT;
CREATE TABLE telephony.call_events_default
    PARTITION OF telephony.call_events DEFAULT;
CREATE TABLE omnichannel.webhook_events_default
    PARTITION OF omnichannel.webhook_events DEFAULT;
CREATE TABLE reporting.metric_snapshots_default
    PARTITION OF reporting.metric_snapshots DEFAULT;
CREATE TABLE audit.audit_events_default
    PARTITION OF audit.audit_events DEFAULT;

-- ---------------------------------------------------------------------------
-- Performance indexes
-- ---------------------------------------------------------------------------

CREATE INDEX cells_region_status_idx
    ON core.cells (region_id, status);
CREATE INDEX tenants_status_region_idx
    ON core.tenants (status, region_id, cell_id);
CREATE INDEX tenants_trade_name_trgm_idx
    ON core.tenants USING gin (trade_name gin_trgm_ops);
CREATE INDEX tenant_domains_tenant_idx
    ON core.tenant_domains (tenant_id, verification_status);

CREATE INDEX users_status_idx
    ON iam.users (status) WHERE deleted_at IS NULL;
CREATE INDEX users_display_name_trgm_idx
    ON iam.users USING gin (display_name gin_trgm_ops);
CREATE INDEX user_sessions_user_active_idx
    ON iam.user_sessions (user_id, expires_at DESC)
    WHERE revoked_at IS NULL;
CREATE INDEX memberships_user_status_idx
    ON iam.memberships (user_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX memberships_tenant_status_idx
    ON iam.memberships (tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX membership_roles_membership_idx
    ON iam.membership_roles (tenant_id, membership_id, expires_at);

CREATE INDEX subscriptions_status_period_idx
    ON billing.subscriptions (status, current_period_end);
CREATE INDEX licenses_tenant_feature_status_idx
    ON billing.licenses (tenant_id, feature_id, status);
CREATE INDEX usage_counters_period_idx
    ON billing.usage_counters (tenant_id, period_start DESC);

CREATE INDEX provider_accounts_type_status_idx
    ON integration.provider_accounts (tenant_id, provider_type, status);
CREATE INDEX external_bindings_sync_idx
    ON integration.external_bindings (tenant_id, sync_status, updated_at);

CREATE INDEX crm_accounts_name_trgm_idx
    ON crm.accounts USING gin (name gin_trgm_ops);
CREATE INDEX crm_contacts_name_trgm_idx
    ON crm.contacts USING gin (display_name gin_trgm_ops);
CREATE INDEX crm_contacts_account_idx
    ON crm.contacts (tenant_id, account_id, updated_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX contact_channels_contact_idx
    ON crm.contact_channels (tenant_id, contact_id, channel_type);
CREATE INDEX crm_deals_pipeline_stage_idx
    ON crm.deals (tenant_id, pipeline_id, stage_id, updated_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX crm_deals_owner_status_idx
    ON crm.deals (tenant_id, owner_membership_id, status);
CREATE INDEX crm_activities_due_idx
    ON crm.activities (tenant_id, assigned_membership_id, status, due_at);

CREATE INDEX extensions_status_number_idx
    ON telephony.extensions (tenant_id, status, extension_number)
    WHERE deleted_at IS NULL;
CREATE INDEX extension_devices_registration_idx
    ON telephony.extension_devices (tenant_id, extension_id, last_registered_at DESC);
CREATE INDEX sip_trunks_status_idx
    ON telephony.sip_trunks (tenant_id, status, failover_priority)
    WHERE deleted_at IS NULL;
CREATE INDEX inbound_routes_match_idx
    ON telephony.inbound_routes (tenant_id, enabled, priority);
CREATE INDEX outbound_routes_priority_idx
    ON telephony.outbound_routes (tenant_id, enabled, priority);
CREATE INDEX calls_started_idx
    ON telephony.calls (tenant_id, started_at DESC);
CREATE INDEX calls_status_started_idx
    ON telephony.calls (tenant_id, status, started_at DESC);
CREATE INDEX calls_from_number_idx
    ON telephony.calls (tenant_id, from_number, started_at DESC);
CREATE INDEX calls_to_number_idx
    ON telephony.calls (tenant_id, to_number, started_at DESC);
CREATE INDEX calls_contact_idx
    ON telephony.calls (tenant_id, contact_id, started_at DESC)
    WHERE contact_id IS NOT NULL;
CREATE INDEX calls_queue_idx
    ON telephony.calls (tenant_id, queue_id, started_at DESC)
    WHERE queue_id IS NOT NULL;
CREATE INDEX call_legs_call_idx
    ON telephony.call_legs (tenant_id, call_id, sequence_number);
CREATE INDEX call_events_call_time_idx
    ON telephony.call_events (tenant_id, call_id, event_at);
CREATE INDEX call_events_type_time_idx
    ON telephony.call_events (tenant_id, event_type, event_at DESC);
CREATE INDEX call_events_time_brin_idx
    ON telephony.call_events USING brin (event_at);
CREATE INDEX recordings_call_idx
    ON telephony.recordings (tenant_id, call_id, created_at);
CREATE INDEX recordings_retention_idx
    ON telephony.recordings (retention_until)
    WHERE deleted_at IS NULL AND NOT legal_hold;
CREATE INDEX voicemail_extension_created_idx
    ON telephony.voicemail_messages (tenant_id, extension_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX agents_status_idx
    ON callcenter.agents (tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX queue_agents_agent_idx
    ON callcenter.queue_agents (tenant_id, agent_id, is_active);
CREATE INDEX agent_state_history_agent_time_idx
    ON callcenter.agent_state_history (tenant_id, agent_id, changed_at DESC);
CREATE INDEX agent_state_history_time_brin_idx
    ON callcenter.agent_state_history USING brin (changed_at);
CREATE INDEX campaign_contacts_claim_idx
    ON callcenter.campaign_contacts (
        tenant_id,
        campaign_id,
        status,
        next_attempt_at
    );
CREATE INDEX queue_interactions_queue_time_idx
    ON callcenter.queue_interactions (tenant_id, queue_id, enqueued_at DESC);
CREATE INDEX queue_interactions_agent_time_idx
    ON callcenter.queue_interactions (tenant_id, agent_id, enqueued_at DESC)
    WHERE agent_id IS NOT NULL;

CREATE INDEX conversations_queue_status_idx
    ON omnichannel.conversations (
        tenant_id,
        queue_id,
        status,
        priority,
        waiting_since
    );
CREATE INDEX conversations_agent_status_idx
    ON omnichannel.conversations (
        tenant_id,
        assigned_agent_id,
        status,
        last_message_at DESC
    );
CREATE INDEX conversations_contact_idx
    ON omnichannel.conversations (tenant_id, contact_id, last_message_at DESC);
CREATE INDEX omnichannel_messages_conversation_idx
    ON omnichannel.messages (tenant_id, conversation_id, created_at, id);
CREATE INDEX omnichannel_messages_provider_id_idx
    ON omnichannel.messages (
        tenant_id,
        provider_account_id,
        provider_message_id
    )
    WHERE provider_message_id IS NOT NULL;
CREATE INDEX omnichannel_messages_status_idx
    ON omnichannel.messages (tenant_id, status, created_at)
    WHERE status IN ('pending', 'queued', 'failed');
CREATE INDEX omnichannel_messages_search_idx
    ON omnichannel.messages USING gin (
        to_tsvector('simple', COALESCE(text_body, ''))
    );
CREATE INDEX webhook_events_time_brin_idx
    ON omnichannel.webhook_events USING brin (received_at);
CREATE INDEX webhook_events_processing_idx
    ON omnichannel.webhook_events (
        processing_status,
        received_at
    ) WHERE processing_status IN ('received', 'validated', 'failed');

CREATE INDEX channel_members_membership_idx
    ON chat.channel_members (tenant_id, membership_id, left_at);
CREATE INDEX chat_messages_channel_idx
    ON chat.messages (tenant_id, channel_id, sequence_number DESC);
CREATE INDEX chat_messages_search_idx
    ON chat.messages USING gin (
        to_tsvector('simple', COALESCE(body, ''))
    );
CREATE INDEX chat_receipts_member_unread_idx
    ON chat.message_receipts (tenant_id, membership_id, read_at)
    WHERE read_at IS NULL;

CREATE INDEX voice_runs_agent_time_idx
    ON ai.voice_runs (tenant_id, voice_agent_id, started_at DESC);
CREATE INDEX voice_runs_status_idx
    ON ai.voice_runs (tenant_id, status, started_at DESC);
CREATE INDEX transcript_segments_run_idx
    ON ai.transcript_segments (tenant_id, voice_run_id, sequence_number);
CREATE INDEX tool_executions_run_idx
    ON ai.tool_executions (tenant_id, voice_run_id, sequence_number);

CREATE INDEX export_jobs_claim_idx
    ON reporting.export_jobs (status, created_at, id)
    WHERE status = 'pending';
CREATE INDEX metric_snapshots_lookup_idx
    ON reporting.metric_snapshots (
        tenant_id,
        metric_name,
        dimension_hash,
        bucket_at DESC
    );
CREATE INDEX metric_snapshots_time_brin_idx
    ON reporting.metric_snapshots USING brin (bucket_at);

CREATE INDEX inbox_messages_cleanup_idx
    ON eventing.inbox_messages (expires_at)
    WHERE expires_at IS NOT NULL;
CREATE INDEX audit_events_tenant_time_idx
    ON audit.audit_events (tenant_id, occurred_at DESC);
CREATE INDEX audit_events_actor_time_idx
    ON audit.audit_events (actor_user_id, occurred_at DESC)
    WHERE actor_user_id IS NOT NULL;
CREATE INDEX audit_events_record_idx
    ON audit.audit_events (
        tenant_id,
        schema_name,
        table_name,
        record_id,
        occurred_at DESC
    );
CREATE INDEX audit_events_time_brin_idx
    ON audit.audit_events USING brin (occurred_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT n.nspname AS schema_name, c.relname AS table_name
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname IN (
            'core',
            'iam',
            'billing',
            'telephony',
            'callcenter',
            'crm',
            'omnichannel',
            'chat',
            'ai',
            'reporting',
            'integration',
            'eventing'
        )
          AND c.relkind IN ('r', 'p')
          AND NOT c.relispartition
          AND a.attname = 'updated_at'
          AND NOT a.attisdropped
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS set_updated_at ON %I.%I',
            r.schema_name,
            r.table_name
        );
        EXECUTE format(
            'CREATE TRIGGER set_updated_at
             BEFORE UPDATE ON %I.%I
             FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()',
            r.schema_name,
            r.table_name
        );
    END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Audit triggers for configuration and privileged business entities
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    v_table regclass;
BEGIN
    FOREACH v_table IN ARRAY ARRAY[
        'core.tenants'::regclass,
        'core.tenant_domains'::regclass,
        'core.tenant_branding'::regclass,
        'iam.memberships'::regclass,
        'iam.roles'::regclass,
        'iam.membership_roles'::regclass,
        'billing.subscriptions'::regclass,
        'billing.licenses'::regclass,
        'integration.provider_accounts'::regclass,
        'integration.external_bindings'::regclass,
        'crm.accounts'::regclass,
        'crm.contacts'::regclass,
        'crm.deals'::regclass,
        'telephony.extensions'::regclass,
        'telephony.sip_trunks'::regclass,
        'telephony.inbound_routes'::regclass,
        'telephony.outbound_routes'::regclass,
        'telephony.ivrs'::regclass,
        'telephony.ring_groups'::regclass,
        'telephony.pickup_groups'::regclass,
        'callcenter.agents'::regclass,
        'callcenter.queues'::regclass,
        'callcenter.campaigns'::regclass,
        'omnichannel.whatsapp_accounts'::regclass,
        'omnichannel.whatsapp_numbers'::regclass,
        'omnichannel.whatsapp_templates'::regclass,
        'ai.voice_agents'::regclass,
        'ai.prompt_versions'::regclass,
        'ai.tools'::regclass,
        'reporting.report_schedules'::regclass
    ]
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS audit_row_change ON %s', v_table);
        EXECUTE format(
            'CREATE TRIGGER audit_row_change
             AFTER INSERT OR UPDATE OR DELETE ON %s
             FOR EACH ROW EXECUTE FUNCTION audit.capture_row_change()',
            v_table
        );
    END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT DISTINCT n.nspname AS schema_name, c.relname AS table_name
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname IN (
            'core',
            'iam',
            'billing',
            'telephony',
            'callcenter',
            'crm',
            'omnichannel',
            'chat',
            'ai',
            'reporting',
            'integration',
            'eventing',
            'audit'
        )
          AND c.relkind IN ('r', 'p')
          AND NOT c.relispartition
          AND a.attname = 'tenant_id'
          AND NOT a.attisdropped
          AND NOT (
              n.nspname = 'core'
              AND c.relname IN ('tenant_domains', 'tenant_branding')
          )
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
            r.schema_name,
            r.table_name
        );
        EXECUTE format(
            'ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',
            r.schema_name,
            r.table_name
        );
        EXECUTE format(
            'DROP POLICY IF EXISTS tenant_isolation ON %I.%I',
            r.schema_name,
            r.table_name
        );
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I.%I
             USING (tenant_id = core.current_tenant_id())
             WITH CHECK (tenant_id = core.current_tenant_id())',
            r.schema_name,
            r.table_name
        );
    END LOOP;
END;
$$;

-- The SECURITY DEFINER audit trigger is owned by the migration owner.
-- Runtime roles are still subject to RLS, while the owner may append audit rows.
ALTER TABLE audit.audit_events NO FORCE ROW LEVEL SECURITY;

-- A user may list their own memberships before selecting the active tenant.
CREATE POLICY membership_self_lookup
    ON iam.memberships
    FOR SELECT
    USING (user_id = core.current_user_id());

-- A user may inspect and revoke their own sessions.
CREATE POLICY user_session_self_access
    ON iam.user_sessions
    USING (user_id = core.current_user_id())
    WITH CHECK (user_id = core.current_user_id());

-- Trigger-based system auditing may run before a tenant context exists.
CREATE POLICY audit_system_insert
    ON audit.audit_events
    FOR INSERT
    WITH CHECK (core.current_user_id() IS NULL);

-- ---------------------------------------------------------------------------
-- Limited public views
-- Direct table privileges must be revoked from application roles.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW core.public_tenant_branding
WITH (security_barrier = true)
AS
SELECT
    d.hostname,
    d.tenant_id,
    b.product_name,
    b.logo_light_object_key,
    b.logo_dark_object_key,
    b.favicon_object_key,
    b.primary_color,
    b.secondary_color,
    b.support_email,
    b.support_url
FROM core.tenant_domains d
JOIN core.tenant_branding b ON b.tenant_id = d.tenant_id
JOIN core.tenants t ON t.id = d.tenant_id
WHERE d.verification_status = 'verified'
  AND t.status = 'active';

COMMIT;
