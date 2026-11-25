import React, { useState } from 'react';
import {
  Banknote,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Info,
  Printer,
  QrCode,
  ShieldAlert,
  Smartphone,
  X,
} from 'lucide-react';
import { Button, useToast } from '../ui';
import { formatCurrency, formatDate } from '../../design-system/formatters';
import { DynamicQRCode } from './DynamicQRCode';
import { remindersApi } from '../../services/api';
import type { PaymentInstructionsData } from '../../types/reminders';

export interface PaymentInstructionsNoticeModalProps {
  open: boolean;
  onClose: () => void;
  data: PaymentInstructionsData | null;
  loading?: boolean;
}

export const PaymentInstructionsNoticeModal: React.FC<PaymentInstructionsNoticeModalProps> = ({
  open,
  onClose,
  data,
  loading = false,
}) => {
  const { notify } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  if (!open) return null;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    notify({
      tone: 'success',
      title: 'Copié dans le presse-papier',
      description: `${fieldName} a été copié avec succès.`,
    });
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      await remindersApi.downloadPaymentInstructionsPdf(
        data.invoice.id,
        data.invoice.reference
      );
      notify({
        tone: 'success',
        title: 'Téléchargement réussi',
        description: `La notice de paiement pour ${data.invoice.reference} a été téléchargée.`,
      });
    } catch {
      notify({
        tone: 'error',
        title: 'Erreur de téléchargement',
        description: 'Impossible de télécharger la notice PDF.',
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-xl shadow-2xl border border-[var(--color-border)] w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Top Action Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-white">
                Notice d'Instructions de Paiement (Document PDF Officiel)
              </h2>
              <p className="text-[11px] text-slate-300">
                Joint automatiquement aux relances avec la facture originale
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition"
              title="Imprimer ce document"
            >
              <Printer className="w-4 h-4" />
            </button>
            <Button
              variant="secondary"
              size="sm"
              loading={downloading}
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleDownloadPdf}
              className="hidden sm:inline-flex"
            >
              Télécharger PDF
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Body (Printable Area) */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 bg-slate-50/50 print:p-0 print:bg-white text-slate-900">
          {loading || !data ? (
            <div className="py-20 text-center text-sm text-slate-500">
              Chargement de la notice de paiement…
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 shadow-sm space-y-6 print:border-none print:shadow-none">
              {/* Official Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200">
                <div className="space-y-1">
                  <div className="inline-block px-2.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold uppercase tracking-wider">
                    Notice de Règlement & Encaissement
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    {data.organization.name}
                  </h1>
                  <p className="text-xs text-slate-500">
                    {data.organization.taxId && <span>N° IFU : {data.organization.taxId} · </span>}
                    {data.organization.address}
                  </p>
                  <p className="text-xs text-slate-500">
                    Email : {data.organization.email} · Tél : {data.organization.phone}
                  </p>
                </div>

                <div className="sm:text-right space-y-1 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded border sm:border-0 border-slate-200">
                  <span className="text-xs text-slate-500 block">Référence créance</span>
                  <span className="font-mono text-base font-bold text-blue-600 block">
                    {data.invoice.reference}
                  </span>
                  <span className="text-xs text-slate-600 block">
                    Émise le {formatDate(data.invoice.issueDate)}
                  </span>
                  <span className="text-xs text-rose-600 font-medium block">
                    Échéance échue le {formatDate(data.invoice.dueDate)} ({data.invoice.delayDays} j de retard)
                  </span>
                </div>
              </div>

              {/* Debtor & Amount Highlight */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center p-4 rounded-lg bg-blue-50/70 border border-blue-200">
                <div className="md:col-span-7 space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-800">
                    Destinataire / Débiteur
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    {data.client.name}
                  </h3>
                  <div className="text-xs text-slate-600 flex flex-wrap gap-x-3">
                    {data.client.email && <span>Email : {data.client.email}</span>}
                    {data.client.phone && <span>Tél : {data.client.phone}</span>}
                  </div>
                </div>

                <div className="md:col-span-5 md:text-right pt-2 md:pt-0 border-t md:border-t-0 border-blue-200">
                  <span className="text-xs text-slate-600 block">Montant restant à régler</span>
                  <span className="font-display text-2xl sm:text-3xl font-bold text-slate-950 tabular-amount block">
                    {formatCurrency(data.invoice.remainingAmount, data.invoice.currency)}
                  </span>
                </div>
              </div>

              {/* Payment Methods Grid with QR Code */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* QR Code Block */}
                <div className="md:col-span-5 flex flex-col items-center justify-center p-5 rounded-lg border border-slate-200 bg-slate-50 text-center space-y-3">
                  <DynamicQRCode
                    value={data.qrCodePayload}
                    size={140}
                    showScanLabel={false}
                  />
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-900 flex items-center justify-center gap-1">
                      <QrCode className="w-3.5 h-3.5 text-blue-600" /> Scanner pour régler
                    </span>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Compatible MTN MoMo, Moov Money, Ecobank Mobile et applications bancaires.
                    </p>
                  </div>
                </div>

                {/* Account Details Block */}
                <div className="md:col-span-7 space-y-4">
                  {/* Bank Details */}
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <Banknote className="w-4 h-4 text-emerald-600" /> Virement Bancaire
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(data.organization.ibanOrRib, 'Le RIB / IBAN')}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
                      >
                        {copiedField === 'Le RIB / IBAN' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" /> Copié
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copier
                          </>
                        )}
                      </button>
                    </div>
                    <div className="text-xs space-y-1">
                      <p className="text-slate-600">
                        Banque : <strong className="text-slate-900">{data.organization.bankName}</strong>
                      </p>
                      <p className="font-mono text-xs text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200 select-all">
                        {data.organization.ibanOrRib}
                      </p>
                      <p className="text-slate-500 text-[11px]">
                        Bénéficiaire : {data.organization.name}
                      </p>
                    </div>
                  </div>

                  {/* MoMo Details */}
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <Smartphone className="w-4 h-4 text-amber-600" /> Mobile Money (MoMo)
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(data.organization.mobileMoneyMerchant, 'Le compte Mobile Money')
                        }
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
                      >
                        {copiedField === 'Le compte Mobile Money' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" /> Copié
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copier
                          </>
                        )}
                      </button>
                    </div>
                    <div className="text-xs space-y-1">
                      <p className="font-mono text-xs text-slate-900 bg-amber-50/80 px-2 py-1 rounded border border-amber-200 select-all">
                        {data.organization.mobileMoneyMerchant}
                      </p>
                      <p className="text-slate-500 text-[11px]">
                        Réseaux acceptés : MTN Mobile Money, Moov Money, Wave
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Crucial Payment Reference Instructions */}
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-300 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                  CONSIGNE IMPÉRATIVE POUR VOTRE RÈGLEMENT
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  Mentionnez impérativement la référence{' '}
                  <span className="font-mono font-bold bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-950">
                    {data.invoice.reference}
                  </span>{' '}
                  dans le libellé de votre virement ou en motif de transfert Mobile Money. Cette indication est indispensable pour assurer l'affectation immédiate des fonds et la clôture de la relance.
                </p>
              </div>

              {/* Clear Steps to Follow After Payment */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  Que faire après votre paiement ? (3 étapes simples)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {data.postPaymentSteps.map((step) => (
                    <div
                      key={step.step}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1"
                    >
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-xs">
                        {step.step}
                      </span>
                      <h5 className="text-xs font-bold text-slate-900">{step.title}</h5>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Note */}
              <div className="pt-4 border-t border-slate-200 text-center text-[11px] text-slate-500 space-y-1">
                <p>
                  Ce document est délivré pour valoir notice officielle de règlement. En cas de contestation ou de difficulté, contactez sans délai le service recouvrement à{' '}
                  <a href={`mailto:${data.organization.email}`} className="text-blue-600 underline">
                    {data.organization.email}
                  </a>.
                </p>
                <p className="text-slate-400">
                  Émis par la plateforme Recouvrix · Traçabilité sécurisée
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-[var(--color-border)] flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Notice PDF générée dynamiquement avec QR code et coordonnées officielles</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Fermer l'aperçu
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              loading={downloading}
              onClick={handleDownloadPdf}
            >
              Télécharger la notice PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
