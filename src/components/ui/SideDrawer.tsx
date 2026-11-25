import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';

export interface SideDrawerProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  open,
  title,
  subtitle,
  onClose,
  footer,
  size = 'md',
  children,
}) => {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/45"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${
          size === 'xl' ? 'max-w-3xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg'
        } h-full bg-white border-l border-[var(--color-border)] flex flex-col shadow-xl`}
      >
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-0.5 min-w-0">
            <h2
              id={titleId}
              className="text-[17px] font-semibold text-[var(--color-ink)] leading-snug truncate"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-[13px] text-[var(--color-ink-muted)] truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le panneau latéral"
            className="p-2 -mr-2 rounded-md text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="px-6 py-4 bg-slate-50 border-t border-[var(--color-border)] flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
