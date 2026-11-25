import React, { useEffect, useId } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'destructive';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: React.ReactNode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  tone = 'primary',
  loading = false,
  onConfirm,
  onClose,
  children,
}) => {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      role="presentation"
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {tone === 'destructive' && (
                <div className="w-9 h-9 rounded-md bg-[var(--color-danger-soft)] border border-[var(--color-danger-border)] flex items-center justify-center text-[var(--color-danger)] shrink-0">
                  <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                </div>
              )}
              <div className="space-y-1">
                <h2
                  id={titleId}
                  className="text-[17px] font-semibold text-[var(--color-ink)] leading-snug"
                >
                  {title}
                </h2>
                <p
                  id={descriptionId}
                  className="text-[14px] text-[var(--color-ink-secondary)] leading-relaxed"
                >
                  {description}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              aria-label="Fermer la fenêtre"
              className="p-1.5 rounded-md text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          {children && <div>{children}</div>}
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-[var(--color-border)] flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'destructive' ? 'destructive' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
