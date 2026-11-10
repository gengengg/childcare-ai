import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { BrandMark } from '@/components/BrandMark';
import {
  CalendarIcon,
  ChevronRightIcon,
  EyeIcon,
  FolderIcon,
  GridIcon,
  HelpIcon,
  NoteIcon,
  PencilIcon,
  SettingsIcon,
  ShieldIcon,
  SmileIcon,
  SparkleIcon,
  UserIcon,
  UsersIcon,
} from '@/components/icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { isCurrentUserAdmin } from '@/lib/worksheets';

type Item = {
  to: string;
  label: string;
  desc?: string;
  Icon: (p: { size?: number }) => React.ReactElement;
  tone?: 'brand' | 'gray';
};

type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: '알림장',
    items: [
      { to: '/', label: '알림장 쓰기', desc: '공통 · 개인', Icon: PencilIcon, tone: 'brand' },
      { to: '/records', label: '보관함', desc: '아이별 폴더', Icon: FolderIcon, tone: 'brand' },
      { to: '/calendar', label: '달력', desc: '날짜별 알림장', Icon: CalendarIcon, tone: 'brand' },
    ],
  },
  {
    title: '학급 기록',
    items: [
      { to: '/class-activity', label: '오늘 활동 내용', desc: '반별로 한 번만', Icon: GridIcon },
      { to: '/observation', label: '관찰일지', desc: '아이별 관찰 기록', Icon: EyeIcon },
      { to: '/weekly', label: '주간일지', desc: '월간 계획 · 주간', Icon: NoteIcon },
      { to: '/worksheets', label: '활동지', desc: '찾기 · 내려받기', Icon: SmileIcon },
    ],
  },
  {
    title: '우리 반',
    items: [{ to: '/children', label: '아이 관리', desc: '이름 · 나이 · 반', Icon: UsersIcon }],
  },
  {
    title: '설정',
    items: [
      { to: '/settings?tab=general', label: '일반', desc: '계정 · 테마 · 반 이름', Icon: SettingsIcon, tone: 'gray' },
      { to: '/settings?tab=style', label: '문체', desc: '톤 · 길이 · 이모지', Icon: SparkleIcon, tone: 'gray' },
      { to: '/settings?tab=data', label: '데이터', desc: '백업 · 초기화', Icon: FolderIcon, tone: 'gray' },
    ],
  },
];

function Row({ item }: { item: Item }) {
  const tone = item.tone ?? 'gray';
  return (
    <Link to={item.to} className="list-row">
      <span
        className={clsx(
          'list-row-icon',
          tone === 'brand' && 'bg-brand-50 text-brand-600'
        )}
        aria-hidden
      >
        <item.Icon size={20} />
      </span>
      <span className="list-row-title">{item.label}</span>
      {item.desc && <span className="list-row-desc">{item.desc}</span>}
      <ChevronRightIcon size={18} className="text-gray-400 shrink-0" aria-hidden />
    </Link>
  );
}

/** 하단 '전체' 탭: 앱의 모든 기능을 그룹 리스트로 보여준다. */
export function MenuScreen() {
  const { mode, user } = useAuth();
  const [nickname, setNickname] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      setIsAdmin(await isCurrentUserAdmin());
      if (mode !== 'authed' || !user) return;
      const { data } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', user.id)
        .maybeSingle();
      setNickname(data?.nickname ?? '');
    })();
  }, [mode, user]);

  const name = mode === 'authed' ? `${nickname || '선생님'}` : '게스트';
  const sub =
    mode === 'authed' ? user?.email ?? '로그인됨' : '이 기기에만 저장 중';

  return (
    <>
      <div className="flex items-center justify-between pt-2 pb-4">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">전체</h1>
        <BrandMark size={36} label="온퇴근" />
      </div>

      <Link to="/settings?tab=general" className="list-group flex items-center gap-4 px-5 py-4 mb-3 active:bg-gray-100">
        <span className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0" aria-hidden>
          <UserIcon size={24} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[19px] font-bold text-ink truncate">{name}</span>
          <span className="block text-[15px] text-subtle truncate">{sub}</span>
        </span>
        <ChevronRightIcon size={18} className="text-gray-400 shrink-0" aria-hidden />
      </Link>

      {GROUPS.map((g) => (
        <section key={g.title} className="list-group mb-3" aria-label={g.title}>
          <h2 className="list-group-title">{g.title}</h2>
          {g.items.map((it) => (
            <Row key={it.to} item={it} />
          ))}
        </section>
      ))}

      <section className="list-group mb-3" aria-label="도움말">
        <h2 className="list-group-title">도움말</h2>
        <Row item={{ to: '/settings?tab=general#help', label: '튜토리얼 · 온보딩 다시 보기', Icon: HelpIcon }} />
        {isAdmin && (
          <Row item={{ to: '/admin/worksheets', label: '활동지 라이브러리 관리', desc: '관리자', Icon: ShieldIcon }} />
        )}
      </section>

      <p className="text-center text-[14px] text-subtle py-4">온퇴근 · 보육교사 AI 도우미</p>
    </>
  );
}
