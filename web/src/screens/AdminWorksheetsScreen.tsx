import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Header } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import { useToast } from '@/components/Toast';
import {
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from '@/components/icons';
import {
  ACTIVITY_TYPES,
  DEVELOPMENTAL_AREAS,
  SEASONS,
  addFilesToWorksheet,
  createWorksheetUrl,
  deleteWorksheet,
  fileExtension,
  isCurrentUserAdmin,
  listWorksheets,
  removeWorksheetFile,
  togglePublished,
  updateWorksheet,
  uploadWorksheet,
  type AgeGroup,
  type Worksheet,
  type WorksheetFile,
  type WorksheetInput,
} from '@/lib/worksheets';

const AGE_OPTIONS: { value: AgeGroup; label: string }[] = [
  { value: '0-2', label: '0~2세' },
  { value: '3-5', label: '3~5세' },
  { value: 'all', label: '전체' },
];

const emptyDraft: WorksheetInput = {
  title: '',
  description: '',
  ageGroup: 'all',
  seasons: [],
  developmentalAreas: [],
  activityTypes: [],
  tags: [],
  isPublished: false,
};

export function AdminWorksheetsScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [items, setItems] = useState<Worksheet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const ok = await isCurrentUserAdmin();
      setAllowed(ok);
      setChecked(true);
      if (ok) {
        try {
          setItems(await listWorksheets({ includeUnpublished: true }));
        } catch (e) {
          toast.show(e instanceof Error ? e.message : '목록 불러오기 실패', 'error');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    })();
  }, [toast]);

  const reload = async () => {
    try {
      setItems(await listWorksheets({ includeUnpublished: true }));
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '목록 불러오기 실패', 'error');
    }
  };

  if (!checked) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <>
        <Header title="활동지 관리" back />
        <Card className="mb-4">
          <p className="text-[15px] text-ink">이 화면은 관리자만 접근할 수 있어요.</p>
          <button onClick={() => navigate('/settings')} className="btn-ghost w-full mt-3">
            설정으로 돌아가기
          </button>
        </Card>
      </>
    );
  }

  return (
    <>
      <Header title="활동지 라이브러리" subtitle="관리자 전용" back />
      <UploadCard onDone={reload} />
      <ListCard items={items} loading={loading} onChanged={reload} />
    </>
  );
}

