import React, { useState } from 'react';
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  FileCheck2,
  FileSearch,
  FolderOpen,
  History,
  ListChecks,
  MailCheck,
  Menu,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { RecouvrixLogo } from '../components/brand/RecouvrixLogo';
import { Button, RecouvrixStatusKey, StatusBadge } from '../components/ui';
import { formatCurrency, formatDate } from '../design-system/formatters';

export interface LandingPageProps {
  onNavigateToAuth: () => void;
}

interface PreviewRow {
  id: string;
  reference: string;
  client: string;
  dueDate: string;
  amount: number;
  status: RecouvrixStatusKey;
  priority: boolean;
}

const PREVIEW_ROWS: PreviewRow[] = [
  {
    id: 'p1',
    reference: 'FAC-2026-0418',
    client: 'Ateliers Mercier SAS',
    dueDate: '2026-10-28',
    amount: 2450000,
    status: 'overdue',
    priority: true,
  },
  {
    id: 'p2',
    reference: 'FAC-2026-0432',
    client: 'Logistique Valois SARL',
    dueDate: '2026-11-10',
    amount: 875000,
    status: 'pending_verification',
    priority: true,
  },
  {
    id: 'p3',
    reference: 'FAC-2026-0441',
    client: 'Établissements Moreau',
    dueDate: '2026-11-14',
    amount: 1320000,
    status: 'promise',
    priority: false,
  },
  {
    id: 'p4',
    reference: 'FAC-2026-0459',
    client: 'Cabinet Renaud & Associés',
    dueDate: '2026-11-20',
    amount: 450000,
    status: 'confirmed',
    priority: false,
  },
];

const PROBLEMS_SOLVED = [
  {
    title: 'Factures impayées difficiles à suivre',
    solution:
      'Centralisez chaque facture importée avec son solde restant dû, son échéance et son niveau de retard calculé automatiquement.',
  },
  {
    title: 'Relances oubliées ou tardives',
    solution:
      'Structurez la préparation des relances selon l’ancienneté des retards et les échéances à venir, sans rupture de suivi.',
  },
  {
    title: 'Informations dispersées',
    solution:
      'Regroupez au sein d’une même fiche client les coordonnées, les préférences de contact, les documents et l’historique des échanges.',
  },
  {
    title: 'Manque de visibilité sur les paiements attendus',
    solution:
      'Distinguez clairement les promesses de règlement, les paiements déclarés avec justificatif et les encaissements confirmés.',
  },
];

const CORE_FEATURES = [
  {
    title: 'Suivi des créances',
    description:
      'Centralisez vos factures et visualisez les montants restant à recouvrer.',
    Icon: FileSearch,
  },
  {
    title: 'Priorisation intelligente',
    description:
      'Identifiez les dossiers qui nécessitent une attention particulière grâce à des recommandations explicables.',
    Icon: SlidersHorizontal,
  },
  {
    title: 'Relances personnalisées',
    description:
      'Préparez des communications adaptées à chaque client par Email ou WhatsApp.',
    Icon: MailCheck,
  },
  {
    title: 'Suivi des paiements',
    description:
      'Suivez les paiements déclarés, les justificatifs et les règlements confirmés.',
    Icon: FileCheck2,
  },
  {
    title: 'Gestion documentaire',
    description:
      'Retrouvez les documents utiles dans les dossiers de vos clients.',
    Icon: FolderOpen,
  },
  {
    title: 'Historique complet',
    description:
      'Conservez une trace des actions et décisions importantes.',
    Icon: History,
  },
];

const WORKFLOW_STEPS = [
  {
    number: '01',
    title: 'Importez vos clients et factures existantes.',
    detail:
      'Intégrez vos fichiers Excel, CSV ou documents PDF avec contrôle des doublons avant enregistrement.',
  },
  {
    number: '02',
    title: 'Analysez et identifiez les créances prioritaires.',
    detail:
      'Repérez rapidement les retards sensibles, les promesses en cours et les dossiers nécessitant une intervention.',
  },
  {
    number: '03',
    title: 'Préparez et validez vos relances.',
    detail:
      'Appuyez-vous sur des suggestions de canal et de message personnalisées tout en gardant la validation finale.',
  },
  {
    number: '04',
    title: 'Suivez les réponses et les paiements.',
    detail:
      'Contrôlez les justificatifs reçus, confirmez les encaissements et mettez à jour les soldes en toute fiabilité.',
  },
];

