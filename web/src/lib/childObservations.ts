import { getItem, setItem } from './storage';
import { supabase } from './supabase';
import { getSupabaseUserId } from './session';

const KEY = 'child_observations_v1';

export type ChildObservationNote = {
  childId: string;
  notes: string;
  updatedAt: string;
};

export async function getChildObservationNote(childId: string): Promise<string> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const { data, error } = await supabase
      .from('child_observations')
      .select('notes')
      .eq('user_id', userId)
      .eq('child_id', childId)
      .maybeSingle();
    if (error) {
      console.error('[childObservations.get]', error);
      return '';
    }
    return data?.notes ?? '';
  }
  const all = await getAllLocal();
  return all.find((n) => n.childId === childId)?.notes ?? '';
}

export async function saveChildObservationNote(
  childId: string,
  notes: string
): Promise<void> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const { error } = await supabase.from('child_observations').upsert(
      { user_id: userId, child_id: childId, notes, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,child_id' }
    );
    if (error) throw error;
    return;
  }
  const all = await getAllLocal();
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

async function getAllLocal(): Promise<ChildObservationNote[]> {
  const raw = await getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
