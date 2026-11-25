import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  AlertBanner,
  Button,
  DataTable,
  DataTableColumn,
  EmptyState,
  Input,
  Select,
  SideDrawer,
  StatusBadge,
  SummaryCard,
  Tabs,
  useToast,
} from '../components/ui';
import {
  formatCurrency,
  formatDate,
  formatDelayDays,
  formatNumber,
} from '../design-system/formatters';
import { invoicesApi, remindersApi } from '../services/api';
import { PaymentInstructionsNoticeModal } from '../components/reminders/PaymentInstructionsNoticeModal';
import type { InvoiceListItem } from '../types/invoices';
import type {
  PaymentInstructionsData,
  ReminderChannel,
  ReminderItem,
  ReminderStatus,
} from '../types/reminders';

export interface RemindersPageProps {
  initialFilter?: string;
  onNavigateToInvoice?: (invoiceId: string) => void;
  onNavigateToClient?: (clientId: string) => void;
}

const CHANNEL_CONFIG: Record<
  ReminderChannel,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  EMAIL: { label: 'Email professionnel', Icon: Mail },
  WHATSAPP: { label: 'WhatsApp Business', Icon: MessageSquare },
  PHONE: { label: 'Appel téléphonique', Icon: Phone },
};

function getStatusBadgeProps(status: ReminderStatus): {
  tone: 'warning' | 'info' | 'success' | 'neutral';
  label: string;
} {
  switch (status) {
    case 'PREPARED':
      return { tone: 'warning', label: 'À valider' };
    case 'VALIDATED':
      return { tone: 'info', label: 'Validée' };
    case 'SENT':
      return { tone: 'success', label: 'Envoyée' };
    case 'PLANNED':
      return { tone: 'neutral', label: 'Planifiée' };
    case 'CANCELLED':
      return { tone: 'neutral', label: 'Annulée' };
    default:
      return { tone: 'neutral', label: status };
  }
}

