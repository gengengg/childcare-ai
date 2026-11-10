import { clsx } from 'clsx';

/**
 * 온퇴근 브랜드 마크.
 *
 * - `mark`: 문서 캐릭터 심볼만 (빈 상태, 튜토리얼, 로딩 등 작은 자리)
 * - `emblem`: 원형 엠블럼 + '온퇴근' 글자 (로그인/온보딩 같은 첫 화면)
 *
 * 대부분 옆에 설명 텍스트가 같이 있으므로 기본은 장식용(alt 없음)이다.
 * 로고 자체가 정보를 전달하는 자리에서는 `label`을 넘긴다.
 */
type Props = {
  variant?: 'mark' | 'emblem';
  size?: number;
  /** muted: 빈 상태처럼 덜 강조해야 하는 자리 */
  tone?: 'color' | 'muted';
  label?: string;
  className?: string;
};

const SRC = {
  mark: '/brand/ontoegeun-mark.svg',
  emblem: '/brand/ontoegeun-emblem.svg',
} as const;

export function BrandMark({ variant = 'mark', size = 48, tone = 'color', label, className }: Props) {
  return (
    <img
      src={SRC[variant]}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
      className={clsx(
        'inline-block object-contain select-none',
        tone === 'muted' && 'opacity-40 grayscale-[30%]',
        className
      )}
    />
  );
}
