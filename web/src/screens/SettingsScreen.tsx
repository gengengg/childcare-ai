import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import { useToast } from '@/components/Toast';
import { SettingsIcon, SparkleIcon, TrashIcon } from '@/components/icons';
import { getChildren, type Child } from '@/lib/children';
import { resetOnboarding } from '@/lib/onboarding';
import {
  computeShowClass,
  getShowClassSetting,
  setShowClassSetting,
  type ShowClassSetting,
} from '@/lib/settings';
import {
  getEmojiEnabled,
  getLength,
  getTone,
  setEmojiEnabled,
  setLength,
  setTone,
  type LengthOption,
  type ToneOption,
} from '@/lib/styleSamples';
import { getThemePref, setThemePref, type ThemePref } from '@/lib/theme';
import { multiRemove } from '@/lib/storage';

type Tab = 'general' | 'style' | 'data';

const TABS: { value: Tab; label: string }[] = [
  { value: 'general', label: '일반' },
  { value: 'style', label: '문체' },
  { value: 'data', label: '데이터' },
];

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'auto', label: '자동' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
];

const CLASS_OPTIONS: { value: ShowClassSetting; label: string }[] = [
  { value: 'auto', label: '자동' },
  { value: 'off', label: '숨김' },
  { value: 'on', label: '표시' },
];

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

export function SettingsScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('general');

  return (
    <>
      <Header back icon={<SettingsIcon />} title="설정" />

      <div className="tabs mb-4">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={clsx('tabs-item', tab === t.value && 'tabs-item-active')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralTab />}
      {tab === 'style' && <StyleTab onGoStyleSetup={() => navigate('/style-setup')} />}
      {tab === 'data' && <DataTab />}
    </>
  );
}

function GeneralTab() {
  const [theme, setTheme] = useState<ThemePref>('auto');
  const [classSetting, setClassSetting] = useState<ShowClassSetting>('auto');
  const [children, setChildren] = useState<Child[]>([]);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    (async () => {
      setTheme(await getThemePref());
      setClassSetting(await getShowClassSetting());
      setChildren(await getChildren());
    })();
  }, []);

  const effectiveShowClass = computeShowClass(classSetting, children);

  const handleTheme = async (v: ThemePref) => {
    setTheme(v);
    await setThemePref(v);
  };
  const handleClassSetting = async (v: ShowClassSetting) => {
    setClassSetting(v);
    await setShowClassSetting(v);
  };
  const handleResetOnboarding = async () => {
    await resetOnboarding();
    toast.show('온보딩을 다시 볼 수 있어요.', 'success');
    navigate('/onboarding');
  };

  return (
    <>
      <Card className="mb-4" hint="테마">
        <p className="text-[12px] text-subtle mb-3">
          자동은 기기의 다크모드 설정을 따라가요.
        </p>
        <Segmented value={theme} onChange={handleTheme} options={THEME_OPTIONS} />
      </Card>

      <Card className="mb-4" hint="반 이름 표시">
        <p className="text-[12px] text-subtle mb-3">
          한 반만 담당하시면 반 이름을 감출 수 있어요. 여러 반을 담당하시면 표시해서 알림장을 구분하세요.
        </p>
        <Segmented
          value={classSetting}
          onChange={handleClassSetting}
          options={CLASS_OPTIONS}
        />
        <p className="text-[11px] text-subtle mt-2">
          {classSetting === 'auto'
            ? `현재: ${effectiveShowClass ? '표시 (등록된 반이 2개 이상)' : '숨김 (등록된 반이 하나 이하)'}`
            : classSetting === 'off'
            ? '현재: 반 이름 입력 화면이 감춰져요.'
            : '현재: 반 이름을 항상 표시해요.'}
        </p>
      </Card>

      <Card className="mb-4" hint="온보딩">
        <p className="text-[12px] text-subtle mb-3">
          첫 실행 안내를 다시 보고 싶으시면 눌러주세요.
        </p>
        <button onClick={handleResetOnboarding} className="btn-ghost w-full">
          온보딩 다시 보기
        </button>
      </Card>
    </>
  );
}

