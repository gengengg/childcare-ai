-- ============================================================
-- Migration 004: monthly_plans 테이블
--
-- 목적:
-- - 어린이집 월간 놀이 계획안(PDF/DOCX)을 업로드하면
--   AI 파싱한 결과(주제 + 4주 활동)를 저장한다.
-- - 반별로 다른 계획안을 가질 수 있음 (같은 원 안 여러 반).
-- - 원본 파일은 저장하지 않음 (파싱 결과만).
-- - 공통 활동 입력 시 그 주의 활동 리스트를 팝업으로 보여주고
--   교사가 선택해서 채우는 데 활용.
-- ============================================================

create table if not exists public.monthly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_name text not null default '',   -- '' = 반 상관없이 공용
  year int not null,
  month int not null check (month between 1 and 12),
  theme text not null default '',
  weeks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, class_name, year, month)
);

create index if not exists monthly_plans_user_ym_idx
  on public.monthly_plans (user_id, year, month);

-- updated_at 자동 갱신
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists monthly_plans_touch_updated_at on public.monthly_plans;
create trigger monthly_plans_touch_updated_at
  before update on public.monthly_plans
  for each row execute function public.tg_touch_updated_at();

-- RLS
alter table public.monthly_plans enable row level security;

drop policy if exists "own monthly_plans" on public.monthly_plans;
create policy "own monthly_plans" on public.monthly_plans
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Auto-expose new tables OFF 이므로 GRANT 필수
grant select, insert, update, delete on public.monthly_plans to authenticated;
