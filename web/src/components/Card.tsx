import { clsx } from 'clsx';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  hint?: React.ReactNode;
};

export function Card({ className, hint, children, ...rest }: CardProps) {
  return (
    <div className={clsx('card', className)} {...rest}>
      {hint && <div className="card-hint">{hint}</div>}
      {children}
    </div>
  );
}
