import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type AlertTone = 'info' | 'success' | 'warning' | 'error';

export interface AlertBannerProps {
  tone: AlertTone;
  title: string;
  description?: string;
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const ALERT_STYLES: Record<
  AlertTone,
  { container: string; iconColor: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  info: {
    container: 'bg-[var(--color-primary-soft)] border-blue-200 text-[var(--color-ink)]',
    iconColor: 'text-[var(--color-primary)]',
    Icon: Info,
  },
  success: {
    container:
      'bg-[var(--color-success-soft)] border-[var(--color-success-border)] text-[var(--color-ink)]',
    iconColor: 'text-[var(--color-success)]',
    Icon: CheckCircle2,
  },
  warning: {
    container:
      'bg-[var(--color-warning-soft)] border-[var(--color-warning-border)] text-[var(--color-ink)]',
    iconColor: 'text-[var(--color-warning)]',
    Icon: AlertTriangle,
  },
  error: {
    container:
      'bg-[var(--color-danger-soft)] border-[var(--color-danger-border)] text-[var(--color-ink)]',
    iconColor: 'text-[var(--color-danger)]',
    Icon: AlertCircle,
  },
};

export const AlertBanner: React.FC<AlertBannerProps> = ({
  tone,
  title,
  description,
  action,
  onDismiss,
  className = '',
}) => {
  const { container, iconColor, Icon } = ALERT_STYLES[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border p-4 flex items-start gap-3 ${container} ${className}`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} aria-hidden="true" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-[14px] font-semibold text-[var(--color-ink)] leading-snug">{title}</p>
        {description && (
          <p className="text-[13px] text-[var(--color-ink-secondary)] leading-relaxed">
            {description}
          </p>
        )}
        {action && <div className="pt-1">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer le message"
          className="p-1.5 -m-1 rounded-md text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-black/5 transition-colors shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
