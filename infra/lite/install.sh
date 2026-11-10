#!/bin/sh
#
# 온퇴근 경량판 설치 (네이버클라우드 Micro 등 1GB 서버, Ubuntu, root 로 실행)
#
#   - 스왑 2GB, Docker 설치
#   - 앱 화면 빌드 (Supabase 클라우드 주소로 연결)
#   - Caddy(HTTPS) + AI 서버 실행
#   - 매일 Supabase DB 백업 예약
#
# 사용법:
#   git clone -b ui-revamp-ontoegeun https://github.com/gengengg/childcare-ai.git /opt/ontoegeun/app
#   cd /opt/ontoegeun/app
#   cp infra/lite/lite.env.example infra/lite/.env && nano infra/lite/.env
#   cp backend/.env.example backend/.env && nano backend/.env      # OPENAI_API_KEY
#   sh infra/lite/install.sh
#
# 다시 실행해도 안전하다.

set -eu
APP=/opt/ontoegeun/app
LITE="$APP/infra/lite"

log() { printf '\n===> %s\n' "$*"; }
die() { printf '\n오류: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || die "root 로 실행해 주세요 (sudo -i 후 다시 실행)"
[ -f "$LITE/.env" ] || die "$LITE/.env 가 없어요. lite.env.example 을 복사해 값을 채워 주세요."
[ -f "$APP/backend/.env" ] || die "$APP/backend/.env 가 없어요. OPENAI_API_KEY 를 넣어 만들어 주세요."

# shellcheck disable=SC1091
. "$LITE/.env"
for v in APP_DOMAIN AI_DOMAIN SUPABASE_URL SUPABASE_PUBLISHABLE_KEY; do
  eval "val=\${$v:-}"
  [ -n "$val" ] || die "infra/lite/.env 의 $v 가 비어 있어요."
done

# ── 1. 스왑 (1GB 서버에서 빌드할 때 메모리 부족 방지) ──
if [ ! -f /swapfile ]; then
  log "스왑 2GB 만들기"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ── 2. Docker (Ubuntu 기본 저장소) ──
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  log "Docker 설치"
  apt-get update -qq
  apt-get install -y -qq docker.io docker-compose-v2
  systemctl enable --now docker
fi

# ── 3. 앱 화면 빌드 ──
sh "$LITE/build-web.sh"

# ── 4. 실행 ──
log "Caddy + AI 서버 실행"
cd "$LITE"
docker compose build ai
docker compose up -d
docker compose ps

# ── 5. 매일 백업 예약 (03:17) ──
CRON_LINE="17 3 * * * sh $LITE/backup.sh >> /var/log/ontoegeun-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'infra/lite/backup.sh' ; echo "$CRON_LINE" ) | crontab -

log "완료!"
cat <<EOF

  앱:       https://$APP_DOMAIN
  AI 서버:  https://$AI_DOMAIN/docs

  처음 접속 때 HTTPS 인증서를 받느라 1분 정도 걸릴 수 있어요.
  다음: infra/lite/README.md 의 'Supabase 주소 설정'
EOF
