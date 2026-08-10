import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  HomeIcon,
  FolderIcon,
  NoteIcon,
  UsersIcon,
  SettingsIcon,
} from '@/components/icons';

const tabs = [
  { to: '/', label: '홈', Icon: HomeIcon, end: true },
  { to: '/records', label: '보관함', Icon: FolderIcon },
  { to: '/weekly', label: '주간일지', Icon: NoteIcon },
  { to: '/children', label: '아이', Icon: UsersIcon },
  { to: '/settings', label: '설정', Icon: SettingsIcon },
];

export function BottomTabBar() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-cream-200/80 bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4px)' }}
    >
      <div className="mx-auto max-w-md grid grid-cols-5 h-16 pt-1">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className="flex flex-col items-center justify-center gap-0.5 relative"
          >
            {({ isActive }) => (
              <>
                <div
                  className={clsx(
                    'flex items-center justify-center transition-all',
                    isActive ? 'text-clay-700' : 'text-cream-400'
                  )}
                >
                  <t.Icon
                    size={22}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    className="transition-all"
                  />
                </div>
                <span
                  className={clsx(
                    'text-[10.5px] tracking-tight transition-colors',
                    isActive ? 'text-clay-800 font-bold' : 'text-cream-400 font-medium'
                  )}
                >
                  {t.label}
                </span>
                {isActive && (
                  <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-clay-500" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
