-- Reference data for the UCaaS + CCaaS platform.
-- Run after schema.sql using the migration owner.

BEGIN;

INSERT INTO iam.permissions (code, module, resource, action, description)
VALUES
    ('tenant.view', 'tenancy', 'tenant', 'view', 'View tenant settings'),
    ('tenant.manage', 'tenancy', 'tenant', 'manage', 'Manage tenant settings'),
    ('branding.manage', 'tenancy', 'branding', 'manage', 'Manage white label'),
    ('users.view', 'iam', 'users', 'view', 'View users'),
    ('users.manage', 'iam', 'users', 'manage', 'Manage users'),
    ('roles.view', 'iam', 'roles', 'view', 'View roles'),
    ('roles.manage', 'iam', 'roles', 'manage', 'Manage roles and permissions'),
    ('billing.view', 'billing', 'billing', 'view', 'View plan and usage'),
    ('billing.manage', 'billing', 'billing', 'manage', 'Manage subscription'),
    ('licenses.view', 'billing', 'licenses', 'view', 'View licenses'),
    ('licenses.manage', 'billing', 'licenses', 'manage', 'Assign licenses'),
    ('extensions.view', 'telephony', 'extensions', 'view', 'View extensions'),
    ('extensions.manage', 'telephony', 'extensions', 'manage', 'Manage extensions'),
    ('trunks.view', 'telephony', 'trunks', 'view', 'View SIP trunks'),
    ('trunks.manage', 'telephony', 'trunks', 'manage', 'Manage SIP trunks'),
    ('routes.view', 'telephony', 'routes', 'view', 'View call routes'),
    ('routes.manage', 'telephony', 'routes', 'manage', 'Manage call routes'),
    ('ivr.view', 'telephony', 'ivr', 'view', 'View IVRs'),
    ('ivr.manage', 'telephony', 'ivr', 'manage', 'Manage IVRs'),
    ('webphone.use', 'telephony', 'webphone', 'use', 'Use WebRTC webphone'),
    ('calls.view', 'telephony', 'calls', 'view', 'View calls'),
    ('calls.make', 'telephony', 'calls', 'make', 'Make calls'),
    ('recordings.view', 'telephony', 'recordings', 'view', 'View recordings'),
    ('recordings.manage', 'telephony', 'recordings', 'manage', 'Manage retention'),
    ('queues.view', 'callcenter', 'queues', 'view', 'View queues'),
    ('queues.manage', 'callcenter', 'queues', 'manage', 'Manage queues'),
    ('agents.view', 'callcenter', 'agents', 'view', 'View agents'),
    ('agents.manage', 'callcenter', 'agents', 'manage', 'Manage agents'),
    ('supervision.use', 'callcenter', 'supervision', 'use', 'Use supervision'),
    ('campaigns.view', 'callcenter', 'campaigns', 'view', 'View campaigns'),
    ('campaigns.manage', 'callcenter', 'campaigns', 'manage', 'Manage campaigns'),
    ('contacts.view', 'crm', 'contacts', 'view', 'View contacts'),
    ('contacts.manage', 'crm', 'contacts', 'manage', 'Manage contacts'),
    ('crm.view', 'crm', 'crm', 'view', 'View CRM'),
    ('crm.manage', 'crm', 'crm', 'manage', 'Manage CRM'),
    ('omnichannel.view', 'omnichannel', 'conversations', 'view', 'View conversations'),
    ('omnichannel.handle', 'omnichannel', 'conversations', 'handle', 'Handle conversations'),
    ('omnichannel.manage', 'omnichannel', 'settings', 'manage', 'Manage channels'),
    ('whatsapp.manage', 'omnichannel', 'whatsapp', 'manage', 'Manage WhatsApp'),
    ('chat.use', 'chat', 'chat', 'use', 'Use corporate chat'),
    ('chat.manage', 'chat', 'chat', 'manage', 'Manage chat channels'),
    ('voice-ai.view', 'ai', 'voice-ai', 'view', 'View voice AI agents'),
    ('voice-ai.manage', 'ai', 'voice-ai', 'manage', 'Manage voice AI agents'),
    ('reports.view', 'reporting', 'reports', 'view', 'View reports'),
    ('reports.export', 'reporting', 'reports', 'export', 'Export reports'),
    ('reports.manage', 'reporting', 'reports', 'manage', 'Manage report schedules'),
    ('audit.view', 'audit', 'audit', 'view', 'View audit trail'),
    ('integrations.view', 'integration', 'integrations', 'view', 'View integrations'),
    ('integrations.manage', 'integration', 'integrations', 'manage', 'Manage integrations')
ON CONFLICT (code) DO UPDATE
SET
    module = EXCLUDED.module,
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    description = EXCLUDED.description;

