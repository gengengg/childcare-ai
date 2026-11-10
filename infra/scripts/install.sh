#!/bin/sh
#
# 온퇴근 서버 설치 (네이버클라우드 Ubuntu 서버에서 root 로 실행)
#
#   1) 공식 Supabase self-hosted 설치 (Docker 설치 + 비밀키 자동 생성)
#   2) 온퇴근 설정(도메인/메일/소셜 로그인) 적용
#   3) 앱 화면 빌드 → Caddy(HTTPS) + AI 서버 + Supabase 실행
#
# 사용법:
#   git clone https://github.com/gengengg/childcare-ai.git /opt/ontoegeun/app
#   cd /opt/ontoegeun/app
#   cp infra/ontoegeun.env.example infra/ontoegeun.env && nano infra/ontoegeun.env
#   cp backend/.env.example backend/.env && nano backend/.env     # OPENAI_API_KEY
#   sh infra/scripts/install.sh
#
# 다시 실행해도 안전하다(이미 있는 비밀키는 그대로 둔다).

set -eu

BASE=/opt/ontoegeun
APP="$BASE/app"
SB="$BASE/supabase"
# 검증한 공식 self-hosted 릴리스. 올릴 때는 CHANGELOG 확인 후 바꾸기.
SUPABASE_REF="self-hosted/v0.8.4"

log() { printf '\n===> %s\n' "$*"; }
die() { printf '\n오류: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || die "root 로 실행해 주세요 (sudo -i 후 다시 실행)"
[ -f "$APP/infra/ontoegeun.env" ] || die "$APP/infra/ontoegeun.env 가 없어요. ontoegeun.env.example 을 복사해 값을 채워 주세요."
[ -f "$APP/backend/.env" ] || die "$APP/backend/.env 가 없어요. OPENAI_API_KEY 를 넣어 만들어 주세요."

# shellcheck disable=SC1091
. "$APP/infra/ontoegeun.env"
for v in APP_DOMAIN PROXY_DOMAIN AI_DOMAIN; do
  eval "val=\${$v:-}"
  [ -n "$val" ] || die "ontoegeun.env 의 $v 가 비어 있어요."
done

# ── 0. 스왑 메모리 (2~4GB 서버에서 빌드·업데이트할 때 메모리 부족 방지) ──
if [ ! -f /swapfile ]; then
  log "스왑 2GB 만들기"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ── 1. 공식 Supabase 설치 ──────────────────────────────────────
if [ ! -f "$SB/docker-compose.yml" ]; then
  log "공식 Supabase self-hosted 설치 ($SUPABASE_REF)"
  mkdir -p "$BASE"
  cd "$BASE"
  curl -fsSL "https://raw.githubusercontent.com/supabase/supabase/$SUPABASE_REF/docker/setup.sh" -o /tmp/supabase-setup.sh
  # -y: 질문 없이 기본값 + 비밀키/API 키 자동 생성. URL 은 아래에서 직접 넣는다.
  sh /tmp/supabase-setup.sh -y --project-dir supabase --ref "$SUPABASE_REF"
else
  log "Supabase 는 이미 설치돼 있어요 ($SB) — 설정만 갱신합니다"
fi

cd "$SB"
[ -f .env ] || die "$SB/.env 가 없어요. Supabase 설치가 실패했는지 확인해 주세요."

# .env 의 KEY=VALUE 를 바꾸거나 없으면 추가
set_env() {
  key="$1"; value="$2"
  esc=$(printf '%s' "$value" | sed -e 's/[\/&|]/\\&/g')
  if grep -q "^$key=" .env; then
    sed -i "s|^$key=.*|$key=$esc|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

# ── 2. 온퇴근 설정 적용 ───────────────────────────────────────
log "도메인/메일/로그인 설정 적용"
set_env SUPABASE_PUBLIC_URL "https://$PROXY_DOMAIN"
set_env API_EXTERNAL_URL "https://$PROXY_DOMAIN/auth/v1"
set_env SITE_URL "https://$APP_DOMAIN"
# 앱(웹·안드로이드)에서 로그인 후 돌아올 수 있는 주소
set_env ADDITIONAL_REDIRECT_URLS "https://$APP_DOMAIN/**,https://www.$APP_DOMAIN/**,capacitor://localhost,https://localhost,http://localhost:5173/**"
set_env PROXY_DOMAIN "$PROXY_DOMAIN"
set_env APP_DOMAIN "$APP_DOMAIN"
set_env AI_DOMAIN "$AI_DOMAIN"
# 전화번호 가입은 쓰지 않음
set_env ENABLE_PHONE_SIGNUP "false"
for k in SMTP_ADMIN_EMAIL SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_SENDER_NAME \
         GOOGLE_ENABLED GOOGLE_CLIENT_ID GOOGLE_SECRET KAKAO_ENABLED KAKAO_CLIENT_ID KAKAO_SECRET; do
  eval "val=\${$k:-}"
  set_env "$k" "$val"
done

# Compose 오버라이드: 공식 Caddy(HTTPS) + 온퇴근
cp "$APP/infra/docker-compose.ontoegeun.yml" "$SB/docker-compose.ontoegeun.yml"
for o in caddy ontoegeun; do
  grep '^COMPOSE_FILE=' .env | grep -q "docker-compose.$o.yml" || sh run.sh config add "$o"
done
sh run.sh config

# ── 3. 앱 화면 빌드 ───────────────────────────────────────────
PUBLISHABLE_KEY=$(grep '^SUPABASE_PUBLISHABLE_KEY=' .env | cut -d= -f2-)
[ -n "$PUBLISHABLE_KEY" ] || PUBLISHABLE_KEY=$(grep '^ANON_KEY=' .env | cut -d= -f2-)
APP_DOMAIN="$APP_DOMAIN" PROXY_DOMAIN="$PROXY_DOMAIN" AI_DOMAIN="$AI_DOMAIN" \
  PUBLISHABLE_KEY="$PUBLISHABLE_KEY" KAKAO_ENABLED="${KAKAO_ENABLED:-false}" \
  sh "$APP/infra/scripts/build-web.sh"

# ── 4. 실행 ───────────────────────────────────────────────────
log "컨테이너 실행 (처음에는 이미지 내려받느라 몇 분 걸려요)"
sh run.sh pull
docker compose build ai
sh run.sh start

# ── 5. 백업 예약 (매일 새벽 3시 17분) ─────────────────────────
CRON_LINE="17 3 * * * sh $APP/infra/scripts/backup.sh >> /var/log/ontoegeun-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'ontoegeun/app/infra/scripts/backup.sh' ; echo "$CRON_LINE" ) | crontab -

log "완료!"
cat <<EOF

  앱:            https://$APP_DOMAIN
  Supabase API:  https://$PROXY_DOMAIN
  관리 화면:     https://$PROXY_DOMAIN  (아이디/비밀번호: sh $SB/run.sh secrets)
  AI 서버:       https://$AI_DOMAIN/docs

  다음 단계: infra/README.md 의 '5. 데이터 옮기기'
EOF
