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

export type RecoveryInfo = {
  fullName: string;
  birthdate: string; // YYYY-MM-DD
  phone: string;     // 숫자만 (normalize 후)
  consentedAt: string; // ISO timestamp
};

/**
 * 이메일 + 비밀번호로 회원가입.
 * recovery 정보를 함께 넘기면 auth.users.raw_user_meta_data 에 저장되고,
 * handle_new_user 트리거가 profiles 로 이관한다.
 * needsConfirmation === true 이면 이메일 확인 후 로그인 필요.
 */
export async function signUpWithPassword(
  email: string,
  password: string,
  recovery?: RecoveryInfo
): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: recovery
      ? {
          data: {
            full_name: recovery.fullName,
            birthdate: recovery.birthdate,
            phone: recovery.phone,
            recovery_consent_at: recovery.consentedAt,
          },
        }
      : undefined,
  });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

/**
 * 전화번호 정규화: 하이픈/공백 제거하고 숫자만 남김.
 * 회원가입 저장 시와 아이디 찾기 조회 시 모두 동일하게 통과시켜야 매칭됨.
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * 아이디 찾기: 이름 + 전화번호로 마스킹된 이메일 조회.
 * migrations/003 의 find_email_by_recovery RPC 호출.
 */
export async function findEmailByRecovery(
  name: string,
  phone: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('find_email_by_recovery', {
    in_name: name.trim(),
    in_phone: normalizePhone(phone),
  });
  if (error) {
    console.error('[findEmailByRecovery]', error);
    return null;
  }
  return (data as string) ?? null;
}

/**
 * 비밀번호 재설정 링크 발송.
 * Supabase 이메일 템플릿(Reset password) 사용.
 * 유저는 링크 클릭 → /reset-password 로 이동 → 새 비번 설정.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: `${window.location.origin}/reset-password` }
  );
  if (error) throw error;
}

/**
 * 현재 로그인 유저의 비밀번호 설정/변경.
 * 매직링크로만 가입한 유저에게 처음 비번을 부여할 때도 사용.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await exitGuestMode();
}
