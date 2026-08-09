import { getItem, setItem } from './storage';

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
  photos: string[]; // data URL or base64
  createdAt: string;
  updatedAt: string;
};

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

export async function saveDailyRecord(
  record: Omit<DailyRecord, 'id' | 'createdAt' | 'updatedAt'> & { photos?: string[] }
): Promise<DailyRecord> {
  const records = await getAllDailyRecords();
  const now = new Date().toISOString();

  const idx = records.findIndex(
    (r) => r.childId === record.childId && r.date === record.date
  );

  let saved: DailyRecord;
  if (idx >= 0) {
    saved = {
      ...records[idx],
      ...record,
      photos: record.photos ?? records[idx].photos ?? [],
      updatedAt: now,
    };
    records[idx] = saved;
  } else {
    saved = {
      ...record,
      photos: record.photos ?? [],
      id: `${record.childId}-${record.date}`,
      createdAt: now,
      updatedAt: now,
    };
    records.push(saved);
  }

  await setItem(DAILY_RECORDS_KEY, JSON.stringify(records));
  return saved;
}

export async function getDailyRecord(childId: string, date: string): Promise<DailyRecord | null> {
  const records = await getAllDailyRecords();
  return records.find((r) => r.childId === childId && r.date === date) ?? null;
}

export async function deleteDailyRecord(childId: string, date: string): Promise<void> {
  const records = await getAllDailyRecords();
  const filtered = records.filter((r) => !(r.childId === childId && r.date === date));
  await setItem(DAILY_RECORDS_KEY, JSON.stringify(filtered));
}
