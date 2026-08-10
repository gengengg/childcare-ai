import { getItem, setItem } from './storage';
import { supabase } from './supabase';
import { getSupabaseUserId } from './session';
import type { Child } from './children';

/**
 * 반 이름 UI를 표시할지 여부.
 * - 'auto': 등록된 아이들의 반 개수가 2개 이상이면 표시, 아니면 숨김
 * - 'on'  : 항상 표시 (여러 반 담당)
 * - 'off' : 항상 숨김 (단일 반 담당)
 */
export type ShowClassSetting = 'auto' | 'on' | 'off';

const KEY = 'show_class_name_v1';

export async function getShowClassSetting(): Promise<ShowClassSetting> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('show_class_setting')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('[settings.get]', error);
      return 'auto';
    }
    const v = data?.show_class_setting;
    return v === 'on' || v === 'off' ? v : 'auto';
  }
  const v = await getItem(KEY);
  if (v === 'on') return 'on';
  if (v === 'off') return 'off';
  return 'auto';
}

export async function setShowClassSetting(s: ShowClassSetting): Promise<void> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const { error } = await supabase
      .from('profiles')
      .update({ show_class_setting: s })
      .eq('id', userId);
    if (error) {
      console.error('[settings.set]', error);
      throw error;
    }
    return;
  }
  await setItem(KEY, s);
}

/**
 * 설정 + 등록된 아이들 상태를 종합해 반 이름 UI 표시 여부를 계산한다.
 */
export function computeShowClass(
  setting: ShowClassSetting,
  children: Child[]
): boolean {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  const unique = new Set(
    children.map((c) => (c.className || '').trim()).filter(Boolean)
  );
  return unique.size >= 2;
}

/**
 * 반 이름 UI가 숨겨졌을 때 내부적으로 사용할 기본 반 이름.
 * 등록된 아이들 중 가장 많이 등장하는 className을 반환. 없으면 빈 문자열.
 */
export function getDefaultClassName(children: Child[]): string {
  const names = children
    .map((c) => (c.className || '').trim())
    .filter(Boolean);
  if (names.length === 0) return '';
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
