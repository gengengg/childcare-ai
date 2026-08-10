import { getItem, setItem, multiRemove } from './storage';
import { supabase } from './supabase';
import { getSupabaseUserId } from './session';

const STYLE_MODE_KEY = 'style_mode_v1';
const STYLE_GUIDE_KEY = 'style_guide_v1';
const STYLE_SAMPLES_KEY = 'style_samples_v1';
const EMOJI_ENABLED_KEY = 'style_emoji_enabled_v1';
const TONE_KEY = 'style_tone_v1';
const LENGTH_KEY = 'style_length_v1';

export const MAX_STYLE_SAMPLES = 5;

export type StyleMode = 'default' | 'custom';

export type StyleSample =
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'image'; uri: string; base64: string };

export type ToneOption = 'warm' | 'friendly' | 'concise';
export type LengthOption = 'short' | 'medium' | 'long';

type Row = {
  style_mode: StyleMode;
  style_guide: string;
  style_samples: StyleSample[] | null;
  emoji_enabled: boolean;
  tone: ToneOption;
  length: LengthOption;
};

export function makeId(): string {
  return String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
}

async function fetchRow(userId: string): Promise<Row | null> {
  const { data, error } = await supabase
    .from('style_settings')
    .select('style_mode, style_guide, style_samples, emoji_enabled, tone, length')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[styleSettings.fetch]', error);
    return null;
  }
  return (data as Row | null) ?? null;
}

async function upsertRow(userId: string, patch: Partial<Row>): Promise<void> {
  const { error } = await supabase
    .from('style_settings')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' });
  if (error) {
    console.error('[styleSettings.upsert]', error);
    throw error;
  }
}

// ---------- Getters ----------
export async function getStyleMode(): Promise<StyleMode> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const r = await fetchRow(userId);
    return r?.style_mode ?? 'default';
  }
  const v = await getItem(STYLE_MODE_KEY);
  return v === 'custom' ? 'custom' : 'default';
}

export async function getStyleGuide(): Promise<string> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const r = await fetchRow(userId);
    return r?.style_guide ?? '';
  }
  return (await getItem(STYLE_GUIDE_KEY)) ?? '';
}

export async function getStyleSamples(): Promise<StyleSample[]> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const r = await fetchRow(userId);
    return r?.style_samples ?? [];
  }
  const raw = await getItem(STYLE_SAMPLES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StyleSample[]) : [];
  } catch {
    return [];
  }
}

export async function getEmojiEnabled(): Promise<boolean> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const r = await fetchRow(userId);
    return r?.emoji_enabled ?? true;
  }
  const v = await getItem(EMOJI_ENABLED_KEY);
  if (v === null) return true;
  return v === '1';
}

export async function getTone(): Promise<ToneOption> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const r = await fetchRow(userId);
    return r?.tone ?? 'warm';
  }
  const v = await getItem(TONE_KEY);
  return v === 'friendly' || v === 'concise' ? v : 'warm';
}

export async function getLength(): Promise<LengthOption> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const r = await fetchRow(userId);
    return r?.length ?? 'medium';
  }
  const v = await getItem(LENGTH_KEY);
  return v === 'short' || v === 'long' ? v : 'medium';
}

// ---------- Setters ----------
export async function setStyleMode(mode: StyleMode): Promise<void> {
  const userId = await getSupabaseUserId();
  if (userId) return upsertRow(userId, { style_mode: mode });
  await setItem(STYLE_MODE_KEY, mode);
}

export async function setStyleGuide(guide: string): Promise<void> {
  const userId = await getSupabaseUserId();
  if (userId) return upsertRow(userId, { style_guide: guide });
  await setItem(STYLE_GUIDE_KEY, guide);
}

export async function setStyleSamples(samples: StyleSample[]): Promise<void> {
  const trimmed = samples.slice(0, MAX_STYLE_SAMPLES);
  const userId = await getSupabaseUserId();
  if (userId) return upsertRow(userId, { style_samples: trimmed });
  await setItem(STYLE_SAMPLES_KEY, JSON.stringify(trimmed));
}

export async function setEmojiEnabled(enabled: boolean): Promise<void> {
  const userId = await getSupabaseUserId();
  if (userId) return upsertRow(userId, { emoji_enabled: enabled });
  await setItem(EMOJI_ENABLED_KEY, enabled ? '1' : '0');
}

export async function setTone(tone: ToneOption): Promise<void> {
  const userId = await getSupabaseUserId();
  if (userId) return upsertRow(userId, { tone });
  await setItem(TONE_KEY, tone);
}

export async function setLength(length: LengthOption): Promise<void> {
  const userId = await getSupabaseUserId();
  if (userId) return upsertRow(userId, { length });
  await setItem(LENGTH_KEY, length);
}

export async function clearStyleData(): Promise<void> {
  const userId = await getSupabaseUserId();
  if (userId) {
    return upsertRow(userId, {
      style_mode: 'default',
      style_guide: '',
      style_samples: [],
      emoji_enabled: true,
    });
  }
  await multiRemove([STYLE_MODE_KEY, STYLE_GUIDE_KEY, STYLE_SAMPLES_KEY, EMOJI_ENABLED_KEY]);
}

// ---------- Helpers ----------
export async function getActiveStyleGuide(): Promise<string> {
  const mode = await getStyleMode();
  if (mode !== 'custom') return '';
  const guide = await getStyleGuide();
  return guide.trim();
}

/**
 * 톤/길이를 자연어 지시문으로 변환.
 * ai.ts의 styleGuide에 프리펜드해서 백엔드로 보낸다.
 */
export function toneDirective(tone: ToneOption): string {
  switch (tone) {
    case 'warm':
      return '따뜻하고 정감 있는 어조로, 아이의 감정과 순간을 다정하게 담아 주세요.';
    case 'friendly':
      return '다정하고 친근한 어조로, 학부모와 대화하듯 편안하게 써 주세요.';
    case 'concise':
      return '간결하고 담백한 어조로, 사실 위주로 핵심만 정리해 주세요.';
  }
}

export function lengthDirective(length: LengthOption): string {
  switch (length) {
    case 'short':
      return '전체 분량은 짧게, 활동 하나당 3~4문장으로 압축해 주세요.';
    case 'medium':
      return '전체 분량은 보통 길이로, 활동 하나당 5~6문장으로 써 주세요.';
    case 'long':
      return '전체 분량은 자세히, 활동 하나당 7~9문장으로 풍부하게 묘사해 주세요.';
  }
}
