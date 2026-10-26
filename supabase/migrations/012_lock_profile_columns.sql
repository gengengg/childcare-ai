-- ============================================================
-- Migration 012: profiles 민감 컬럼 쓰기 차단 + 쿠폰 목록 노출 차단.
--
-- 문제:
--   "profiles self update" 정책은 본인 행이면 모든 컬럼 수정을 허용하고,
--   authenticated 에 테이블 전체 update 권한이 있어서 로그인 유저가
--   클라이언트에서 직접 is_admin / paid_until / coupon_until / trial_ends_at
--   을 바꿀 수 있었다 (관리자 권한 탈취, 무료 이용권 생성).
--
--   또 "coupon_codes read authed" 정책으로 로그인 유저 누구나
--   쿠폰 코드 전체 목록을 조회할 수 있었다.
--
-- 해결:
--   1) profiles 의 update 권한을 앱이 실제로 쓰는 컬럼으로만 제한
--      (컬럼 단위 GRANT). insert 는 handle_new_user 트리거(security definer)
--      로만, delete 는 auth.users cascade 로만 일어나므로 회수.
--   2) coupon_codes 직접 조회 권한 회수. 쿠폰 사용 기능을 만들 때는
--      security definer RPC 로 검증·차감을 서버에서 처리할 것.
--
-- 재실행 안전.
-- ============================================================

-- 1) profiles: 컬럼 단위 update 권한
revoke insert, update, delete on public.profiles from authenticated;
revoke insert, update, delete on public.profiles from anon;

grant update (nickname, show_class_setting, tour_seen_version)
  on public.profiles to authenticated;

-- 2) coupon_codes: 목록 조회 차단
drop policy if exists "coupon_codes read authed" on public.coupon_codes;
revoke select on public.coupon_codes from authenticated;
revoke select on public.coupon_codes from anon;
