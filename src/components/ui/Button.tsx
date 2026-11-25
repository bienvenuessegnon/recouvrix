import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-primary)] text-white border border-transparent hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] disabled:bg-slate-200 disabled:text-slate-400',
  secondary:
    'bg-white text-[var(--color-ink)] border border-[var(--color-border-strong)] hover:bg-slate-50 active:bg-slate-100 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200',
  ghost:
    'bg-transparent text-[var(--color-ink-secondary)] border border-transparent hover:bg-slate-100 hover:text-[var(--color-ink)] active:bg-slate-200/70 disabled:text-slate-400 disabled:hover:bg-transparent',
  destructive:
    'bg-[var(--color-danger)] text-white border border-transparent hover:bg-[var(--color-danger-hover)] active:bg-red-900 disabled:bg-red-100 disabled:text-red-300',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-3 py-1.5 text-[13px] gap-1.5',
  md: 'min-h-[40px] px-4 py-2 text-[14px] gap-2',
  lg: 'min-h-[44px] px-5 py-2.5 text-[15px] gap-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  className = '',
  children,
  type = 'button',
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center font-medium rounded-md whitespace-nowrap shrink-0 transition-colors duration-150 disabled:cursor-not-allowed ${
        VARIANT_CLASSES[variant]
      } ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
      ) : (
        icon && <span className="shrink-0 inline-flex items-center">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};
