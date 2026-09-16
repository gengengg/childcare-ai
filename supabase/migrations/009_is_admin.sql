-- ============================================================
-- Migration 009: profiles.is_admin + is_admin() 헬퍼
--
-- 활동지 라이브러리 등 운영자 전용 콘텐츠를 관리하기 위한 플래그.
-- 신규 유저는 false 로 생성되고, kelly 계정만 Supabase 콘솔에서
-- 직접 true 로 바꿔 사용한다.
-- ============================================================

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- RLS 정책에서 반복 사용하는 헬퍼. security definer 로 정의해
-- profiles 조회가 항상 성공하도록 한다 (재귀적 RLS 회피).
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated;
