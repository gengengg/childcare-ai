import { getItem, setItem, removeItem } from './storage';

const KEY = 'onboarding_seen_v1';

export async function hasSeenOnboarding(): Promise<boolean> {
  const v = await getItem(KEY);
  return v === '1';
}

export async function markOnboardingSeen(): Promise<void> {
  await setItem(KEY, '1');
}

export async function resetOnboarding(): Promise<void> {
  await removeItem(KEY);
}
