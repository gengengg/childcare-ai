import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRightIcon,
  EyeIcon,
  GridIcon,
  NoteIcon,
  PencilIcon,
  XIcon,
} from '@/components/icons';

/**
 * '무엇을 작성할까요?' 바텀시트.
 *
 * 여는 방법 (모두 같은 시트):
 *  - 하단 탭 '작성'을 길게 누르기 (스크린리더: 두 번 탭한 채 유지)
 *  - '작성' 탭에서 키보드 ↑ / Shift+F10 / 메뉴 키, 또는 마우스 오른쪽 클릭
 *  - 작성 화면의 '다른 문서' 버튼 (길게 누르기가 어려운 사용자를 위한 보이는 경로)
 *
 * 접근성: role=dialog + aria-modal, 열리면 첫 항목에 포커스, Tab 순환, Esc로 닫기,
 * 닫히면 연 버튼으로 포커스 복귀. 행 높이 64px 이상.
 */

type Item = {
  to: string;
  label: string;
  desc: string;
  Icon: (p: { size?: number }) => React.ReactElement;
};

export const CREATE_ITEMS: Item[] = [
  { to: '/', label: '알림장', desc: '공통 · 개인 알림장', Icon: PencilIcon },
  { to: '/class-activity', label: '오늘 활동 내용', desc: '반 활동을 한 번에 기록', Icon: GridIcon },
  { to: '/observation', label: '관찰일지', desc: '아이별 관찰 기록을 AI가 정리', Icon: EyeIcon },
  { to: '/weekly', label: '주간보육일지', desc: '주차를 골라 작성', Icon: NoteIcon },
];

type Ctx = { open: (returnFocusTo?: HTMLElement | null) => void; isOpen: boolean };
const CreateSheetCtx = createContext<Ctx | null>(null);

export function useCreateSheet(): Ctx {
  const v = useContext(CreateSheetCtx);
  if (!v) throw new Error('useCreateSheet must be used within CreateSheetProvider');
  return v;
}

export function CreateSheetProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const open = useCallback((el?: HTMLElement | null) => {
    returnFocus.current = el ?? (document.activeElement as HTMLElement | null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // 닫힌 뒤 연 요소로 포커스 복귀
    requestAnimationFrame(() => returnFocus.current?.focus());
  }, []);

  return (
    <CreateSheetCtx.Provider value={{ open, isOpen }}>
      {children}
      {isOpen && <Sheet onClose={close} />}
    </CreateSheetCtx.Provider>
  );
}

function Sheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Tab' && panelRef.current) {
      const els = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')
      );
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    // 목록 안에서 화살표로 이동
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && panelRef.current) {
      const rows = Array.from(panelRef.current.querySelectorAll<HTMLElement>('[data-row]'));
      const i = rows.indexOf(document.activeElement as HTMLElement);
      if (i === -1) return;
      e.preventDefault();
      const next = e.key === 'ArrowDown' ? (i + 1) % rows.length : (i - 1 + rows.length) % rows.length;
      rows[next].focus();
    }
  };

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return createPortal(
    <div className="fixed inset-0 z-[90]" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/45 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[28px] bg-surface shadow-pop
          px-2 pt-3 animate-sheet-up"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" aria-hidden />
        <div className="flex items-start justify-between px-4 mb-2">
          <div>
            <h2 id={titleId} className="text-[22px] font-bold tracking-tight text-ink">
              무엇을 작성할까요?
            </h2>
            <p id={descId} className="text-[15px] text-subtle mt-1">
              작성할 문서를 고르면 바로 열려요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-gray-600 active:bg-gray-100"
          >
            <XIcon size={24} />
          </button>
        </div>

        <ul className="pb-1">
          {CREATE_ITEMS.map((it, i) => (
            <li key={it.to}>
              <button
                type="button"
                data-row
                data-autofocus={i === 0 ? '' : undefined}
                onClick={() => go(it.to)}
                className="list-row rounded-2xl min-h-[68px]"
              >
                <span className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0" aria-hidden>
                  <it.Icon size={24} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[18px] font-bold text-ink tracking-tight">{it.label}</span>
                  <span className="block text-[15px] text-subtle">{it.desc}</span>
                </span>
                <ChevronRightIcon size={20} className="text-gray-400 shrink-0" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
}
