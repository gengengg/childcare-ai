import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { exitGuestMode, isGuestMode } from '@/lib/auth';
import { migrateGuestDataIfNeeded } from '@/lib/migrate';

export type AuthMode = 'authed' | 'guest' | 'anon';

type AuthCtx = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  mode: AuthMode;
  guest: boolean;
  refreshGuest: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [guest, setGuest] = useState(false);
  const migratedForUser = useRef<string | null>(null);

  const refreshGuest = async () => {
    setGuest(await isGuestMode());
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      await refreshGuest();
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 로그인 성공 직후 게스트 데이터 이관 (1회만)
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    if (migratedForUser.current === uid) return;
    migratedForUser.current = uid;
    (async () => {
      const result = await migrateGuestDataIfNeeded();
      if (result && result.moved > 0) {
        // 게스트 모드였다면 해제
        await exitGuestMode();
        await refreshGuest();
        console.log(`[migrate] ${result.moved}개 항목 이관됨`);
      }
    })();
  }, [session?.user?.id]);

  const user = session?.user ?? null;
  const mode: AuthMode = user ? 'authed' : guest ? 'guest' : 'anon';

  return (
    <Ctx.Provider value={{ loading, session, user, mode, guest, refreshGuest }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
