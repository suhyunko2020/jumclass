// ── 토스트 알림 시스템 ─────────────────────────────────────
import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';

type ToastType = 'ok' | 'err' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toasts: Toast[];
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-5 py-3 rounded-xl text-sm font-medium shadow-2xl backdrop-blur-xl border animate-[fadeUp_0.3s_ease] ${
              t.type === 'ok' ? 'bg-ok/15 border-ok/20 text-ok' :
              t.type === 'err' ? 'bg-fail/15 border-fail/20 text-fail' :
              'bg-purple/15 border-purple/20 text-purple-2'
            }`}
          >
            {t.type === 'ok' ? '✓ ' : t.type === 'err' ? '✕ ' : 'ℹ '}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx.toast;
};
