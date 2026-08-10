import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { useToast } from '@/components/Toast';
import {
  emailExists,
  enterGuestMode,
  resendSignupConfirmation,
  signInWithMagicLink,
  signInWithPassword,
  signUpWithPassword,
} from '@/lib/auth';
import { setRememberMe } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PencilIcon, SparkleIcon } from '@/components/icons';
import { VerifyCodePanel } from '@/components/VerifyCodePanel';

type Mode = 'signin' | 'signup';

export function LoginScreen() {
  const toast = useToast();
  const { refreshGuest } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');

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

  return (
    <div className="min-h-full flex flex-col justify-between py-8 px-6">
      <div className="pt-8">
        <div className="w-16 h-16 rounded-3xl bg-clay-500 text-white flex items-center justify-center shadow-pop mb-5">
          <PencilIcon size={30} />
        </div>
        <p className="text-[13px] font-bold text-clay-500 tracking-wide mb-2">알림장 AI</p>
        <h1 className="text-[26px] font-extrabold text-ink leading-tight mb-3">
          로그인하고
          <br />
          어디서든 이어서 써요
        </h1>
        <p className="text-[14px] text-subtle leading-relaxed">
          알림장, 아이 목록, 문체가 클라우드에 저장돼 다른 기기에서도 이어서 쓸 수 있어요.
        </p>
      </div>

      <div className="pt-6 space-y-3">
        <div className="grid grid-cols-2 gap-1 p-1 bg-cream-100 rounded-2xl">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={clsx(
                'text-center py-2.5 rounded-xl text-[14px] font-medium transition',
                mode === m
                  ? 'bg-surface text-ink shadow-sm font-bold'
                  : 'text-subtle'
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <input
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          className="field-input"
          placeholder="비밀번호 (6자 이상)"
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
            className="w-4 h-4 accent-clay-500"
          />
          <span className="text-[13px] text-ink">자동 로그인</span>
          <span className="text-[11px] text-subtle">
            (끄면 브라우저 종료 시 로그아웃)
          </span>
        </label>

        <button
          onClick={handleSubmit}
          disabled={busy}
          className="btn-primary w-full"
        >
          <SparkleIcon size={16} />
          {busy ? '처리 중…' : mode === 'signup' ? '회원가입' : '로그인'}
        </button>

        {mode === 'signup' && (
          <p className="text-[11px] text-subtle text-center leading-relaxed">
            회원가입 후 이메일로 인증 코드가 발송돼요.
          </p>
        )}

        {mode === 'signin' && (
          <div className="flex items-center justify-center gap-3 text-[12px] text-subtle py-1">
            <Link to="/find-password" className="hover:text-clay-700 underline-offset-4 hover:underline">
              비밀번호 재설정
            </Link>
          </div>
        )}

        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-cream-200" />
          <span className="text-[12px] text-subtle">또는</span>
          <div className="flex-1 h-px bg-cream-200" />
        </div>

        <button className="btn-outline w-full" onClick={handleMagicLink} disabled={busy}>
          이메일 링크로 로그인 (비밀번호 없이)
        </button>

        <button
          onClick={handleGuest}
          className="w-full text-center text-[13px] text-subtle underline underline-offset-4 py-3"
        >
          로그인 없이 게스트로 시작
        </button>
        <p className="text-center text-[11px] text-subtle -mt-1">
          게스트 데이터는 이 기기에만 저장돼요.
        </p>
      </div>
    </div>
  );
}
