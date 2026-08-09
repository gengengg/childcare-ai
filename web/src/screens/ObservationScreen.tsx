import { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Header } from '@/components/Header';
import { MonthCalendar } from '@/components/MonthCalendar';
import { Segmented } from '@/components/Segmented';
import { useToast } from '@/components/Toast';
import {
  CalendarIcon,
  CopyIcon,
  DownloadIcon,
  SparkleIcon,
} from '@/components/icons';
import {
  downloadBlob,
  exportObservationDocx,
  generateObservationStructured,
  type ObservationCategories,
} from '@/lib/ai';
import { getChildren, type Child } from '@/lib/children';
import { getAllDailyRecords, getTodayKey } from '@/lib/dailyRecords';
import {
  getChildObservationNote,
  saveChildObservationNote,
} from '@/lib/childObservations';

type Step = 'setup' | 'edit';
type CalTarget = 'start' | 'end' | null;

const AREAS: { key: keyof ObservationCategories; label: string }[] = [
  { key: '기본생활습관', label: '기본생활습관' },
  { key: '신체건강', label: '신체·건강' },
  { key: '의사소통', label: '의사소통' },
  { key: '사회관계', label: '사회관계' },
  { key: '예술경험', label: '예술경험' },
  { key: '자연탐구', label: '자연탐구' },
  { key: '총평', label: '총평' },
];

const emptyCategories: ObservationCategories = {
  기본생활습관: '',
  신체건강: '',
  의사소통: '',
  사회관계: '',
  예술경험: '',
  자연탐구: '',
  총평: '',
};

