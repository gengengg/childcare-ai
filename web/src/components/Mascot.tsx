/**
 * 마스코트 '햄찌' 컴포넌트.
 *
 * 지금은 이모지 🐹 로 렌더링. 나중에 커스텀 이미지를 준비하면
 * 아래 IMAGE_MAP 에 URL/import 를 등록하기만 하면 즉시 교체됨.
 *
 * 이미지 파일 위치 권장: `web/public/mascot/hamzzi-{variant}.png` (투명 배경)
 * 사이즈: 정사각형, 최소 256px (레티나 대응)
 */

import { useState } from 'react';
import { clsx } from 'clsx';

export type MascotVariant =
  | 'happy'      // 기본, 웃는 얼굴
  | 'thinking'   // 궁리하는 표정 (안내/설명)
  | 'point'      // 뭔가 가리키는 자세 (튜토리얼)
  | 'wave'       // 인사 (환영)
  | 'sleep';     // 자는 (게스트/비어있음)

/**
 * variant → 이미지 경로 매핑.
 * 이미지가 없으면 이모지로 대체됨.
 *
 * 예:
 *   happy: '/mascot/hamzzi-happy.png',
 */
const IMAGE_MAP: Partial<Record<MascotVariant, string>> = {
  happy: '/mascot/hamzzi-happy.png',
  thinking: '/mascot/hamzzi-thinking.png',
  point: '/mascot/hamzzi-point.png',
  wave: '/mascot/hamzzi-wave.png',
  sleep: '/mascot/hamzzi-sleep.png',
};

/** 이미지 없을 때 폴백 이모지. */
const EMOJI_FALLBACK: Record<MascotVariant, string> = {
  happy: '🐹',
  thinking: '🤔',
  point: '👉🐹',
  wave: '👋🐹',
  sleep: '💤🐹',
};

type Props = {
  variant?: MascotVariant;
  size?: number; // px
  className?: string;
};

export function Mascot({ variant = 'happy', size = 48, className }: Props) {
  const src = IMAGE_MAP[variant];
  const [errored, setErrored] = useState(false);

  if (src && !errored) {
    return (
      <img
        src={src}
        alt="햄찌"
        width={size}
        height={size}
        onError={() => setErrored(true)}
        className={clsx('inline-block object-contain', className)}
      />
    );
  }
  // 이모지 폴백 (이미지 없거나 로드 실패)
  return (
    <span
      className={clsx('inline-flex items-center justify-center leading-none', className)}
      style={{ fontSize: size * 0.85, width: size, height: size }}
      aria-label="햄찌"
      role="img"
    >
      {EMOJI_FALLBACK[variant]}
    </span>
  );
}
