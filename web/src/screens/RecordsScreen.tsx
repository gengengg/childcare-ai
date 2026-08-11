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
  getAllDailyRecords,
  type DailyRecord,
} from '@/lib/dailyRecords';

function formatDate(d: string) {
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  const m = dt.getMonth() + 1;
  const day = dt.getDate();
  const week = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
  return `${m}월 ${day}일 (${week})`;
}

const COMMON_FILTER = '__common__';
const isCommonRecord = (r: DailyRecord) => r.childId.startsWith('common-');

export function RecordsScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getAllDailyRecords();
      list.sort((a, b) => {
        if (a.date !== b.date) return a.date > b.date ? -1 : 1;
        return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
      });
      setRecords(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const hasCommon = useMemo(() => records.some(isCommonRecord), [records]);

  const childOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: { childId: string; name: string; count: number }[] = [];
    for (const r of records) {
      if (isCommonRecord(r)) continue;
      if (!r.childName) continue;
      if (seen.has(r.childId)) {
        const item = list.find((x) => x.childId === r.childId);
        if (item) item.count += 1;
        continue;
      }
      seen.add(r.childId);
      list.push({ childId: r.childId, name: r.childName, count: 1 });
    }
    return list;
  }, [records]);

  const filtered = useMemo(() => {
    if (filter === '') return records;
    if (filter === COMMON_FILTER) return records.filter(isCommonRecord);
    return records.filter((r) => r.childId === filter);
  }, [filter, records]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, DailyRecord[]>();
    for (const r of filtered) {
      const arr = map.get(r.date) ?? [];
      arr.push(r);
      map.set(r.date, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleCopy = async (r: DailyRecord) => {
    try {
      await navigator.clipboard.writeText(r.teacherFinal || r.aiDraft || '');
      toast.show('복사됐어요.', 'success');
    } catch {
      toast.show('복사에 실패했어요.', 'error');
    }
  };

  const handleDelete = async (r: DailyRecord) => {
    const ok = window.confirm(`${r.childName}의 ${formatDate(r.date)} 알림장을 삭제할까요?`);
    if (!ok) return;
    await deleteDailyRecord(r.childId, r.date);
    await load();
    toast.show('삭제했어요.');
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

      {(childOptions.length > 0 || hasCommon) && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Chip active={filter === ''} onClick={() => setFilter('')}>
            전체
          </Chip>
          {hasCommon && (
            <Chip
              active={filter === COMMON_FILTER}
              onClick={() => setFilter(COMMON_FILTER)}
            >
              공통 알림장
            </Chip>
          )}
          {childOptions.map((c) => (
            <Chip
              key={c.childId}
              active={filter === c.childId}
              onClick={() => setFilter(c.childId)}
              className="inline-flex items-center gap-1"
              title={`${c.name} 폴더 (${c.count}개)`}
            >
              <FolderIcon size={14} />
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      {loading ? (
        <Card>
          <SkeletonListItem />
          <SkeletonListItem />
          <SkeletonListItem />
        </Card>
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
                            {r.childName.slice(0, 1) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[15px] font-bold text-ink truncate">
                              {r.childName || '이름 없음'}
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
