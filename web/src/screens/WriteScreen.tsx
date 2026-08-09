import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Segmented } from '@/components/Segmented';
import { useToast } from '@/components/Toast';
import {
  CalendarIcon,
  CameraIcon,
  CheckIcon,
  CopyIcon,
  GridIcon,
  NoteIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  SparkleIcon,
  TrashIcon,
  UsersIcon,
  XIcon,
} from '@/components/icons';
import { getChildren, type Child } from '@/lib/children';
import {
  ACTIVITY_CATEGORIES,
  getDailyRecord,
  getTodayKey,
  makeEmptyActivity,
  saveDailyRecord,
  type Activity,
} from '@/lib/dailyRecords';
import { cloneActivitiesWithNewIds, getClassActivity } from '@/lib/classActivities';
import {
  getActiveStyleGuide,
  getEmojiEnabled,
  getLength,
  getTone,
  lengthDirective,
  setLength as saveLength,
  setTone as saveTone,
  toneDirective,
  type LengthOption,
  type ToneOption,
} from '@/lib/styleSamples';
import { generateDailyRecordWithAI } from '@/lib/ai';
import { dataUrlToBase64, resizeToDataUrl } from '@/lib/image';
import {
  computeShowClass,
  getDefaultClassName,
  getShowClassSetting,
} from '@/lib/settings';
import { Walkthrough, type TourStep } from '@/components/Walkthrough';
import { hasSeenTour, markTourSeen } from '@/lib/tour';

type WriteMode = 'personal' | 'common';

const TONES: { value: ToneOption; label: string }[] = [
  { value: 'warm', label: '따뜻하게' },
  { value: 'friendly', label: '다정하게' },
  { value: 'concise', label: '간결하게' },
];

const LENGTHS: { value: LengthOption; label: string }[] = [
  { value: 'short', label: '짧게' },
  { value: 'medium', label: '보통' },
  { value: 'long', label: '자세히' },
];

const COMMON_DIRECTIVE =
  '이 알림장은 반 전체에 보내는 공통 알림장입니다. 특정 아이의 이름을 절대 쓰지 말고, ' +
  "'우리 반 친구들', '아이들', '친구들'과 같은 일반적인 표현으로만 작성해주세요. " +
  '아이 이름 뒤에 조사를 붙이는 표현(예: "○○이가", "○○이는")도 사용하지 마세요.';

type ShortcutProps = {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
};

function Shortcut({
  icon,
  label,
  onClick,
  tourKey,
}: ShortcutProps & { tourKey?: string }) {
  return (
    <button
      onClick={onClick}
      data-tour={tourKey}
      className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl
        bg-surface border border-cream-200 text-clay-700
        active:scale-[0.98] active:bg-cream-100 transition"
    >
      {icon}
      <span className="text-[11px] font-bold text-clay-800 leading-tight text-center">
        {label}
      </span>
    </button>
  );
}

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="write-card"]',
    title: '여기서 알림장을 써요',
    description: '활동을 적고 사진을 넣으면 AI가 초안을 만들어 드려요.',
  },
  {
    selector: '[data-tour="mode-toggle"]',
    title: '여러 아이에게 한꺼번에 보낼 땐',
    description:
      "'공통 알림장'을 골라 반 전체용 알림장을 한 번에 작성해요.",
  },
  {
    selector: '[data-tour="class-activity"]',
    title: '반 활동은 미리 저장',
    description:
      '여기서 반 활동을 저장해두면 개인 알림장에 자동으로 담겨요.',
  },
  {
    selector: '[data-tour="observation"]',
    title: '관찰일지도 여기서',
    description: '저장된 알림장으로 관찰일지를 AI가 정리해줘요.',
  },
  {
    selector: '[data-tour="settings"]',
    title: '세부 설정은 여기',
    description: '다크 모드, 문체, 이모지 등을 설정에서 관리해요.',
  },
];

