-- ============================================================
-- Migration 003: 계정 복구용 개인정보 컬럼 + 아이디 찾기 RPC.
--
-- 회원가입 시 수집:
--   이름 (full_name), 생년월일 (birthdate), 휴대전화번호 (phone)
--   개인정보 수집·이용 동의 시각 (recovery_consent_at)
--
-- 아이디 찾기: 이름 + 전화번호 → 마스킹된 이메일 반환.
-- 비밀번호 찾기: Supabase 표준 resetPasswordForEmail 사용 (별도 RPC 불필요).
-- ============================================================

-- profiles 컬럼 추가 (IF NOT EXISTS 로 재실행 안전)
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists birthdate date,
  add column if not exists phone text,
  add column if not exists recovery_consent_at timestamptz;

-- 이름·전화번호 조회용 인덱스 (선택적 성능 개선)
create index if not exists profiles_name_phone_idx
  on public.profiles (full_name, phone);

-- 회원가입 시 raw_user_meta_data 로 넘어온 값을 profiles 에 자동 채우도록 트리거 재정의.
-- 기존 트리거는 profile 만 생성했음. 이제 metadata 값도 함께 저장.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    birthdate,
    phone,
    recovery_consent_at,
    trial_ends_at
  )
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'birthdate', '')::date,
    nullif(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'recovery_consent_at', '')::timestamptz,
    now() + interval '14 days'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 아이디(이메일) 찾기 RPC.
-- 이름 + 전화번호로 조회. 발견 시 마스킹된 이메일 반환 (kelly@gmail.com → kel***@gmail.com).
-- 미발견 시 null.
-- SECURITY DEFINER 라 anon 도 호출 가능 (auth.users 조회 권한을 함수로 캡슐화).
create or replace function public.find_email_by_recovery(
  in_name text,
  in_phone text
) returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  found_email text;
begin
  if in_name is null or in_phone is null then return null; end if;

  select u.email into found_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where trim(coalesce(p.full_name, '')) = trim(in_name)
    and trim(coalesce(p.phone, '')) = trim(in_phone)
  limit 1;

  if found_email is null then return null; end if;

  -- 앞 3자만 노출, 나머지 로컬파트는 ***
  return regexp_replace(found_email, '^(.{1,3}).*(@.*)$', '\1***\2');
end;
$$;

grant execute on function public.find_email_by_recovery(text, text) to anon, authenticated;
