import { useState } from 'react';
import { useToast } from './Toast';
import { verifyEmailOtp, type OtpVerifyType } from '@/lib/auth';
import { SparkleIcon } from './icons';

/**
 * 이메일로 온 6자리 OTP 코드를 입력받는 패널.
 * 회원가입 확인 / 매직링크 로그인 / 비밀번호 재설정 세 경우 모두 재사용.
 *
 * cross-device 문제(모바일로 링크 확인 → 그 기기가 로그인됨) 해결용.
 * 사용자는 어느 기기에서 메일을 확인하든, 코드만 원래 기기에 입력하면 됨.
 */
export function VerifyCodePanel({
  email,
  type,
  onResend,
  onBack,
  onSuccess,
}: {
  email: string;
  type: OtpVerifyType;
  onResend: () => Promise<void>;
  onBack: () => void;
  /** 성공 후 명시적 처리가 필요한 경우 (예: recovery 는 /reset-password 로 이동). */
  onSuccess?: () => void;
}) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sent'>('idle');

  const handleVerify = async () => {
    if (code.length < 6) {
      toast.show('메일에서 받은 코드를 정확히 입력해 주세요');
      return;
    }
    setBusy(true);
    try {
      await verifyEmailOtp(email, code, type);
      toast.show(
        type === 'signup'
          ? '가입 완료!'
          : type === 'recovery'
          ? '확인 완료'
          : '로그인 완료'
      );
      onSuccess?.();
      // signup/magiclink 은 AuthGate 가 자동으로 홈/닉네임 화면으로 라우팅.
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : '';
      if (msg.includes('expired')) {
        toast.show('코드가 만료됐어요. 다시 받아주세요.');
      } else if (msg.includes('invalid') || msg.includes('otp')) {
        toast.show('코드가 맞지 않아요.');
      } else {
        toast.show(e instanceof Error ? e.message : '확인 실패');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    try {
      await onResend();
      setResendState('sent');
      setTimeout(() => setResendState('idle'), 3000);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '재전송 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-center py-8 px-6">
      <div className="card">
        <p className="text-[14px] font-bold text-ink mb-2">
          이메일로 온 확인 코드를 입력해 주세요
        </p>
        <p className="text-[13px] text-subtle leading-relaxed mb-4">
          <span className="font-medium text-ink">{email}</span> 로 확인 코드를 보냈어요.
          다른 기기에서 메일을 확인해도, 코드만 여기 입력하면 이 기기에서 진행됩니다.
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={10}
          className="field-input text-center tracking-[0.4em] text-[20px] font-bold"
          placeholder="코드 입력"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
          disabled={busy}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleVerify();
          }}
        />
        <button
          onClick={handleVerify}
          disabled={busy || code.length < 6}
          className="btn-primary w-full mt-3"
        >
          <SparkleIcon size={16} />
          {busy ? '확인 중…' : '확인'}
        </button>
        <div className="flex items-center justify-between mt-4 text-[12px]">
          <button
            onClick={handleResend}
            disabled={busy}
            className="text-subtle underline underline-offset-4 disabled:opacity-50"
          >
            {resendState === 'sent' ? '재전송 완료' : '코드 다시 받기'}
          </button>
          <button
            onClick={onBack}
            disabled={busy}
            className="text-subtle underline underline-offset-4 disabled:opacity-50"
          >
            돌아가기
          </button>
        </div>
        <p className="text-[11px] text-subtle mt-3 text-center">
          메일이 안 보이면 스팸함도 확인해 보세요.
        </p>
      </div>
    </div>
  );
}
