import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { PencilIcon, FolderIcon, GridIcon, NoteIcon, MenuIcon } from '@/components/icons';
import { getItem, setItem } from '@/lib/storage';
import { useCreateMenu } from './CreateMenu';

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

/** 순서: 보관함 · 학급 · [작성] · 활동지 · 전체 — 작성은 가운데 원형 버튼 */
const tabs: Tab[] = [
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
  WRITE_TAB,
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

const LONG_PRESS_MS = 400;
const MOVE_TOLERANCE = 12;
const HINT_KEY = 'write_longpress_hint_seen_v1';

function TabLabel({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={clsx(
        'text-[13px] tracking-tight transition-colors',
        active ? 'text-ink font-bold' : 'text-gray-500 font-medium'
      )}
    >
      {label}
    </span>
  );
}

/**
 * 가운데 '작성' 버튼.
 * - 짧게 누르면 알림장 작성으로 이동
 * - 길게 누르면 동그라미 메뉴가 부채꼴로 튀어나옴 (끌어서 놓으면 바로 이동)
 * - 키보드 ↑ / Shift+F10 / 메뉴 키, 마우스 오른쪽 클릭으로도 열림
 */
function WriteTab({ active }: { active: boolean }) {
  const { open, isOpen } = useCreateMenu();
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

  const openMenu = (dragging = false) => {
    dismissHint();
    open(ref.current, { dragging });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    firedLong.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    setPressing(true);
    timer.current = window.setTimeout(() => {
      firedLong.current = true;
      clear();
      openMenu(true);
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
    // 길게 눌러 메뉴를 열었으면 이어지는 click(이동)은 막는다
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
      openMenu(false);
    }
  };

  return (
    <div className="relative flex justify-center">
      {showHint && !isOpen && (
        <button
          type="button"
          onClick={() => openMenu(false)}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-9 whitespace-nowrap rounded-xl bg-gray-800
            px-3.5 py-2.5 text-[14px] font-semibold text-surface shadow-pop"
        >
          꾹 누르면 다른 문서도 바로 쓸 수 있어요
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 h-0 w-0 border-x-[7px] border-t-[7px]
              border-x-transparent border-t-gray-800"
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
        aria-expanded={isOpen}
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
          if (!firedLong.current) openMenu(false);
        }}
        className="group flex flex-col items-center gap-1 select-none touch-none
          [-webkit-touch-callout:none] outline-none"
      >
        <span
          data-create-anchor
          className={clsx(
            '-mt-6 w-[60px] h-[60px] rounded-full flex items-center justify-center',
            'bg-brand-500 text-on-brand shadow-pop ring-[5px] ring-surface transition-transform duration-150',
            'group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-brand-500',
            pressing ? 'scale-90' : 'group-active:scale-95'
          )}
          aria-hidden
        >
          <PencilIcon size={27} strokeWidth={2.3} />
        </span>
        <TabLabel label={WRITE_TAB.label} active={active} />
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
      <div className="mx-auto max-w-md grid grid-cols-5 h-[68px] items-center">
        {tabs.map((t) => {
          const active = t.match(pathname);
          if (t === WRITE_TAB) return <WriteTab key={t.to} active={active} />;
          return (
            <Link
              key={t.to}
              to={t.to}
              data-tour={t.tourKey}
              aria-current={active ? 'page' : undefined}
              className="h-full flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
            >
              <t.Icon
                size={25}
                strokeWidth={active ? 2.3 : 1.9}
                className={clsx('transition-colors', active ? 'text-brand-500' : 'text-gray-400')}
              />
              <TabLabel label={t.label} active={active} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
