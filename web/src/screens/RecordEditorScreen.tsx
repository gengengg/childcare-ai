import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import { useToast } from '@/components/Toast';
import {
  CameraIcon,
  CheckIcon,
  CopyIcon,
  PencilIcon,
  PlusIcon,
  SparkleIcon,
  TrashIcon,
  XIcon,
} from '@/components/icons';
import { getChildren, type Child } from '@/lib/children';
import {
  getDailyRecord,
  getTodayKey,
  makeEmptyActivity,
  saveDailyRecord,
  type Activity,
} from '@/lib/dailyRecords';
import { cloneActivitiesWithNewIds, getClassActivity } from '@/lib/classActivities';
import {
  getActiveStyleGuide,
  getAreaLabelsEnabled,
  getEmojiEnabled,
  getLength,
  getTone,
  lengthDirective,
  toneDirective,
  type LengthOption,
  type ToneOption,
} from '@/lib/styleSamples';
import { generateDailyRecordWithAI } from '@/lib/ai';
import { dataUrlToBase64, resizeToDataUrl } from '@/lib/image';

const TONES: { value: ToneOption; label: string }[] = [
  { value: 'professional', label: '전문적으로' },
  { value: 'friendly', label: '다정하게' },
  { value: 'concise', label: '간결하게' },
];
const LENGTHS: { value: LengthOption; label: string }[] = [
  { value: 'short', label: '짧게' },
  { value: 'medium', label: '보통' },
  { value: 'long', label: '자세히' },
];