function StyleTab({ onGoStyleSetup }: { onGoStyleSetup: () => void }) {
  const [emojiOn, setEmojiOn] = useState(true);
  const [tone, setToneState] = useState<ToneOption>('warm');
  const [length, setLengthState] = useState<LengthOption>('medium');

  useEffect(() => {
    (async () => {
      setEmojiOn(await getEmojiEnabled());
      setToneState(await getTone());
      setLengthState(await getLength());
    })();
  }, []);

  const toggleEmoji = async () => {
    const next = !emojiOn;
    setEmojiOn(next);
    await setEmojiEnabled(next);
  };
  const handleTone = async (v: ToneOption) => {
    setToneState(v);
    await setTone(v);
  };
  const handleLength = async (v: LengthOption) => {
    setLengthState(v);
    await setLength(v);
  };

  return (
    <>
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

      <Card className="mb-4" hint="기본 톤">
        <p className="text-[12px] text-subtle mb-3">
          알림장 작성 화면에서 처음 선택되는 톤이에요.
        </p>
        <Segmented value={tone} onChange={handleTone} options={TONES} />
      </Card>

      <Card className="mb-4" hint="기본 길이">
        <Segmented value={length} onChange={handleLength} options={LENGTHS} />
      </Card>

      <Card className="mb-4" hint="문체 학습">
        <p className="text-[12px] text-subtle mb-3">
          평소 쓰시던 알림장을 텍스트/이미지로 등록하면 AI가 그 톤을 학습해요.
        </p>
        <button onClick={onGoStyleSetup} className="btn-primary w-full">
          <SparkleIcon size={16} /> 문체 샘플 관리
        </button>
      </Card>
    </>
  );
}

function DataTab() {
  const toast = useToast();

  const handleClearAll = async () => {
    const ok = window.confirm(
      '정말로 모든 데이터를 초기화할까요?\n등록된 아이·알림장·공통 활동·문체 설정이 모두 삭제됩니다.\n이 작업은 되돌릴 수 없어요.'
    );
    if (!ok) return;
    const confirm2 = window.prompt('확인을 위해 "초기화"라고 입력해주세요.');
    if (confirm2?.trim() !== '초기화') {
      toast.show('취소했어요.');
      return;
    }
    await multiRemove([
      'children_v1',
      'daily_records_v1',
      'class_activities_v1',
      'child_observations_v1',
      'style_mode_v1',
      'style_guide_v1',
      'style_samples_v1',
      'style_emoji_enabled_v1',
      'style_tone_v1',
      'style_length_v1',
      'show_class_name_v1',
      'onboarding_seen_v1',
    ]);
    toast.show('모든 데이터를 초기화했어요.', 'success');
    setTimeout(() => window.location.replace('/'), 500);
  };

  return (
    <>
      <Card className="mb-4" hint="저장 위치">
        <p className="text-[13px] text-ink leading-relaxed">
          이 앱의 데이터는 <strong>이 브라우저 안에만</strong> 저장돼요.
          다른 기기나 다른 브라우저로 옮기려면 별도의 백업이 필요합니다.
        </p>
      </Card>

      <Card className="mb-4" hint="위험 영역">
        <p className="text-[12px] text-subtle mb-3">
          아이·알림장·공통 활동·문체 설정 등 모든 저장 데이터를 지워요.
        </p>
        <button
          onClick={handleClearAll}
          className="w-full py-3 rounded-2xl bg-red-500/10 text-red-600 border border-red-500/30
            font-semibold flex items-center justify-center gap-2 active:bg-red-500/20 transition"
        >
          <TrashIcon size={16} /> 모든 데이터 초기화
        </button>
      </Card>
    </>
  );
}
