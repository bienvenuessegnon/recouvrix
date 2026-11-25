import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, Search, Users } from 'lucide-react';
import { clientsApi, invoicesApi } from '../../services/api';
import type { NavigationSectionId } from '../../design-system/tokens';

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (section: NavigationSectionId, filter?: string) => void;
}

type Hit =
  | { kind: 'invoice'; id: string; label: string; hint: string; filter: string }
  | { kind: 'client'; id: string; label: string; hint: string; filter: string };

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setHits([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const [invoices, clients] = await Promise.all([
            invoicesApi.list({ search: trimmed, pageSize: 8 }),
            clientsApi.list({ search: trimmed, pageSize: 6 }),
          ]);
          if (cancelled) return;
          const next: Hit[] = [
            ...invoices.items.map((row) => ({
              kind: 'invoice' as const,
              id: row.id,
              label: row.reference,
              hint: `${row.clientName} · ${row.description || 'Facture'}`,
              filter: `facture:${row.id}`,
            })),
            ...clients.items.map((row) => ({
              kind: 'client' as const,
              id: row.id,
              label: row.name,
              hint: row.email || row.phone || 'Fiche client',
              filter: `client:${row.id}`,
            })),
          ];
          setHits(next);
        } catch {
          if (!cancelled) {
            setError('Recherche indisponible pour le moment.');
            setHits([]);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const emptyHint = useMemo(() => {
    if (query.trim().length < 2) {
      return 'Tapez une référence (ex. FAC-2026-0418), un client ou une transaction.';
    }
    if (loading) return 'Recherche en cours…';
    if (error) return error;
    return `Aucun résultat pour « ${query.trim()} ».`;
  }, [query, loading, error]);

  if (!open) return null;

  const go = (hit: Hit) => {
    onClose();
    if (hit.kind === 'invoice') onNavigate('invoices', hit.filter);
    else onNavigate('clients', hit.filter);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/45 p-4 pt-[12vh]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recherche universelle"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <Search className="w-4 h-4 text-[var(--color-ink-muted)] shrink-0" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="FAC-2026-0418, client, référence REC…"
            className="w-full bg-transparent text-[15px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)]"
            aria-label="Recherche universelle"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && hits[0]) go(hits[0]);
            }}
          />
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" aria-hidden="true" />
          ) : (
            <kbd className="hidden sm:inline rounded border border-[var(--color-border)] bg-[var(--color-canvas)] px-1.5 py-0.5 text-[10px] text-[var(--color-ink-muted)]">
              ESC
            </kbd>
          )}
        </div>

        <ul className="max-h-[50vh] overflow-auto p-2">
          {hits.length === 0 ? (
            <li className="px-3 py-8 text-center text-[13px] text-[var(--color-ink-muted)]">
              {emptyHint}
            </li>
          ) : (
            hits.map((hit) => (
              <li key={`${hit.kind}-${hit.id}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[var(--color-primary-soft)] transition-colors"
                  onClick={() => go(hit)}
                >
                  {hit.kind === 'invoice' ? (
                    <FileText className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                  ) : (
                    <Users className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[14px] text-[var(--color-ink)]">
                      {hit.label}
                    </span>
                    <span className="block truncate text-[12px] text-[var(--color-ink-muted)]">
                      {hit.hint}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>

        <p className="border-t border-[var(--color-border)] bg-[var(--color-canvas)] px-4 py-2 text-[11px] text-[var(--color-ink-muted)]">
          Raccourci : <kbd className="rounded border border-[var(--color-border)] bg-white px-1">⌘</kbd> /{' '}
          <kbd className="rounded border border-[var(--color-border)] bg-white px-1">Ctrl</kbd> +{' '}
          <kbd className="rounded border border-[var(--color-border)] bg-white px-1">K</kbd>
        </p>
      </div>
    </div>
  );
};
