#!/bin/sh
#
# 매일 백업 (install.sh 가 cron 에 등록: 매일 03:17)
#   - 데이터베이스 전체(회원·알림장 등) pg_dump → /opt/ontoegeun/backups
#   - Storage 파일(활동지) 폴더 묶음
#   - 14일 지난 백업은 삭제
#   - (선택) 네이버클라우드 Object Storage 로 사본 업로드:
#       /opt/ontoegeun/backup.env 에 아래 값을 넣으면 자동으로 올린다
#         NCP_BUCKET=ontoegeun-backup
#         AWS_ACCESS_KEY_ID=<NCP 인증키 Access Key>
#         AWS_SECRET_ACCESS_KEY=<NCP 인증키 Secret Key>
#       (setup.sh --with-aws 로 설치된 aws CLI 필요. 엔드포인트는 NCP Object Storage S3 호환 주소)
#
# 복구는 infra/README.md '백업에서 되살리기' 참고.

set -eu
SB=/opt/ontoegeun/supabase
OUT=/opt/ontoegeun/backups
KEEP_DAYS=14
NCP_ENDPOINT="${NCP_ENDPOINT:-https://kr.object.ncloudstorage.com}"
STAMP=$(date +%Y%m%d-%H%M)

mkdir -p "$OUT"
cd "$SB"

echo "[$(date)] 백업 시작"
PGPW=$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)
docker compose exec -T -e PGPASSWORD="$PGPW" db \
  pg_dumpall -h 127.0.0.1 -U supabase_admin --clean --if-exists | gzip > "$OUT/db-$STAMP.sql.gz"
if [ -d volumes/storage ]; then
  tar -czf "$OUT/storage-$STAMP.tar.gz" -C volumes storage
fi
find "$OUT" -type f -mtime +"$KEEP_DAYS" -delete
ls -la "$OUT" | tail -n 4

if [ -f /opt/ontoegeun/backup.env ]; then
  # shellcheck disable=SC1091
  . /opt/ontoegeun/backup.env
  if command -v aws >/dev/null 2>&1 && [ -n "${NCP_BUCKET:-}" ]; then
    export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
    for f in "$OUT/db-$STAMP.sql.gz" "$OUT/storage-$STAMP.tar.gz"; do
      [ -f "$f" ] && aws --endpoint-url "$NCP_ENDPOINT" s3 cp "$f" "s3://$NCP_BUCKET/$(basename "$f")"
    done
    echo "Object Storage 업로드 완료"
  fi
fi
echo "[$(date)] 백업 끝"
