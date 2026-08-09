import { getItem, setItem } from './storage';

const CHILDREN_KEY = 'children_v1';

export type Child = {
  id: string;
  name: string;
  className: string;
  age: number; // 만 나이 0~5
};

export async function getChildren(): Promise<Child[]> {
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

export async function addChild(name: string, className: string, age: number): Promise<Child> {
  const children = await getChildren();
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

export async function updateChild(child: Child): Promise<void> {
  const children = await getChildren();
  const idx = children.findIndex((c) => c.id === child.id);
  if (idx < 0) return;
  children[idx] = { ...children[idx], ...child };
  await setItem(CHILDREN_KEY, JSON.stringify(children));
}

export async function deleteChild(id: string): Promise<void> {
  const children = await getChildren();
  const filtered = children.filter((c) => c.id !== id);
  await setItem(CHILDREN_KEY, JSON.stringify(filtered));
}
