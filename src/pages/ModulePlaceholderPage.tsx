import React from 'react';
import { ArrowLeft, Layers } from 'lucide-react';
import { AlertBanner, Button, EmptyState } from '../components/ui';
import { NavigationItemConfig } from '../design-system/tokens';

const FILTER_LABELS: Record<string, string> = {
  ouvertes: 'Créances ouvertes',
  'en-retard': 'Créances en retard',
  'non-echues': 'Créances non échues',
  soldees: 'Factures soldées',
  'en-attente': 'Paiements en attente de vérification',
  pending: 'Paiements en attente de vérification',
  dispute: 'Factures en litige',
  promise: 'Promesses de paiement',
  priority: 'Dossiers prioritaires',
  'to-validate': 'Relances préparées en attente de validation',
  upcoming: 'Factures à échoir',
  overdue: 'Factures en retard',
  partial: 'Factures partiellement payées',
  paid: 'Factures soldées',
};

export interface ModulePlaceholderPageProps {
  moduleConfig: NavigationItemConfig;
  activeFilter?: string;
  onReturnHome: () => void;
}

export const ModulePlaceholderPage: React.FC<ModulePlaceholderPageProps> = ({
  moduleConfig,
  activeFilter,
  onReturnHome,
}) => {
  const filterLabel = activeFilter
    ? FILTER_LABELS[activeFilter] ?? activeFilter
    : null;

  return (
    <div className="space-y-4">
      {filterLabel && (
        <AlertBanner
          tone="info"
          title={`Vue filtrée sélectionnée : ${filterLabel}`}
          description="La liaison depuis le tableau de bord vers cette liste détaillée est active. Le détail complet de ce module sera déployé à l’étape correspondante."
        />
      )}

      <EmptyState
        icon={<Layers className="w-5 h-5" aria-hidden="true" />}
        title={`Module « ${moduleConfig.label} » prévu aux prochaines étapes`}
        description={`${moduleConfig.description} Votre accès à cette section est vérifié et protégé par votre session.`}
        action={
          <Button
            variant="primary"
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={onReturnHome}
          >
            Revenir au tableau de bord
          </Button>
        }
      />
    </div>
  );
};
