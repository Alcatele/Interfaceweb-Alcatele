-- Operational health checks.
-- Run with a read-only monitoring role that can inspect pg_catalog.

-- 1. Tenant-scoped logical tables without RLS.
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relrowsecurity,
    c.relforcerowsecurity
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
  AND NOT c.relrowsecurity
  AND NOT (
      n.nspname = 'core'
      AND c.relname IN ('tenant_domains', 'tenant_branding')
  )
ORDER BY 1, 2;

-- 2. Invalid or unvalidated constraints.
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    con.conname AS constraint_name,
    con.contype,
    con.convalidated
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND NOT con.convalidated
ORDER BY 1, 2, 3;

-- 3. Estimated rows in default partitions. Any sustained growth needs action.
SELECT
    schemaname,
    relname,
    n_live_tup,
    last_analyze,
    last_autoanalyze
FROM pg_catalog.pg_stat_user_tables
WHERE relname LIKE '%\_default' ESCAPE '\'
ORDER BY n_live_tup DESC;

-- 4. Largest tables and indexes.
SELECT
    n.nspname AS schema_name,
    c.relname AS relation_name,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
    pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
    pg_size_pretty(pg_indexes_size(c.oid)) AS indexes_size
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 50;

-- 5. Dead tuples and vacuum pressure.
SELECT
    schemaname,
    relname,
    n_live_tup,
    n_dead_tup,
    round(
        100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0),
        2
    ) AS dead_tuple_percent,
    last_autovacuum,
    last_autoanalyze
FROM pg_catalog.pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 50;

-- 6. Long-running transactions.
SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    now() - xact_start AS transaction_age,
    wait_event_type,
    wait_event,
    left(query, 500) AS query_excerpt
FROM pg_catalog.pg_stat_activity
WHERE xact_start IS NOT NULL
  AND pid <> pg_backend_pid()
  AND now() - xact_start > interval '30 seconds'
ORDER BY xact_start;

-- 7. Outbox backlog.
SELECT
    count(*) AS pending_events,
    min(occurred_at) AS oldest_event,
    now() - min(occurred_at) AS oldest_age,
    max(attempt_count) AS maximum_attempts
FROM eventing.outbox_events
WHERE published_at IS NULL
  AND available_at <= now();

-- 8. Provisioning backlog.
SELECT
    status,
    count(*) AS jobs,
    min(scheduled_at) AS oldest_job,
    now() - min(scheduled_at) AS oldest_age,
    max(attempt_count) AS maximum_attempts
FROM integration.provisioning_jobs
WHERE status IN ('pending', 'running', 'failed')
GROUP BY status
ORDER BY status;

-- 9. Webhook delivery backlog.
SELECT
    status,
    count(*) AS deliveries,
    min(next_attempt_at) AS oldest_attempt,
    max(attempt_count) AS maximum_attempts
FROM eventing.webhook_deliveries
WHERE status IN ('pending', 'delivering', 'failed')
GROUP BY status
ORDER BY status;

-- 10. Partition list and bounds.
SELECT
    parent_ns.nspname AS parent_schema,
    parent.relname AS parent_table,
    child_ns.nspname AS partition_schema,
    child.relname AS partition_table,
    pg_get_expr(child.relpartbound, child.oid) AS partition_bound
FROM pg_catalog.pg_inherits i
JOIN pg_catalog.pg_class parent ON parent.oid = i.inhparent
JOIN pg_catalog.pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
JOIN pg_catalog.pg_class child ON child.oid = i.inhrelid
JOIN pg_catalog.pg_namespace child_ns ON child_ns.oid = child.relnamespace
ORDER BY parent_ns.nspname, parent.relname, child.relname;

-- 11. Index usage candidates. Review before removing anything.
SELECT
    schemaname,
    relname,
    indexrelname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_catalog.pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 100;

-- 12. Recording retention candidates.
SELECT
    tenant_id,
    count(*) AS recordings,
    sum(size_bytes) AS bytes_to_expire
FROM telephony.recordings
WHERE retention_until < now()
  AND NOT legal_hold
  AND deleted_at IS NULL
GROUP BY tenant_id
ORDER BY bytes_to_expire DESC NULLS LAST;
