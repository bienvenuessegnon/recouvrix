import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastInput {
  tone: ToastTone;
  title: string;
  description?: string;
  durationMs?: number;
}

interface ToastItem extends ToastInput {
  id: string;
}

interface ToastContextValue {
  notify: (toast: ToastInput) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_STYLES: Record<
  ToastTone,
  { border: string; iconColor: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  success: {
    border: 'border-[var(--color-success-border)]',
    iconColor: 'text-[var(--color-success)]',
    Icon: CheckCircle2,
  },
  error: {
    border: 'border-[var(--color-danger-border)]',
    iconColor: 'text-[var(--color-danger)]',
    Icon: AlertCircle,
  },
  warning: {
    border: 'border-[var(--color-warning-border)]',
    iconColor: 'text-[var(--color-warning)]',
    Icon: AlertTriangle,
  },
  info: {
    border: 'border-blue-200',
    iconColor: 'text-[var(--color-primary)]',
    Icon: Info,
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (input: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = input.durationMs ?? 4500;
      setToasts((prev) => [...prev.slice(-3), { ...input, id }]);
      if (duration > 0) {
        window.setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ notify, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
      >
        {toasts.map((toast) => {
          const { border, iconColor, Icon } = TOAST_STYLES[toast.tone];
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto bg-white border ${border} rounded-lg shadow-md p-3.5 flex items-start gap-3`}
            >
              <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} aria-hidden="true" />
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-[13px] font-semibold text-[var(--color-ink)] leading-snug">
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="text-[12px] text-[var(--color-ink-secondary)] leading-snug">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Fermer la notification"
                className="p-1 rounded text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-slate-100 transition-colors shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast doit être utilisé à l’intérieur de ToastProvider.');
  }
  return ctx;
}
