import { getItem, setItem } from './storage';
import { supabase } from './supabase';
import { getSupabaseUserId } from './session';

const DAILY_RECORDS_KEY = 'daily_records_v1';

export const ACTIVITY_CATEGORIES = [
  '신체운동·건강',
  '의사소통',
  '사회관계',
  '예술경험',
  '자연탐구',
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export type Activity = {
  id: string;
  category: string;
  title: string;
  memo: string;
};

export type DailyRecord = {
  id: string;
  childId: string;
  childName: string;
  className: string;
  date: string; // YYYY-MM-DD
  activities: Activity[];
  mealNote: string;
  napNote: string;
  healthNote: string;
  aiDraft: string;
  teacherFinal: string;
  photos: string[]; // data URL 배열. 추후 Storage 경로로 마이그레이션 예정
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  child_id: string;
  child_name: string;
  class_name: string;
  date: string;
  activities: Activity[] | null;
  meal_note: string | null;
  nap_note: string | null;
  health_note: string | null;
  ai_draft: string | null;
  teacher_final: string | null;
  photos: string[] | null;
  created_at: string;
  updated_at: string;
};

function fromRow(r: Row): DailyRecord {
  return {
    id: r.id,
    childId: r.child_id,
    childName: r.child_name,
    className: r.class_name,
    date: r.date,
    activities: r.activities ?? [],
    mealNote: r.meal_note ?? '',
    napNote: r.nap_note ?? '',
    healthNote: r.health_note ?? '',
    aiDraft: r.ai_draft ?? '',
    teacherFinal: r.teacher_final ?? '',
    photos: r.photos ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function makeEmptyActivity(): Activity {
  return {
    id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 6),
    category: '',
    title: '',
    memo: '',
  };
}

export async function getAllDailyRecords(): Promise<DailyRecord[]> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const { data, error } = await supabase
      .from('daily_records')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (error) {
      console.error('[dailyRecords.getAll]', error);
      return [];
    }
    return (data as Row[]).map(fromRow);
  }
  return getAllLocal();
}

export async function saveDailyRecord(
  record: Omit<DailyRecord, 'id' | 'createdAt' | 'updatedAt'> & { photos?: string[] }
): Promise<DailyRecord> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const payload = {
      user_id: userId,
      child_id: record.childId,
      child_name: record.childName,
      class_name: record.className,
      date: record.date,
      activities: record.activities,
      meal_note: record.mealNote,
      nap_note: record.napNote,
      health_note: record.healthNote,
      ai_draft: record.aiDraft,
      teacher_final: record.teacherFinal,
      // 사진은 AI 초안 생성용으로만 쓰고 DB에 저장하지 않음.
      // Postgrest 1MB 페이로드 제한 + 무의미한 저장공간 낭비 방지.
      photos: [],
    };
    const { data, error } = await supabase
      .from('daily_records')
      .upsert(payload, { onConflict: 'user_id,child_id,date' })
      .select('*')
      .single();
    if (error || !data) throw error ?? new Error('알림장 저장 실패');
    return fromRow(data as Row);
  }
  return saveLocal(record);
}

export async function getDailyRecord(
  childId: string,
  date: string
): Promise<DailyRecord | null> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const { data, error } = await supabase
      .from('daily_records')
      .select('*')
      .eq('user_id', userId)
      .eq('child_id', childId)
      .eq('date', date)
      .maybeSingle();
    if (error) {
      console.error('[dailyRecords.get]', error);
      return null;
    }
    return data ? fromRow(data as Row) : null;
  }
  const records = await getAllLocal();
  return records.find((r) => r.childId === childId && r.date === date) ?? null;
}

export async function deleteDailyRecord(childId: string, date: string): Promise<void> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const { error } = await supabase
      .from('daily_records')
      .delete()
      .eq('user_id', userId)
      .eq('child_id', childId)
      .eq('date', date);
    if (error) throw error;
    return;
  }
  const records = await getAllLocal();
  const filtered = records.filter((r) => !(r.childId === childId && r.date === date));
  await setItem(DAILY_RECORDS_KEY, JSON.stringify(filtered));
}

// ---------- localStorage (게스트 모드) ----------
async function getAllLocal(): Promise<DailyRecord[]> {
  const raw = await getItem(DAILY_RECORDS_KEY);
  if (!raw) return [];
  try {
    const records = JSON.parse(raw);
    return records.map((r: any) => {
      if (!r.activities) {
        return {
          ...r,
          activities: [
            {
              id: '0',
              category: '',
              title: r.activityTitle ?? '',
              memo: r.teacherMemo ?? '',
            },
          ],
          photos: r.photos ?? [],
        } as DailyRecord;
      }
      return { ...r, photos: r.photos ?? [] } as DailyRecord;
    });
  } catch {
    return [];
  }
}

async function saveLocal(
  record: Omit<DailyRecord, 'id' | 'createdAt' | 'updatedAt'> & { photos?: string[] }
): Promise<DailyRecord> {
  const records = await getAllLocal();
  const now = new Date().toISOString();

  const idx = records.findIndex(
    (r) => r.childId === record.childId && r.date === record.date
  );

  let saved: DailyRecord;
  if (idx >= 0) {
    saved = {
      ...records[idx],
      ...record,
      photos: [],
      updatedAt: now,
    };
    records[idx] = saved;
  } else {
    saved = {
      ...record,
      photos: [],
      id: `${record.childId}-${record.date}`,
      createdAt: now,
      updatedAt: now,
    };
    records.push(saved);
  }

  await setItem(DAILY_RECORDS_KEY, JSON.stringify(records));
  return saved;
}
