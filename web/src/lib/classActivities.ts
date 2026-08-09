import { getItem, setItem } from './storage';
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

export async function getAllClassActivities(): Promise<ClassActivity[]> {
  const raw = await getItem(CLASS_ACTIVITIES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ClassActivity[];
  } catch {
    return [];
  }
}

export async function getClassActivity(
  className: string,
  date: string
): Promise<ClassActivity | null> {
  const list = await getAllClassActivities();
  return list.find((c) => c.className === className && c.date === date) ?? null;
}

export async function saveClassActivity(input: {
  className: string;
  date: string;
  activities: Activity[];
}): Promise<ClassActivity> {
  const list = await getAllClassActivities();
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

export function cloneActivitiesWithNewIds(activities: Activity[]): Activity[] {
  if (!activities || activities.length === 0) return [makeEmptyActivity()];
  return activities.map((a) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: a.category,
    title: a.title,
    memo: a.memo,
  }));
}
