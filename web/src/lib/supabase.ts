import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Supabase 환경변수 누락. web/.env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정하세요.'
  );
}

const REMEMBER_KEY = 'remember_me_v1';

function rememberedNow(): boolean {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) !== '0';
  } catch {
    return true;
  }
}

// 자동 로그인 설정에 따라 localStorage(유지) 또는 sessionStorage(탭 종료 시 소멸)에 세션을 저장한다.
// 읽을 때는 두 곳 다 확인해 이전 로그인 흔적을 놓치지 않는다.
const authStorage = {
  getItem: (key: string): string | null => {
    try {
      return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (rememberedNow()) {
        window.localStorage.setItem(key, value);
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(key, value);
        window.localStorage.removeItem(key);
      }
    } catch {
      // quota 등 무시
    }
  },
  removeItem: (key: string): void => {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,  // OAuth 콜백 처리
  },
});

/** 자동 로그인 여부를 설정. false 로 로그인하면 세션이 탭 종료 시 사라진다. */
export function setRememberMe(remember: boolean): void {
  try {
    if (remember) {
      window.localStorage.removeItem(REMEMBER_KEY);
    } else {
      window.localStorage.setItem(REMEMBER_KEY, '0');
    }
  } catch {
    // ignore
  }
}

export function getRememberMe(): boolean {
  return rememberedNow();
}
