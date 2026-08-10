import { getItem, setItem } from './storage';
import { supabase } from './supabase';
import { getSupabaseUserId } from './session';

const CHILDREN_KEY = 'children_v1';

export type Child = {
  id: string;
  name: string;
  className: string;
  age: number; // 만 나이 0~5
};

type Row = { id: string; name: string; class_name: string; age: number };

function fromRow(r: Row): Child {
  return { id: r.id, name: r.name, className: r.class_name, age: r.age };
}

export async function getChildren(): Promise<Child[]> {
  const userId = await getSupabaseUserId();
  if (userId) return getChildrenRemote(userId);
  return getChildrenLocal();
}

export async function addChild(
  name: string,
  className: string,
  age: number
): Promise<Child> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const { data, error } = await supabase
      .from('children')
      .insert({
        user_id: userId,
        name: name.trim(),
        class_name: className.trim(),
        age,
      })
      .select('id, name, class_name, age')
      .single();
    if (error || !data) throw error ?? new Error('아이 추가 실패');
    return fromRow(data as Row);
  }
  return addChildLocal(name, className, age);
}

export async function updateChild(child: Child): Promise<void> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const { error } = await supabase
      .from('children')
      .update({ name: child.name, class_name: child.className, age: child.age })
      .eq('id', child.id)
      .eq('user_id', userId);
    if (error) throw error;
    return;
  }
  await updateChildLocal(child);
}

export async function deleteChild(id: string): Promise<void> {
  const userId = await getSupabaseUserId();
  if (userId) {
    const { error } = await supabase
      .from('children')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    return;
  }
  await deleteChildLocal(id);
}

// ---------- Supabase ----------
async function getChildrenRemote(userId: string): Promise<Child[]> {
  const { data, error } = await supabase
    .from('children')
    .select('id, name, class_name, age')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[children.getChildren]', error);
    return [];
  }
  return (data as Row[]).map(fromRow);
}

// ---------- localStorage (게스트 모드) ----------
async function getChildrenLocal(): Promise<Child[]> {
  const raw = await getItem(CHILDREN_KEY);
  if (!raw) return [];
  try {
    const parsed: Partial<Child>[] = JSON.parse(raw);
    return parsed.map((c) => ({
      id: c.id ?? String(Date.now()),
      name: c.name ?? '',
      className: c.className ?? '',
      age: c.age ?? 2,
    }));
  } catch {
    return [];
  }
}

async function addChildLocal(name: string, className: string, age: number): Promise<Child> {
  const children = await getChildrenLocal();
  const newChild: Child = {
    id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8),
    name: name.trim(),
    className: className.trim(),
    age,
  };
  children.push(newChild);
  await setItem(CHILDREN_KEY, JSON.stringify(children));
  return newChild;
}

async function updateChildLocal(child: Child): Promise<void> {
  const children = await getChildrenLocal();
  const idx = children.findIndex((c) => c.id === child.id);
  if (idx < 0) return;
  children[idx] = { ...children[idx], ...child };
  await setItem(CHILDREN_KEY, JSON.stringify(children));
}

async function deleteChildLocal(id: string): Promise<void> {
  const children = await getChildrenLocal();
  const filtered = children.filter((c) => c.id !== id);
  await setItem(CHILDREN_KEY, JSON.stringify(filtered));
}
