import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { SmileIcon, SparkleIcon } from '@/components/icons';

export function NicknameScreen() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 1 || trimmed.length > 20) {
      toast.show('닉네임은 1~20자 사이로 입력해 주세요');
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ nickname: trimmed })
        .eq('id', user.id)
        .select();
      if (error) {
        console.error('[nickname] update error:', error);
        toast.show(`저장 실패: ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        console.error('[nickname] no row updated. user.id =', user.id);
        toast.show('프로필 행이 없어요. 콘솔 확인 필요');
        return;
      }
      toast.show(`반가워요, ${trimmed} 선생님!`);
      nav('/', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-between py-8 px-6">
      <div className="pt-8">
        <div className="w-16 h-16 rounded-3xl bg-clay-500 text-white flex items-center justify-center shadow-pop mb-5">
          <SmileIcon size={30} />
        </div>
        <p className="text-[13px] font-bold text-clay-500 tracking-wide mb-2">
          첫 방문 환영해요
        </p>
        <h1 className="text-[26px] font-extrabold text-ink leading-tight mb-3">
          어떻게 불러 드릴까요?
        </h1>
        <p className="text-[14px] text-subtle leading-relaxed">
          앱 안에서 이 이름으로 인사드릴게요. 언제든지 설정에서 바꿀 수 있어요.
        </p>

        <div className="pt-6">
          <input
            className="field-input"
            placeholder="예: 은지 선생님"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            autoFocus
          />
        </div>
      </div>

      <div className="pt-8">
        <button
          onClick={handleSave}
          disabled={saving || nickname.trim().length === 0}
          className="btn-primary w-full py-4 text-[16px]"
        >
          <SparkleIcon size={18} />
          {saving ? '저장 중…' : '시작하기'}
        </button>
      </div>
    </div>
  );
}
