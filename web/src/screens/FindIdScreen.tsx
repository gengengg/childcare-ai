import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { findEmailByRecovery, normalizePhone } from '@/lib/auth';
import { SparkleIcon, UserIcon } from '@/components/icons';

export function FindIdScreen() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null | 'notfound'>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.show('이름을 입력해 주세요');
      return;
    }
    if (normalizePhone(phone).length < 10) {
      toast.show('휴대전화번호를 확인해 주세요');
      return;
    }
    setBusy(true);
    try {
      const found = await findEmailByRecovery(name, phone);
      setResult(found ?? 'notfound');
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-full flex flex-col justify-center py-8 px-6">
        <div className="card">
          {result === 'notfound' ? (
            <>
              <p className="text-[14px] font-bold text-ink mb-1">일치하는 계정이 없어요</p>
              <p className="text-[13px] text-subtle leading-relaxed">
                가입할 때 입력한 이름과 휴대전화번호를 다시 확인해 주세요.
              </p>
            </>
          ) : (
            <>
              <p className="text-[14px] font-bold text-ink mb-1">회원님의 이메일</p>
              <p className="text-[15px] font-mono text-clay-700 my-3 py-3 px-4 rounded-xl bg-cream-100 border border-cream-200 text-center">
                {result}
              </p>
              <p className="text-[12px] text-subtle leading-relaxed">
                보안을 위해 앞 3자만 보여드려요. 이 이메일로 로그인 또는 비밀번호 재설정을 이용해 주세요.
              </p>
            </>
          )}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              className="btn-ghost"
              onClick={() => {
                setResult(null);
                setName('');
                setPhone('');
              }}
            >
              다시 찾기
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
          <UserIcon size={26} />
        </div>
        <p className="text-[13px] font-bold text-clay-500 tracking-wide mb-2">
          아이디 찾기
        </p>
        <h1 className="text-[24px] font-extrabold text-ink leading-tight mb-3">
          가입 시 정보로
          <br />
          이메일을 찾아드려요
        </h1>
        <p className="text-[13px] text-subtle leading-relaxed">
          회원가입 때 입력한 이름과 휴대전화번호를 넣어 주세요. 보안을 위해 앞 3자만 보여드립니다.
        </p>
      </div>

      <div className="pt-6 space-y-3">
        <input
          type="text"
          autoComplete="name"
          className="field-input"
          placeholder="이름 (실명)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className="field-input"
          placeholder="휴대전화번호 (예: 010-1234-5678)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
        />
        <button onClick={handleSubmit} disabled={busy} className="btn-primary w-full">
          <SparkleIcon size={16} />
          {busy ? '조회 중…' : '이메일 찾기'}
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
