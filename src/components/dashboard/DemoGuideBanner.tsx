import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, Sparkles, X } from 'lucide-react';
import type { NavigationSectionId } from '../../design-system/tokens';

const STORAGE_KEY = 'recouvrix.demoGuide.dismissed';

const STEPS: Array<{
  id: string;
  label: string;
  hint: string;
  section: NavigationSectionId;
}> = [
  {
    id: 'import',
    label: '1. Importer',
    hint: 'CSV ou PDF d’entrée',
    section: 'imports',
  },
  {
    id: 'priorities',
    label: '2. Prioriser',
    hint: 'Actions du jour',
    section: 'dashboard',
  },
  {
    id: 'remind',
    label: '3. Relancer',
    hint: 'Brouillon IA + validation',
    section: 'reminders',
  },
  {
    id: 'pay',
    label: '4. Encaisser',
    hint: 'Preuve → quittance',
    section: 'payments',
  },
];

export interface DemoGuideBannerProps {
  onNavigate: (section: NavigationSectionId, filter?: string) => void;
}

export const DemoGuideBanner: React.FC<DemoGuideBannerProps> = ({ onNavigate }) => {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) {
    return null;
  }

  return (
    <section
      aria-label="Guide de démonstration BWAI"
      className="rounded-xl border border-[var(--color-border)] bg-white shadow-xs overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-[var(--color-border)] bg-[var(--color-canvas)]">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-[15px] font-semibold text-[var(--color-ink)] leading-snug">
              Parcours démo BWAI — 4 gestes
            </h2>
            <p className="text-[13px] text-[var(--color-ink-muted)] leading-relaxed">
              Suivez ces étapes dans l’ordre. Chaque clic ouvre le bon écran.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(STORAGE_KEY, '1');
            } catch {
              /* ignore */
            }
            setDismissed(true);
          }}
          className="p-1.5 rounded-md text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-white"
          aria-label="Masquer le guide de démonstration"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ol className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-border)]">
        {STEPS.map((step) => (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => onNavigate(step.section)}
              className="w-full h-full text-left px-4 py-3.5 hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-primary)]">
                  {step.label}
                </span>
                <ChevronRight className="w-4 h-4 text-[var(--color-ink-muted)] group-hover:text-[var(--color-primary)]" />
              </div>
              <p className="mt-1 text-[12px] text-[var(--color-ink-muted)] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)] shrink-0" aria-hidden="true" />
                {step.hint}
              </p>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
};
