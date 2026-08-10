import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Header } from '@/components/Header';
import { useToast } from '@/components/Toast';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  NoteIcon,
  PlusIcon,
  SparkleIcon,
  TrashIcon,
} from '@/components/icons';
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
import { SkeletonLines } from '@/components/Skeleton';

/**
 * '주간일지' 탭의 홈 화면.
 * - 월 이동
 * - 반 선택 (다반일 때)
 * - 이 달의 월간계획안 (업로드/편집/삭제)
 * - 이 달의 주간일지 진입 카드 (1~5주)
 */
export function WeeklyHubScreen() {
  const navigate = useNavigate();
  const toast = useToast();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [children, setChildren] = useState<Child[]>([]);
  const [showClass, setShowClass] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');

  const [plan, setPlan] = useState<MonthlyPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const [kids, setting] = await Promise.all([
        getChildren(),
        getShowClassSetting(),
      ]);
      setChildren(kids);
      setShowClass(computeShowClass(setting, kids));
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

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

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
      const saved = await saveMonthlyPlan({
        className: selectedClass,
        year: parsed.year ?? year,
        month: parsed.month ?? month,
        theme: parsed.theme,
        weeks: parsed.weeks,
      });
      if (saved.year !== year || saved.month !== month) {
        setYear(saved.year);
        setMonth(saved.month);
        toast.show(
          `${saved.year}년 ${saved.month}월 계획안으로 저장했어요.`,
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

  const openWeeklyDiary = (weekNumber: number) => {
    navigate(
      `/weekly-diary/${encodeURIComponent(selectedClass || '_')}/${year}/${month}/${weekNumber}`
    );
  };

  // 주 개수: 월간계획안이 있으면 그 개수, 없으면 4주 기본
  const weekCount = plan?.weeks.length || 4;
  const weekNumbers = Array.from({ length: weekCount }, (_, i) => i + 1);

  return (
    <>
      <Header
        icon={<NoteIcon />}
        title="학급 운영"
        subtitle="월간계획안과 주간보육일지"
      />

      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          onClick={() => shiftMonth(-1)}
          className="w-9 h-9 rounded-full hover:bg-cream-100 flex items-center justify-center text-clay-700"
          aria-label="이전 달"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <div className="text-center">
          <div className="text-[13px] text-subtle font-medium">{year}년</div>
          <div className="text-[22px] font-extrabold text-ink -mt-0.5">{month}월</div>
        </div>
        <button
          onClick={() => shiftMonth(1)}
          className="w-9 h-9 rounded-full hover:bg-cream-100 flex items-center justify-center text-clay-700"
          aria-label="다음 달"
        >
          <ChevronRightIcon size={18} />
        </button>
      </div>

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

      {/* 월간계획안 카드 */}
      <Card className="mb-4" hint="이 달의 월간계획안">
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
          <SkeletonLines lines={2} />
        ) : plan ? (
          <div>
            {plan.theme && (
              <div className="mb-3 pb-3 border-b border-cream-200">
                <p className="text-[11px] font-bold text-clay-500 tracking-wide mb-1">
                  놀이 주제
                </p>
                <p className="text-[15px] font-bold text-ink leading-tight">
                  {plan.theme}
                </p>
              </div>
            )}
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
              HWP 파일은 한글에서 <strong>[PDF로 저장]</strong> 후 업로드해 주세요.
              <br />
              AI가 4주 활동을 자동으로 정리합니다.
            </p>
          </div>
        )}
      </Card>

      {/* 주간일지 카드들 */}
      <div className="space-y-2.5">
        {weekNumbers.map((wn) => {
          const wk = plan?.weeks.find((w) => w.weekNumber === wn);
          return (
            <button
              key={wn}
              onClick={() => openWeeklyDiary(wn)}
              className="w-full text-left bg-surface rounded-card shadow-card border border-cream-200/60 p-4 hover:border-clay-300 transition group"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-clay-500/10 text-clay-700 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold leading-none">주</span>
                  <span className="text-[18px] font-extrabold leading-none mt-0.5">
                    {wn}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-ink">{month}월 {wn}주</p>
                  {wk?.subtheme ? (
                    <p className="text-[13px] text-subtle mt-0.5 truncate">
                      {wk.subtheme}
                    </p>
                  ) : (
                    <p className="text-[12px] text-subtle mt-0.5">주간보육일지 작성/수정</p>
                  )}
                  {wk && (
                    <p className="text-[11px] text-clay-500 font-semibold mt-1">
                      계획된 활동 {wk.activities.length}개
                    </p>
                  )}
                </div>
                <div className="text-cream-400 group-hover:text-clay-500 transition self-center">
                  <ChevronRightIcon size={18} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 캘린더 진입 (부가) */}
      <button
        onClick={() => navigate('/calendar')}
        className="w-full mt-4 py-3 rounded-2xl bg-cream-100 text-clay-700 text-[13px] font-semibold hover:bg-cream-200 flex items-center justify-center gap-2"
      >
        <CalendarIcon size={16} />
        날짜별 알림장 달력으로 보기
      </button>

      <div className="h-6" />
    </>
  );
}
