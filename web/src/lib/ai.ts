/**
 * 백엔드 API 클라이언트.
 * 백엔드는 기존 Railway 배포를 그대로 재사용한다.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'https://lesschildren-aigreater-production.up.railway.app';

export type ActivityInput = {
  category: string;
  title: string;
  memo: string;
};

export type GenerateDailyRecordInput = {
  childName: string;
  className: string;
  date: string;
  activities: ActivityInput[];
  mealNote: string;
  napNote: string;
  healthNote: string;
  images?: string[]; // base64 (data URL prefix 제거된 순수 base64)
  styleGuide?: string;
  emojiEnabled?: boolean;
  areaLabelsEnabled?: boolean;
};

export type DailyRecordResult = {
  draft: string;
  isFallback: boolean;
  warning?: string;
};

export async function generateDailyRecordWithAI(
  input: GenerateDailyRecordInput
): Promise<DailyRecordResult> {
  const response = await fetch(`${API_BASE_URL}/generate-daily-record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      child_name: input.childName,
      class_name: input.className,
      date: input.date,
      activities: input.activities.map((a) => ({
        category: a.category,
        title: a.title,
        memo: a.memo,
      })),
      meal_note: input.mealNote,
      nap_note: input.napNote,
      health_note: input.healthNote,
      images: input.images ?? [],
      style_guide: input.styleGuide ?? '',
      emoji_enabled: input.emojiEnabled ?? true,
      area_labels_enabled: input.areaLabelsEnabled ?? false,
    }),
  });

  if (!response.ok) throw new Error('AI 알림장 생성에 실패했어요.');
  const data = await response.json();
  return {
    draft: String(data.draft ?? ''),
    isFallback: data.source === 'fallback',
    warning: data.warning,
  };
}

export type StyleSampleInput =
  | { kind: 'text'; text: string }
  | { kind: 'image'; imageBase64: string };

export async function analyzeStyleSamples(samples: StyleSampleInput[]): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/analyze-style`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      samples: samples.map((s) =>
        s.kind === 'text'
          ? { kind: 'text', text: s.text }
          : { kind: 'image', image_base64: s.imageBase64 }
      ),
    }),
  });

  if (!response.ok) {
    let detail = '문체 분석에 실패했어요.';
    try {
      const data = await response.json();
      if (data?.detail) detail = String(data.detail);
    } catch {}
    throw new Error(detail);
  }

  const data = await response.json();
  return String(data.style_guide ?? '').trim();
}

export type ObservationSourceRecord = {
  date: string;
  teacherFinal: string;
  activities: ActivityInput[];
  mealNote: string;
  napNote: string;
  healthNote: string;
};

export type ObservationCategories = {
  기본생활습관: string;
  신체건강: string;
  의사소통: string;
  사회관계: string;
  예술경험: string;
  자연탐구: string;
  총평: string;
};

export type GenerateObservationInput = {
  childName: string;
  className: string;
  childAge: number;
  startDate: string;
  endDate: string;
  records: ObservationSourceRecord[];
  childObservationNotes?: string;
};

export async function generateObservationStructured(
  input: GenerateObservationInput
): Promise<ObservationCategories> {
  const response = await fetch(`${API_BASE_URL}/generate-observation-structured`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      child_name: input.childName,
      class_name: input.className,
      child_age: input.childAge,
      start_date: input.startDate,
      end_date: input.endDate,
      child_observation_notes: input.childObservationNotes ?? '',
      records: input.records.map((r) => ({
        date: r.date,
        teacher_final: r.teacherFinal,
        activities: r.activities.map((a) => ({
          category: a.category,
          title: a.title,
          memo: a.memo,
        })),
        meal_note: r.mealNote,
        nap_note: r.napNote,
        health_note: r.healthNote,
      })),
    }),
  });

  if (!response.ok) throw new Error('AI 관찰일지 생성에 실패했어요.');
  return response.json();
}

export type ExportDocxInput = {
  childName: string;
  className: string;
  observationDate: string;
  teacherName: string;
  semester: 1 | 2;
  content: ObservationCategories;
};

export async function exportObservationDocx(input: ExportDocxInput): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/export-observation-docx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      child_name: input.childName,
      class_name: input.className,
      observation_date: input.observationDate,
      teacher_name: input.teacherName,
      semester: input.semester,
      content: input.content,
    }),
  });

  if (!response.ok) throw new Error('docx 파일 생성에 실패했어요.');
  return response.blob();
}

/**
 * 브라우저에서 Blob을 파일로 다운로드.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
