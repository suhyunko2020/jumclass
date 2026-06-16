// ── 토스트 알림 시스템 ─────────────────────────────────────
import { useState, useCallback, useRef, createContext, useContext, type ReactNode } from 'react';

type ToastType = 'ok' | 'err' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  leaving: boolean;   // 퇴장 애니메이션 중 여부
}

interface ToastContextType {
  toasts: Toast[];
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const ICONS: Record<ToastType, string> = { ok: '✓', err: '✕', info: 'i' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type, leaving: false }]);
    // 일정 시간 후 퇴장 애니메이션 → 완료되면 제거
    setTimeout(() => {
      setToasts(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 280);
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}${t.leaving ? ' toast-leaving' : ''}`} role="status">
            <span className="toast-icon">{ICONS[t.type]}</span>
            <span className="toast-msg">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx.toast;
};
