import React, { useEffect, useState } from 'react';
import { FileUp } from 'lucide-react';
import {
  AlertBanner,
  Button,
  Checkbox,
  Input,
  Select,
  SideDrawer,
  Textarea,
} from '../ui';
import { formatCurrency } from '../../design-system/formatters';
import { ApiError } from '../../services/api';
import type {
  CreditNoteCreatePayload,
  DisputeCategory,
  DisputeCreatePayload,
  DisputeStatus,
  DisputeUpdatePayload,
  InvoiceDetail,
  InvoiceDispute,
  InvoiceDocumentType,
  InvoicePromise,
  PromiseCreatePayload,
  PromiseStatus,
  PromiseUpdatePayload,
} from '../../types/invoices';

export const DISPUTE_CATEGORY_OPTIONS: Array<{ value: DisputeCategory; label: string }> = [
  { value: 'QUANTITY_DISCREPANCY', label: 'Écart de quantité livrée' },
  { value: 'PRICING_ERROR', label: 'Erreur de tarif ou de facturation' },
  { value: 'QUALITY_ISSUE', label: 'Non-conformité / Qualité' },
  { value: 'ALREADY_PAID', label: 'Règlement déjà effectué selon le client' },
  { value: 'MISSING_DOCUMENT', label: 'Pièce justificative ou bon de commande manquant' },
  { value: 'OTHER', label: 'Autre motif de contestation' },
];

export const DOCUMENT_TYPE_OPTIONS: Array<{ value: InvoiceDocumentType; label: string }> = [
  { value: 'ORIGINAL_INVOICE', label: 'Facture originale' },
  { value: 'CREDIT_NOTE', label: 'Avoir ou note de crédit' },
  { value: 'JUSTIFICATIF_PAIEMENT', label: 'Justificatif de paiement' },
  { value: 'DISPUTE_EVIDENCE', label: 'Pièce justificative de litige' },
  { value: 'SUPPORTING_DOC', label: 'Pièce complémentaire' },
];

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.csv', '.xlsx'];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/* -------------------------------------------------------------------------- */
/* 1. Édition de l'objet / description non financière                         */
/* -------------------------------------------------------------------------- */

interface MetadataEditDrawerProps {
  open: boolean;
  invoice: InvoiceDetail;
  onClose: () => void;
  onSubmit: (description: string | null) => Promise<void>;
}

export const MetadataEditDrawer: React.FC<MetadataEditDrawerProps> = ({
  open,
  invoice,
  onClose,
  onSubmit,
}) => {
  const [description, setDescription] = useState(invoice.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDescription(invoice.description ?? '');
      setError(null);
    }
  }, [open, invoice]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(description.trim() || null);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible d’enregistrer la description de cette facture.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SideDrawer
      open={open}
      title={`Modifier l’objet · ${invoice.reference}`}
      subtitle={invoice.clientName}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button type="submit" form="invoice-metadata-form" loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="invoice-metadata-form" onSubmit={handleSave} className="space-y-4">
        <AlertBanner
          tone="info"
          title="Périmètre strict du recouvrement"
          description="Seul l’objet descriptif de la facture peut être complété ici. Les montants et dates contractuelles sont protégés et dérivent uniquement des paiements confirmés et avoirs validés."
        />

        {error && <AlertBanner tone="error" title="Modification refusée" description={error} />}

        <Textarea
          label="Objet / Description de la créance"
          rows={5}
          placeholder="Ex. : Prestation de transport maritime — Lot de mars 2026"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          helperText="Cette description apparaît dans le détail du dossier et facilite l’analyse des relances."
        />
      </form>
    </SideDrawer>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. Déclaration et suivi d'un litige                                        */
/* -------------------------------------------------------------------------- */

interface DisputeDrawerProps {
  open: boolean;
  invoice: InvoiceDetail;
  editingDispute: InvoiceDispute | null;
  onClose: () => void;
  onCreate: (payload: DisputeCreatePayload) => Promise<void>;
  onUpdate: (disputeId: string, payload: DisputeUpdatePayload) => Promise<void>;
}

