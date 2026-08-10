import { useState } from 'react';
import { clsx } from 'clsx';
import { useToast } from '@/components/Toast';
import {
  emailExists,
  enterGuestMode,
  signInWithMagicLink,
  signInWithPassword,
  signUpWithPassword,
} from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { PencilIcon, SparkleIcon } from '@/components/icons';

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

  const handleOAuthPlaceholder = (name: string) => () => {
    toast.show(`${name} 로그인은 곧 지원 예정이에요`);
  };

  if (needsConfirm) {
    return (
      <NoticeCard
        title="메일함을 확인해 주세요"
        body={
          <>
            <span className="font-medium text-ink">{email}</span> 로 회원가입 확인 링크를 보냈어요.
            메일 안의 버튼을 누르면 계정이 활성화됩니다.
          </>
        }
        actionLabel="로그인 화면으로"
        onAction={() => {
          setNeedsConfirm(false);
          setMode('signin');
        }}
      />
    );
  }

  if (magicSent) {
    return (
      <NoticeCard
        title="메일함을 확인해 주세요"
        body={
          <>
            <span className="font-medium text-ink">{email}</span> 로 로그인 링크를 보냈어요.
            메일 안의 버튼을 누르면 자동으로 로그인됩니다.
          </>
        }
        actionLabel="돌아가기"
        onAction={() => setMagicSent(false)}
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
            if (e.key === 'Enter') handleSubmit();
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="btn-primary w-full"
        >
          <SparkleIcon size={16} />
          {busy ? '처리 중…' : mode === 'signup' ? '회원가입' : '로그인'}
        </button>

        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-cream-200" />
          <span className="text-[12px] text-subtle">또는</span>
          <div className="flex-1 h-px bg-cream-200" />
        </div>

        <button className="btn-outline w-full" onClick={handleMagicLink} disabled={busy}>
          이메일 링크로 로그인 (비밀번호 없이)
        </button>
        <button className="btn-outline w-full" onClick={handleOAuthPlaceholder('Google')}>
          Google 계정으로 계속
        </button>
        <button className="btn-outline w-full" onClick={handleOAuthPlaceholder('카카오')}>
          카카오 계정으로 계속
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

function NoticeCard({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="min-h-full flex flex-col justify-center py-8 px-6">
      <div className="card">
        <p className="text-[14px] font-bold text-ink mb-1">{title}</p>
        <p className="text-[13px] text-subtle leading-relaxed">{body}</p>
        <button className="btn-ghost w-full mt-4" onClick={onAction}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