const AI_CAPABILITIES = [
  'Analyse des dossiers et de l’historique de communication.',
  'Identification des situations nécessitant une attention particulière, comme les litiges ou retards répétés.',
  'Recommandation de priorités avec critères explicables.',
  'Suggestion du canal de communication le plus adapté aux préférences du client.',
  'Préparation de messages personnalisés prêts à être relus avant envoi.',
];

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToAuth }) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'priority'>('all');

  const scrollToSection = (sectionId: string) => {
    setMobileNavOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const visiblePreviewRows =
    previewFilter === 'priority'
      ? PREVIEW_ROWS.filter((row) => row.priority)
      : PREVIEW_ROWS;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-canvas)] text-[var(--color-ink)]">
      {/* Barre de navigation publique */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[var(--color-border)]">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <a
            href="#haut"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label="Accueil Recouvrix"
            className="whitespace-nowrap shrink-0 rounded-md"
          >
            <RecouvrixLogo variant="light" size="sm" />
          </a>

          <nav
            aria-label="Navigation principale"
            className="hidden lg:flex items-center gap-7 text-[14px] font-medium text-[var(--color-ink-secondary)]"
          >
            <a
              href="#fonctionnalites"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('fonctionnalites');
              }}
              className="hover:text-[var(--color-ink)] transition-colors whitespace-nowrap shrink-0"
            >
              Fonctionnalités
            </a>
            <a
              href="#comment-ca-marche"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('comment-ca-marche');
              }}
              className="hover:text-[var(--color-ink)] transition-colors whitespace-nowrap shrink-0"
            >
              Comment ça marche
            </a>
            <a
              href="#avantages"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('avantages');
              }}
              className="hover:text-[var(--color-ink)] transition-colors whitespace-nowrap shrink-0"
            >
              Avantages
            </a>
          </nav>

          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <Button variant="ghost" size="sm" onClick={onNavigateToAuth}>
              Se connecter
            </Button>
            <Button variant="primary" size="sm" onClick={onNavigateToAuth}>
              Créer un compte démo
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            className="lg:hidden p-2 -mr-2 rounded-md text-[var(--color-ink-secondary)] hover:bg-slate-100 hover:text-[var(--color-ink)]"
          >
            {mobileNavOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Menu mobile compact */}
        {mobileNavOpen && (
          <div className="lg:hidden border-t border-[var(--color-border)] bg-white px-4 py-4 space-y-3">
            <nav aria-label="Navigation mobile" className="flex flex-col space-y-1">
              <a
                href="#fonctionnalites"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('fonctionnalites');
                }}
                className="px-3 py-2.5 rounded-md text-[15px] font-medium text-[var(--color-ink)] hover:bg-slate-50"
              >
                Fonctionnalités
              </a>
              <a
                href="#comment-ca-marche"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('comment-ca-marche');
                }}
                className="px-3 py-2.5 rounded-md text-[15px] font-medium text-[var(--color-ink)] hover:bg-slate-50"
              >
                Comment ça marche
              </a>
              <a
                href="#avantages"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('avantages');
                }}
                className="px-3 py-2.5 rounded-md text-[15px] font-medium text-[var(--color-ink)] hover:bg-slate-50"
              >
                Avantages
              </a>
            </nav>
            <div className="pt-2 border-t border-[var(--color-border)] flex flex-col sm:flex-row gap-2.5">
              <Button variant="secondary" fullWidth onClick={onNavigateToAuth}>
                Se connecter
              </Button>
              <Button variant="primary" fullWidth onClick={onNavigateToAuth}>
                Créer un compte démo
              </Button>
            </div>
          </div>
        )}
      </header>

      <main id="haut" className="flex-1">
        {/* 3. Section principale (Hero) avec image de fond en grand et couche de blanc */}
        <section className="relative overflow-hidden border-b border-[var(--color-border)] bg-slate-900">
          {/* Image de fond en grand derrière le texte */}
          <div className="absolute inset-0 z-0">
            <img
              src="/src/assets/images/hero_manager_laptop_1795643251901.jpg"
              alt="Bureau d'entreprise et gestion financière"
              className="w-full h-full object-cover object-[70%_center] scale-105 transform"
              referrerPolicy="no-referrer"
            />
            {/* Voile stratégique : lisibilité à gauche, photo visible à droite */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/88 via-white/55 to-white/15" />
            <div className="absolute inset-y-0 left-0 w-full max-w-3xl bg-gradient-to-r from-white/50 via-white/20 to-transparent" />
          </div>

          <div className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
            <div className="max-w-3xl space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50/90 border border-blue-200 text-blue-800 text-[13px] font-semibold tracking-wide shadow-sm backdrop-blur-sm">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Plateforme B2B SaaS de Recouvrement Intelligent pour Entreprises
              </div>

              <div className="space-y-4">
                <h1 className="font-display text-[38px] sm:text-[52px] lg:text-[60px] font-bold tracking-[-0.03em] leading-[1.08] text-[var(--color-ink)] text-balance">
                  Reprenez le contrôle de vos créances clients.
                </h1>
                <p className="text-[17px] sm:text-[19px] text-[var(--color-ink-secondary)] leading-relaxed max-w-2xl font-normal">
                  Recouvrix centralise vos factures impayées, priorise vos actions et automatise vos relances avec un double document (facture + avis de paiement sécurisé QR code / Mobile Money).
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  icon={<ArrowRight className="w-4 h-4" />}
                  onClick={onNavigateToAuth}
                >
                  Accéder à la plateforme
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => scrollToSection('fonctionnalites')}
                >
                  Découvrir les fonctionnalités
                </Button>
              </div>

              <div className="pt-4 border-t border-slate-200/80 flex flex-wrap items-center gap-6 text-[13px] text-[var(--color-ink-muted)]">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" /> Suivi automatisé des impayés
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" /> Virement & Mobile Money
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" /> Gouvernance Admin & DAF
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Section explicative de l'adoption entreprise & rôles */}
        <section className="bg-slate-50 border-b border-[var(--color-border)] py-12 sm:py-16">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="max-w-2xl space-y-2">
              <h2 className="font-display text-[22px] sm:text-[28px] font-bold text-[var(--color-ink)]">
                Comment Recouvrix s'intègre dans votre entreprise
              </h2>
              <p className="text-[14px] sm:text-[15px] text-[var(--color-ink-secondary)] leading-relaxed">
                Recouvrix n'est pas l'entreprise tierce : c'est <strong>l'outil interne</strong> que votre organisation (PME, cabinet ou direction financière) déploie pour piloter ses créances clients. Deux rôles complémentaires suffisent pour couvrir 100 % des besoins de gestion :
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-[var(--color-border)] rounded-xl p-6 space-y-3 shadow-xs">
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold">
                  DAF
                </div>
                <h3 className="text-base font-semibold text-[var(--color-ink)]">
                  1. Administrateur (Direction Financière)
                </h3>
                <p className="text-xs text-[var(--color-ink-secondary)] leading-relaxed">
                  Le DAF ou gérant configure les paramètres légaux (IFU, adresse), les coordonnées bancaires et Mobile Money d'encaissement, gère les accès des collaborateurs, supervise les volumes globaux et consulte le journal d'audit de sécurité.
                </p>
              </div>

              <div className="bg-white border border-[var(--color-border)] rounded-xl p-6 space-y-3 shadow-xs">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold">
                  REC
                </div>
                <h3 className="text-base font-semibold text-[var(--color-ink)]">
                  2. Gestionnaire (Chargé de Recouvrement)
                </h3>
                <p className="text-xs text-[var(--color-ink-secondary)] leading-relaxed">
                  Le gestionnaire importe les portefeuilles de factures, suit les échéances quotidiennes, prépare et valide les relances assistées par IA, instruit les litiges et rapproche les justificatifs de paiement déclarés.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Section des problèmes résolus */}
        <section id="avantages" className="py-16 sm:py-20 border-b border-[var(--color-border)]">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="max-w-2xl space-y-2.5">
              <h2 className="font-display text-[26px] sm:text-[32px] font-bold tracking-tight text-[var(--color-ink)] text-balance">
                Un cadre clair face aux blocages courants du recouvrement
              </h2>
              <p className="text-[15px] sm:text-[16px] text-[var(--color-ink-secondary)] leading-relaxed">
                Remplacez les suivis dispersés par une organisation lisible, de l’identification du retard jusqu’à la confirmation du règlement.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PROBLEMS_SOLVED.map((item) => (
                <div
                  key={item.title}
                  className="bg-white border border-[var(--color-border)] rounded-lg p-6 space-y-2.5"
                >
                  <div className="flex items-start gap-3">
                    <BellRing
                      className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="space-y-1.5">
                      <h3 className="text-[16px] font-semibold text-[var(--color-ink)]">
                        {item.title}
                      </h3>
                      <p className="text-[14px] text-[var(--color-ink-secondary)] leading-relaxed">
                        {item.solution}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Section fonctionnalités */}
        <section
          id="fonctionnalites"
          className="bg-white py-16 sm:py-20 border-b border-[var(--color-border)]"
        >
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="max-w-2xl space-y-2.5">
              <h2 className="font-display text-[26px] sm:text-[32px] font-bold tracking-tight text-[var(--color-ink)] text-balance">
                Les outils essentiels pour piloter vos encaissements
              </h2>
              <p className="text-[15px] sm:text-[16px] text-[var(--color-ink-secondary)] leading-relaxed">
                Chaque module est conçu pour les gestionnaires d’entreprise, sans complexité superflue.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {CORE_FEATURES.map((feature) => {
                const Icon = feature.Icon;
                return (
                  <article
                    key={feature.title}
                    className="bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-lg p-6 space-y-3"
                  >
                    <div className="w-9 h-9 rounded-md bg-white border border-[var(--color-border)] flex items-center justify-center text-[var(--color-primary)]">
                      <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
                    </div>
                    <h3 className="text-[16px] font-semibold text-[var(--color-ink)]">
                      {feature.title}
                    </h3>
                    <p className="text-[14px] text-[var(--color-ink-secondary)] leading-relaxed">
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* 6. Section « Comment ça marche » */}
        <section
          id="comment-ca-marche"
          className="py-16 sm:py-20 border-b border-[var(--color-border)]"
        >
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="max-w-2xl space-y-2.5">
              <h2 className="font-display text-[26px] sm:text-[32px] font-bold tracking-tight text-[var(--color-ink)] text-balance">
                Comment fonctionne Recouvrix au quotidien
              </h2>
              <p className="text-[15px] sm:text-[16px] text-[var(--color-ink-secondary)] leading-relaxed">
                Un déroulement en quatre étapes, pensé pour réduire les oublis et sécuriser chaque encaissement.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {WORKFLOW_STEPS.map((step) => (
                <div
                  key={step.number}
                  className="bg-white border border-[var(--color-border)] rounded-lg p-6 flex flex-col gap-3"
                >
                  <span className="font-mono text-[13px] font-semibold text-[var(--color-primary)]">
                    Étape {step.number}
                  </span>
                  <h3 className="text-[16px] font-semibold text-[var(--color-ink)] leading-snug">
                    {step.title}
                  </h3>
                  <p className="text-[14px] text-[var(--color-ink-secondary)] leading-relaxed">
                    {step.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Section dédiée à l'intelligence artificielle */}
        <section className="bg-white py-16 sm:py-20 border-b border-[var(--color-border)]">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
              <div className="lg:col-span-7 space-y-6">
                <div className="space-y-2.5">
                  <h2 className="font-display text-[26px] sm:text-[32px] font-bold tracking-tight text-[var(--color-ink)] text-balance">
                    Une assistance par intelligence artificielle encadrée et explicable
                  </h2>
                  <p className="text-[15px] sm:text-[16px] text-[var(--color-ink-secondary)] leading-relaxed">
                    L’intelligence artificielle analyse les informations disponibles pour faire gagner du temps aux équipes, tout en laissant chaque décision financière entre vos mains.
                  </p>
                </div>

                <ul className="space-y-3">
                  {AI_CAPABILITIES.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-[15px]">
                      <CheckCircle2
                        className="w-5 h-5 text-[var(--color-success)] shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span className="text-[var(--color-ink)] leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>

                <div className="bg-[var(--color-primary-soft)] border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                  <ShieldCheck
                    className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <p className="text-[14px] text-[var(--color-ink)] leading-relaxed">
                    <strong>Le gestionnaire conserve toujours le contrôle :</strong> aucune confirmation de paiement, aucun rapprochement définitif et aucune décision sensible ne sont validés sans vérification humaine.
                  </p>
                </div>
              </div>

              {/* Exemple concret de recommandation explicable */}
              <div className="lg:col-span-5">
                <div className="bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-lg p-6 space-y-5">
                  <div className="flex items-start justify-between gap-3 pb-4 border-b border-[var(--color-border)]">
                    <div className="space-y-0.5">
                      <p className="text-[12px] font-medium text-[var(--color-ink-muted)]">
                        Recommandation d’analyse
                      </p>
                      <p className="text-[15px] font-semibold text-[var(--color-ink)]">
                        Ateliers Mercier SAS · FAC-2026-0418
                      </p>
                    </div>
                    <StatusBadge status="overdue" />
                  </div>

                  <div className="space-y-2.5 text-[13px]">
                    <p className="font-medium text-[var(--color-ink)] flex items-center gap-2">
                      <ListChecks
                        className="w-4 h-4 text-[var(--color-primary)] shrink-0"
                        aria-hidden="true"
                      />
                      <span>Éléments retenus pour la priorité</span>
                    </p>
                    <ul className="space-y-1.5 text-[var(--color-ink-secondary)] pl-6 list-disc">
                      <li>Échéance dépassée de 28 jours sans réponse récente.</li>
                      <li>Aucune promesse de paiement ni litige signalé sur ce dossier.</li>
                      <li>Canal recommandé : Email professionnel selon les préférences client.</li>
                    </ul>
                  </div>

                  <div className="bg-white border border-[var(--color-border)] rounded-md p-4 space-y-2">
                    <p className="text-[12px] font-medium text-[var(--color-ink-muted)]">
                      Brouillon préparé pour validation
                    </p>
                    <p className="text-[13px] text-[var(--color-ink-secondary)] leading-relaxed">
                      « Bonjour, sauf erreur de notre part, la facture FAC-2026-0418 d’un montant de 2 450 000 FCFA arrivée à échéance le 28/10/2026 reste en attente de règlement… »
                    </p>
                  </div>

                  <p className="text-[12px] text-[var(--color-ink-muted)]">
                    Relance soumise à votre relecture avant validation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Section finale d'appel à l'action */}
        <section className="py-16 sm:py-20 bg-[var(--color-sidebar)] text-white">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <h2 className="font-display text-[26px] sm:text-[32px] font-bold tracking-tight text-white text-balance">
                Structurez votre suivi des factures impayées dès aujourd’hui
              </h2>
              <p className="text-[15px] sm:text-[16px] text-slate-300 leading-relaxed">
                Centralisez vos dossiers clients, préparez vos relances et gardez la maîtrise de vos règlements.
              </p>
            </div>
            <div className="shrink-0">
              <Button
                variant="primary"
                size="lg"
                icon={<ArrowRight className="w-4 h-4" />}
                onClick={onNavigateToAuth}
              >
                Accéder à la plateforme
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Pied de page sobre */}
      <footer className="bg-white border-t border-[var(--color-border)] py-10">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
            <div className="space-y-2.5 max-w-sm">
              <RecouvrixLogo variant="light" size="sm" />
              <p className="text-[13px] text-[var(--color-ink-muted)] leading-relaxed">
                Plateforme de gestion intelligente du recouvrement des factures impayées, conçue pour la clarté et la maîtrise opérationnelle.
              </p>
            </div>

            <nav
              aria-label="Navigation de pied de page"
              className="flex flex-wrap gap-x-8 gap-y-3 text-[13px] font-medium text-[var(--color-ink-secondary)]"
            >
              <a
                href="#fonctionnalites"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('fonctionnalites');
                }}
                className="hover:text-[var(--color-ink)] transition-colors"
              >
                Fonctionnalités
              </a>
              <a
                href="#comment-ca-marche"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('comment-ca-marche');
                }}
                className="hover:text-[var(--color-ink)] transition-colors"
              >
                Comment ça marche
              </a>
              <a
                href="#avantages"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('avantages');
                }}
                className="hover:text-[var(--color-ink)] transition-colors"
              >
                Avantages
              </a>
              <button
                type="button"
                onClick={onNavigateToAuth}
                className="hover:text-[var(--color-ink)] transition-colors text-left"
              >
                Se connecter
              </button>
            </nav>
          </div>

          <div className="pt-6 border-t border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12px] text-[var(--color-ink-muted)]">
            <p>© {new Date().getFullYear()} Recouvrix. Tous droits réservés.</p>
            <p>Gestion du recouvrement des factures impayées</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
