import { supabase } from './supabase';
import { getItem, setItem, removeItem } from './storage';

const GUEST_KEY = 'guest_mode_v1';

export async function isGuestMode(): Promise<boolean> {
  return (await getItem(GUEST_KEY)) === '1';
}

export async function enterGuestMode(): Promise<void> {
  await setItem(GUEST_KEY, '1');
}

export async function exitGuestMode(): Promise<void> {
  await removeItem(GUEST_KEY);
}

export async function signInWithMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/**
 * 이메일이 auth.users 에 존재하는지 확인.
 * supabase/migrations/002_email_exists.sql 에 정의된 RPC 사용.
 * 로그인 실패 원인을 구분하기 위한 UX 헬퍼.
 * RPC 호출 자체가 실패하면 true(fail-open)를 반환해 정상 로그인 흐름을 방해하지 않는다.
 */
export async function emailExists(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('email_exists', {
    check_email: email.trim().toLowerCase(),
  });
  if (error) {
    console.error('[emailExists]', error);
    return true;
  }
  return !!data;
}

/**
 * 이메일 + 비밀번호로 회원가입.
 * needsConfirmation === true 이면 이메일 확인 후 로그인 필요.
 * Supabase 설정에서 "Confirm email"이 꺼져 있으면 즉시 로그인된다.
 */
export async function signUpWithPassword(
  email: string,
  password: string
): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

/**
 * 현재 로그인 유저의 비밀번호 설정/변경.
 * 매직링크로만 가입한 유저에게 처음 비번을 부여할 때도 사용.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signInWithKakao(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await exitGuestMode();
}
