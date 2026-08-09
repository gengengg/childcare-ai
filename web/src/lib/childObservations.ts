import { getItem, setItem } from './storage';

const KEY = 'child_observations_v1';

export type ChildObservationNote = {
  childId: string;
  notes: string;
  updatedAt: string;
};

async function getAll(): Promise<ChildObservationNote[]> {
  const raw = await getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function getChildObservationNote(childId: string): Promise<string> {
  const all = await getAll();
  return all.find((n) => n.childId === childId)?.notes ?? '';
}

export async function saveChildObservationNote(
  childId: string,
  notes: string
): Promise<void> {
  const all = await getAll();
  const idx = all.findIndex((n) => n.childId === childId);
  const entry: ChildObservationNote = {
    childId,
    notes,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) all[idx] = entry;
  else all.push(entry);
  await setItem(KEY, JSON.stringify(all));
}
