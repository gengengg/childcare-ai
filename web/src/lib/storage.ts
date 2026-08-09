/**
 * localStorage를 async 래퍼로 감싼다.
 * 나중에 Capacitor Preferences 등 다른 저장소로 갈아끼우기 쉽게 인터페이스를 통일했다.
 */

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export async function getItem(key: string): Promise<string | null> {
  if (!isBrowser) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // quota exceeded 등 무시 (알림장 사진이 많으면 위험할 수 있음)
  }
}

export async function removeItem(key: string): Promise<void> {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export async function multiRemove(keys: string[]): Promise<void> {
  await Promise.all(keys.map(removeItem));
}
