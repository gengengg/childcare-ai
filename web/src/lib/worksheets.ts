import { supabase } from './supabase';
import { getSupabaseUserId } from './session';

export type AgeGroup = '0-2' | '3-5' | 'all';

export const SEASONS = ['봄', '여름', '가을', '겨울', '명절', '공용'] as const;
export type Season = (typeof SEASONS)[number];

export const DEVELOPMENTAL_AREAS = [
  '신체·건강',
  '의사소통',
  '사회관계',
  '예술경험',
  '자연탐구',
] as const;
export type DevelopmentalArea = (typeof DEVELOPMENTAL_AREAS)[number];

export const ACTIVITY_TYPES = [
  '오리기',
  '붙이기',
  '색칠',
  '매칭',
  '미로',
  '따라쓰기',
  '만들기',
  '관찰',
  '기타',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type WorksheetFile = {
  id: string;
  worksheetId: string;
  filePath: string;
  originalName: string;
  sortOrder: number;
  sizeBytes: number | null;
  createdAt: string;
};

export type Worksheet = {
  id: string;
  title: string;
  description: string;
  files: WorksheetFile[];
  thumbnailPath: string | null;
  ageGroup: AgeGroup;
  seasons: string[];
  developmentalAreas: string[];
  activityTypes: string[];
  tags: string[];
  isPublished: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorksheetInput = {
  title: string;
  description?: string;
  ageGroup: AgeGroup;
  seasons: string[];
  developmentalAreas: string[];
  activityTypes: string[];
  tags?: string[];
  isPublished?: boolean;
};

type FileRow = {
  id: string;
  worksheet_id: string;
  file_path: string;
  original_name: string | null;
  sort_order: number;
  size_bytes: number | null;
  created_at: string;
};

type Row = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_path: string | null;
  age_group: AgeGroup;
  seasons: string[] | null;
  developmental_areas: string[] | null;
  activity_types: string[] | null;
  tags: string[] | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  worksheet_files: FileRow[] | null;
};

function fileFromRow(f: FileRow): WorksheetFile {
  return {
    id: f.id,
    worksheetId: f.worksheet_id,
    filePath: f.file_path,
    originalName: f.original_name ?? '',
    sortOrder: f.sort_order,
    sizeBytes: f.size_bytes,
    createdAt: f.created_at,
  };
}

function fromRow(r: Row): Worksheet {
  const files = (r.worksheet_files ?? [])
    .map(fileFromRow)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    files,
    thumbnailPath: r.thumbnail_path,
    ageGroup: r.age_group,
    seasons: r.seasons ?? [],
    developmentalAreas: r.developmental_areas ?? [],
    activityTypes: r.activity_types ?? [],
    tags: r.tags ?? [],
    isPublished: r.is_published,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const BUCKET = 'worksheets';

const ALLOWED = [
  { ext: 'pdf', mime: 'application/pdf' },
  { ext: 'png', mime: 'image/png' },
] as const;

function detectKind(file: File): { ext: string; mime: string } {
  const lower = file.name.toLowerCase();
  const byName = ALLOWED.find((a) => lower.endsWith('.' + a.ext));
  if (byName) return byName;
  const byMime = ALLOWED.find((a) => a.mime === file.type);
  if (byMime) return byMime;
  throw new Error(`"${file.name}" 은 PDF 또는 PNG 가 아니에요.`);
}

export function fileExtension(filePath: string): string {
  const idx = filePath.lastIndexOf('.');
  return idx >= 0 ? filePath.slice(idx + 1).toLowerCase() : '';
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const userId = await getSupabaseUserId();
  if (!userId) return false;
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.is_admin);
}

export async function listWorksheets(opts?: {
  includeUnpublished?: boolean;
}): Promise<Worksheet[]> {
  let q = supabase
    .from('worksheets')
    .select('*, worksheet_files(*)')
    .order('created_at', { ascending: false });
  if (!opts?.includeUnpublished) q = q.eq('is_published', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => fromRow(r as Row));
}

async function getWorksheet(id: string): Promise<Worksheet> {
  const { data, error } = await supabase
    .from('worksheets')
    .select('*, worksheet_files(*)')
    .eq('id', id)
    .single();
  if (error || !data) throw error ?? new Error('활동지 조회 실패');
  return fromRow(data as Row);
}

async function uploadOne(
  worksheetId: string,
  file: File
): Promise<{ path: string; kind: { ext: string; mime: string } }> {
  const kind = detectKind(file);
  const fileId = crypto.randomUUID();
  const path = `${worksheetId}/${fileId}.${kind.ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: kind.mime,
    upsert: false,
  });
  if (error) throw error;
  return { path, kind };
}

/** 관리자 전용: 여러 파일 업로드 + worksheet 메타데이터 저장. */
export async function uploadWorksheet(
  files: File[],
  input: WorksheetInput
): Promise<Worksheet> {
  const userId = await getSupabaseUserId();
  if (!userId) throw new Error('로그인이 필요해요.');
  if (files.length === 0) throw new Error('최소 1개의 파일이 필요해요.');
  files.forEach(detectKind); // 사전 검증: 모두 허용 형식인지 먼저 확인

  const worksheetId = crypto.randomUUID();
  const uploadedPaths: string[] = [];

  try {
    for (const f of files) {
      const { path } = await uploadOne(worksheetId, f);
      uploadedPaths.push(path);
    }

    const { error: wErr } = await supabase.from('worksheets').insert({
      id: worksheetId,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      age_group: input.ageGroup,
      seasons: input.seasons,
      developmental_areas: input.developmentalAreas,
      activity_types: input.activityTypes,
      tags: input.tags ?? [],
      is_published: input.isPublished ?? false,
      created_by: userId,
    });
    if (wErr) throw wErr;

    const inserts = uploadedPaths.map((p, i) => ({
      worksheet_id: worksheetId,
      file_path: p,
      original_name: files[i].name,
      sort_order: i,
      size_bytes: files[i].size,
    }));
    const { error: fErr } = await supabase.from('worksheet_files').insert(inserts);
    if (fErr) throw fErr;

    return await getWorksheet(worksheetId);
  } catch (e) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(BUCKET).remove(uploadedPaths).catch(() => {});
    }
    try {
      await supabase.from('worksheets').delete().eq('id', worksheetId);
    } catch {
      // rollback best-effort
    }
    throw e;
  }
}

/** 기존 worksheet 에 파일 추가. */
export async function addFilesToWorksheet(
  worksheetId: string,
  files: File[]
): Promise<Worksheet> {
  if (files.length === 0) return getWorksheet(worksheetId);
  files.forEach(detectKind);

  const { data: existing } = await supabase
    .from('worksheet_files')
    .select('sort_order')
    .eq('worksheet_id', worksheetId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const startOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const uploadedPaths: string[] = [];
  try {
    for (const f of files) {
      const { path } = await uploadOne(worksheetId, f);
      uploadedPaths.push(path);
    }
    const inserts = uploadedPaths.map((p, i) => ({
      worksheet_id: worksheetId,
      file_path: p,
      original_name: files[i].name,
      sort_order: startOrder + i,
      size_bytes: files[i].size,
    }));
    const { error } = await supabase.from('worksheet_files').insert(inserts);
    if (error) throw error;
    return await getWorksheet(worksheetId);
  } catch (e) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(BUCKET).remove(uploadedPaths).catch(() => {});
    }
    throw e;
  }
}

export async function removeWorksheetFile(fileId: string): Promise<void> {
  const { data, error: getErr } = await supabase
    .from('worksheet_files')
    .select('file_path')
    .eq('id', fileId)
    .maybeSingle();
  if (getErr) throw getErr;
  if (data?.file_path) {
    await supabase.storage.from(BUCKET).remove([data.file_path]).catch(() => {});
  }
  const { error } = await supabase.from('worksheet_files').delete().eq('id', fileId);
  if (error) throw error;
}

export async function updateWorksheet(
  id: string,
  patch: Partial<WorksheetInput>
): Promise<Worksheet> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title.trim();
  if (patch.description !== undefined) row.description = patch.description.trim();
  if (patch.ageGroup !== undefined) row.age_group = patch.ageGroup;
  if (patch.seasons !== undefined) row.seasons = patch.seasons;
  if (patch.developmentalAreas !== undefined)
    row.developmental_areas = patch.developmentalAreas;
  if (patch.activityTypes !== undefined) row.activity_types = patch.activityTypes;
  if (patch.tags !== undefined) row.tags = patch.tags;
  if (patch.isPublished !== undefined) row.is_published = patch.isPublished;

  const { error } = await supabase.from('worksheets').update(row).eq('id', id);
  if (error) throw error;
  return await getWorksheet(id);
}

export async function togglePublished(id: string, next: boolean): Promise<void> {
  const { error } = await supabase
    .from('worksheets')
    .update({ is_published: next })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteWorksheet(id: string): Promise<void> {
  const { data: filesData } = await supabase
    .from('worksheet_files')
    .select('file_path')
    .eq('worksheet_id', id);
  const paths = (filesData ?? []).map((f) => f.file_path).filter(Boolean) as string[];

  const { data: wRow } = await supabase
    .from('worksheets')
    .select('thumbnail_path')
    .eq('id', id)
    .maybeSingle();
  if (wRow?.thumbnail_path) paths.push(wRow.thumbnail_path);

  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
  }

  const { error } = await supabase.from('worksheets').delete().eq('id', id);
  if (error) throw error;
}

/** 미리보기/다운로드용 signed URL. 기본 1시간 유효. */
export async function createWorksheetUrl(
  filePath: string,
  expiresInSec = 60 * 60
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, expiresInSec);
  if (error || !data?.signedUrl) throw error ?? new Error('URL 생성 실패');
  return data.signedUrl;
}
