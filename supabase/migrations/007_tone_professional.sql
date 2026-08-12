-- ============================================================
-- Migration 007: style_settings.tone 에 'professional' 허용.
--
-- 클라이언트에서 톤 옵션 '따뜻하게(warm)' 를 '전문적으로(professional)' 로
-- 교체하면서, DB CHECK constraint 도 함께 갱신해야 저장이 성공한다.
--
-- 기존 저장된 'warm' 행은 'professional' 로 이관 (교체이므로 이전 값 폐기).
-- 예상 밖 값이 남아있어도 안전하게 흡수하도록 fallback 처리.
-- 기본값도 'professional' 로 변경.
--
-- 실행 순서:
--   1. CHECK constraint 먼저 제거 (기존 값 편집을 막지 않도록).
--   2. 알려진 옛 값 이관 + 안전망(모르는 값은 professional 로).
--   3. default 변경.
--   4. 새 CHECK constraint 부착.
-- ============================================================

-- 1) 기존 CHECK 제거. 이후 UPDATE 가 어떤 값이든 통과하도록.
alter table public.style_settings
  drop constraint if exists style_settings_tone_check;

-- 2) 데이터 정리.
update public.style_settings
   set tone = 'professional'
 where tone = 'warm';

-- 안전망: 이후 새 constraint 가 허용하지 않는 값이 남아있으면 professional 로 통일.
update public.style_settings
   set tone = 'professional'
 where tone not in ('professional', 'friendly', 'concise');

-- 3) 기본값 변경.
alter table public.style_settings
  alter column tone set default 'professional';

-- 4) 새 CHECK constraint.
alter table public.style_settings
  add constraint style_settings_tone_check
  check (tone in ('professional', 'friendly', 'concise'));
