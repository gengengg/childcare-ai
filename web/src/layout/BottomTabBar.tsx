import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { PencilIcon, FolderIcon, GridIcon, NoteIcon, MenuIcon } from '@/components/icons';
import { getItem, setItem } from '@/lib/storage';
import { useCreateSheet } from './CreateSheet';

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

const WRITE_TAB: Tab = {
  to: '/',
  label: '작성',
  Icon: PencilIcon,
  tourKey: 'tab-write',
  match: (p) => p === '/' || startsWithAny(p, ['/record']),
};

const tabs: Tab[] = [
  WRITE_TAB,
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

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10;
const HINT_KEY = 'write_longpress_hint_seen_v1';

function TabInner({ tab, active, pressing }: { tab: Tab; active: boolean; pressing?: boolean }) {
  return (
    <>
      <tab.Icon
        size={25}
        strokeWidth={active ? 2.3 : 1.9}
        className={clsx(
          'transition-all',
          active ? 'text-brand-500' : 'text-gray-400',
          pressing && 'scale-110 text-brand-500'
        )}
      />
      <span
        className={clsx(
          'text-[13px] tracking-tight transition-colors',
          active ? 'text-ink font-bold' : 'text-gray-500 font-medium'
        )}
      >
        {tab.label}
      </span>
    </>
  );
}

/**
 * '작성' 탭: 짧게 누르면 알림장, 길게 누르면 '무엇을 작성할까요?' 시트.
 * 키보드(↑, Shift+F10, 메뉴 키)와 마우스 오른쪽 클릭으로도 시트를 연다.
 */
function WriteTab({ active }: { active: boolean }) {
  const { open } = useCreateSheet();
  const ref = useRef<HTMLAnchorElement>(null);
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const firedLong = useRef(false);
  const [pressing, setPressing] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    (async () => setShowHint((await getItem(HINT_KEY)) !== '1'))();
  }, []);

  const dismissHint = () => {
    if (!showHint) return;
    setShowHint(false);
    void setItem(HINT_KEY, '1');
  };

  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
    setPressing(false);
  };

  const openSheet = () => {
    dismissHint();
    if ('vibrate' in navigator) navigator.vibrate?.(12);
    open(ref.current);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    firedLong.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    setPressing(true);
    timer.current = window.setTimeout(() => {
      firedLong.current = true;
      clear();
      openSheet();
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    if (
      Math.abs(e.clientX - start.current.x) > MOVE_TOLERANCE ||
      Math.abs(e.clientY - start.current.y) > MOVE_TOLERANCE
    ) {
      clear();
    }
  };

  const onClick = (e: React.MouseEvent) => {
    // 길게 눌러 시트를 열었으면 이어지는 click(이동)은 막는다
    if (firedLong.current) {
      e.preventDefault();
      firedLong.current = false;
      return;
    }
    dismissHint();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault();
      openSheet();
    }
  };

  return (
    <div className="relative">
      {showHint && (
        <button
          type="button"
          onClick={openSheet}
          className="absolute bottom-full left-1 mb-2 whitespace-nowrap rounded-xl bg-gray-800 px-3.5 py-2.5
            text-[14px] font-semibold text-surface shadow-pop"
        >
          꾹 누르면 다른 문서도 바로 쓸 수 있어요
          <span
            className="absolute top-full left-6 h-0 w-0 border-x-[7px] border-t-[7px] border-x-transparent border-t-gray-800"
            aria-hidden
          />
        </button>
      )}
      <Link
        ref={ref}
        to={WRITE_TAB.to}
        data-tour={WRITE_TAB.tourKey}
        aria-current={active ? 'page' : undefined}
        aria-haspopup="dialog"
        aria-describedby="write-tab-desc"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={clear}
        onPointerCancel={clear}
        onPointerLeave={clear}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!firedLong.current) openSheet();
        }}
        className="h-[68px] flex flex-col items-center justify-center gap-1 select-none
          [-webkit-touch-callout:none] active:scale-95 transition-transform"
      >
        <TabInner tab={WRITE_TAB} active={active} pressing={pressing} />
      </Link>
      <span id="write-tab-desc" className="sr-only">
        길게 누르면 작성할 문서를 고를 수 있어요
      </span>
    </div>
  );
}

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
          if (t === WRITE_TAB) return <WriteTab key={t.to} active={active} />;
          return (
            <Link
              key={t.to}
              to={t.to}
              data-tour={t.tourKey}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
            >
              <TabInner tab={t} active={active} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