INSERT INTO billing.features (code, name, module, value_type, unit, description)
VALUES
    ('users', 'Users', 'iam', 'integer', 'users', 'Active memberships'),
    ('extensions', 'Extensions', 'telephony', 'integer', 'extensions', 'Active extensions'),
    ('sip_trunks', 'SIP trunks', 'telephony', 'integer', 'trunks', 'Active SIP trunks'),
    ('concurrent_calls', 'Concurrent calls', 'telephony', 'integer', 'channels', 'Concurrent voice channels'),
    ('queues', 'Queues', 'callcenter', 'integer', 'queues', 'Active queues'),
    ('agents', 'Contact center agents', 'callcenter', 'integer', 'agents', 'Named agents'),
    ('recording_storage_gb', 'Recording storage', 'telephony', 'decimal', 'GB', 'Stored recordings'),
    ('whatsapp_numbers', 'WhatsApp numbers', 'omnichannel', 'integer', 'numbers', 'Connected numbers'),
    ('digital_interactions', 'Digital interactions', 'omnichannel', 'integer', 'messages', 'Monthly digital messages'),
    ('voice_ai_minutes', 'Voice AI minutes', 'ai', 'decimal', 'minutes', 'Monthly voice AI usage'),
    ('report_users', 'Report users', 'reporting', 'integer', 'users', 'Users with reporting access'),
    ('api_requests', 'API requests', 'integration', 'integer', 'requests', 'Monthly public API requests')
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    module = EXCLUDED.module,
    value_type = EXCLUDED.value_type,
    unit = EXCLUDED.unit,
    description = EXCLUDED.description;

CREATE OR REPLACE FUNCTION iam.bootstrap_tenant_roles(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, core, iam
AS $$
BEGIN
    IF core.current_tenant_id() IS DISTINCT FROM p_tenant_id THEN
        RAISE EXCEPTION 'Tenant context does not match requested tenant';
    END IF;

    INSERT INTO iam.roles (
        tenant_id,
        code,
        name,
        description,
        scope,
        is_system,
        is_editable
    )
    VALUES
        (
            p_tenant_id,
            'tenant_owner',
            'Tenant Owner',
            'Full tenant ownership and billing access',
            'tenant',
            true,
            false
        ),
        (
            p_tenant_id,
            'tenant_admin',
            'Tenant Admin',
            'Tenant administration without subscription ownership',
            'tenant',
            true,
            false
        ),
        (
            p_tenant_id,
            'supervisor',
            'Supervisor',
            'Queues, agents, quality and reporting',
            'tenant',
            true,
            false
        ),
        (
            p_tenant_id,
            'agent',
            'Agent',
            'Voice and digital customer service',
            'tenant',
            true,
            false
        ),
        (
            p_tenant_id,
            'user',
            'User',
            'Webphone, contacts and corporate chat',
            'tenant',
            true,
            false
        ),
        (
            p_tenant_id,
            'auditor',
            'Auditor',
            'Read-only reports, calls and audit access',
            'tenant',
            true,
            false
        ),
        (
            p_tenant_id,
            'billing_admin',
            'Billing Admin',
            'Plan, usage and license administration',
            'tenant',
            true,
            false
        )
    ON CONFLICT DO NOTHING;

    INSERT INTO iam.role_permissions (
        tenant_id,
        role_id,
        permission_id,
        effect
    )
    SELECT
        p_tenant_id,
        role.id,
        permission.id,
        'allow'
    FROM iam.roles role
    CROSS JOIN iam.permissions permission
    WHERE role.tenant_id = p_tenant_id
      AND (
          role.code = 'tenant_owner'
          OR (
              role.code = 'tenant_admin'
              AND permission.code NOT IN ('billing.manage')
          )
          OR (
              role.code = 'supervisor'
              AND permission.code IN (
                  'users.view',
                  'extensions.view',
                  'calls.view',
                  'recordings.view',
                  'queues.view',
                  'queues.manage',
                  'agents.view',
                  'agents.manage',
                  'supervision.use',
                  'campaigns.view',
                  'contacts.view',
                  'contacts.manage',
                  'crm.view',
                  'omnichannel.view',
                  'omnichannel.handle',
                  'reports.view',
                  'reports.export'
              )
          )
          OR (
              role.code = 'agent'
              AND permission.code IN (
                  'webphone.use',
                  'calls.make',
                  'contacts.view',
                  'contacts.manage',
                  'crm.view',
                  'omnichannel.view',
                  'omnichannel.handle',
                  'chat.use'
              )
          )
          OR (
              role.code = 'user'
              AND permission.code IN (
                  'webphone.use',
                  'calls.make',
                  'contacts.view',
                  'chat.use'
              )
          )
          OR (
              role.code = 'auditor'
              AND permission.code IN (
                  'tenant.view',
                  'users.view',
                  'calls.view',
                  'recordings.view',
                  'queues.view',
                  'agents.view',
                  'contacts.view',
                  'crm.view',
                  'reports.view',
                  'reports.export',
                  'audit.view'
              )
          )
          OR (
              role.code = 'billing_admin'
              AND permission.code IN (
                  'tenant.view',
                  'billing.view',
                  'billing.manage',
                  'licenses.view',
                  'licenses.manage',
                  'reports.view'
              )
          )
      )
    ON CONFLICT ON CONSTRAINT role_permissions_assignment_uk DO NOTHING;
END;
$$;

COMMIT;
