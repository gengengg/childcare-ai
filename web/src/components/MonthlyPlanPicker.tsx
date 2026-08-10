import { useEffect, useMemo, useState } from 'react';
import { getMonthlyPlan, weekOfMonth, type MonthlyPlan } from '@/lib/monthlyPlans';
import { XIcon } from './icons';

type Props = {
  open: boolean;
  onClose: () => void;
  className: string;
  date: string; // YYYY-MM-DD
  onPick: (titles: string[]) => void;
};

/**
 * 그 반/그 달의 월간계획안을 불러와, 해당 주의 활동 리스트에서
 * 여러 개를 체크박스로 선택해 부모에게 title 배열을 넘긴다.
 */
export function MonthlyPlanPicker({ open, onClose, className, date, onPick }: Props) {
  const [plan, setPlan] = useState<MonthlyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const [year, month] = useMemo(() => {
    const d = new Date(date + 'T00:00:00');
    return [d.getFullYear(), d.getMonth() + 1];
  }, [date]);

  const defaultWeek = useMemo(() => weekOfMonth(date), [date]);

  useEffect(() => {
    if (!open) return;
    setChecked(new Set());
    setSelectedWeek(defaultWeek);
    (async () => {
      setLoading(true);
      try {
        const p = await getMonthlyPlan(className, year, month);
        setPlan(p);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, className, year, month, defaultWeek]);

  if (!open) return null;

  const week = plan?.weeks.find((w) => w.weekNumber === selectedWeek);
  const activities = week?.activities ?? [];

  const toggle = (title: string) => {
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(title)) n.delete(title);
      else n.add(title);
      return n;
    });
  };

  const handleAdd = () => {
    onPick(Array.from(checked));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-cream-200">
          <div className="min-w-0">
            <h2 className="text-[16px] font-extrabold text-ink truncate">월간계획안에서 불러오기</h2>
            <p className="text-[12px] text-subtle mt-0.5 truncate">
              {className ? `${className} · ` : ''}
              {year}년 {month}월
              {plan?.theme ? ` · ${plan.theme}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-cream-100 flex items-center justify-center text-subtle"
            aria-label="닫기"
          >
            <XIcon size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16 text-subtle text-[14px]">
            불러오는 중…
          </div>
        ) : !plan ? (
          <div className="flex-1 px-6 py-12 text-center">
            <p className="text-[14px] text-ink font-semibold mb-2">등록된 월간계획안이 없어요.</p>
            <p className="text-[12px] text-subtle leading-relaxed">
              달력 화면에서 {year}년 {month}월 월간계획안을{className ? ` (${className}용)` : ''} 먼저 업로드해 주세요.
            </p>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4 pb-2 flex gap-1.5 flex-wrap">
              {plan.weeks.map((w) => (
                <button
                  key={w.weekNumber}
                  onClick={() => {
                    setSelectedWeek(w.weekNumber);
                    setChecked(new Set());
                  }}
                  className={`text-[13px] font-semibold px-3 py-1.5 rounded-full transition ${
                    selectedWeek === w.weekNumber
                      ? 'bg-clay-500 text-white'
                      : 'bg-cream-100 text-subtle hover:bg-cream-200'
                  }`}
                >
                  {w.weekNumber}주
                </button>
              ))}
            </div>

            {week?.subtheme && (
              <div className="px-5 pb-2">
                <p className="text-[12px] font-semibold text-clay-700">‘{week.subtheme}’</p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 pb-3">
              {activities.length === 0 ? (
                <p className="text-center text-subtle text-[13px] py-10">
                  이 주에 등록된 활동이 없어요.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {activities.map((title) => (
                    <li key={title}>
                      <label className="flex items-start gap-2.5 py-2.5 px-3 rounded-xl hover:bg-cream-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked.has(title)}
                          onChange={() => toggle(title)}
                          className="mt-0.5 w-4 h-4 accent-clay-500 shrink-0"
                        />
                        <span className="text-[14px] text-ink leading-snug">{title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="px-5 pt-3 pb-5 border-t border-cream-200 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl bg-cream-100 text-ink text-[14px] font-semibold hover:bg-cream-200"
              >
                취소
              </button>
              <button
                onClick={handleAdd}
                disabled={checked.size === 0}
                className="flex-1 btn-primary py-3 disabled:opacity-50"
              >
                {checked.size > 0 ? `${checked.size}개 추가` : '선택 없음'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
