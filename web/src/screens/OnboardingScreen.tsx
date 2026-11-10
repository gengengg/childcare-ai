import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { markOnboardingSeen } from '@/lib/onboarding';
import { resetTour } from '@/lib/tour';
import { SparkleIcon } from '@/components/icons';
import { BrandMark } from '@/components/BrandMark';

export function OnboardingScreen() {
  const navigate = useNavigate();
  const toast = useToast();

  const handleStart = async () => {
    await markOnboardingSeen();
    await resetTour(); // 온보딩 처음 완료 후 튜토리얼이 확실히 뜨도록
    toast.show('환영해요!');
    navigate('/style-setup');
  };

  return (
    <div className="min-h-full flex flex-col justify-between py-8">
      <div className="pt-6">
        <BrandMark variant="emblem" size={120} label="온퇴근" className="mb-6 -ml-2" />
        <h1 className="text-[28px] font-bold text-ink leading-tight tracking-tight mb-4">
          온퇴근에
          <br />
          오신 걸 환영해요
        </h1>
        <p className="text-[17px] text-gray-600 leading-relaxed">
          사진과 활동만 넣으면 AI가 따뜻한 알림장을 만들어 드려요.
          <br />
          <br />
          다음 화면에서 선생님만의 문체를 등록하시면 그 톤 그대로 써드릴게요.
          <br />
          건너뛰어도 괜찮아요!
        </p>
      </div>

      <div className="pt-10">
        <button onClick={handleStart} className="btn-primary w-full">
          <SparkleIcon size={18} /> 다음 · 문체 설정
        </button>
        <p className="text-center text-[15px] text-subtle mt-3">
          이 안내는 처음 한 번만 표시돼요.
        </p>
      </div>
    </div>
  );
}
