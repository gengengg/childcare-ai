import { supabase } from './supabase';

/**
 * 현재 로그인된 유저의 id를 반환. 게스트/미로그인은 null.
 * getSession()은 캐시된 로컬 세션을 반환하므로 네트워크 호출 없음.
 * lib/*.ts에서 backend를 supabase / localStorage 로 분기하는 데 사용한다.
 */
export async function getSupabaseUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * 백엔드 API 호출용 인증 헤더. 로그인 상태면 Supabase access token 을
 * Bearer 로 붙이고, 게스트/미로그인은 빈 객체.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
