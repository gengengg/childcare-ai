import { supabase } from './supabase';
import { getSupabaseUserId } from './session';
import { getAllDailyRecords, type DailyRecord } from './dailyRecords';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'https://lesschildren-aigreater-production.up.railway.app';

export const WEEK_DAYS = ['월', '화', '수', '목', '금', '토'] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export type DaySlots = {
  morningFree: string;
  outdoor: string;
  special: string;
};

export type WeeklyDiary = {
  id: string;
  className: string;
  year: number;
  month: number;
  weekNumber: number;
  ageGroup: string;
  teacherName: string;
  directorName: string;
  theme: string;
  subtheme: string;
  expectations: string;
  days: Record<string, DaySlots>;    // { "월": {morningFree, outdoor, special}, ... }
  evaluations: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  class_name: string;
  year: number;
  month: number;
  week_number: number;
  age_group: string | null;
  teacher_name: string | null;
  director_name: string | null;
  theme: string | null;
  subtheme: string | null;
  expectations: string | null;
  days: Record<string, DaySlots> | null;
  evaluations: Record<string, string> | null;
  created_at: string;
  updated_at: string;
};

function fromRow(r: Row): WeeklyDiary {
  return {
    id: r.id,
    className: r.class_name,
    year: r.year,
    month: r.month,
    weekNumber: r.week_number,
    ageGroup: r.age_group ?? '',
    teacherName: r.teacher_name ?? '',
    directorName: r.director_name ?? '',
    theme: r.theme ?? '',
    subtheme: r.subtheme ?? '',
    expectations: r.expectations ?? '',
    days: r.days ?? {},
    evaluations: r.evaluations ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function emptyDaySlots(): DaySlots {
  return { morningFree: '', outdoor: '', special: '' };
}

export async function getWeeklyDiary(
  className: string,
  year: number,
  month: number,
  weekNumber: number
): Promise<WeeklyDiary | null> {
  const userId = await getSupabaseUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('weekly_diaries')
    .select('*')
    .eq('user_id', userId)
    .eq('class_name', className)
    .eq('year', year)
    .eq('month', month)
    .eq('week_number', weekNumber)
    .maybeSingle();
  if (error) {
    console.error('[weeklyDiaries.get]', error);
    return null;
  }
  return data ? fromRow(data as Row) : null;
}

export async function saveWeeklyDiary(input: {
  className: string;
  year: number;
  month: number;
  weekNumber: number;
  ageGroup: string;
  teacherName: string;
  directorName: string;
  theme: string;
  subtheme: string;
  expectations: string;
  days: Record<string, DaySlots>;
  evaluations: Record<string, string>;
}): Promise<WeeklyDiary> {
  const userId = await getSupabaseUserId();
  if (!userId) throw new Error('로그인이 필요해요.');
  const { data, error } = await supabase
    .from('weekly_diaries')
    .upsert(
      {
        user_id: userId,
        class_name: input.className,
        year: input.year,
        month: input.month,
        week_number: input.weekNumber,
        age_group: input.ageGroup,
        teacher_name: input.teacherName,
        director_name: input.directorName,
        theme: input.theme,
        subtheme: input.subtheme,
        expectations: input.expectations,
        days: input.days,
        evaluations: input.evaluations,
      },
      { onConflict: 'user_id,class_name,year,month,week_number' }
    )
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('주간일지 저장 실패');
  return fromRow(data as Row);
}

export async function listWeeklyDiariesForMonth(
  className: string,
  year: number,
  month: number
): Promise<WeeklyDiary[]> {
  const userId = await getSupabaseUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('weekly_diaries')
    .select('*')
    .eq('user_id', userId)
    .eq('class_name', className)
    .eq('year', year)
    .eq('month', month)
    .order('week_number');
  if (error) {
    console.error('[weeklyDiaries.list]', error);
    return [];
  }
  return (data as Row[]).map(fromRow);
}

/**
 * 그 주의 각 요일 날짜(YYYY-MM-DD)를 계산.
 * 어린이집 관례: '그 달의 첫 월요일이 있는 주 = 1주'.
 * 5주가 되는 달도 있음.
 */
export function datesForWeek(
  year: number,
  month: number,
  weekNumber: number
): Record<WeekDay, string> {
  const firstOfMonth = new Date(year, month - 1, 1);
  const firstDow = firstOfMonth.getDay(); // 0=일
  const firstMondayDay = firstDow === 0 ? 2 : firstDow === 1 ? 1 : 9 - firstDow;
  const mondayDay = firstMondayDay + (weekNumber - 1) * 7;
  const result = {} as Record<WeekDay, string>;
  for (let i = 0; i < WEEK_DAYS.length; i++) {
    const d = new Date(year, month - 1, mondayDay + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    result[WEEK_DAYS[i]] = `${y}-${m}-${dd}`;
  }
  return result;
}

/**
 * 월간계획안의 그 주 활동 리스트를 요일별 슬롯에 규칙 기반 자동 배분.
 * - (바깥놀이) / (실외놀이) 접두 → outdoor
 * - (실내대체) 접두 → outdoor (대체활동)
 * - (특별활동) / (오감놀이) / (영어) / (체육) 접두 → special
 * - 나머지 → morningFree
 * 각 슬롯 안에서 활동을 요일에 round-robin으로 나눈다.
 */
export function autoDistribute(
  activities: string[],
  days: WeekDay[]
): Record<string, DaySlots> {
  const slots: Record<WeekDay, DaySlots> = {} as any;
  for (const d of days) slots[d] = emptyDaySlots();

  const outdoor: string[] = [];
  const special: string[] = [];
  const morning: string[] = [];

  for (const raw of activities) {
    const a = raw.trim();
    if (!a) continue;
    const lower = a.replace(/\s+/g, '');
    if (/^\(바깥놀이\)|^\(실외놀이\)|^\(실내대체\)/.test(a)) {
      outdoor.push(a);
    } else if (/^\(특별활동\)|^\(오감놀이\)|^\(영어\)|^\(체육\)|오감놀이|체육수업|영어수업/.test(lower)) {
      special.push(a);
    } else {
      morning.push(a);
    }
  }

  const pushRR = (list: string[], key: keyof DaySlots) => {
    list.forEach((a, i) => {
      const day = days[i % days.length];
      const prev = slots[day][key];
      slots[day][key] = prev ? `${prev}\n${a}` : a;
    });
  };
  pushRR(morning, 'morningFree');
  pushRR(outdoor, 'outdoor');
  pushRR(special, 'special');

  return slots;
}

/**
 * 아이 이름을 [영아]로 마스킹. 개인 알림장 본문을 반 총평 참고용으로 쓸 때.
 * childName이 여러 번 등장할 수 있고, 조사도 붙을 수 있어 단순 replace로 처리.
 */
export function maskChildName(text: string, childName: string): string {
  if (!childName || !text) return text;
  return text.split(childName).join('[영아]');
}

/**
 * 그 주 날짜 범위에 저장된 반 공통/개인 알림장을 수집.
 * 반환: { 월: {common:[], masked:[]}, 화: {...}, ... }
 */
export async function collectRecordsForWeek(
  className: string,
  dates: Record<WeekDay, string>
): Promise<Record<WeekDay, { common: string[]; masked: string[] }>> {
  const all = await getAllDailyRecords();
  const dateToDay: Record<string, WeekDay> = {};
  (Object.entries(dates) as [WeekDay, string][]).forEach(([day, date]) => {
    dateToDay[date] = day;
  });

  const result = {} as Record<WeekDay, { common: string[]; masked: string[] }>;
  for (const day of WEEK_DAYS) result[day] = { common: [], masked: [] };

  const belongsTo = (r: DailyRecord) => dateToDay[r.date] as WeekDay | undefined;
  const isCommonRecord = (r: DailyRecord) =>
    r.childId.startsWith('common-') || r.childName.includes('공통');
  const isThisClass = (r: DailyRecord) =>
    !className || (r.className || '').trim() === className;

  for (const r of all) {
    const day = belongsTo(r);
    if (!day) continue;
    if (!isThisClass(r)) continue;
    const body = (r.teacherFinal || r.aiDraft || '').trim();
    if (!body) continue;
    if (isCommonRecord(r)) {
      result[day].common.push(body);
    } else {
      result[day].masked.push(maskChildName(body, r.childName));
    }
  }
  return result;
}

export async function exportWeeklyDiaryDocx(input: {
  className: string;
  year: number;
  month: number;
  weekNumber: number;
  ageGroup: string;
  teacherName: string;
  directorName: string;
  theme: string;
  subtheme: string;
  expectations: string;
  days: Record<string, DaySlots>;
  evaluations: Record<string, string>;
  dates: Record<WeekDay, string>;
}): Promise<void> {
  const payload = {
    class_name: input.className,
    year: input.year,
    month: input.month,
    week_number: input.weekNumber,
    age_group: input.ageGroup,
    teacher_name: input.teacherName,
    director_name: input.directorName,
    theme: input.theme,
    subtheme: input.subtheme,
    expectations: input.expectations,
    days: input.days,
    evaluations: input.evaluations,
    dates: input.dates,
  };
  const res = await fetch(`${API_BASE_URL}/export-weekly-diary-docx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = 'DOCX 생성 실패';
    try {
      const j = await res.json();
      if (j?.detail) msg = String(j.detail);
    } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const filename = `주간보육일지_${input.year}년${input.month}월${input.weekNumber}주_${input.className || '반'}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function generateWeeklyEvaluations(input: {
  className: string;
  year: number;
  month: number;
  weekNumber: number;
  theme: string;
  subtheme: string;
  styleGuide: string;
  days: WeekDay[];
  dates: Record<WeekDay, string>;
  slots: Record<string, DaySlots>;
  records: Record<WeekDay, { common: string[]; masked: string[] }>;
}): Promise<Record<string, string>> {
  const payload = {
    class_name: input.className,
    year: input.year,
    month: input.month,
    week_number: input.weekNumber,
    theme: input.theme,
    subtheme: input.subtheme,
    style_guide: input.styleGuide,
    days: input.days.map((d) => ({
      day: d,
      date: input.dates[d],
      morning_free: input.slots[d]?.morningFree ?? '',
      outdoor: input.slots[d]?.outdoor ?? '',
      special: input.slots[d]?.special ?? '',
      common_records: input.records[d]?.common ?? [],
      masked_personal_records: input.records[d]?.masked ?? [],
    })),
  };
  const res = await fetch(`${API_BASE_URL}/generate-weekly-evaluations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = '총평 생성 실패';
    try {
      const j = await res.json();
      if (j?.detail) msg = String(j.detail);
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}
