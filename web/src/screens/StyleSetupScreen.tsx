import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import { useToast } from '@/components/Toast';
import { CameraIcon, PlusIcon, SparkleIcon, TrashIcon } from '@/components/icons';
import { analyzeStyleSamples, type StyleSampleInput } from '@/lib/ai';
import { getChildren, type Child } from '@/lib/children';
import { markOnboardingSeen } from '@/lib/onboarding';
import {
  MAX_STYLE_SAMPLES,
  getEmojiEnabled,
  getStyleSamples,
  makeId,
  setEmojiEnabled,
  setStyleGuide,
  setStyleMode,
  setStyleSamples,
  type StyleSample,
} from '@/lib/styleSamples';
import {
  computeShowClass,
  getShowClassSetting,
  setShowClassSetting,
  type ShowClassSetting,
} from '@/lib/settings';
import { dataUrlToBase64, resizeToDataUrl } from '@/lib/image';

export function StyleSetupScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const [samples, setSamples] = useState<StyleSample[]>([]);
  const [draftText, setDraftText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fromSettings, setFromSettings] = useState(false);
  const [emojiOn, setEmojiOn] = useState(true);
  const [classSetting, setClassSetting] = useState<ShowClassSetting>('auto');
  const [children, setChildren] = useState<Child[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await getStyleSamples();
      if (stored.length > 0) {
        setSamples(stored);
        setFromSettings(true);
      }
      setEmojiOn(await getEmojiEnabled());
      setClassSetting(await getShowClassSetting());
      setChildren(await getChildren());
    })();
  }, []);

  const effectiveShowClass = computeShowClass(classSetting, children);

  const handleClassSetting = async (v: ShowClassSetting) => {
    setClassSetting(v);
    await setShowClassSetting(v);
  };

  const toggleEmoji = async () => {
    const next = !emojiOn;
    setEmojiOn(next);
    await setEmojiEnabled(next);
  };

  const remaining = MAX_STYLE_SAMPLES - samples.length;

  const addText = () => {
    const text = draftText.trim();
    if (!text) {
      toast.show('내용을 입력해주세요.', 'error');
      return;
    }
    if (samples.length >= MAX_STYLE_SAMPLES) {
      toast.show(`샘플은 최대 ${MAX_STYLE_SAMPLES}개까지 등록할 수 있어요.`, 'error');
      return;
    }
    setSamples((prev) => [...prev, { id: makeId(), kind: 'text', text }]);
    setDraftText('');
  };

  const addImages = async (files: FileList | null) => {
    if (!files || samples.length >= MAX_STYLE_SAMPLES) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, remaining);
    try {
      const dataUrls = await Promise.all(arr.map((f) => resizeToDataUrl(f, 1400)));
      const newSamples: StyleSample[] = dataUrls.map((url) => ({
        id: makeId(),
        kind: 'image',
        uri: url,
        base64: dataUrlToBase64(url),
      }));
      setSamples((prev) => [...prev, ...newSamples].slice(0, MAX_STYLE_SAMPLES));
    } catch {
      toast.show('이미지 첨부에 실패했어요.', 'error');
    }
  };

  const removeSample = (id: string) => setSamples((prev) => prev.filter((s) => s.id !== id));

  const goToNextAfterSetup = async () => {
    const kids = await getChildren();
    if (kids.length === 0) {
      navigate('/children');
    } else {
      navigate('/');
    }
  };

  const handleSkip = async () => {
    await setStyleMode('default');
    await setStyleGuide('');
    await setStyleSamples([]);
    await markOnboardingSeen();
    toast.show('기본 문체로 저장했어요.');
    await goToNextAfterSetup();
  };

  const handleAnalyze = async () => {
    if (samples.length === 0) {
      toast.show('최소 1개 샘플이 필요해요.', 'error');
      return;
    }
    try {
      setIsAnalyzing(true);
      const inputs: StyleSampleInput[] = samples.map((s) =>
        s.kind === 'text'
          ? { kind: 'text', text: s.text }
          : { kind: 'image', imageBase64: s.base64 }
      );
      const guide = await analyzeStyleSamples(inputs);
      if (!guide) throw new Error('문체 가이드가 비어있어요.');
      await setStyleSamples(samples);
      await setStyleGuide(guide);
      await setStyleMode('custom');
      await markOnboardingSeen();
      toast.show('문체 학습을 완료했어요.', 'success');
      await goToNextAfterSetup();
    } catch (e: any) {
      toast.show(e?.message ?? '학습에 실패했어요.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      <Header
        back
        icon={<SparkleIcon />}
        title="문체 설정"
        subtitle={`샘플을 최대 ${MAX_STYLE_SAMPLES}개까지 등록하면 AI가 그 톤으로 써 드려요`}
      />

      <Card className="mb-4" hint="이모티콘 사용">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[14px] text-clay-800 font-semibold">
              알림장에 이모지 넣기
            </p>
            <p className="text-[12px] text-subtle mt-1">
              켜면 활동마다 2~3개의 이모지를 자연스럽게 섞어 써요.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={emojiOn}
            onClick={toggleEmoji}
            className={
              'shrink-0 w-12 h-7 rounded-full transition relative ' +
              (emojiOn ? 'bg-clay-500' : 'bg-cream-300')
            }
          >
            <span
              className={
                'absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition ' +
                (emojiOn ? 'left-[22px]' : 'left-0.5')
              }
            />
          </button>
        </div>
      </Card>

      <Card className="mb-4" hint="반 이름 표시">
        <p className="text-[12px] text-subtle mb-3">
          한 반만 담당하시면 반 이름을 감출 수 있어요. 여러 반을 담당하시면 반 이름을 표시해 알림장을 구분하세요.
        </p>
        <Segmented
          value={classSetting}
          onChange={handleClassSetting}
          options={[
            { value: 'auto', label: '자동' },
            { value: 'off', label: '숨김' },
            { value: 'on', label: '표시' },
          ]}
        />
        <p className="text-[11px] text-subtle mt-2">
          {classSetting === 'auto'
            ? `현재: ${effectiveShowClass ? '표시 (등록된 반이 2개 이상)' : '숨김 (등록된 반이 하나 이하)'}`
            : classSetting === 'off'
            ? '현재: 반 이름 입력 화면이 감춰져요.'
            : '현재: 아이·활동·공통 알림장에 반 이름을 항상 표시해요.'}
        </p>
      </Card>

      <Card className="mb-4" hint="알림장 텍스트로 추가">
        <p className="text-[12px] text-subtle mb-3">
          평소 학부모에게 보냈던 알림장을 그대로 붙여넣어주세요.
        </p>
        <textarea
          className="field-textarea min-h-[110px] mb-3"
          placeholder="예: 오늘 길동이는 친구들과 함께..."
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          disabled={samples.length >= MAX_STYLE_SAMPLES}
        />
        <button
          onClick={addText}
          disabled={samples.length >= MAX_STYLE_SAMPLES}
          className="w-full rounded-2xl border border-dashed border-cream-300 py-3 text-[14px] font-semibold text-clay-700 hover:bg-cream-100 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <PlusIcon size={16} /> 텍스트 샘플 추가
        </button>
      </Card>

      <Card className="mb-4" hint="이미지로 추가">
        <p className="text-[12px] text-subtle mb-3">
          알림장이 사진·캡처로 있으면 이미지로 첨부해도 돼요. AI가 글자를 읽어 분석해요.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addImages(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={samples.length >= MAX_STYLE_SAMPLES}
          className="w-full rounded-2xl bg-cream-100 py-3.5 text-[14px] font-semibold text-clay-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <CameraIcon size={18} /> 이미지 첨부 ({remaining}개 남음)
        </button>
      </Card>

      {samples.length > 0 && (
        <Card className="mb-4" hint={`등록된 샘플 (${samples.length}/${MAX_STYLE_SAMPLES})`}>
          <ul className="space-y-2">
            {samples.map((s, i) => (
              <li key={s.id} className="flex items-start gap-3 rounded-2xl border border-cream-200 p-3">
                <div className="w-7 h-7 rounded-full bg-cream-200 text-clay-700 flex items-center justify-center font-bold text-[13px]">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  {s.kind === 'text' ? (
                    <p className="text-[13px] leading-6 text-ink line-clamp-4">{s.text}</p>
                  ) : (
                    <div className="flex items-center gap-3">
                      <img
                        src={s.uri}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover border border-cream-200"
                      />
                      <span className="text-[13px] text-ink">이미지 샘플</span>
                    </div>
                  )}
                </div>
                <button
                  className="text-subtle hover:text-red-500 p-1"
                  onClick={() => removeSample(s.id)}
                  aria-label="샘플 삭제"
                >
                  <TrashIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <button
        onClick={handleAnalyze}
        disabled={isAnalyzing || samples.length === 0}
        className="btn-primary w-full py-4 text-[16px] mb-3"
      >
        <SparkleIcon size={18} />
        {isAnalyzing
          ? '문체 학습 중…'
          : fromSettings
          ? '문체 다시 학습하기'
          : '이 샘플로 학습하기'}
      </button>
      <button onClick={handleSkip} className="btn-ghost w-full py-3">
        {fromSettings ? '학습 해제하고 기본 문체 사용' : '건너뛰고 기본 문체 사용'}
      </button>

      <p className="text-center text-[12px] text-subtle mt-4">
        표준 보육과정 5영역은 학습 여부와 관계없이 항상 적용돼요.
      </p>
    </>
  );
}
