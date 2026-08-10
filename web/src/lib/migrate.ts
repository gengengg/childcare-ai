import { getItem, multiRemove } from './storage';
import { getSupabaseUserId } from './session';
import { supabase } from './supabase';
import type { Child } from './children';
import type { DailyRecord } from './dailyRecords';
import type { ClassActivity } from './classActivities';
import type { StyleSample } from './styleSamples';

const MIGRATED_KEY = 'guest_migrated_v1';

const CHILDREN_KEY = 'children_v1';
const DAILY_RECORDS_KEY = 'daily_records_v1';
const CLASS_ACTIVITIES_KEY = 'class_activities_v1';
const STYLE_MODE_KEY = 'style_mode_v1';
const STYLE_GUIDE_KEY = 'style_guide_v1';
const STYLE_SAMPLES_KEY = 'style_samples_v1';
const EMOJI_ENABLED_KEY = 'style_emoji_enabled_v1';
const TONE_KEY = 'style_tone_v1';
const LENGTH_KEY = 'style_length_v1';

/**
 * 게스트 모드에서 쌓은 localStorage 데이터를 로그인 계정의 Supabase 로 옮긴다.
 * - 한 번만 실행 (guest_migrated_v1 플래그로 중복 방지)
 * - 이미 클라우드에 같은 키의 데이터가 있으면 로컬 것으로 덮어쓰지 않음 (upsert 시 서버 우선)
 * - 이관 성공한 로컬 데이터는 삭제 (충돌 방지)
 */
export async function migrateGuestDataIfNeeded(): Promise<{ moved: number } | null> {
  const userId = await getSupabaseUserId();
  if (!userId) return null;

  // 이미 이 계정에서 이관 완료했으면 스킵
  const migrated = await getItem(`${MIGRATED_KEY}_${userId}`);
  if (migrated === '1') return null;

  let moved = 0;

  // ── 1. children ──
  const childrenRaw = await getItem(CHILDREN_KEY);
  if (childrenRaw) {
    try {
      const list: Child[] = JSON.parse(childrenRaw);
      if (Array.isArray(list) && list.length > 0) {
        const payload = list.map((c) => ({
          user_id: userId,
          name: c.name,
          age: c.age ?? null,
          class_name: c.className ?? '',
        }));
        const { error } = await supabase
          .from('children')
          .insert(payload);
        if (!error) moved += payload.length;
        else console.error('[migrate.children]', error);
      }
    } catch (e) {
      console.error('[migrate.children.parse]', e);
    }
  }

  // ── 2. daily_records ──
  const recRaw = await getItem(DAILY_RECORDS_KEY);
  if (recRaw) {
    try {
      const list: DailyRecord[] = JSON.parse(recRaw);
      if (Array.isArray(list) && list.length > 0) {
        const payload = list.map((r) => ({
          user_id: userId,
          child_id: r.childId,
          child_name: r.childName,
          class_name: r.className,
          date: r.date,
          activities: r.activities ?? [],
          meal_note: r.mealNote ?? '',
          nap_note: r.napNote ?? '',
          health_note: r.healthNote ?? '',
          ai_draft: r.aiDraft ?? '',
          teacher_final: r.teacherFinal ?? '',
          photos: [],
        }));
        const { error } = await supabase
          .from('daily_records')
          .upsert(payload, { onConflict: 'user_id,child_id,date' });
        if (!error) moved += payload.length;
        else console.error('[migrate.daily_records]', error);
      }
    } catch (e) {
      console.error('[migrate.daily_records.parse]', e);
    }
  }

  // ── 3. class_activities ──
  const caRaw = await getItem(CLASS_ACTIVITIES_KEY);
  if (caRaw) {
    try {
      const list: ClassActivity[] = JSON.parse(caRaw);
      if (Array.isArray(list) && list.length > 0) {
        const payload = list.map((c) => ({
          user_id: userId,
          class_name: c.className,
          date: c.date,
          activities: c.activities ?? [],
        }));
        const { error } = await supabase
          .from('class_activities')
          .upsert(payload, { onConflict: 'user_id,class_name,date' });
        if (!error) moved += payload.length;
        else console.error('[migrate.class_activities]', error);
      }
    } catch (e) {
      console.error('[migrate.class_activities.parse]', e);
    }
  }

  // ── 4. style_settings ──
  const mode = await getItem(STYLE_MODE_KEY);
  const guide = await getItem(STYLE_GUIDE_KEY);
  const samplesRaw = await getItem(STYLE_SAMPLES_KEY);
  const emoji = await getItem(EMOJI_ENABLED_KEY);
  const tone = await getItem(TONE_KEY);
  const length = await getItem(LENGTH_KEY);
  const hasStyle =
    mode || guide || samplesRaw || emoji !== null || tone || length;
  if (hasStyle) {
    let samples: StyleSample[] = [];
    if (samplesRaw) {
      try {
        const parsed = JSON.parse(samplesRaw);
        if (Array.isArray(parsed)) samples = parsed;
      } catch {}
    }
    const payload: Record<string, unknown> = { user_id: userId };
    if (mode) payload.style_mode = mode === 'custom' ? 'custom' : 'default';
    if (guide !== null) payload.style_guide = guide ?? '';
    if (samples.length > 0) payload.style_samples = samples;
    if (emoji !== null) payload.emoji_enabled = emoji === '1';
    if (tone) payload.tone = tone;
    if (length) payload.length = length;
    const { error } = await supabase
      .from('style_settings')
      .upsert(payload, { onConflict: 'user_id' });
    if (!error) moved += 1;
    else console.error('[migrate.style_settings]', error);
  }

  // 이관 성공 플래그 기록 + 원본 로컬 데이터 삭제
  if (moved > 0) {
    await multiRemove([
      CHILDREN_KEY,
      DAILY_RECORDS_KEY,
      CLASS_ACTIVITIES_KEY,
      STYLE_MODE_KEY,
      STYLE_GUIDE_KEY,
      STYLE_SAMPLES_KEY,
      EMOJI_ENABLED_KEY,
      TONE_KEY,
      LENGTH_KEY,
    ]);
  }

  // 이관 시도 자체는 성공(다음번 스킵) — moved=0 이어도 플래그 기록
  try {
    window.localStorage.setItem(`${MIGRATED_KEY}_${userId}`, '1');
  } catch {}

  return { moved };
}
