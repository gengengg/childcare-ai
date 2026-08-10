import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { hasSeenOnboarding } from '@/lib/onboarding';

/**
 * 첫 방문 시 /onboarding 으로 리다이렉트한다.
 * localStorage 조회가 완료되기 전에는 흰 화면을 잠깐 노출한다.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      // 인증/복구 관련 화면은 온보딩보다 우선. 여기서 리다이렉트하면 순환 발생.
      const authPaths = [
        '/login',
        '/nickname',
        '/find-id',
        '/find-password',
        '/reset-password',
      ];
      if (authPaths.includes(loc.pathname)) {
        setChecked(true);
        return;
      }
      const seen = await hasSeenOnboarding();
      if (!seen && loc.pathname !== '/onboarding') {
        nav('/onboarding', { replace: true });
      }
      setChecked(true);
    })();
  }, [loc.pathname, nav]);

  if (!checked) {
    return <div className="min-h-full bg-cream-50" />;
  }
  return <>{children}</>;
}
