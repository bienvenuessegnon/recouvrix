import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  FileText,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';
import {
  AlertBanner,
  Button,
  DataTable,
  DataTableColumn,
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
  formatDateTime,
  formatNumber,
} from '../design-system/formatters';
import { ApiError, documentsApi, invoicesApi, paymentsApi } from '../services/api';
import type { InvoiceListItem } from '../types/invoices';
import type { PaymentItem, PaymentReceipt, PaymentStatus } from '../types/payments';

export interface PaymentsPageProps {
  initialFilter?: string;
  onNavigateToInvoice?: (invoiceId: string) => void;
  onNavigateToClient?: (clientId: string) => void;
}

function getPaymentStatusBadge(status: PaymentStatus): {
  tone: 'warning' | 'success' | 'danger' | 'neutral';
  label: string;
} {
  switch (status) {
    case 'DECLARED':
      return { tone: 'warning', label: 'Déclaré par le client' };
    case 'RECEIPT_RECEIVED':
      return { tone: 'warning', label: 'Justificatif reçu' };
    case 'PENDING_VERIFICATION':
      return { tone: 'warning', label: 'À vérifier' };
    case 'CONFIRMED':
    case 'RECORDED':
      return { tone: 'success', label: 'Confirmé & Imputé' };
    case 'REJECTED':
      return { tone: 'danger', label: 'Rejeté' };
    default:
      return { tone: 'neutral', label: status };
  }
}

