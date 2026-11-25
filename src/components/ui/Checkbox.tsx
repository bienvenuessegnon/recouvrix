import React, { useId } from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
  error?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  description,
  error,
  disabled,
  checked,
  id,
  className = '',
  ...props
}) => {
  const generatedId = useId();
  const checkboxId = id || generatedId;

  return (
    <div className={`space-y-1 ${className}`}>
      <label
        htmlFor={checkboxId}
        className={`inline-flex items-start gap-2.5 select-none ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
      >
        <span className="relative flex items-center justify-center w-5 h-5 mt-0.5 shrink-0">
          <input
            id={checkboxId}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            className="peer sr-only"
            {...props}
          />
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary)] peer-focus-visible:ring-offset-2 ${
              checked
                ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                : error
                ? 'bg-white border-[var(--color-danger)]'
                : 'bg-white border-[var(--color-border-strong)] peer-hover:border-slate-500'
            }`}
          >
            {checked && <Check className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />}
          </span>
        </span>
        <span className="space-y-0.5">
          <span className="block text-[14px] font-medium text-[var(--color-ink)] leading-snug">
            {label}
          </span>
          {description && (
            <span className="block text-[12px] text-[var(--color-ink-muted)] leading-snug">
              {description}
            </span>
          )}
        </span>
      </label>
      {error && (
        <p className="text-[12px] font-medium text-[var(--color-danger)] pl-7" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
