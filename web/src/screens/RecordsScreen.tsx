import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Header } from '@/components/Header';
import { useToast } from '@/components/Toast';
import { CalendarIcon, CopyIcon, FolderIcon, TrashIcon } from '@/components/icons';
import { Mascot } from '@/components/Mascot';
import { SkeletonListItem } from '@/components/Skeleton';
import {
  deleteDailyRecord,
  deleteRecordsByChildId,
  getAllDailyRecords,
  type DailyRecord,
} from '@/lib/dailyRecords';
import { getChildren, type Child } from '@/lib/children';

function formatDate(d: string) {
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  const m = dt.getMonth() + 1;
  const day = dt.getDate();
  const week = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
  return `${m}월 ${day}일 (${week})`;
}

const COMMON_FILTER = '__common__';
const ARCHIVE_FILTER = '__archive__';
const isCommonRecord = (r: DailyRecord) => r.childId.startsWith('common-');

export function RecordsScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [archivedChildId, setArchivedChildId] = useState<string>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [list, kids] = await Promise.all([getAllDailyRecords(), getChildren()]);
      list.sort((a, b) => {
        if (a.date !== b.date) return a.date > b.date ? -1 : 1;
        return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
      });
      setRecords(list);
      setChildren(kids);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const hasCommon = useMemo(() => records.some(isCommonRecord), [records]);
  const registeredIds = useMemo(() => new Set(children.map((c) => c.id)), [children]);

  // 등록된 아이 폴더. 최신 이름을 사용.
  const childOptions = useMemo(() => {
    const nameById = new Map(children.map((c) => [c.id, c.name]));
    const map = new Map<string, { childId: string; name: string; count: number }>();
    for (const r of records) {
      if (isCommonRecord(r)) continue;
      if (!registeredIds.has(r.childId)) continue;
      const name = nameById.get(r.childId) ?? r.childName;
      if (!name) continue;
      const existing = map.get(r.childId);
      if (existing) {
        existing.count += 1;
        existing.name = name;
      } else {
        map.set(r.childId, { childId: r.childId, name, count: 1 });
      }
    }
    return Array.from(map.values());
  }, [records, children, registeredIds]);

  // 보관 폴더: 등록 아이 목록에 더 이상 없는 (=삭제된) 아이의 알림장.
  const archivedByChild = useMemo(() => {
    const map = new Map<string, { childId: string; name: string; count: number }>();
    for (const r of records) {
      if (isCommonRecord(r)) continue;
      if (registeredIds.has(r.childId)) continue;
      const existing = map.get(r.childId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(r.childId, {
          childId: r.childId,
          name: r.childName || '이름 없음',
          count: 1,
        });
      }
    }
    return Array.from(map.values());
  }, [records, registeredIds]);

  const hasArchive = archivedByChild.length > 0;
  const showArchiveFolders = filter === ARCHIVE_FILTER && !archivedChildId;

  const filtered = useMemo(() => {
    if (filter === '') return records;
    if (filter === COMMON_FILTER) return records.filter(isCommonRecord);
    if (filter === ARCHIVE_FILTER) {
      if (!archivedChildId) return [];
      return records.filter((r) => r.childId === archivedChildId);
    }
    return records.filter((r) => r.childId === filter);
  }, [filter, archivedChildId, records]);

  const selectFilter = (next: string) => {
    setFilter(next);
    setArchivedChildId('');
    setOpenId(null);
  };

  const groupedByDate = useMemo(() => {
    const map = new Map<string, DailyRecord[]>();
    for (const r of filtered) {
      const arr = map.get(r.date) ?? [];
      arr.push(r);
      map.set(r.date, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const displayName = (r: DailyRecord): string => {
    if (isCommonRecord(r)) return r.childName || '공통 알림장';
    const registered = children.find((c) => c.id === r.childId);
    // 등록 아이는 최신 이름, 삭제된 아이는 저장 당시 이름을 그대로 유지.
    return registered?.name || r.childName || '이름 없음';
  };

  const handleCopy = async (r: DailyRecord) => {
    try {
      await navigator.clipboard.writeText(r.teacherFinal || r.aiDraft || '');
      toast.show('복사됐어요.', 'success');
    } catch {
      toast.show('복사에 실패했어요.', 'error');
    }
  };

  const handleDelete = async (r: DailyRecord) => {
    const ok = window.confirm(`${displayName(r)}의 ${formatDate(r.date)} 알림장을 삭제할까요?`);
    if (!ok) return;
    await deleteDailyRecord(r.childId, r.date);
    await load();
    toast.show('삭제했어요.');
  };

  const handleClearArchiveFolder = async (
    e: React.MouseEvent,
    c: { childId: string; name: string; count: number }
  ) => {
    e.stopPropagation();
    const ok = window.confirm(
      `"${c.name}" 폴더의 알림장 ${c.count}개를 모두 삭제할까요?\n이 작업은 되돌릴 수 없어요.`
    );
    if (!ok) return;
    try {
      await deleteRecordsByChildId(c.childId);
      if (archivedChildId === c.childId) setArchivedChildId('');
      await load();
      toast.show(`${c.name} 폴더를 비웠어요.`, 'success');
    } catch {
      toast.show('삭제 중 오류가 났어요.', 'error');
    }
  };

  return (
    <>
      <Header
        icon={<FolderIcon />}
        title="보관함"
        subtitle="저장된 알림장을 다시 볼 수 있어요"
        action={
          <button
            onClick={() => navigate('/calendar')}
            aria-label="달력 보기"
            className="w-9 h-9 rounded-full flex items-center justify-center text-clay-700 active:bg-cream-100"
          >
            <CalendarIcon />
          </button>
        }
      />

      {(childOptions.length > 0 || hasCommon || hasArchive) && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Chip active={filter === ''} onClick={() => selectFilter('')}>
            전체
          </Chip>
          {hasCommon && (
            <Chip
              active={filter === COMMON_FILTER}
              onClick={() => selectFilter(COMMON_FILTER)}
            >
              공통 알림장
            </Chip>
          )}
          {childOptions.map((c) => (
            <Chip
              key={c.childId}
              active={filter === c.childId}
              onClick={() => selectFilter(c.childId)}
              className="inline-flex items-center gap-1"
              title={`${c.name} 폴더 (${c.count}개)`}
            >
              <FolderIcon size={14} />
              {c.name}
            </Chip>
          ))}
          {hasArchive && (
            <Chip
              active={filter === ARCHIVE_FILTER}
              onClick={() => selectFilter(ARCHIVE_FILTER)}
              title="삭제된 아이의 알림장 보관함"
            >
              보관
            </Chip>
          )}
        </div>
      )}

      {filter === ARCHIVE_FILTER && archivedChildId && (
        <button
          onClick={() => setArchivedChildId('')}
          className="text-[13px] font-semibold text-clay-700 mb-3 inline-flex items-center gap-1"
        >
          ← 보관 폴더 목록
        </button>
      )}

      {loading ? (
        <Card>
          <SkeletonListItem />
          <SkeletonListItem />
          <SkeletonListItem />
        </Card>
      ) : showArchiveFolders ? (
        archivedByChild.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center py-8">
              <Mascot variant="sleep" size={80} className="mb-3" />
              <p className="text-center text-subtle">보관된 알림장이 없어요.</p>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="text-[12px] text-subtle mb-3 px-1">
              아이 목록에서 삭제된 알림장이에요.
            </div>
            <div className="grid grid-cols-2 gap-2">
              {archivedByChild.map((c) => (
                <div key={c.childId} className="relative">
                  <button
                    onClick={() => {
                      setArchivedChildId(c.childId);
                      setOpenId(null);
                    }}
                    className="w-full flex flex-col items-center gap-2 py-5 rounded-2xl
                      bg-cream-50 border border-cream-200 text-clay-700
                      active:bg-cream-100 transition"
                  >
                    <FolderIcon size={26} />
                    <div className="text-[14px] font-bold text-ink">{c.name}</div>
                    <div className="text-[11px] text-subtle">알림장 {c.count}개</div>
                  </button>
                  <button
                    onClick={(e) => handleClearArchiveFolder(e, c)}
                    aria-label={`${c.name} 폴더 비우기`}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full
                      bg-surface/80 border border-cream-200 text-subtle
                      flex items-center justify-center
                      hover:text-red-500 hover:border-red-300 active:bg-red-50 transition"
                  >
                    <TrashIcon size={13} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )
      ) : groupedByDate.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-8">
            <Mascot variant="sleep" size={80} className="mb-3" />
            <p className="text-center text-subtle">아직 저장된 알림장이 없어요.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {groupedByDate.map(([date, list]) => (
            <div key={date}>
              <div className="text-[13px] font-bold text-clay-700 mb-2 px-1">
                {formatDate(date)}
              </div>
              <div className="space-y-2">
                {list.map((r) => {
                  const isOpen = openId === r.id;
                  return (
                    <Card key={r.id} className="p-4">
                      <button
                        onClick={() => setOpenId(isOpen ? null : r.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-cream-200 text-clay-700 flex items-center justify-center font-bold">
                            {displayName(r).slice(0, 1) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[15px] font-bold text-ink truncate">
                              {displayName(r)}
                            </div>
                            <div className="text-[12px] text-subtle truncate">
                              {r.className && `${r.className} · `}
                              {(r.teacherFinal || r.aiDraft).slice(0, 40)}
                            </div>
                          </div>
                          <span className="text-[12px] text-subtle shrink-0">
                            {isOpen ? '접기' : '보기'}
                          </span>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="mt-4 space-y-3">
                          {r.photos && r.photos.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {r.photos.map((p, i) => (
                                <img
                                  key={i}
                                  src={p}
                                  alt=""
                                  className="w-24 h-24 rounded-xl object-cover border border-cream-200 shrink-0"
                                />
                              ))}
                            </div>
                          )}
                          <div className="whitespace-pre-wrap text-[14px] leading-6 text-ink bg-cream-50 border border-cream-200 rounded-2xl p-4">
                            {r.teacherFinal || r.aiDraft || '내용 없음'}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button className="btn-outline" onClick={() => handleCopy(r)}>
                              <CopyIcon size={16} /> 복사
                            </button>
                            <button
                              className="btn-outline"
                              onClick={() => handleDelete(r)}
                            >
                              <TrashIcon size={16} /> 삭제
                            </button>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