export const PaymentsPage: React.FC<PaymentsPageProps> = ({
  initialFilter,
  onNavigateToInvoice,
  onNavigateToClient,
}) => {
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState<string>(
    initialFilter === 'en-attente' ? 'en-attente' : 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [summary, setSummary] = useState({
    totalCount: 0,
    pendingCount: 0,
    confirmedCount: 0,
    rejectedCount: 0,
    pendingAmount: 0,
    confirmedAmount: 0,
  });

  // Selected payment for inspection drawer
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [processingAction, setProcessingAction] = useState<boolean>(false);
  const [showRejectForm, setShowRejectForm] = useState<boolean>(false);
  const [confirmedReceipt, setConfirmedReceipt] = useState<PaymentReceipt | null>(null);
  const [sendingConfirmation, setSendingConfirmation] = useState(false);
  const [confirmationSentChannel, setConfirmationSentChannel] = useState<
    'EMAIL' | 'WHATSAPP' | null
  >(null);

  // New payment declaration modal
  const [declareModalOpen, setDeclareModalOpen] = useState<boolean>(false);
  const [availableInvoices, setAvailableInvoices] = useState<InvoiceListItem[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [declaredAmount, setDeclaredAmount] = useState<number>(0);
  const [declaredMethod, setDeclaredMethod] = useState<string>('Virement bancaire');
  const [declaredRef, setDeclaredRef] = useState<string>('');
  const [creatingPayment, setCreatingPayment] = useState<boolean>(false);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await paymentsApi.list({
        status: activeTab,
        search: searchQuery,
      });
      setPayments(res.items);
      setSummary(res.summary);
    } catch {
      notify({
        tone: 'error',
        title: 'Erreur',
        description: 'Impossible de charger la liste des règlements.',
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, notify]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleOpenDrawer = async (item: PaymentItem) => {
    setSelectedPayment(item);
    setShowRejectForm(false);
    setRejectionReason('');
    setConfirmedReceipt(null);
    setConfirmationSentChannel(null);
    if (item.status === 'CONFIRMED' || item.status === 'RECORDED') {
      try {
        const receipt = await paymentsApi.getReceipt(item.id);
        setConfirmedReceipt(receipt);
      } catch {
        // Quittance indisponible : l’envoi reste possible côté API après recontrôle
      }
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedPayment) return;
    setProcessingAction(true);
    try {
      const result = await paymentsApi.confirm(selectedPayment.id);
      setSelectedPayment({
        ...selectedPayment,
        ...result.payment,
        status: 'CONFIRMED',
        confirmedAt: result.payment.confirmedAt || new Date().toISOString(),
        receiptDocumentId:
          result.payment.receiptDocumentId || result.receipt?.documentId || null,
        receiptFileName:
          result.payment.receiptFileName ||
          (result.receipt ? `attestation_${result.receipt.receiptNumber}.pdf` : null),
        invoiceRemainingAmount: result.receipt
          ? result.receipt.financials.newRemaining
          : Math.max(0, selectedPayment.invoiceRemainingAmount - selectedPayment.amount),
      });
      setConfirmedReceipt(result.receipt);
      setConfirmationSentChannel(null);
      notify({
        tone: 'success',
        title: 'Encaissement confirmé',
        description:
          result.message ||
          `Paiement ${selectedPayment.reference} imputé — quittance prête à envoyer au client.`,
      });
      loadPayments();
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Erreur',
        description:
          err instanceof ApiError ? err.message : 'Échec de confirmation du paiement.',
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleSendRecoveryConfirmation = async (channel: 'EMAIL' | 'WHATSAPP') => {
    if (!selectedPayment) return;
    setSendingConfirmation(true);
    try {
      const result = await paymentsApi.sendReceipt(selectedPayment.id, channel);
      if (result.deepLink) {
        window.open(result.deepLink, '_blank', 'noopener,noreferrer');
      }
      setConfirmationSentChannel(channel);
      notify({
        tone: 'success',
        title: 'Confirmation de recouvrement envoyée',
        description:
          result.message ||
          `Quittance transmise en simulation via ${channel === 'WHATSAPP' ? 'WhatsApp' : 'e-mail'}.`,
      });
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Envoi impossible',
        description:
          err instanceof ApiError
            ? err.message
            : 'Impossible d’envoyer la confirmation de recouvrement.',
      });
    } finally {
      setSendingConfirmation(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedPayment || !rejectionReason.trim()) return;
    setProcessingAction(true);
    try {
      await paymentsApi.reject(selectedPayment.id, { reason: rejectionReason.trim() });
      notify({
        tone: 'info',
        title: 'Paiement rejeté',
        description: `Le paiement a été rejeté (${rejectionReason.trim()}). La créance reste exigible.`,
      });
      setSelectedPayment(null);
      setShowRejectForm(false);
      loadPayments();
    } catch {
      notify({
        tone: 'error',
        title: 'Erreur',
        description: 'Échec du rejet du paiement.',
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleOpenDeclareModal = async () => {
    setDeclareModalOpen(true);
    try {
      const invRes = await invoicesApi.list({ status: 'OPEN', pageSize: 50 });
      setAvailableInvoices(invRes.items);
      if (invRes.items.length > 0) {
        setSelectedInvoiceId(invRes.items[0].id);
        setDeclaredAmount(invRes.items[0].remainingAmount);
        setDeclaredRef(`PAY-${Date.now().toString().slice(-6)}`);
      }
    } catch {
      // Invoices load fallback
    }
  };

  const handleDeclareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || declaredAmount <= 0) return;
    const inv = availableInvoices.find((i) => i.id === selectedInvoiceId);
    if (!inv) return;

    setCreatingPayment(true);
    try {
      await paymentsApi.create({
        invoiceId: inv.id,
        clientId: inv.clientId,
        amount: Number(declaredAmount),
        paymentMethod: declaredMethod,
        reference: declaredRef || `PAY-${Date.now().toString().slice(-6)}`,
      });
      notify({
        tone: 'success',
        title: 'Règlement déclaré',
        description: 'Le paiement a été enregistré et soumis à vérification comptable.',
      });
      setDeclareModalOpen(false);
      loadPayments();
    } catch {
      notify({
        tone: 'error',
        title: 'Erreur',
        description: 'Impossible d’enregistrer la déclaration de paiement.',
      });
    } finally {
      setCreatingPayment(false);
    }
  };

  const columns: DataTableColumn<PaymentItem>[] = [
    {
      key: 'ref',
      header: 'Réf. Paiement & Justificatif',
      render: (row) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
            <span>{row.reference}</span>
            {row.receiptFileName && (
              <span className="text-[11px] font-normal text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded inline-flex items-center gap-1">
                <FileCheck2 className="w-3 h-3" />
                Justificatif
              </span>
            )}
          </div>
          <div className="text-[12px] text-[var(--color-ink-muted)]">
            Déclaré le {formatDate(row.declaredAt)}
          </div>
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Client & Facture',
      render: (row) => (
        <div className="space-y-0.5">
          <div className="font-medium text-[var(--color-ink)]">{row.clientName}</div>
          <div className="text-[12px] text-blue-700 font-mono">
            Facture : {row.invoiceReference}
          </div>
        </div>
      ),
    },
    {
      key: 'method',
      header: 'Mode de règlement',
      render: (row) => (
        <span className="text-[13px] text-slate-700">{row.paymentMethod}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Montant encaissé',
      align: 'right',
      render: (row) => (
        <div className="text-right">
          <div className="font-bold tabular-amount text-[14px] text-[var(--color-ink)]">
            {formatCurrency(row.amount)}
          </div>
          <div className="text-[11px] text-slate-500">
            Solde résiduel : {formatCurrency(row.invoiceRemainingAmount)}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Statut vérification',
      render: (row) => {
        const badge = getPaymentStatusBadge(row.status);
        return <StatusBadge tone={badge.tone} label={badge.label} />;
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
            handleOpenDrawer(row);
          }}
        >
          {row.status === 'RECEIPT_RECEIVED' || row.status === 'DECLARED' || row.status === 'PENDING_VERIFICATION'
            ? 'Vérifier'
            : 'Consulter'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Alert banner for pending receipts */}
      {summary.pendingCount > 0 && (
        <AlertBanner
          tone="warning"
          title={`${formatNumber(summary.pendingCount)} règlement(s) en attente de vérification (${formatCurrency(
            summary.pendingAmount
          )})`}
          description="Rapprochez les justificatifs bancaires ou Mobile Money avec votre extrait de compte avant de valider l'imputation sur les créances."
        />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="À vérifier"
          value={formatNumber(summary.pendingCount)}
          helper={formatCurrency(summary.pendingAmount)}
          tone={summary.pendingCount > 0 ? 'warning' : 'default'}
        />
        <SummaryCard
          label="Paiements confirmés"
          value={formatNumber(summary.confirmedCount)}
          helper={formatCurrency(summary.confirmedAmount)}
          tone="success"
        />
        <SummaryCard
          label="Paiements rejetés"
          value={formatNumber(summary.rejectedCount)}
          helper="Justificatifs non validés"
          tone={summary.rejectedCount > 0 ? 'danger' : 'default'}
        />
        <SummaryCard
          label="Total règlements"
          value={formatNumber(summary.totalCount)}
          helper="Opérations tracées"
          tone="default"
        />
      </div>

      {/* Filter and Action Bar */}
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-4 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Tabs
            variant="segmented"
            items={[
              { id: 'ALL', label: 'Tous les règlements', count: summary.totalCount },
              { id: 'en-attente', label: 'À vérifier', count: summary.pendingCount },
              { id: 'CONFIRMED', label: 'Confirmés', count: summary.confirmedCount },
              { id: 'REJECTED', label: 'Rejetés', count: summary.rejectedCount },
            ]}
            activeId={activeTab}
            onChange={(tab) => setActiveTab(tab)}
          />

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadPayments()}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Actualiser
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenDeclareModal}
              icon={<Plus className="w-4 h-4" />}
            >
              Déclarer un règlement
            </Button>
          </div>
        </div>

        <div className="pt-2 border-t border-[var(--color-border)]">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Rechercher par référence, nom du client ou facture..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={payments}
        rowKey={(row) => row.id}
        onRowClick={(row) => handleOpenDrawer(row)}
        loading={loading}
        emptyState={{
          title: 'Aucun règlement trouvé',
          description:
            searchQuery || activeTab !== 'ALL'
              ? 'Aucun règlement ne correspond aux critères de filtre.'
              : 'Aucun paiement n’a encore été enregistré.',
          action: (
            <Button variant="secondary" onClick={() => setActiveTab('ALL')}>
              Réinitialiser les filtres
            </Button>
          ),
        }}
      />

      {/* Side Drawer for Payment Inspection & Reconciliation */}
      <SideDrawer
        open={Boolean(selectedPayment)}
        title={selectedPayment ? `Contrôle — Règlement ${selectedPayment.reference}` : 'Détails'}
        subtitle={
          selectedPayment
            ? `${selectedPayment.clientName} · ${formatCurrency(selectedPayment.amount)}`
            : undefined
        }
        size="lg"
        onClose={() => setSelectedPayment(null)}
        footer={
          selectedPayment && (
            <div className="flex items-center justify-between w-full">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedPayment(null)}
              >
                Fermer
              </Button>

              {(selectedPayment.status === 'RECEIPT_RECEIVED' ||
                selectedPayment.status === 'DECLARED' ||
                selectedPayment.status === 'PENDING_VERIFICATION') && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={processingAction}
                    onClick={() => setShowRejectForm(!showRejectForm)}
                    icon={<Ban className="w-3.5 h-3.5" />}
                  >
                    Rejeter
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={processingAction}
                    onClick={handleConfirmPayment}
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  >
                    Confirmer l’encaissement
                  </Button>
                </div>
              )}

              {(selectedPayment.status === 'CONFIRMED' ||
                selectedPayment.status === 'RECORDED') && (
                <Button
                  variant="primary"
                  size="sm"
                  loading={sendingConfirmation}
                  onClick={() => handleSendRecoveryConfirmation('EMAIL')}
                  icon={<Send className="w-3.5 h-3.5" />}
                >
                  Envoyer la confirmation
                </Button>
              )}
            </div>
          )
        }
      >
        {selectedPayment && (
          <div className="space-y-6">
            {/* Status card */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-[var(--color-border)]">
              <div>
                <span className="text-xs text-[var(--color-ink-muted)] block">Statut actuel</span>
                <span className="font-semibold text-sm">
                  {getPaymentStatusBadge(selectedPayment.status).label}
                </span>
              </div>
              <StatusBadge
                tone={getPaymentStatusBadge(selectedPayment.status).tone}
                label={getPaymentStatusBadge(selectedPayment.status).label}
              />
            </div>

            {/* Confirmation de recouvrement — après encaissement */}
            {(selectedPayment.status === 'CONFIRMED' ||
              selectedPayment.status === 'RECORDED') && (
              <div className="border border-emerald-200 bg-emerald-50/60 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <FileCheck2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-950">
                      Confirmation de recouvrement
                    </h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      L’argent est bien reçu et imputé. Envoyez la quittance au client
                      (e-mail ou WhatsApp simulés) pour clôturer le parcours.
                    </p>
                  </div>
                </div>

                {confirmedReceipt && (
                  <div className="grid grid-cols-2 gap-3 text-xs bg-white/70 border border-emerald-100 rounded-md p-3">
                    <div>
                      <span className="text-emerald-700 block">N° quittance</span>
                      <span className="font-semibold text-slate-900">
                        {confirmedReceipt.receiptNumber}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-700 block">Nouveau solde</span>
                      <span className="font-semibold text-slate-900 tabular-amount">
                        {formatCurrency(confirmedReceipt.financials.newRemaining)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-emerald-700 block">Statut créance</span>
                      <span className="font-semibold text-slate-900">
                        {confirmedReceipt.financials.badgeLabel}
                      </span>
                    </div>
                  </div>
                )}

                {confirmationSentChannel && (
                  <div className="text-xs font-medium text-emerald-900 bg-emerald-100/80 p-2 rounded flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    Confirmation déjà transmise via{' '}
                    {confirmationSentChannel === 'WHATSAPP' ? 'WhatsApp' : 'e-mail'} (simulé).
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="primary"
                    loading={sendingConfirmation}
                    onClick={() => handleSendRecoveryConfirmation('EMAIL')}
                    icon={<Mail className="w-3.5 h-3.5" />}
                  >
                    E-mail (simulé)
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={sendingConfirmation}
                    onClick={() => handleSendRecoveryConfirmation('WHATSAPP')}
                    icon={<MessageSquare className="w-3.5 h-3.5" />}
                  >
                    WhatsApp (simulé)
                  </Button>
                  {(selectedPayment.receiptDocumentId || confirmedReceipt?.documentId) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Download className="w-3.5 h-3.5" />}
                      onClick={() =>
                        documentsApi.download(
                          selectedPayment.receiptDocumentId ||
                            confirmedReceipt!.documentId,
                          selectedPayment.receiptFileName ||
                            `attestation_${confirmedReceipt?.receiptNumber || 'quittance'}.pdf`
                        )
                      }
                    >
                      Télécharger la quittance
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Reconciliation Comparison Card */}
            <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Rapprochement comptable de la créance
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-blue-700 block">Facture ciblée</span>
                  <span className="font-semibold text-slate-900">
                    {selectedPayment.invoiceReference}
                  </span>
                  {onNavigateToInvoice && (
                    <button
                      type="button"
                      onClick={() => onNavigateToInvoice(selectedPayment.invoiceId)}
                      className="text-xs text-blue-600 hover:underline block mt-0.5"
                    >
                      Voir la facture →
                    </button>
                  )}
                </div>

                <div>
                  <span className="text-xs text-blue-700 block">Montant du règlement</span>
                  <span className="font-bold text-slate-900 tabular-amount text-base">
                    {formatCurrency(selectedPayment.amount)}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-blue-700 block">Solde restant avant règlement</span>
                  <span className="font-medium text-slate-800 tabular-amount">
                    {formatCurrency(selectedPayment.invoiceRemainingAmount)}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-blue-700 block">Nouveau solde après confirmation</span>
                  <span className="font-bold text-emerald-800 tabular-amount">
                    {formatCurrency(
                      Math.max(0, selectedPayment.invoiceRemainingAmount - selectedPayment.amount)
                    )}
                  </span>
                </div>
              </div>

              {selectedPayment.invoiceRemainingAmount - selectedPayment.amount <= 0 ? (
                <div className="text-xs font-medium text-emerald-800 bg-emerald-100/70 p-2 rounded flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Ce règlement soldera intégralement la facture ({selectedPayment.invoiceReference}).
                </div>
              ) : (
                <div className="text-xs font-medium text-amber-800 bg-amber-100/70 p-2 rounded flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  Il s'agit d'un règlement partiel (acompte). Un reliquat de{' '}
                  {formatCurrency(selectedPayment.invoiceRemainingAmount - selectedPayment.amount)}{' '}
                  restera exigible.
                </div>
              )}
            </div>

            {/* Document / Receipt Section */}
            <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-semibold text-[var(--color-ink)]">
                    Justificatif de versement
                  </span>
                </div>

                {selectedPayment.receiptDocumentId ? (
                  <button
                    type="button"
                    onClick={() =>
                      documentsApi.download(
                        selectedPayment.receiptDocumentId!,
                        selectedPayment.receiptFileName || 'justificatif_paiement.pdf'
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Télécharger la pièce
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">Aucun justificatif joint</span>
                )}
              </div>

              {selectedPayment.receiptFileName ? (
                <div className="bg-slate-50 p-3 rounded text-xs text-slate-700 flex items-center justify-between">
                  <span>Nom du fichier : {selectedPayment.receiptFileName}</span>
                  <span className="text-emerald-700 font-medium">Reçu vérifiable</span>
                </div>
              ) : (
                <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded">
                  Paiement déclaré sur foi des déclarations client. Il est recommandé d'exiger une
                  preuve de virement bancaire ou une capture de confirmation Mobile Money.
                </div>
              )}
            </div>

            {/* Detailed Operation Data */}
            <div className="space-y-2 text-xs text-slate-600 border-t border-[var(--color-border)] pt-4">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Mode de transfert déclaré :</span>
                <span className="font-medium text-slate-900">{selectedPayment.paymentMethod}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Date de déclaration :</span>
                <span className="font-medium text-slate-900">
                  {formatDateTime(selectedPayment.declaredAt)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Enregistré par :</span>
                <span className="font-medium text-slate-900">{selectedPayment.createdBy}</span>
              </div>
              {selectedPayment.confirmedAt && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Validé le :</span>
                  <span className="font-medium text-emerald-800">
                    {formatDateTime(selectedPayment.confirmedAt)}
                  </span>
                </div>
              )}
              {selectedPayment.rejectionReason && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800">
                  <strong>Motif du rejet :</strong> {selectedPayment.rejectionReason}
                </div>
              )}
            </div>

            {/* Rejection Form Drawer Expansion */}
            {showRejectForm && (
              <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-lg space-y-3">
                <div className="text-xs font-semibold text-rose-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Confirmation du rejet du règlement
                </div>
                <p className="text-xs text-rose-700">
                  Précisez le motif du rejet (par ex. justificatif falsifié, montant non reçu sur le
                  compte, ou référence invalide).
                </p>
                <Input
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ex : Virement non reçu sur le relevé bancaire de l'entreprise..."
                  className="w-full text-xs"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowRejectForm(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    loading={processingAction}
                    disabled={!rejectionReason.trim()}
                    onClick={handleRejectPayment}
                  >
                    Confirmer le rejet
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </SideDrawer>

      {/* Modal: Manual Payment Declaration */}
      {declareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-lg bg-white border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--color-ink)]">
                  Déclarer un règlement client
                </h3>
                <p className="text-[12px] text-[var(--color-ink-muted)]">
                  Enregistrez un paiement reçu par virement, chèque ou Mobile Money.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeclareModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDeclareSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[var(--color-ink)] mb-1">
                  Facture concernée
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => {
                    const invId = e.target.value;
                    setSelectedInvoiceId(invId);
                    const found = availableInvoices.find((i) => i.id === invId);
                    if (found) {
                      setDeclaredAmount(found.remainingAmount);
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
                    Montant versé (FCFA)
                  </label>
                  <Input
                    type="number"
                    value={declaredAmount}
                    onChange={(e) => setDeclaredAmount(Number(e.target.value))}
                    min={1}
                    className="w-full font-mono font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[var(--color-ink)] mb-1">
                    Mode de règlement
                  </label>
                  <select
                    value={declaredMethod}
                    onChange={(e) => setDeclaredMethod(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-[var(--color-border)] text-[13px] text-[var(--color-ink)] bg-white"
                  >
                    <option value="Virement bancaire">Virement bancaire</option>
                    <option value="MTN Mobile Money">MTN Mobile Money</option>
                    <option value="Moov Money">Moov Money</option>
                    <option value="Chèque de banque">Chèque de banque</option>
                    <option value="Versement espèces">Versement espèces</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[var(--color-ink)] mb-1">
                  Référence du paiement ou n° transaction
                </label>
                <Input
                  value={declaredRef}
                  onChange={(e) => setDeclaredRef(e.target.value)}
                  placeholder="Ex : PAY-2026-0102 ou ID Transac MTN..."
                  className="w-full"
                  required
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
                ℹ️ Ce règlement sera placé en file d'attente de vérification pour que la comptabilité
                valide la conformité bancaire avant clôture de la créance.
              </div>

              <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-end gap-3">
                <Button variant="secondary" onClick={() => setDeclareModalOpen(false)}>
                  Annuler
                </Button>
                <Button variant="primary" type="submit" loading={creatingPayment}>
                  Enregistrer la déclaration
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
