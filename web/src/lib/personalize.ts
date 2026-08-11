/**
 * 공통 알림장 텍스트를 특정 아이 이름 기준으로 개인화.
 * "우리 반 친구들은~" → "길동이는~", "친구들이" → "길동이가" 처럼
 * 복수 지칭 표현을 아이 호격형 + 알맞은 조사로 치환한다.
 * 단, "모든 친구들", "친구들과 함께", "친구들끼리" 처럼 개인화하면
 * 어색해지는 표현은 원본 그대로 남긴다.
 * AI 재호출 없이 정규식으로만 처리하기 위한 유틸.
 */

function hasJongseong(word: string): boolean {
  if (!word) return false;
  const last = word.slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

/** "길동" → "길동이", "지수" → "지수". 받침 있는 이름 뒤에만 호격 "이" 첨가. */
export function toChildForm(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  return hasJongseong(trimmed) ? `${trimmed}이` : trimmed;
}

function particle(word: string, withJong: string, withoutJong: string): string {
  return hasJongseong(word) ? withJong : withoutJong;
}

const PLURAL = '(?:친구들|아이들|어린이들|영유아들)';

// "친구들" 등 및 앞의 "우리 (반 (의)?)?" 수식 흡수
const TARGET_SRC = '(?:우리\\s*(?:반\\s*(?:의\\s*)?)?)?' + PLURAL;

// 개인화하면 어색해지는 표현. 매칭 부분을 임시 토큰으로 감췄다가 마지막에 복원.
// 1) 수량/집합 관형사 + 친구들 : "모든 친구들이" → 그대로
// 2) 친구들 + 과/와 + 함께 : 이미 "같이한다"는 뜻이라 아이 이름 넣으면 이상
// 3) 친구들끼리 / 친구들 사이 / 친구들 서로 : 복수 필수
const PROTECTED_SRC =
  '(?:' +
  '(?:모든|많은|여러|다른|몇몇|여럿|다양한|대부분(?:의)?|일부(?:의)?|각(?:각(?:의)?)?|여러\\s*명(?:의)?|몇\\s*명(?:의)?)\\s*' +
  PLURAL +
  '|' +
  PLURAL +
  '(?:과|와)\\s*함께' +
  '|' +
  PLURAL +
  '(?:끼리|\\s*사이|\\s*서로)' +
  ')';

// 눈에 잘 안 띄는 사설 영역(PUA) 문자로 마스킹해 원문/개인화 결과와 충돌 최소화.
const OPEN = '';
const CLOSE = '';

export function personalizeText(text: string, rawName: string): string {
  const name = rawName.trim();
  if (!text || !name) return text;
  const cf = toChildForm(name);

  const guarded: string[] = [];
  const masked = text.replace(new RegExp(PROTECTED_SRC, 'g'), (m) => {
    const idx = guarded.length;
    guarded.push(m);
    return `${OPEN}${idx}${CLOSE}`;
  });

  // 조사 규칙은 긴 매치가 먼저 매칭되도록 순서 유지.
  const rules: Array<[RegExp, string]> = [
    [new RegExp(TARGET_SRC + '(?:은|는)', 'g'), cf + particle(cf, '은', '는')],
    [new RegExp(TARGET_SRC + '이가', 'g'), cf + particle(cf, '이', '가')],
    [new RegExp(TARGET_SRC + '(?:이|가)(?![가-힣])', 'g'), cf + particle(cf, '이', '가')],
    [new RegExp(TARGET_SRC + '(?:을|를)', 'g'), cf + particle(cf, '을', '를')],
    [new RegExp(TARGET_SRC + '(?:과|와)', 'g'), cf + particle(cf, '과', '와')],
    [new RegExp(TARGET_SRC + '에게', 'g'), cf + '에게'],
    [new RegExp(TARGET_SRC + '에게서', 'g'), cf + '에게서'],
    [new RegExp(TARGET_SRC + '한테', 'g'), cf + '한테'],
    [new RegExp(TARGET_SRC + '의', 'g'), cf + '의'],
    [new RegExp(TARGET_SRC + '도', 'g'), cf + '도'],
    [new RegExp(TARGET_SRC + '만', 'g'), cf + '만'],
    [new RegExp(TARGET_SRC + '까지', 'g'), cf + '까지'],
    [new RegExp(TARGET_SRC, 'g'), cf],
  ];

  let out = masked;
  for (const [re, sub] of rules) {
    out = out.replace(re, sub);
  }
  return out.replace(
    new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g'),
    (_, i) => guarded[Number(i)] ?? ''
  );
}
