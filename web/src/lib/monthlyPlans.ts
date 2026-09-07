import { supabase } from './supabase';
import { getSupabaseUserId } from './session';
import { firstWeekMondayOffset } from './weeklyDiaries';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'https://lesschildren-aigreater-production.up.railway.app';

export type MonthlyPlanWeek = {
  weekNumber: number;
  subtheme: string;
  activities: string[];
};

export type MonthlyPlan = {
  id: string;
  className: string;
  year: number;
  month: number;
  theme: string;
  weeks: MonthlyPlanWeek[];
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  class_name: string;
  year: number;
  month: number;
  theme: string | null;
  weeks: MonthlyPlanWeek[] | null;
  created_at: string;
  updated_at: string;
};

function fromRow(r: Row): MonthlyPlan {
  return {
    id: r.id,
    className: r.class_name,
    year: r.year,
    month: r.month,
    theme: r.theme ?? '',
    weeks: r.weeks ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** 백엔드로 파일을 보내 파싱된 구조를 받는다. 저장은 별도. */
export async function parseMonthlyPlanFile(file: File): Promise<{
  year: number | null;
  month: number | null;
  theme: string;
  weeks: MonthlyPlanWeek[];
}> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/parse-monthly-plan`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    let msg = '월간계획안 파싱 실패';
    try {
      const j = await res.json();
      if (j?.detail) msg = String(j.detail);
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function getMonthlyPlan(
  className: string,
  year: number,
  month: number
): Promise<MonthlyPlan | null> {
  const userId = await getSupabaseUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('monthly_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('class_name', className)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();
  if (error) {
    console.error('[monthlyPlans.get]', error);
    return null;
  }
  return data ? fromRow(data as Row) : null;
}

export async function saveMonthlyPlan(input: {
  className: string;
  year: number;
  month: number;
  theme: string;
  weeks: MonthlyPlanWeek[];
}): Promise<MonthlyPlan> {
  const userId = await getSupabaseUserId();
  if (!userId) throw new Error('로그인이 필요해요.');
  const { data, error } = await supabase
    .from('monthly_plans')
    .upsert(
      {
        user_id: userId,
        class_name: input.className,
        year: input.year,
        month: input.month,
        theme: input.theme,
        weeks: input.weeks,
      },
      { onConflict: 'user_id,class_name,year,month' }
    )
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('월간계획안 저장 실패');
  return fromRow(data as Row);
}

export async function deleteMonthlyPlan(
  className: string,
  year: number,
  month: number
): Promise<void> {
  const userId = await getSupabaseUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('monthly_plans')
    .delete()
    .eq('user_id', userId)
    .eq('class_name', className)
    .eq('year', year)
    .eq('month', month);
  if (error) throw error;
}

/**
 * 그 날짜가 속한 (년, 월, 주)를 계산.
 * 주 기준은 월~금. 달이 걸치는 주(예: 8/31 월 ~ 9/4 금)는 다음 달의 1주로 취급.
 * 토·일도 그 주의 월요일이 속한 주로 함께 계산되므로 예) 9/6(일) → 9월 1주.
 */
export function weekAssignment(dateStr: string): {
  year: number;
  month: number;
  week: number;
} {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return { year: 1970, month: 1, week: 1 };
  const dow = d.getDay(); // 0=일..6=토
  const daysBackToMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - daysBackToMonday);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  // 금요일이 속한 달 = 이 주가 소속되는 달 (걸치는 주는 다음 달의 1주)
  const targetYear = friday.getFullYear();
  const targetMonth = friday.getMonth() + 1;
  const w1MondayOffset = firstWeekMondayOffset(targetYear, targetMonth - 1);
  const w1Monday = new Date(targetYear, targetMonth - 1, w1MondayOffset);
  const diffDays = Math.round(
    (monday.getTime() - w1Monday.getTime()) / (24 * 3600 * 1000)
  );
  const week = Math.floor(diffDays / 7) + 1;
  return { year: targetYear, month: targetMonth, week };
}

/** 옛 API: 그 날짜의 소속 월 안에서의 주 번호만 필요할 때. */
export function weekOfMonth(dateStr: string): number {
  return weekAssignment(dateStr).week;
}
