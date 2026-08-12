import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { MonthCalendar } from '@/components/MonthCalendar';
import { CalendarIcon } from '@/components/icons';
import { Mascot } from '@/components/Mascot';
import { getAllDailyRecords, getTodayKey, type DailyRecord } from '@/lib/dailyRecords';

function formatKorean(date: string) {
  const dt = new Date(date + 'T00:00:00');
  if (isNaN(dt.getTime())) return date;
  const week = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${week})`;
}

export function CalendarScreen() {
  const navigate = useNavigate();
  const today = getTodayKey();
  const [selected, setSelected] = useState(today);
  const [records, setRecords] = useState<DailyRecord[]>([]);

  useEffect(() => {
    (async () => setRecords(await getAllDailyRecords()))();
  }, []);

  const markedDates = useMemo(() => new Set(records.map((r) => r.date)), [records]);
  const dayRecords = useMemo(
    () => records.filter((r) => r.date === selected),
    [records, selected]
  );

  return (
    <>
      <Header
        back
        icon={<CalendarIcon />}
        title="달력"
        subtitle="날짜를 눌러 알림장을 확인·수정해요"
      />

      <Card className="mb-4">
        <MonthCalendar value={selected} onChange={setSelected} markedDates={markedDates} />
      </Card>

      <Card hint={formatKorean(selected)}>
        {dayRecords.length === 0 ? (
          <div className="flex flex-col items-center py-6">
            <Mascot variant="sleep" size={72} className="mb-3" />
            <p className="text-center text-subtle">이 날짜에 저장된 알림장이 없어요.</p>
          </div>
        ) : (
          <ul className="divide-y divide-cream-200">
            {dayRecords.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() =>
                    navigate(`/record/${encodeURIComponent(r.childId)}?date=${r.date}`)
                  }
                  className="w-full flex items-center gap-3 py-3 text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-cream-200 text-clay-700 flex items-center justify-center font-bold">
                    {r.childName.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-bold text-ink">{r.childName}</div>
                    <div className="text-[12px] text-subtle truncate">
                      {r.className || ' '} · {(r.teacherFinal || r.aiDraft).slice(0, 30)}
                    </div>
                  </div>
                  <span className="text-[12px] font-bold text-clay-600">편집</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
