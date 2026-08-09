import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type ToastKind = 'info' | 'success' | 'error';
type Toast = { id: number; text: string; kind: ToastKind };

type ToastCtx = {
  show: (text: string, kind?: ToastKind) => void;
};

const TOAST_MS = 1800;

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_MS);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              'pointer-events-auto max-w-[92%] rounded-2xl px-4 py-3 text-[14px] font-semibold shadow-pop ' +
              'animate-toast-life ' +
              (t.kind === 'error'
                ? 'bg-[#DC2626] text-white'
                : t.kind === 'success'
                ? 'bg-[#8B6844] text-white'
                : 'bg-[#2A2018] text-white')
            }
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('ToastProvider가 필요합니다.');
  return ctx;
}

export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
