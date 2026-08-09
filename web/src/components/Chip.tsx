import { clsx } from 'clsx';

type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function Chip({ active, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      className={clsx('chip', active && 'chip-active', className)}
      {...rest}
    >
      {children}
    </button>
  );
}
