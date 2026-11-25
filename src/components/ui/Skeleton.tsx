import React from 'react';
import { Loader2 } from 'lucide-react';

export interface SkeletonBlockProps {
  className?: string;
}

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ className = 'h-4 w-full' }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded bg-slate-200/80 ${className}`}
  />
);

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'Chargement des données en cours…',
  className = '',
}) => (
  <div
    role="status"
    aria-live="polite"
    className={`flex items-center justify-center gap-2.5 py-8 text-[14px] text-[var(--color-ink-muted)] ${className}`}
  >
    <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" aria-hidden="true" />
    <span>{label}</span>
  </div>
);
