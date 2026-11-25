import React, { useEffect, useState } from 'react';
import {
  AlertBanner,
  Button,
  Checkbox,
  Input,
  Select,
  SideDrawer,
  Textarea,
} from '../ui';
import { ApiError } from '../../services/api';
import type {
  ClientCreatePayload,
  ClientDetail,
  ClientType,
  ClientUpdatePayload,
  PreferredChannel,
} from '../../types/clients';

export interface ClientFormDrawerProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialClient?: ClientDetail | null;
  onClose: () => void;
  onSubmit: (payload: ClientCreatePayload | ClientUpdatePayload) => Promise<void>;
}

const CLIENT_TYPE_OPTIONS: Array<{ value: ClientType; label: string }> = [
  { value: 'COMPANY', label: 'Entreprise / Société' },
  { value: 'INDIVIDUAL', label: 'Particulier / Indépendant' },
];

const CHANNEL_OPTIONS: Array<{ value: PreferredChannel; label: string }> = [
  { value: 'EMAIL', label: 'Courrier électronique (E-mail)' },
  { value: 'WHATSAPP', label: 'Messagerie WhatsApp' },
  { value: 'PHONE', label: 'Appel téléphonique' },
];

export const ClientFormDrawer: React.FC<ClientFormDrawerProps> = ({
  open,
  mode,
  initialClient,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [clientType, setClientType] = useState<ClientType>('COMPANY');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryContact, setSecondaryContact] = useState('');
  const [notes, setNotes] = useState('');
  const [preferredChannel, setPreferredChannel] = useState<PreferredChannel>('EMAIL');
  const [contactAllowed, setContactAllowed] = useState(true);
  const [contactHours, setContactHours] = useState('');
  const [restrictionsNote, setRestrictionsNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setNameError(null);
    setEmailError(null);

    if (mode === 'edit' && initialClient) {
      setName(initialClient.name);
      setClientType(initialClient.clientType);
      setTaxId(initialClient.taxId ?? '');
      setAddress(initialClient.address ?? '');
      setContactName(initialClient.contactName ?? '');
      setEmail(initialClient.email ?? '');
      setPhone(initialClient.phone ?? '');
      setSecondaryContact(initialClient.secondaryContact ?? '');
      setNotes(initialClient.notes ?? '');
      setPreferredChannel(initialClient.communicationPreferences.preferredChannel);
      setContactAllowed(initialClient.communicationPreferences.contactAllowed);
      setContactHours(initialClient.communicationPreferences.contactHours ?? '');
      setRestrictionsNote(initialClient.communicationPreferences.restrictionsNote ?? '');
    } else {
      setName('');
      setClientType('COMPANY');
      setTaxId('');
      setAddress('');
      setContactName('');
      setEmail('');
      setPhone('');
      setSecondaryContact('');
      setNotes('');
      setPreferredChannel('EMAIL');
      setContactAllowed(true);
      setContactHours('');
      setRestrictionsNote('');
    }
  }, [open, mode, initialClient]);

  const validate = (): boolean => {
    let valid = true;
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setNameError('Veuillez saisir un nom ou une raison sociale (2 caractères minimum).');
      valid = false;
    } else {
      setNameError(null);
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Veuillez saisir une adresse e-mail valide.');
      valid = false;
    } else {
      setEmailError(null);
    }

    return valid;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const payload: ClientCreatePayload = {
      name: name.trim(),
      clientType,
      taxId: taxId.trim() || null,
      address: address.trim() || null,
      contactName: contactName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      secondaryContact: secondaryContact.trim() || null,
      notes: notes.trim() || null,
      communicationPreferences: {
        preferredChannel,
        contactAllowed,
        contactHours: contactHours.trim() || null,
        restrictionsNote: restrictionsNote.trim() || null,
      },
    };

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Impossible d’enregistrer cette fiche client pour le moment.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formId = 'recouvrix-client-form';

  return (
    <SideDrawer
      open={open}
      size="lg"
      title={mode === 'create' ? 'Nouveau client' : 'Modifier la fiche client'}
      subtitle={
        mode === 'create'
          ? 'Centralisez les coordonnées, informations légales et préférences de contact.'
          : initialClient?.name
      }
      onClose={() => {
        if (!submitting) onClose();
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>
            {mode === 'create' ? 'Créer le client' : 'Enregistrer les modifications'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-6" noValidate>
        {formError && (
          <AlertBanner
            tone="error"
            title="Enregistrement impossible"
            description={formError}
          />
        )}

        {/* Section 1 : Informations générales */}
        <section className="space-y-4">
          <div className="pb-2 border-b border-[var(--color-border)]">
            <h3 className="text-[14px] font-semibold text-[var(--color-ink)]">
              Informations générales
            </h3>
            <p className="text-[12px] text-[var(--color-ink-muted)]">
              Identification juridique et localisation du dossier client.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Nom ou raison sociale"
                placeholder="Ex. Atlantique Négoce SARL"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={nameError ?? undefined}
                required
                disabled={submitting}
              />
            </div>

            <Select
              label="Type de client"
              value={clientType}
              onChange={(e) => setClientType(e.target.value as ClientType)}
              options={CLIENT_TYPE_OPTIONS}
              disabled={submitting}
            />

            <Input
              label="Identifiant fiscal (IFU / RCCM)"
              placeholder="Ex. IFU 3201800451209"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              disabled={submitting}
            />

            <div className="sm:col-span-2">
              <Input
                label="Adresse postale / Siège"
                placeholder="Ex. Rue 104, Zone Portuaire, Cotonou"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="sm:col-span-2">
              <Textarea
                label="Notes internes sur le dossier"
                placeholder="Contexte de facturation, interlocuteur comptable ou consignes internes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={submitting}
              />
            </div>
          </div>
        </section>

        {/* Section 2 : Coordonnées */}
        <section className="space-y-4">
          <div className="pb-2 border-b border-[var(--color-border)]">
            <h3 className="text-[14px] font-semibold text-[var(--color-ink)]">Coordonnées</h3>
            <p className="text-[12px] text-[var(--color-ink-muted)]">
              Interlocuteur référent et canaux directs pour le suivi des créances.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Personne de contact référente"
                placeholder="Ex. Mireille Kpodonu"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                disabled={submitting}
              />
            </div>

            <Input
              label="Adresse e-mail"
              type="email"
              placeholder="compta@entreprise.bj"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError ?? undefined}
              disabled={submitting}
            />

            <Input
              label="Téléphone principal"
              type="tel"
              placeholder="+229 01 97 12 34 56"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting}
            />

            <div className="sm:col-span-2">
              <Input
                label="Contact secondaire (nom, service ou numéro)"
                placeholder="Ex. Direction financière · +229 01 96 00 11 22"
                value={secondaryContact}
                onChange={(e) => setSecondaryContact(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
        </section>

        {/* Section 3 : Préférences de communication */}
        <section className="space-y-4">
          <div className="pb-2 border-b border-[var(--color-border)]">
            <h3 className="text-[14px] font-semibold text-[var(--color-ink)]">
              Préférences de communication
            </h3>
            <p className="text-[12px] text-[var(--color-ink-muted)]">
              Règles à respecter lors des prises de contact et des relances.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Canal privilégié"
              value={preferredChannel}
              onChange={(e) => setPreferredChannel(e.target.value as PreferredChannel)}
              options={CHANNEL_OPTIONS}
              disabled={submitting}
            />

            <Input
              label="Plages horaires souhaitées"
              placeholder="Ex. Lun–Ven · 09h00–16h00"
              value={contactHours}
              onChange={(e) => setContactHours(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="p-3.5 rounded-md bg-[var(--color-canvas)] border border-[var(--color-border)]">
            <Checkbox
              label="Autoriser les prises de contact et relances pour ce client"
              description="Décochez uniquement si le client a demandé une suspension temporaire ou un passage exclusif par un intermédiaire."
              checked={contactAllowed}
              onChange={(e) => setContactAllowed(e.target.checked)}
              disabled={submitting}
            />
          </div>

          <Textarea
            label="Restrictions ou consignes de relance"
            placeholder="Ex. Joindre systématiquement le relevé de compte avant tout appel."
            value={restrictionsNote}
            onChange={(e) => setRestrictionsNote(e.target.value)}
            rows={2}
            disabled={submitting}
          />
        </section>
      </form>
    </SideDrawer>
  );
};
