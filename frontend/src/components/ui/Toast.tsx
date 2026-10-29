import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: any) => void;
  error: (title: string, message?: any) => void;
  warning: (title: string, message?: any) => void;
  info: (title: string, message?: any) => void;
}

const sanitizeToastString = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    return val
      .map((item) =>
        item && typeof item === 'object' ? (item.msg || item.message || JSON.stringify(item)) : String(item)
      )
      .join(', ');
  }
  if (typeof val === 'object') {
    const obj = val as any;
    return obj.message || obj.msg || JSON.stringify(obj);
  }
  return String(val);
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type, title, message, duration = 5000 }: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const safeTitle = sanitizeToastString(title);
      const safeMessage = message !== undefined ? sanitizeToastString(message) : undefined;
      setToasts((prev) => [...prev, { id, type, title: safeTitle, message: safeMessage, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, message?: string) => addToast({ type: 'success', title, message }),
    [addToast]
  );
  const error = useCallback(
    (title: string, message?: string) => addToast({ type: 'error', title, message }),
    [addToast]
  );
  const warning = useCallback(
    (title: string, message?: string) => addToast({ type: 'warning', title, message }),
    [addToast]
  );
  const info = useCallback(
    (title: string, message?: string) => addToast({ type: 'info', title, message }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ addToast, removeToast, success, error, warning, info }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const config = {
            success: {
              icon: CheckCircle2,
              bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
              iconColor: 'text-emerald-600',
            },
            error: {
              icon: AlertCircle,
              bg: 'bg-red-50 border-red-200 text-red-900',
              iconColor: 'text-red-600',
            },
            warning: {
              icon: AlertTriangle,
              bg: 'bg-amber-50 border-amber-200 text-amber-900',
              iconColor: 'text-amber-600',
            },
            info: {
              icon: Info,
              bg: 'bg-blue-50 border-blue-200 text-blue-900',
              iconColor: 'text-blue-600',
            },
          }[toast.type];

          const IconComponent = config.icon;

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border shadow-lg ${config.bg} animate-in slide-in-from-bottom-2 duration-200`}
              role="alert"
            >
              <IconComponent className={`w-5 h-5 shrink-0 mt-0.5 ${config.iconColor}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.message && (
                  <p className="text-xs mt-0.5 opacity-90 leading-relaxed">{toast.message}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="opacity-60 hover:opacity-100 p-1 rounded-md"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
