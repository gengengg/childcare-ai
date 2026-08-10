-- ============================================================
-- Migration 001: daily_records.child_id, child_observations.child_id 를 text 로.
--
-- 이유:
-- - 알림장 앱은 3가지 케이스의 childId를 사용한다:
--   1) 등록된 아이 (UUID)
--   2) 직접 입력한 이름 (예: "manual-홍길동")
--   3) 반 공통 알림장 (예: "common-별님반-2026-08-10")
-- - 초기 스키마는 uuid + FK 로 만들어져 있어 2, 3번 저장 불가.
-- - text 로 바꾸고 FK 제거. RLS + user_id 로 여전히 충분히 안전.
-- ============================================================

-- daily_records
alter table public.daily_records
  drop constraint if exists daily_records_child_id_fkey;
alter table public.daily_records
  alter column child_id type text using child_id::text;

-- child_observations
alter table public.child_observations
  drop constraint if exists child_observations_child_id_fkey;
alter table public.child_observations
  alter column child_id type text using child_id::text;
