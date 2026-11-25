import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'segmented';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeId,
  onChange,
  variant = 'underline',
  className = '',
}) => {
  if (variant === 'segmented') {
    return (
      <div
        role="tablist"
        className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] ${className}`}
      >
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={item.disabled}
              onClick={() => onChange(item.id)}
              className={`inline-flex items-center gap-2 min-h-[34px] px-3 py-1.5 rounded-[5px] text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-white text-[var(--color-ink)] border border-[var(--color-border)]'
                  : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              <span>{item.label}</span>
              {typeof item.count === 'number' && (
                <span className="tabular-amount text-[12px] text-[var(--color-ink-muted)]">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={`flex items-center gap-6 overflow-x-auto border-b border-[var(--color-border)] ${className}`}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={`relative inline-flex items-center gap-2 py-3 text-[14px] font-medium whitespace-nowrap shrink-0 border-b-2 -mb-px transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
              isActive
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:border-slate-300'
            }`}
          >
            <span>{item.label}</span>
            {typeof item.count === 'number' && (
              <span className="tabular-amount text-[12px] text-[var(--color-ink-muted)]">
                ({item.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
