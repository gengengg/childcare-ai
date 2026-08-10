import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import { useToast } from '@/components/Toast';
import { SettingsIcon, SparkleIcon, TrashIcon, UserIcon } from '@/components/icons';
import { getChildren, type Child } from '@/lib/children';
import { resetOnboarding } from '@/lib/onboarding';
import { resetTour } from '@/lib/tour';
import { useAuth } from '@/contexts/AuthContext';
import { exitGuestMode, signOut, updatePassword } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
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
      <Header icon={<SettingsIcon />} title="설정" />

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
  const handleResetTour = async () => {
    await resetTour();
    toast.show('튜토리얼을 다시 볼 수 있어요.', 'success');
    navigate('/');
  };

  return (
    <>
      <AccountCard />
      <PasswordCard />

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

      <Card className="mb-4" hint="안내">
        <p className="text-[12px] text-subtle mb-3">
          첫 실행 안내와 튜토리얼을 언제든 다시 볼 수 있어요.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleResetTour} className="btn-primary py-3">
            튜토리얼 다시 보기
          </button>
          <button onClick={handleResetOnboarding} className="btn-ghost py-3">
            온보딩 다시 보기
          </button>
        </div>
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

function AccountCard() {
  const { mode, user, refreshGuest } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [nickname, setNickname] = useState<string>('');
  const [nicknameDraft, setNicknameDraft] = useState<string>('');
  const [editingNickname, setEditingNickname] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== 'authed' || !user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', user.id)
        .maybeSingle();
      const n = data?.nickname ?? '';
      setNickname(n);
      setNicknameDraft(n);
    })();
  }, [mode, user]);

  const handleSaveNickname = async () => {
    if (!user) return;
    const trimmed = nicknameDraft.trim();
    if (!trimmed) {
      toast.show('닉네임을 입력해 주세요.', 'error');
      return;
    }
    if (trimmed === nickname) {
      setEditingNickname(false);
      return;
    }
    setSavingNickname(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ nickname: trimmed })
        .eq('id', user.id);
      if (error) throw error;
      setNickname(trimmed);
      setEditingNickname(false);
      toast.show('닉네임을 저장했어요.', 'success');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '저장 실패', 'error');
    } finally {
      setSavingNickname(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('로그아웃하시겠어요? 기기에 남은 게스트 데이터는 보존돼요.')) return;
    setBusy(true);
    try {
      await signOut();
      await refreshGuest();
      toast.show('로그아웃했어요.');
      // AuthGate가 /login으로 자동 이동
    } finally {
      setBusy(false);
    }
  };

  const handleGuestToLogin = async () => {
    setBusy(true);
    try {
      await exitGuestMode();
      await refreshGuest();
      navigate('/login');
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'authed') {
    return (
      <Card className="mb-4" hint="계정">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-clay-500 text-white flex items-center justify-center flex-shrink-0">
            <UserIcon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            {editingNickname ? (
              <div className="flex gap-1.5 items-center">
                <input
                  className="field-input py-1.5 text-[14px] flex-1"
                  placeholder="닉네임"
                  value={nicknameDraft}
                  onChange={(e) => setNicknameDraft(e.target.value)}
                  maxLength={20}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNickname();
                    if (e.key === 'Escape') {
                      setNicknameDraft(nickname);
                      setEditingNickname(false);
                    }
                  }}
                />
                <button
                  onClick={handleSaveNickname}
                  disabled={savingNickname}
                  className="px-3 py-1.5 rounded-xl bg-clay-500 text-white text-[12px] font-bold disabled:opacity-50"
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setNicknameDraft(nickname);
                    setEditingNickname(false);
                  }}
                  className="px-2 py-1.5 rounded-xl text-[12px] text-subtle"
                >
                  취소
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-ink truncate">
                    {nickname || '선생님'}
                  </p>
                  <p className="text-[12px] text-subtle truncate">{user?.email ?? '로그인됨'}</p>
                </div>
                <button
                  onClick={() => setEditingNickname(true)}
                  className="text-[12px] text-clay-600 font-semibold underline underline-offset-4 whitespace-nowrap"
                >
                  닉네임 변경
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="text-[12px] text-subtle mb-3">
          알림장, 아이 목록, 문체가 클라우드에 저장돼요. 다른 기기에서도 로그인만 하면 이어서 쓸 수 있어요.
        </p>
        <button
          onClick={handleLogout}
          disabled={busy}
          className="btn-ghost w-full"
        >
          {busy ? '처리 중…' : '로그아웃'}
        </button>
      </Card>
    );
  }

  return (
    <Card className="mb-4" hint="계정">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-cream-200 text-clay-700 flex items-center justify-center">
          <UserIcon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-ink">게스트 모드</p>
          <p className="text-[12px] text-subtle">이 기기에만 저장 중</p>
        </div>
      </div>
      <p className="text-[12px] text-subtle mb-3">
        로그인하면 다른 기기에서도 이어서 쓸 수 있어요. 지금까지의 게스트 데이터는 이 기기에 그대로 남습니다.
      </p>
      <button
        onClick={handleGuestToLogin}
        disabled={busy}
        className="btn-primary w-full"
      >
        {busy ? '이동 중…' : '로그인하기'}
      </button>
    </Card>
  );
}

function PasswordCard() {
  const { mode } = useAuth();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (mode !== 'authed') return null;

  const handleSave = async () => {
    if (password.length < 6) {
      toast.show('비밀번호는 6자 이상으로 입력해 주세요');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      setPassword('');
      toast.show('비밀번호를 저장했어요. 다음부터 이메일 + 비밀번호로 로그인할 수 있어요.', 'success');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-4" hint="비밀번호">
      <p className="text-[12px] text-subtle mb-3">
        비밀번호를 저장하면 이메일 + 비밀번호로 바로 로그인할 수 있어요.
      </p>
      <input
        type="password"
        autoComplete="new-password"
        className="field-input mb-3"
        placeholder="새 비밀번호 (6자 이상)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={busy}
      />
      <button
        onClick={handleSave}
        disabled={busy || password.length < 6}
        className="btn-primary w-full"
      >
        {busy ? '저장 중…' : '비밀번호 저장'}
      </button>
    </Card>
  );
}

function DataTab() {
  const { mode } = useAuth();
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
        {mode === 'authed' ? (
          <p className="text-[13px] text-ink leading-relaxed">
            로그인 상태예요. 데이터는 <strong>클라우드(Supabase)</strong>에 저장돼요.
            다른 기기에서도 로그인하면 그대로 이어서 쓸 수 있어요.
          </p>
        ) : (
          <p className="text-[13px] text-ink leading-relaxed">
            게스트 모드예요. 데이터는 <strong>이 브라우저 안에만</strong> 저장돼요.
            다른 기기나 다른 브라우저로 옮기려면 별도의 백업이 필요합니다.
          </p>
        )}
      </Card>

      <Card className="mb-4" hint="위험 영역">
        <p className="text-[12px] text-subtle mb-3">
          {mode === 'authed'
            ? '이 기기에 남아 있는 게스트용 로컬 데이터만 삭제해요. 클라우드에 저장된 계정 데이터는 그대로 남습니다.'
            : '아이·알림장·공통 활동·문체 설정 등 모든 저장 데이터를 지워요.'}
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
