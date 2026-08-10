import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { isGuestMode } from '@/lib/auth';

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