export function WriteScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const draftRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<WriteMode>('personal');

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [manualName, setManualName] = useState<string>('');
  const [commonClassName, setCommonClassName] = useState<string>('');

  const selectedDate = getTodayKey();
  const child = useMemo(
    () => children.find((c) => c.id === selectedChildId) ?? null,
    [children, selectedChildId]
  );

  const classNames = useMemo(
    () => Array.from(new Set(children.map((c) => c.className).filter(Boolean))),
    [children]
  );

  const [activities, setActivities] = useState<Activity[]>([makeEmptyActivity()]);
  const [mealNote, setMealNote] = useState('');
  const [napNote, setNapNote] = useState('');
  const [healthNote, setHealthNote] = useState('');
  const [showDaily, setShowDaily] = useState(false);

  const [photos, setPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [tone, setTone] = useState<ToneOption>('warm');
  const [length, setLength] = useState<LengthOption>('medium');

  const [aiDraft, setAiDraft] = useState('');
  const [teacherFinal, setTeacherFinal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
  const [loadedFromClass, setLoadedFromClass] = useState(false);
  const [showClass, setShowClass] = useState(false);
  const [tourOn, setTourOn] = useState(false);

  useEffect(() => {
    (async () => {
      if (!(await hasSeenTour())) {
        setTimeout(() => setTourOn(true), 500);
      }
    })();
  }, []);

  const finishTour = async () => {
    setTourOn(false);
    await markTourSeen();
  };

  useEffect(() => {
    (async () => {
      const list = await getChildren();
      setChildren(list);
      if (list.length > 0) {
        setSelectedChildId((prev) => prev || list[0].id);
        setCommonClassName((prev) => prev || getDefaultClassName(list));
      }
      setTone(await getTone());
      setLength(await getLength());
      setShowClass(computeShowClass(await getShowClassSetting(), list));
    })();
  }, []);

  // 개인 모드: 아이 바뀔 때 저장 기록 + 반 공통 활동 로드
  useEffect(() => {
    if (mode !== 'personal') return;
    (async () => {
      if (!child) {
        resetForm();
        return;
      }
      const saved = await getDailyRecord(child.id, selectedDate);
      const classAct = await getClassActivity(child.className, selectedDate);
      const savedHasActivities =
        !!saved?.activities?.length &&
        saved.activities.some((a) => a.title.trim() || a.memo.trim());

      if (saved) {
        if (!savedHasActivities && classAct && classAct.activities.length > 0) {
          setActivities(cloneActivitiesWithNewIds(classAct.activities));
          setLoadedFromClass(true);
        } else {
          setActivities(saved.activities?.length ? saved.activities : [makeEmptyActivity()]);
          setLoadedFromClass(false);
        }
        setMealNote(saved.mealNote ?? '');
        setNapNote(saved.napNote ?? '');
        setHealthNote(saved.healthNote ?? '');
        setPhotos(saved.photos ?? []);
        setAiDraft(saved.aiDraft ?? '');
        setTeacherFinal(saved.teacherFinal ?? '');
        setSaveState(saved.teacherFinal ? 'saved' : 'idle');
        setShowDaily(!!(saved.mealNote || saved.napNote || saved.healthNote));
      } else if (classAct && classAct.activities.length > 0) {
        setActivities(cloneActivitiesWithNewIds(classAct.activities));
        setLoadedFromClass(true);
        resetOutputs();
      } else {
        setActivities([makeEmptyActivity()]);
        setLoadedFromClass(false);
        resetOutputs();
      }
    })();
  }, [child?.id, child?.className, selectedDate, mode]);

  // 공통 모드: 반 바뀔 때 공통 활동 로드
  useEffect(() => {
    if (mode !== 'common') return;
    (async () => {
      resetForm();
      if (!commonClassName) return;
      const classAct = await getClassActivity(commonClassName, selectedDate);
      if (classAct && classAct.activities.length > 0) {
        setActivities(cloneActivitiesWithNewIds(classAct.activities));
        setLoadedFromClass(true);
      }
    })();
  }, [commonClassName, selectedDate, mode]);

  function resetOutputs() {
    setMealNote(''); setNapNote(''); setHealthNote('');
    setPhotos([]); setAiDraft(''); setTeacherFinal(''); setSaveState('idle');
    setShowDaily(false);
  }
  function resetForm() {
    setActivities([makeEmptyActivity()]);
    setLoadedFromClass(false);
    resetOutputs();
  }

  const updateActivity = (id: string, field: keyof Activity, value: string) => {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  };
  const addActivity = () => setActivities((prev) => [...prev, makeEmptyActivity()]);
  const removeActivity = (id: string) =>
    setActivities((prev) => (prev.length > 1 ? prev.filter((a) => a.id !== id) : prev));

  const handlePickFiles = async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    try {
      const dataUrls = await Promise.all(arr.map((f) => resizeToDataUrl(f)));
      setPhotos((prev) => [...prev, ...dataUrls]);
    } catch {
      toast.show('사진을 불러오지 못했어요.', 'error');
    }
  };
  const removePhoto = (i: number) =>
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));

  const targetName =
    mode === 'personal'
      ? child?.name ?? manualName.trim()
      : commonClassName.trim();

  const handleGenerate = async () => {
    if (mode === 'personal' && !targetName) {
      toast.show('아이 이름을 선택하거나 입력해주세요.', 'error');
      return;
    }
    if (mode === 'common' && showClass && !commonClassName.trim()) {
      toast.show('반 이름을 선택하거나 입력해주세요.', 'error');
      return;
    }
    if (!activities.some((a) => a.title.trim())) {
      toast.show('오늘 무엇을 했는지 한 줄이라도 적어주세요.', 'error');
      return;
    }
    try {
      setIsGenerating(true);
      const [customGuide, emojiEnabled] = await Promise.all([
        getActiveStyleGuide(),
        getEmojiEnabled(),
      ]);
      const parts = [toneDirective(tone), lengthDirective(length), customGuide];
      if (mode === 'common') parts.unshift(COMMON_DIRECTIVE);
      const composedGuide = parts.filter(Boolean).join('\n');

      const nameForAi =
        mode === 'personal'
          ? targetName
          : '우리 반 친구들';
      const classForAi =
        mode === 'personal'
          ? child?.className ?? '반'
          : commonClassName.trim();

      const result = await generateDailyRecordWithAI({
        childName: nameForAi,
        className: classForAi,
        date: selectedDate,
        activities: activities.map((a) => ({
          category: a.category,
          title: a.title,
          memo: a.memo,
        })),
        mealNote,
        napNote,
        healthNote,
        images: photos.map(dataUrlToBase64),
        styleGuide: composedGuide,
        emojiEnabled,
      });

      setAiDraft(result.draft);
      setTeacherFinal(result.draft);
      setSaveState('idle');
      setTimeout(
        () => draftRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        50
      );
      if (result.isFallback) {
        toast.show('AI 서버에 문제가 있어 임시 초안을 만들었어요.', 'error');
      } else {
        toast.show('초안이 완성됐어요.', 'success');
      }
    } catch {
      toast.show('AI 생성에 실패했어요. 잠시 후 다시 시도해주세요.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!teacherFinal.trim()) {
      toast.show('저장할 내용이 없어요.', 'error');
      return;
    }
    let savingChildId: string;
    let savingChildName: string;
    let savingClassName: string;
    if (mode === 'personal') {
      if (!targetName) {
        toast.show('아이 정보를 확인해주세요.', 'error');
        return;
      }
      savingChildId = child?.id ?? `manual-${targetName}`;
      savingChildName = targetName;
      savingClassName = child?.className ?? '';
    } else {
      const cn = commonClassName.trim();
      if (showClass && !cn) {
        toast.show('반 이름을 확인해주세요.', 'error');
        return;
      }
      savingChildId = cn
        ? `common-${cn}-${selectedDate}`
        : `common-${selectedDate}`;
      savingChildName = cn ? `${cn} 공통` : '공통 알림장';
      savingClassName = cn;
    }
    await saveDailyRecord({
      childId: savingChildId,
      childName: savingChildName,
      className: savingClassName,
      date: selectedDate,
      activities,
      mealNote,
      napNote,
      healthNote,
      photos,
      aiDraft,
      teacherFinal,
    });
    await Promise.all([saveTone(tone), saveLength(length)]);
    setSaveState('saved');
    toast.show('저장 완료', 'success');
  };

  const handleCopy = async () => {
    const text = teacherFinal.trim() || aiDraft.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.show('전체 내용을 복사했어요.', 'success');
    } catch {
      toast.show('복사에 실패했어요.', 'error');
    }
  };

  return (
    <>
      <Header
        icon={<PencilIcon />}
        title="알림장"
        subtitle="사진과 활동만 넣으면 초안이 완성돼요"
        action={
          <button
            onClick={() => navigate('/settings')}
            aria-label="설정"
            data-tour="settings"
            className="w-10 h-10 rounded-full flex items-center justify-center text-clay-700
              bg-cream-100 active:bg-cream-200 transition"
          >
            <SettingsIcon size={20} />
          </button>
        }
      />

      {/* 빠른 이동 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Shortcut
          icon={<GridIcon size={20} />}
          label="반 공통 활동"
          onClick={() => navigate('/class-activity')}
          tourKey="class-activity"
        />
        <Shortcut
          icon={<NoteIcon size={20} />}
          label="관찰일지"
          onClick={() => navigate('/observation')}
          tourKey="observation"
        />
        <Shortcut
          icon={<CalendarIcon size={20} />}
          label="달력"
          onClick={() => navigate('/calendar')}
        />
      </div>

      {/* 모드 토글 */}
      <div data-tour="mode-toggle" className="mb-4">
        <Segmented
          value={mode}
          onChange={(v) => {
            setMode(v);
            setSaveState('idle');
          }}
          options={[
            { value: 'personal', label: '개인 알림장' },
            { value: 'common', label: '공통 알림장' },
          ]}
        />
      </div>

      {mode === 'personal' ? (
        <Card className="mb-4" hint="누구의 알림장인가요?">
          <input
            className="field-input mb-3"
            placeholder="아이 이름"
            value={child ? child.name : manualName}
            onChange={(e) => {
              if (child) return;
              setManualName(e.target.value);
            }}
            disabled={!!child}
          />
          {children.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {children.map((c) => (
                <Chip
                  key={c.id}
                  active={selectedChildId === c.id}
                  onClick={() => {
                    setManualName('');
                    setSelectedChildId((prev) => (prev === c.id ? '' : c.id));
                  }}
                >
                  {c.name}
                </Chip>
              ))}
              <Chip onClick={() => navigate('/children')}>+ 아이 추가</Chip>
            </div>
          ) : (
            <button
              onClick={() => navigate('/children')}
              className="btn-ghost w-full"
            >
              <UsersIcon size={16} /> 아이 관리
            </button>
          )}
        </Card>
      ) : showClass ? (
        <Card className="mb-4" hint="어느 반의 공통 알림장인가요?">
          <input
            className="field-input mb-3"
            placeholder="반 이름 (예: 별님반)"
            value={commonClassName}
            onChange={(e) => setCommonClassName(e.target.value)}
          />
          {classNames.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {classNames.map((cn) => (
                <Chip
                  key={cn}
                  active={commonClassName === cn}
                  onClick={() => setCommonClassName(cn)}
                >
                  {cn}
                </Chip>
              ))}
            </div>
          )}
          <p className="text-[12px] text-subtle mt-3 leading-relaxed">
            공통 알림장은 아이 이름 없이 반 전체를 대상으로 작성돼요.
            같은 활동을 아이들에게 동일하게 보낼 때 편해요.
          </p>
        </Card>
      ) : (
        <Card className="mb-4" hint="공통 알림장">
          <p className="text-[12px] text-subtle leading-relaxed">
            공통 알림장은 아이 이름 없이 반 전체를 대상으로 작성돼요.
            같은 활동을 아이들에게 동일하게 보낼 때 편해요.
          </p>
        </Card>
      )}

      <Card className="mb-4" hint="오늘 무엇을 했나요?" data-tour="write-card">
        {loadedFromClass && (
          <div className="rounded-xl bg-clay-500/10 border border-clay-500/30 px-3 py-2 mb-4 text-[13px] font-semibold text-clay-700 flex items-center gap-2">
            <CheckIcon size={14} /> 반 공통 활동을 불러왔어요.
          </div>
        )}
        <div className="space-y-4">
          {activities.map((act, index) => (
            <div key={act.id} className="rounded-2xl border border-cream-200 p-4 bg-cream-50/60">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-bold text-clay-700">활동 {index + 1}</span>
                {activities.length > 1 && (
                  <button
                    className="text-subtle hover:text-red-500 p-1"
                    onClick={() => removeActivity(act.id)}
                    aria-label="활동 삭제"
                  >
                    <TrashIcon size={18} />
                  </button>
                )}
              </div>

              <textarea
                className="field-textarea min-h-[70px]"
                placeholder="예: 텃밭에서 상추 심기, 친구들과 블록 놀이"
                value={act.title}
                onChange={(e) => updateActivity(act.id, 'title', e.target.value)}
              />

              <div className="mt-3 flex flex-wrap gap-1.5">
                {ACTIVITY_CATEGORIES.map((cat) => (
                  <Chip
                    key={cat}
                    active={act.category === cat}
                    onClick={() =>
                      updateActivity(act.id, 'category', act.category === cat ? '' : cat)
                    }
                  >
                    {cat}
                  </Chip>
                ))}
              </div>

              {act.category || act.memo ? (
                <textarea
                  className="field-textarea min-h-[60px] mt-3"
                  placeholder="특이사항 메모 (선택)"
                  value={act.memo}
                  onChange={(e) => updateActivity(act.id, 'memo', e.target.value)}
                />
              ) : (
                <button
                  onClick={() => updateActivity(act.id, 'memo', ' ')}
                  className="mt-3 text-[13px] font-semibold text-clay-600 underline underline-offset-4"
                >
                  + 특이사항 메모 추가
                </button>
              )}
            </div>
          ))}

          <button
            onClick={addActivity}
            className="w-full rounded-2xl border border-dashed border-cream-300 py-3.5 text-[14px] font-semibold text-clay-600
              hover:bg-cream-100 transition flex items-center justify-center gap-1.5"
          >
            <PlusIcon size={18} /> 활동 추가하기
          </button>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handlePickFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-2xl border border-dashed border-cream-300 py-3.5 text-[14px] font-semibold text-clay-700
                hover:bg-cream-100 transition flex items-center justify-center gap-2"
            >
              <CameraIcon size={18} /> 사진 넣기 (선택)
            </button>

            {photos.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {photos.map((src, i) => (
                  <div key={i} className="relative aspect-square">
                    <img
                      src={src}
                      alt=""
                      className="w-full h-full object-cover rounded-xl border border-cream-200"
                    />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-ink text-white flex items-center justify-center shadow"
                      aria-label="사진 삭제"
                    >
                      <XIcon size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <button
          onClick={() => setShowDaily((v) => !v)}
          className="w-full flex items-center justify-between text-clay-800"
        >
          <span className="section-title mb-0">일상 메모 (선택)</span>
          <span className="text-[13px] text-subtle">{showDaily ? '접기' : '열기'}</span>
        </button>
        {showDaily && (
          <div className="mt-4 space-y-3">
            <input
              className="field-input"
              placeholder="식사 · 예: 점심을 골고루 먹었어요"
              value={mealNote}
              onChange={(e) => setMealNote(e.target.value)}
            />
            <input
              className="field-input"
              placeholder="수면 · 예: 낮잠 1시간 20분"
              value={napNote}
              onChange={(e) => setNapNote(e.target.value)}
            />
            <input
              className="field-input"
              placeholder="특이사항 · 예: 컨디션, 친구 관계, 알림 등"
              value={healthNote}
              onChange={(e) => setHealthNote(e.target.value)}
            />
          </div>
        )}
      </Card>

      <Card className="mb-4" hint="느낌 고르기">
        <Segmented value={tone} onChange={setTone} options={TONES} className="mb-2" />
        <Segmented value={length} onChange={setLength} options={LENGTHS} />
      </Card>

      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="btn-primary w-full py-4 text-[16px] mb-4"
      >
        <SparkleIcon size={18} />
        {isGenerating ? 'AI가 초안을 쓰고 있어요…' : 'AI 초안 만들기'}
      </button>

      {aiDraft && (
        <div ref={draftRef} className="scroll-mt-4">
          <Card className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-bold text-clay-700">
                {mode === 'common' ? '공통 알림장' : '최종 알림장'}
              </span>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-pill bg-clay-500 text-white
                  py-1.5 px-3 text-[12px] font-bold shadow-pop active:bg-clay-600"
              >
                <CopyIcon size={14} /> 전체 복사
              </button>
            </div>
            <textarea
              className="field-textarea min-h-[300px] text-[15px] leading-7"
              value={teacherFinal}
              onChange={(e) => {
                setTeacherFinal(e.target.value);
                if (saveState === 'saved') setSaveState('idle');
              }}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={handleCopy} className="btn-outline">
                <CopyIcon size={16} /> 복사
              </button>
              <button onClick={handleSave} className="btn-primary py-3">
                {saveState === 'saved' ? (
                  <>
                    <CheckIcon size={16} /> 저장됨
                  </>
                ) : (
                  '저장하기'
                )}
              </button>
            </div>
          </Card>
        </div>
      )}

      {tourOn && <Walkthrough steps={TOUR_STEPS} onFinish={finishTour} />}
    </>
  );
}
