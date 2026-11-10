import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { EyeIcon, GridIcon, NoteIcon, PencilIcon, XIcon } from '@/components/icons';

/**
 * '무엇을 작성할까요?' 원형(버블) 메뉴.
 *
 * 하단 가운데 '작성' 버튼 위로 동그란 버튼들이 부채꼴로 하나씩 튀어나온다.
 * 참고: Material 'Speed dial', PrimeReact SpeedDial(semi-circle), 길게 눌러 끌어서 고르는 방사형 메뉴.
 *
 * 여는 방법
 *  - '작성' 버튼 길게 누르기 → 손을 떼지 않고 원하는 동그라미로 끌어서 놓으면 바로 이동
 *    (그냥 떼면 메뉴가 열린 채로 남아서 탭으로 고를 수 있음)
 *  - 키보드: '작성'에서 ↑ / Shift+F10 / 메뉴 키, 마우스 오른쪽 클릭
 *  - 작성 화면의 '다른 문서' 버튼 (길게 누르기가 어려운 사용자를 위한 보이는 경로)
 *
 * 접근성
 *  - role=dialog + aria-modal, 제목 '무엇을 작성할까요?'
 *  - 열리면 첫 항목에 포커스, 화살표/Home/End 이동, Tab 순환, Esc·바깥 탭·가운데 X로 닫기
 *  - 닫히면 연 버튼으로 포커스 복귀
 *  - 모든 동그라미에 글자 라벨 표시(아이콘만으로 구분하지 않음), 지름 64px
 *  - 모션 줄이기 설정이면 튀어나오는 애니메이션 없이 바로 표시(index.css 전역 규칙)
 */

type Item = {
  to: string;
  label: string;
  desc: string;
  Icon: (p: { size?: number; strokeWidth?: number }) => React.ReactElement;
};

export const CREATE_ITEMS: Item[] = [
  { to: '/', label: '알림장', desc: '공통 · 개인 알림장', Icon: PencilIcon },
  { to: '/class-activity', label: '오늘 활동', desc: '반 활동을 한 번에 기록', Icon: GridIcon },
  { to: '/observation', label: '관찰일지', desc: '아이별 관찰 기록을 AI가 정리', Icon: EyeIcon },
  { to: '/weekly', label: '주간일지', desc: '주차를 골라 주간보육일지 작성', Icon: NoteIcon },
];

/** 부채꼴 배치: 왼쪽(160°)에서 오른쪽(20°)으로 */
const RADIUS = 136;
const BUBBLE = 64;
const angleOf = (i: number, n: number) => {
  const start = 152;
  const end = 28;
  return n === 1 ? 90 : start - ((start - end) * i) / (n - 1);
};
const offsetOf = (i: number, n: number) => {
  const rad = (angleOf(i, n) * Math.PI) / 180;
  return { x: Math.cos(rad) * RADIUS, y: -Math.sin(rad) * RADIUS };
};

type OpenOpts = { dragging?: boolean };
type Ctx = { open: (returnFocusTo?: HTMLElement | null, opts?: OpenOpts) => void; isOpen: boolean };
const CreateMenuCtx = createContext<Ctx | null>(null);

export function useCreateMenu(): Ctx {
  const v = useContext(CreateMenuCtx);
  if (!v) throw new Error('useCreateMenu must be used within CreateMenuProvider');
  return v;
}

export function CreateMenuProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ open: boolean; dragging: boolean }>({
    open: false,
    dragging: false,
  });
  const returnFocus = useRef<HTMLElement | null>(null);

  const open = useCallback((el?: HTMLElement | null, opts?: OpenOpts) => {
    returnFocus.current = el ?? (document.activeElement as HTMLElement | null);
    setState({ open: true, dragging: !!opts?.dragging });
  }, []);

  const close = useCallback((restoreFocus = true) => {
    setState({ open: false, dragging: false });
    if (restoreFocus) requestAnimationFrame(() => returnFocus.current?.focus());
  }, []);

  return (
    <CreateMenuCtx.Provider value={{ open, isOpen: state.open }}>
      {children}
      {state.open && <RadialMenu dragging={state.dragging} onClose={close} />}
    </CreateMenuCtx.Provider>
  );
}

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 지원 안 하면 무시 */
  }
}

