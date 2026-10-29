import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Info, CheckCircle, X } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  confirmVariant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'saffron' | 'black';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  confirmVariant,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const iconConfig = {
    danger: { icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
    warning: { icon: AlertTriangle, color: 'text-amber-600 bg-amber-100' },
    info: { icon: Info, color: 'text-blue-600 bg-blue-100' },
    success: { icon: CheckCircle, color: 'text-emerald-600 bg-emerald-100' },
  }[variant];

  const IconComponent = iconConfig.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden transform transition-all"
      >
        <div className="p-5 flex gap-4">
          <div className={`p-3 rounded-full shrink-0 ${iconConfig.color}`}>
            <IconComponent className="w-6 h-6" aria-hidden="true" />
          </div>

          <div className="flex-1">
            <h3 id="dialog-title" className="text-lg font-semibold text-slate-900">
              {title}
            </h3>
            <div className="mt-2 text-sm text-slate-600 leading-relaxed">{message}</div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 self-start p-1 rounded-md"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-50 px-5 py-3.5 flex justify-end gap-3 border-t border-slate-200">
          <Button
            variant="black"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>

          <Button
            variant={
              confirmVariant ||
              (variant === 'danger'
                ? 'destructive'
                : variant === 'warning'
                ? 'saffron'
                : 'black')
            }
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
