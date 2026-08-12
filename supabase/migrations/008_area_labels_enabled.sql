-- ============================================================
-- Migration 008: style_settings.area_labels_enabled 컬럼.
--
-- AI 알림장에서 '[사회관계] 블록으로 친구들과…' 처럼 소제목 앞에 붙는
-- 표준 보육과정 5영역 태그를 켜고 끌 수 있게 하는 토글.
-- 기본값은 false(꺼짐) — 대부분의 학부모에게는 태그가 어색하다는 피드백.
-- ============================================================

alter table public.style_settings
  add column if not exists area_labels_enabled boolean not null default false;
