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

set -a
source "$environment_file"
set +a

superadmin_password="$(openssl rand -hex 16)"
admin_password="$(openssl rand -hex 16)"
user_password="$(openssl rand -hex 16)"

docker compose \
  --env-file "$environment_file" \
  -f docker-compose.prod.yml \
  exec -T postgres \
  psql \
  -v ON_ERROR_STOP=1 \
  -v superadmin_password="$superadmin_password" \
  -v admin_password="$admin_password" \
  -v user_password="$user_password" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" <<'SQL'
UPDATE iam.users
SET password_hash = crypt(:'superadmin_password', gen_salt('bf', 12)),
    updated_at = now()
WHERE username = 'superadmin';

UPDATE iam.users
SET password_hash = crypt(:'admin_password', gen_salt('bf', 12)),
    updated_at = now()
WHERE username = 'admin';

UPDATE iam.users
SET password_hash = crypt(:'user_password', gen_salt('bf', 12)),
    updated_at = now()
WHERE username = 'usuario';
SQL

umask 077
cat >"$credentials_file" <<EOF
URL=https://${APP_DOMAIN}
superadmin=${superadmin_password}
admin=${admin_password}
usuario=${user_password}
EOF
chmod 600 "$credentials_file"

echo "Seed passwords rotated."
echo "Credentials stored at ${credentials_file} with mode 600."
