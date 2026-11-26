import React, { useCallback, useEffect, useState } from 'react';
import {
  Banknote,
  Building,
  CheckCircle2,
  CreditCard,
  FileText,
  Lock,
  RefreshCw,
  Save,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import {
  AlertBanner,
  Button,
  Input,
  Tabs,
  useToast,
} from '../components/ui';
import { settingsApi } from '../services/api';
import type { AuthUser } from '../types/auth';
import type { OrganizationSettings } from '../types/settings';

export interface SettingsPageProps {
  currentUser?: AuthUser | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ currentUser }) => {
  const { notify } = useToast();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<string>('organization');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [settings, setSettings] = useState<OrganizationSettings>({
    id: 'org-default',
    name: 'Alpha Logistique & Services SA',
    taxId: 'IFU-0202410984920',
    address: 'Avenue Jean-Paul II, Cotonou, République du Bénin',
    email: 'contact@alphalogistique.bj',
    phone: '+229 21 30 40 50',
    currency: 'XOF',
    bankName: 'Société Générale Bénin',
    ibanOrRib: 'BJ061 01001 001234567890 45',
    mobileMoneyMerchant: 'MTN MoMo Marchand 884192 (+229 97 00 00 00)',
    paymentInstructions: 'Toujours mentionner la référence de la facture en motif de virement.',
    autoVerifyThreshold: 500000,
    gracePeriodDays: 3,
    autoSuspendOnDispute: true,
    aiAssistanceEnabled: true,
  });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsApi.get();
      if (data) {
        setSettings(data);
      }
    } catch {
      notify({
        tone: 'error',
        title: 'Erreur',
        description: 'Impossible de charger la configuration.',
      });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      notify({
        tone: 'warning',
        title: 'Accès restreint',
        description: 'Seuls les administrateurs ont le droit de modifier les paramètres.',
      });
      return;
    }

    setSaving(true);
    try {
      const updated = await settingsApi.update(settings);
      setSettings(updated);
      notify({
        tone: 'success',
        title: 'Paramètres enregistrés',
        description: 'Les coordonnées et règles de recouvrement ont été mises à jour.',
      });
    } catch {
      notify({
        tone: 'error',
        title: 'Erreur d’enregistrement',
        description: 'Échec de la sauvegarde des paramètres.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {!isAdmin && (
        <AlertBanner
          tone="info"
          title="Mode consultation"
          description="Vous consultez les paramètres de l’organisation en lecture seule. Les modifications nécessitent les privilèges d’administrateur."
        />
      )}

      {/* Tabs */}
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-3 shadow-sm">
        <Tabs
          variant="segmented"
          items={[
            { id: 'organization', label: 'Organisation & Légal' },
            { id: 'banking', label: 'Coordonnées d’encaissement' },
            { id: 'rules', label: 'Règles de recouvrement & IA' },
          ]}
          activeId={activeTab}
          onChange={(tab) => setActiveTab(tab)}
        />
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Tab 1: Organization & Legal */}
        {activeTab === 'organization' && (
          <div className="bg-white border border-[var(--color-border)] rounded-lg p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[var(--color-border)]">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--color-ink)]">
                  Identité de l’entreprise
                </h3>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  Informations légales et raison sociale figurant sur les documents officiels.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] mb-1">
                  Raison sociale
                </label>
                <Input
                  value={settings.name}
                  disabled={!isAdmin || loading}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className="w-full font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] mb-1">
                  Numéro IFU / Immatriculation fiscale
                </label>
                <Input
                  value={settings.taxId}
                  disabled={!isAdmin || loading}
                  onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
                  className="w-full font-mono"
                  placeholder="Ex : IFU-0202410984920"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] mb-1">
                  Adresse du siège
                </label>
                <Input
                  value={settings.address}
                  disabled={!isAdmin || loading}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  className="w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] mb-1">
                  Email officiel de recouvrement
                </label>
                <Input
                  type="email"
                  value={settings.email}
                  disabled={!isAdmin || loading}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  className="w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] mb-1">
                  Téléphone / Standard
                </label>
                <Input
                  value={settings.phone}
                  disabled={!isAdmin || loading}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] mb-1">
                  Devise monétaire par défaut
                </label>
                <Input
                  value={settings.currency}
                  disabled={true}
                  className="w-full font-mono bg-slate-100 text-slate-600"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Franc CFA (BCEAO - XOF)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Banking & Payment Coordinates */}
        {activeTab === 'banking' && (
          <div className="bg-white border border-[var(--color-border)] rounded-lg p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[var(--color-border)]">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--color-ink)]">
                  Coordonnées d’encaissement
                </h3>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  Ces informations sont automatiquement injectées dans les relances par email, WhatsApp et lettres de mise en demeure.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] mb-1">
                    Établissement bancaire principal
                  </label>
                  <Input
                    value={settings.bankName}
                    disabled={!isAdmin || loading}
                    onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                    className="w-full"
                    placeholder="Ex : Société Générale Bénin, Ecobank..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] mb-1">
                    IBAN / RIB bancaire
                  </label>
                  <Input
                    value={settings.ibanOrRib}
                    disabled={!isAdmin || loading}
                    onChange={(e) => setSettings({ ...settings, ibanOrRib: e.target.value })}
                    className="w-full font-mono text-xs"
                    placeholder="Ex : BJ061 01001 001234567890 45"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] mb-1 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  Numéro & Compte Marchand Mobile Money
                </label>
                <Input
                  value={settings.mobileMoneyMerchant}
                  disabled={!isAdmin || loading}
                  onChange={(e) => setSettings({ ...settings, mobileMoneyMerchant: e.target.value })}
                  className="w-full font-medium"
                  placeholder="Ex : MTN MoMo Marchand 884192 (+229 97 00 00 00)"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] mb-1">
                  Consigne standard de virement
                </label>
                <textarea
                  rows={3}
                  value={settings.paymentInstructions}
                  disabled={!isAdmin || loading}
                  onChange={(e) => setSettings({ ...settings, paymentInstructions: e.target.value })}
                  className="w-full rounded-md border border-[var(--color-border)] p-3 text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="Instructions à communiquer au client pour faciliter le rapprochement bancaire..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Recovery Rules & AI */}
        {activeTab === 'rules' && (
          <div className="bg-white border border-[var(--color-border)] rounded-lg p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[var(--color-border)]">
              <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--color-ink)]">
                  Règles de recouvrement
                </h3>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  Suspension des relances, délais et aide à la rédaction des messages.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-sm text-slate-900">
                    Suspension automatique des relances en cas de litige
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Empêche la génération et l’expédition de relances automatiques dès qu’une contestation commerciale ou une divergence de facturation est ouverte.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoSuspendOnDispute}
                  disabled={!isAdmin || loading}
                  onChange={(e) =>
                    setSettings({ ...settings, autoSuspendOnDispute: e.target.checked })
                  }
                  className="w-5 h-5 text-blue-600 rounded mt-0.5"
                />
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-sm text-slate-900">
                    Aide à la rédaction des relances
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Propose un texte de relance à partir du solde, de l’échéance et du canal. La validation reste humaine.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.aiAssistanceEnabled}
                  disabled={!isAdmin || loading}
                  onChange={(e) =>
                    setSettings({ ...settings, aiAssistanceEnabled: e.target.checked })
                  }
                  className="w-5 h-5 text-blue-600 rounded mt-0.5"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] mb-1">
                    Délai de grâce avant première relance (jours)
                  </label>
                  <Input
                    type="number"
                    value={settings.gracePeriodDays}
                    disabled={!isAdmin || loading}
                    onChange={(e) =>
                      setSettings({ ...settings, gracePeriodDays: Number(e.target.value) })
                    }
                    min={0}
                    max={30}
                    className="w-full font-mono"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Nombre de jours accordés après échéance avant le premier rappel.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] mb-1">
                    Seuil de vérification renforcée (FCFA)
                  </label>
                  <Input
                    type="number"
                    value={settings.autoVerifyThreshold}
                    disabled={!isAdmin || loading}
                    onChange={(e) =>
                      setSettings({ ...settings, autoVerifyThreshold: Number(e.target.value) })
                    }
                    min={0}
                    step={10000}
                    className="w-full font-mono"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Tout paiement supérieur à ce montant exige impérativement un justificatif bancaire vérifié.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action bar */}
        {isAdmin && (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <Button
              type="button"
              variant="secondary"
              onClick={loadSettings}
              disabled={saving}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              icon={<Save className="w-4 h-4" />}
            >
              Enregistrer les modifications
            </Button>
          </div>
        )}
      </form>
    </div>
  );
};
