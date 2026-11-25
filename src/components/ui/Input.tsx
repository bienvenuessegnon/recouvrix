import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  leftIcon,
  required,
  disabled,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[13px] font-medium text-[var(--color-ink)]"
        >
          {label}
          {required && (
            <span className="text-[var(--color-danger)] ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span
            className="absolute inset-y-0 left-3 flex items-center text-[var(--color-ink-muted)] pointer-events-none"
            aria-hidden="true"
          >
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`w-full min-h-[40px] rounded-md bg-white text-[14px] text-[var(--color-ink)] placeholder:text-slate-400 border transition-colors duration-150 ${
            leftIcon ? 'pl-9 pr-3' : 'px-3'
          } py-2 ${
            error
              ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]'
              : 'border-[var(--color-border-strong)] hover:border-slate-400 focus:border-[var(--color-primary)]'
          } disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p
          id={errorId}
          className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-danger)]"
          role="alert"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      {!error && helperText && (
        <p id={helperId} className="text-[12px] text-[var(--color-ink-muted)]">
          {helperText}
        </p>
      )}
    </div>
  );
};

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  helperText,
  error,
  required,
  disabled,
  className = '',
  id,
  rows = 3,
  ...props
}) => {
  const generatedId = useId();
  const textareaId = id || generatedId;
  const errorId = `${textareaId}-error`;
  const helperId = `${textareaId}-helper`;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-[13px] font-medium text-[var(--color-ink)]"
        >
          {label}
          {required && (
            <span className="text-[var(--color-danger)] ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        className={`w-full rounded-md bg-white px-3 py-2 text-[14px] text-[var(--color-ink)] placeholder:text-slate-400 border transition-colors duration-150 ${
          error
            ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]'
            : 'border-[var(--color-border-strong)] hover:border-slate-400 focus:border-[var(--color-primary)]'
        } disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${className}`}
        {...props}
      />
      {error && (
        <p
          id={errorId}
          className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-danger)]"
          role="alert"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      {!error && helperText && (
        <p id={helperId} className="text-[12px] text-[var(--color-ink-muted)]">
          {helperText}
        </p>
      )}
    </div>
  );
};
