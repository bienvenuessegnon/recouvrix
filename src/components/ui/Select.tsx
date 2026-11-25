import React, { useId } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  helperText,
  error,
  options,
  placeholder,
  required,
  disabled,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={selectId}
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
        <select
          id={selectId}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`w-full min-h-[40px] appearance-none rounded-md bg-white pl-3 pr-9 py-2 text-[14px] text-[var(--color-ink)] border transition-colors duration-150 ${
            error
              ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]'
              : 'border-[var(--color-border-strong)] hover:border-slate-400 focus:border-[var(--color-primary)]'
          } disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="w-4 h-4 text-[var(--color-ink-muted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
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
