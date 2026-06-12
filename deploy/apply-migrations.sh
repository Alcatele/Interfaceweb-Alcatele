#!/usr/bin/env bash
set -euo pipefail

project_dir="${PROJECT_DIR:-/opt/alcatele-panel}"
environment_file="${ENV_FILE:-${project_dir}/.env.production}"

cd "$project_dir"

if [[ ! -f "$environment_file" ]]; then
  echo "Missing environment file: $environment_file" >&2
  exit 1
fi

set -a
source "$environment_file"
set +a

docker compose \
  --env-file "$environment_file" \
  -f docker-compose.prod.yml \
  exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
CREATE TABLE IF NOT EXISTS core.schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

for migration in database/postgresql/migrations/*.sql; do
  migration_name="$(basename "$migration")"
  applied="$(
    docker compose \
      --env-file "$environment_file" \
      -f docker-compose.prod.yml \
      exec -T postgres \
      psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
      -c "SELECT 1 FROM core.schema_migrations WHERE name = '${migration_name}'"
  )"

  if [[ "$applied" == "1" ]]; then
    continue
  fi

  docker compose \
    --env-file "$environment_file" \
    -f docker-compose.prod.yml \
    exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    <"$migration"

  docker compose \
    --env-file "$environment_file" \
    -f docker-compose.prod.yml \
    exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "INSERT INTO core.schema_migrations (name) VALUES ('${migration_name}')"
done
