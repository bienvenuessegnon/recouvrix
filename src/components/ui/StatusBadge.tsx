import React from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  FileCheck2,
  Send,
  ShieldAlert,
  CircleDashed,
} from 'lucide-react';
import { SemanticTone } from '../../design-system/tokens';

export type RecouvrixStatusKey =
  | 'paid'
  | 'confirmed'
  | 'recorded'
  | 'partial'
  | 'declared'
  | 'receipt_received'
  | 'pending_verification'
  | 'promise'
  | 'overdue'
  | 'dispute'
  | 'rejected'
  | 'reminder_planned'
  | 'reminder_sent'
  | 'upcoming'
  | 'draft';

interface StatusDefinition {
  label: string;
  tone: SemanticTone;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const STATUS_MAP: Record<RecouvrixStatusKey, StatusDefinition> = {
  paid: { label: 'Soldée', tone: 'success', Icon: CheckCircle2 },
  confirmed: { label: 'Paiement confirmé', tone: 'success', Icon: CheckCircle2 },
  recorded: { label: 'Paiement enregistré', tone: 'success', Icon: FileCheck2 },
  partial: { label: 'Partiellement payée', tone: 'info', Icon: Clock },
  declared: { label: 'Paiement déclaré', tone: 'warning', Icon: Clock },
  receipt_received: { label: 'Justificatif reçu', tone: 'warning', Icon: FileCheck2 },
  pending_verification: { label: 'En attente de vérification', tone: 'warning', Icon: Clock },
  promise: { label: 'Promesse en cours', tone: 'warning', Icon: Clock },
  overdue: { label: 'En retard', tone: 'overdue', Icon: AlertTriangle },
  dispute: { label: 'En litige', tone: 'danger', Icon: ShieldAlert },
  rejected: { label: 'Rejeté', tone: 'danger', Icon: Ban },
  reminder_planned: { label: 'Relance planifiée', tone: 'info', Icon: Clock },
  reminder_sent: { label: 'Relance préparée', tone: 'info', Icon: Send },
  upcoming: { label: 'À échoir', tone: 'neutral', Icon: CircleDashed },
  draft: { label: 'Brouillon', tone: 'neutral', Icon: CircleDashed },
};

const TONE_CLASSES: Record<SemanticTone, string> = {
  success:
    'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success-border)]',
  warning:
    'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
  overdue:
    'bg-[var(--color-overdue-soft)] text-[var(--color-overdue)] border-[var(--color-overdue-border)]',
  danger:
    'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger-border)]',
  info:
    'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-blue-200',
  neutral:
    'bg-[var(--color-surface-subtle)] text-[var(--color-ink-secondary)] border-[var(--color-border)]',
};

export interface StatusBadgeProps {
  status?: RecouvrixStatusKey;
  tone?: SemanticTone;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  tone,
  label,
  className = '',
}) => {
  const definition = status ? STATUS_MAP[status] : undefined;
  const resolvedTone = tone ?? definition?.tone ?? 'neutral';
  const resolvedLabel = label ?? definition?.label ?? 'Statut';
  const Icon = definition?.Icon ?? CircleDashed;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[5px] border text-[12px] font-medium leading-tight whitespace-nowrap shrink-0 ${TONE_CLASSES[resolvedTone]} ${className}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden={true} />
      <span>{resolvedLabel}</span>
    </span>
  );
};
