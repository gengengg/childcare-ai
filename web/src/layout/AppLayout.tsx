import { Outlet } from 'react-router-dom';
import { BottomTabBar } from './BottomTabBar';

/**
 * 모든 메인 화면의 공통 레이아웃.
 * - 최대 너비 med (모바일 우선)
 * - 하단 탭바 영역만큼 padding
 */
export function AppLayout() {
  return (
    <div className="min-h-full bg-cream-50">
      <div className="mx-auto max-w-md px-5 pt-3 pb-28">
        <Outlet />
      </div>
      <BottomTabBar />
    </div>
  );
}

/** 하단 탭이 없는 서브 화면용 레이아웃 (예: 기록 작성) */
export function SubLayout() {
  return (
    <div className="min-h-full bg-cream-50">
      <div
        className="mx-auto max-w-md px-5 pt-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <Outlet />
      </div>
    </div>
  );
}
