import React from 'react';

export interface SummaryCardProps {
  label: string;
  value: string;
  helper?: string;
  tone?: 'default' | 'success' | 'warning' | 'overdue' | 'danger';
  action?: React.ReactNode;
  className?: string;
}

const VALUE_TONE_CLASSES = {
  default: 'text-[var(--color-ink)]',
  success: 'text-[var(--color-success)]',
  warning: 'text-[var(--color-warning)]',
  overdue: 'text-[var(--color-overdue)]',
  danger: 'text-[var(--color-danger)]',
};

export const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  helper,
  tone = 'default',
  action,
  className = '',
}) => {
  return (
    <div
      className={`bg-white border border-[var(--color-border)] rounded-lg p-5 flex flex-col justify-between gap-3 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-medium text-[var(--color-ink-muted)] leading-snug">
          {label}
        </span>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="space-y-1">
        <p
          className={`font-display text-[24px] font-bold tracking-tight leading-tight tabular-amount ${VALUE_TONE_CLASSES[tone]}`}
        >
          {value}
        </p>
        {helper && (
          <p className="text-[12px] text-[var(--color-ink-muted)] leading-snug">
            {helper}
          </p>
        )}
      </div>
    </div>
  );
};
