#!/usr/bin/env bash
set -euo pipefail

project_dir="${PROJECT_DIR:-/opt/alcatele-panel}"
environment_file="${ENV_FILE:-${project_dir}/.env.production}"
credentials_file="${CREDENTIALS_FILE:-/root/alcatele-panel-initial-credentials.txt}"

cd "$project_dir"

if [[ ! -f "$environment_file" ]]; then
  echo "Missing environment file: $environment_file" >&2
  exit 1
fi

docker compose \
  --env-file "$environment_file" \
  -f docker-compose.prod.yml \
  up -d postgres

bash deploy/apply-migrations.sh

docker compose \
  --env-file "$environment_file" \
  -f docker-compose.prod.yml \
  up -d --build api web

if [[ ! -f "$credentials_file" ]]; then
  CREDENTIALS_FILE="$credentials_file" \
    bash deploy/rotate-seed-passwords.sh
fi

docker compose \
  --env-file "$environment_file" \
  -f docker-compose.prod.yml \
  up -d caddy --remove-orphans

docker compose \
  --env-file "$environment_file" \
  -f docker-compose.prod.yml \
  ps
