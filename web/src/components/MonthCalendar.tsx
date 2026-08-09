import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

type Props = {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  markedDates?: Set<string>;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toKey(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * 가벼운 월간 캘린더. 외부 라이브러리 없이 순수 렌더링.
 * 표시할 표식(dot)이 있는 날짜는 markedDates 셋으로 넘긴다.
 */
export function MonthCalendar({ value, onChange, markedDates }: Props) {
  const [year, month] = useMemo(() => {
    const [y, m] = value.split('-').map(Number);
    return [y || new Date().getFullYear(), (m || 1) - 1];
  }, [value]);
  const [cursor, setCursor] = useState<{ y: number; m: number }>({ y: year, m: month });

  const first = new Date(cursor.y, cursor.m, 1);
  const startWeekday = first.getDay(); // 0 = Sun
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const changeMonth = (delta: number) => {
    let m = cursor.m + delta;
    let y = cursor.y;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setCursor({ y, m });
  };

  const todayKey = (() => {
    const t = new Date();
    return toKey(t.getFullYear(), t.getMonth() + 1, t.getDate());
  })();

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => changeMonth(-1)}
          className="w-9 h-9 rounded-full flex items-center justify-center text-clay-700 active:bg-cream-100"
          aria-label="이전 달"
        >
          <ChevronLeftIcon />
        </button>
        <div className="text-[16px] font-bold text-ink">
          {cursor.y}년 {cursor.m + 1}월
        </div>
        <button
          onClick={() => changeMonth(1)}
          className="w-9 h-9 rounded-full flex items-center justify-center text-clay-700 active:bg-cream-100"
          aria-label="다음 달"
        >
          <ChevronRightIcon />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[12px] font-bold text-subtle mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map((w, i) => (
          <div key={w} className={clsx(i === 0 && 'text-red-400', i === 6 && 'text-blue-400')}>
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="h-11" />;
          const key = toKey(cursor.y, cursor.m + 1, d);
          const isSelected = key === value;
          const isToday = key === todayKey;
          const isMarked = markedDates?.has(key);
          const dow = i % 7;

          return (
            <button
              key={i}
              onClick={() => onChange(key)}
              className={clsx(
                'h-11 rounded-xl flex flex-col items-center justify-center text-[14px] font-semibold transition',
                isSelected
                  ? 'bg-clay-500 text-white shadow-pop'
                  : isToday
                  ? 'bg-cream-200 text-clay-800'
                  : 'text-ink hover:bg-cream-100',
                !isSelected && dow === 0 && 'text-red-500',
                !isSelected && dow === 6 && 'text-blue-500'
              )}
            >
              <span>{d}</span>
              {isMarked && !isSelected && (
                <span className="w-1 h-1 rounded-full bg-clay-500 mt-0.5" />
              )}
              {isMarked && isSelected && (
                <span className="w-1 h-1 rounded-full bg-white mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
