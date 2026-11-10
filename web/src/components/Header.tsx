import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from './icons';

type HeaderProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  back?: boolean;
  className?: string;
};

/** 화면 상단 제목. 큰 제목 + 연한 보조 설명, 오른쪽에 액션. */
export function Header({ title, subtitle, action, back, className }: HeaderProps) {
  const navigate = useNavigate();
  return (
    <div className={clsx('pt-2 pb-5', className)}>
      {back && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로 가기"
          className="w-11 h-11 -ml-3 mb-1 rounded-full flex items-center justify-center text-ink active:bg-gray-200"
        >
          <ChevronLeftIcon size={26} />
        </button>
      )}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-[26px] font-bold tracking-tight text-ink leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-[15px] text-subtle mt-1 leading-snug">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}
