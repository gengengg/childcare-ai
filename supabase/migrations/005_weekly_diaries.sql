-- ============================================================
-- Migration 005: weekly_diaries 테이블
--
-- 목적:
-- - 어린이집 주간보육일지를 저장한다.
-- - 요일별 실제 활동 슬롯(오전 자유놀이, 실외놀이, 특별활동)만 저장.
--   나머지 슬롯(등원, 간식, 낮잠, 배변, 귀가)은 표준 문구로 화면에서만 표시.
-- - 요일별 총평/활동평가를 저장. AI 자동 생성 지원.
-- - 반별로 분리. (user_id, class_name, year, month, week_number) 유니크.
-- ============================================================

create table if not exists public.weekly_diaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_name text not null default '',
  year int not null,
  month int not null check (month between 1 and 12),
  week_number int not null check (week_number between 1 and 6),
  age_group text not null default '',       -- 만 2세 등
  teacher_name text not null default '',
  director_name text not null default '',
  theme text not null default '',           -- 놀이 주제 (월간 큰 주제)
  subtheme text not null default '',        -- 예상 놀이 (그 주 부제)
  expectations text not null default '',    -- 교사의 기대 (여러 줄)
  -- 요일별 활동: { "월": {"morningFree": "...", "outdoor": "...", "special": "..."}, ... }
  days jsonb not null default '{}'::jsonb,
  -- 요일별 총평: { "월": "...", "화": "...", ... }
  evaluations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, class_name, year, month, week_number)
);

create index if not exists weekly_diaries_user_ym_idx
  on public.weekly_diaries (user_id, year, month);

drop trigger if exists weekly_diaries_touch_updated_at on public.weekly_diaries;
create trigger weekly_diaries_touch_updated_at
  before update on public.weekly_diaries
  for each row execute function public.tg_touch_updated_at();

alter table public.weekly_diaries enable row level security;

drop policy if exists "own weekly_diaries" on public.weekly_diaries;
create policy "own weekly_diaries" on public.weekly_diaries
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.weekly_diaries to authenticated;
