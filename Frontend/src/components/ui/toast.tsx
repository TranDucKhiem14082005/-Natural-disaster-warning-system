import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: ReactNode;
}

interface ToastApi {
  success: (message: ReactNode) => void;
  error: (message: ReactNode) => void;
  info: (message: ReactNode) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const STYLE: Record<ToastTone, { icon: typeof Info; cls: string }> = {
  success: { icon: CircleCheck, cls: 'text-emerald-600' },
  error: { icon: CircleAlert, cls: 'text-red-600' },
  info: { icon: Info, cls: 'text-brand-600' },
};

let nextId = 1;

/** Short confirmations after an action ("Đã lưu"), so pages need no local success state. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (tone: ToastTone, message: ReactNode) => {
      const id = nextId++;
      setItems((all) => [...all.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3500);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m), info: (m) => push('info', m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[2500] flex flex-col items-center gap-2 px-3 sm:items-end sm:pr-5">
        {items.map((t) => {
          const s = STYLE[t.tone];
          const Icon = s.icon;
          return (
            <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-raised">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${s.cls}`} aria-hidden />
              <div className="flex-1 text-slate-800">{t.message}</div>
              <button type="button" onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-700" aria-label="Đóng thông báo">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
