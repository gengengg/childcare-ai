import { getItem, removeItem, setItem } from './storage';

// 튜토리얼 내용이 바뀔 때마다 이 숫자를 증가시키면
// SettingsScreen '튜토리얼 다시 보기' 옆에 업데이트 배지가 뜬다.
// (자동으로 튜토리얼이 다시 뜨지는 않음 — 배지로만 유도)
export const TOUR_VERSION = 3;

const KEY = 'tour_seen_v2';

async function readSeenVersion(): Promise<number> {
  const raw = await getItem(KEY);
  if (!raw) return 0;
  // 기존 boolean 형식('1') 저장분과 호환. '1' == v2 튜토리얼 봤음.
  if (raw === '1') return 2;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function hasSeenTour(): Promise<boolean> {
  return (await readSeenVersion()) > 0;
}

/** 현재 버전을 봤음으로 저장. 인자 없이 호출하면 TOUR_VERSION 저장. */
export async function markTourSeen(version: number = TOUR_VERSION): Promise<void> {
  await setItem(KEY, String(version));
}

/** 마지막으로 본 버전이 현재 버전보다 낮으면 업데이트가 있음. */
export async function hasTourUpdate(): Promise<boolean> {
  const seen = await readSeenVersion();
  return seen > 0 && seen < TOUR_VERSION;
}

export async function resetTour(): Promise<void> {
  await removeItem(KEY);
}