function UploadCard({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState<WorksheetInput>(emptyDraft);
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(
    () => files.length > 0 && draft.title.trim().length > 0 && !busy,
    [files, draft.title, busy]
  );

  const handleFilesPicked = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    setFiles((prev) => [...prev, ...picked]);
  };

  const handleRemoveFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    setBusy(true);
    try {
      await uploadWorksheet(files, draft);
      toast.show(`활동지를 저장했어요. (파일 ${files.length}개)`, 'success');
      setFiles([]);
      setDraft(emptyDraft);
      const el = document.getElementById('worksheet-file') as HTMLInputElement | null;
      if (el) el.value = '';
      onDone();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '업로드 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-4" hint="새 활동지 업로드">
      <div className="space-y-3">
        <div>
          <label className="text-[14px] text-subtle block mb-1">
            PDF 또는 PNG 파일 (여러 개 선택 가능)
          </label>
          <input
            id="worksheet-file"
            type="file"
            accept="application/pdf,.pdf,image/png,.png"
            multiple
            onChange={(e) => {
              handleFilesPicked(e.target.files);
              e.target.value = '';
            }}
            className="block w-full text-[14px]"
          />
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-[14px] bg-gray-100 rounded-lg px-2 py-1.5"
                >
                  <span className="uppercase text-[13px] font-bold text-gray-700 w-8 shrink-0">
                    {(f.name.split('.').pop() ?? '').toLowerCase()}
                  </span>
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-subtle shrink-0">
                    {(f.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    onClick={() => handleRemoveFile(i)}
                    className="p-1 text-gray-600"
                    aria-label="파일 제거"
                  >
                    <XIcon size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="text-[14px] text-subtle block mb-1">제목</label>
          <input
            className="field-input"
            placeholder="예: 봄에 피는 꽃 매칭"
            value={draft.title}
            maxLength={80}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </div>

        <div>
          <label className="text-[14px] text-subtle block mb-1">설명 (선택)</label>
          <textarea
            className="field-input min-h-[72px]"
            placeholder="활동 진행 방법이나 필요한 준비물"
            value={draft.description}
            maxLength={400}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>

        <div>
          <label className="text-[14px] text-subtle block mb-1">연령대</label>
          <Segmented
            value={draft.ageGroup}
            onChange={(v) => setDraft({ ...draft, ageGroup: v })}
            options={AGE_OPTIONS}
          />
        </div>

        <MultiChipRow
          label="계절"
          options={SEASONS as unknown as string[]}
          value={draft.seasons}
          onChange={(v) => setDraft({ ...draft, seasons: v })}
        />
        <MultiChipRow
          label="발달 영역"
          options={DEVELOPMENTAL_AREAS as unknown as string[]}
          value={draft.developmentalAreas}
          onChange={(v) => setDraft({ ...draft, developmentalAreas: v })}
        />
        <MultiChipRow
          label="활동 유형"
          options={ACTIVITY_TYPES as unknown as string[]}
          value={draft.activityTypes}
          onChange={(v) => setDraft({ ...draft, activityTypes: v })}
        />

        <div className="flex items-center justify-between gap-3 pt-1">
          <div>
            <p className="text-[14px] text-ink font-semibold">바로 공개</p>
            <p className="text-[13px] text-subtle mt-0.5">
              끄면 초안으로 저장되어 유저에게 보이지 않아요.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={draft.isPublished ?? false}
            onClick={() => setDraft({ ...draft, isPublished: !draft.isPublished })}
            className={
              'shrink-0 w-12 h-7 rounded-full transition relative ' +
              (draft.isPublished ? 'bg-brand-500' : 'bg-gray-300')
            }
          >
            <span
              className={
                'absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition ' +
                (draft.isPublished ? 'left-[22px]' : 'left-0.5')
              }
            />
          </button>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="btn-primary w-full disabled:opacity-50"
        >
          <PlusIcon size={16} /> {busy ? '업로드 중…' : `업로드 (${files.length}개)`}
        </button>
      </div>
    </Card>
  );
}

function MultiChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (o: string) => {
    if (value.includes(o)) onChange(value.filter((v) => v !== o));
    else onChange([...value, o]);
  };
  return (
    <div>
      <label className="text-[14px] text-subtle block mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Chip key={o} active={value.includes(o)} onClick={() => toggle(o)}>
            {o}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function ListCard({
  items,
  loading,
  onChanged,
}: {
  items: Worksheet[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((w) =>
      [
        w.title,
        w.description,
        ...w.seasons,
        ...w.developmentalAreas,
        ...w.activityTypes,
        ...w.tags,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [items, query]);

  return (
    <Card className="mb-4" hint={`활동지 목록 (${items.length})`}>
      <div className="relative mb-3">
        <input
          className="field-input pr-8"
          placeholder="제목·설명·태그로 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-600 p-1"
            aria-label="검색어 지우기"
          >
            <XIcon size={14} />
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-[14px] text-subtle">불러오는 중…</p>
      ) : filtered.length === 0 ? (
        <p className="text-[14px] text-subtle">
          {items.length === 0
            ? '아직 등록된 활동지가 없어요.'
            : '검색 결과가 없어요.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {filtered.map((w) => (
            <WorksheetRow key={w.id} w={w} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function WorksheetRow({ w, onChanged }: { w: Worksheet; onChanged: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [managingFiles, setManagingFiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<WorksheetInput>({
    title: w.title,
    description: w.description,
    ageGroup: w.ageGroup,
    seasons: w.seasons,
    developmentalAreas: w.developmentalAreas,
    activityTypes: w.activityTypes,
    tags: w.tags,
    isPublished: w.isPublished,
  });

  const handleTogglePublish = async () => {
    setBusy(true);
    try {
      await togglePublished(w.id, !w.isPublished);
      onChanged();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '변경 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `"${w.title}"를 삭제할까요? 파일 ${w.files.length}개와 메타데이터가 모두 지워져요.`
      )
    )
      return;
    setBusy(true);
    try {
      await deleteWorksheet(w.id);
      toast.show('삭제했어요.', 'success');
      onChanged();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '삭제 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await updateWorksheet(w.id, draft);
      toast.show('저장했어요.', 'success');
      setEditing(false);
      onChanged();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '저장 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <li className="py-3 space-y-3">
        <input
          className="field-input"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <textarea
          className="field-input min-h-[64px]"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
        <Segmented
          value={draft.ageGroup}
          onChange={(v) => setDraft({ ...draft, ageGroup: v })}
          options={AGE_OPTIONS}
        />
        <MultiChipRow
          label="계절"
          options={SEASONS as unknown as string[]}
          value={draft.seasons}
          onChange={(v) => setDraft({ ...draft, seasons: v })}
        />
        <MultiChipRow
          label="발달 영역"
          options={DEVELOPMENTAL_AREAS as unknown as string[]}
          value={draft.developmentalAreas}
          onChange={(v) => setDraft({ ...draft, developmentalAreas: v })}
        />
        <MultiChipRow
          label="활동 유형"
          options={ACTIVITY_TYPES as unknown as string[]}
          value={draft.activityTypes}
          onChange={(v) => setDraft({ ...draft, activityTypes: v })}
        />
        <div className="flex gap-2">
          <button
            className="btn-primary flex-1 disabled:opacity-50"
            disabled={busy}
            onClick={handleSave}
          >
            {busy ? '저장 중…' : '저장'}
          </button>
          <button className="btn-ghost flex-1" onClick={() => setEditing(false)}>
            취소
          </button>
        </div>
      </li>
    );
  }

  const tagLine = [
    w.ageGroup === '0-2' ? '0~2세' : w.ageGroup === '3-5' ? '3~5세' : '전 연령',
    ...w.seasons,
    ...w.developmentalAreas,
    ...w.activityTypes,
  ].join(' · ');

  return (
    <li className="py-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-bold text-ink truncate">{w.title}</p>
            {!w.isPublished && (
              <span className="text-[13px] px-1.5 py-0.5 rounded bg-gray-300 text-gray-700 font-semibold">
                초안
              </span>
            )}
          </div>
          {w.description && (
            <p className="text-[14px] text-subtle mt-0.5 line-clamp-2">{w.description}</p>
          )}
          <p className="text-[13px] text-subtle mt-1">{tagLine || '태그 없음'}</p>
        </div>
      </div>

      <button
        onClick={() => setManagingFiles((v) => !v)}
        className="text-[13px] mt-2 text-gray-700 font-semibold underline underline-offset-4"
      >
        파일 {w.files.length}개 {managingFiles ? '접기' : '관리'}
      </button>

      {managingFiles && (
        <FileManager worksheetId={w.id} files={w.files} onChanged={onChanged} />
      )}

      <div className="grid grid-cols-3 gap-1.5 mt-2">
        <button
          onClick={handleTogglePublish}
          disabled={busy}
          className="text-[13px] py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold"
        >
          {w.isPublished ? '비공개로' : '공개로'}
        </button>
        <button
          onClick={() => setEditing(true)}
          className="text-[13px] py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold flex items-center justify-center gap-1"
        >
          <PencilIcon size={12} /> 편집
        </button>
        <button
          onClick={handleDelete}
          disabled={busy}
          className="text-[13px] py-2 rounded-lg bg-red-500/10 text-red-600 font-semibold flex items-center justify-center gap-1"
        >
          <TrashIcon size={12} /> 삭제
        </button>
      </div>
    </li>
  );
}

function FileManager({
  worksheetId,
  files,
  onChanged,
}: {
  worksheetId: string;
  files: WorksheetFile[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const handleOpen = async (f: WorksheetFile) => {
    try {
      const url = await createWorksheetUrl(f.filePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '열기 실패', 'error');
    }
  };

  const handleRemove = async (f: WorksheetFile) => {
    if (!window.confirm(`파일 "${f.originalName || f.filePath}" 를 삭제할까요?`)) return;
    setBusy(true);
    try {
      await removeWorksheetFile(f.id);
      toast.show('파일을 삭제했어요.', 'success');
      onChanged();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '삭제 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAddFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    try {
      await addFilesToWorksheet(worksheetId, Array.from(list));
      toast.show(`파일 ${list.length}개를 추가했어요.`, 'success');
      onChanged();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '추가 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 bg-gray-100 rounded-xl p-3 space-y-2">
      {files.length === 0 && (
        <p className="text-[14px] text-subtle">파일이 없어요. 아래에서 추가하세요.</p>
      )}
      {files.map((f) => (
        <div
          key={f.id}
          className="flex items-center gap-2 text-[14px] bg-white rounded-lg px-2 py-1.5"
        >
          <span className="uppercase text-[13px] font-bold text-gray-700 w-8 shrink-0">
            {fileExtension(f.filePath)}
          </span>
          <span className="flex-1 truncate">{f.originalName || f.filePath}</span>
          <button
            onClick={() => handleOpen(f)}
            className="text-[13px] text-gray-700 font-semibold px-2 py-1"
          >
            열기
          </button>
          <button
            onClick={() => handleRemove(f)}
            disabled={busy}
            className="p-1 text-red-600"
            aria-label="파일 삭제"
          >
            <TrashIcon size={12} />
          </button>
        </div>
      ))}
      <div>
        <label className="text-[13px] text-subtle block mb-1">파일 추가</label>
        <input
          type="file"
          accept="application/pdf,.pdf,image/png,.png"
          multiple
          disabled={busy}
          onChange={(e) => {
            handleAddFiles(e.target.files);
            e.target.value = '';
          }}
          className="block w-full text-[14px]"
        />
      </div>
    </div>
  );
}
