#!/bin/sh
#
# 코드 업데이트 반영: GitHub 최신 코드 → 앱 화면 다시 빌드 → AI 서버 재시작
#   cd /opt/ontoegeun/app && git pull && sh infra/scripts/update.sh

set -eu
APP=/opt/ontoegeun/app
SB=/opt/ontoegeun/supabase
cd "$SB"

get() { grep "^$1=" .env | cut -d= -f2-; }
PUBLISHABLE_KEY=$(get SUPABASE_PUBLISHABLE_KEY)
[ -n "$PUBLISHABLE_KEY" ] || PUBLISHABLE_KEY=$(get ANON_KEY)

PROXY_DOMAIN=$(get PROXY_DOMAIN) AI_DOMAIN=$(get AI_DOMAIN) \
  PUBLISHABLE_KEY="$PUBLISHABLE_KEY" KAKAO_ENABLED=$(get KAKAO_ENABLED) \
  sh "$APP/infra/scripts/build-web.sh"

cp "$APP/infra/docker-compose.ontoegeun.yml" "$SB/docker-compose.ontoegeun.yml"
docker compose build ai
docker compose up -d ai caddy auth
echo "업데이트 완료"
