import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { signOut, updatePassword } from '@/lib/auth';
import { SparkleIcon } from '@/components/icons';

/**
 * 비밀번호 재설정 링크(FindPasswordScreen에서 발송)를 클릭하면 여기로 온다.
 * Supabase가 recovery 토큰으로 세션을 자동 생성해 놓으므로 authenticated 상태.
 * 새 비번을 저장한 뒤 로그아웃 → /login 으로 유도해 새 비번으로 다시 로그인하도록.
 */
export function ResetPasswordScreen() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) {
    return <div className="min-h-full bg-cream-50" />;
  }

  if (!user) {
    return (
      <div className="min-h-full flex flex-col justify-center py-8 px-6">
        <div className="card">
          <p className="text-[14px] font-bold text-ink mb-1">유효한 재설정 링크가 아니에요</p>
          <p className="text-[13px] text-subtle leading-relaxed">
            메일함에서 최신 링크를 다시 확인해 주세요. 링크는 발송 후 일정 시간이 지나면 만료돼요.
          </p>
          <Link to="/find-password" className="btn-primary w-full justify-center mt-4">
            재설정 링크 다시 받기
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (password.length < 6) {
      toast.show('비밀번호는 6자 이상으로 입력해 주세요');
      return;
    }
    if (password !== confirm) {
      toast.show('두 비밀번호가 달라요');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      toast.show('새 비밀번호로 저장했어요. 다시 로그인해 주세요.');
      await signOut();
      nav('/login', { replace: true });
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

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
          새 비밀번호를
          <br />
          입력해 주세요
        </h1>
        <p className="text-[13px] text-subtle leading-relaxed">
          저장하면 자동으로 로그아웃되고, 새 비밀번호로 다시 로그인할 수 있어요.
        </p>
      </div>

      <div className="pt-6 space-y-3">
        <input
          type="password"
          autoComplete="new-password"
          className="field-input"
          placeholder="새 비밀번호 (6자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
        <input
          type="password"
          autoComplete="new-password"
          className="field-input"
          placeholder="새 비밀번호 확인"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
        />
        <button onClick={handleSubmit} disabled={busy} className="btn-primary w-full">
          <SparkleIcon size={16} />
          {busy ? '저장 중…' : '새 비밀번호 저장'}
        </button>
      </div>
    </div>
  );
}
