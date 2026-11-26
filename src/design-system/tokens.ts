export type SemanticTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'overdue'
  | 'danger';

export interface ColorTokenSpec {
  name: string;
  hex: string;
  role: string;
  usage: string;
}

export const BRAND_PALETTE: ColorTokenSpec[] = [
  {
    name: 'Ardoise Institutionnelle',
    hex: '#0F1D2E',
    role: 'Navigation principale',
    usage: 'Barre latérale fixe et ancrage visuel de la marque.',
  },
  {
    name: 'Cobalt Financier',
    hex: '#1D4ED8',
    role: 'Action prioritaire',
    usage: 'Boutons principaux, éléments actifs et indicateurs de focus.',
  },
  {
    name: 'Toile Minérale',
    hex: '#F7F8FA',
    role: 'Fond de travail (60 %)',
    usage: 'Arrière-plan apaisant réduisant la fatigue visuelle sur de longues sessions.',
  },
  {
    name: 'Surface Pure',
    hex: '#FFFFFF',
    role: 'Conteneurs & tableaux (30 %)',
    usage: 'Cartes de synthèse, grilles de factures et fenêtres latérales.',
  },
  {
    name: 'Encre Ardoise',
    hex: '#0F172A',
    role: 'Texte principal',
    usage: 'Titres, montants financiers et libellés à contraste élevé.',
  },
  {
    name: 'Gris Gestionnaire',
    hex: '#64748B',
    role: 'Métadonnées & aides',
    usage: 'Descriptions de champs, sous-titres et dates secondaires.',
  },
];

export const STATUS_PALETTE: Array<{
  tone: SemanticTone;
  label: string;
  hex: string;
  surfaceHex: string;
  meaning: string;
}> = [
  {
    tone: 'success',
    label: 'Paiement confirmé / Soldée',
    hex: '#15803D',
    surfaceHex: '#F0FDF4',
    meaning: 'Règlement vérifié, facture soldée ou justificatif validé.',
  },
  {
    tone: 'warning',
    label: 'En attente / À vérifier',
    hex: '#B45309',
    surfaceHex: '#FFFBEB',
    meaning: 'Paiement déclaré, justificatif reçu à contrôler ou promesse en cours.',
  },
  {
    tone: 'overdue',
    label: 'En retard',
    hex: '#C2410C',
    surfaceHex: '#FFF7ED',
    meaning: 'Échéance dépassée nécessitant une relance prioritaire.',
  },
  {
    tone: 'danger',
    label: 'Litige / Blocage',
    hex: '#B91C1C',
    surfaceHex: '#FEF2F2',
    meaning: 'Litige actif suspendant les relances, échec critique ou paiement rejeté.',
  },
  {
    tone: 'info',
    label: 'Relance / Planifié',
    hex: '#1D4ED8',
    surfaceHex: '#EFF6FF',
    meaning: 'Relance préparée, message prêt à valider ou échéance proche.',
  },
  {
    tone: 'neutral',
    label: 'Information neutre',
    hex: '#475569',
    surfaceHex: '#F1F5F9',
    meaning: 'Dossier à échoir, brouillon ou action archivée.',
  },
];

export type NavigationSectionId =
  | 'supervision'
  | 'users'
  | 'dashboard'
  | 'clients'
  | 'invoices'
  | 'imports'
  | 'reminders'
  | 'payments'
  | 'history'
  | 'settings';

export interface NavigationItemConfig {
  id: NavigationSectionId;
  path: string;
  label: string;
  description: string;
  group: 'pilotage' | 'operations' | 'administration';
  allowedRoles: Array<'ADMIN' | 'MANAGER'>;
}

export const NAVIGATION_ITEMS: NavigationItemConfig[] = [
  {
    id: 'supervision',
    path: '/supervision',
    label: 'Tableau de bord',
    description: 'Pilotage global des créances, supervision des opérations et gestion des accès.',
    group: 'pilotage',
    allowedRoles: ['ADMIN'],
  },
  {
    id: 'dashboard',
    path: '/espace',
    label: 'Tableau de bord',
    description: 'Centre de pilotage quotidien du recouvrement et des priorités du jour.',
    group: 'pilotage',
    allowedRoles: ['MANAGER'],
  },
  {
    id: 'clients',
    path: '/clients',
    label: 'Clients',
    description: 'Fiches clients, coordonnées, préférences de contact et historique consolidé.',
    group: 'operations',
    allowedRoles: ['MANAGER', 'ADMIN'],
  },
  {
    id: 'invoices',
    path: '/factures',
    label: 'Factures et créances',
    description: 'Suivi des factures existantes, soldes restants, retards, litiges et promesses.',
    group: 'operations',
    allowedRoles: ['MANAGER', 'ADMIN'],
  },
  {
    id: 'imports',
    path: '/importation',
    label: 'Importation',
    description: 'Importation Excel, CSV, PDF ou scans avec détection des doublons et contrôle préalable.',
    group: 'operations',
    allowedRoles: ['MANAGER', 'ADMIN'],
  },
  {
    id: 'reminders',
    path: '/relances',
    label: 'Relances',
    description: 'Préparation assistée et suivi des relances multicanales Email et WhatsApp.',
    group: 'operations',
    allowedRoles: ['MANAGER', 'ADMIN'],
  },
  {
    id: 'payments',
    path: '/paiements',
    label: 'Paiements',
    description: 'Contrôle des justificatifs, vérification des paiements déclarés et confirmation.',
    group: 'operations',
    allowedRoles: ['MANAGER', 'ADMIN'],
  },
  {
    id: 'history',
    path: '/journal',
    label: 'Historique',
    description: 'Traçabilité horodatée des opérations de recouvrement et événements de sécurité.',
    group: 'administration',
    allowedRoles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'users',
    path: '/utilisateurs',
    label: 'Utilisateurs et rôles',
    description: 'Gestion des comptes, attribution des rôles et activation des accès.',
    group: 'administration',
    allowedRoles: ['ADMIN'],
  },
  {
    id: 'settings',
    path: '/parametres',
    label: 'Paramètres',
    description: 'Paramètres généraux de l’organisation et règles de recouvrement.',
    group: 'administration',
    allowedRoles: ['ADMIN'],
  },
];

/** Sections métier affichées dans la barre latérale. */
export const SIDEBAR_NAVIGATION_GROUPS: Array<NavigationItemConfig['group']> = [
  'pilotage',
  'operations',
  'administration',
];
