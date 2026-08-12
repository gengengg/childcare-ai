-- ============================================================
-- Migration 006: profiles.tour_seen_version 컬럼.
--
-- 튜토리얼 시청 상태를 로그인 계정 단위로 저장하기 위한 컬럼.
-- 그동안 localStorage(tour_seen_v2)에만 저장했더니 아래 상황에서 유실됨:
--   - iOS Safari ITP: 7일 이상 사이트 미접속 시 로컬 저장소 초기화
--   - 시크릿/사생활 보호 모드
--   - 브라우저의 tracking prevention
--   - "닫을 때 데이터 지우기" 설정 사용자
-- 결과적으로 이미 튜토리얼을 본 사용자에게 매 접속마다 다시 뜨는 제보 발생.
--
-- 로그인 사용자는 이제 profiles.tour_seen_version 이 진짜 source of truth.
-- 게스트는 여전히 localStorage 사용.
-- ============================================================

alter table public.profiles
  add column if not exists tour_seen_version int not null default 0;
