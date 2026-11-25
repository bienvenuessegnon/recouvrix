import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`bg-white border border-[var(--color-border)] rounded-lg px-6 py-10 text-center flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <div className="w-11 h-11 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-ink-muted)]">
        {icon ?? <Inbox className="w-5 h-5" aria-hidden="true" />}
      </div>
      <div className="max-w-md space-y-1">
        <h3 className="text-[16px] font-semibold text-[var(--color-ink)]">{title}</h3>
        <p className="text-[14px] text-[var(--color-ink-muted)] leading-relaxed">{description}</p>
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
};
