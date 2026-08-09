import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Header } from '@/components/Header';
import { MonthCalendar } from '@/components/MonthCalendar';
import { useToast } from '@/components/Toast';
import { CalendarIcon, PlusIcon, SparkleIcon, TrashIcon } from '@/components/icons';
import { getChildren, type Child } from '@/lib/children';
import {
  ACTIVITY_CATEGORIES,
  getTodayKey,
  makeEmptyActivity,
  type Activity,
} from '@/lib/dailyRecords';
import { getClassActivity, saveClassActivity } from '@/lib/classActivities';
import {
  computeShowClass,
  getDefaultClassName,
  getShowClassSetting,
} from '@/lib/settings';

export function ClassActivityScreen() {
  const [params] = useSearchParams();
  const toast = useToast();

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>(params.get('className') ?? '');
  const [selectedDate, setSelectedDate] = useState<string>(
    params.get('date') ?? getTodayKey()
  );
  const [showCalendar, setShowCalendar] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([makeEmptyActivity()]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showClass, setShowClass] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await getChildren();
      setChildren(list);
      const setting = await getShowClassSetting();
      const shouldShow = computeShowClass(setting, list);
      setShowClass(shouldShow);
      if (!selectedClass) {
        setSelectedClass(getDefaultClassName(list));
      }
    })();
  }, []);

  const classNames = useMemo(
    () => Array.from(new Set(children.map((c) => c.className).filter(Boolean))),
    [children]
  );
  const childCountInClass = useMemo(
    () => children.filter((c) => c.className === selectedClass).length,
    [children, selectedClass]
  );

  useEffect(() => {
    (async () => {
      if (!selectedClass || !selectedDate) return;
      const saved = await getClassActivity(selectedClass, selectedDate);
      if (saved && saved.activities.length > 0) {
        setActivities(saved.activities);
        setIsLoaded(true);
      } else {
        setActivities([makeEmptyActivity()]);
        setIsLoaded(false);
      }
    })();
  }, [selectedClass, selectedDate]);

  const update = (id: string, field: keyof Activity, value: string) =>
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  const add = () => setActivities((prev) => [...prev, makeEmptyActivity()]);
  const remove = (id: string) =>
    setActivities((prev) => (prev.length > 1 ? prev.filter((a) => a.id !== id) : prev));

  const handleSave = async () => {
    if (showClass && !selectedClass) {
      toast.show('반을 먼저 선택해주세요.', 'error');
      return;
    }
    if (!activities.some((a) => a.title.trim() || a.memo.trim())) {
      toast.show('활동명을 하나 이상 입력해주세요.', 'error');
      return;
    }
    await saveClassActivity({
      className: selectedClass,
      date: selectedDate,
      activities,
    });
    setIsLoaded(true);
    toast.show(
      selectedClass ? `${selectedClass} 공통 활동을 저장했어요.` : '공통 활동을 저장했어요.',
      'success'
    );
  };

  return (
    <>
      <Header
        back
        icon={<SparkleIcon />}
        title="반별 오늘 활동"
        subtitle="반마다 한 번만 입력하면 아이별 알림장에서 자동으로 불러와요"
      />

      {showClass && (
        <Card className="mb-4" hint="반 선택">
          {classNames.length === 0 ? (
            <p className="text-subtle text-[14px]">등록된 반이 없어요. 아이 관리에서 먼저 아이를 추가해주세요.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classNames.map((cn) => (
                <Chip
                  key={cn}
                  active={selectedClass === cn}
                  onClick={() => setSelectedClass(cn)}
                >
                  {cn}
                </Chip>
              ))}
            </div>
          )}
          {selectedClass && (
            <p className="text-[12px] text-subtle mt-3">
              {selectedClass} 아이 {childCountInClass}명
            </p>
          )}
        </Card>
      )}

      <Card className="mb-4" hint="날짜">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCalendar((v) => !v)}
            className="flex-1 rounded-2xl border border-cream-200 bg-cream-50 px-4 py-3 text-left"
          >
            <div className="text-[11px] text-subtle font-semibold">선택된 날짜</div>
            <div className="text-[15px] font-bold text-ink flex items-center gap-2">
              <CalendarIcon size={16} className="text-clay-500" />
              {selectedDate}
            </div>
          </button>
          <button
            onClick={() => {
              setSelectedDate(getTodayKey());
              setShowCalendar(false);
            }}
            className="btn-ghost py-3"
          >
            오늘
          </button>
        </div>
        {showCalendar && (
          <div className="mt-4 border-t border-cream-200 pt-4">
            <MonthCalendar
              value={selectedDate}
              onChange={(d) => {
                setSelectedDate(d);
                setShowCalendar(false);
              }}
            />
          </div>
        )}
      </Card>

      <Card className="mb-4" hint="오늘의 활동">
        {isLoaded && (
          <div className="rounded-xl bg-clay-500/10 border border-clay-500/20 px-3 py-2 mb-4 text-[13px] font-semibold text-clay-700">
            저장된 활동을 불러왔어요. 수정 후 다시 저장할 수 있어요.
          </div>
        )}

        <div className="space-y-4">
          {activities.map((act, index) => (
            <div key={act.id} className="rounded-2xl border border-cream-200 p-4 bg-cream-50/60">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-bold text-clay-700">활동 {index + 1}</span>
                {activities.length > 1 && (
                  <button
                    onClick={() => remove(act.id)}
                    className="text-subtle hover:text-red-500 p-1"
                    aria-label="활동 삭제"
                  >
                    <TrashIcon size={18} />
                  </button>
                )}
              </div>

              <input
                className="field-input mb-3"
                placeholder="활동명 · 예: 바깥놀이에서 곤충 관찰"
                value={act.title}
                onChange={(e) => update(act.id, 'title', e.target.value)}
              />

              <div className="mb-3 flex flex-wrap gap-1.5">
                {ACTIVITY_CATEGORIES.map((cat) => (
                  <Chip
                    key={cat}
                    active={act.category === cat}
                    onClick={() =>
                      update(act.id, 'category', act.category === cat ? '' : cat)
                    }
                  >
                    {cat}
                  </Chip>
                ))}
              </div>

              <textarea
                className="field-textarea min-h-[70px]"
                placeholder="활동 메모 (선택, 반 공통)"
                value={act.memo}
                onChange={(e) => update(act.id, 'memo', e.target.value)}
              />
            </div>
          ))}

          <button
            onClick={add}
            className="w-full rounded-2xl border border-dashed border-cream-300 py-3.5 text-[14px] font-semibold text-clay-600
              hover:bg-cream-100 transition flex items-center justify-center gap-1.5"
          >
            <PlusIcon size={18} /> 활동 추가하기
          </button>
        </div>
      </Card>

      <button onClick={handleSave} className="btn-primary w-full py-4">
        반별 활동 저장하기
      </button>
    </>
  );
}
