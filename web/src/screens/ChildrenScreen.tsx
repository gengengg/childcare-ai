import { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Header } from '@/components/Header';
import { useToast } from '@/components/Toast';
import { PlusIcon, SmileIcon, TrashIcon } from '@/components/icons';
import { addChild, deleteChild, getChildren, updateChild, type Child } from '@/lib/children';

const AGES = [0, 1, 2, 3, 4, 5];

export function ChildrenScreen() {
  const toast = useToast();
  const [children, setChildren] = useState<Child[]>([]);
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [age, setAge] = useState(2);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => setChildren(await getChildren());
  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setName('');
    setEditingId(null);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedClass = className.trim();
    if (!trimmedName) {
      toast.show('아이 이름을 입력해주세요.', 'error');
      return;
    }
    if (!trimmedClass) {
      toast.show('반 이름을 입력해주세요.', 'error');
      return;
    }
    if (editingId) {
      await updateChild({ id: editingId, name: trimmedName, className: trimmedClass, age });
      toast.show('수정했어요.', 'success');
    } else {
      await addChild(trimmedName, trimmedClass, age);
      toast.show('추가했어요.', 'success');
    }
    resetForm();
    await load();
  };

  const handleEdit = (c: Child) => {
    setEditingId(c.id);
    setName(c.name);
    setClassName(c.className);
    setAge(c.age);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (c: Child) => {
    const ok = window.confirm(
      `${c.name}을(를) 목록에서 삭제할까요?\n작성된 알림장은 유지됩니다.`
    );
    if (!ok) return;
    await deleteChild(c.id);
    if (editingId === c.id) resetForm();
    await load();
    toast.show('삭제했어요.');
  };

  return (
    <>
      <Header
        icon={<SmileIcon />}
        title="아이들"
        subtitle="반과 나이를 함께 등록해요"
      />

      <Card className="mb-4" hint={editingId ? '아이 정보 수정' : '새 아이 추가'}>
        <div className="space-y-3">
          <input
            className="field-input"
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="field-input"
            placeholder="반 이름"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
          />
          <div>
            <div className="text-[13px] font-semibold text-clay-700 mb-2">만 나이</div>
            <div className="flex flex-wrap gap-2">
              {AGES.map((a) => (
                <Chip key={a} active={age === a} onClick={() => setAge(a)}>
                  만 {a}세
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {editingId && (
              <button onClick={resetForm} className="btn-outline">
                취소
              </button>
            )}
            <button
              onClick={handleSave}
              className={editingId ? 'btn-primary' : 'btn-primary col-span-2'}
            >
              <PlusIcon size={16} />
              {editingId ? '수정 저장' : '아이 추가'}
            </button>
          </div>
        </div>
      </Card>

      <Card hint={`아이 목록 (${children.length}명)`}>
        {children.length === 0 ? (
          <p className="text-center text-subtle py-6">아직 등록된 아이가 없어요.</p>
        ) : (
          <ul className="divide-y divide-cream-200">
            {children.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <div className="w-10 h-10 rounded-full bg-cream-200 text-clay-700 flex items-center justify-center font-bold">
                  {c.name.slice(0, 1)}
                </div>
                <button onClick={() => handleEdit(c)} className="flex-1 text-left">
                  <div className="text-[15px] font-bold text-ink">{c.name}</div>
                  <div className="text-[12px] text-subtle">
                    {c.className} · 만 {c.age}세
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  className="w-9 h-9 rounded-full text-subtle hover:text-red-500 flex items-center justify-center"
                  aria-label="삭제"
                >
                  <TrashIcon size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
