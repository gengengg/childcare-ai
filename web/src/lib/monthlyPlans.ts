import { supabase } from './supabase';
import { getSupabaseUserId } from './session';

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
 * ISO week 방식은 어린이집 관례와 다를 수 있음.
 * 여기서는 "그 달의 첫 월요일이 있는 주 = 1주" 방식을 쓴다.
 * (첫 월요일 이전 날짜는 1주에 포함)
 */
export function weekOfMonth(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return 1;
  const day = d.getDate();
  const firstDow = new Date(d.getFullYear(), d.getMonth(), 1).getDay(); // 0=일
  // 그 달의 첫 월요일 날짜
  const firstMonday = firstDow === 0 ? 2 : firstDow === 1 ? 1 : 9 - firstDow;
  if (day < firstMonday) return 1;
  return Math.floor((day - firstMonday) / 7) + 1;
}
