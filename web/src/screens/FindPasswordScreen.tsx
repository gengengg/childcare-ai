import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { sendPasswordReset } from '@/lib/auth';
import { SparkleIcon } from '@/components/icons';

export function FindPasswordScreen() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    const em = email.trim().toLowerCase();
    if (!em.includes('@') || em.length < 5) {
      toast.show('이메일 주소를 확인해 주세요');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(em);
      setSent(true);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '전송 실패');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-full flex flex-col justify-center py-8 px-6">
        <div className="card">
          <p className="text-[14px] font-bold text-ink mb-1">메일함을 확인해 주세요</p>
          <p className="text-[13px] text-subtle leading-relaxed">
            <span className="font-medium text-ink">{email}</span> 로 비밀번호 재설정 링크를 보냈어요.
            메일 안의 버튼을 누르면 새 비밀번호를 설정할 수 있어요.
          </p>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              className="btn-ghost"
              onClick={() => {
                setSent(false);
                setEmail('');
              }}
            >
              다시 시도
            </button>
            <Link to="/login" className="btn-primary justify-center">
              로그인으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col justify-between py-8 px-6">
      <div className="pt-8">
        <div className="w-14 h-14 rounded-3xl bg-clay-500 text-white flex items-center justify-center shadow-pop mb-5">
          <SparkleIcon size={26} />
        </div>
        <p className="text-[13px] font-bold text-clay-500 tracking-wide mb-2">
          비밀번호 재설정
        </p>
        <h1 className="text-[24px] font-extrabold text-ink leading-tight mb-3">
          이메일로 재설정
          <br />
          링크를 보내드려요
        </h1>
        <p className="text-[13px] text-subtle leading-relaxed">
          가입한 이메일 주소를 입력하시면, 새 비밀번호를 설정할 수 있는 링크를 보내드립니다.
        </p>
      </div>

      <div className="pt-6 space-y-3">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          className="field-input"
          placeholder="이메일 주소"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
        />
        <button onClick={handleSubmit} disabled={busy} className="btn-primary w-full">
          <SparkleIcon size={16} />
          {busy ? '전송 중…' : '재설정 링크 받기'}
        </button>

        <div className="pt-2 text-center">
          <Link
            to="/login"
            className="text-[13px] text-subtle underline underline-offset-4"
          >
            로그인 화면으로
          </Link>
        </div>
      </div>
    </div>
  );
}
