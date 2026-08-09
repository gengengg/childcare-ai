import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from './icons';

type HeaderProps = {
  icon?: React.ReactNode;
  iconTone?: 'brown' | 'cream';
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  back?: boolean;
  className?: string;
};

export function Header({
  icon,
  iconTone = 'brown',
  title,
  subtitle,
  action,
  back,
  className,
}: HeaderProps) {
  const navigate = useNavigate();
  return (
    <div className={clsx('flex items-center gap-3 pt-2 pb-4', className)}>
      {back && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-clay-700 active:bg-cream-100"
        >
          <ChevronLeftIcon />
        </button>
      )}
      {icon && (
        <div
          className={clsx(
            'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
            iconTone === 'brown'
              ? 'bg-clay-500 text-white shadow-pop'
              : 'bg-cream-200 text-clay-700'
          )}
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] text-subtle mt-0.5 leading-snug">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
