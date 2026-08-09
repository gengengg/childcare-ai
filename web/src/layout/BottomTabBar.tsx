import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import { PencilIcon, FolderIcon, SmileIcon } from '@/components/icons';

const tabs = [
  { to: '/', label: '작성', Icon: PencilIcon, end: true },
  { to: '/records', label: '보관함', Icon: FolderIcon, end: false },
  { to: '/children', label: '아이들', Icon: SmileIcon, end: false },
];

export function BottomTabBar() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-cream-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 6px)' }}
    >
      <div className="mx-auto max-w-md grid grid-cols-3 h-16 pt-1.5">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition',
                isActive ? 'text-clay-700' : 'text-subtle'
              )
            }
          >
            {({ isActive }) => (
              <>
                <t.Icon size={22} className={clsx(isActive && 'stroke-[2.1]')} />
                <span
                  className={clsx(
                    'tracking-tight',
                    isActive && 'text-clay-800 font-bold'
                  )}
                >
                  {t.label}
                </span>
                <span
                  className={clsx(
                    'h-0.5 w-8 rounded-full transition',
                    isActive ? 'bg-clay-500' : 'bg-transparent'
                  )}
                />
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