export function ObservationScreen() {
  const toast = useToast();

  const [step, setStep] = useState<Step>('setup');
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [calTarget, setCalTarget] = useState<CalTarget>(null);

  const [teacherName, setTeacherName] = useState('');
  const [semester, setSemester] = useState<1 | 2>(1);
  const [observationDate, setObservationDate] = useState(getTodayKey());

  const [notes, setNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const [categories, setCategories] = useState<ObservationCategories>(emptyCategories);
  const [recordCount, setRecordCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await getChildren();
      setChildren(list);
      if (list.length > 0) {
        setSelectedChild(list[0]);
        setNotes(await getChildObservationNote(list[0].id));
      }
    })();
  }, []);

  const selectChild = async (c: Child) => {
    setSelectedChild(c);
    setNotes(await getChildObservationNote(c.id));
  };

  const handleSaveNotes = async () => {
    if (!selectedChild) return;
    setIsSavingNotes(true);
    await saveChildObservationNote(selectedChild.id, notes);
    setIsSavingNotes(false);
    toast.show('관찰 메모를 저장했어요.', 'success');
  };

  const handleGenerate = async () => {
    if (!selectedChild) {
      toast.show('아이를 선택해주세요.', 'error');
      return;
    }
    if (!startDate || !endDate) {
      toast.show('시작일과 종료일을 선택해주세요.', 'error');
      return;
    }

    const allRecords = await getAllDailyRecords();
    const filtered = allRecords.filter(
      (r) =>
        r.childId === selectedChild.id &&
        r.date >= startDate &&
        r.date <= endDate &&
        r.teacherFinal.trim()
    );
    if (filtered.length === 0) {
      toast.show('선택한 기간에 저장된 보육일지가 없어요.', 'error');
      return;
    }
    setRecordCount(filtered.length);
    try {
      setIsGenerating(true);
      const result = await generateObservationStructured({
        childName: selectedChild.name,
        className: selectedChild.className,
        childAge: selectedChild.age ?? 2,
        startDate,
        endDate,
        childObservationNotes: notes,
        records: filtered.map((r) => ({
          date: r.date,
          teacherFinal: r.teacherFinal,
          activities: r.activities ?? [],
          mealNote: r.mealNote,
          napNote: r.napNote,
          healthNote: r.healthNote,
        })),
      });
      setCategories(result);
      setStep('edit');
    } catch {
      toast.show('AI 관찰일지 생성에 실패했어요.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!selectedChild) return;
    if (!teacherName.trim()) {
      toast.show('관찰교사 이름을 입력해주세요.', 'error');
      return;
    }
    try {
      setIsExporting(true);
      const blob = await exportObservationDocx({
        childName: selectedChild.name,
        className: selectedChild.className,
        observationDate,
        teacherName: teacherName.trim(),
        semester,
        content: categories,
      });
      downloadBlob(blob, `관찰일지_${selectedChild.name}_${observationDate}.docx`);
      toast.show('다운로드를 시작했어요.', 'success');
    } catch {
      toast.show('docx 파일 생성에 실패했어요.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyAll = async () => {
    const text = AREAS.map(({ label, key }) => `[${label}]\n${categories[key]}`).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.show('전체 내용을 복사했어요.', 'success');
    } catch {
      toast.show('복사에 실패했어요.', 'error');
    }
  };

  if (step === 'edit') {
    return (
      <>
        <Header
          back
          icon={<SparkleIcon />}
          title="관찰일지 편집"
          subtitle={`${selectedChild?.name} · ${recordCount}개 보육일지 기반`}
        />

        <button
          onClick={() => setStep('setup')}
          className="btn-ghost mb-4 w-full"
        >
          ← 설정으로 돌아가기
        </button>

        <Card className="mb-4" hint="문서 정보">
          <div className="space-y-3">
            <div>
              <div className="text-[13px] font-semibold text-clay-700 mb-2">학기</div>
              <Segmented
                value={String(semester) as '1' | '2'}
                onChange={(v) => setSemester(Number(v) as 1 | 2)}
                options={[
                  { value: '1', label: '1학기' },
                  { value: '2', label: '2학기' },
                ]}
              />
            </div>
            <input
              className="field-input"
              placeholder="관찰교사 이름 (예: 김주희)"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
            />
            <input
              className="field-input"
              placeholder="관찰일시 (예: 2026. 12. 10)"
              value={observationDate}
              onChange={(e) => setObservationDate(e.target.value)}
            />
          </div>
        </Card>

        {AREAS.map(({ key, label }) => (
          <Card key={key} className="mb-3" hint={label}>
            <textarea
              className="field-textarea min-h-[130px]"
              value={categories[key]}
              onChange={(e) =>
                setCategories((prev) => ({ ...prev, [key]: e.target.value }))
              }
              placeholder={`${label} 내용을 입력하세요.`}
            />
          </Card>
        ))}

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="btn-primary w-full py-4 mb-2"
        >
          <DownloadIcon size={18} />
          {isExporting ? 'docx 파일 생성 중…' : 'docx 파일로 저장'}
        </button>
        <button onClick={handleCopyAll} className="btn-outline w-full py-3">
          <CopyIcon size={16} /> 전체 복사
        </button>
      </>
    );
  }

  return (
    <>
      <Header
        back
        icon={<SparkleIcon />}
        title="관찰일지 만들기"
        subtitle="기간과 아이를 고르면 AI가 영역별로 정리해줘요"
      />

      <Card className="mb-4" hint="아이 선택">
        {children.length === 0 ? (
          <p className="text-subtle">등록된 아이가 없어요.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <Chip
                key={c.id}
                active={selectedChild?.id === c.id}
                onClick={() => selectChild(c)}
              >
                {c.name} · 만{c.age}세
              </Chip>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-4" hint="아이 관찰 메모 (선택)">
        <p className="text-[12px] text-subtle mb-3">
          이 아이에 대해 관찰한 내용을 적어두면 관찰일지에 반영돼요.
        </p>
        <textarea
          className="field-textarea min-h-[120px] mb-3"
          placeholder="예: 또래보다 언어 발달이 빠르며 그림책을 좋아함."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button
          onClick={handleSaveNotes}
          disabled={isSavingNotes}
          className="btn-ghost w-full py-3"
        >
          {isSavingNotes ? '저장 중…' : '관찰 메모 저장'}
        </button>
      </Card>

      <Card className="mb-4" hint="보육일지 기간">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => setCalTarget(calTarget === 'start' ? null : 'start')}
            className={
              'rounded-2xl border p-3 text-left transition ' +
              (calTarget === 'start'
                ? 'border-clay-500 bg-clay-500/10'
                : 'border-cream-200 bg-cream-50')
            }
          >
            <div className="text-[11px] text-subtle font-semibold">시작일</div>
            <div className="text-[15px] font-bold text-ink flex items-center gap-1.5">
              <CalendarIcon size={14} className="text-clay-500" />
              {startDate || '선택'}
            </div>
          </button>
          <button
            onClick={() => setCalTarget(calTarget === 'end' ? null : 'end')}
            className={
              'rounded-2xl border p-3 text-left transition ' +
              (calTarget === 'end'
                ? 'border-clay-500 bg-clay-500/10'
                : 'border-cream-200 bg-cream-50')
            }
          >
            <div className="text-[11px] text-subtle font-semibold">종료일</div>
            <div className="text-[15px] font-bold text-ink flex items-center gap-1.5">
              <CalendarIcon size={14} className="text-clay-500" />
              {endDate || '선택'}
            </div>
          </button>
        </div>

        {calTarget && (
          <div className="mt-3 border-t border-cream-200 pt-3">
            <p className="text-[12px] font-semibold text-clay-700 mb-2 text-center">
              {calTarget === 'start' ? '시작일' : '종료일'}을 선택하세요
            </p>
            <MonthCalendar
              value={calTarget === 'start' ? startDate || getTodayKey() : endDate || getTodayKey()}
              onChange={(d) => {
                if (calTarget === 'start') {
                  setStartDate(d);
                  if (endDate && d > endDate) setEndDate('');
                } else {
                  if (startDate && d < startDate) {
                    toast.show('종료일은 시작일보다 이후여야 해요.', 'error');
                    return;
                  }
                  setEndDate(d);
                }
                setCalTarget(null);
              }}
            />
          </div>
        )}
      </Card>

      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="btn-primary w-full py-4 text-[16px] mb-2"
      >
        <SparkleIcon size={18} />
        {isGenerating ? 'AI가 관찰일지를 정리 중…' : 'AI 관찰일지 생성하기'}
      </button>
      <p className="text-center text-[12px] text-subtle">
        생성 후 각 영역 내용을 수정하고 docx로 저장할 수 있어요.
      </p>
    </>
  );
}
