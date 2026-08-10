import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mascot, type MascotVariant } from '@/components/Mascot';

export type TourStep = {
  /** CSS 선택자: 이 요소를 하이라이트하고 툴팁을 그 옆에 붙인다. */
  selector: string;
  title: string;
  /** 문자열 또는 JSX (강조 시 <strong> 사용 가능). */
  description: React.ReactNode;
  /** 이 스텝에서 마스코트가 어떤 표정일지. 기본 'point'. */
  mascot?: MascotVariant;
};

type Props = {
  steps: TourStep[];
  onFinish: () => void;
};

const PADDING = 8;
const CORNER = 18;

function computeTooltipPosition(
  rect: DOMRect,
  tooltipHeight: number,
  vw: number,
  vh: number
) {
  const marginX = 16;
  const marginY = 12;
  const preferBelow = rect.top + rect.height / 2 < vh / 2;
  const top = preferBelow
    ? Math.min(vh - tooltipHeight - marginY, rect.bottom + marginY)
    : Math.max(marginY, rect.top - tooltipHeight - marginY);
  const width = Math.min(320, vw - marginX * 2);
  const left = Math.max(marginX, Math.min(vw - width - marginX, rect.left + rect.width / 2 - width / 2));
  return { top, left, width };
}

export function Walkthrough({ steps, onFinish }: Props) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(200);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const step = steps[i];

  // 타겟 요소 rect 즉시 측정 → 하이라이트/툴팁이 다음 클릭 즉시 이동.
  // 이후 부드러운 스크롤이 진행되며 아래 scroll 리스너가 rect를 계속 갱신한다.
  useEffect(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(step.selector);
    if (!el) {
      setRect(null);
      return;
    }
    setRect(el.getBoundingClientRect());
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [step, i]);

  // 리사이즈·스크롤 시 rect 재계산 (스크롤은 하이라이트만 따라가도록 부드럽게 갱신)
  useEffect(() => {
    if (!step) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(step.selector);
        if (el) setRect(el.getBoundingClientRect());
      });
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      cancelAnimationFrame(raf);
    };
  }, [step]);

  // 툴팁 실제 높이 측정 (텍스트 길이에 따라 다름)
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      setTooltipHeight(tooltipRef.current.offsetHeight);
    }
  }, [step]);

  if (!step) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 375;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 640;
  const tooltip = rect
    ? computeTooltipPosition(rect, tooltipHeight, vw, vh)
    : { top: vh / 2 - tooltipHeight / 2, left: (vw - 320) / 2, width: 320 };

  const next = () => (i < steps.length - 1 ? setI(i + 1) : onFinish());
  const prev = () => setI(Math.max(0, i - 1));

  const overlay = (
    <div className="fixed inset-0 z-[200]">
      {/* 스포트라이트 마스크 */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        aria-hidden
      >
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - PADDING}
                y={rect.top - PADDING}
                width={rect.width + PADDING * 2}
                height={rect.height + PADDING * 2}
                rx={CORNER}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.62)"
          mask="url(#tour-mask)"
        />
        {/* 하이라이트 링 */}
        {rect && (
          <rect
            x={rect.left - PADDING}
            y={rect.top - PADDING}
            width={rect.width + PADDING * 2}
            height={rect.height + PADDING * 2}
            rx={CORNER}
            fill="none"
            stroke="rgb(var(--clay-400))"
            strokeWidth="2.5"
          />
        )}
      </svg>

      {/* 툴팁 */}
      <div
        ref={tooltipRef}
        className="absolute rounded-2xl bg-surface border border-cream-200 shadow-pop p-5"
        style={{
          top: tooltip.top,
          left: tooltip.left,
          width: tooltip.width,
        }}
      >
        <div className="flex items-start gap-3 mb-3">
          {/* 마스코트 (원 없이) */}
          <Mascot variant={step.mascot ?? 'point'} size={56} className="flex-shrink-0" />
          <div className="flex-1 min-w-0 pt-1">
            <div className="text-[11px] font-bold text-clay-500 mb-0.5 tracking-wide">
              {i + 1} / {steps.length}
            </div>
            <h3 className="text-[15px] font-extrabold text-ink leading-snug">
              {step.title}
            </h3>
          </div>
        </div>
        <div className="text-[13px] text-ink leading-6 mb-4">{step.description}</div>
        <div className="flex gap-2">
          <button onClick={onFinish} className="btn-ghost flex-1 py-2 text-[13px]">
            건너뛰기
          </button>
          {i > 0 && (
            <button onClick={prev} className="btn-outline flex-1 py-2 text-[13px]">
              이전
            </button>
          )}
          <button onClick={next} className="btn-primary flex-1 py-2 text-[13px]">
            {i < steps.length - 1 ? '다음' : '시작!'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
