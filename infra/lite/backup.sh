#!/bin/sh
#
# 매일 Supabase(클라우드) DB 백업 → /opt/ontoegeun/backups, 14일 보관
# Supabase 무료 요금제는 자동 백업이 없어서 이 서버가 대신 받아 둔다.
# infra/lite/.env 의 SUPABASE_DB_URL 이 비어 있으면 건너뛴다.
#
# 되살리기는 infra/lite/README.md 참고.

set -eu
APP=/opt/ontoegeun/app
OUT=/opt/ontoegeun/backups
KEEP_DAYS=14
# shellcheck disable=SC1091
. "$APP/infra/lite/.env"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "[$(date)] SUPABASE_DB_URL 이 없어 백업을 건너뜁니다"
  exit 0
fi

mkdir -p "$OUT"
STAMP=$(date +%Y%m%d-%H%M)
echo "[$(date)] 백업 시작"
# public(알림장·아이 등) 전체 + 회원 계정(auth.users, auth.identities)
docker run --rm --network host -e PGCONNECT_TIMEOUT=20 postgres:17 \
  pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner | gzip > "$OUT/public-$STAMP.sql.gz"
docker run --rm --network host -e PGCONNECT_TIMEOUT=20 postgres:17 \
  pg_dump "$SUPABASE_DB_URL" --data-only --table=auth.users --table=auth.identities | gzip > "$OUT/auth-$STAMP.sql.gz"
find "$OUT" -type f -mtime +"$KEEP_DAYS" -delete
ls -la "$OUT" | tail -n 3
echo "[$(date)] 백업 끝"