export function RecordEditorScreen() {
  const { childId = '' } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const draftRef = useRef<HTMLDivElement | null>(null);

  const date = search.get('date') ?? getTodayKey();

  const [children, setChildren] = useState<Child[]>([]);
  const child = useMemo(() => children.find((c) => c.id === childId) ?? null, [children, childId]);

  const [activities, setActivities] = useState<Activity[]>([makeEmptyActivity()]);
  const [mealNote, setMealNote] = useState('');
  const [napNote, setNapNote] = useState('');
  const [healthNote, setHealthNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [tone, setTone] = useState<ToneOption>('professional');
  const [length, setLength] = useState<LengthOption>('medium');

  const [aiDraft, setAiDraft] = useState('');
  const [teacherFinal, setTeacherFinal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');

  useEffect(() => {
    (async () => {
      setChildren(await getChildren());
      setTone(await getTone());
      setLength(await getLength());
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!childId) return;
      const saved = await getDailyRecord(childId, date);
      const classAct = child ? await getClassActivity(child.className, date) : null;
      const savedHasActivities =
        !!saved?.activities?.length &&
        saved.activities.some((a) => a.title.trim() || a.memo.trim());

      if (saved) {
        if (!savedHasActivities && classAct && classAct.activities.length > 0) {
          setActivities(cloneActivitiesWithNewIds(classAct.activities));
        } else {
          setActivities(saved.activities?.length ? saved.activities : [makeEmptyActivity()]);
        }
        setMealNote(saved.mealNote ?? '');
        setNapNote(saved.napNote ?? '');
        setHealthNote(saved.healthNote ?? '');
        setPhotos(saved.photos ?? []);
        setAiDraft(saved.aiDraft ?? '');
        setTeacherFinal(saved.teacherFinal ?? '');
        setSaveState(saved.teacherFinal ? 'saved' : 'idle');
      } else if (classAct && classAct.activities.length > 0) {
        setActivities(cloneActivitiesWithNewIds(classAct.activities));
      }
    })();
  }, [childId, date, child?.className]);

  const update = (id: string, field: keyof Activity, value: string) =>
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  const add = () => setActivities((prev) => [...prev, makeEmptyActivity()]);
  const remove = (id: string) =>
    setActivities((prev) => (prev.length > 1 ? prev.filter((a) => a.id !== id) : prev));

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imgs.length === 0) return;
    try {
      const urls = await Promise.all(imgs.map((f) => resizeToDataUrl(f)));
      setPhotos((prev) => [...prev, ...urls]);
    } catch {
      toast.show('사진을 불러오지 못했어요.', 'error');
    }
  };

  const displayName = child?.name ?? '';

  const handleGenerate = async () => {
    if (!child) {
      toast.show('아이 정보를 찾을 수 없어요.', 'error');
      return;
    }
    if (!activities.some((a) => a.title.trim())) {
      toast.show('활동을 하나 이상 입력해주세요.', 'error');
      return;
    }
    try {
      setIsGenerating(true);
      const [customGuide, emojiEnabled, areaLabelsEnabled] = await Promise.all([
        getActiveStyleGuide(),
        getEmojiEnabled(),
        getAreaLabelsEnabled(),
      ]);
      const composedGuide = [toneDirective(tone), lengthDirective(length), customGuide]
        .filter(Boolean)
        .join('\n');
      const result = await generateDailyRecordWithAI({
        childName: displayName,
        className: child.className,
        date,
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
        areaLabelsEnabled,
      });
      setAiDraft(result.draft);
      setTeacherFinal(result.draft);
      // 자동 저장 (아이별 기록은 childId+date 키로 upsert)
      await persistRecord(result.draft, result.draft);
      setSaveState('saved');
      setTimeout(
        () => draftRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        50
      );
      if (result.isFallback) toast.show('AI 서버 문제로 임시 초안을 저장했어요.', 'error');
      else toast.show('초안 완성 · 자동 저장', 'success');
    } catch {
      toast.show('AI 생성에 실패했어요.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const persistRecord = async (draftText: string, finalText: string) => {
    if (!child || !finalText.trim()) return;
    await saveDailyRecord({
      childId: child.id,
      childName: child.name,
      className: child.className,
      date,
      activities,
      mealNote,
      napNote,
      healthNote,
      aiDraft: draftText,
      teacherFinal: finalText,
    });
  };

  const handleSave = async () => {
    if (!child) return;
    if (!teacherFinal.trim()) {
      toast.show('저장할 내용이 없어요.', 'error');
      return;
    }
    await persistRecord(aiDraft, teacherFinal);
    setSaveState('saved');
    toast.show('저장 완료', 'success');
  };

  const handleCopy = async () => {
    if (!teacherFinal.trim()) return;
    try {
      await navigator.clipboard.writeText(teacherFinal);
      toast.show('클립보드에 복사됐어요.', 'success');
    } catch {
      toast.show('복사에 실패했어요.', 'error');
    }
  };

  if (children.length > 0 && !child) {
    return (
      <>
        <Header back title="찾을 수 없어요" />
        <Card>
          <p className="text-subtle mb-4">아이 정보를 찾을 수 없어요.</p>
          <button className="btn-primary w-full" onClick={() => navigate('/records')}>
            보관함으로 돌아가기
          </button>
        </Card>
      </>
    );
  }

  return (
    <>
      <Header
        back
        icon={<PencilIcon />}
        title={`${displayName || '알림장'} 편집`}
        subtitle={`${date} · ${child?.className ?? ''}`}
      />

      <Card className="mb-4" hint="오늘 무엇을 했나요?">
        <div className="space-y-4">
          {activities.map((act, index) => (
            <div key={act.id} className="rounded-2xl border border-cream-200 p-4 bg-cream-50/60">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-bold text-clay-700">활동 {index + 1}</span>
                {activities.length > 1 && (
                  <button onClick={() => remove(act.id)} className="text-subtle hover:text-red-500 p-1">
                    <TrashIcon size={18} />
                  </button>
                )}
              </div>
              <textarea
                className="field-textarea min-h-[70px]"
                placeholder="예: 텃밭에서 상추 심기"
                value={act.title}
                onChange={(e) => update(act.id, 'title', e.target.value)}
              />
              <textarea
                className="field-textarea min-h-[60px] mt-3"
                placeholder="특이사항 메모 (선택)"
                value={act.memo}
                onChange={(e) => update(act.id, 'memo', e.target.value)}
              />
            </div>
          ))}
          <button
            onClick={add}
            className="w-full rounded-2xl border border-dashed border-cream-300 py-3.5 text-[14px] font-semibold text-clay-600 hover:bg-cream-100 flex items-center justify-center gap-1.5"
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
                handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-2xl border border-dashed border-cream-300 py-3.5 text-[14px] font-semibold text-clay-700 hover:bg-cream-100 flex items-center justify-center gap-2"
            >
              <CameraIcon size={18} /> 사진 넣기
            </button>
            <p className="text-[11px] text-subtle text-center mt-1.5">
              사진은 AI 초안 만들기에만 쓰이고 저장되지 않아요.
            </p>
            {photos.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {photos.map((src, i) => (
                  <div key={i} className="relative aspect-square">
                    <img
                      src={src}
                      className="w-full h-full object-cover rounded-xl border border-cream-200"
                      alt=""
                    />
                    <button
                      onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-ink text-white flex items-center justify-center shadow"
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

      <Card className="mb-4" hint="일상 메모 (선택)">
        <div className="space-y-3">
          <input className="field-input" placeholder="식사" value={mealNote} onChange={(e) => setMealNote(e.target.value)} />
          <input className="field-input" placeholder="수면" value={napNote} onChange={(e) => setNapNote(e.target.value)} />
          <input className="field-input" placeholder="특이사항" value={healthNote} onChange={(e) => setHealthNote(e.target.value)} />
        </div>
      </Card>

      <Card className="mb-4" hint="느낌 고르기">
        <Segmented value={tone} onChange={setTone} options={TONES} className="mb-2" />
        <Segmented value={length} onChange={setLength} options={LENGTHS} />
      </Card>

      <button onClick={handleGenerate} disabled={isGenerating} className="btn-primary w-full py-4 text-[16px] mb-4">
        <SparkleIcon size={18} />
        {isGenerating ? 'AI가 초안을 쓰고 있어요…' : 'AI 초안 만들기'}
      </button>

      {aiDraft && (
        <div ref={draftRef}>
          <Card className="mb-4" hint="최종 알림장">
            <textarea
              className="field-textarea min-h-[300px] text-[15px] leading-7"
              value={teacherFinal}
              onChange={(e) => {
                setTeacherFinal(e.target.value);
                if (saveState === 'saved') setSaveState('idle');
              }}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="btn-outline" onClick={handleCopy}>
                <CopyIcon size={16} /> 복사
              </button>
              <button className="btn-primary py-3" onClick={handleSave}>
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
    </>
  );
}
