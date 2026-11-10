#!/bin/sh
#
# 앱 화면(web/)을 서버 주소로 빌드해 web/dist 에 만든다. Node 는 Docker 로 실행(서버에 설치 불필요).
# install.sh 가 호출한다. 코드 업데이트 후 화면만 다시 만들 때도 사용:
#   cd /opt/ontoegeun/app && git pull && sh infra/scripts/update.sh
#
# 필요한 환경변수: PROXY_DOMAIN, AI_DOMAIN, PUBLISHABLE_KEY, (선택) KAKAO_ENABLED

set -eu
APP=/opt/ontoegeun/app

: "${PROXY_DOMAIN:?PROXY_DOMAIN 필요}"
: "${AI_DOMAIN:?AI_DOMAIN 필요}"
: "${PUBLISHABLE_KEY:?PUBLISHABLE_KEY 필요}"

printf '\n===> 앱 화면 빌드 (https://%s 로 연결)\n' "$PROXY_DOMAIN"
docker run --rm \
  -v "$APP/web:/web" -w /web \
  -e VITE_SUPABASE_URL="https://$PROXY_DOMAIN" \
  -e VITE_SUPABASE_ANON_KEY="$PUBLISHABLE_KEY" \
  -e VITE_API_BASE_URL="https://$AI_DOMAIN" \
  -e VITE_ENABLE_KAKAO_LOGIN="${KAKAO_ENABLED:-false}" \
  node:22-bookworm-slim sh -c "npm ci --no-audit --no-fund && npm run build"

ls -la "$APP/web/dist/index.html"
