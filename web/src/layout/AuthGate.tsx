import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

/**
 * 인증 상태에 따라 라우팅을 강제한다.
 * - anon(미로그인/미게스트)  → /login
 * - authed 인데 nickname 없음 → /nickname
 * - 로그인/게스트 상태에서 /login 방문 → /
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, mode, user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    (async () => {
      const path = loc.pathname;
      const isLoginPage = path === '/login';
      const isNicknamePage = path === '/nickname';
      const isRecoveryPage =
        path === '/find-id' ||
        path === '/find-password' ||
        path === '/reset-password';
      const isPublicPage = isLoginPage || isRecoveryPage;

      if (mode === 'anon') {
        if (!isPublicPage) {
          nav('/login', { replace: true });
          return;
        }
        if (!cancelled) setReady(true);
        return;
      }

      if (isLoginPage) {
        nav('/', { replace: true });
        return;
      }

      // 복구 페이지는 로그인/게스트 상태 관계없이 열람 가능
      if (isRecoveryPage) {
        if (!cancelled) setReady(true);
        return;
      }

      if (mode === 'authed' && user) {
        const { data } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', user.id)
          .maybeSingle();
        const needsNickname = !data?.nickname;

        if (needsNickname && !isNicknamePage) {
          nav('/nickname', { replace: true });
          return;
        }
        if (!needsNickname && isNicknamePage) {
          nav('/', { replace: true });
          return;
        }
      }

      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, mode, user, loc.pathname, nav]);

  if (loading || !ready) {
    return <div className="min-h-full bg-cream-50" />;
  }
  return <>{children}</>;
}
