-- ============================================================
-- 알림장 AI — DB 스키마 (Phase 1)
-- Supabase SQL Editor에서 전체 붙여넣어 한 번에 실행하면 됩니다.
-- 재실행 시에도 안전하도록 IF NOT EXISTS / CREATE OR REPLACE 사용.
-- ============================================================

-- ------------------------------------------------------------
-- 0. 확장 & 공통 트리거 함수
-- ------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- updated_at 자동 갱신 함수
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 1. profiles — 사용자 프로필 (auth.users와 1:1)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  show_class_setting text not null default 'auto'
    check (show_class_setting in ('auto', 'on', 'off')),
  -- Phase 2 (결제/구독) 필드. 지금은 미사용, 미리 만들어둠.
  trial_ends_at timestamptz,
  paid_until timestamptz,
  coupon_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 신규 유저 가입 시 profiles 행 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, trial_ends_at)
  values (new.id, now() + interval '14 days')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 2. children — 아이 목록
-- ------------------------------------------------------------
create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  class_name text not null default '',
  age smallint not null default 2 check (age between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists children_user_idx on public.children(user_id);

drop trigger if exists children_updated_at on public.children;
create trigger children_updated_at
  before update on public.children
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3. daily_records — 알림장 (아이별/날짜별 1개)
-- ------------------------------------------------------------
create table if not exists public.daily_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- child_id 는 text: 등록된 아이 UUID / "manual-이름" / "common-반-날짜" 3케이스 모두 담기 위함
  child_id text not null,
  child_name text not null default '',  -- 아이 이름 변경/삭제 이력 보존용
  class_name text not null default '',
  date date not null,
  activities jsonb not null default '[]'::jsonb,
  meal_note text not null default '',
  nap_note text not null default '',
  health_note text not null default '',
  ai_draft text not null default '',
  teacher_final text not null default '',
  photos jsonb not null default '[]'::jsonb,  -- 현재는 data URL 배열. 추후 Storage 경로로 마이그레이션
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, child_id, date)
);
create index if not exists daily_records_user_date_idx
  on public.daily_records(user_id, date desc);
create index if not exists daily_records_child_date_idx
  on public.daily_records(child_id, date desc);

drop trigger if exists daily_records_updated_at on public.daily_records;
create trigger daily_records_updated_at
  before update on public.daily_records
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4. class_activities — 반 공통 활동
-- ------------------------------------------------------------
create table if not exists public.class_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_name text not null,
  date date not null,
  activities jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, class_name, date)
);
create index if not exists class_activities_user_date_idx
  on public.class_activities(user_id, date desc);

drop trigger if exists class_activities_updated_at on public.class_activities;
create trigger class_activities_updated_at
  before update on public.class_activities
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 5. child_observations — 아이별 관찰 메모 (아이당 1개)
-- ------------------------------------------------------------
create table if not exists public.child_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_id text not null,  -- daily_records와 동일한 이유로 text
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, child_id)
);
create index if not exists child_observations_user_idx on public.child_observations(user_id);

drop trigger if exists child_observations_updated_at on public.child_observations;
create trigger child_observations_updated_at
  before update on public.child_observations
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 6. style_settings — 문체 학습 (유저당 1개)
-- ------------------------------------------------------------
create table if not exists public.style_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  style_mode text not null default 'default'
    check (style_mode in ('default', 'custom')),
  style_guide text not null default '',
  style_samples jsonb not null default '[]'::jsonb,  -- [{id, kind, text | uri, base64}]
  emoji_enabled boolean not null default true,
  tone text not null default 'warm'
    check (tone in ('warm', 'friendly', 'concise')),
  length text not null default 'medium'
    check (length in ('short', 'medium', 'long')),
  updated_at timestamptz not null default now()
);

drop trigger if exists style_settings_updated_at on public.style_settings;
create trigger style_settings_updated_at
  before update on public.style_settings
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 7. coupon_codes — 쿠폰 (Phase 2 미리 준비)
-- ------------------------------------------------------------
create table if not exists public.coupon_codes (
  code text primary key,
  grant_days integer not null check (grant_days > 0),
  max_uses integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null references public.coupon_codes(code) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (user_id, code)  -- 같은 유저가 같은 쿠폰 중복 사용 방지
);
create index if not exists coupon_redemptions_user_idx on public.coupon_redemptions(user_id);

-- ============================================================
-- RLS 정책
-- automatic RLS가 켜져 있어 새 테이블은 RLS가 자동으로 활성화되지만,
-- 명시적으로 한 번 더 걸어두어 재실행/이관에서도 안전.
-- ============================================================

alter table public.profiles           enable row level security;
alter table public.children           enable row level security;
alter table public.daily_records      enable row level security;
alter table public.class_activities   enable row level security;
alter table public.child_observations enable row level security;
alter table public.style_settings     enable row level security;
alter table public.coupon_codes       enable row level security;
alter table public.coupon_redemptions enable row level security;

-- profiles: 본인 프로필만 접근
drop policy if exists "profiles self read"   on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self read"
  on public.profiles for select
  using (auth.uid() = id);
create policy "profiles self update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
-- INSERT는 트리거로만 (직접 X)

-- 공통 헬퍼: user_id = auth.uid() 조건으로 4개 액션 모두 허용
-- children
drop policy if exists "children owner all" on public.children;
create policy "children owner all"
  on public.children for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- daily_records
drop policy if exists "daily_records owner all" on public.daily_records;
create policy "daily_records owner all"
  on public.daily_records for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- class_activities
drop policy if exists "class_activities owner all" on public.class_activities;
create policy "class_activities owner all"
  on public.class_activities for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- child_observations
drop policy if exists "child_observations owner all" on public.child_observations;
create policy "child_observations owner all"
  on public.child_observations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- style_settings
drop policy if exists "style_settings owner all" on public.style_settings;
create policy "style_settings owner all"
  on public.style_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- coupon_codes: 로그인 유저는 코드로 조회 가능 (쿠폰 사용 시 검증용)
--   → 실제 발급은 서버에서만 (RLS는 select만 허용)
drop policy if exists "coupon_codes read authed" on public.coupon_codes;
create policy "coupon_codes read authed"
  on public.coupon_codes for select
  to authenticated
  using (true);

-- coupon_redemptions: 본인 사용 이력만 조회, 삽입은 서버에서 (혹은 SECURITY DEFINER 함수)
drop policy if exists "coupon_redemptions self read"  on public.coupon_redemptions;
drop policy if exists "coupon_redemptions self insert" on public.coupon_redemptions;
create policy "coupon_redemptions self read"
  on public.coupon_redemptions for select
  using (auth.uid() = user_id);
create policy "coupon_redemptions self insert"
  on public.coupon_redemptions for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- 테이블 GRANT (Data API "Automatically expose new tables" OFF 대응)
-- authenticated 역할에 명시적으로 CRUD 권한 부여.
-- 실제 행 단위 접근 제어는 위 RLS 정책이 담당하므로 이 grant는 안전.
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.children,
  public.daily_records,
  public.class_activities,
  public.child_observations,
  public.style_settings,
  public.coupon_redemptions
to authenticated;

-- coupon_codes: 검증용 조회만
grant select on public.coupon_codes to authenticated;

-- 향후 sequence 추가 대비
grant usage, select on all sequences in schema public to authenticated;
