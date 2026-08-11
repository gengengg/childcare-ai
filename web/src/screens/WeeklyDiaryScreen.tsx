import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { useToast } from '@/components/Toast';
import { CalendarIcon, SparkleIcon } from '@/components/icons';
import { getMonthlyPlan, weekOfMonth, type MonthlyPlan } from '@/lib/monthlyPlans';
import {
  WEEK_DAYS,
  WEEKDAYS_MON_TO_FRI,
  activitiesPerDayToSlots,
  autoDistribute,
  collectActivitiesForWeek,
  collectRecordsForWeek,
  datesForWeek,
  daySlotsHasContent,
  emptyDaySlots,
  exportWeeklyDiaryDocx,
  generateWeeklyEvaluations,
  getWeeklyDiary,
  saveWeeklyDiary,
  type DaySlots,
  type WeekDay,
} from '@/lib/weeklyDiaries';
import { getActiveStyleGuide } from '@/lib/styleSamples';
import { getChildren } from '@/lib/children';
import {
  computeShowClass,
  getDefaultClassName,
  getShowClassSetting,
} from '@/lib/settings';

const STD_SLOTS = [
  { key: '등원 및 통합보육', time: '07:30~09:00' },
  { key: '손씻기 및 오전 간식', time: '09:00~09:30' },
  { key: '점심식사 & 배변', time: '11:40~12:10' },
  { key: '낮잠 및 휴식', time: '12:40~14:30' },
  { key: '손씻기 및 오후 간식', time: '14:30~15:00' },
  { key: '오후 자유놀이', time: '15:00~17:00' },
  { key: '통합보육 및 귀가', time: '17:00~19:30' },
];

