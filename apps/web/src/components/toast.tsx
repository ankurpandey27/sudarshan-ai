import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { cn } from '../lib/format';

interface Toast {
  id: number;
  kind: 'ok' | 'error';
  text: string;
}

const ToastContext = createContext<(kind: Toast['kind'], text: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'log-line pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13.5px] shadow-card',
              t.kind === 'ok' ? 'border-line bg-surface' : 'border-bad/30 bg-bad-soft text-ink',
            )}
          >
            {t.kind === 'ok' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-good" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-bad" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
