import React from 'react';

export interface RecouvrixLogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
  className?: string;
}

const SIZE_CONFIG = {
  sm: { box: 26, text: 'text-[17px]' },
  md: { box: 32, text: 'text-[20px]' },
  lg: { box: 40, text: 'text-[25px]' },
};

export const RecouvrixLogo: React.FC<RecouvrixLogoProps> = ({
  variant = 'light',
  size = 'md',
  iconOnly = false,
  className = '',
}) => {
  const { box, text } = SIZE_CONFIG[size];
  const isDark = variant === 'dark';

  return (
    <span
      className={`inline-flex items-center gap-2.5 select-none whitespace-nowrap shrink-0 ${className}`}
    >
      <svg
        width={box}
        height={box}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          x="1.5"
          y="1.5"
          width="29"
          height="29"
          rx="7"
          fill={isDark ? '#1D4ED8' : '#0F1D2E'}
        />
        {/* Colonnes de grand livre et trait de règlement équilibré */}
        <path
          d="M9.5 21.5V10.5H16.25C18.8734 10.5 20.75 12.1 20.75 14.35C20.75 16.35 19.2 17.85 16.95 18.12L21.5 22.5"
          stroke="#FFFFFF"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 18.1H15.5"
          stroke={isDark ? '#93C5FD' : '#60A5FA'}
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <path
          d="M19.2 9.5H22.5V12.8"
          stroke={isDark ? '#93C5FD' : '#60A5FA'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {!iconOnly && (
        <span
          className={`font-display font-bold tracking-[-0.025em] leading-none ${text} ${
            isDark ? 'text-white' : 'text-[var(--color-ink)]'
          }`}
        >
          Recouvrix
        </span>
      )}
    </span>
  );
};