function RadialMenu({
  dragging,
  onClose,
}: {
  dragging: boolean;
  onClose: (restoreFocus?: boolean) => void;
}) {
  const navigate = useNavigate();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [shown, setShown] = useState(false);
  const [hot, setHot] = useState<number | null>(null);
  const hotRef = useRef<number | null>(null);
  const n = CREATE_ITEMS.length;

  // 기준점: 하단 가운데 '작성' 버튼의 동그라미 중심
  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>('[data-create-anchor]');
    const r = el?.getBoundingClientRect();
    setAnchor(
      r
        ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight - 70 }
    );
  }, []);

  // 다음 프레임에 펼쳐서 '뿅' 하고 튀어나오게
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    vibrate(12);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = prev;
    };
  }, []);

  // 키보드로 연 경우 첫 항목에 포커스 (끌기 중엔 포커스 이동이 손가락 동작을 방해하지 않도록 dialog 자체에)
  useEffect(() => {
    if (!anchor) return;
    const first = rootRef.current?.querySelector<HTMLElement>('[data-item="0"]');
    if (dragging) rootRef.current?.querySelector<HTMLElement>('[role="dialog"]')?.focus();
    else first?.focus();
  }, [anchor, dragging]);

  const go = useCallback(
    (to: string) => {
      onClose(false);
      navigate(to);
    },
    [navigate, onClose]
  );

  // 길게 누른 채로 끌어서 고르기
  useEffect(() => {
    if (!dragging || !anchor) return;
    const pick = (x: number, y: number): number | null => {
      let best: number | null = null;
      let bestD = Infinity;
      CREATE_ITEMS.forEach((_, i) => {
        const o = offsetOf(i, n);
        const d = Math.hypot(x - (anchor.x + o.x), y - (anchor.y + o.y));
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return bestD <= BUBBLE * 0.9 ? best : null;
    };
    const onMove = (e: PointerEvent) => {
      const i = pick(e.clientX, e.clientY);
      if (i !== hotRef.current) {
        hotRef.current = i;
        setHot(i);
        if (i !== null) vibrate(6);
      }
    };
    const onUp = () => {
      const i = hotRef.current;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (i !== null) go(CREATE_ITEMS[i].to);
      else setHot(null); // 그냥 떼면 열린 채로 남김
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, anchor, n, go]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    const focusables = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[data-item], [data-close]') ?? []
    );
    const items = focusables.filter((el) => el.hasAttribute('data-item'));
    const cur = items.indexOf(document.activeElement as HTMLElement);
    const move = (i: number) => {
      e.preventDefault();
      items[(i + items.length) % items.length]?.focus();
    };
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') return move(cur === -1 ? 0 : cur + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') return move(cur === -1 ? items.length - 1 : cur - 1);
    if (e.key === 'Home') return move(0);
    if (e.key === 'End') return move(items.length - 1);
    if (e.key === 'Tab' && focusables.length) {
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!anchor) return null;

  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-[90]" onKeyDown={onKeyDown}>
      {/* 배경: 누르면 닫힘 */}
      <div
        className={clsx(
          'absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-200',
          shown ? 'opacity-100' : 'opacity-0'
        )}
        onClick={() => onClose()}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="outline-none"
      >
        <h2
          id={titleId}
          className={clsx(
            'absolute left-0 right-0 text-center text-[20px] font-bold text-white tracking-tight',
            'transition-all duration-300',
            shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          )}
          style={{ top: anchor.y - RADIUS - BUBBLE - 56 }}
        >
          무엇을 작성할까요?
        </h2>

        {CREATE_ITEMS.map((it, i) => {
          const o = offsetOf(i, n);
          const isHot = hot === i;
          return (
            <button
              key={it.to}
              type="button"
              data-item={i}
              onClick={() => go(it.to)}
              aria-describedby={`${titleId}-d${i}`}
              className="group absolute flex flex-col items-center gap-2 outline-none"
              style={{
                left: anchor.x,
                top: anchor.y,
                width: 96,
                marginLeft: -48,
                marginTop: -BUBBLE / 2,
                transform: shown
                  ? `translate(${o.x}px, ${o.y}px) scale(${isHot ? 1.15 : 1})`
                  : 'translate(0px, 0px) scale(0.2)',
                opacity: shown ? 1 : 0,
                transition:
                  'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 180ms ease-out',
                transitionDelay: shown && !isHot ? `${i * 55}ms` : '0ms',
              }}
            >
              <span
                className={clsx(
                  'flex items-center justify-center rounded-full shadow-pop transition-colors',
                  'ring-offset-2 ring-offset-black/0 group-focus-visible:ring-4 group-focus-visible:ring-brand-300',
                  isHot ? 'bg-brand-500 text-on-brand' : 'bg-surface text-brand-600 group-active:bg-brand-50'
                )}
                style={{ width: BUBBLE, height: BUBBLE }}
                aria-hidden
              >
                <it.Icon size={28} strokeWidth={2} />
              </span>
              <span
                className="text-[15px] font-bold text-white leading-tight"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
              >
                {it.label}
              </span>
              <span id={`${titleId}-d${i}`} className="sr-only">
                {it.desc}
              </span>
            </button>
          );
        })}

        {/* 가운데: 닫기 (연필 자리에 X가 돌며 나타남) */}
        <button
          type="button"
          data-close
          onClick={() => onClose()}
          aria-label="닫기"
          className="absolute flex items-center justify-center rounded-full bg-brand-500 text-on-brand shadow-pop
            focus-visible:ring-4 focus-visible:ring-brand-300 outline-none"
          style={{ left: anchor.x - 28, top: anchor.y - 28, width: 56, height: 56 }}
        >
          <span
            className="transition-transform duration-300"
            style={{ transform: shown ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          >
            <XIcon size={28} strokeWidth={2.4} />
          </span>
        </button>
      </div>
    </div>,
    document.body
  );
}
