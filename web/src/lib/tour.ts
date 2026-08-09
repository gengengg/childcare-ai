import { getItem, removeItem, setItem } from './storage';

const KEY = 'tour_seen_v1';

export async function hasSeenTour(): Promise<boolean> {
  return (await getItem(KEY)) === '1';
}

export async function markTourSeen(): Promise<void> {
  await setItem(KEY, '1');
}

export async function resetTour(): Promise<void> {
  await removeItem(KEY);
}
