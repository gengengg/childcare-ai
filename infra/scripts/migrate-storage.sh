#!/bin/sh
#
# 기존 Supabase Storage 파일 → 새 서버로 복사 (migrate-db.sh 다음에 실행)
#
#   export OLD_URL='https://<프로젝트ID>.supabase.co'
#   export OLD_SECRET='sb_secret_...'   # 기존 대시보드 → Project Settings → API Keys → Secret key
#   sh /opt/ontoegeun/app/infra/scripts/migrate-storage.sh
#
# 새 서버 주소/키는 /opt/ontoegeun/supabase/.env 에서 자동으로 읽는다.

set -eu
APP=/opt/ontoegeun/app
SB=/opt/ontoegeun/supabase

: "${OLD_URL:?OLD_URL 을 먼저 export 해 주세요}"
: "${OLD_SECRET:?OLD_SECRET 을 먼저 export 해 주세요}"

get() { grep "^$1=" "$SB/.env" | cut -d= -f2-; }
NEW_SECRET=$(get SUPABASE_SECRET_KEY)
[ -n "$NEW_SECRET" ] || NEW_SECRET=$(get SERVICE_ROLE_KEY)
NEW_URL="https://$(get PROXY_DOMAIN)"

[ -d "$APP/web/node_modules/@supabase/supabase-js" ] || {
  echo "web/node_modules 가 없어요. install.sh(또는 build-web.sh)를 먼저 실행해 주세요." >&2
  exit 1
}

docker run --rm --network host \
  -v "$APP:/app:ro" -w /app \
  -e OLD_URL="$OLD_URL" -e OLD_SECRET="$OLD_SECRET" \
  -e NEW_URL="$NEW_URL" -e NEW_SECRET="$NEW_SECRET" \
  node:22-bookworm-slim node infra/scripts/migrate-storage.mjs