export function WeeklyDiaryScreen() {
  const nav = useNavigate();
  const toast = useToast();
  const params = useParams();

  // URL 파라미터: /weekly-diary/:className/:year/:month/:week
  // '_' 는 반 이름 없음(단일반 사용자) 플레이스홀더
  const rawClass = decodeURIComponent(params.className ?? '');
  const urlClass = rawClass === '_' ? '' : rawClass;
  const urlYear = Number(params.year);
  const urlMonth = Number(params.month);
  const urlWeek = Number(params.week);

  const [className, setClassName] = useState(urlClass);
  const [year] = useState(urlYear);
  const [month] = useState(urlMonth);
  const [weekNumber] = useState(urlWeek);

  const dates = useMemo(
    () => datesForWeek(year, month, weekNumber),
    [year, month, weekNumber]
  );

  const [ageGroup, setAgeGroup] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [theme, setTheme] = useState('');
  const [subtheme, setSubtheme] = useState('');
  const [expectations, setExpectations] = useState('');
  const [days, setDays] = useState<Record<string, DaySlots>>(() => {
    const init = {} as Record<string, DaySlots>;
    for (const d of WEEK_DAYS) init[d] = emptyDaySlots();
    return init;
  });
  const [evaluations, setEvaluations] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<MonthlyPlan | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [loadingFromRecords, setLoadingFromRecords] = useState(false);
  const [generatingEval, setGeneratingEval] = useState(false);
  const [exporting, setExporting] = useState(false);
  // 토요일은 기본 숨김. 기존 데이터에 토가 있으면 자동으로 켬. 사용자가 토글로 켤 수도 있음.
  const [showSaturday, setShowSaturday] = useState(false);

  const visibleDays = useMemo<WeekDay[]>(
    () => (showSaturday ? [...WEEK_DAYS] : [...WEEKDAYS_MON_TO_FRI]),
    [showSaturday]
  );

  // 반 없으면 기본 반으로 폴백 (단일 반 사용자 대응)
  useEffect(() => {
    if (className) return;
    (async () => {
      const kids = await getChildren();
      const setting = await getShowClassSetting();
      if (!computeShowClass(setting, kids)) {
        setClassName(getDefaultClassName(kids));
      }
    })();
  }, [className]);

  // 초기 로드
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [existing, monthlyPlan] = await Promise.all([
          getWeeklyDiary(className, year, month, weekNumber),
          getMonthlyPlan(className, year, month),
        ]);
        setPlan(monthlyPlan);
        if (existing) {
          setAgeGroup(existing.ageGroup);
          setTeacherName(existing.teacherName);
          setDirectorName(existing.directorName);
          setTheme(existing.theme);
          setSubtheme(existing.subtheme);
          setExpectations(existing.expectations);
          setDays(fillMissingDays(existing.days));
          setEvaluations(existing.evaluations);
          // 기존 데이터에 토 내용 있으면 자동으로 켜기
          if (
            daySlotsHasContent(existing.days?.['토']) ||
            (existing.evaluations?.['토'] || '').trim()
          ) {
            setShowSaturday(true);
          }
        } else if (monthlyPlan) {
          // 신규 작성: 월간계획안에서 헤더 자동 채움
          setTheme(monthlyPlan.theme);
          const wk = monthlyPlan.weeks.find((w) => w.weekNumber === weekNumber);
          if (wk) setSubtheme(wk.subtheme);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [className, year, month, weekNumber]);

  const updateSlot = (day: WeekDay, key: keyof DaySlots, value: string) => {
    setDays((prev) => ({ ...prev, [day]: { ...(prev[day] ?? emptyDaySlots()), [key]: value } }));
  };
  const updateEval = (day: WeekDay, value: string) => {
    setEvaluations((prev) => ({ ...prev, [day]: value }));
  };

  const handleAutoDistribute = async () => {
    if (!plan) {
      toast.show('월간계획안이 등록되어 있지 않아요.', 'error');
      return;
    }
    const wk = plan.weeks.find((w) => w.weekNumber === weekNumber);
    if (!wk || wk.activities.length === 0) {
      toast.show('이 주에 등록된 활동이 없어요.', 'error');
      return;
    }
    setDistributing(true);
    try {
      const distributed = autoDistribute(wk.activities, visibleDays);
      // 기존 값이 있는 셀은 유지, 빈 셀만 채움
      setDays((prev) => {
        const next = { ...prev };
        for (const d of visibleDays) {
          const existing = prev[d] ?? emptyDaySlots();
          const filled = distributed[d];
          next[d] = {
            morningFree: existing.morningFree || filled.morningFree,
            outdoor: existing.outdoor || filled.outdoor,
            special: existing.special || filled.special,
          };
        }
        return next;
      });
      toast.show(`${wk.activities.length}개 활동을 요일별로 배분했어요.`, 'success');
    } finally {
      setDistributing(false);
    }
  };

  const handleLoadFromRecords = async () => {
    setLoadingFromRecords(true);
    try {
      const perDay = await collectActivitiesForWeek(className, dates);
      const total = visibleDays.reduce((n, d) => n + (perDay[d]?.length ?? 0), 0);
      if (total === 0) {
        toast.show('이 주에 저장된 알림장 활동이 없어요.', 'error');
        return;
      }
      const fromRecords = activitiesPerDayToSlots(perDay);
      // 알림장 활동을 우선 반영: 알림장에 있는 활동은 기존 값을 덮어씀.
      // 알림장에 해당 슬롯 활동이 없으면 기존 값 유지.
      setDays((prev) => {
        const next = { ...prev };
        for (const d of visibleDays) {
          const existing = prev[d] ?? emptyDaySlots();
          const rec = fromRecords[d] ?? emptyDaySlots();
          next[d] = {
            morningFree: rec.morningFree || existing.morningFree,
            outdoor: rec.outdoor || existing.outdoor,
            special: rec.special || existing.special,
          };
        }
        return next;
      });
      toast.show(`알림장에서 활동 ${total}개를 불러왔어요.`, 'success');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '알림장 불러오기 실패', 'error');
    } finally {
      setLoadingFromRecords(false);
    }
  };

  const handleGenerateEvaluations = async () => {
    setGeneratingEval(true);
    try {
      const records = await collectRecordsForWeek(className, dates);
      const styleGuide = await getActiveStyleGuide();
      const result = await generateWeeklyEvaluations({
        className,
        year,
        month,
        weekNumber,
        ageGroup,
        theme,
        subtheme,
        styleGuide,
        days: visibleDays,
        dates,
        slots: days,
        records,
      });
      // 기존 총평이 비어있는 것만 채움
      setEvaluations((prev) => {
        const next = { ...prev };
        for (const d of visibleDays) {
          if (!prev[d] && result[d]) next[d] = result[d];
        }
        return next;
      });
      toast.show('총평 초안을 생성했어요. 검토하고 저장해 주세요.', 'success');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '총평 생성 실패', 'error');
    } finally {
      setGeneratingEval(false);
    }
  };

  const handleExportDocx = async () => {
    setExporting(true);
    try {
      await exportWeeklyDiaryDocx({
        className,
        year,
        month,
        weekNumber,
        ageGroup,
        teacherName,
        directorName,
        theme,
        subtheme,
        expectations,
        days,
        evaluations,
        dates,
      });
      toast.show('DOCX 파일이 다운로드됐어요.', 'success');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'DOCX 생성 실패', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveWeeklyDiary({
        className,
        year,
        month,
        weekNumber,
        ageGroup,
        teacherName,
        directorName,
        theme,
        subtheme,
        expectations,
        days,
        evaluations,
      });
      toast.show('저장했어요.', 'success');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '저장 실패', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header back icon={<CalendarIcon />} title="주간보육일지" />
        <p className="text-center text-subtle py-10">불러오는 중…</p>
      </>
    );
  }

  return (
    <>
      <Header
        back
        icon={<CalendarIcon />}
        title={`${month}월 ${weekNumber}주 주간보육일지`}
        subtitle={className ? `${className} · ${year}년` : `${year}년`}
      />

      <Card className="mb-4" hint="기본 정보">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input
            className="field-input"
            placeholder="대상 (예: 만 2세)"
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
          />
          <input
            className="field-input"
            placeholder="담임"
            value={teacherName}
            onChange={(e) => setTeacherName(e.target.value)}
          />
        </div>
        <input
          className="field-input mb-2"
          placeholder="원장"
          value={directorName}
          onChange={(e) => setDirectorName(e.target.value)}
        />
        <input
          className="field-input mb-2"
          placeholder="놀이 주제 (월간 큰 주제)"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        />
        <input
          className="field-input mb-2"
          placeholder="예상 놀이 (그 주 부제)"
          value={subtheme}
          onChange={(e) => setSubtheme(e.target.value)}
        />
        <textarea
          className="field-textarea min-h-[70px]"
          placeholder="교사의 기대"
          value={expectations}
          onChange={(e) => setExpectations(e.target.value)}
        />
      </Card>

      {/* 액션 3종 + 요일 바로가기 — 스크롤 시 상단 고정 */}
      <div className="sticky top-0 z-30 -mx-5 px-5 pt-3 pb-2 mb-3 bg-cream-50/95 backdrop-blur border-b border-cream-200">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            onClick={handleAutoDistribute}
            disabled={distributing}
            className="py-2 rounded-xl bg-cream-100 text-ink text-[12px] font-semibold hover:bg-cream-200 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <SparkleIcon size={12} />
            {distributing ? '배분 중…' : '월간계획안 자동 배분'}
          </button>
          <button
            onClick={handleLoadFromRecords}
            disabled={loadingFromRecords}
            className="py-2 rounded-xl bg-cream-100 text-ink text-[12px] font-semibold hover:bg-cream-200 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <SparkleIcon size={12} />
            {loadingFromRecords ? '불러오는 중…' : '알림장에서 활동 불러오기'}
          </button>
          <button
            onClick={handleGenerateEvaluations}
            disabled={generatingEval}
            className="col-span-2 py-2 rounded-xl bg-clay-500/10 text-clay-700 text-[12px] font-semibold hover:bg-clay-500/20 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <SparkleIcon size={12} />
            {generatingEval ? '생성 중…' : '총평 AI 자동 생성'}
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {visibleDays.map((day) => (
            <button
              key={day}
              onClick={() => {
                document
                  .getElementById(`day-${day}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="flex-1 min-w-[44px] py-1.5 rounded-xl bg-surface border border-cream-200 text-[13px] font-bold text-clay-700 hover:bg-clay-500 hover:text-white hover:border-clay-500 transition"
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {visibleDays.map((day) => {
        const date = dates[day];
        const slots = days[day] ?? emptyDaySlots();
        return (
          <div key={day} id={`day-${day}`} className="scroll-mt-40">
          <Card className="mb-4" hint={`${day}요일 · ${date}`}>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold text-subtle mb-1">
                  오전 자유놀이 (09:30~10:30)
                </p>
                <textarea
                  className="field-textarea min-h-[54px] text-[13px]"
                  placeholder="예: 동물 이름에 끼적여요"
                  value={slots.morningFree}
                  onChange={(e) => updateSlot(day, 'morningFree', e.target.value)}
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-subtle mb-1">
                  실외놀이 및 대체활동 (10:30~11:40)
                </p>
                <textarea
                  className="field-textarea min-h-[54px] text-[13px]"
                  placeholder="예: (바깥놀이) 자연물로 동물 만들기"
                  value={slots.outdoor}
                  onChange={(e) => updateSlot(day, 'outdoor', e.target.value)}
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-subtle mb-1">
                  특별활동 (12:10~12:40)
                </p>
                <input
                  className="field-input text-[13px]"
                  placeholder="예: 오감놀이 / 영어 / 체육"
                  value={slots.special}
                  onChange={(e) => updateSlot(day, 'special', e.target.value)}
                />
              </div>
              <div className="pt-2 border-t border-cream-200">
                <p className="text-[11px] font-semibold text-subtle mb-1">
                  총평 및 활동평가
                </p>
                <textarea
                  className="field-textarea min-h-[110px] text-[13px]"
                  placeholder={`${day}요일 관찰 서술 (AI 자동 생성 가능)`}
                  value={evaluations[day] ?? ''}
                  onChange={(e) => updateEval(day, e.target.value)}
                />
              </div>
            </div>
          </Card>
          </div>
        );
      })}

      <button
        onClick={() => {
          if (showSaturday) {
            // 토 내용 비우고 숨김
            setDays((prev) => ({ ...prev, 토: emptyDaySlots() }));
            setEvaluations((prev) => {
              const next = { ...prev };
              delete next['토'];
              return next;
            });
          }
          setShowSaturday((v) => !v);
        }}
        className="w-full mb-4 py-3 rounded-2xl border border-dashed border-cream-300 text-[13px] font-semibold text-clay-600 hover:bg-cream-100"
      >
        {showSaturday ? '토요일 숨기기' : '+ 토요일 추가'}
      </button>

      <details className="mb-4">
        <summary className="text-[12px] text-subtle cursor-pointer py-2 px-1">
          매일 반복되는 표준 시간대 (참고, 저장 안 됨)
        </summary>
        <Card className="mt-2">
          <ul className="space-y-1.5 text-[12px] text-subtle">
            {STD_SLOTS.map((s) => (
              <li key={s.key}>
                <span className="font-semibold text-ink">{s.key}</span> · {s.time}
              </li>
            ))}
          </ul>
        </Card>
      </details>

      <div className="flex gap-2 mb-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex-1 py-4"
        >
          {saving ? '저장 중…' : '주간일지 저장'}
        </button>
        <button
          onClick={handleExportDocx}
          disabled={exporting}
          className="flex-1 py-4 rounded-2xl border border-clay-500/40 bg-surface text-clay-700 text-[14px] font-semibold hover:bg-clay-500/5 disabled:opacity-50"
        >
          {exporting ? '생성 중…' : 'DOCX 다운로드'}
        </button>
      </div>
    </>
  );
}

function fillMissingDays(days: Record<string, DaySlots>): Record<string, DaySlots> {
  const next = { ...days };
  for (const d of WEEK_DAYS) {
    if (!next[d]) next[d] = emptyDaySlots();
  }
  return next;
}
