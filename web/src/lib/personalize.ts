/**
 * 공통 알림장 텍스트를 특정 아이 이름 기준으로 개인화.
 * "우리 반 친구들은~" → "길동이는~", "친구들이" → "길동이가" 처럼
 * 복수 지칭 표현을 아이 호격형 + 알맞은 조사로 치환한다.
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

// "친구들 / 아이들 / 어린이들 / 영유아들" 및 앞의 "우리 (반 (의)?)?" 수식 흡수
const TARGET_SRC = '(?:우리\\s*(?:반\\s*(?:의\\s*)?)?)?(?:친구들|아이들|어린이들|영유아들)';

export function personalizeText(text: string, rawName: string): string {
  const name = rawName.trim();
  if (!text || !name) return text;
  const cf = toChildForm(name);

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

  let out = text;
  for (const [re, sub] of rules) {
    out = out.replace(re, sub);
  }
  return out;
}
