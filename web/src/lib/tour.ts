import { Preferences } from '@capacitor/preferences';

// 튜토리얼 내용이 바뀔 때마다 이 숫자를 증가시키면
// SettingsScreen '튜토리얼 다시 보기' 옆에 업데이트 배지가 뜬다.
// (자동으로 튜토리얼이 다시 뜨지는 않음 — 배지로만 유도)
export const TOUR_VERSION = 4; // 4: 하단 탭 5개(전체 탭) 개편

// Capacitor Preferences 는 Android SharedPreferences / iOS NSUserDefaults 로 저장되어
// 앱 재실행·백그라운드 종료에도 확실히 유지된다. (웹은 localStorage 로 fallback)
// 이전 버전에서 raw localStorage 로 저장한 값은 legacy 마이그레이션으로 인계한다.
const KEY = 'tour_seen_v2';
const LEGACY_LOCAL_KEY = 'tour_seen_v2';

let migrationDone = false;
async function migrateLegacyLocalStorage(): Promise<void> {
  if (migrationDone) return;
  migrationDone = true;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const legacy = window.localStorage.getItem(LEGACY_LOCAL_KEY);
    if (!legacy) return;
    const existing = await Preferences.get({ key: KEY });
    if (!existing.value) {
      await Preferences.set({ key: KEY, value: legacy });
    }
    // Preferences 웹 구현은 자체 prefix 를 쓰므로 raw 키를 지워도 안전.
    window.localStorage.removeItem(LEGACY_LOCAL_KEY);
  } catch {
    // ignore
  }
}

async function readSeenVersion(): Promise<number> {
  await migrateLegacyLocalStorage();
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return 0;
    // 옛 boolean 형식('1') 저장분 호환. '1' == v2 튜토리얼 봤음.
    if (value === '1') return 2;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function hasSeenTour(): Promise<boolean> {
  return (await readSeenVersion()) > 0;
}

/** 현재 버전을 봤음으로 저장. 인자 없이 호출하면 TOUR_VERSION 저장. */
export async function markTourSeen(version: number = TOUR_VERSION): Promise<void> {
  try {
    await Preferences.set({ key: KEY, value: String(version) });
  } catch {
    // ignore
  }
}

/** 마지막으로 본 버전이 현재 버전보다 낮으면 업데이트가 있음. */
export async function hasTourUpdate(): Promise<boolean> {
  const seen = await readSeenVersion();
  return seen > 0 && seen < TOUR_VERSION;
}

export async function resetTour(): Promise<void> {
  try {
    await Preferences.remove({ key: KEY });
  } catch {
    // ignore
  }
}
