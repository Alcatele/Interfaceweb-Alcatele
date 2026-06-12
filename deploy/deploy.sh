#!/usr/bin/env bash
set -euo pipefail

project_dir="${PROJECT_DIR:-/opt/alcatele-panel}"
environment_file="${ENV_FILE:-${project_dir}/.env.production}"

cd "$project_dir"

if [[ ! -f "$environment_file" ]]; then
  echo "Missing environment file: $environment_file" >&2
  exit 1
fi

docker compose \
  --env-file "$environment_file" \
  -f docker-compose.prod.yml \
  up -d --build --remove-orphans

docker compose \
  --env-file "$environment_file" \
  -f docker-compose.prod.yml \
  ps
