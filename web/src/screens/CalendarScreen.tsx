import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Header } from '@/components/Header';
import { MonthCalendar } from '@/components/MonthCalendar';
import { useToast } from '@/components/Toast';
import { CalendarIcon, PlusIcon, SparkleIcon, TrashIcon } from '@/components/icons';
import { getAllDailyRecords, getTodayKey, type DailyRecord } from '@/lib/dailyRecords';
import { getChildren, type Child } from '@/lib/children';
import {
  computeShowClass,
  getDefaultClassName,
  getShowClassSetting,
} from '@/lib/settings';
import {
  deleteMonthlyPlan,
  getMonthlyPlan,
  parseMonthlyPlanFile,
  saveMonthlyPlan,
  type MonthlyPlan,
} from '@/lib/monthlyPlans';

function formatKorean(date: string) {
  const dt = new Date(date + 'T00:00:00');
  if (isNaN(dt.getTime())) return date;
  const week = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${week})`;
}

export function CalendarScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const today = getTodayKey();
  const [selected, setSelected] = useState(today);
  const [records, setRecords] = useState<DailyRecord[]>([]);

  const [children, setChildren] = useState<Child[]>([]);
  const [showClass, setShowClass] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>('');

  const [plan, setPlan] = useState<MonthlyPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [year, month] = useMemo(() => {
    const d = new Date(selected + 'T00:00:00');
    return [d.getFullYear(), d.getMonth() + 1];
  }, [selected]);

  useEffect(() => {
    (async () => {
      const [recs, kids, setting] = await Promise.all([
        getAllDailyRecords(),
        getChildren(),
        getShowClassSetting(),
      ]);
      setRecords(recs);
      setChildren(kids);
      const shouldShow = computeShowClass(setting, kids);
      setShowClass(shouldShow);
      setSelectedClass(getDefaultClassName(kids));
    })();
  }, []);

  const classNames = useMemo(
    () => Array.from(new Set(children.map((c) => c.className).filter(Boolean))),
    [children]
  );

  useEffect(() => {
    (async () => {
      setPlanLoading(true);
      try {
        const p = await getMonthlyPlan(selectedClass, year, month);
        setPlan(p);
      } finally {
        setPlanLoading(false);
      }
    })();
  }, [selectedClass, year, month]);

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.pdf') && !name.endsWith('.docx')) {
      toast.show('PDF 또는 DOCX 파일만 올릴 수 있어요.', 'error');
      return;
    }
    setUploading(true);
    try {
      const parsed = await parseMonthlyPlanFile(file);
      if (!parsed.weeks || parsed.weeks.length === 0) {
        toast.show('활동을 추출하지 못했어요. 파일 형식을 확인해 주세요.', 'error');
        return;
      }
      // year/month 는 파일에서 감지 못했을 수도 있어 현재 선택한 달로 대체
      const saved = await saveMonthlyPlan({
        className: selectedClass,
        year: parsed.year ?? year,
        month: parsed.month ?? month,
        theme: parsed.theme,
        weeks: parsed.weeks,
      });
      // 캘린더가 저장 시점 year/month 를 보고 있으므로 그 값과 다르면 알림
      if (saved.year !== year || saved.month !== month) {
        toast.show(
          `${saved.year}년 ${saved.month}월 계획안으로 저장했어요. 해당 달로 이동해 확인해 주세요.`,
          'success'
        );
      } else {
        setPlan(saved);
        toast.show('월간계획안을 등록했어요.', 'success');
      }
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '업로드 실패', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!plan) return;
    if (!confirm(`${plan.year}년 ${plan.month}월 계획안을 삭제할까요?`)) return;
    try {
      await deleteMonthlyPlan(plan.className, plan.year, plan.month);
      setPlan(null);
      toast.show('삭제했어요.', 'success');
    } catch {
      toast.show('삭제 실패', 'error');
    }
  };

  const markedDates = useMemo(() => new Set(records.map((r) => r.date)), [records]);
  const dayRecords = useMemo(
    () => records.filter((r) => r.date === selected),
    [records, selected]
  );

  return (
    <>
      <Header back icon={<CalendarIcon />} title="달력" subtitle="날짜를 눌러 알림장을 확인해요" />

      {showClass && classNames.length > 1 && (
        <Card className="mb-4" hint="반">
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
        </Card>
      )}

      <Card className="mb-4" hint={`${year}년 ${month}월 월간계획안`}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => {
            handleUpload(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />

        {planLoading ? (
          <p className="text-subtle text-[13px] py-3 text-center">불러오는 중…</p>
        ) : plan ? (
          <div>
            {plan.theme && (
              <p className="text-[14px] font-bold text-clay-700 mb-2">
                <SparkleIcon size={14} className="inline mr-1" />
                {plan.theme}
              </p>
            )}
            <ul className="space-y-1.5 mb-3">
              {plan.weeks.map((w) => (
                <li key={w.weekNumber}>
                  <button
                    onClick={() =>
                      navigate(
                        `/weekly-diary/${encodeURIComponent(selectedClass || '_')}/${year}/${month}/${w.weekNumber}`
                      )
                    }
                    className="w-full text-left text-[13px] text-ink hover:text-clay-700 flex items-baseline gap-1 py-0.5"
                  >
                    <span className="font-bold text-clay-500">{w.weekNumber}주</span>
                    {w.subtheme && <span className="text-subtle">· {w.subtheme}</span>}
                    <span className="text-[11px] text-subtle ml-1">
                      (활동 {w.activities.length}개)
                    </span>
                    <span className="ml-auto text-[11px] text-clay-600 font-semibold">
                      주간일지 →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1 py-2.5 rounded-xl bg-cream-100 text-ink text-[13px] font-semibold hover:bg-cream-200 disabled:opacity-50"
              >
                {uploading ? '분석 중…' : '다시 업로드'}
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-2.5 rounded-xl bg-cream-100 text-subtle hover:text-red-500"
                aria-label="삭제"
              >
                <TrashIcon size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full rounded-2xl border border-dashed border-cream-300 py-4 text-[14px] font-semibold text-clay-700 hover:bg-cream-100 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <PlusIcon size={18} />
              {uploading ? 'AI로 분석 중…' : '월간계획안 업로드 (PDF · DOCX)'}
            </button>
            <p className="text-[11px] text-subtle text-center mt-2 leading-relaxed">
              HWP 파일은 한글에서 <strong>[다른 이름으로 저장 → PDF]</strong>로 변환 후 업로드해 주세요.
              <br />
              업로드하면 AI가 4주 활동을 자동으로 정리해 드려요.
            </p>
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <MonthCalendar value={selected} onChange={setSelected} markedDates={markedDates} />
      </Card>

      <Card hint={formatKorean(selected)}>
        {dayRecords.length === 0 ? (
          <p className="text-center text-subtle py-6">이 날짜에 저장된 알림장이 없어요.</p>
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
                  <span className="text-[12px] text-subtle">보기</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
