import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { useToast } from '@/components/Toast';
import {
  emailExists,
  enterGuestMode,
  normalizePhone,
  resendSignupConfirmation,
  signInWithMagicLink,
  signInWithPassword,
  signUpWithPassword,
} from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { PencilIcon, SparkleIcon } from '@/components/icons';
import { VerifyCodePanel } from '@/components/VerifyCodePanel';

type Mode = 'signin' | 'signup';

export function LoginScreen() {
  const toast = useToast();
  const { refreshGuest } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');

  // 공통
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 회원가입 전용
  const [fullName, setFullName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [phone, setPhone] = useState('');
  const [consented, setConsented] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

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

    if (mode === 'signup') {
      if (!fullName.trim()) {
        toast.show('이름을 입력해 주세요');
        return;
      }
      if (!birthdate) {
        toast.show('생년월일을 입력해 주세요');
        return;
      }
      const phoneDigits = normalizePhone(phone);
      if (phoneDigits.length < 10) {
        toast.show('휴대전화번호를 확인해 주세요');
        return;
      }
      if (!consented) {
        toast.show('개인정보 수집·이용에 동의해야 가입할 수 있어요');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const { needsConfirmation } = await signUpWithPassword(em, password, {
          fullName: fullName.trim(),
          birthdate,
          phone: normalizePhone(phone),
          consentedAt: new Date().toISOString(),
        });
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

        {mode === 'signup' && (
          <>
            <input
              type="text"
              autoComplete="name"
              className="field-input"
              placeholder="이름 (실명)"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={busy}
            />
            <div>
              <label
                htmlFor="signup-birthdate"
                className="text-[12px] font-semibold text-subtle ml-1 mb-1 block"
              >
                생년월일 (년 / 월 / 일)
              </label>
              <input
                id="signup-birthdate"
                type="date"
                autoComplete="bday"
                className="field-input"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                disabled={busy}
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="field-input"
              placeholder="휴대전화번호 (예: 010-1234-5678)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={busy}
            />

            <ConsentBox
              checked={consented}
              onCheck={setConsented}
              expanded={showPolicy}
              onToggleExpand={() => setShowPolicy((v) => !v)}
            />
          </>
        )}

        <button
          onClick={handleSubmit}
          disabled={busy || (mode === 'signup' && !consented)}
          className="btn-primary w-full"
        >
          <SparkleIcon size={16} />
          {busy ? '처리 중…' : mode === 'signup' ? '회원가입' : '로그인'}
        </button>

        {mode === 'signin' && (
          <div className="flex items-center justify-center gap-3 text-[12px] text-subtle py-1">
            <Link to="/find-id" className="hover:text-clay-700 underline-offset-4 hover:underline">
              아이디 찾기
            </Link>
            <span className="text-cream-300">|</span>
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

function ConsentBox({
  checked,
  onCheck,
  expanded,
  onToggleExpand,
}: {
  checked: boolean;
  onCheck: (v: boolean) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <div className="rounded-2xl border border-cream-200 bg-cream-100 p-3">
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-clay-500"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 justify-between">
            <span className="text-[13px] font-semibold text-ink">
              개인정보 수집·이용 동의 <span className="text-clay-500">(필수)</span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onToggleExpand();
              }}
              className="text-[11px] text-subtle underline underline-offset-4"
            >
              {expanded ? '접기' : '자세히'}
            </button>
          </div>
          <p className="text-[11px] text-subtle mt-1 leading-relaxed">
            아이디/비밀번호 찾기에 사용됩니다.
          </p>
        </div>
      </label>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-cream-200 text-[12px] text-ink leading-relaxed">
          <p className="font-semibold mb-1">수집 항목</p>
          <p className="text-subtle mb-2">이메일, 이름, 생년월일, 휴대전화번호</p>
          <p className="font-semibold mb-1">이용 목적</p>
          <p className="text-subtle mb-2">계정 복구 (아이디/비밀번호 찾기)</p>
          <p className="font-semibold mb-1">보관 기간</p>
          <p className="text-subtle mb-2">회원 탈퇴 시까지. 제3자 제공 없음.</p>
          <p className="text-[11px] text-subtle mt-2">
            동의를 거부할 수 있으나, 계정 복구가 어려워지므로 미동의 시 회원가입이 제한됩니다.
          </p>
        </div>
      )}
    </div>
  );
}

