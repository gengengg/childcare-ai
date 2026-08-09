import { getItem, setItem } from './storage';

export type ThemePref = 'light' | 'dark' | 'auto';

const KEY = 'theme_pref_v1';

export async function getThemePref(): Promise<ThemePref> {
  const v = await getItem(KEY);
  if (v === 'light' || v === 'dark' || v === 'auto') return v;
  return 'auto';
}

export async function setThemePref(t: ThemePref): Promise<void> {
  await setItem(KEY, t);
  applyThemePref(t);
}

function prefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** 실제로 <html>에 .dark 클래스를 붙이거나 뗀다. */
export function applyThemePref(t: ThemePref): void {
  if (typeof document === 'undefined') return;
  const dark = t === 'dark' || (t === 'auto' && prefersDark());
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  // status bar / mobile theme color
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#161210' : '#FDFAF4';
}

/**
 * 앱 시작 시 저장된 설정을 읽어 적용.
 * 그리고 auto 모드에서 시스템 테마 변경을 실시간 반영.
 */
export function initTheme(): void {
  // 저장된 값 즉시 적용 (동기 localStorage → 깜박임 최소)
  try {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
    const t: ThemePref = v === 'light' || v === 'dark' ? v : 'auto';
    applyThemePref(t);
  } catch {
    applyThemePref('auto');
  }

  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = async () => {
      const cur = await getThemePref();
      if (cur === 'auto') applyThemePref('auto');
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
  }
}
