import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { Card } from '@/components/Card';
import { markOnboardingSeen } from '@/lib/onboarding';
import { PencilIcon, SparkleIcon } from '@/components/icons';

const FEATURES: { badge: string; title: string; desc: string }[] = [
  {
    badge: '알림장',
    title: '편하게 쓰는 일일 알림장',
    desc:
      '활동·식사·수면·건강을 가볍게 메모하고 사진만 첨부하면, AI가 따뜻한 알림장 초안을 만들어 드려요.',
  },
  {
    badge: '나만의 문체',
    title: '내 문체로 학습하는 AI',
    desc:
      '평소 쓰시던 알림장을 텍스트나 이미지로 최대 5개까지 보여주시면, AI가 그 문체로 써 드려요.',
  },
  {
    badge: '반별 공통 활동',
    title: '활동은 반마다 한 번만 입력',
    desc:
      '오늘의 활동은 반 단위로 한 번만 저장하면, 그 반 아이들의 알림장에서 자동으로 불러옵니다.',
  },
  {
    badge: '관찰일지',
    title: '쌓인 알림장으로 관찰일지까지',
    desc:
      '기간을 선택하면 그 사이의 알림장과 교사 메모를 바탕으로 영역별 관찰일지를 AI가 정리해요.',
  },
  {
    badge: 'Word 출력',
    title: '관찰일지는 워드(.docx) 파일로',
    desc:
      '완성한 관찰일지는 양식이 잡힌 Word 파일로 바로 저장·공유할 수 있어요.',
  },
];

export function OnboardingScreen() {
  const navigate = useNavigate();
  const toast = useToast();

  const handleStart = async () => {
    await markOnboardingSeen();
    toast.show('환영해요!');
    navigate('/style-setup');
  };

  return (
    <>
      <div className="pt-4 pb-6">
        <div className="w-14 h-14 rounded-2xl bg-clay-500 text-white flex items-center justify-center shadow-pop mb-4">
          <PencilIcon size={28} />
        </div>
        <p className="text-[13px] font-bold text-clay-500 tracking-wide mb-2">
          처음 오셨네요
        </p>
        <h1 className="text-[26px] font-extrabold text-ink leading-snug mb-2">
          알림장 AI에
          <br />
          오신 걸 환영해요
        </h1>
        <p className="text-[14px] text-subtle leading-relaxed">
          편하게 알림장과 관찰일지를 쓸 수 있도록 도와드리는 앱이에요.
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {FEATURES.map((f) => (
          <Card key={f.title} className="p-5">
            <span className="inline-block text-[11px] font-bold text-clay-700 bg-cream-100 rounded-pill px-3 py-1 mb-3">
              {f.badge}
            </span>
            <h3 className="text-[16px] font-extrabold text-ink mb-1.5">{f.title}</h3>
            <p className="text-[13px] text-subtle leading-6">{f.desc}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-6 bg-cream-100 border-cream-300">
        <h3 className="text-[14px] font-extrabold text-clay-800 mb-2">추천 사용 순서</h3>
        <ol className="text-[13px] text-clay-700 leading-6 space-y-0.5 list-decimal ml-5">
          <li>아이들 탭에서 우리 반 아이를 먼저 등록</li>
          <li>작성 탭에서 활동과 사진만 입력 → AI 초안</li>
          <li>필요한 부분만 다듬은 뒤 저장</li>
          <li>기록이 쌓이면 관찰일지도 AI로 한 번에 정리</li>
        </ol>
      </Card>

      <button onClick={handleStart} className="btn-primary w-full py-4 text-[16px]">
        <SparkleIcon size={18} /> 다음 · 나만의 문체 설정
      </button>
      <p className="text-center text-[12px] text-subtle mt-3">
        이 안내는 처음 한 번만 표시돼요.
      </p>
    </>
  );
}
