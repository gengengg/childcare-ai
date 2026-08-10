import { getItem, removeItem, setItem } from './storage';

// v2: UI 대개편(5탭 + 학급 탭 신설) 이후 모든 사용자가 새 튜토리얼을 보도록 버전 업.
const KEY = 'tour_seen_v2';

export async function hasSeenTour(): Promise<boolean> {
  return (await getItem(KEY)) === '1';
}

export async function markTourSeen(): Promise<void> {
  await setItem(KEY, '1');
}

export async function resetTour(): Promise<void> {
  await removeItem(KEY);
}
