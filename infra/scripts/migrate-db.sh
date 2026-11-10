#!/bin/sh
#
# 기존 Supabase(클라우드) → 새 서버(셀프호스팅) 데이터베이스 이전
#
#   - public 스키마: 테이블 구조 + 데이터 + 정책 + 함수 (알림장, 아이, 주간일지 등 전부)
#   - auth 스키마: 회원 계정(auth.users)과 로그인 연결 정보(auth.identities)만
#       → 비밀번호(해시)·구글 연결 그대로 유지. 로그인 세션은 옮기지 않으므로 모두 한 번 다시 로그인.
#   - 이후 infra/sql/after-restore.sql 로 트리거·버킷·Storage 정책 복원
#   - 마지막에 테이블별 행 수를 기존/새 서버 나란히 비교
#
# 기존 서버는 읽기만 한다(아무것도 지우거나 바꾸지 않음). 새 서버는 비어 있어야 한다.
#
# 사용법 (서버에서 root):
#   export OLD_DB_URL='postgresql://postgres.<프로젝트ID>:<DB비밀번호>@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres'
#   sh /opt/ontoegeun/app/infra/scripts/migrate-db.sh
#
#   OLD_DB_URL: Supabase 대시보드 → 프로젝트 → Connect → "Session pooler" 주소 (IPv4 지원)

set -eu
APP=/opt/ontoegeun/app
SB=/opt/ontoegeun/supabase
WORK=/opt/ontoegeun/migration-$(date +%Y%m%d-%H%M%S)
PG_IMAGE=postgres:17

: "${OLD_DB_URL:?OLD_DB_URL 을 먼저 export 해 주세요 (사용법은 파일 위쪽 주석 참고)}"
mkdir -p "$WORK"
cd "$SB"

# 새 서버 DB 에 SQL 실행 (supabase-db 컨테이너 안의 psql, 관리자 계정)
PGPW=$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)
new_psql() { docker compose exec -T -e PGPASSWORD="$PGPW" db psql -h 127.0.0.1 -U supabase_admin -d postgres "$@"; }
old_dump() { docker run --rm --network host -e PGCONNECT_TIMEOUT=15 "$PG_IMAGE" pg_dump "$OLD_DB_URL" "$@"; }
old_psql() { docker run --rm --network host "$PG_IMAGE" psql "$OLD_DB_URL" "$@"; }

echo "===> 기존 서버 연결 확인"
old_psql -tAc "select 'ok: ' || count(*) || '명' from auth.users"

existing=$(new_psql -tAc "select count(*) from auth.users" | tr -d '[:space:]')
if [ "$existing" != "0" ]; then
  echo "새 서버에 이미 회원이 ${existing}명 있어요. 비어 있는 새 서버에서만 실행해 주세요." >&2
  exit 1
fi

echo "===> 1/4 내려받기: public 스키마 (구조+데이터)"
old_dump --schema=public --no-owner --quote-all-identifiers > "$WORK/public.sql"

echo "===> 2/4 내려받기: 회원 계정"
old_dump --data-only --table=auth.users --table=auth.identities > "$WORK/auth.sql"
ls -la "$WORK"

echo "===> 3/4 새 서버에 넣기 (오류는 $WORK/restore.log 에 기록)"
{
  echo "set session_replication_role = replica;"   # 넣는 동안 트리거·외래키 검사 잠시 끔
  cat "$WORK/auth.sql"
  echo "set role postgres;"                        # public 객체 소유자는 기존과 같이 postgres
  cat "$WORK/public.sql"
  echo "reset role;"
  echo "set session_replication_role = default;"
} > "$WORK/restore.sql"
new_psql -f - < "$WORK/restore.sql" > "$WORK/restore.log" 2>&1 || true
grep -E "ERROR" "$WORK/restore.log" | grep -v 'schema "public" already exists' || echo "(무시할 수 없는 오류 없음)"

echo "===> 4/4 트리거·버킷·Storage 정책 복원"
new_psql -v ON_ERROR_STOP=1 -f - < "$APP/infra/sql/after-restore.sql"

echo "===> 결과 비교 (기존 → 새 서버)"
COUNT_SQL="select 'auth.users', count(*) from auth.users
union all select 'auth.identities', count(*) from auth.identities
$(for t in profiles children daily_records class_activities child_observations style_settings \
          coupon_codes coupon_redemptions monthly_plans weekly_diaries worksheets worksheet_files; do
   printf "union all select 'public.%s', count(*) from public.%s\n" "$t" "$t"; done)
order by 1 collate \"C\""
old_psql -tAF ' ' -c "$COUNT_SQL" > "$WORK/count-old.txt"
new_psql -tAF ' ' -c "$COUNT_SQL" > "$WORK/count-new.txt"
printf '%-28s %8s %8s\n' "테이블" "기존" "새 서버"
LC_ALL=C join "$WORK/count-old.txt" "$WORK/count-new.txt" | while read -r t a b; do
  mark=""; [ "$a" = "$b" ] || mark="  <-- 다름!"
  printf '%-28s %8s %8s%s\n' "$t" "$a" "$b" "$mark"
done

echo
echo "완료. 백업 파일: $WORK  (다음: 파일 옮기기 → migrate-storage)"
