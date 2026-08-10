-- ============================================================
-- Migration 002: email_exists(email text) 함수.
--
-- 로그인 화면에서 "이메일이 등록되어 있는가?"를 확인해 UX를 개선.
-- Supabase가 기본적으로 로그인 실패 시 "Invalid login credentials"만
-- 반환해서 (이메일 열거 방지) 사용자가 원인을 알기 어려움.
--
-- SECURITY DEFINER 로 auth.users 조회 권한을 얻고, anon/authenticated 에
-- execute 권한을 부여한다.
-- ============================================================

create or replace function public.email_exists(check_email text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists(
    select 1 from auth.users where email = lower(check_email)
  );
$$;

grant execute on function public.email_exists(text) to anon, authenticated;
