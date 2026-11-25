import React, { useState } from 'react';
import {
  ArrowRight,
  Download,
  FileText,
  Plus,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import { RecouvrixLogo } from '../components/brand/RecouvrixLogo';
import {
  AlertBanner,
  Button,
  Checkbox,
  ConfirmModal,
  DataTable,
  DataTableColumn,
  EmptyState,
  Input,
  RecouvrixStatusKey,
  Select,
  SideDrawer,
  StatusBadge,
  SummaryCard,
  Tabs,
  Textarea,
  useToast,
} from '../components/ui';
import {
  BRAND_PALETTE,
  STATUS_PALETTE,
} from '../design-system/tokens';
import {
  formatCurrency,
  formatDate,
  formatDelayDays,
} from '../design-system/formatters';

interface SpecimenRow {
  id: string;
  reference: string;
  client: string;
  dueDate: string;
  delayDays: number;
  amount: number;
  status: RecouvrixStatusKey;
}

const SPECIMEN_ROWS: SpecimenRow[] = [
  {
    id: '1',
    reference: 'FAC-2026-0418',
    client: 'Ateliers Mercier SAS',
    dueDate: '2026-10-28',
    delayDays: 28,
    amount: 2450000,
    status: 'overdue',
  },
  {
    id: '2',
    reference: 'FAC-2026-0432',
    client: 'Logistique Valois SARL',
    dueDate: '2026-11-10',
    delayDays: 15,
    amount: 875000,
    status: 'pending_verification',
  },
  {
    id: '3',
    reference: 'FAC-2026-0441',
    client: 'Groupe Delacroix',
    dueDate: '2026-11-02',
    delayDays: 23,
    amount: 4200000,
    status: 'dispute',
  },
  {
    id: '4',
    reference: 'FAC-2026-0459',
    client: 'Cabinet Renaud & Associés',
    dueDate: '2026-11-20',
    delayDays: 0,
    amount: 450000,
    status: 'confirmed',
  },
];

export const DesignSystemShowcase: React.FC = () => {
  const { notify } = useToast();
  const [activeTab, setActiveTab] = useState('identite');
  const [segmentedFilter, setSegmentedFilter] = useState('tous');
  const [isButtonLoading, setIsButtonLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [showEmptyTable, setShowEmptyTable] = useState(false);

  // États interactifs du formulaire témoin
  const [clientInput, setClientInput] = useState('Ateliers Mercier SAS');
  const [channelSelect, setChannelSelect] = useState('email');
  const [noteInput, setNoteInput] = useState('');
  const [includeBankDetails, setIncludeBankDetails] = useState(true);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  // Modales et tiroirs
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDangerOpen, setConfirmDangerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSpecimen, setSelectedSpecimen] = useState<SpecimenRow | null>(null);

  const handleSimulatedLoading = () => {
    setIsButtonLoading(true);
    window.setTimeout(() => {
      setIsButtonLoading(false);
      notify({
        tone: 'success',
        title: 'Action de test exécutée',
        description: 'L’état de chargement et la notification fonctionnent correctement.',
      });
    }, 900);
  };

  const handleValidateForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientInput.trim()) {
      setFormError('Veuillez renseigner la raison sociale du client.');
      return;
    }
    setFormError(undefined);
    notify({
      tone: 'success',
      title: 'Formulaire valide',
      description: 'Les règles de validation et d’affichage d’erreur sont vérifiées.',
    });
  };

  const columns: Array<DataTableColumn<SpecimenRow>> = [
    {
      key: 'reference',
      header: 'Référence',
      render: (row) => (
        <span className="font-mono text-[13px] font-medium text-[var(--color-ink)]">
          {row.reference}
        </span>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (row) => <span className="font-medium">{row.client}</span>,
    },
    {
      key: 'dueDate',
      header: 'Échéance',
      render: (row) => (
        <span className="tabular-amount text-[var(--color-ink-secondary)]">
          {formatDate(row.dueDate)}
        </span>
      ),
    },
    {
      key: 'delay',
      header: 'Situation',
      render: (row) => (
        <span className="text-[13px] text-[var(--color-ink-muted)]">
          {formatDelayDays(row.delayDays)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Solde dû',
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-[var(--color-ink)]">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  const displayedRows = showEmptyTable
    ? []
    : SPECIMEN_ROWS.filter((row) => {
        if (segmentedFilter === 'tous') return true;
        if (segmentedFilter === 'retards') return row.status === 'overdue';
        if (segmentedFilter === 'attente') return row.status === 'pending_verification';
        if (segmentedFilter === 'litiges') return row.status === 'dispute';
        return true;
      });

  return (
    <div className="space-y-6">
      <Tabs
        activeId={activeTab}
        onChange={setActiveTab}
        items={[
          { id: 'identite', label: 'Identité & Couleurs' },
          { id: 'typographie', label: 'Typographie & Formats' },
          { id: 'composants', label: 'Composants & Formulaires' },
          { id: 'tableaux', label: 'Tableaux & Fenêtres' },
        ]}
      />

      {activeTab === 'identite' && (
        <div className="space-y-8">
          {/* Identité de marque et variantes du logo */}
          <section className="space-y-4">
            <div>
              <h2 className="text-[18px] font-semibold text-[var(--color-ink)]">
                Logo et règles d’utilisation
              </h2>
              <p className="text-[14px] text-[var(--color-ink-muted)]">
                Un monogramme géométrique sobre évoquant le grand livre de créances et la clôture du règlement, associé à une typographie sans-serif structurée.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-[var(--color-border)] rounded-lg p-6 flex flex-col justify-between gap-4">
                <span className="text-[12px] font-medium text-[var(--color-ink-muted)]">
                  Version claire (en-tête & documents)
                </span>
                <div className="py-3">
                  <RecouvrixLogo variant="light" size="lg" />
                </div>
                <p className="text-[12px] text-[var(--color-ink-secondary)]">
                  À privilégier sur fond blanc ou toile minérale claire.
                </p>
              </div>

              <div className="bg-[var(--color-sidebar)] border border-[var(--color-sidebar-border)] rounded-lg p-6 flex flex-col justify-between gap-4">
                <span className="text-[12px] font-medium text-slate-400">
                  Version sombre (barre latérale)
                </span>
                <div className="py-3">
                  <RecouvrixLogo variant="dark" size="lg" />
                </div>
                <p className="text-[12px] text-slate-300">
                  Contraste optimal sur fond Ardoise Institutionnelle.
                </p>
              </div>

              <div className="bg-white border border-[var(--color-border)] rounded-lg p-6 flex flex-col justify-between gap-4">
                <span className="text-[12px] font-medium text-[var(--color-ink-muted)]">
                  Symbole compact (icône seule)
                </span>
                <div className="py-3 flex items-center gap-4">
                  <RecouvrixLogo variant="light" size="lg" iconOnly />
                  <RecouvrixLogo variant="light" size="md" iconOnly />
                  <RecouvrixLogo variant="light" size="sm" iconOnly />
                </div>
                <p className="text-[12px] text-[var(--color-ink-secondary)]">
                  Reste lisible jusqu’en format 24 px pour favicon ou menu réduit.
                </p>
              </div>
            </div>
          </section>

          {/* Palette principale et structurelle */}
          <section className="space-y-4">
            <div>
              <h2 className="text-[18px] font-semibold text-[var(--color-ink)]">
                Palette principale (règle 60-30-10)
              </h2>
              <p className="text-[14px] text-[var(--color-ink-muted)]">
                Une palette restreinte à dominante neutre et froide pour mettre en relief les alertes financières sans fatigue visuelle.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {BRAND_PALETTE.map((token) => (
                <div
                  key={token.hex}
                  className="bg-white border border-[var(--color-border)] rounded-lg p-4 flex items-start gap-3.5"
                >
                  <div
                    className="w-11 h-11 rounded-md border border-slate-200 shrink-0"
                    style={{ backgroundColor: token.hex }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[14px] font-semibold text-[var(--color-ink)]">
                        {token.name}
                      </p>
                      <span className="font-mono text-[12px] text-[var(--color-ink-muted)] shrink-0">
                        {token.hex}
                      </span>
                    </div>
                    <p className="text-[12px] font-medium text-[var(--color-primary)]">
                      {token.role}
                    </p>
                    <p className="text-[12px] text-[var(--color-ink-secondary)] leading-snug">
                      {token.usage}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Couleurs sémantiques métier */}
          <section className="space-y-4">
            <div>
              <h2 className="text-[18px] font-semibold text-[var(--color-ink)]">
                Couleurs d’état financier et accessibilité
              </h2>
              <p className="text-[14px] text-[var(--color-ink-muted)]">
                Chaque couleur conserve une signification unique dans toute l’application et s’accompagne systématiquement d’une icône et d’un libellé explicite.
              </p>
            </div>

            <div className="bg-white border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
              {STATUS_PALETTE.map((item) => (
                <div
                  key={item.tone}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusBadge tone={item.tone} label={item.label} />
                    <span className="font-mono text-[12px] text-[var(--color-ink-muted)]">
                      {item.hex}
                    </span>
                  </div>
                  <p className="text-[13px] text-[var(--color-ink-secondary)]">
                    {item.meaning}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'typographie' && (
        <div className="space-y-8">
          <section className="bg-white border border-[var(--color-border)] rounded-lg p-6 space-y-6">
            <div className="space-y-1">
              <h2 className="text-[18px] font-semibold text-[var(--color-ink)]">
                Hiérarchie typographique
              </h2>
              <p className="text-[14px] text-[var(--color-ink-muted)]">
                Titres en Manrope, corps de texte et tableaux en Public Sans, chiffres et références en alignement tabulaire.
              </p>
            </div>

            <div className="divide-y divide-[var(--color-border)]">
              <div className="py-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <span className="text-[12px] font-medium text-[var(--color-ink-muted)] w-48 shrink-0">
                  Titre principal (26 px · Bold)
                </span>
                <p className="font-display text-[26px] font-bold text-[var(--color-ink)] leading-tight flex-1">
                  Suivi des créances et relances prioritaires
                </p>
              </div>
              <div className="py-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <span className="text-[12px] font-medium text-[var(--color-ink-muted)] w-48 shrink-0">
                  Titre de section (18 px · SemiBold)
                </span>
                <p className="font-display text-[18px] font-semibold text-[var(--color-ink)] flex-1">
                  Factures arrivées à échéance ce mois-ci
                </p>
              </div>
              <div className="py-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <span className="text-[12px] font-medium text-[var(--color-ink-muted)] w-48 shrink-0">
                  Corps de texte (15 px · Regular)
                </span>
                <p className="text-[15px] text-[var(--color-ink-secondary)] leading-relaxed flex-1">
                  Vérifiez la présence d’un justificatif bancaire avant de confirmer définitivement un paiement déclaré par le client.
                </p>
              </div>
              <div className="py-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <span className="text-[12px] font-medium text-[var(--color-ink-muted)] w-48 shrink-0">
                  Libellé & métadonnée (13 px)
                </span>
                <p className="text-[13px] text-[var(--color-ink-muted)] flex-1">
                  Dernière mise à jour · 25/11/2026 à 09:15 · Par Claire Moreau
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white border border-[var(--color-border)] rounded-lg p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="text-[18px] font-semibold text-[var(--color-ink)]">
                Formatage financier, dates et références
              </h2>
              <p className="text-[14px] text-[var(--color-ink-muted)]">
                Alignement vertical strict des montants grâce aux chiffres tabulaires et respect des conventions françaises.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-3">
                <p className="text-[13px] font-semibold text-[var(--color-ink)]">
                  Alignement des montants (tabular-nums)
                </p>
                <div className="divide-y divide-[var(--color-border)] text-[14px]">
                  <div className="py-2 flex justify-between">
                    <span className="text-[var(--color-ink-secondary)]">Montant initial</span>
                    <span className="tabular-amount font-medium">{formatCurrency(3850000)}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-[var(--color-ink-secondary)]">Acompte vérifié</span>
                    <span className="tabular-amount font-medium text-[var(--color-success)]">
                      - {formatCurrency(1400000)}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="font-semibold text-[var(--color-ink)]">Solde restant dû</span>
                    <span className="tabular-amount font-bold text-[var(--color-ink)]">
                      {formatCurrency(2450000)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-3">
                <p className="text-[13px] font-semibold text-[var(--color-ink)]">
                  Conventions d’affichage
                </p>
                <div className="divide-y divide-[var(--color-border)] text-[14px]">
                  <div className="py-2 flex justify-between gap-4">
                    <span className="text-[var(--color-ink-secondary)]">Dates calendaires</span>
                    <span className="tabular-amount font-medium">25/11/2026</span>
                  </div>
                  <div className="py-2 flex justify-between gap-4">
                    <span className="text-[var(--color-ink-secondary)]">Référence facture</span>
                    <span className="font-mono text-[13px] font-medium">FAC-2026-0418</span>
                  </div>
                  <div className="py-2 flex justify-between gap-4">
                    <span className="text-[var(--color-ink-secondary)]">Référence paiement</span>
                    <span className="font-mono text-[13px] font-medium">PAY-2026-0092</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'composants' && (
        <div className="space-y-8">
          {/* Boutons */}
          <section className="bg-white border border-[var(--color-border)] rounded-lg p-6 space-y-4">
            <h2 className="text-[17px] font-semibold text-[var(--color-ink)]">
              Boutons et états interactifs
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
                Action principale
              </Button>
              <Button variant="secondary" icon={<Download className="w-4 h-4" />}>
                Action secondaire
              </Button>
              <Button variant="ghost" icon={<ArrowRight className="w-4 h-4" />}>
                Action discrète
              </Button>
              <Button variant="destructive" icon={<Trash2 className="w-4 h-4" />}>
                Action destructive
              </Button>
              <Button
                variant="primary"
                loading={isButtonLoading}
                onClick={handleSimulatedLoading}
              >
                Tester le chargement
              </Button>
              <Button variant="secondary" disabled>
                Désactivé
              </Button>
            </div>
          </section>

          {/* Cartes de synthèse et badges */}
          <section className="space-y-4">
            <h2 className="text-[17px] font-semibold text-[var(--color-ink)]">
              Cartes de synthèse et badges de statut
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <SummaryCard
                label="Encours total suivi"
                value={formatCurrency(18450000)}
                helper="Exemple d’affichage chiffré"
              />
              <SummaryCard
                label="Créances en retard"
                value={formatCurrency(6200000)}
                tone="overdue"
                helper="8 factures concernées"
              />
              <SummaryCard
                label="En attente de vérification"
                value={formatCurrency(1950000)}
                tone="warning"
                helper="3 justificatifs déposés"
              />
              <SummaryCard
                label="Paiements confirmés"
                value={formatCurrency(9300000)}
                tone="success"
                helper="Sur la période sélectionnée"
              />
            </div>

            <div className="bg-white border border-[var(--color-border)] rounded-lg p-5 space-y-3">
              <p className="text-[13px] font-medium text-[var(--color-ink-muted)]">
                Gamme complète des statuts métier
              </p>
              <div className="flex flex-wrap gap-2.5">
                <StatusBadge status="upcoming" />
                <StatusBadge status="overdue" />
                <StatusBadge status="partial" />
                <StatusBadge status="promise" />
                <StatusBadge status="dispute" />
                <StatusBadge status="paid" />
                <StatusBadge status="declared" />
                <StatusBadge status="receipt_received" />
                <StatusBadge status="pending_verification" />
                <StatusBadge status="confirmed" />
                <StatusBadge status="recorded" />
                <StatusBadge status="rejected" />
                <StatusBadge status="reminder_planned" />
                <StatusBadge status="reminder_sent" />
              </div>
            </div>
          </section>

          {/* Formulaire témoin */}
          <section className="bg-white border border-[var(--color-border)] rounded-lg p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="text-[17px] font-semibold text-[var(--color-ink)]">
                Champs de formulaire et validation
              </h2>
              <p className="text-[13px] text-[var(--color-ink-muted)]">
                Formulaires courts avec libellés explicites, aides contextuelles et gestion claire des erreurs.
              </p>
            </div>

            <form onSubmit={handleValidateForm} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Nom du client"
                  required
                  value={clientInput}
                  onChange={(e) => {
                    setClientInput(e.target.value);
                    if (formError) setFormError(undefined);
                  }}
                  error={formError}
                  helperText="Videz le champ puis validez pour voir l’état d’erreur."
                />
                <Select
                  label="Canal de communication"
                  required
                  value={channelSelect}
                  onChange={(e) => setChannelSelect(e.target.value)}
                  options={[
                    { value: 'email', label: 'Email professionnel' },
                    { value: 'whatsapp', label: 'WhatsApp Business' },
                  ]}
                  helperText="Selon les préférences enregistrées du client."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Recherche rapide"
                  placeholder="Rechercher par référence ou client…"
                  leftIcon={<Search className="w-4 h-4" />}
                />
                <Input
                  label="Référence verrouillée"
                  value="FAC-2026-0418"
                  disabled
                  readOnly
                  helperText="Champ en lecture seule / désactivé."
                />
              </div>

              <Textarea
                label="Note interne de suivi"
                placeholder="Ex. : Le client demande un renvoi de la facture avant règlement."
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
              />

              <Checkbox
                label="Joindre les coordonnées bancaires autorisées de l’entreprise"
                description="Utilise exclusivement les coordonnées paramétrées par l’administrateur."
                checked={includeBankDetails}
                onChange={(e) => setIncludeBankDetails(e.target.checked)}
              />

              <div className="pt-2 flex flex-wrap gap-3">
                <Button type="submit" variant="primary">
                  Valider le formulaire
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setClientInput('');
                    setFormError('Veuillez renseigner la raison sociale du client.');
                  }}
                >
                  Simuler une erreur
                </Button>
              </div>
            </form>
          </section>

          {/* Bannières et notifications */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[17px] font-semibold text-[var(--color-ink)]">
                Messages de retour et notifications
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    notify({
                      tone: 'success',
                      title: 'Paiement confirmé',
                      description: 'Le solde de la facture FAC-2026-0459 a été mis à jour.',
                    })
                  }
                >
                  Notification succès
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    notify({
                      tone: 'error',
                      title: 'Échec de validation',
                      description: 'Un justificatif est requis avant toute confirmation.',
                    })
                  }
                >
                  Notification erreur
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AlertBanner
                tone="success"
                title="Règlement vérifié"
                description="Le justificatif a été contrôlé et imputé sur la créance correspondante."
              />
              <AlertBanner
                tone="warning"
                title="Vérification requise"
                description="Un paiement a été déclaré par le client mais aucun justificatif n’est encore rattaché."
              />
              <AlertBanner
                tone="error"
                title="Relance bloquée par un litige actif"
                description="Toute relance automatique ou manuelle est suspendue jusqu’à résolution du litige."
              />
              <AlertBanner
                tone="info"
                title="Mode d’envoi transparent"
                description="Les messages préparés indiqueront toujours s’ils ont été simulés ou transmis via un service connecté."
              />
            </div>
          </section>
        </div>
      )}

      {activeTab === 'tableaux' && (
        <div className="space-y-8">
          {/* Contrôles du tableau spécimen */}
          <section className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <Tabs
                variant="segmented"
                activeId={segmentedFilter}
                onChange={setSegmentedFilter}
                items={[
                  { id: 'tous', label: 'Tous', count: SPECIMEN_ROWS.length },
                  { id: 'retards', label: 'En retard', count: 1 },
                  { id: 'attente', label: 'À vérifier', count: 1 },
                  { id: 'litiges', label: 'Litiges', count: 1 },
                ]}
              />

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setTableLoading((v) => !v)}
                >
                  {tableLoading ? 'Afficher les données' : 'Tester le chargement'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowEmptyTable((v) => !v)}
                >
                  {showEmptyTable ? 'Réafficher les lignes' : 'Tester l’état vide'}
                </Button>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={displayedRows}
              rowKey={(row) => row.id}
              loading={tableLoading}
              caption="Exemple de tableau de créances Recouvrix"
              onRowClick={(row) => {
                setSelectedSpecimen(row);
                setDrawerOpen(true);
              }}
              emptyState={{
                icon: <FileText className="w-5 h-5" />,
                title: 'Aucune créance dans cette vue',
                description:
                  'Exemple d’état vide lisible avec explication claire et bouton d’action directe.',
                action: (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowEmptyTable(false)}
                  >
                    Réafficher les exemples
                  </Button>
                ),
              }}
            />
            <p className="text-[12px] text-[var(--color-ink-muted)]">
              Astuce : cliquez sur une ligne du tableau pour ouvrir la fenêtre latérale de détail, ou réduisez la largeur de l’écran pour vérifier l’adaptation mobile.
            </p>
          </section>

          {/* Fenêtres de confirmation et tiroir latéral */}
          <section className="bg-white border border-[var(--color-border)] rounded-lg p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-[17px] font-semibold text-[var(--color-ink)]">
                Fenêtres de confirmation et panneau latéral
              </h2>
              <p className="text-[13px] text-[var(--color-ink-muted)]">
                Indispensables pour sécuriser les actions financières sensibles (confirmation de paiement, annulation, rejet).
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                icon={<Send className="w-4 h-4" />}
                onClick={() => setConfirmOpen(true)}
              >
                Ouvrir une confirmation standard
              </Button>
              <Button
                variant="destructive"
                onClick={() => setConfirmDangerOpen(true)}
              >
                Ouvrir une confirmation sensible
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedSpecimen(SPECIMEN_ROWS[0]);
                  setDrawerOpen(true);
                }}
              >
                Ouvrir la fenêtre latérale
              </Button>
            </div>
          </section>

          <section>
            <EmptyState
              title="Gabarit d’état vide autonome"
              description="Utilisé lorsqu’un dossier client ne contient pas encore de document ou qu’aucune relance n’est programmée."
              action={
                <Button variant="secondary" size="sm" onClick={() => setActiveTab('identite')}>
                  Revenir à l’identité visuelle
                </Button>
              }
            />
          </section>
        </div>
      )}

      {/* Modale de confirmation standard */}
      <ConfirmModal
        open={confirmOpen}
        title="Confirmer la préparation de l’opération ?"
        description="Cette fenêtre demande une validation explicite au gestionnaire avant toute action irréversible."
        confirmLabel="Valider l’opération"
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          notify({
            tone: 'success',
            title: 'Confirmation validée',
            description: 'L’exemple de dialogue de confirmation a bien été testé.',
          });
        }}
      />

      {/* Modale de confirmation destructive */}
      <ConfirmModal
        open={confirmDangerOpen}
        tone="destructive"
        title="Rejeter ce justificatif de paiement ?"
        description="Un motif devra être consigné dans le journal d’activité et la facture restera ouverte au recouvrement."
        confirmLabel="Rejeter définitivement"
        onClose={() => setConfirmDangerOpen(false)}
        onConfirm={() => {
          setConfirmDangerOpen(false);
          notify({
            tone: 'warning',
            title: 'Rejet simulé confirmé',
            description: 'Modale destructive testée avec succès.',
          });
        }}
      />

      {/* Fenêtre latérale de détail */}
      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedSpecimen ? selectedSpecimen.reference : 'Détail du dossier'}
        subtitle={selectedSpecimen ? selectedSpecimen.client : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Fermer
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setDrawerOpen(false);
                notify({
                  tone: 'info',
                  title: 'Panneau latéral vérifié',
                  description: 'Ce modèle accueillera les fiches clients, factures et relances.',
                });
              }}
            >
              Valider
            </Button>
          </>
        }
      >
        {selectedSpecimen && (
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
              <span className="text-[13px] text-[var(--color-ink-muted)]">Statut actuel</span>
              <StatusBadge status={selectedSpecimen.status} />
            </div>
            <dl className="space-y-3 text-[14px]">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-ink-muted)]">Client</dt>
                <dd className="font-medium text-[var(--color-ink)] text-right">
                  {selectedSpecimen.client}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-ink-muted)]">Échéance</dt>
                <dd className="tabular-amount text-[var(--color-ink)]">
                  {formatDate(selectedSpecimen.dueDate)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-ink-muted)]">Retard</dt>
                <dd className="text-[var(--color-ink)]">
                  {formatDelayDays(selectedSpecimen.delayDays)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 pt-3 border-t border-[var(--color-border)]">
                <dt className="font-semibold text-[var(--color-ink)]">Solde restant dû</dt>
                <dd className="font-display text-[18px] font-bold tabular-amount text-[var(--color-ink)]">
                  {formatCurrency(selectedSpecimen.amount)}
                </dd>
              </div>
            </dl>
            <AlertBanner
              tone="info"
              title="Aperçu structurel"
              description="Cette fenêtre latérale sert de gabarit pour consulter une facture ou préparer une relance sans quitter la liste principale."
            />
          </div>
        )}
      </SideDrawer>
    </div>
  );
};
