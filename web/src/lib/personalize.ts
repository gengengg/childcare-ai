/**
 * 공통 알림장 텍스트를 특정 아이 이름 기준으로 개인화.
 * "우리 반 친구들은~" → "길동이는~", "친구들이" → "길동이가" 처럼
 * 복수 지칭 표현을 아이 호격형 + 알맞은 조사로 치환한다.
 * 단, 아래 표현은 원본 그대로 남긴다:
 *  - "모든/많은/여러/… 친구들" (수량 관형사)
 *  - "친구들과 함께", "친구들끼리", "친구들 사이/서로"
 *  - "동물 친구들", "블록 친구들" 처럼 명사가 앞에 붙은 관용 표현
 *    (단 "우리 (반) (의)?"만 예외로 개인화 유지)
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

// 무조건 protected: 수량/집합 관형사, "친구들과 함께", "친구들끼리/사이/서로"
const ALWAYS_PROTECTED_SRC =
  '(?:' +
  '(?:모든|많은|여러|다른|몇몇|여럿|다양한|대부분(?:의)?|일부(?:의)?|각(?:각(?:의)?)?|여러\\s*명(?:의)?|몇\\s*명(?:의)?)\\s*' +
  PLURAL +
  '|' +
  PLURAL +
  '(?:과|와)\\s*함께' +
  '|' +
  PLURAL +
  '끼리' +
  '|' +
  PLURAL +
  '(?:[이가은는]|와|과)?\\s*(?:사이|서로)' +
  '|' +
  PLURAL +
  '(?:[이가은는을를과와]|에게)?\\s*(?:모두|다\\s*같이|다\\s*함께|다들|여럿(?:이|가)?|각자|각각|저마다)' +
  ')';

// 명사 prefix 가 붙은 경우 (예: "동물 친구들") protected.
// 단 앞이 "우리 (반) (의)?"이면 개인화 대상으로 남긴다 (callback 에서 판정).
const PREFIXED_SRC = '[가-힣]+\\s+' + PLURAL;

// 유니코드 non-character (﷐/﷑) 로 마스킹. 정상 텍스트에
// 절대 등장하지 않아 원문의 숫자·문장부호와 충돌하지 않는다.
// (과거에 빈 문자열로 저장되어 원문의 '1.' 같은 번호와 index 숫자가
// 엉키던 버그가 있었음)
const OPEN = '﷐';
const CLOSE = '﷑';

function isOurPrefix(before: string): boolean {
  return /(?:^|\s)우리(?:\s+반(?:\s+의|의)?)?\s+$/.test(before);
}
function startsWithOur(match: string): boolean {
  return /^우리(?:\s+반(?:\s+의|의)?)?\s+/.test(match);
}

export function personalizeText(text: string, rawName: string): string {
  const name = rawName.trim();
  if (!text || !name) return text;
  const cf = toChildForm(name);

  const guarded: string[] = [];
  const guard = (m: string): string => {
    const idx = guarded.length;
    guarded.push(m);
    return `${OPEN}${idx}${CLOSE}`;
  };

  let masked = text.replace(new RegExp(ALWAYS_PROTECTED_SRC, 'g'), guard);
  masked = masked.replace(
    new RegExp(PREFIXED_SRC, 'g'),
    (match: string, offset: number, src: string) => {
      if (startsWithOur(match)) return match;
      if (isOurPrefix(src.slice(0, offset))) return match;
      return guard(match);
    }
  );

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
