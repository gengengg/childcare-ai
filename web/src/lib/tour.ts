import { getItem, removeItem, setItem } from './storage';
import { getSupabaseUserId } from './session';
import { supabase } from './supabase';

// 튜토리얼 내용이 바뀔 때마다 이 숫자를 증가시키면
// SettingsScreen '튜토리얼 다시 보기' 옆에 업데이트 배지가 뜬다.
// (자동으로 튜토리얼이 다시 뜨지는 않음 — 배지로만 유도)
export const TOUR_VERSION = 3;

const LOCAL_KEY = 'tour_seen_v2';

async function readLocalVersion(): Promise<number> {
  const raw = await getItem(LOCAL_KEY);
  if (!raw) return 0;
  // 기존 boolean 형식('1') 저장분과 호환. '1' == v2 튜토리얼 봤음.
  if (raw === '1') return 2;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

// 로그인 사용자는 profiles.tour_seen_version 이 진짜 source of truth.
// localStorage 는 iOS Safari ITP / 시크릿 모드 등에서 유실되므로 fallback 으로만 사용.
async function readCloudVersion(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('tour_seen_version')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('[tour.readCloud]', error);
    return 0;
  }
  const v = (data as { tour_seen_version?: number } | null)?.tour_seen_version;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

async function writeCloudVersion(userId: string, version: number): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ tour_seen_version: version })
    .eq('id', userId);
  if (error) console.error('[tour.writeCloud]', error);
}

async function readSeenVersion(): Promise<number> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const cloud = await readCloudVersion(userId);
    if (cloud > 0) return cloud;
    // 클라우드 값이 없을 때 로컬 값이 있으면 그 값을 승격 (한 번뿐인 이관).
    const local = await readLocalVersion();
    if (local > 0) {
      await writeCloudVersion(userId, local);
      return local;
    }
    return 0;
  }
  return readLocalVersion();
}

export async function hasSeenTour(): Promise<boolean> {
  return (await readSeenVersion()) > 0;
}

/** 현재 버전을 봤음으로 저장. 인자 없이 호출하면 TOUR_VERSION 저장. */
export async function markTourSeen(version: number = TOUR_VERSION): Promise<void> {
  const userId = await getSupabaseUserId();
  if (userId) await writeCloudVersion(userId, version);
  // 로컬에도 계속 저장 — 오프라인/로그아웃 상태에서도 재출현 방지.
  await setItem(LOCAL_KEY, String(version));
}

/** 마지막으로 본 버전이 현재 버전보다 낮으면 업데이트가 있음. */
export async function hasTourUpdate(): Promise<boolean> {
  const seen = await readSeenVersion();
  return seen > 0 && seen < TOUR_VERSION;
}

export async function resetTour(): Promise<void> {
  const userId = await getSupabaseUserId();
  if (userId) await writeCloudVersion(userId, 0);
  await removeItem(LOCAL_KEY);
}
