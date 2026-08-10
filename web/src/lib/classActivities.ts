import { getItem, setItem } from './storage';
import { supabase } from './supabase';
import { getSupabaseUserId } from './session';
import { makeEmptyActivity, type Activity } from './dailyRecords';

const CLASS_ACTIVITIES_KEY = 'class_activities_v1';

export type ClassActivity = {
  id: string;
  className: string;
  date: string;
  activities: Activity[];
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  class_name: string;
  date: string;
  activities: Activity[] | null;
  created_at: string;
  updated_at: string;
};

function fromRow(r: Row): ClassActivity {
  return {
    id: r.id,
    className: r.class_name,
    date: r.date,
    activities: r.activities ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getAllClassActivities(): Promise<ClassActivity[]> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const { data, error } = await supabase
      .from('class_activities')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (error) {
      console.error('[classActivities.getAll]', error);
      return [];
    }
    return (data as Row[]).map(fromRow);
  }
  return getAllLocal();
}

export async function getClassActivity(
  className: string,
  date: string
): Promise<ClassActivity | null> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const { data, error } = await supabase
      .from('class_activities')
      .select('*')
      .eq('user_id', userId)
      .eq('class_name', className)
      .eq('date', date)
      .maybeSingle();
    if (error) {
      console.error('[classActivities.get]', error);
      return null;
    }
    return data ? fromRow(data as Row) : null;
  }
  const list = await getAllLocal();
  return list.find((c) => c.className === className && c.date === date) ?? null;
}

export async function saveClassActivity(input: {
  className: string;
  date: string;
  activities: Activity[];
}): Promise<ClassActivity> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const { data, error } = await supabase
      .from('class_activities')
      .upsert(
        {
          user_id: userId,
          class_name: input.className,
          date: input.date,
          activities: input.activities,
        },
        { onConflict: 'user_id,class_name,date' }
      )
      .select('*')
      .single();
    if (error || !data) throw error ?? new Error('반 활동 저장 실패');
    return fromRow(data as Row);
  }
  return saveLocal(input);
}

export function cloneActivitiesWithNewIds(activities: Activity[]): Activity[] {
  if (!activities || activities.length === 0) return [makeEmptyActivity()];
  return activities.map((a) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: a.category,
    title: a.title,
    memo: a.memo,
  }));
}

// ---------- localStorage (게스트 모드) ----------
async function getAllLocal(): Promise<ClassActivity[]> {
  const raw = await getItem(CLASS_ACTIVITIES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ClassActivity[];
  } catch {
    return [];
  }
}

async function saveLocal(input: {
  className: string;
  date: string;
  activities: Activity[];
}): Promise<ClassActivity> {
  const list = await getAllLocal();
  const now = new Date().toISOString();
  const idx = list.findIndex(
    (c) => c.className === input.className && c.date === input.date
  );

  if (idx >= 0) {
    const updated: ClassActivity = {
      ...list[idx],
      activities: input.activities,
      updatedAt: now,
    };
    list[idx] = updated;
    await setItem(CLASS_ACTIVITIES_KEY, JSON.stringify(list));
    return updated;
  }

  const created: ClassActivity = {
    id: `${input.className}-${input.date}`,
    className: input.className,
    date: input.date,
    activities: input.activities,
    createdAt: now,
    updatedAt: now,
  };
  list.push(created);
  await setItem(CLASS_ACTIVITIES_KEY, JSON.stringify(list));
  return created;
}
