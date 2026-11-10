#!/bin/sh
# 앱 화면(web/) 빌드 → web/dist. Node 는 Docker 로 실행 (서버에 설치 불필요).
set -eu
APP=/opt/ontoegeun/app
# shellcheck disable=SC1091
. "$APP/infra/lite/.env"

printf '\n===> 앱 화면 빌드 (1GB 서버에선 몇 분 걸려요)\n'
docker run --rm \
  -v "$APP/web:/web" -w /web \
  -e NODE_OPTIONS=--max-old-space-size=1024 \
  -e VITE_SUPABASE_URL="$SUPABASE_URL" \
  -e VITE_SUPABASE_ANON_KEY="$SUPABASE_PUBLISHABLE_KEY" \
  -e VITE_API_BASE_URL="https://$AI_DOMAIN" \
  -e VITE_ENABLE_KAKAO_LOGIN="${KAKAO_ENABLED:-false}" \
  node:22-bookworm-slim sh -c "npm ci --no-audit --no-fund && npm run build"
ls -la "$APP/web/dist/index.html"
