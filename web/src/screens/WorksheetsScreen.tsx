import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Header } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import { useToast } from '@/components/Toast';
import { DownloadIcon, XIcon } from '@/components/icons';
import {
  ACTIVITY_TYPES,
  DEVELOPMENTAL_AREAS,
  SEASONS,
  createWorksheetUrl,
  fileExtension,
  listWorksheets,
  type AgeGroup,
  type Worksheet,
  type WorksheetFile,
} from '@/lib/worksheets';

type AgeFilter = 'all' | '0-2' | '3-5';

const AGE_FILTERS: { value: AgeFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: '0-2', label: '0~2세' },
  { value: '3-5', label: '3~5세' },
];

type Filters = {
  seasons: string[];
  areas: string[];
  types: string[];
};

const EMPTY_FILTERS: Filters = { seasons: [], areas: [], types: [] };

export function WorksheetsScreen() {
  const toast = useToast();
  const [items, setItems] = useState<Worksheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [age, setAge] = useState<AgeFilter>('all');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setItems(await listWorksheets());
      } catch (e) {
        toast.show(e instanceof Error ? e.message : '불러오기 실패', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const filtered = useMemo(
    () =>
      items.filter(
        (w) => matchesAge(w, age) && matchesFilters(w, filters) && matchesQuery(w, query)
      ),
    [items, query, age, filters]
  );

  const activeFilterCount =
    filters.seasons.length + filters.areas.length + filters.types.length;

  return (
    <>
      <Header
        title="활동지"
        subtitle="원하는 활동지를 검색해서 다운받으세요"
      />

      <Card className="mb-4">
        <div className="relative mb-3">
          <input
            className="field-input pr-8"
            placeholder="제목·설명·태그로 검색 (예: 봄, 동물, 색칠)"
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

        <Segmented value={age} onChange={setAge} options={AGE_FILTERS} />

        <div className="mt-3">
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="text-[14px] font-semibold text-gray-700 underline underline-offset-4"
          >
            {filtersOpen ? '상세 필터 접기' : '상세 필터 열기'}
            {activeFilterCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-500 text-on-brand text-[13px] font-bold no-underline">
                {activeFilterCount}
              </span>
            )}
          </button>
          {(filtersOpen || activeFilterCount > 0) && (
            <div className="mt-3 space-y-3">
              <ChipFilter
                label="계절"
                options={SEASONS as unknown as string[]}
                value={filters.seasons}
                onChange={(v) => setFilters({ ...filters, seasons: v })}
              />
              <ChipFilter
                label="발달 영역"
                options={DEVELOPMENTAL_AREAS as unknown as string[]}
                value={filters.areas}
                onChange={(v) => setFilters({ ...filters, areas: v })}
              />
              <ChipFilter
                label="활동 유형"
                options={ACTIVITY_TYPES as unknown as string[]}
                value={filters.types}
                onChange={(v) => setFilters({ ...filters, types: v })}
              />
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="text-[14px] text-subtle underline underline-offset-4"
                >
                  필터 모두 해제
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      <ResultList items={filtered} total={items.length} loading={loading} />
    </>
  );
}

function ChipFilter({
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
      <p className="text-[14px] text-subtle mb-1">{label}</p>
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

function ResultList({
  items,
  total,
  loading,
}: {
  items: Worksheet[];
  total: number;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <p className="text-[14px] text-subtle">불러오는 중…</p>
      </Card>
    );
  }
  if (total === 0) {
    return (
      <Card>
        <p className="text-[15px] text-ink font-semibold mb-1">
          아직 등록된 활동지가 없어요.
        </p>
        <p className="text-[14px] text-subtle">곧 다양한 활동지가 추가될 예정이에요.</p>
      </Card>
    );
  }
  if (items.length === 0) {
    return (
      <Card>
        <p className="text-[15px] text-ink font-semibold mb-1">
          조건에 맞는 활동지가 없어요.
        </p>
        <p className="text-[14px] text-subtle">검색어나 필터를 바꿔서 다시 시도해보세요.</p>
      </Card>
    );
  }
  return (
    <>
      <p className="text-[14px] text-subtle mb-2 px-1">{items.length}개</p>
      <div className="space-y-2">
        {items.map((w) => (
          <WorksheetCard key={w.id} w={w} />
        ))}
      </div>
    </>
  );
}

function WorksheetCard({ w }: { w: Worksheet }) {
  const [expanded, setExpanded] = useState(false);

  const tagLine = [
    ageLabel(w.ageGroup),
    ...w.seasons,
    ...w.developmentalAreas,
    ...w.activityTypes,
    ...w.tags,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-12 rounded-lg bg-brand-100 text-gray-700 flex items-center justify-center shrink-0 text-[13px] font-bold">
            {w.files.length > 1 ? `×${w.files.length}` : (fileExtension(w.files[0]?.filePath ?? '') || 'PDF').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-ink truncate">{w.title}</p>
            {w.description && (
              <p className="text-[14px] text-subtle mt-0.5 line-clamp-2">{w.description}</p>
            )}
            <p className="text-[13px] text-subtle mt-1 truncate">{tagLine}</p>
            <p className="text-[13px] text-gray-600 font-semibold mt-1">
              파일 {w.files.length}개 {expanded ? '접기 ▲' : '보기 ▼'}
            </p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {w.files.map((f, i) => (
            <FileItem key={f.id} f={f} index={i + 1} title={w.title} total={w.files.length} />
          ))}
        </div>
      )}
    </Card>
  );
}

function FileItem({
  f,
  index,
  title,
  total,
}: {
  f: WorksheetFile;
  index: number;
  title: string;
  total: number;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const ext = fileExtension(f.filePath) || 'pdf';

  const openInNewTab = async () => {
    setBusy(true);
    try {
      const url = await createWorksheetUrl(f.filePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '열기 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const url = await createWorksheetUrl(f.filePath);
      const a = document.createElement('a');
      a.href = url;
      const suffix = total > 1 ? `_${index}` : '';
      a.download = f.originalName || `${title}${suffix}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '다운로드 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2 py-2">
      <span className="uppercase text-[13px] font-bold text-gray-700 w-8 shrink-0">
        {ext}
      </span>
      <span className="flex-1 truncate text-[14px] text-ink">
        {f.originalName || `파일 ${index}`}
      </span>
      <button
        onClick={openInNewTab}
        disabled={busy}
        className="text-[13px] text-gray-700 font-semibold px-2 py-1"
      >
        미리보기
      </button>
      <button
        onClick={download}
        disabled={busy}
        className="text-[13px] font-bold text-on-brand bg-brand-500 rounded-lg px-2 py-1 flex items-center gap-1"
      >
        <DownloadIcon size={11} /> 다운
      </button>
    </div>
  );
}

function ageLabel(a: AgeGroup): string {
  return a === '0-2' ? '0~2세' : a === '3-5' ? '3~5세' : '전 연령';
}

function matchesAge(w: Worksheet, filter: AgeFilter): boolean {
  if (filter === 'all') return true;
  return w.ageGroup === filter || w.ageGroup === 'all';
}

function matchesFilters(w: Worksheet, f: Filters): boolean {
  if (f.seasons.length > 0 && !f.seasons.some((s) => w.seasons.includes(s))) return false;
  if (f.areas.length > 0 && !f.areas.some((a) => w.developmentalAreas.includes(a)))
    return false;
  if (f.types.length > 0 && !f.types.some((t) => w.activityTypes.includes(t))) return false;
  return true;
}

function matchesQuery(w: Worksheet, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    w.title,
    w.description,
    ...w.seasons,
    ...w.developmentalAreas,
    ...w.activityTypes,
    ...w.tags,
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}
