import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { useToast } from '@/components/Toast';
import {
  emailExists,
  enterGuestMode,
  resendSignupConfirmation,
  signInWithGoogle,
  signInWithKakao,
  KAKAO_LOGIN_ENABLED,
  signInWithMagicLink,
  signInWithPassword,
  signUpWithPassword,
} from '@/lib/auth';
import { setRememberMe } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeftIcon } from '@/components/icons';
import { BrandMark } from '@/components/BrandMark';
import { VerifyCodePanel } from '@/components/VerifyCodePanel';

type Mode = 'signin' | 'signup';
type Step = 'start' | 'email';

export function LoginScreen() {
  const toast = useToast();
  const { refreshGuest } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [step, setStep] = useState<Step>('start');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    setRememberMe(true);
  }, []);

  const handleRememberChange = (checked: boolean) => {
    setRemember(checked);
    setRememberMe(checked);
  };

  const handleSubmit = async () => {
    const em = email.trim().toLowerCase();
    if (!em.includes('@') || em.length < 5) {
      toast.show('이메일 주소를 확인해 주세요');
      return;
    }
    if (password.length < 6) {
      toast.show('비밀번호는 6자 이상으로 입력해 주세요');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        if (await emailExists(em)) {
          toast.show('이미 가입된 이메일이에요. 로그인해 주세요.');
          setMode('signin');
          return;
        }
        const { needsConfirmation } = await signUpWithPassword(em, password);
        if (needsConfirmation) {
          setNeedsConfirm(true);
        } else {
          toast.show('환영해요!');
        }
      } else {
        if (!(await emailExists(em))) {
          toast.show('회원정보가 없어요.');
          return;
        }
        try {
          await signInWithPassword(em, password);
          toast.show('로그인 완료');
        } catch (e) {
          const msg = e instanceof Error ? e.message : '';
          if (msg.toLowerCase().includes('invalid login credentials')) {
            toast.show('비밀번호가 맞지 않아요.');
          } else {
            toast.show(msg || '로그인 실패');
          }
        }
      }
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '요청 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Google 로그인 실패');
      setBusy(false);
    }
  };

  const handleKakao = async () => {
    setBusy(true);
    try {
      await signInWithKakao();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '카카오 로그인 실패');
      setBusy(false);
    }
  };

  const handleMagicLink = async () => {
    const em = email.trim();
    if (!em.includes('@')) {
      toast.show('이메일 링크는 이메일 주소로만 받을 수 있어요');
      return;
    }
    setBusy(true);
    try {
      await signInWithMagicLink(em);
      setMagicSent(true);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '전송 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleGuest = async () => {
    await enterGuestMode();
    await refreshGuest();
    toast.show('게스트 모드로 시작합니다');
  };

  if (needsConfirm) {
    return (
      <VerifyCodePanel
        email={email}
        type="signup"
        onResend={() => resendSignupConfirmation(email)}
        onBack={() => {
          setNeedsConfirm(false);
          setMode('signin');
        }}
      />
    );
  }

  if (magicSent) {
    return (
      <VerifyCodePanel
        email={email}
        type="magiclink"
        onResend={() => signInWithMagicLink(email)}
        onBack={() => setMagicSent(false)}
      />
    );
  }

  // ── 첫 화면: 카카오 · 구글 원탭 + 이메일은 '다른 방법' ──
  if (step === 'start') {
    return (
      <div className="min-h-full flex flex-col justify-between py-8 px-6">
        <div className="pt-10">
          <BrandMark variant="emblem" size={104} label="온퇴근" className="mb-7 -ml-1.5" />
          <h1 className="text-[28px] font-bold text-ink leading-tight tracking-tight mb-3">
            알림장은 AI에게,
            <br />
            선생님은 제시간에 퇴근
          </h1>
          <p className="text-[17px] text-gray-600 leading-relaxed">
            로그인하면 어느 기기에서든 이어서 쓸 수 있어요.
          </p>
        </div>

        <div className="pt-8 space-y-3">
          {KAKAO_LOGIN_ENABLED && (
            <button
              onClick={handleKakao}
              disabled={busy}
              className="w-full min-h-[56px] flex items-center justify-center gap-2.5 rounded-2xl px-5
                bg-[#FEE500] text-[17px] font-bold text-black/[.85] active:brightness-95 disabled:opacity-50 transition"
            >
              <KakaoIcon />
              카카오로 3초 만에 시작하기
            </button>
          )}

          <button
            onClick={handleGoogle}
            disabled={busy}
            className="w-full min-h-[56px] flex items-center justify-center gap-2.5 bg-surface border border-gray-300
              rounded-2xl px-5 text-[17px] font-semibold text-ink hover:bg-gray-50 disabled:opacity-50 transition"
          >
            <GoogleIcon />
            Google로 시작하기
          </button>

          <button
            onClick={() => setStep('email')}
            disabled={busy}
            className="btn-ghost w-full min-h-[56px] text-[17px]"
          >
            이메일로 로그인 · 회원가입
          </button>

          <button
            onClick={handleGuest}
            className="w-full text-center text-[15px] text-subtle underline underline-offset-4 py-3"
          >
            로그인 없이 둘러보기
          </button>
          <p className="text-center text-[13px] text-subtle -mt-2">
            둘러보기 데이터는 이 기기에만 저장돼요.
          </p>
        </div>
      </div>
    );
  }

  // ── 이메일 로그인 · 회원가입 ──
  return (
    <div className="min-h-full flex flex-col py-6 px-6">
      <button
        type="button"
        onClick={() => setStep('start')}
        aria-label="뒤로 가기"
        className="w-11 h-11 -ml-3 mb-2 rounded-full flex items-center justify-center text-ink active:bg-gray-200"
      >
        <ChevronLeftIcon size={26} />
      </button>
      <h1 className="text-[26px] font-bold text-ink leading-tight tracking-tight mb-6">
        이메일로 {mode === 'signup' ? '회원가입' : '로그인'}
      </h1>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-2xl" role="tablist">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={clsx(
                'text-center min-h-[44px] py-2.5 rounded-xl text-[15px] font-medium transition',
                mode === m ? 'bg-surface text-ink shadow-sm font-bold' : 'text-subtle'
              )}
            >
              {m === 'signin' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          className="field-input"
          placeholder="이메일 주소"
          aria-label="이메일 주소"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <input
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          className="field-input"
          placeholder="비밀번호 (6자 이상)"
          aria-label="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && mode === 'signin') handleSubmit();
          }}
        />

        <label className="flex items-center gap-2 py-1 px-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => handleRememberChange(e.target.checked)}
            className="w-5 h-5 accent-brand-500"
          />
          <span className="text-[15px] text-ink">자동 로그인</span>
        </label>

        <button onClick={handleSubmit} disabled={busy} className="btn-primary w-full">
          {busy ? '처리 중…' : mode === 'signup' ? '회원가입' : '로그인'}
        </button>

        {mode === 'signup' ? (
          <p className="text-[14px] text-subtle text-center leading-relaxed">
            가입하면 이메일로 6자리 인증 코드가 와요.
          </p>
        ) : (
          <div className="flex items-center justify-center gap-4 text-[15px] text-subtle py-1">
            <Link to="/find-password" className="underline underline-offset-4">
              비밀번호 재설정
            </Link>
            <span aria-hidden>·</span>
            <button onClick={handleMagicLink} disabled={busy} className="underline underline-offset-4">
              비밀번호 없이 코드로 로그인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** 카카오 말풍선 심볼 (카카오 로그인 디자인 가이드: #FEE500 배경 + 검정 심볼/글자) */
function KakaoIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#000000"
        d="M12 3C6.48 3 2 6.48 2 10.78c0 2.78 1.86 5.21 4.66 6.59l-.95 3.47c-.08.31.27.56.54.38l4.14-2.75c.53.06 1.07.09 1.61.09 5.52 0 10-3.48 10-7.78S17.52 3 12 3Z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
