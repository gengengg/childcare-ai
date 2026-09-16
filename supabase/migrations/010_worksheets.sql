-- ============================================================
-- Migration 010: worksheets 테이블 + Storage 버킷
--
-- kelly(운영자)가 미리 AI 도구로 만든 활동지 PDF 를 라이브러리에
-- 축적하고, 나중에 유저가 태그로 검색해 다운로드하기 위한 기반.
--
-- 원본 PDF 는 Supabase Storage 의 private 버킷 'worksheets' 에 두고,
-- 앱에서는 다운로드 시점에 signed URL 을 발급받아 접근한다.
--
-- 이 마이그레이션 실행 전제:
-- - Migration 009 (is_admin) 이 먼저 적용되어 있어야 한다.
-- ============================================================

-- 1) 테이블 -----------------------------------------------------
create table if not exists public.worksheets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  file_path text not null,                -- Storage 'worksheets' 버킷 내 경로
  thumbnail_path text,                    -- 선택. 첫 페이지 이미지 경로
  age_group text not null default 'all'
    check (age_group in ('0-2', '3-5', 'all')),
  seasons text[] not null default '{}',              -- 봄/여름/가을/겨울/명절/공용
  developmental_areas text[] not null default '{}',  -- 신체건강/의사소통/사회관계/예술경험/자연탐구
  activity_types text[] not null default '{}',       -- 오리기/색칠/매칭/미로/붙이기 등
  tags text[] not null default '{}',
  is_published boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worksheets_published_created_idx
  on public.worksheets (is_published, created_at desc);
create index if not exists worksheets_age_idx
  on public.worksheets (age_group);

drop trigger if exists worksheets_touch_updated_at on public.worksheets;
create trigger worksheets_touch_updated_at
  before update on public.worksheets
  for each row execute function public.tg_touch_updated_at();

-- 2) RLS --------------------------------------------------------
alter table public.worksheets enable row level security;

-- 일반 로그인 유저: 공개된 것만 조회
drop policy if exists "worksheets read published" on public.worksheets;
create policy "worksheets read published" on public.worksheets
  for select
  to authenticated
  using (is_published = true);

-- 관리자: 전권 (초안까지 조회, 수정, 삭제)
drop policy if exists "worksheets admin all" on public.worksheets;
create policy "worksheets admin all" on public.worksheets
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.worksheets to authenticated;

-- 3) Storage 버킷 -----------------------------------------------
-- private 버킷 (public = false) — 다운로드는 signed URL 로만.
insert into storage.buckets (id, name, public)
values ('worksheets', 'worksheets', false)
on conflict (id) do nothing;

-- Storage RLS: 로그인 유저는 조회(=signed URL 발급), 쓰기는 관리자만
drop policy if exists "worksheets bucket read" on storage.objects;
create policy "worksheets bucket read" on storage.objects
  for select
  to authenticated
  using (bucket_id = 'worksheets');

drop policy if exists "worksheets bucket admin insert" on storage.objects;
create policy "worksheets bucket admin insert" on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'worksheets' and public.is_admin());

drop policy if exists "worksheets bucket admin update" on storage.objects;
create policy "worksheets bucket admin update" on storage.objects
  for update
  to authenticated
  using (bucket_id = 'worksheets' and public.is_admin())
  with check (bucket_id = 'worksheets' and public.is_admin());

drop policy if exists "worksheets bucket admin delete" on storage.objects;
create policy "worksheets bucket admin delete" on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'worksheets' and public.is_admin());