export const DisputeFormDrawer: React.FC<DisputeDrawerProps> = ({
  open,
  invoice,
  editingDispute,
  onClose,
  onCreate,
  onUpdate,
}) => {
  const isEdit = Boolean(editingDispute);
  const [category, setCategory] = useState<DisputeCategory>('OTHER');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<DisputeStatus>('IN_REVIEW');
  const [resolutionNote, setResolutionNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editingDispute) {
        setCategory((editingDispute.category as DisputeCategory) || 'OTHER');
        setReason(editingDispute.reason);
        setStatus(editingDispute.status);
        setResolutionNote(editingDispute.resolutionNote ?? '');
      } else {
        setCategory('QUANTITY_DISCREPANCY');
        setReason('');
        setStatus('OPEN');
        setResolutionNote('');
      }
      setError(null);
    }
  }, [open, editingDispute]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (reason.trim().length < 4) {
      setError('Veuillez préciser le motif détaillé du litige (4 caractères minimum).');
      return;
    }

    setSaving(true);
    try {
      if (isEdit && editingDispute) {
        await onUpdate(editingDispute.id, {
          status,
          category,
          reason: reason.trim(),
          resolutionNote: resolutionNote.trim() || null,
        });
      } else {
        await onCreate({
          category,
          reason: reason.trim(),
        });
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible d’enregistrer le litige pour cette facture.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SideDrawer
      open={open}
      title={
        isEdit
          ? `Mettre à jour le litige · ${invoice.reference}`
          : `Déclarer un litige · ${invoice.reference}`
      }
      subtitle={`${invoice.clientName} · Solde dû : ${formatCurrency(invoice.remainingAmount)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button type="submit" form="dispute-form" loading={saving}>
            {isEdit ? 'Enregistrer la mise à jour' : 'Déclarer le litige'}
          </Button>
        </>
      }
    >
      <form id="dispute-form" onSubmit={handleSubmit} className="space-y-4">
        <AlertBanner
          tone={isEdit && (status === 'RESOLVED' || status === 'CANCELLED') ? 'info' : 'warning'}
          title={
            isEdit && (status === 'RESOLVED' || status === 'CANCELLED')
              ? 'Clôture contrôlée du litige'
              : 'Suspension des relances automatiques'
          }
          description={
            isEdit && (status === 'RESOLVED' || status === 'CANCELLED')
              ? 'La clôture du litige lève la mention de contestation sur la créance, mais ne déclenche jamais de relance automatique sans votre validation.'
              : 'Tant qu’un litige est ouvert ou en cours d’instruction, la créance reste comptabilisée dans les créances ouvertes et toutes les relances automatiques sont suspendues.'
          }
        />

        {error && <AlertBanner tone="error" title="Validation impossible" description={error} />}

        <Select
          label="Catégorie de contestation"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value as DisputeCategory)}
          options={DISPUTE_CATEGORY_OPTIONS}
        />

        {isEdit && (
          <Select
            label="Statut du litige"
            required
            value={status}
            onChange={(e) => setStatus(e.target.value as DisputeStatus)}
            options={[
              { value: 'OPEN', label: 'Ouvert (relances suspendues)' },
              { value: 'IN_REVIEW', label: 'En cours d’instruction (relances suspendues)' },
              { value: 'RESOLVED', label: 'Résolu / Clôturé' },
              { value: 'CANCELLED', label: 'Annulé / Sans suite' },
            ]}
          />
        )}

        <Textarea
          label="Motif détaillé du litige"
          required
          rows={4}
          placeholder="Décrivez précisément la contestation soulevée par le client et les pièces attendues…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        {isEdit && (
          <Textarea
            label="Note de résolution ou d’instruction"
            rows={3}
            placeholder="Commentaire de suivi ou décision finale…"
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
          />
        )}
      </form>
    </SideDrawer>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. Enregistrement et suivi d'une promesse de paiement                      */
/* -------------------------------------------------------------------------- */

interface PromiseDrawerProps {
  open: boolean;
  invoice: InvoiceDetail;
  editingPromise: InvoicePromise | null;
  onClose: () => void;
  onCreate: (payload: PromiseCreatePayload) => Promise<void>;
  onUpdate: (promiseId: string, payload: PromiseUpdatePayload) => Promise<void>;
}

export const PromiseFormDrawer: React.FC<PromiseDrawerProps> = ({
  open,
  invoice,
  editingPromise,
  onClose,
  onCreate,
  onUpdate,
}) => {
  const isEdit = Boolean(editingPromise);
  const [promisedAmount, setPromisedAmount] = useState(String(invoice.remainingAmount || 0));
  const [promisedDate, setPromisedDate] = useState(invoice.referenceDate);
  const [status, setStatus] = useState<PromiseStatus>('ACTIVE');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editingPromise) {
        setPromisedAmount(String(editingPromise.promisedAmount));
        setPromisedDate(editingPromise.promisedDate);
        setStatus(editingPromise.status);
        setNote(editingPromise.note ?? '');
      } else {
        setPromisedAmount(String(invoice.remainingAmount || 0));
        setPromisedDate(invoice.referenceDate);
        setStatus('ACTIVE');
        setNote('');
      }
      setError(null);
    }
  }, [open, editingPromise, invoice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEdit) {
      const parsedAmount = Math.round(Number(promisedAmount));
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setError('Veuillez saisir un montant promis strictement positif.');
        return;
      }
      if (parsedAmount > invoice.remainingAmount) {
        setError('Le montant promis ne peut pas dépasser le solde restant dû de la facture.');
        return;
      }
      if (!promisedDate) {
        setError('Veuillez indiquer la date de règlement annoncée.');
        return;
      }
    }

    setSaving(true);
    try {
      if (isEdit && editingPromise) {
        await onUpdate(editingPromise.id, {
          status,
          note: note.trim() || null,
        });
      } else {
        await onCreate({
          promisedAmount: Math.round(Number(promisedAmount)),
          promisedDate,
          note: note.trim() || null,
        });
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible d’enregistrer cette promesse de paiement.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SideDrawer
      open={open}
      title={
        isEdit
          ? `Évaluer la promesse · ${invoice.reference}`
          : `Enregistrer une promesse · ${invoice.reference}`
      }
      subtitle={`${invoice.clientName} · Solde restant dû : ${formatCurrency(
        invoice.remainingAmount
      )}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button type="submit" form="promise-form" loading={saving}>
            {isEdit ? 'Mettre à jour le suivi' : 'Enregistrer la promesse'}
          </Button>
        </>
      }
    >
      <form id="promise-form" onSubmit={handleSubmit} className="space-y-4">
        <AlertBanner
          tone="info"
          title="Règle de prudence financière"
          description="Une promesse de paiement sert au suivi des engagements du client. Elle ne déduit jamais le solde restant dû et ne marque jamais la facture comme soldée avant la confirmation réelle du règlement."
        />

        {error && <AlertBanner tone="error" title="Enregistrement impossible" description={error} />}

        {!isEdit ? (
          <>
            <Input
              label="Montant promis (FCFA)"
              type="number"
              min={1}
              max={invoice.remainingAmount}
              step={1}
              required
              value={promisedAmount}
              onChange={(e) => setPromisedAmount(e.target.value)}
              helperText={`Maximum autorisé : ${formatCurrency(invoice.remainingAmount)}`}
            />
            <Input
              label="Date prévue de paiement"
              type="date"
              required
              value={promisedDate}
              onChange={(e) => setPromisedDate(e.target.value)}
            />
          </>
        ) : (
          <>
            <div className="p-3.5 rounded-md bg-[var(--color-canvas)] border border-[var(--color-border)] flex items-center justify-between text-[13px]">
              <span className="text-[var(--color-ink-muted)]">Engagement initial</span>
              <span className="font-semibold tabular-amount text-[var(--color-ink)]">
                {formatCurrency(editingPromise?.promisedAmount ?? 0)} pour le{' '}
                {editingPromise?.promisedDate}
              </span>
            </div>
            <Select
              label="Évaluation de la promesse"
              required
              value={status}
              onChange={(e) => setStatus(e.target.value as PromiseStatus)}
              options={[
                { value: 'ACTIVE', label: 'En attente de règlement' },
                { value: 'KEPT', label: 'Respectée (constatée côté client)' },
                { value: 'BROKEN', label: 'Non respectée (échéance dépassée)' },
                { value: 'CANCELLED', label: 'Annulée' },
              ]}
            />
          </>
        )}

        <Textarea
          label="Commentaire de suivi"
          rows={3}
          placeholder="Précisions sur l’engagement du client (mode de virement annoncé, interlocuteur…)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </form>
    </SideDrawer>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. Enregistrement d'un avoir / régularisation                              */
/* -------------------------------------------------------------------------- */

interface CreditNoteDrawerProps {
  open: boolean;
  invoice: InvoiceDetail;
  onClose: () => void;
  onSubmit: (payload: CreditNoteCreatePayload) => Promise<void>;
}

export const CreditNoteFormDrawer: React.FC<CreditNoteDrawerProps> = ({
  open,
  invoice,
  onClose,
  onSubmit,
}) => {
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [validateNow, setValidateNow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const nextNum = (invoice.creditNotes || []).length + 1;
      setReference(`AV-${invoice.reference.replace(/^FAC-/, '')}-${nextNum}`);
      setAmount('');
      setReason('');
      setValidateNow(true);
      setError(null);
    }
  }, [open, invoice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = Math.round(Number(amount));
    if (!reference.trim() || reference.trim().length < 2) {
      setError('Veuillez saisir une référence d’avoir valide.');
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Veuillez saisir un montant d’avoir strictement positif.');
      return;
    }
    if (parsed > invoice.remainingAmount) {
      setError(
        'Le montant de l’avoir dépasse le solde restant dû de la facture (solde négatif interdit).'
      );
      return;
    }
    if (reason.trim().length < 4) {
      setError('Veuillez préciser le motif de l’avoir (4 caractères minimum).');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        reference: reference.trim(),
        amount: parsed,
        reason: reason.trim(),
        validateNow,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible d’enregistrer cet avoir sur la facture.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SideDrawer
      open={open}
      title={`Enregistrer un avoir · ${invoice.reference}`}
      subtitle={`${invoice.clientName} · Solde restant dû : ${formatCurrency(
        invoice.remainingAmount
      )}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button type="submit" form="credit-note-form" loading={saving}>
            {validateNow ? 'Enregistrer et valider l’avoir' : 'Enregistrer en brouillon'}
          </Button>
        </>
      }
    >
      <form id="credit-note-form" onSubmit={handleSubmit} className="space-y-4">
        <AlertBanner
          tone="info"
          title="Impact sur le solde de la créance"
          description="Seuls les avoirs validés viennent en déduction du solde restant dû. Un avoir en brouillon reste consultable sans modifier les calculs."
        />

        {error && <AlertBanner tone="error" title="Création impossible" description={error} />}

        <Input
          label="Référence de l’avoir"
          required
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />

        <Input
          label="Montant de l’avoir (FCFA)"
          type="number"
          min={1}
          max={invoice.remainingAmount}
          step={1}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          helperText={`Plafond autorisé sans solde négatif : ${formatCurrency(
            invoice.remainingAmount
          )}`}
        />

        <Textarea
          label="Motif de la régularisation"
          required
          rows={3}
          placeholder="Ex. : Remise commerciale accordée, retour partiel de marchandise, correction de facturation…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <Checkbox
          label="Valider immédiatement cet avoir"
          description="Déduit immédiatement le montant du solde restant dû de la facture."
          checked={validateNow}
          onChange={(e) => setValidateNow(e.target.checked)}
        />
      </form>
    </SideDrawer>
  );
};

/* -------------------------------------------------------------------------- */
/* 5. Ajout d'un document justificatif                                        */
/* -------------------------------------------------------------------------- */

interface DocumentUploadDrawerProps {
  open: boolean;
  invoice: InvoiceDetail;
  onClose: () => void;
  onUpload: (params: {
    docType: InvoiceDocumentType;
    title?: string;
    file: File;
  }) => Promise<void>;
}

export const DocumentUploadDrawer: React.FC<DocumentUploadDrawerProps> = ({
  open,
  invoice,
  onClose,
  onUpload,
}) => {
  const [docType, setDocType] = useState<InvoiceDocumentType>('ORIGINAL_INVOICE');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDocType('ORIGINAL_INVOICE');
      setTitle('');
      setFile(null);
      setError(null);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const chosen = e.target.files?.[0] ?? null;
    if (!chosen) {
      setFile(null);
      return;
    }
    const lowerName = chosen.name.toLowerCase();
    const validExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!validExt) {
      setError(
        'Format de fichier non pris en charge. Formats acceptés : PDF, PNG, JPG, WEBP, CSV ou XLSX.'
      );
      setFile(null);
      return;
    }
    if (chosen.size <= 0) {
      setError('Le fichier sélectionné est vide.');
      setFile(null);
      return;
    }
    if (chosen.size > MAX_UPLOAD_BYTES) {
      setError('La taille du fichier dépasse la limite autorisée de 10 Mo.');
      setFile(null);
      return;
    }
    setFile(chosen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError('Veuillez sélectionner un fichier à joindre.');
      return;
    }

    setUploading(true);
    try {
      await onUpload({
        docType,
        title: title.trim() || undefined,
        file,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible d’enregistrer ce document sur la facture.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <SideDrawer
      open={open}
      title={`Joindre un document · ${invoice.reference}`}
      subtitle={invoice.clientName}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={uploading}>
            Annuler
          </Button>
          <Button type="submit" form="document-upload-form" loading={uploading}>
            Joindre le document
          </Button>
        </>
      }
    >
      <form id="document-upload-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <AlertBanner tone="error" title="Envoi refusé" description={error} />}

        <Select
          label="Type de document"
          required
          value={docType}
          onChange={(e) => setDocType(e.target.value as InvoiceDocumentType)}
          options={DOCUMENT_TYPE_OPTIONS}
        />

        <Input
          label="Intitulé du document (facultatif)"
          placeholder="Ex. : Bon de livraison signé, Facture PDF d’origine…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[var(--color-ink)]">
            Fichier à importer <span className="text-[var(--color-danger)]">*</span>
          </label>
          <label className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-4 py-6 text-center cursor-pointer hover:border-[var(--color-primary)] transition-colors">
            <FileUp className="w-5 h-5 text-[var(--color-ink-muted)]" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="text-[13px] font-medium text-[var(--color-ink)]">
                {file ? file.name : 'Sélectionner un document depuis votre poste'}
              </p>
              <p className="text-[12px] text-[var(--color-ink-muted)]">
                PDF, PNG, JPG, WEBP, CSV ou XLSX · Taille maximale : 10 Mo
              </p>
            </div>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
        </div>
      </form>
    </SideDrawer>
  );
};
