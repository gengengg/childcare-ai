import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { PencilIcon, FolderIcon, GridIcon, NoteIcon, MenuIcon } from '@/components/icons';

type Tab = {
  to: string;
  label: string;
  Icon: (p: { size?: number; strokeWidth?: number; className?: string }) => React.ReactElement;
  tourKey: string;
  /** 이 탭을 활성으로 표시할 경로들 (접두사 매칭) */
  match: (path: string) => boolean;
};

const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(p + '/'));

const tabs: Tab[] = [
  {
    to: '/',
    label: '작성',
    Icon: PencilIcon,
    tourKey: 'tab-write',
    match: (p) => p === '/' || startsWithAny(p, ['/record']),
  },
  {
    to: '/records',
    label: '보관함',
    Icon: FolderIcon,
    tourKey: 'tab-records',
    match: (p) => startsWithAny(p, ['/records', '/calendar']),
  },
  {
    to: '/weekly',
    label: '학급',
    Icon: NoteIcon,
    tourKey: 'tab-weekly',
    match: (p) => startsWithAny(p, ['/weekly', '/weekly-diary', '/class-activity', '/observation']),
  },
  {
    to: '/worksheets',
    label: '활동지',
    Icon: GridIcon,
    tourKey: 'tab-worksheets',
    match: (p) => startsWithAny(p, ['/worksheets']),
  },
  {
    to: '/menu',
    label: '전체',
    Icon: MenuIcon,
    tourKey: 'tab-menu',
    match: (p) =>
      startsWithAny(p, ['/menu', '/settings', '/children', '/manage-children', '/admin']),
  },
];

export function BottomTabBar() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed bottom-0 inset-x-0 z-40 rounded-t-[24px] border-t border-gray-200/70 bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto max-w-md grid grid-cols-5 h-[68px]">
        {tabs.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.to}
              to={t.to}
              data-tour={t.tourKey}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
            >
              <t.Icon
                size={25}
                strokeWidth={active ? 2.3 : 1.9}
                className={clsx('transition-colors', active ? 'text-brand-500' : 'text-gray-400')}
              />
              <span
                className={clsx(
                  'text-[13px] tracking-tight transition-colors',
                  active ? 'text-ink font-bold' : 'text-gray-500 font-medium'
                )}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