export const RemindersPage: React.FC<RemindersPageProps> = ({
  initialFilter,
  onNavigateToInvoice,
  onNavigateToClient,
}) => {
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState<string>(
    initialFilter === 'to-validate' ? 'to-validate' : 'ALL'
  );
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [summary, setSummary] = useState({
    totalCount: 0,
    toValidateCount: 0,
    validatedCount: 0,
    sentCount: 0,
    plannedCount: 0,
  });

  // Selected reminder for side drawer
  const [selectedReminder, setSelectedReminder] = useState<ReminderItem | null>(null);
  const [editedSubject, setEditedSubject] = useState<string>('');
  const [editedBody, setEditedBody] = useState<string>('');
  const [aiGenerating, setAiGenerating] = useState<boolean>(false);
  const [aiTone, setAiTone] = useState<'COURTEOUS' | 'FIRM' | 'FORMAL_NOTICE'>('FIRM');
  const [savingAction, setSavingAction] = useState<boolean>(false);

  // Attached documents state (dual PDF attachments)
  const [attachInvoice, setAttachInvoice] = useState<boolean>(true);
  const [attachPaymentInstructions, setAttachPaymentInstructions] = useState<boolean>(true);
  const [previewNoticeModalOpen, setPreviewNoticeModalOpen] = useState<boolean>(false);
  const [composeView, setComposeView] = useState<'edit' | 'preview'>('edit');
  const [noticeData, setNoticeData] = useState<PaymentInstructionsData | null>(null);
  const [loadingNotice, setLoadingNotice] = useState<boolean>(false);

  // New reminder modal
  const [newModalOpen, setNewModalOpen] = useState<boolean>(false);
  const [availableInvoices, setAvailableInvoices] = useState<InvoiceListItem[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [newChannel, setNewChannel] = useState<ReminderChannel>('EMAIL');
  const [newScheduledDate, setNewScheduledDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [newSubject, setNewSubject] = useState<string>('');
  const [newBody, setNewBody] = useState<string>('');
  const [newAttachInvoice, setNewAttachInvoice] = useState<boolean>(true);
  const [newAttachPaymentInstructions, setNewAttachPaymentInstructions] = useState<boolean>(true);
  const [creatingReminder, setCreatingReminder] = useState<boolean>(false);

  const loadReminders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await remindersApi.list({
        status: activeTab,
        channel: channelFilter,
        search: searchQuery,
      });
      setReminders(res.items);
      setSummary(res.summary);
    } catch {
      notify({
        tone: 'error',
        title: 'Erreur de chargement',
        description: 'Impossible de récupérer la liste des relances.',
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, channelFilter, searchQuery, notify]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const openDrawer = (rem: ReminderItem) => {
    setComposeView('edit');
    setSelectedReminder(rem);
    setEditedSubject(rem.subject);
    setEditedBody(rem.bodyPreview);
    setAttachInvoice(rem.attachOriginalInvoice !== false);
    setAttachPaymentInstructions(rem.attachPaymentInstructions !== false);
  };

  const handleOpenNoticePreview = async (invoiceId: string) => {
    setLoadingNotice(true);
    setPreviewNoticeModalOpen(true);
    try {
      const data = await remindersApi.getPaymentInstructions(invoiceId);
      setNoticeData(data);
    } catch {
      notify({
        tone: 'error',
        title: 'Erreur',
        description: 'Impossible de charger la notice de paiement.',
      });
      setPreviewNoticeModalOpen(false);
    } finally {
      setLoadingNotice(false);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string, reference: string) => {
    try {
      await remindersApi.downloadOriginalInvoicePdf(invoiceId, reference);
      notify({
        tone: 'success',
        title: 'Facture téléchargée',
        description: `La facture originale ${reference} a été téléchargée avec succès.`,
      });
    } catch {
      notify({
        tone: 'error',
        title: 'Erreur',
        description: 'Échec du téléchargement de la facture.',
      });
    }
  };

  const handleDownloadNotice = async (invoiceId: string, reference: string) => {
    try {
      await remindersApi.downloadPaymentInstructionsPdf(invoiceId, reference);
      notify({
        tone: 'success',
        title: 'Notice de paiement téléchargée',
        description: `La notice d'instructions de paiement pour ${reference} a été téléchargée.`,
      });
    } catch {
      notify({
        tone: 'error',
        title: 'Erreur',
        description: 'Échec du téléchargement de la notice.',
      });
    }
  };

  const handleGenerateAi = async () => {
    if (!selectedReminder) return;
    setAiGenerating(true);
    try {
      const draft = await remindersApi.generateAiDraft({
        invoiceReference: selectedReminder.invoiceReference,
        clientName: selectedReminder.clientName,
        clientContact:
          selectedReminder.channel === 'WHATSAPP'
            ? selectedReminder.clientPhone || ''
            : selectedReminder.clientEmail || '',
        channel: selectedReminder.channel,
        amount: selectedReminder.remainingAmount,
        delayDays: selectedReminder.overdueDays,
        tone: aiTone,
      });

      setEditedSubject(draft.subject);
      setEditedBody(draft.body);
      notify({
        tone: 'success',
        title: 'Brouillon généré par IA Gemini',
        description:
          draft.aiGenerated
            ? 'Message rédigé avec succès selon le ton sélectionné.'
            : 'Modèle standard appliqué avec succès.',
      });
    } catch {
      notify({
        tone: 'error',
        title: 'Échec de génération',
        description: 'Le service de rédaction IA est temporairement indisponible.',
      });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSaveDrawer = async (newStatus?: ReminderStatus) => {
    if (!selectedReminder) return;
    setSavingAction(true);
    try {
      const updated = await remindersApi.update(selectedReminder.id, {
        subject: editedSubject,
        bodyPreview: editedBody,
        attachOriginalInvoice: attachInvoice,
        attachPaymentInstructions: attachPaymentInstructions,
        ...(newStatus ? { status: newStatus } : {}),
      });

      setSelectedReminder({
        ...selectedReminder,
        subject: updated.subject,
        bodyPreview: updated.bodyPreview,
        status: updated.status,
        attachOriginalInvoice: updated.attachOriginalInvoice,
        attachPaymentInstructions: updated.attachPaymentInstructions,
      });

      notify({
        tone: 'success',
        title: 'Relance mise à jour',
        description:
          newStatus === 'VALIDATED'
            ? 'La relance est validée avec ses 2 documents joints et prête pour expédition.'
            : newStatus === 'SENT'
            ? 'La relance et ses 2 documents PDF ont été marqués comme envoyés.'
            : 'Modifications et pièces jointes sauvegardées avec succès.',
      });

      loadReminders();
    } catch {
      notify({
        tone: 'error',
        title: 'Erreur',
        description: 'Impossible de mettre à jour la relance.',
      });
    } finally {
      setSavingAction(false);
    }
  };

  const handleCopyMessage = () => {
    if (!editedBody) return;
    navigator.clipboard.writeText(editedBody);
    notify({
      tone: 'info',
      title: 'Message copié',
      description: 'Le texte a été copié dans votre presse-papier.',
    });
  };

  // Open modal & load invoices
  const handleOpenNewModal = async () => {
    setNewModalOpen(true);
    setNewAttachInvoice(true);
    setNewAttachPaymentInstructions(true);
    try {
      const invRes = await invoicesApi.list({ status: 'OPEN', pageSize: 50 });
      setAvailableInvoices(invRes.items);
      if (invRes.items.length > 0) {
        setSelectedInvoiceId(invRes.items[0].id);
        setNewSubject(`Rappel d'échéance — Facture ${invRes.items[0].reference}`);
        setNewBody(
          `Bonjour,\n\nNous vous rappelons que la facture ${invRes.items[0].reference} d'un montant de ${formatCurrency(
            invRes.items[0].remainingAmount
          )} est actuellement en attente de règlement.\n\nMerci de bien vouloir procéder à son règlement.\n\nCordialement,\nService Recouvrement`
        );
      }
    } catch {
      // Invoices load fallback
    }
  };

  const handleCreateReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId) return;
    const inv = availableInvoices.find((i) => i.id === selectedInvoiceId);
    if (!inv) return;

    setCreatingReminder(true);
    try {
      await remindersApi.create({
        invoiceId: inv.id,
        clientId: inv.clientId,
        channel: newChannel,
        scheduledFor: newScheduledDate,
        subject: newSubject,
        bodyPreview: newBody,
        attachOriginalInvoice: newAttachInvoice,
        attachPaymentInstructions: newAttachPaymentInstructions,
        status: 'PREPARED',
      });
      notify({
        tone: 'success',
        title: 'Relance préparée',
        description: 'La relance a été enregistrée avec ses 2 documents joints et ajoutée à la file de validation.',
      });
      setNewModalOpen(false);
      loadReminders();
    } catch {
      notify({
        tone: 'error',
        title: 'Erreur',
        description: 'Impossible de créer la relance.',
      });
    } finally {
      setCreatingReminder(false);
    }
  };

  const columns: DataTableColumn<ReminderItem>[] = [
    {
      key: 'client',
      header: 'Client & Créance',
      render: (row) => (
        <div className="space-y-0.5">
          <div className="font-medium text-[var(--color-ink)]">{row.clientName}</div>
          <div className="text-[12px] text-[var(--color-ink-muted)] flex items-center gap-1.5">
            <span>Réf. {row.invoiceReference}</span>
            <span>·</span>
            {row.channel === 'WHATSAPP' && (
              <span className="text-emerald-700">{row.clientPhone || 'Numéro non renseigné'}</span>
            )}
            {row.channel === 'EMAIL' && (
              <span className="text-blue-700">{row.clientEmail || 'Email non renseigné'}</span>
            )}
            {row.channel === 'PHONE' && <span>{row.clientPhone || 'Téléphone'}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'channel',
      header: 'Canal',
      render: (row) => {
        const conf = CHANNEL_CONFIG[row.channel] || CHANNEL_CONFIG.EMAIL;
        const Icon = conf.Icon;
        return (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
            <Icon className="w-3.5 h-3.5 text-slate-500" />
            <span>{conf.label}</span>
          </span>
        );
      },
    },
    {
      key: 'financials',
      header: 'Solde restant & Retard',
      align: 'right',
      render: (row) => (
        <div className="text-right space-y-0.5">
          <div className="font-semibold tabular-amount text-[var(--color-ink)]">
            {formatCurrency(row.remainingAmount)}
          </div>
          <div className="text-[12px] text-amber-700 font-medium">
            {formatDelayDays(row.overdueDays)}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Statut de relance',
      render: (row) => {
        const badge = getStatusBadgeProps(row.status);
        return <StatusBadge tone={badge.tone} label={badge.label} />;
      },
    },
    {
      key: 'documents',
      header: 'Documents joints',
      render: (row) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded hover:bg-blue-100 transition cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadInvoice(row.invoiceId, row.invoiceReference);
            }}
            title="Télécharger la facture originale (PDF)"
          >
            <FileText className="w-3 h-3 text-blue-600" />
            Facture PDF
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded hover:bg-indigo-100 transition cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenNoticePreview(row.invoiceId);
            }}
            title="Aperçu de la notice d'instructions de paiement (QR code, banque, MoMo)"
          >
            <QrCode className="w-3 h-3 text-indigo-600" />
            Notice QR
          </button>
        </div>
      ),
    },
    {
      key: 'dispute_alert',
      header: 'Contrôle dossier',
      render: (row) => {
        if (row.hasDispute) {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
              <AlertTriangle className="w-3 h-3 text-rose-600" />
              Litige en cours
            </span>
          );
        }
        return (
          <span className="text-[12px] text-slate-500">
            Prévue le {formatDate(row.scheduledFor)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            openDrawer(row);
          }}
        >
          {row.status === 'PREPARED' ? 'Valider' : 'Consulter'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner if there are items to validate */}
      {summary.toValidateCount > 0 && (
        <AlertBanner
          tone="warning"
          title={`${formatNumber(summary.toValidateCount)} relance(s) en attente de validation`}
          description="Vérifiez les courriers et messages WhatsApp préparés avant toute transmission au client afin de garantir la conformité des montants et des coordonnées bancaires."
        />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="À valider"
          value={formatNumber(summary.toValidateCount)}
          helper="Brouillons préparés à relire"
          tone={summary.toValidateCount > 0 ? 'warning' : 'default'}
        />
        <SummaryCard
          label="Validées"
          value={formatNumber(summary.validatedCount)}
          helper="Prêtes pour transmission"
          tone="default"
        />
        <SummaryCard
          label="Envoyées"
          value={formatNumber(summary.sentCount)}
          helper="Relances transmises"
          tone="success"
        />
        <SummaryCard
          label="Planifiées"
          value={formatNumber(summary.plannedCount)}
          helper="Échéances programmées"
          tone="default"
        />
      </div>

      {/* Filter Bar & Controls */}
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-4 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Tabs
            variant="segmented"
            items={[
              { id: 'ALL', label: 'Toutes les relances', count: summary.totalCount },
              { id: 'to-validate', label: 'À valider', count: summary.toValidateCount },
              { id: 'VALIDATED', label: 'Validées', count: summary.validatedCount },
              { id: 'SENT', label: 'Envoyées', count: summary.sentCount },
              { id: 'PLANNED', label: 'Planifiées', count: summary.plannedCount },
            ]}
            activeId={activeTab}
            onChange={(tab) => setActiveTab(tab)}
          />

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadReminders()}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Actualiser
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenNewModal}
              icon={<Plus className="w-4 h-4" />}
            >
              Préparer une relance
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-[var(--color-border)]">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Rechercher par client ou référence de facture..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full"
            />
          </div>

          <div className="w-full sm:w-64">
            <Select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'Tous les canaux' },
                { value: 'EMAIL', label: 'Email uniquement' },
                { value: 'WHATSAPP', label: 'WhatsApp uniquement' },
                { value: 'PHONE', label: 'Téléphone uniquement' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={reminders}
        rowKey={(row) => row.id}
        onRowClick={(row) => openDrawer(row)}
        loading={loading}
        emptyState={{
          title: 'Aucune relance trouvée',
          description:
            searchQuery || activeTab !== 'ALL' || channelFilter !== 'ALL'
              ? 'Aucune relance ne correspond aux critères de filtre sélectionnés.'
              : 'Aucune relance n’est actuellement planifiée ou en attente.',
          action: (
            <Button variant="secondary" onClick={() => setActiveTab('ALL')}>
              Réinitialiser les filtres
            </Button>
          ),
        }}
      />

      {/* Side Drawer for Details, AI Drafting, and Validation */}
      <SideDrawer
        open={Boolean(selectedReminder)}
        title={selectedReminder ? `Relance — ${selectedReminder.clientName}` : 'Détail de la relance'}
        subtitle={
          selectedReminder
            ? `Facture ${selectedReminder.invoiceReference} · Solde ${formatCurrency(
                selectedReminder.remainingAmount
              )}`
            : undefined
        }
        size="xl"
        onClose={() => setSelectedReminder(null)}
        footer={
          selectedReminder && (
            <div className="flex items-center justify-between w-full">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyMessage}
                icon={<Copy className="w-3.5 h-3.5" />}
              >
                Copier le texte
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={savingAction}
                  onClick={() => handleSaveDrawer()}
                >
                  Sauvegarder
                </Button>

                {selectedReminder.status === 'PREPARED' && (
                  <Button
                    variant="primary"
                    size="sm"
                    loading={savingAction}
                    onClick={() => handleSaveDrawer('VALIDATED')}
                    icon={<Check className="w-3.5 h-3.5" />}
                  >
                    Valider la relance
                  </Button>
                )}

                {selectedReminder.status === 'VALIDATED' && (
                  <Button
                    variant="primary"
                    size="sm"
                    loading={savingAction}
                    onClick={() => handleSaveDrawer('SENT')}
                    icon={<Send className="w-3.5 h-3.5" />}
                  >
                    Marquer comme envoyée
                  </Button>
                )}
              </div>
            </div>
          )
        }
      >
        {selectedReminder && (
          <div className="space-y-6">
            {/* Warning if invoice is in dispute */}
            {selectedReminder.hasDispute && (
              <AlertBanner
                tone="error"
                title="Dossier sous litige actif"
                description="Un litige commercial a été déclaré sur cette facture. Il est fortement recommandé de suspendre toute relance avant la résolution du litige pour préserver la relation client."
              />
            )}

            {/* Overview Grid */}
            <div className="bg-slate-50 border border-[var(--color-border)] rounded-lg p-4 grid grid-cols-2 gap-4 text-[13px]">
              <div>
                <span className="text-[var(--color-ink-muted)] block">Client débiteur</span>
                <span className="font-semibold text-[var(--color-ink)]">
                  {selectedReminder.clientName}
                </span>
                {onNavigateToClient && (
                  <button
                    type="button"
                    onClick={() => onNavigateToClient(selectedReminder.clientId)}
                    className="text-xs text-blue-600 hover:underline block mt-0.5"
                  >
                    Voir la fiche client →
                  </button>
                )}
              </div>

              <div>
                <span className="text-[var(--color-ink-muted)] block">Facture liée</span>
                <span className="font-semibold text-[var(--color-ink)]">
                  {selectedReminder.invoiceReference}
                </span>
                {onNavigateToInvoice && (
                  <button
                    type="button"
                    onClick={() => onNavigateToInvoice(selectedReminder.invoiceId)}
                    className="text-xs text-blue-600 hover:underline block mt-0.5"
                  >
                    Consulter la facture →
                  </button>
                )}
              </div>

              <div>
                <span className="text-[var(--color-ink-muted)] block">Solde à recouvrer</span>
                <span className="font-semibold text-[var(--color-ink)] tabular-amount">
                  {formatCurrency(selectedReminder.remainingAmount)}
                </span>
              </div>

              <div>
                <span className="text-[var(--color-ink-muted)] block">Retard constaté</span>
                <span className="font-semibold text-amber-700">
                  {formatDelayDays(selectedReminder.overdueDays)}
                </span>
              </div>

              <div className="col-span-2 pt-2 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
                <div className="text-[12px] text-slate-600">
                  <span className="font-medium">Créneau d’appel autorisé :</span>{' '}
                  {selectedReminder.contactHours || 'Horaires standards (08h30 - 17h30)'}
                </div>
                {selectedReminder.restrictionsNote && (
                  <div className="text-[12px] text-rose-700 font-medium">
                    Consigne : {selectedReminder.restrictionsNote}
                  </div>
                )}
              </div>
            </div>

            {/* Direct Channel External Action */}
            <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[13px] text-blue-900">
                {selectedReminder.channel === 'WHATSAPP' ? (
                  <>
                    <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Envoi via WhatsApp au <strong>{selectedReminder.clientPhone || 'N/A'}</strong>
                    </span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      Envoi par Email à <strong>{selectedReminder.clientEmail || 'N/A'}</strong>
                    </span>
                  </>
                )}
              </div>

              {selectedReminder.channel === 'WHATSAPP' && selectedReminder.clientPhone && (
                <a
                  href={`https://wa.me/${selectedReminder.clientPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    editedBody
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ouvrir WhatsApp Web
                </a>
              )}

              {selectedReminder.channel === 'EMAIL' && selectedReminder.clientEmail && (
                <a
                  href={`mailto:${selectedReminder.clientEmail}?subject=${encodeURIComponent(
                    editedSubject
                  )}&body=${encodeURIComponent(editedBody)}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ouvrir client Email
                </a>
              )}
            </div>

            {/* AI Assistant Section */}
            <div className="bg-gradient-to-br from-indigo-50/80 to-blue-50/80 border border-indigo-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-indigo-600 text-white flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-indigo-950">
                      Rédacteur intelligent Gemini
                    </h3>
                    <p className="text-[12px] text-indigo-700">
                      Génération d’un message personnalisé conforme aux montants et coordonnées
                      officielles.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={aiTone}
                    onChange={(e) =>
                      setAiTone(e.target.value as 'COURTEOUS' | 'FIRM' | 'FORMAL_NOTICE')
                    }
                    options={[
                      { value: 'COURTEOUS', label: 'Ton : Courtois' },
                      { value: 'FIRM', label: 'Ton : Ferme & Pro' },
                      { value: 'FORMAL_NOTICE', label: 'Ton : Mise en demeure' },
                    ]}
                    className="text-xs py-1"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    loading={aiGenerating}
                    onClick={handleGenerateAi}
                    icon={<Sparkles className="w-3.5 h-3.5" />}
                  >
                    Rédiger
                  </Button>
                </div>
              </div>
            </div>

            {/* Editable Fields + Aperçu email client */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Tabs
                  variant="segmented"
                  activeId={composeView}
                  onChange={(id) => setComposeView(id as 'edit' | 'preview')}
                  items={[
                    { id: 'edit', label: 'Édition' },
                    { id: 'preview', label: 'Aperçu email client' },
                  ]}
                />
                <span className="hidden sm:inline text-[11px] text-[var(--color-ink-muted)]">
                  WYSIWYG · ce que le client recevra
                </span>
              </div>

              {composeView === 'edit' ? (
                <>
                  <div>
                    <label className="block text-[13px] font-medium text-[var(--color-ink)] mb-1">
                      Objet du message
                    </label>
                    <Input
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      placeholder="Objet de la relance..."
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[13px] font-medium text-[var(--color-ink)]">
                        Corps du message
                      </label>
                      <span className="text-[12px] text-[var(--color-ink-muted)]">
                        Vérifiez les coordonnées d&apos;encaissement avant expédition
                      </span>
                    </div>
                    <textarea
                      rows={9}
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      className="w-full rounded-md border border-[var(--color-border)] p-3 text-[13px] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-mono leading-relaxed"
                      placeholder="Rédigez ou collez votre message de relance..."
                    />
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-[var(--color-border)] overflow-hidden bg-slate-100/80">
                  <div className="bg-slate-200/80 px-4 py-2 text-[11px] text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      <strong>De :</strong> recouvrement@alphalogistique.bj
                    </span>
                    <span>
                      <strong>À :</strong>{' '}
                      {selectedReminder.clientEmail || 'client@exemple.demo'}
                    </span>
                    <span className="basis-full sm:basis-auto">
                      <strong>Objet :</strong> {editedSubject || '(sans objet)'}
                    </span>
                  </div>
                  <div className="bg-white m-3 rounded-md border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-[#0F1D2E] text-white px-5 py-4">
                      <p className="font-display text-[18px] font-bold tracking-tight">
                        Alpha Logistique &amp; Services SA
                      </p>
                      <p className="text-[12px] text-slate-300 mt-0.5">
                        Service recouvrement · Cotonou
                      </p>
                    </div>
                    <div className="px-5 py-5 space-y-4">
                      <p className="text-[12px] text-slate-500">
                        Facture {selectedReminder.invoiceReference} · Solde{' '}
                        {formatCurrency(selectedReminder.remainingAmount)}
                      </p>
                      <div className="text-[14px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {editedBody || 'Aucun contenu rédigé pour le moment.'}
                      </div>
                      {(attachInvoice || attachPaymentInstructions) && (
                        <div className="pt-2">
                          <p className="text-[12px] font-semibold text-slate-600 mb-2">
                            Pièces jointes
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {attachInvoice && (
                              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                                <div className="w-9 h-11 rounded bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                                  PDF
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[12px] font-semibold text-slate-900 truncate">
                                    facture_{selectedReminder.invoiceReference}.pdf
                                  </p>
                                  <p className="text-[11px] text-slate-500">Facture originale</p>
                                </div>
                              </div>
                            )}
                            {attachPaymentInstructions && (
                              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                                <div className="w-9 h-11 rounded bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                                  PDF
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[12px] font-semibold text-slate-900 truncate">
                                    notice_paiement_{selectedReminder.invoiceReference}.pdf
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    Notice + QR de paiement
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 text-[12px] text-slate-600 leading-relaxed">
                      <p className="font-semibold text-slate-800">Cordialement,</p>
                      <p>L’équipe Recouvrement — Alpha Logistique &amp; Services SA</p>
                      <p className="mt-1 text-slate-400">
                        Boulevard Saint-Michel, Cotonou · +229 01 21 30 40 50
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pièces jointes officielles (2 PDF distincts) */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center">
                      <FileCheck2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-[13px] font-semibold text-slate-900">
                        Pièces jointes à la relance (2 PDF distincts)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Documents certifiés joints à l’email pour faciliter le règlement immédiat
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-blue-800 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded">
                    {(attachInvoice ? 1 : 0) + (attachPaymentInstructions ? 1 : 0)} / 2 actif(s)
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  {/* Document 1: Facture originale */}
                  <div
                    className={`p-3 rounded-lg border transition ${
                      attachInvoice
                        ? 'bg-white border-blue-200 shadow-xs'
                        : 'bg-slate-100/70 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex items-start gap-2.5 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={attachInvoice}
                          onChange={(e) => setAttachInvoice(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="font-mono text-xs font-bold text-slate-900 truncate">
                              facture_{selectedReminder.invoiceReference}.pdf
                            </span>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              Facture originale
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Facture commerciale initiale certifiée conforme (Solde : {formatCurrency(selectedReminder.remainingAmount)})
                          </p>
                        </div>
                      </label>

                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Download className="w-3 h-3" />}
                        onClick={() =>
                          handleDownloadInvoice(
                            selectedReminder.invoiceId,
                            selectedReminder.invoiceReference
                          )
                        }
                        title="Télécharger la facture originale"
                      >
                        PDF
                      </Button>
                    </div>
                  </div>

                  {/* Document 2: Notice d'instructions de paiement */}
                  <div
                    className={`p-3 rounded-lg border transition ${
                      attachPaymentInstructions
                        ? 'bg-white border-indigo-200 shadow-xs'
                        : 'bg-slate-100/70 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex items-start gap-2.5 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={attachPaymentInstructions}
                          onChange={(e) => setAttachPaymentInstructions(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <QrCode className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="font-mono text-xs font-bold text-slate-900 truncate">
                              notice_instructions_paiement_{selectedReminder.invoiceReference}.pdf
                            </span>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Notice de paiement
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Code QR dynamique, coordonnées bancaires (IBAN/RIB), compte MoMo, référence impérative et 3 étapes post-paiement.
                          </p>
                        </div>
                      </label>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<QrCode className="w-3 h-3" />}
                          onClick={() => handleOpenNoticePreview(selectedReminder.invoiceId)}
                          title="Aperçu visuel de la notice"
                        >
                          Aperçu
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Download className="w-3 h-3" />}
                          onClick={() =>
                            handleDownloadNotice(
                              selectedReminder.invoiceId,
                              selectedReminder.invoiceReference
                            )
                          }
                          title="Télécharger la notice PDF"
                        >
                          PDF
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 bg-blue-50/60 border border-blue-100 rounded px-2.5 py-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    {attachInvoice && attachPaymentInstructions
                      ? 'L’email envoyé comportera les deux pièces jointes PDF (facture originale + notice de paiement).'
                      : attachInvoice
                      ? 'Seule la facture originale PDF sera attachée.'
                      : attachPaymentInstructions
                      ? 'Seule la notice de paiement PDF sera attachée.'
                      : 'Aucune pièce jointe sélectionnée.'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </SideDrawer>

      {/* Modal: New Reminder Creation */}
      {newModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-xl bg-white border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--color-ink)]">
                  Préparer une nouvelle relance
                </h3>
                <p className="text-[12px] text-[var(--color-ink-muted)]">
                  Sélectionnez une créance et configurez le canal de communication avec 2 PDF joints.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReminderSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[var(--color-ink)] mb-1">
                  Facture ciblée
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => {
                    const invId = e.target.value;
                    setSelectedInvoiceId(invId);
                    const found = availableInvoices.find((i) => i.id === invId);
                    if (found) {
                      setNewSubject(`Rappel d'échéance — Facture ${found.reference}`);
                    }
                  }}
                  className="w-full h-9 px-3 rounded-md border border-[var(--color-border)] text-[13px] text-[var(--color-ink)] bg-white"
                >
                  {availableInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.reference} — {inv.clientName} (Solde : {formatCurrency(inv.remainingAmount)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[var(--color-ink)] mb-1">
                    Canal d'expédition
                  </label>
                  <select
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value as ReminderChannel)}
                    className="w-full h-9 px-3 rounded-md border border-[var(--color-border)] text-[13px] text-[var(--color-ink)] bg-white"
                  >
                    <option value="EMAIL">Email professionnel</option>
                    <option value="WHATSAPP">WhatsApp Business</option>
                    <option value="PHONE">Appel téléphonique</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[var(--color-ink)] mb-1">
                    Date prévue
                  </label>
                  <Input
                    type="date"
                    value={newScheduledDate}
                    onChange={(e) => setNewScheduledDate(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[var(--color-ink)] mb-1">
                  Objet
                </label>
                <Input
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Objet du message"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[var(--color-ink)] mb-1">
                  Message préparé
                </label>
                <textarea
                  rows={4}
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border)] p-3 text-[13px] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-mono"
                  placeholder="Texte de la relance..."
                  required
                />
              </div>

              {/* Pièces jointes pré-configurées */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <span className="text-xs font-semibold text-slate-800 block">
                  Documents PDF joints à cet envoi :
                </span>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAttachInvoice}
                    onChange={(e) => setNewAttachInvoice(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <strong>1. Facture originale (PDF)</strong> — Document commercial certifié
                  </span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAttachPaymentInstructions}
                    onChange={(e) => setNewAttachPaymentInstructions(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    <strong>2. Notice de paiement (PDF)</strong> — QR code, Banque, MoMo, étapes
                  </span>
                </label>
              </div>

              <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-end gap-3">
                <Button variant="secondary" onClick={() => setNewModalOpen(false)}>
                  Annuler
                </Button>
                <Button variant="primary" type="submit" loading={creatingReminder}>
                  Enregistrer le brouillon
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview: Notice d'Instructions de Paiement */}
      <PaymentInstructionsNoticeModal
        open={previewNoticeModalOpen}
        onClose={() => setPreviewNoticeModalOpen(false)}
        data={noticeData}
        loading={loadingNotice}
      />
    </div>
  );
};
