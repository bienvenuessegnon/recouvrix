import React from 'react';
import { EmptyState, EmptyStateProps } from './EmptyState';
import { SkeletonBlock } from './Skeleton';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  widthClass?: string;
  hideOnMobile?: boolean;
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  skeletonRows?: number;
  emptyState?: EmptyStateProps;
  caption?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  loading = false,
  skeletonRows = 4,
  emptyState,
  caption,
  className = '',
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div
        className={`bg-white border border-[var(--color-border)] rounded-lg overflow-hidden ${className}`}
        aria-busy="true"
        aria-label="Chargement du tableau"
      >
        <div className="divide-y divide-[var(--color-border)]">
          {Array.from({ length: skeletonRows }).map((_, index) => (
            <div key={index} className="px-4 py-3.5 flex items-center justify-between gap-4">
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-4 w-44 hidden sm:block" />
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-6 w-28" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyState?.title ?? 'Aucun élément à afficher'}
        description={
          emptyState?.description ??
          'Les éléments correspondant à vos critères apparaîtront ici dès qu’ils seront disponibles.'
        }
        icon={emptyState?.icon}
        action={emptyState?.action}
        className={className}
      />
    );
  }

  return (
    <div
      className={`bg-white border border-[var(--color-border)] rounded-lg overflow-hidden ${className}`}
    >
      {/* Vue tableau structurée sur tablette et ordinateur */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-left">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-slate-50/70">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-3 text-[12px] font-semibold text-[var(--color-ink-muted)] whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  } ${col.widthClass ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {data.map((row) => {
              const interactive = Boolean(onRowClick);
              return (
                <tr
                  key={rowKey(row)}
                  onClick={interactive ? () => onRowClick?.(row) : undefined}
                  className={`transition-colors duration-150 ${
                    interactive
                      ? 'cursor-pointer hover:bg-slate-50/90 focus-within:bg-slate-50'
                      : 'hover:bg-slate-50/50'
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-[14px] text-[var(--color-ink)] align-middle ${
                        col.align === 'right' ? 'text-right tabular-amount' : 'text-left'
                      }`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Vue empilée lisible sur mobile sans défilement horizontal forcé */}
      <div className="md:hidden divide-y divide-[var(--color-border)]">
        {data.map((row) => {
          const interactive = Boolean(onRowClick);
          const visibleColumns = columns.filter((col) => !col.hideOnMobile);
          return (
            <div
              key={rowKey(row)}
              onClick={interactive ? () => onRowClick?.(row) : undefined}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick?.(row);
                      }
                    }
                  : undefined
              }
              className={`p-4 space-y-2.5 ${
                interactive ? 'cursor-pointer active:bg-slate-50' : ''
              }`}
            >
              {visibleColumns.map((col) => (
                <div
                  key={col.key}
                  className="flex items-baseline justify-between gap-4 text-[13px]"
                >
                  <span className="text-[var(--color-ink-muted)] font-medium shrink-0">
                    {col.header}
                  </span>
                  <span
                    className={`text-[var(--color-ink)] text-right ${
                      col.align === 'right' ? 'tabular-amount font-medium' : ''
                    }`}
                  >
                    {col.render(row)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
