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
