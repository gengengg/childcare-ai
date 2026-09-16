-- ============================================================
-- Migration 011: worksheet_files — 한 주제(worksheet)에 여러 파일
--
-- worksheets.file_path (단일 파일) 를 자식 테이블로 분리해
-- 한 주제 아래 여러 PDF/PNG 를 담을 수 있게 확장.
-- 기존에 업로드된 데이터는 자동으로 자식 테이블로 이관되고,
-- worksheets.file_path 컬럼은 제거된다.
-- ============================================================

create table if not exists public.worksheet_files (
  id uuid primary key default gen_random_uuid(),
  worksheet_id uuid not null references public.worksheets(id) on delete cascade,
  file_path text not null,
  original_name text not null default '',
  sort_order integer not null default 0,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists worksheet_files_worksheet_idx
  on public.worksheet_files (worksheet_id, sort_order);

alter table public.worksheet_files enable row level security;

-- 일반 유저: 부모 worksheet 가 공개(published)일 때만 조회
drop policy if exists "worksheet_files read published" on public.worksheet_files;
create policy "worksheet_files read published" on public.worksheet_files
  for select
  to authenticated
  using (
    exists (
      select 1 from public.worksheets w
      where w.id = worksheet_id and w.is_published = true
    )
  );

-- 관리자: 전권
drop policy if exists "worksheet_files admin all" on public.worksheet_files;
create policy "worksheet_files admin all" on public.worksheet_files
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.worksheet_files to authenticated;

-- 기존 worksheets.file_path 데이터를 자식 테이블로 이관
insert into public.worksheet_files (worksheet_id, file_path, sort_order)
select w.id, w.file_path, 0
from public.worksheets w
where w.file_path is not null and w.file_path <> ''
  and not exists (
    select 1 from public.worksheet_files wf where wf.worksheet_id = w.id
  );

-- 이관 완료 후 컬럼 제거
alter table public.worksheets drop column if exists file_path;
