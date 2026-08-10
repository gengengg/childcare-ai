import { Outlet } from 'react-router-dom';
import { BottomTabBar } from './BottomTabBar';

/**
 * 통합 레이아웃 — 모든 앱 화면(로그인 제외)에서 하단 탭 항상 표시.
 * 사용자가 어느 화면에 있어도 바로 다른 탭으로 이동 가능.
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

/** 인증/온보딩 등 하단 탭이 없는 특수 화면용 (로그인 전 상태) */
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
