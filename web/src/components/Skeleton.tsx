import { clsx } from 'clsx';

/**
 * 로딩 중 표시할 뼈대 컴포넌트.
 * `animate-pulse` 로 은은한 리듬. 크림 톤이라 앱 배경과 자연스럽게 조화.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-xl bg-cream-200/70 dark:bg-cream-200/40',
        className
      )}
    />
  );
}

/** 카드 안에서 몇 줄 텍스트 로딩 뼈대. */
export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={clsx(
            'h-3.5',
            i === lines - 1 ? 'w-2/3' : 'w-full'
          )}
        />
      ))}
    </div>
  );
}

/** 리스트 아이템(아바타 + 텍스트 2줄) 뼈대. */
export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}
