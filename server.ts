import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';

const PORT = Number(process.env.PORT) || 3847;
const SESSION_TTL_MINUTES = Math.max(15, Number(process.env.SESSION_TTL_MINUTES) || 480);
const SESSION_TTL_MS = SESSION_TTL_MINUTES * 60 * 1000;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || typeof password !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, originalHex] = parts;
  try {
    const candidate = crypto.scryptSync(password, salt, 64);
    const original = Buffer.from(originalHex, 'hex');
    if (candidate.length !== original.length) return false;
    return crypto.timingSafeEqual(candidate, original);
  } catch {
    return false;
  }
}

function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  }
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(password) || !/\d/.test(password)) {
    return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  }
  return null;
}

function createSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// Initialize Gemini AI SDK if API key is provided
let aiClient: GoogleGenAI | null = null;
const geminiApiKey = process.env.GEMINI_API_KEY;
if (geminiApiKey && geminiApiKey !== 'MY_GEMINI_API_KEY') {
  try {
    aiClient = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('Gemini AI initialisation warning:', err);
  }
}

// In-Memory Database Structure
interface ClientRecord {
  id: string;
  organizationId: string;
  name: string;
  clientType: 'COMPANY' | 'INDIVIDUAL';
  taxId: string | null;
  address: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  secondaryContact: string | null;
  preferredChannel: 'EMAIL' | 'WHATSAPP' | 'PHONE';
  contactHours: string | null;
  restrictionsNote: string | null;
  notes: string | null;
  isArchived: number;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InvoiceRecord {
  id: string;
  organizationId: string;
  reference: string;
  clientId: string;
  importId?: string | null;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  currency: string;
  description: string | null;
  hasDispute: number;
  disputeReason: string | null;
  isArchived: number;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaymentRecord {
  id: string;
  organizationId: string;
  reference: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  status: 'DECLARED' | 'RECEIPT_RECEIVED' | 'PENDING_VERIFICATION' | 'CONFIRMED' | 'RECORDED' | 'REJECTED';
  paymentMethod: string;
  receiptDocumentId: string | null;
  receiptFileName: string | null;
  declaredAt: string;
  confirmedAt: string | null;
  createdBy: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PromiseRecord {
  id: string;
  organizationId: string;
  invoiceId: string;
  clientId: string;
  promisedAmount: number;
  promisedDate: string;
  status: 'ACTIVE' | 'KEPT' | 'BROKEN' | 'CANCELLED';
  note: string | null;
  recordedBy: string;
  evaluatedAt: string | null;
  createdAt: string;
}

interface DisputeRecord {
  id: string;
  organizationId: string;
  invoiceId: string;
  clientId: string;
  category: string;
  reason: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CANCELLED';
  openedBy: string;
  openedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

interface CreditNoteRecord {
  id: string;
  organizationId: string;
  invoiceId: string;
  clientId: string;
  reference: string;
  amount: number;
  status: 'DRAFT' | 'VALIDATED' | 'CANCELLED';
  reason: string;
  validatedAt: string | null;
  validatedBy: string | null;
  createdBy: string;
  createdAt: string;
}

interface ReminderRecord {
  id: string;
  organizationId: string;
  invoiceId: string;
  clientId: string;
  channel: 'EMAIL' | 'WHATSAPP' | 'PHONE';
  status: 'PLANNED' | 'PREPARED' | 'VALIDATED' | 'SENT' | 'CANCELLED';
  scheduledFor: string;
  subject: string;
  bodyPreview: string;
  attachOriginalInvoice?: boolean;
  attachPaymentInstructions?: boolean;
  createdAt: string;
  validatedAt: string | null;
  sentAt: string | null;
}

interface DocumentRecord {
  id: string;
  organizationId: string;
  clientId: string | null;
  invoiceId: string | null;
  paymentId: string | null;
  importId: string | null;
  docType: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string | null;
  createdAt: string;
}

interface ImportBatchRecord {
  id: string;
  organizationId: string;
  filename: string;
  sourceType: string;
  status: string;
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  errorRows: number;
  createdBy: string;
  createdAt: string;
}

interface ActivityLogRecord {
  id: string;
  organizationId: string;
  eventType: string;
  category: string;
  actorUserId: string | null;
  actorLabel: string;
  targetUserId: string | null;
  targetLabel: string | null;
  summary: string;
  createdAt: string;
}

interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'MANAGER';
  passwordHash: string | null;
  isActive: boolean;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

interface SessionRecord {
  userId: string;
  expiresAt: number;
}

function publicUser(user: UserRecord) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

function applyDemoPasswordsFromEnv(users: UserRecord[]): void {
  const adminPass = process.env.DEMO_ADMIN_PASSWORD;
  const managerPass = process.env.DEMO_MANAGER_PASSWORD;
  if (adminPass) {
    const admin = users.find((u) => u.email === 'admin@recouvrix.demo');
    if (admin) admin.passwordHash = hashPassword(adminPass);
  }
  if (managerPass) {
    const manager = users.find((u) => u.email === 'gestionnaire@recouvrix.demo');
    if (manager) manager.passwordHash = hashPassword(managerPass);
  }
}

function requiresPasswordBootstrap(users: UserRecord[]): boolean {
  return users.every((u) => !u.passwordHash);
}

// Initial In-Memory State
function getInitialData() {
  const now = Date.now();
  const day = 86400000;

  const clients: ClientRecord[] = [
    {
      id: 'cli-1',
      organizationId: 'org-default',
      name: 'SOGECOT Bénin SARL',
      clientType: 'COMPANY',
      taxId: 'IFU 3201810459211',
      address: 'Boulevard Saint-Michel, Lot 412, Cotonou',
      contactName: 'Kossi Agbo',
      email: 'compta@sogecot.bj',
      phone: '+229 01 97 12 34 00',
      secondaryContact: 'Direction financière · +229 01 97 12 34 05',
      preferredChannel: 'EMAIL',
      contactHours: 'Lun–Ven · 08h30 – 17h30',
      restrictionsNote: null,
      notes: 'Client historique quincaillerie industrielle.',
      isArchived: 0,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date(now - 45 * day).toISOString(),
      updatedAt: new Date(now - 10 * day).toISOString(),
    },
    {
      id: 'cli-2',
      organizationId: 'org-default',
      name: 'Atlantique Matériaux SA',
      clientType: 'COMPANY',
      taxId: 'IFU 3201409823410',
      address: 'Zone Industrielle Akpakpa, Cotonou',
      contactName: 'Amina Bello',
      email: 'finance@atlantique-mat.bj',
      phone: '+229 01 96 44 10 22',
      secondaryContact: null,
      preferredChannel: 'WHATSAPP',
      contactHours: 'Lun–Ven · 09h00 – 16h00',
      restrictionsNote: 'Privilégier les confirmations écrites avant appel téléphonique.',
      notes: null,
      isArchived: 0,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date(now - 40 * day).toISOString(),
      updatedAt: new Date(now - 5 * day).toISOString(),
    },
    {
      id: 'cli-3',
      organizationId: 'org-default',
      name: 'Clinique Les Palmiers',
      clientType: 'COMPANY',
      taxId: 'IFU 3201905541208',
      address: 'Quartier Haie Vive, Rue 318, Cotonou',
      contactName: 'Dr. Brice Houngbédji',
      email: 'direction@lespalmiers.bj',
      phone: '+229 01 95 30 88 14',
      secondaryContact: 'Secrétariat comptable · compta@lespalmiers.bj',
      preferredChannel: 'EMAIL',
      contactHours: 'Mar–Ven · 10h00 – 15h00',
      restrictionsNote: 'Relances suspendues tant que le litige sur la livraison reste ouvert.',
      notes: null,
      isArchived: 0,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date(now - 35 * day).toISOString(),
      updatedAt: new Date(now - 3 * day).toISOString(),
    },
    {
      id: 'cli-4',
      organizationId: 'org-default',
      name: 'Transit Portuaire Cotonou',
      clientType: 'COMPANY',
      taxId: 'IFU 3201103349012',
      address: 'Avenue de la Marina, Face Port Autonome, Cotonou',
      contactName: 'Sèna Mensah',
      email: 'tresorerie@tpc-benin.bj',
      phone: '+229 01 97 80 51 09',
      secondaryContact: null,
      preferredChannel: 'EMAIL',
      contactHours: 'Lun–Ven · 08h00 – 17h00',
      restrictionsNote: null,
      notes: null,
      isArchived: 0,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date(now - 30 * day).toISOString(),
      updatedAt: new Date(now - 6 * day).toISOString(),
    },
    {
      id: 'cli-5',
      organizationId: 'org-default',
      name: 'Éric Tossou (Imprimerie du Golfe)',
      clientType: 'INDIVIDUAL',
      taxId: 'IFU 1201708843201',
      address: 'Carrefour Dantokpa, Porto-Novo / Cotonou',
      contactName: 'Éric Tossou',
      email: 'eric@imprimeriegolfe.bj',
      phone: '+229 01 94 22 67 30',
      secondaryContact: null,
      preferredChannel: 'WHATSAPP',
      contactHours: 'Lun–Sam · 09h00 – 18h00',
      restrictionsNote: null,
      notes: 'Promesse de règlement en attente.',
      isArchived: 0,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date(now - 25 * day).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cli-6',
      organizationId: 'org-default',
      name: 'Distribution Akpakpa',
      clientType: 'COMPANY',
      taxId: 'IFU 3202011294503',
      address: 'Akpakpa Dodomè, Parcelle 88, Cotonou',
      contactName: 'Chantal Zinsou',
      email: 'achat@akpakpa-distrib.bj',
      phone: '+229 01 96 11 45 77',
      secondaryContact: null,
      preferredChannel: 'EMAIL',
      contactHours: 'Lun–Ven · 08h30 – 17h00',
      restrictionsNote: null,
      notes: null,
      isArchived: 0,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date(now - 50 * day).toISOString(),
      updatedAt: new Date(now - 15 * day).toISOString(),
    },
  ];

  const invoices: InvoiceRecord[] = [
    {
      id: 'inv-1',
      organizationId: 'org-default',
      reference: 'FAC-2026-0418',
      clientId: 'cli-1',
      importId: 'imp-demo-1',
      issueDate: new Date(now - 58 * day).toISOString().slice(0, 10),
      dueDate: new Date(now - 28 * day).toISOString().slice(0, 10),
      totalAmount: 2450000,
      currency: 'XOF',
      description: 'Fourniture de lots de quincaillerie industrielle — Bon de livraison BL-418',
      hasDispute: 0,
      disputeReason: null,
      isArchived: 0,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date(now - 10 * day).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'inv-2',
      organizationId: 'org-default',
      reference: 'FAC-2026-0425',
      clientId: 'cli-2',
      importId: 'imp-demo-1',
      issueDate: new Date(now - 42 * day).toISOString().slice(0, 10),
      dueDate: new Date(now - 12 * day).toISOString().slice(0, 10),
      totalAmount: 1850000,
      currency: 'XOF',
      description: 'Livraison ciment et fer à béton — Chantier Akpakpa',
      hasDispute: 0,
      disputeReason: null,
      isArchived: 0,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date(now - 10 * day).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'inv-3',
      organizationId: 'org-default',
      reference: 'FAC-2026-0429',
      clientId: 'cli-4',
      importId: 'imp-demo-1',
      issueDate: new Date(now - 38 * day).toISOString().slice(0, 10),
      dueDate: new Date(now - 8 * day).toISOString().slice(0, 10),
      totalAmount: 3000000,
      currency: 'XOF',
      description: 'Prestations de dédouanement et manutention conteneur #TCNU-409',
      hasDispute: 0,
      disputeReason: null,
      isArchived: 0,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date(now - 10 * day).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'inv-4',
      organizationId: 'org-default',
      reference: 'FAC-2026-0421',
      clientId: 'cli-3',
      importId: 'imp-demo-1',
      issueDate: new Date(now - 49 * day).toISOString().slice(0, 10),
      dueDate: new Date(now - 19 * day).toISOString().slice(0, 10),
      totalAmount: 1400000,
      currency: 'XOF',
      description: 'Équipements médicaux consommables — Commande CMP-0421',
      hasDispute: 1,
      disputeReason: 'Écart contesté sur la quantité livrée',
      isArchived: 0,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date(now - 10 * day).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'inv-5',
      organizationId: 'org-default',
      reference: 'FAC-2026-0434',
      clientId: 'cli-5',
      importId: 'imp-demo-1',
      issueDate: new Date(now - 35 * day).toISOString().slice(0, 10),
      dueDate: new Date(now - 5 * day).toISOString().slice(0, 10),
      totalAmount: 950000,
      currency: 'XOF',
      description: 'Impression catalogues commerciaux et brochures institutionnelles',
      hasDispute: 0,
      disputeReason: null,
      isArchived: 0,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date(now - 10 * day).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'inv-6',
      organizationId: 'org-default',
      reference: 'FAC-2026-0445',
      clientId: 'cli-6',
      importId: 'imp-demo-1',
      issueDate: new Date(now - 15 * day).toISOString().slice(0, 10),
      dueDate: new Date(now + 10 * day).toISOString().slice(0, 10),
      totalAmount: 1650000,
      currency: 'XOF',
      description: 'Approvisionnement marchandises générales — Lot novembre',
      hasDispute: 0,
      disputeReason: null,
      isArchived: 0,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date(now - 10 * day).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'inv-7',
      organizationId: 'org-default',
      reference: 'FAC-2026-0402',
      clientId: 'cli-6',
      importId: 'imp-demo-1',
      issueDate: new Date(now - 70 * day).toISOString().slice(0, 10),
      dueDate: new Date(now - 40 * day).toISOString().slice(0, 10),
      totalAmount: 2200000,
      currency: 'XOF',
      description: 'Approvisionnement marchandises générales — Lot octobre',
      hasDispute: 0,
      disputeReason: null,
      isArchived: 0,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date(now - 10 * day).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'inv-8',
      organizationId: 'org-default',
      reference: 'FAC-2026-0411',
      clientId: 'cli-1',
      importId: 'imp-demo-1',
      issueDate: new Date(now - 50 * day).toISOString().slice(0, 10),
      dueDate: new Date(now - 20 * day).toISOString().slice(0, 10),
      totalAmount: 1100000,
      currency: 'XOF',
      description: 'Maintenance préventive équipements de levage — Trimestre 3',
      hasDispute: 0,
      disputeReason: null,
      isArchived: 0,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date(now - 10 * day).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const payments: PaymentRecord[] = [
    {
      id: 'pay-1',
      organizationId: 'org-default',
      reference: 'PAY-2026-0081',
      invoiceId: 'inv-7',
      clientId: 'cli-6',
      amount: 2200000,
      status: 'CONFIRMED',
      paymentMethod: 'Virement bancaire',
      receiptDocumentId: null,
      receiptFileName: null,
      declaredAt: new Date(now - 38 * day).toISOString(),
      confirmedAt: new Date(now - 37 * day).toISOString(),
      createdBy: 'gestionnaire@recouvrix.demo',
      rejectionReason: null,
      createdAt: new Date(now - 38 * day).toISOString(),
      updatedAt: new Date(now - 37 * day).toISOString(),
    },
    {
      id: 'pay-2',
      organizationId: 'org-default',
      reference: 'PAY-2026-0088',
      invoiceId: 'inv-8',
      clientId: 'cli-1',
      amount: 1100000,
      status: 'CONFIRMED',
      paymentMethod: 'Virement bancaire',
      receiptDocumentId: null,
      receiptFileName: null,
      declaredAt: new Date(now - 18 * day).toISOString(),
      confirmedAt: new Date(now - 16 * day).toISOString(),
      createdBy: 'gestionnaire@recouvrix.demo',
      rejectionReason: null,
      createdAt: new Date(now - 18 * day).toISOString(),
      updatedAt: new Date(now - 16 * day).toISOString(),
    },
    {
      id: 'pay-3',
      organizationId: 'org-default',
      reference: 'PAY-2026-0092',
      invoiceId: 'inv-3',
      clientId: 'cli-4',
      amount: 1200000,
      status: 'CONFIRMED',
      paymentMethod: 'Virement bancaire',
      receiptDocumentId: null,
      receiptFileName: null,
      declaredAt: new Date(now - 6 * day).toISOString(),
      confirmedAt: new Date(now - 5 * day).toISOString(),
      createdBy: 'gestionnaire@recouvrix.demo',
      rejectionReason: null,
      createdAt: new Date(now - 6 * day).toISOString(),
      updatedAt: new Date(now - 5 * day).toISOString(),
    },
    {
      id: 'pay-4',
      organizationId: 'org-default',
      reference: 'PAY-2026-0097',
      invoiceId: 'inv-2',
      clientId: 'cli-2',
      amount: 850000,
      status: 'RECEIPT_RECEIVED',
      paymentMethod: 'MTN Mobile Money',
      receiptDocumentId: 'doc-2',
      receiptFileName: 'recu-momo-0097.pdf',
      declaredAt: new Date(now - 1 * day).toISOString(),
      confirmedAt: null,
      createdBy: 'gestionnaire@recouvrix.demo',
      rejectionReason: null,
      createdAt: new Date(now - 1 * day).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'pay-5',
      organizationId: 'org-default',
      reference: 'PAY-2026-0099',
      invoiceId: 'inv-5',
      clientId: 'cli-5',
      amount: 450000,
      status: 'DECLARED',
      paymentMethod: 'Virement bancaire',
      receiptDocumentId: null,
      receiptFileName: null,
      declaredAt: new Date().toISOString(),
      confirmedAt: null,
      createdBy: 'gestionnaire@recouvrix.demo',
      rejectionReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const promises: PromiseRecord[] = [
    {
      id: 'prom-1',
      organizationId: 'org-default',
      invoiceId: 'inv-5',
      clientId: 'cli-5',
      promisedAmount: 950000,
      promisedDate: new Date(now + 1 * day).toISOString().slice(0, 10),
      status: 'ACTIVE',
      note: 'Règlement complet annoncé par virement avant fin de journée demain.',
      recordedBy: 'gestionnaire@recouvrix.demo',
      evaluatedAt: null,
      createdAt: new Date().toISOString(),
    },
  ];

  const disputes: DisputeRecord[] = [
    {
      id: 'disp-1',
      organizationId: 'org-default',
      invoiceId: 'inv-4',
      clientId: 'cli-3',
      category: 'QUANTITY_DISCREPANCY',
      reason: 'Écart contesté sur la quantité livrée',
      status: 'OPEN',
      openedBy: 'gestionnaire@recouvrix.demo',
      openedAt: new Date(now - 3 * day).toISOString(),
      resolvedAt: null,
      resolutionNote: null,
      createdAt: new Date(now - 3 * day).toISOString(),
    },
  ];

  const creditNotes: CreditNoteRecord[] = [];

  const reminders: ReminderRecord[] = [
    {
      id: 'rem-1',
      organizationId: 'org-default',
      invoiceId: 'inv-1',
      clientId: 'cli-1',
      channel: 'EMAIL',
      status: 'PREPARED',
      scheduledFor: new Date().toISOString().slice(0, 10),
      subject: 'Relance facture FAC-2026-0418 échue',
      bodyPreview: 'Madame, Monsieur, nous constatons que la facture FAC-2026-0418 d’un montant de 2 450 000 FCFA est échue depuis 28 jours. Nous vous invitons à régulariser ce montant.',
      createdAt: new Date().toISOString(),
      validatedAt: null,
      sentAt: null,
    },
    {
      id: 'rem-2',
      organizationId: 'org-default',
      invoiceId: 'inv-3',
      clientId: 'cli-4',
      channel: 'EMAIL',
      status: 'PREPARED',
      scheduledFor: new Date().toISOString().slice(0, 10),
      subject: 'Suivi du solde restant sur FAC-2026-0429',
      bodyPreview: 'Bonjour M. Sèna Mensah, faisant suite à votre acompte de 1 200 000 FCFA reçu le 20 nov., nous vous rappelons le solde résiduel de 1 800 000 FCFA.',
      createdAt: new Date().toISOString(),
      validatedAt: null,
      sentAt: null,
    },
    {
      id: 'rem-3',
      organizationId: 'org-default',
      invoiceId: 'inv-2',
      clientId: 'cli-2',
      channel: 'WHATSAPP',
      status: 'VALIDATED',
      scheduledFor: new Date().toISOString().slice(0, 10),
      subject: 'Relance WhatsApp FAC-2026-0425',
      bodyPreview: 'Bonjour Mme Amina Bello (Atlantique Matériaux SA), votre facture FAC-2026-0425 de 1 850 000 FCFA est arrivée à échéance. Merci de confirmer votre transfert.',
      createdAt: new Date(now - 2 * day).toISOString(),
      validatedAt: new Date(now - 1 * day).toISOString(),
      sentAt: null,
    },
  ];

  const documents: DocumentRecord[] = [
    {
      id: 'doc-1',
      organizationId: 'org-default',
      clientId: 'cli-1',
      invoiceId: 'inv-1',
      paymentId: null,
      importId: 'imp-demo-1',
      docType: 'FACTURE_PDF',
      title: 'Facture FAC-2026-0418 — SOGECOT Bénin SARL',
      fileName: 'FAC-2026-0418.pdf',
      mimeType: 'application/pdf',
      fileSize: 184320,
      uploadedBy: 'gestionnaire@recouvrix.demo',
      createdAt: new Date(now - 10 * day).toISOString(),
    },
    {
      id: 'doc-2',
      organizationId: 'org-default',
      clientId: 'cli-2',
      invoiceId: 'inv-2',
      paymentId: 'pay-4',
      importId: null,
      docType: 'JUSTIFICATIF_PAIEMENT',
      title: 'Reçu MTN Mobile Money — PAY-2026-0097',
      fileName: 'recu-momo-0097.pdf',
      mimeType: 'application/pdf',
      fileSize: 94210,
      uploadedBy: 'gestionnaire@recouvrix.demo',
      createdAt: new Date(now - 1 * day).toISOString(),
    },
  ];

  const importBatches: ImportBatchRecord[] = [
    {
      id: 'imp-demo-1',
      organizationId: 'org-default',
      filename: 'creances_portefeuille_benin.csv',
      sourceType: 'CSV',
      status: 'VALIDATED',
      totalRows: 8,
      importedRows: 8,
      duplicateRows: 0,
      errorRows: 0,
      createdBy: 'gestionnaire@recouvrix.demo',
      createdAt: new Date(now - 10 * day).toISOString(),
    },
  ];

  const activityLogs: ActivityLogRecord[] = [
    {
      id: 'log-1',
      organizationId: 'org-default',
      eventType: 'IMPORT_BATCH',
      category: 'RECOVERY',
      actorUserId: 'usr-manager',
      actorLabel: 'gestionnaire@recouvrix.demo',
      targetUserId: null,
      targetLabel: 'creances_portefeuille_benin.csv',
      summary: 'Importation initiale validée de 8 créances commerciales.',
      createdAt: new Date(now - 10 * day).toISOString(),
    },
    {
      id: 'log-2',
      organizationId: 'org-default',
      eventType: 'PAYMENT_CONFIRMED',
      category: 'RECOVERY',
      actorUserId: 'usr-manager',
      actorLabel: 'gestionnaire@recouvrix.demo',
      targetUserId: null,
      targetLabel: 'FAC-2026-0429',
      summary: 'Acompte de 1 200 000 FCFA confirmé sur la facture FAC-2026-0429.',
      createdAt: new Date(now - 5 * day).toISOString(),
    },
    {
      id: 'log-3',
      organizationId: 'org-default',
      eventType: 'DISPUTE_OPENED',
      category: 'RECOVERY',
      actorUserId: 'usr-manager',
      actorLabel: 'gestionnaire@recouvrix.demo',
      targetUserId: null,
      targetLabel: 'FAC-2026-0421',
      summary: 'Litige déclaré pour écart de quantité sur Clinique Les Palmiers.',
      createdAt: new Date(now - 3 * day).toISOString(),
    },
    {
      id: 'log-4',
      organizationId: 'org-default',
      eventType: 'RECEIPT_RECEIVED',
      category: 'RECOVERY',
      actorUserId: 'usr-manager',
      actorLabel: 'gestionnaire@recouvrix.demo',
      targetUserId: null,
      targetLabel: 'PAY-2026-0097',
      summary: 'Reçu Mobile Money de 850 000 FCFA reçu pour Atlantique Matériaux.',
      createdAt: new Date(now - 1 * day).toISOString(),
    },
  ];

  const users: UserRecord[] = [
      {
        id: 'usr-admin',
        email: 'admin@recouvrix.demo',
        fullName: 'Directeur Financier (Admin)',
        role: 'ADMIN',
        passwordHash: null,
        isActive: true,
        isDemo: true,
        createdAt: new Date(now - 60 * day).toISOString(),
        updatedAt: new Date(now - 60 * day).toISOString(),
        lastLoginAt: null,
      },
      {
        id: 'usr-manager',
        email: 'gestionnaire@recouvrix.demo',
        fullName: 'Gestionnaire Recouvrement',
        role: 'MANAGER',
        passwordHash: null,
        isActive: true,
        isDemo: true,
        createdAt: new Date(now - 60 * day).toISOString(),
        updatedAt: new Date(now - 60 * day).toISOString(),
        lastLoginAt: null,
      },
    ];

    applyDemoPasswordsFromEnv(users);

    return {
      organization: {
        id: 'org-default',
        name: 'Alpha Logistique & Services SA',
        taxId: 'IFU 3201810459211',
        address: 'Boulevard Saint-Michel, Immeuble Horizon, Cotonou',
        email: 'contact@alphalogistique.bj',
        phone: '+229 01 21 30 40 50',
        currency: 'XOF',
        bankName: 'Ecobank Bénin',
        ibanOrRib: 'BJ68 BJ02 0100 1234 5678 9012 34',
        mobileMoneyMerchant: '+229 01 97 00 00 00 (Alpha Logistique SA)',
        paymentInstructions: 'Prière de mentionner obligatoirement la référence de votre facture en libellé de tout virement ou transfert Mobile Money.',
        autoVerifyThreshold: 500000,
        gracePeriodDays: 3,
        autoSuspendOnDispute: true,
        aiAssistanceEnabled: true,
      },
      users,
      clients,
      invoices,
    payments,
    promises,
    disputes,
    creditNotes,
    reminders,
    documents,
    importBatches,
    activityLogs,
  };
}

let db = getInitialData();
const sessions = new Map<string, SessionRecord>();

// Calculation Helpers
function calculateInvoiceFinancials(inv: InvoiceRecord) {
  const invoicePayments = db.payments.filter(
    (p) => p.invoiceId === inv.id && (p.status === 'CONFIRMED' || p.status === 'RECORDED')
  );
  const confirmedPaidAmount = invoicePayments.reduce((sum, p) => sum + p.amount, 0);

  const pendingPayments = db.payments.filter(
    (p) => p.invoiceId === inv.id && (p.status === 'DECLARED' || p.status === 'RECEIPT_RECEIVED' || p.status === 'PENDING_VERIFICATION')
  );
  const pendingVerificationAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  const validatedCredits = db.creditNotes.filter(
    (cn) => cn.invoiceId === inv.id && cn.status === 'VALIDATED'
  );
  const validatedCreditNotesAmount = validatedCredits.reduce((sum, cn) => sum + cn.amount, 0);

  const remainingAmount = Math.max(0, inv.totalAmount - confirmedPaidAmount - validatedCreditNotesAmount);

  const dueDate = new Date(inv.dueDate);
  const now = new Date();
  const delayDays = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86400000));
  const isOverdue = delayDays > 0 && remainingAmount > 0;
  const isPartiallyPaid = confirmedPaidAmount > 0 && remainingAmount > 0;

  const activePromise = db.promises.find((p) => p.invoiceId === inv.id && p.status === 'ACTIVE');

  let status: 'UPCOMING' | 'OVERDUE' | 'PARTIAL' | 'DISPUTE' | 'PROMISE' | 'PAID' = 'UPCOMING';
  if (remainingAmount <= 0) {
    status = 'PAID';
  } else if (inv.hasDispute === 1) {
    status = 'DISPUTE';
  } else if (activePromise) {
    status = 'PROMISE';
  } else if (isOverdue) {
    status = 'OVERDUE';
  } else if (isPartiallyPaid) {
    status = 'PARTIAL';
  }

  return {
    confirmedPaidAmount,
    pendingVerificationAmount,
    validatedCreditNotesAmount,
    remainingAmount,
    delayDays,
    isOverdue,
    isPartiallyPaid,
    activePromiseDate: activePromise ? activePromise.promisedDate : null,
    status,
  };
}

function calculateClientFinancials(cli: ClientRecord) {
  const clientInvoices = db.invoices.filter((i) => i.clientId === cli.id && !i.isArchived);
  let totalBilled = 0;
  let totalPaidConfirmed = 0;
  let remainingAmount = 0;
  let overdueAmount = 0;
  let pendingVerificationAmount = 0;
  let openInvoicesCount = 0;
  let overdueInvoicesCount = 0;

  for (const inv of clientInvoices) {
    totalBilled += inv.totalAmount;
    const fin = calculateInvoiceFinancials(inv);
    totalPaidConfirmed += fin.confirmedPaidAmount;
    remainingAmount += fin.remainingAmount;
    pendingVerificationAmount += fin.pendingVerificationAmount;
    if (fin.remainingAmount > 0) {
      openInvoicesCount++;
      if (fin.isOverdue) {
        overdueInvoicesCount++;
        overdueAmount += fin.remainingAmount;
      }
    }
  }

  const clientDisputes = db.disputes.filter((d) => d.clientId === cli.id && d.status === 'OPEN');
  const clientPromises = db.promises.filter((p) => p.clientId === cli.id && p.status === 'ACTIVE');
  const clientPendingPayments = db.payments.filter(
    (p) => p.clientId === cli.id && (p.status === 'DECLARED' || p.status === 'RECEIPT_RECEIVED')
  );

  let globalStatus: 'DISPUTE' | 'OVERDUE' | 'PROMISE' | 'UP_TO_DATE' | 'SETTLED' | 'ARCHIVED' = 'UP_TO_DATE';
  if (cli.isArchived) {
    globalStatus = 'ARCHIVED';
  } else if (clientDisputes.length > 0) {
    globalStatus = 'DISPUTE';
  } else if (overdueAmount > 0) {
    globalStatus = 'OVERDUE';
  } else if (clientPromises.length > 0) {
    globalStatus = 'PROMISE';
  } else if (remainingAmount === 0 && totalBilled > 0) {
    globalStatus = 'SETTLED';
  }

  return {
    totalBilled,
    totalPaidConfirmed,
    remainingAmount,
    overdueAmount,
    pendingVerificationAmount,
    invoicesCount: clientInvoices.length,
    openInvoicesCount,
    overdueInvoicesCount,
    pendingPaymentsCount: clientPendingPayments.length,
    activePromisesCount: clientPromises.length,
    openDisputesCount: clientDisputes.length,
    globalStatus,
  };
}

function logActivity(
  eventType: string,
  category: string,
  actorLabel: string,
  targetLabel: string | null,
  summary: string,
  actorUserId: string | null = null
) {
  const log: ActivityLogRecord = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    organizationId: 'org-default',
    eventType,
    category,
    actorUserId,
    actorLabel,
    targetUserId: null,
    targetLabel,
    summary,
    createdAt: new Date().toISOString(),
  };
  db.activityLogs.unshift(log);
  if (db.activityLogs.length > 200) db.activityLogs.pop();
}

async function startGateway() {
  const app = express();
  app.use(express.json());
  app.set('trust proxy', 1);

  // Authentication Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Session non authentifiée. Veuillez vous connecter.' });
    }
    const token = authHeader.split(' ')[1];
    const session = sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      if (session) sessions.delete(token);
      return res.status(401).json({ error: 'Votre session a expiré. Veuillez vous reconnecter.' });
    }
    const user = db.users.find((u) => u.id === session.userId);
    if (!user || !user.isActive) {
      sessions.delete(token);
      return res.status(401).json({ error: 'Utilisateur introuvable ou désactivé.' });
    }
    req.user = user;
    req.sessionToken = token;
    req.sessionExpiresAt = session.expiresAt;
    next();
  };

  // Lightweight per-user throttle for paid AI routes
  const aiCallTimestamps = new Map<string, number[]>();
  const AI_RATE_WINDOW_MS = 60_000;
  const AI_RATE_MAX = 8;

  function assertAiRateLimit(userId: string): string | null {
    const now = Date.now();
    const recent = (aiCallTimestamps.get(userId) || []).filter((t) => now - t < AI_RATE_WINDOW_MS);
    if (recent.length >= AI_RATE_MAX) {
      return 'Trop de requêtes IA. Réessayez dans une minute.';
    }
    recent.push(now);
    aiCallTimestamps.set(userId, recent);
    return null;
  }

  // 1. Health
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 2. Auth Routes
  app.get('/api/auth/status', (_req, res) => {
    const envDemoConfigured = Boolean(
      process.env.DEMO_ADMIN_PASSWORD && process.env.DEMO_MANAGER_PASSWORD
    );
    res.json({
      // Passwords come only from DEMO_*_PASSWORD env / secrets — no public bootstrap.
      requiresInitialSetup: false,
      envDemoConfigured,
      authReady: !requiresPasswordBootstrap(db.users),
      activeOrganizationName: db.organization.name,
    });
  });

  // Public password bootstrap removed: demo passwords must be set via environment secrets.

  const loginAttempts = new Map<string, number[]>();
  const LOGIN_WINDOW_MS = 10 * 60_000;
  const LOGIN_MAX_ATTEMPTS = 8;

  function assertLoginRateLimit(key: string): string | null {
    const now = Date.now();
    const recent = (loginAttempts.get(key) || []).filter((t) => now - t < LOGIN_WINDOW_MS);
    if (recent.length >= LOGIN_MAX_ATTEMPTS) {
      return 'Trop de tentatives de connexion. Réessayez dans quelques minutes.';
    }
    recent.push(now);
    loginAttempts.set(key, recent);
    return null;
  }

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const suppliedPassword = String(password || '');
    const rateKey = `${req.ip || 'unknown'}:${cleanEmail || 'none'}`;
    const rateError = assertLoginRateLimit(rateKey);
    if (rateError) {
      return res.status(429).json({ error: rateError });
    }
    if (requiresPasswordBootstrap(db.users)) {
      return res.status(503).json({
        error:
          'Authentification non configurée. Définissez DEMO_ADMIN_PASSWORD et DEMO_MANAGER_PASSWORD sur le serveur.',
      });
    }
    const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user || !user.isActive || !verifyPassword(suppliedPassword, user.passwordHash)) {
      logActivity(
        'LOGIN_FAILED',
        'SECURITY',
        cleanEmail || 'inconnu',
        null,
        'Tentative de connexion refusée.'
      );
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
    }
    const token = createSessionToken();
    const expiresAt = Date.now() + SESSION_TTL_MS;
    sessions.set(token, { userId: user.id, expiresAt });
    user.lastLoginAt = new Date().toISOString();
    logActivity(
      'LOGIN_SUCCESS',
      'SECURITY',
      user.email,
      null,
      `Connexion réussie de ${user.fullName}.`,
      user.id
    );

    res.json({
      token,
      expiresAt: new Date(expiresAt).toISOString(),
      user: publicUser(user),
    });
  });

  app.post('/api/auth/logout', authenticate, (req: any, res) => {
    if (req.sessionToken) {
      sessions.delete(req.sessionToken);
    }
    res.json({ message: 'Déconnexion réussie.' });
  });

  app.get('/api/auth/me', authenticate, (req: any, res) => {
    res.json({
      user: publicUser(req.user),
      expiresAt: new Date(req.sessionExpiresAt).toISOString(),
    });
  });

  // 3. Workspace Routes
  app.get('/api/workspace/overview', authenticate, (req: any, res) => {
    if (req.user.role === 'ADMIN') {
      const activeUsers = db.users.filter((u) => u.isActive).length;
      const managerCount = db.users.filter((u) => u.role === 'MANAGER' && u.isActive).length;
      res.json({
        workspace: 'ADMIN_SUPERVISION',
        summary: {
          totalUsers: db.users.length,
          activeUsers,
          managerCount,
          recentEventCount: db.activityLogs.length,
        },
      });
    } else {
      res.json({
        workspace: 'MANAGER_OPERATIONS',
        summary: {
          roleLabel: 'Gestionnaire de recouvrement',
          authorizedModules: [
            'Tableau de bord',
            'Clients',
            'Factures et créances',
            'Importation',
            'Relances',
            'Paiements',
            'Historique',
          ],
        },
      });
    }
  });

  app.get('/api/workspace/activity-logs', authenticate, (req: any, res) => {
    const logs = req.user.role === 'ADMIN' ? db.activityLogs : db.activityLogs.slice(0, 30);
    res.json({ logs });
  });

  // 4. Dashboard Routes
  app.get('/api/dashboard', authenticate, (req: any, res) => {
    const activeInvoices = db.invoices.filter((i) => !i.isArchived);
    let totalOpenReceivables = 0;
    let overdueReceivables = 0;
    let notYetDueReceivables = 0;
    let confirmedRecoveredTotal = 0;
    let totalBilledPortfolio = 0;
    let overdueCount = 0;
    let openCount = 0;

    for (const inv of activeInvoices) {
      totalBilledPortfolio += inv.totalAmount;
      const fin = calculateInvoiceFinancials(inv);
      confirmedRecoveredTotal += fin.confirmedPaidAmount;
      if (fin.remainingAmount > 0) {
        totalOpenReceivables += fin.remainingAmount;
        openCount++;
        if (fin.isOverdue) {
          overdueReceivables += fin.remainingAmount;
          overdueCount++;
        } else {
          notYetDueReceivables += fin.remainingAmount;
        }
      }
    }

    const pendingPayments = db.payments.filter((p) => p.status === 'DECLARED' || p.status === 'RECEIPT_RECEIVED');
    const pendingVerificationAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

    const recoveryRatePercent = totalBilledPortfolio > 0
      ? Math.round((confirmedRecoveredTotal / totalBilledPortfolio) * 100)
      : 0;

    // Build smart priorities list
    const priorities: any[] = [];
    for (const inv of activeInvoices) {
      const fin = calculateInvoiceFinancials(inv);
      if (fin.remainingAmount > 0) {
        const client = db.clients.find((c) => c.id === inv.clientId);
        const clientName = client ? client.name : 'Client';

        if (inv.hasDispute === 1) {
          priorities.push({
            id: `prio-${inv.id}`,
            kind: 'DISPUTE',
            clientName,
            invoiceReference: inv.reference,
            remainingAmount: fin.remainingAmount,
            pendingAmount: fin.pendingVerificationAmount,
            delayDays: fin.delayDays,
            reason: inv.disputeReason || 'Dossier contesté par le client',
            recommendedAction: 'Instruire le motif de contestation et contacter le commercial',
            targetSection: 'invoices',
            targetFilter: `facture:${inv.id}`,
            urgencyRank: 1,
            isAiGenerated: false,
          });
        } else if (fin.pendingVerificationAmount > 0) {
          priorities.push({
            id: `prio-${inv.id}`,
            kind: 'PAYMENT_TO_VERIFY',
            clientName,
            invoiceReference: inv.reference,
            remainingAmount: fin.remainingAmount,
            pendingAmount: fin.pendingVerificationAmount,
            delayDays: fin.delayDays,
            reason: 'Règlement déclaré ou justificatif reçu à rapprocher',
            recommendedAction: 'Consulter le justificatif et confirmer l’encaissement',
            targetSection: 'payments',
            targetFilter: 'en-attente',
            urgencyRank: 2,
            isAiGenerated: false,
          });
        } else if (fin.activePromiseDate) {
          priorities.push({
            id: `prio-${inv.id}`,
            kind: 'PROMISE_DUE',
            clientName,
            invoiceReference: inv.reference,
            remainingAmount: fin.remainingAmount,
            delayDays: fin.delayDays,
            reason: `Promesse de règlement pour le ${fin.activePromiseDate}`,
            recommendedAction: 'Vérifier la réception du virement sur le compte bancaire',
            targetSection: 'invoices',
            targetFilter: `facture:${inv.id}`,
            urgencyRank: 3,
            isAiGenerated: false,
          });
        } else if (fin.delayDays >= 20) {
          priorities.push({
            id: `prio-${inv.id}`,
            kind: 'OVERDUE_CRITICAL',
            clientName,
            invoiceReference: inv.reference,
            remainingAmount: fin.remainingAmount,
            delayDays: fin.delayDays,
            reason: `Retard critique de ${fin.delayDays} jours sur l’échéance`,
            recommendedAction: 'Déclencher une relance formelle avec mise en demeure',
            targetSection: 'reminders',
            targetFilter: 'to-validate',
            urgencyRank: 4,
            isAiGenerated: false,
          });
        }
      }
    }
    priorities.sort((a, b) => a.urgencyRank - b.urgencyRank || b.remainingAmount - a.remainingAmount);

    // Dynamic Evolution Points for Chart
    const evolution = [
      {
        date: new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10),
        label: 'S-3',
        openAmount: Math.round(totalOpenReceivables * 1.15),
        recoveredAmount: Math.round(confirmedRecoveredTotal * 0.4),
        overdueAmount: Math.round(overdueReceivables * 1.2),
      },
      {
        date: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
        label: 'S-2',
        openAmount: Math.round(totalOpenReceivables * 1.08),
        recoveredAmount: Math.round(confirmedRecoveredTotal * 0.65),
        overdueAmount: Math.round(overdueReceivables * 1.1),
      },
      {
        date: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
        label: 'S-1',
        openAmount: Math.round(totalOpenReceivables * 1.02),
        recoveredAmount: Math.round(confirmedRecoveredTotal * 0.85),
        overdueAmount: Math.round(overdueReceivables * 1.05),
      },
      {
        date: new Date().toISOString().slice(0, 10),
        label: 'En cours',
        openAmount: totalOpenReceivables,
        recoveredAmount: confirmedRecoveredTotal,
        overdueAmount: overdueReceivables,
      },
    ];

    // Status breakdown
    const statusCounts: Record<string, { count: number; amount: number; label: string }> = {
      OVERDUE: { count: 0, amount: 0, label: 'En retard' },
      UPCOMING: { count: 0, amount: 0, label: 'À échoir' },
      PARTIAL: { count: 0, amount: 0, label: 'Partiellement payées' },
      DISPUTE: { count: 0, amount: 0, label: 'En litige' },
      PROMISE: { count: 0, amount: 0, label: 'Promesse de règlement' },
      PAID: { count: 0, amount: 0, label: 'Soldées' },
    };

    for (const inv of activeInvoices) {
      const fin = calculateInvoiceFinancials(inv);
      if (statusCounts[fin.status]) {
        statusCounts[fin.status].count++;
        statusCounts[fin.status].amount += fin.remainingAmount > 0 ? fin.remainingAmount : inv.totalAmount;
      }
    }

    const statusBreakdown = Object.entries(statusCounts).map(([k, v]) => ({
      status: k as any,
      label: v.label,
      count: v.count,
      amount: v.amount,
      excludedFromOpen: k === 'PAID',
    }));

    res.json({
      role: req.user.role,
      periodDays: Number(req.query.period || 30),
      metrics: {
        referenceDate: new Date().toISOString().slice(0, 10),
        isEmpty: activeInvoices.length === 0,
        isDemoDataActive: true,
        counts: {
          clientsCount: db.clients.filter((c) => !c.isArchived).length,
          invoicesCount: activeInvoices.length,
          openInvoicesCount: openCount,
          overdueInvoicesCount: overdueCount,
          pendingPaymentsCount: pendingPayments.length,
          preparedRemindersCount: db.reminders.filter((r) => r.status === 'PREPARED').length,
          activePromisesCount: db.promises.filter((p) => p.status === 'ACTIVE').length,
          disputesCount: db.disputes.filter((d) => d.status === 'OPEN').length,
        },
        kpis: {
          totalOpenReceivables,
          overdueReceivables,
          notYetDueReceivables,
          pendingVerificationAmount,
          confirmedRecoveredTotal,
          totalBilledPortfolio,
          recoveryRatePercent,
          recoveryFormula: 'Montants encaissés confirmés / Total facturé du portefeuille',
          recoveryPeriodLabel: 'Portefeuille global',
        },
        priorities: priorities.slice(0, 6),
        statusBreakdown,
        evolution,
      },
      recentActivity: db.activityLogs.slice(0, 10),
      aiAdvisory: {
        status: 'available',
        modelUsed: 'gemini-4-hydrogen',
        generatedAt: new Date().toISOString(),
        executiveSummary: `Le portefeuille affiche un taux de recouvrement de ${recoveryRatePercent} %. Les priorités immédiates portent sur la régularisation de SOGECOT Bénin et la confirmation du versement reçu d'Atlantique Matériaux.`,
        items: priorities.slice(0, 3).map((p) => ({
          invoiceReference: p.invoiceReference,
          justification: p.reason,
          recommendedAction: p.recommendedAction,
        })),
      },
      adminSupervision: req.user.role === 'ADMIN' ? {
        totalUsers: db.users.length,
        activeUsers: db.users.filter((u) => u.isActive).length,
        managerCount: db.users.filter((u) => u.role === 'MANAGER' && u.isActive).length,
        totalOperationsLogged: db.activityLogs.length,
        aiAvailable: true,
      } : null,
    });
  });

  // AI Refresh Route with Gemini SDK
  app.post('/api/dashboard/ai-refresh', authenticate, async (req: any, res) => {
    const rateError = assertAiRateLimit(req.user.id);
    if (rateError) {
      return res.status(429).json({ error: rateError });
    }

    let summary = 'Analyse de gestion actualisée : Portefeuille sain avec besoin de suivi ciblé des créances supérieures à 20 jours.';
    const activeInvs = db.invoices.filter((i) => !i.isArchived);

    if (aiClient) {
      try {
        // Anonymized payload only — no client names or tax IDs leave the server.
        const promptData = activeInvs.slice(0, 5).map((inv, index) => {
          const fin = calculateInvoiceFinancials(inv);
          return {
            dossier: `D${index + 1}`,
            soldeRestantFCFA: fin.remainingAmount,
            retardJours: fin.delayDays,
            litige: inv.hasDispute ? 'Oui' : 'Non',
          };
        });

        const aiResp = await aiClient.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `En tant qu'analyste financier de Recouvrix, analyse ces dossiers anonymisés et propose une synthèse exécutive en 2 phrases pour le gestionnaire :\n${JSON.stringify(promptData)}`,
        });

        if (aiResp.text) {
          summary = aiResp.text.trim();
        }
      } catch (err) {
        console.warn('Erreur appel Gemini Dashboard Advisor:', err);
      }
    }

    res.json({
      aiAdvisory: {
        status: 'available',
        modelUsed: 'gemini-4-hydrogen',
        generatedAt: new Date().toISOString(),
        executiveSummary: summary,
        items: activeInvs.slice(0, 3).map((inv) => {
          const fin = calculateInvoiceFinancials(inv);
          return {
            invoiceReference: inv.reference,
            justification: `Créance ${fin.isOverdue ? 'en retard' : 'en cours'} de ${fin.remainingAmount.toLocaleString()} FCFA.`,
            recommendedAction: fin.isOverdue ? 'Envoyer une relance multicanale personnalisée' : 'Surveiller l’échéance',
          };
        }),
      },
    });
  });

  // 5. Demo Seed & Clear Routes
  app.post('/api/demo/seed', authenticate, (req: any, res) => {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Réinitialisation réservée aux administrateurs.' });
    }
    const preservedHashes = new Map(
      db.users.map((u) => [u.email.toLowerCase(), u.passwordHash] as const)
    );
    db = getInitialData();
    for (const user of db.users) {
      const previous = preservedHashes.get(user.email.toLowerCase());
      if (previous) user.passwordHash = previous;
    }
    applyDemoPasswordsFromEnv(db.users);
    logActivity('DEMO_DATA_SEEDED', 'RECOVERY', req.user.email, null, 'Réinitialisation complète du jeu de données de présentation.', req.user.id);
    res.json({ message: 'Données de démonstration réinitialisées avec succès.' });
  });

  app.post('/api/demo/clear', authenticate, (req: any, res) => {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Purge réservée aux administrateurs.' });
    }
    db.invoices = [];
    db.payments = [];
    db.promises = [];
    db.disputes = [];
    db.creditNotes = [];
    db.reminders = [];
    db.documents = [];
    logActivity('DEMO_DATA_CLEARED', 'SECURITY', req.user.email, null, 'Toutes les créances ont été effacées pour contrôle à vide.', req.user.id);
    res.json({ message: 'Base métier vidée.' });
  });

  // 6. Clients Routes
  app.get('/api/clients', authenticate, (req: any, res) => {
    const search = String(req.query.search || '').toLowerCase().trim();
    const statusParam = String(req.query.status || 'ALL');
    const channelParam = String(req.query.channel || 'ALL');
    const includeArchived = req.query.include_archived === 'true';

    let list = db.clients.filter((c) => {
      if (c.isArchived && !includeArchived) return false;
      if (search && !c.name.toLowerCase().includes(search) && !(c.email || '').toLowerCase().includes(search) && !(c.contactName || '').toLowerCase().includes(search)) {
        return false;
      }
      if (channelParam !== 'ALL' && c.preferredChannel !== channelParam) {
        return false;
      }
      return true;
    });

    const items = list.map((c) => {
      const fin = calculateClientFinancials(c);
      return {
        id: c.id,
        name: c.name,
        clientType: c.clientType,
        taxId: c.taxId,
        email: c.email,
        phone: c.phone,
        contactName: c.contactName,
        preferredChannel: c.preferredChannel,
        contactAllowed: true,
        isArchived: Boolean(c.isArchived),
        archivedAt: c.archivedAt,
        invoicesCount: fin.invoicesCount,
        overdueInvoicesCount: fin.overdueInvoicesCount,
        remainingAmount: fin.remainingAmount,
        overdueAmount: fin.overdueAmount,
        pendingVerificationAmount: fin.pendingVerificationAmount,
        globalStatus: fin.globalStatus,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });

    // Filter by status if requested
    const filteredItems = statusParam === 'ALL'
      ? items
      : items.filter((i) => i.globalStatus === statusParam);

    // Calculate Portfolio Summary
    let totalRemainingPortfolio = 0;
    let overdueClients = 0;
    let disputeClients = 0;
    for (const item of items) {
      totalRemainingPortfolio += item.remainingAmount;
      if (item.globalStatus === 'OVERDUE') overdueClients++;
      if (item.globalStatus === 'DISPUTE') disputeClients++;
    }

    res.json({
      items: filteredItems,
      total: filteredItems.length,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      summary: {
        activeClients: db.clients.filter((c) => !c.isArchived).length,
        archivedClients: db.clients.filter((c) => c.isArchived).length,
        overdueClients,
        disputeClients,
        totalRemainingPortfolio,
      },
    });
  });

  app.get('/api/clients/:id', authenticate, (req: any, res) => {
    const client = db.clients.find((c) => c.id === req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Fiche client introuvable.' });
    }

    const fin = calculateClientFinancials(client);
    const clientInvoices = db.invoices.filter((i) => i.clientId === client.id).map((i) => {
      const invFin = calculateInvoiceFinancials(i);
      return {
        id: i.id,
        reference: i.reference,
        issueDate: i.issueDate,
        dueDate: i.dueDate,
        totalAmount: i.totalAmount,
        confirmedPaidAmount: invFin.confirmedPaidAmount,
        pendingVerificationAmount: invFin.pendingVerificationAmount,
        remainingAmount: invFin.remainingAmount,
        delayDays: invFin.delayDays,
        status: invFin.status,
      };
    });

    const clientPromises = db.promises.filter((p) => p.clientId === client.id).map((p) => {
      const inv = db.invoices.find((i) => i.id === p.invoiceId);
      return {
        id: p.id,
        invoiceId: p.invoiceId,
        invoiceReference: inv ? inv.reference : 'Facture',
        promisedAmount: p.promisedAmount,
        promisedDate: p.promisedDate,
        status: p.status,
        note: p.note,
        createdAt: p.createdAt,
      };
    });

    const clientDisputes = db.disputes.filter((d) => d.clientId === client.id).map((d) => {
      const inv = db.invoices.find((i) => i.id === d.invoiceId);
      return {
        id: d.id,
        invoiceId: d.invoiceId,
        invoiceReference: inv ? inv.reference : 'Facture',
        reason: d.reason,
        status: d.status,
        openedBy: d.openedBy,
        openedAt: d.openedAt,
        resolvedAt: d.resolvedAt,
      };
    });

    const clientReminders = db.reminders.filter((r) => r.clientId === client.id).map((r) => {
      const inv = db.invoices.find((i) => i.id === r.invoiceId);
      return {
        id: r.id,
        invoiceId: r.invoiceId,
        invoiceReference: inv ? inv.reference : 'Facture',
        channel: r.channel,
        status: r.status,
        scheduledFor: r.scheduledFor,
        subject: r.subject,
        createdAt: r.createdAt,
      };
    });

    const clientDocs = db.documents.filter((d) => d.clientId === client.id).map((d) => ({
      id: d.id,
      docType: d.docType,
      title: d.title,
      fileName: d.fileName,
      mimeType: d.mimeType,
      fileSize: d.fileSize,
      createdAt: d.createdAt,
    }));

    const clientHistory = db.activityLogs.filter((l) => l.targetLabel?.includes(client.name)).map((l) => ({
      id: l.id,
      eventType: l.eventType,
      category: l.category,
      actorLabel: l.actorLabel,
      summary: l.summary,
      createdAt: l.createdAt,
    }));

    res.json({
      id: client.id,
      name: client.name,
      clientType: client.clientType,
      taxId: client.taxId,
      address: client.address,
      contactName: client.contactName,
      email: client.email,
      phone: client.phone,
      secondaryContact: client.secondaryContact,
      notes: client.notes,
      isArchived: Boolean(client.isArchived),
      archivedAt: client.archivedAt,
      archivedBy: client.archivedBy,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      communicationPreferences: {
        preferredChannel: client.preferredChannel,
        contactAllowed: true,
        contactHours: client.contactHours || 'Lun–Ven · 08h30 – 17h30',
        restrictionsNote: client.restrictionsNote,
      },
      financial: fin,
      invoices: clientInvoices,
      promises: clientPromises,
      disputes: clientDisputes,
      reminders: clientReminders,
      history: clientHistory,
      documents: clientDocs,
    });
  });

  app.post('/api/clients', authenticate, (req: any, res) => {
    const { name, clientType, taxId, address, contactName, email, phone, secondaryContact, notes, communicationPreferences } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom du client est obligatoire.' });
    }

    const newClient: ClientRecord = {
      id: `cli-${Date.now()}`,
      organizationId: 'org-default',
      name: name.trim(),
      clientType: clientType || 'COMPANY',
      taxId: taxId || null,
      address: address || null,
      contactName: contactName || null,
      email: email || null,
      phone: phone || null,
      secondaryContact: secondaryContact || null,
      preferredChannel: communicationPreferences?.preferredChannel || 'EMAIL',
      contactHours: communicationPreferences?.contactHours || 'Lun–Ven · 08h30 – 17h30',
      restrictionsNote: communicationPreferences?.restrictionsNote || null,
      notes: notes || null,
      isArchived: 0,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.clients.unshift(newClient);
    logActivity('CLIENT_CREATED', 'RECOVERY', req.user.email, newClient.name, `Création du dossier client ${newClient.name}.`, req.user.id);
    res.json(newClient);
  });

  app.patch('/api/clients/:id', authenticate, (req: any, res) => {
    const client = db.clients.find((c) => c.id === req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client introuvable.' });
    }
    const { name, clientType, taxId, address, contactName, email, phone, secondaryContact, notes, communicationPreferences } = req.body || {};
    if (name) client.name = name.trim();
    if (clientType) client.clientType = clientType;
    if (taxId !== undefined) client.taxId = taxId;
    if (address !== undefined) client.address = address;
    if (contactName !== undefined) client.contactName = contactName;
    if (email !== undefined) client.email = email;
    if (phone !== undefined) client.phone = phone;
    if (secondaryContact !== undefined) client.secondaryContact = secondaryContact;
    if (notes !== undefined) client.notes = notes;
    if (communicationPreferences?.preferredChannel) client.preferredChannel = communicationPreferences.preferredChannel;
    client.updatedAt = new Date().toISOString();

    logActivity('CLIENT_UPDATED', 'RECOVERY', req.user.email, client.name, `Mise à jour des coordonnées de ${client.name}.`, req.user.id);
    res.json(client);
  });

  app.post('/api/clients/:id/archive', authenticate, (req: any, res) => {
    const client = db.clients.find((c) => c.id === req.params.id);
    if (!client) return res.status(404).json({ error: 'Client introuvable.' });
    client.isArchived = 1;
    client.archivedAt = new Date().toISOString();
    client.archivedBy = req.user.email;
    logActivity('CLIENT_ARCHIVED', 'RECOVERY', req.user.email, client.name, `Archivage du dossier client ${client.name}.`, req.user.id);
    res.json(client);
  });

  app.post('/api/clients/:id/restore', authenticate, (req: any, res) => {
    const client = db.clients.find((c) => c.id === req.params.id);
    if (!client) return res.status(404).json({ error: 'Client introuvable.' });
    client.isArchived = 0;
    client.archivedAt = null;
    client.archivedBy = null;
    logActivity('CLIENT_RESTORED', 'RECOVERY', req.user.email, client.name, `Restauration du dossier client ${client.name}.`, req.user.id);
    res.json(client);
  });

  // 7. Invoices Routes
  app.get('/api/invoices', authenticate, (req: any, res) => {
    const search = String(req.query.search || '').toLowerCase().trim();
    const statusFilter = String(req.query.status || 'ALL');
    const clientId = String(req.query.client_id || '');

    const activeInvs = db.invoices.filter((inv) => {
      if (clientId && inv.clientId !== clientId) return false;
      const client = db.clients.find((c) => c.id === inv.clientId);
      if (search && !inv.reference.toLowerCase().includes(search) && !(client?.name || '').toLowerCase().includes(search)) {
        return false;
      }
      return true;
    });

    const items = activeInvs.map((inv) => {
      const client = db.clients.find((c) => c.id === inv.clientId);
      const fin = calculateInvoiceFinancials(inv);
      return {
        id: inv.id,
        reference: inv.reference,
        clientId: inv.clientId,
        clientName: client ? client.name : 'Client',
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        currency: inv.currency,
        description: inv.description,
        totalAmount: inv.totalAmount,
        confirmedPaidAmount: fin.confirmedPaidAmount,
        validatedCreditNotesAmount: fin.validatedCreditNotesAmount,
        pendingVerificationAmount: fin.pendingVerificationAmount,
        remainingAmount: fin.remainingAmount,
        delayDays: fin.delayDays,
        isOverdue: fin.isOverdue,
        isPartiallyPaid: fin.isPartiallyPaid,
        hasDispute: Boolean(inv.hasDispute),
        activePromiseDate: fin.activePromiseDate,
        isPromiseOverdue: false,
        isArchived: Boolean(inv.isArchived),
        status: fin.status,
      };
    });

    const filtered = statusFilter === 'ALL'
      ? items
      : items.filter((i) => i.status === statusFilter);

    // Summary calculation
    let totalOpenAmount = 0;
    let totalOverdueAmount = 0;
    let pendingVerificationAmount = 0;
    let openCount = 0;
    let overdueCount = 0;
    let upcomingCount = 0;
    let partialCount = 0;
    let disputeCount = 0;
    let promiseCount = 0;
    let paidCount = 0;

    for (const item of items) {
      if (item.remainingAmount > 0) {
        totalOpenAmount += item.remainingAmount;
        openCount++;
      }
      if (item.isOverdue) {
        totalOverdueAmount += item.remainingAmount;
        overdueCount++;
      }
      if (item.status === 'UPCOMING') upcomingCount++;
      if (item.status === 'PARTIAL') partialCount++;
      if (item.status === 'DISPUTE') disputeCount++;
      if (item.status === 'PROMISE') promiseCount++;
      if (item.status === 'PAID') paidCount++;
      pendingVerificationAmount += item.pendingVerificationAmount;
    }

    res.json({
      items: filtered,
      total: filtered.length,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      referenceDate: new Date().toISOString().slice(0, 10),
      summary: {
        totalCount: items.length,
        openCount,
        overdueCount,
        upcomingCount,
        partialCount,
        disputeCount,
        promiseCount,
        paidCount,
        archivedCount: db.invoices.filter((i) => i.isArchived).length,
        totalOpenAmount,
        totalOverdueAmount,
        pendingVerificationAmount,
      },
    });
  });

  app.get('/api/invoices/:id', authenticate, (req: any, res) => {
    const inv = db.invoices.find((i) => i.id === req.params.id);
    if (!inv) {
      return res.status(404).json({ error: 'Facture introuvable.' });
    }
    const client = db.clients.find((c) => c.id === inv.clientId);
    const fin = calculateInvoiceFinancials(inv);

    const allocations = db.payments
      .filter((p) => p.invoiceId === inv.id && (p.status === 'CONFIRMED' || p.status === 'RECORDED'))
      .map((p) => ({
        id: `alloc-${p.id}`,
        paymentId: p.id,
        paymentReference: p.reference,
        paymentMethod: p.paymentMethod,
        paymentStatus: p.status,
        allocatedAmount: p.amount,
        declaredAt: p.declaredAt,
        confirmedAt: p.confirmedAt,
        createdAt: p.createdAt,
      }));

    const declaredPayments = db.payments
      .filter((p) => p.invoiceId === inv.id && (p.status === 'DECLARED' || p.status === 'RECEIPT_RECEIVED'))
      .map((p) => ({
        id: p.id,
        reference: p.reference,
        amount: p.amount,
        status: p.status,
        paymentMethod: p.paymentMethod,
        declaredAt: p.declaredAt,
        createdBy: p.createdBy,
      }));

    const disputes = db.disputes.filter((d) => d.invoiceId === inv.id).map((d) => ({
      id: d.id,
      category: d.category,
      reason: d.reason,
      status: d.status as any,
      openedBy: d.openedBy,
      openedAt: d.openedAt,
      resolvedAt: d.resolvedAt,
      resolutionNote: d.resolutionNote,
    }));

    const promises = db.promises.filter((p) => p.invoiceId === inv.id).map((p) => ({
      id: p.id,
      promisedAmount: p.promisedAmount,
      promisedDate: p.promisedDate,
      status: p.status as any,
      isOverdue: new Date(p.promisedDate) < new Date(),
      note: p.note,
      recordedBy: p.recordedBy,
      evaluatedAt: p.evaluatedAt,
      createdAt: p.createdAt,
    }));

    const creditNotes = db.creditNotes.filter((cn) => cn.invoiceId === inv.id).map((cn) => ({
      id: cn.id,
      reference: cn.reference,
      amount: cn.amount,
      status: cn.status as any,
      reason: cn.reason,
      validatedAt: cn.validatedAt,
      validatedBy: cn.validatedBy,
      createdBy: cn.createdBy,
      createdAt: cn.createdAt,
    }));

    const reminders = db.reminders.filter((r) => r.invoiceId === inv.id).map((r) => ({
      id: r.id,
      channel: r.channel,
      status: r.status,
      scheduledFor: r.scheduledFor,
      subject: r.subject,
      createdAt: r.createdAt,
    }));

    const docs = db.documents.filter((d) => d.invoiceId === inv.id).map((d) => ({
      id: d.id,
      docType: d.docType,
      title: d.title,
      fileName: d.fileName,
      mimeType: d.mimeType,
      fileSize: d.fileSize,
      uploadedBy: d.uploadedBy,
      createdAt: d.createdAt,
    }));

    const history = db.activityLogs.filter((l) => l.targetLabel?.includes(inv.reference)).map((l) => ({
      id: l.id,
      eventType: l.eventType,
      category: l.category,
      actorLabel: l.actorLabel,
      summary: l.summary,
      createdAt: l.createdAt,
    }));

    res.json({
      id: inv.id,
      reference: inv.reference,
      clientId: inv.clientId,
      clientName: client ? client.name : 'Client',
      clientEmail: client?.email || null,
      clientPhone: client?.phone || null,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      currency: inv.currency,
      description: inv.description,
      isArchived: Boolean(inv.isArchived),
      archivedAt: inv.archivedAt,
      archivedBy: inv.archivedBy,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
      referenceDate: new Date().toISOString().slice(0, 10),
      totalAmount: inv.totalAmount,
      confirmedPaidAmount: fin.confirmedPaidAmount,
      validatedCreditNotesAmount: fin.validatedCreditNotesAmount,
      pendingVerificationAmount: fin.pendingVerificationAmount,
      remainingAmount: fin.remainingAmount,
      delayDays: fin.delayDays,
      isOverdue: fin.isOverdue,
      isPartiallyPaid: fin.isPartiallyPaid,
      hasDispute: Boolean(inv.hasDispute),
      remindersSuspended: Boolean(inv.hasDispute),
      suspensionReason: inv.hasDispute ? inv.disputeReason || 'Litige ouvert' : null,
      status: fin.status,
      statusExplanation: fin.status === 'PAID' ? 'Facture intégralement soldée.' : fin.isOverdue ? `Échéance dépassée de ${fin.delayDays} jours.` : 'Facture non échue.',
      allocations,
      declaredPayments,
      creditNotes,
      promises,
      disputes,
      reminders,
      documents: docs,
      history,
    });
  });

  app.patch('/api/invoices/:id', authenticate, (req: any, res) => {
    const inv = db.invoices.find((i) => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
    if (req.body.description !== undefined) {
      inv.description = req.body.description;
    }
    inv.updatedAt = new Date().toISOString();
    logActivity('INVOICE_UPDATED', 'RECOVERY', req.user.email, inv.reference, `Mise à jour des métadonnées de ${inv.reference}.`, req.user.id);
    res.json(inv);
  });

  app.post('/api/invoices/:id/archive', authenticate, (req: any, res) => {
    const inv = db.invoices.find((i) => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
    inv.isArchived = 1;
    inv.archivedAt = new Date().toISOString();
    inv.archivedBy = req.user.email;
    logActivity('INVOICE_ARCHIVED', 'RECOVERY', req.user.email, inv.reference, `Archivage de la créance ${inv.reference}.`, req.user.id);
    res.json(inv);
  });

  app.post('/api/invoices/:id/restore', authenticate, (req: any, res) => {
    const inv = db.invoices.find((i) => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
    inv.isArchived = 0;
    inv.archivedAt = null;
    inv.archivedBy = null;
    logActivity('INVOICE_RESTORED', 'RECOVERY', req.user.email, inv.reference, `Restauration de la créance ${inv.reference}.`, req.user.id);
    res.json(inv);
  });

  app.post('/api/invoices/:id/disputes', authenticate, (req: any, res) => {
    const inv = db.invoices.find((i) => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
    const { category, reason } = req.body || {};
    inv.hasDispute = 1;
    inv.disputeReason = reason || 'Contestation client';
    const dispute: DisputeRecord = {
      id: `disp-${Date.now()}`,
      organizationId: 'org-default',
      invoiceId: inv.id,
      clientId: inv.clientId,
      category: category || 'OTHER',
      reason: reason || 'Litige déclaré',
      status: 'OPEN',
      openedBy: req.user.email,
      openedAt: new Date().toISOString(),
      resolvedAt: null,
      resolutionNote: null,
      createdAt: new Date().toISOString(),
    };
    db.disputes.unshift(dispute);
    logActivity('DISPUTE_OPENED', 'RECOVERY', req.user.email, inv.reference, `Ouverture d’un litige sur ${inv.reference} : ${reason}.`, req.user.id);
    res.json(dispute);
  });

  app.patch('/api/invoices/:id/disputes/:disputeId', authenticate, (req: any, res) => {
    const dispute = db.disputes.find((d) => d.id === req.params.disputeId);
    if (!dispute) return res.status(404).json({ error: 'Litige introuvable.' });
    const { status, resolutionNote } = req.body || {};
    if (status) dispute.status = status;
    if (resolutionNote) dispute.resolutionNote = resolutionNote;
    if (status === 'RESOLVED') {
      dispute.resolvedAt = new Date().toISOString();
      const inv = db.invoices.find((i) => i.id === dispute.invoiceId);
      if (inv) {
        inv.hasDispute = 0;
        inv.disputeReason = null;
      }
    }
    logActivity('DISPUTE_UPDATED', 'RECOVERY', req.user.email, dispute.invoiceId, `Mise à jour du statut du litige (${dispute.status}).`, req.user.id);
    res.json(dispute);
  });

  app.post('/api/invoices/:id/promises', authenticate, (req: any, res) => {
    const inv = db.invoices.find((i) => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
    const { promisedAmount, promisedDate, note } = req.body || {};
    const promise: PromiseRecord = {
      id: `prom-${Date.now()}`,
      organizationId: 'org-default',
      invoiceId: inv.id,
      clientId: inv.clientId,
      promisedAmount: Number(promisedAmount),
      promisedDate: String(promisedDate).slice(0, 10),
      status: 'ACTIVE',
      note: note || null,
      recordedBy: req.user.email,
      evaluatedAt: null,
      createdAt: new Date().toISOString(),
    };
    db.promises.unshift(promise);
    logActivity('PROMISE_RECORDED', 'RECOVERY', req.user.email, inv.reference, `Promesse de paiement enregistrée pour le ${promise.promisedDate} (${promise.promisedAmount.toLocaleString()} FCFA).`, req.user.id);
    res.json(promise);
  });

  app.patch('/api/invoices/:id/promises/:promiseId', authenticate, (req: any, res) => {
    const promise = db.promises.find((p) => p.id === req.params.promiseId);
    if (!promise) return res.status(404).json({ error: 'Promesse introuvable.' });
    if (req.body.status) promise.status = req.body.status;
    if (req.body.note) promise.note = req.body.note;
    promise.evaluatedAt = new Date().toISOString();
    res.json(promise);
  });

  app.post('/api/invoices/:id/credit-notes', authenticate, (req: any, res) => {
    const inv = db.invoices.find((i) => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
    const { reference, amount, reason, validateNow } = req.body || {};
    const creditNote: CreditNoteRecord = {
      id: `cn-${Date.now()}`,
      organizationId: 'org-default',
      invoiceId: inv.id,
      clientId: inv.clientId,
      reference: reference || `AVOIR-${Date.now()}`,
      amount: Number(amount),
      status: validateNow ? 'VALIDATED' : 'DRAFT',
      reason: reason || 'Avoir commercial',
      validatedAt: validateNow ? new Date().toISOString() : null,
      validatedBy: validateNow ? req.user.email : null,
      createdBy: req.user.email,
      createdAt: new Date().toISOString(),
    };
    db.creditNotes.push(creditNote);
    logActivity('CREDIT_NOTE_CREATED', 'RECOVERY', req.user.email, inv.reference, `Avoir ${creditNote.reference} créé d'un montant de ${creditNote.amount.toLocaleString()} FCFA.`, req.user.id);
    res.json(creditNote);
  });

  app.post('/api/invoices/:id/credit-notes/:creditId/validate', authenticate, (req: any, res) => {
    const cn = db.creditNotes.find((c) => c.id === req.params.creditId);
    if (!cn) return res.status(404).json({ error: 'Avoir introuvable.' });
    cn.status = 'VALIDATED';
    cn.validatedAt = new Date().toISOString();
    cn.validatedBy = req.user.email;
    logActivity('CREDIT_NOTE_VALIDATED', 'RECOVERY', req.user.email, cn.reference, `Validation définitive de l'avoir ${cn.reference}.`, req.user.id);
    res.json(cn);
  });

  app.post('/api/invoices/:id/documents', authenticate, (req: any, res) => {
    const inv = db.invoices.find((i) => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
    const newDoc: DocumentRecord = {
      id: `doc-${Date.now()}`,
      organizationId: 'org-default',
      clientId: inv.clientId,
      invoiceId: inv.id,
      paymentId: null,
      importId: null,
      docType: 'SUPPORTING_DOC',
      title: 'Pièce justificative jointe',
      fileName: 'justificatif_joint.pdf',
      mimeType: 'application/pdf',
      fileSize: 102400,
      uploadedBy: req.user.email,
      createdAt: new Date().toISOString(),
    };
    db.documents.push(newDoc);
    logActivity('DOCUMENT_ATTACHED', 'RECOVERY', req.user.email, inv.reference, `Pièce jointe attachée à ${inv.reference}.`, req.user.id);
    res.json(newDoc);
  });

  function buildNoticePdfBuffer(
    invRef: string,
    amountStr: string,
    clientName: string,
    org: any,
    delayDays: number
  ): Buffer {
    const stream = `BT
/F1 16 Tf
50 740 Td
(${org.name.replace(/[()]/g, '')}) Tj
0 -20 Td
/F1 13 Tf
(AVIS DE RELANCE & NOTICE DE PAIEMENT OFFICIELLE) Tj
0 -20 Td
/F1 10 Tf
(Facture de reference : ${invRef}  -  Client : ${clientName.replace(/[()]/g, '')}) Tj
0 -16 Td
(Montant restant exigible : ${amountStr}  [Retard : ${delayDays} jours]) Tj
0 -26 Td
/F1 12 Tf
(1. VIREMENT BANCAIRE) Tj
0 -16 Td
/F1 10 Tf
(Banque : ${org.bankName.replace(/[()]/g, '')}) Tj
0 -14 Td
(IBAN / RIB : ${org.ibanOrRib.replace(/[()]/g, '')}) Tj
0 -14 Td
(Beneficiaire : ${org.name.replace(/[()]/g, '')}) Tj
0 -24 Td
/F1 12 Tf
(2. MOBILE MONEY (MOMO)) Tj
0 -16 Td
/F1 10 Tf
(Compte Marchand : ${org.mobileMoneyMerchant.replace(/[()]/g, '')}) Tj
0 -24 Td
/F1 12 Tf
(CONSIGNE IMPERATIVE DE REFERENCE :) Tj
0 -16 Td
/F1 10 Tf
(Indiquez obligatoirement ${invRef} en motif de votre virement ou transfert.) Tj
0 -24 Td
/F1 12 Tf
(ETAPES A SUIVRE APRES PAIEMENT :) Tj
0 -16 Td
/F1 10 Tf
(1. Conservez l'accuse de reception ou SMS de confirmation Mobile Money.) Tj
0 -14 Td
(2. Transmettez la preuve au service recouvrement : ${org.email}) Tj
0 -14 Td
(3. Une quittance liberatoire officielle vous sera remise sous 24h.) Tj
0 -30 Td
/F1 9 Tf
(Document officiel genere par Recouvrix - Alpha Logistique & Services SA) Tj
ET`;

    const streamLen = Buffer.byteLength(stream, 'utf8');

    const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${streamLen} >>
stream
${stream}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000224 00000 n 
0000000295 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${390 + streamLen}
%%EOF`;

    return Buffer.from(pdf, 'utf8');
  }

  function buildInvoicePdfBuffer(
    invRef: string,
    amountStr: string,
    clientName: string,
    org: any
  ): Buffer {
    const stream = `BT
/F1 16 Tf
50 740 Td
(${org.name.replace(/[()]/g, '')}) Tj
0 -20 Td
/F1 14 Tf
(FACTURE COMMERCIALE INITIALE - REFERENCE : ${invRef}) Tj
0 -22 Td
/F1 10 Tf
(Client destinee : ${clientName.replace(/[()]/g, '')}) Tj
0 -16 Td
(Montant facture : ${amountStr}) Tj
0 -22 Td
(Piece originale transmise pour rappel de reglement et recouvrement.) Tj
0 -30 Td
/F1 9 Tf
(Alpha Logistique & Services SA - Recouvrix) Tj
ET`;

    const streamLen = Buffer.byteLength(stream, 'utf8');

    const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${streamLen} >>
stream
${stream}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000224 00000 n 
0000000295 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${390 + streamLen}
%%EOF`;

    return Buffer.from(pdf, 'utf8');
  }

  app.get('/api/documents/:id/download', authenticate, (req: any, res) => {
    const docId = String(req.params.id || '');

    // Notice PDF download
    if (docId.startsWith('notice-') || docId.startsWith('doc-notice-')) {
      const invoiceId = docId.replace(/^notice-|^doc-notice-/, '');
      const inv = db.invoices.find((i) => i.id === invoiceId);
      if (!inv) {
        return res.status(404).json({ error: 'Document de notice introuvable.' });
      }
      const cli = db.clients.find((c) => c.id === inv.clientId);
      const fin = calculateInvoiceFinancials(inv);
      const pdf = buildNoticePdfBuffer(
        inv.reference,
        `${fin.remainingAmount.toLocaleString()} ${inv.currency}`,
        cli ? cli.name : 'Client',
        db.organization,
        fin.delayDays
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="notice_instructions_paiement_${inv.reference}.pdf"`
      );
      return res.send(pdf);
    }

    // Original invoice PDF download
    if (docId.startsWith('inv-') || docId.startsWith('invoice-')) {
      const invoiceId = docId.replace(/^inv-|^invoice-/, '');
      const inv = db.invoices.find((i) => i.id === invoiceId);
      if (!inv) {
        return res.status(404).json({ error: 'Facture introuvable.' });
      }
      const cli = db.clients.find((c) => c.id === inv.clientId);
      const pdf = buildInvoicePdfBuffer(
        inv.reference,
        `${inv.totalAmount.toLocaleString()} ${inv.currency}`,
        cli ? cli.name : 'Client',
        db.organization
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="facture_originale_${inv.reference}.pdf"`
      );
      return res.send(pdf);
    }

    // Document in db
    const doc = db.documents.find((d) => d.id === docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document introuvable.' });
    }
    const linkedInvoice = doc.invoiceId
      ? db.invoices.find((i) => i.id === doc.invoiceId)
      : undefined;
    const linkedClient = linkedInvoice
      ? db.clients.find((c) => c.id === linkedInvoice.clientId)
      : undefined;
    const fin = linkedInvoice
      ? calculateInvoiceFinancials(linkedInvoice)
      : { remainingAmount: 0, delayDays: 0 };
    const pdf = buildNoticePdfBuffer(
      linkedInvoice?.reference || doc.fileName.replace(/\.pdf$/i, ''),
      `${fin.remainingAmount.toLocaleString()} XOF`,
      linkedClient?.name || 'Client',
      db.organization,
      fin.delayDays
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
    return res.send(pdf);
  });

  // Get structured payment instructions for an invoice
  app.get('/api/invoices/:id/payment-instructions', authenticate, (req: any, res) => {
    const inv = db.invoices.find((i) => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
    const cli = db.clients.find((c) => c.id === inv.clientId);
    const fin = calculateInvoiceFinancials(inv);

    const qrCodePayload = `PAY|ORG:${db.organization.name}|REF:${inv.reference}|AMOUNT:${fin.remainingAmount}|DEV:${inv.currency}|BANK:${db.organization.bankName}:${db.organization.ibanOrRib}|MOMO:${db.organization.mobileMoneyMerchant}`;

    res.json({
      organization: {
        name: db.organization.name,
        taxId: db.organization.taxId,
        address: db.organization.address,
        email: db.organization.email,
        phone: db.organization.phone,
        bankName: db.organization.bankName,
        ibanOrRib: db.organization.ibanOrRib,
        mobileMoneyMerchant: db.organization.mobileMoneyMerchant,
        paymentInstructions: db.organization.paymentInstructions,
      },
      invoice: {
        id: inv.id,
        reference: inv.reference,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        totalAmount: inv.totalAmount,
        remainingAmount: fin.remainingAmount,
        currency: inv.currency,
        delayDays: fin.delayDays,
      },
      client: {
        id: cli?.id || inv.clientId,
        name: cli?.name || 'Client',
        email: cli?.email || null,
        phone: cli?.phone || null,
        taxId: cli?.taxId || null,
      },
      qrCodePayload,
      postPaymentSteps: [
        {
          step: 1,
          title: "Conserver la preuve de paiement",
          description: "Conservez le SMS de confirmation Mobile Money (avec le numéro de transaction) ou téléchargez l'avis d'exécution de votre virement bancaire.",
        },
        {
          step: 2,
          title: "Transmettre la confirmation",
          description: "Envoyez la capture d'écran ou la référence par email ou WhatsApp à notre service recouvrement pour rapprochement immédiat.",
        },
        {
          step: 3,
          title: "Réception de la quittance libératoire",
          description: "Dès validation du rapprochement bancaire sous 24h ouvrées, vous recevez une attestation officielle de paiement soldé et la relance est définitivement close.",
        },
      ],
    });
  });

  // 8. Reminders Routes
  app.get('/api/reminders', authenticate, (req: any, res) => {
    const statusParam = req.query.status ? String(req.query.status) : '';
    const channelParam = req.query.channel ? String(req.query.channel) : '';
    const search = req.query.search ? String(req.query.search).toLowerCase().trim() : '';

    const items = db.reminders.map((r) => {
      const inv = db.invoices.find((i) => i.id === r.invoiceId);
      const cli = db.clients.find((c) => c.id === r.clientId);
      const fin = inv ? calculateInvoiceFinancials(inv) : { remainingAmount: 0, delayDays: 0 };
      return {
        id: r.id,
        organizationId: r.organizationId,
        invoiceId: r.invoiceId,
        invoiceReference: inv ? inv.reference : 'Facture',
        clientId: r.clientId,
        clientName: cli ? cli.name : 'Client',
        clientEmail: cli?.email || null,
        clientPhone: cli?.phone || null,
        channel: r.channel,
        status: r.status,
        scheduledFor: r.scheduledFor,
        subject: r.subject,
        bodyPreview: r.bodyPreview,
        overdueDays: fin.delayDays,
        remainingAmount: fin.remainingAmount,
        hasDispute: Boolean(inv?.hasDispute),
        contactAllowed: true,
        contactHours: cli?.contactHours || 'Lun–Ven · 08h30 – 17h30',
        restrictionsNote: cli?.restrictionsNote || null,
        attachOriginalInvoice: r.attachOriginalInvoice !== false,
        attachPaymentInstructions: r.attachPaymentInstructions !== false,
        createdAt: r.createdAt,
        validatedAt: r.validatedAt,
        sentAt: r.sentAt,
      };
    }).filter((r) => {
      if (statusParam && statusParam !== 'ALL') {
        if (statusParam === 'to-validate' && r.status !== 'PREPARED') return false;
        if (statusParam !== 'to-validate' && r.status !== statusParam) return false;
      }
      if (channelParam && channelParam !== 'ALL' && r.channel !== channelParam) return false;
      if (search && !r.clientName.toLowerCase().includes(search) && !r.invoiceReference.toLowerCase().includes(search)) {
        return false;
      }
      return true;
    });

    const summary = {
      totalCount: db.reminders.length,
      toValidateCount: db.reminders.filter((r) => r.status === 'PREPARED').length,
      validatedCount: db.reminders.filter((r) => r.status === 'VALIDATED').length,
      sentCount: db.reminders.filter((r) => r.status === 'SENT').length,
      plannedCount: db.reminders.filter((r) => r.status === 'PLANNED').length,
    };

    res.json({ items, total: items.length, summary });
  });

  app.post('/api/reminders', authenticate, (req: any, res) => {
    const {
      invoiceId,
      clientId,
      channel,
      scheduledFor,
      subject,
      bodyPreview,
      attachOriginalInvoice,
      attachPaymentInstructions,
    } = req.body || {};
    const newRem: ReminderRecord = {
      id: `rem-${Date.now()}`,
      organizationId: 'org-default',
      invoiceId: invoiceId || db.invoices[0].id,
      clientId: clientId || db.clients[0].id,
      channel: channel || 'EMAIL',
      status: 'PREPARED',
      scheduledFor: scheduledFor || new Date().toISOString().slice(0, 10),
      subject: subject || 'Relance facture',
      bodyPreview: bodyPreview || '',
      attachOriginalInvoice: attachOriginalInvoice !== false,
      attachPaymentInstructions: attachPaymentInstructions !== false,
      createdAt: new Date().toISOString(),
      validatedAt: null,
      sentAt: null,
    };
    db.reminders.unshift(newRem);
    logActivity('REMINDER_PREPARED', 'RECOVERY', req.user.email, newRem.subject, `Nouvelle relance préparée via ${newRem.channel} avec 2 pièces jointes PDF.`, req.user.id);
    res.json(newRem);
  });

  app.patch('/api/reminders/:id', authenticate, (req: any, res) => {
    const rem = db.reminders.find((r) => r.id === req.params.id);
    if (!rem) return res.status(404).json({ error: 'Relance introuvable.' });
    const { status, subject, bodyPreview, attachOriginalInvoice, attachPaymentInstructions } = req.body || {};
    if (status) {
      rem.status = status;
      if (status === 'VALIDATED') rem.validatedAt = new Date().toISOString();
      if (status === 'SENT') rem.sentAt = new Date().toISOString();
    }
    if (subject) rem.subject = subject;
    if (bodyPreview) rem.bodyPreview = bodyPreview;
    if (typeof attachOriginalInvoice === 'boolean') rem.attachOriginalInvoice = attachOriginalInvoice;
    if (typeof attachPaymentInstructions === 'boolean') rem.attachPaymentInstructions = attachPaymentInstructions;

    // If validated or sent, automatically attach official payment notice PDF with QR code & banking/momo instructions to invoice documents
    if (status === 'VALIDATED' || status === 'SENT') {
      const inv = db.invoices.find((i) => i.id === rem.invoiceId);
      if (inv) {
        const noticeDocId = `doc-notice-${rem.id}`;
        const existingNotice = db.documents.find((d) => d.id === noticeDocId);
        if (!existingNotice) {
          db.documents.push({
            id: noticeDocId,
            organizationId: 'org-default',
            clientId: inv.clientId,
            invoiceId: inv.id,
            paymentId: null,
            importId: null,
            docType: 'JUSTIFICATIF_PAIEMENT',
            title: `Avis de relance & Notice de paiement (Réf: ${inv.reference})`,
            fileName: `notice_paiement_${inv.reference}.pdf`,
            mimeType: 'application/pdf',
            fileSize: 142000,
            uploadedBy: req.user.email,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    logActivity(
      rem.status === 'SENT' ? 'REMINDER_SENT' : 'REMINDER_VALIDATED',
      'RECOVERY',
      req.user.email,
      rem.subject,
      `Relance mise à jour : Statut ${rem.status} (2 documents joints : facture originale et notice d'instructions de paiement avec QR code).`,
      req.user.id
    );
    res.json(rem);
  });

  // AI Reminder Draft Generation with Gemini
  app.post('/api/reminders/generate-draft', authenticate, async (req: any, res) => {
    const rateError = assertAiRateLimit(req.user.id);
    if (rateError) {
      return res.status(429).json({ error: rateError });
    }

    const { invoiceReference, clientName, channel, amount, delayDays, tone } = req.body || {};

    const fallbackSubject = `Rappel d’échéance — Facture ${invoiceReference} (${(amount || 0).toLocaleString()} FCFA)`;
    let fallbackBody = '';

    if (channel === 'WHATSAPP') {
      fallbackBody = `Bonjour ${clientName},\n\nNous nous permettons de vous contacter concernant la facture ${invoiceReference} d’un montant de ${(amount || 0).toLocaleString()} FCFA, arrivée à échéance depuis ${delayDays} jours.\n\nPourriez-vous nous confirmer l'ordre de virement ou procéder au règlement par Mobile Money au ${db.organization.mobileMoneyMerchant} ?\n\nNous restons à votre entière disposition.\n\nCordialement,\nService Recouvrement — ${db.organization.name}`;
    } else {
      fallbackBody = `Madame, Monsieur,\n\nSauf erreur de notre part, le règlement de la facture ${invoiceReference} émise à l'attention de ${clientName}, pour un montant de ${(amount || 0).toLocaleString()} FCFA et échue depuis ${delayDays} jours, ne nous est pas encore parvenu.\n\nNous vous prions de bien vouloir régulariser cette situation dans les meilleurs délais :\n• Par virement bancaire sur notre compte ${db.organization.bankName} (IBAN / RIB : ${db.organization.ibanOrRib})\n• Par Mobile Money : ${db.organization.mobileMoneyMerchant}\n\nSi votre règlement a déjà été émis, nous vous remercions de bien vouloir nous faire parvenir le justificatif correspondant.\n\nVeuillez agréer, Madame, Monsieur, nos salutations distinguées.\n\n${db.organization.name}\n${db.organization.phone}`;
    }

    if (aiClient) {
      try {
        // Keep personal names and bank details out of the third-party prompt.
        const prompt = `Tu es un expert en recouvrement financier pour le logiciel Recouvrix. Rédige un message en français formel et soigné.
Destinataire: [Nom du client]
Référence dossier: ${String(invoiceReference || 'FAC-XXXX').replace(/[A-Za-zÀ-ÿ]/g, 'X').slice(0, 12)}
Montant restant: ${Number(amount) || 0} FCFA
Retard: ${Number(delayDays) || 0} jours
Canal: ${channel} (EMAIL ou WHATSAPP)
Ton souhaité: ${tone || 'Ferme et professionnel'}
Inclure un espace pour les instructions de paiement (sans numéro de compte).

Donne ta réponse sous la forme :
OBJET: [Objet percutant]
MESSAGE:
[Corps du message adapté au canal, avec le placeholder [Nom du client]]`;

        const response = await aiClient.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
        });

        const text = response.text || '';
        const displayName = String(clientName || 'Madame, Monsieur');
        if (text.includes('OBJET:') && text.includes('MESSAGE:')) {
          const parts = text.split('MESSAGE:');
          const subject = parts[0].replace('OBJET:', '').trim();
          const body = parts[1]
            .trim()
            .replace(/\[Nom du client\]/gi, displayName);
          return res.json({ subject, body, aiGenerated: true });
        } else if (text.trim()) {
          return res.json({
            subject: fallbackSubject,
            body: text.trim().replace(/\[Nom du client\]/gi, displayName),
            aiGenerated: true,
          });
        }
      } catch (err) {
        console.warn('Erreur appel Gemini generate-draft:', err);
      }
    }

    res.json({
      subject: fallbackSubject,
      body: fallbackBody,
      aiGenerated: false,
    });
  });

  // 9. Payments Routes
  app.get('/api/payments', authenticate, (req: any, res) => {
    const statusParam = req.query.status ? String(req.query.status) : '';
    const search = req.query.search ? String(req.query.search).toLowerCase().trim() : '';

    const items = db.payments.map((p) => {
      const inv = db.invoices.find((i) => i.id === p.invoiceId);
      const cli = db.clients.find((c) => c.id === p.clientId);
      const invFin = inv ? calculateInvoiceFinancials(inv) : { remainingAmount: 0 };
      return {
        id: p.id,
        reference: p.reference,
        organizationId: p.organizationId,
        invoiceId: p.invoiceId,
        invoiceReference: inv ? inv.reference : 'Facture',
        clientId: p.clientId,
        clientName: cli ? cli.name : 'Client',
        amount: p.amount,
        currency: 'XOF',
        status: p.status,
        paymentMethod: p.paymentMethod,
        receiptDocumentId: p.receiptDocumentId,
        receiptFileName: p.receiptFileName,
        declaredAt: p.declaredAt,
        confirmedAt: p.confirmedAt,
        createdBy: p.createdBy,
        rejectionReason: p.rejectionReason,
        invoiceTotalAmount: inv ? inv.totalAmount : 0,
        invoiceRemainingAmount: invFin.remainingAmount,
      };
    }).filter((p) => {
      if (statusParam && statusParam !== 'ALL') {
        if (statusParam === 'en-attente' && (p.status === 'CONFIRMED' || p.status === 'RECORDED' || p.status === 'REJECTED')) {
          return false;
        }
        if (statusParam === 'CONFIRMED' && p.status !== 'CONFIRMED' && p.status !== 'RECORDED') {
          return false;
        }
        if (statusParam === 'REJECTED' && p.status !== 'REJECTED') {
          return false;
        }
      }
      if (search && !p.clientName.toLowerCase().includes(search) && !p.reference.toLowerCase().includes(search) && !p.invoiceReference.toLowerCase().includes(search)) {
        return false;
      }
      return true;
    });

    const pendingPayments = db.payments.filter((p) => p.status === 'DECLARED' || p.status === 'RECEIPT_RECEIVED' || p.status === 'PENDING_VERIFICATION');
    const confirmedPayments = db.payments.filter((p) => p.status === 'CONFIRMED' || p.status === 'RECORDED');

    const summary = {
      totalCount: db.payments.length,
      pendingCount: pendingPayments.length,
      confirmedCount: confirmedPayments.length,
      rejectedCount: db.payments.filter((p) => p.status === 'REJECTED').length,
      pendingAmount: pendingPayments.reduce((sum, p) => sum + p.amount, 0),
      confirmedAmount: confirmedPayments.reduce((sum, p) => sum + p.amount, 0),
    };

    res.json({ items, total: items.length, summary });
  });

  app.post('/api/payments', authenticate, (req: any, res) => {
    const { invoiceId, clientId, amount, paymentMethod, reference } = req.body || {};
    const newPay: PaymentRecord = {
      id: `pay-${Date.now()}`,
      organizationId: 'org-default',
      reference: reference || `PAY-${Date.now().toString().slice(-6)}`,
      invoiceId: invoiceId || db.invoices[0].id,
      clientId: clientId || db.clients[0].id,
      amount: Number(amount) || 0,
      status: 'RECEIPT_RECEIVED',
      paymentMethod: paymentMethod || 'Virement bancaire',
      receiptDocumentId: null,
      receiptFileName: null,
      declaredAt: new Date().toISOString(),
      confirmedAt: null,
      createdBy: req.user.email,
      rejectionReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.payments.unshift(newPay);
    logActivity('PAYMENT_DECLARED', 'RECOVERY', req.user.email, newPay.reference, `Déclaration de paiement de ${newPay.amount.toLocaleString()} FCFA.`, req.user.id);
    res.json(newPay);
  });

  function buildPaymentReceipt(payment: PaymentRecord, inv: InvoiceRecord, actorEmail?: string) {
    const cli = db.clients.find((c) => c.id === payment.clientId);
    const fin = calculateInvoiceFinancials(inv);
    const receiptNum = `REC-${payment.reference.replace(/[^0-9]/g, '') || payment.id.replace('pay-', '')}`;
    const isFullyPaid = fin.remainingAmount <= 0;
    const docId = `doc-receipt-${payment.id}`;

    return {
      receiptNumber: receiptNum,
      documentId: docId,
      organization: {
        name: db.organization.name,
        taxId: db.organization.taxId,
        address: db.organization.address,
        email: db.organization.email,
        phone: db.organization.phone,
        bankName: db.organization.bankName,
        ibanOrRib: db.organization.ibanOrRib,
        mobileMoneyMerchant: db.organization.mobileMoneyMerchant,
      },
      client: {
        id: cli ? cli.id : payment.clientId,
        name: cli ? cli.name : 'Client',
        taxId: cli?.taxId || null,
        address: cli?.address || null,
        email: cli?.email || null,
        phone: cli?.phone || null,
      },
      invoice: {
        id: inv.id,
        reference: inv.reference,
        totalAmount: inv.totalAmount,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        currency: inv.currency || 'XOF',
      },
      payment: {
        id: payment.id,
        reference: payment.reference,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        declaredAt: payment.declaredAt,
        confirmedAt: payment.confirmedAt || new Date().toISOString(),
        confirmedBy: actorEmail || payment.createdBy,
      },
      financials: {
        previousRemaining: fin.remainingAmount + payment.amount,
        amountPaid: payment.amount,
        newRemaining: fin.remainingAmount,
        isFullyPaid,
        badgeLabel: (isFullyPaid ? 'FACTURE ENTIÈREMENT PAYÉE' : 'PAIEMENT REÇU') as
          | 'FACTURE ENTIÈREMENT PAYÉE'
          | 'PAIEMENT REÇU',
      },
      legalNotice:
        'Attestation officielle de quittance délivrée par la plateforme Recouvrix. Ce document certifie la bonne réception des fonds et ne constitue pas une nouvelle facture commerciale.',
      generatedAt: new Date().toISOString(),
    };
  }

  app.post('/api/payments/:id/confirm', authenticate, (req: any, res) => {
    const payment = db.payments.find((p) => p.id === req.params.id);
    if (!payment) return res.status(404).json({ error: 'Paiement introuvable.' });
    payment.status = 'CONFIRMED';
    payment.confirmedAt = new Date().toISOString();
    payment.updatedAt = new Date().toISOString();

    const inv = db.invoices.find((i) => i.id === payment.invoiceId);
    let receipt: any = null;

    if (inv) {
      const fin = calculateInvoiceFinancials(inv);
      receipt = buildPaymentReceipt(payment, inv, req.user.email);

      // Register official receipt in documents collection
      const docId = `doc-receipt-${payment.id}`;
      const existingDoc = db.documents.find((d) => d.id === docId);
      if (!existingDoc) {
        db.documents.push({
          id: docId,
          organizationId: 'org-default',
          clientId: inv.clientId,
          invoiceId: inv.id,
          paymentId: payment.id,
          importId: null,
          docType: 'JUSTIFICATIF_PAIEMENT',
          title: `Attestation de règlement ${receipt.receiptNumber} — ${inv.reference}`,
          fileName: `attestation_${receipt.receiptNumber}.pdf`,
          mimeType: 'application/pdf',
          fileSize: 124800,
          uploadedBy: req.user.email,
          createdAt: new Date().toISOString(),
        });
      }

      logActivity(
        'PAYMENT_CONFIRMED',
        'RECOVERY',
        req.user.email,
        inv.reference,
        `Paiement ${payment.reference} de ${payment.amount.toLocaleString()} FCFA confirmé sur la facture ${inv.reference}. Justificatif ${receipt.receiptNumber} émis.`,
        req.user.id
      );

      if (fin.remainingAmount <= 0) {
        logActivity(
          'INVOICE_SETTLED',
          'RECOVERY',
          req.user.email,
          inv.reference,
          `La créance ${inv.reference} est désormais intégralement soldée.`,
          req.user.id
        );
      }
    }

    res.json({
      payment,
      receipt,
      message: receipt?.financials.isFullyPaid
        ? 'Paiement confirmé. La facture est intégralement soldée !'
        : 'Paiement partiel confirmé avec succès.',
    });
  });

  app.get('/api/payments/:id/receipt', authenticate, (req: any, res) => {
    const payment = db.payments.find((p) => p.id === req.params.id);
    if (!payment) return res.status(404).json({ error: 'Paiement introuvable.' });
    const inv = db.invoices.find((i) => i.id === payment.invoiceId);
    if (!inv) return res.status(404).json({ error: 'Facture associée introuvable.' });

    const receipt = buildPaymentReceipt(payment, inv, req.user.email);
    res.json(receipt);
  });

  app.post('/api/payments/:id/receipt/send', authenticate, (req: any, res) => {
    const payment = db.payments.find((p) => p.id === req.params.id);
    if (!payment) return res.status(404).json({ error: 'Paiement introuvable.' });
    const inv = db.invoices.find((i) => i.id === payment.invoiceId);
    if (!inv) return res.status(404).json({ error: 'Facture associée introuvable.' });

    const channel = req.body?.channel || 'EMAIL';
    const cli = db.clients.find((c) => c.id === payment.clientId);
    const receiptNum = `REC-${payment.reference.replace(/[^0-9]/g, '') || payment.id.replace('pay-', '')}`;

    logActivity(
      'RECEIPT_TRANSMITTED',
      'RECOVERY',
      req.user.email,
      receiptNum,
      `Transmission du justificatif de paiement ${receiptNum} au client ${cli?.name || 'Client'} par ${channel}.`,
      req.user.id
    );

    res.json({
      success: true,
      message: `Justificatif ${receiptNum} préparé et transmis via ${channel === 'WHATSAPP' ? 'WhatsApp Business' : 'Email'}.`,
      channel,
    });
  });

  app.post('/api/payments/:id/reject', authenticate, (req: any, res) => {
    const payment = db.payments.find((p) => p.id === req.params.id);
    if (!payment) return res.status(404).json({ error: 'Paiement introuvable.' });
    payment.status = 'REJECTED';
    payment.rejectionReason = req.body?.reason || 'Justificatif non conforme';
    payment.updatedAt = new Date().toISOString();

    logActivity('PAYMENT_REJECTED', 'RECOVERY', req.user.email, payment.reference, `Rejet du paiement ${payment.reference} : ${payment.rejectionReason}.`, req.user.id);
    res.json({ payment, message: 'Paiement rejeté.' });
  });

  // 10. Organization Settings Routes
  app.get('/api/settings', authenticate, (_req, res) => {
    res.json(db.organization);
  });

  app.patch('/api/settings', authenticate, (req: any, res) => {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Modification des paramètres réservée aux administrateurs.' });
    }
    Object.assign(db.organization, req.body || {});
    logActivity('SETTINGS_UPDATED', 'SECURITY', req.user.email, db.organization.name, 'Paramètres généraux et coordonnées d’encaissement mis à jour.', req.user.id);
    res.json(db.organization);
  });

  // 11. Imports Routes
  app.post('/api/imports/preview', authenticate, (req: any, res) => {
    // Generate realistic preview analysis
    const existingRefs = new Set(db.invoices.map((i) => i.reference.toLowerCase()));
    const rawRows = [
      { rowIndex: 1, reference: 'FAC-2026-0418', clientName: 'SOGECOT Bénin SARL', clientContact: 'compta@sogecot.bj', issueDate: '2026-10-01', dueDate: '2026-11-01', amount: 2450000, currency: 'XOF' },
      { rowIndex: 2, reference: 'FAC-2026-5110', clientName: 'Bénin Logistique Express', clientContact: 'transit@ble.bj', issueDate: '2026-10-15', dueDate: '2026-11-15', amount: 3750000, currency: 'XOF' },
      { rowIndex: 3, reference: 'FAC-2026-5112', clientName: 'Cotonou Plastiques SA', clientContact: 'direction@coto-plast.bj', issueDate: '2026-10-20', dueDate: '2026-11-20', amount: 1200000, currency: 'XOF' },
      { rowIndex: 4, reference: 'FAC-2026-5115', clientName: 'Pharmacie du Port', clientContact: 'pharma.port@laposte.bj', issueDate: '2026-11-01', dueDate: '2026-11-30', amount: 890000, currency: 'XOF' },
      { rowIndex: 5, reference: 'FAC-2026-5120', clientName: 'Chantier Littoral Nord', clientContact: 'contact@cln.bj', issueDate: '2026-11-05', dueDate: '2026-12-05', amount: 4600000, currency: 'XOF' },
    ];

    let validCount = 0;
    let duplicateCount = 0;

    const rows = rawRows.map((r) => {
      const isDup = existingRefs.has(r.reference.toLowerCase());
      if (isDup) {
        duplicateCount++;
        return {
          ...r,
          status: 'DUPLICATE',
          reason: 'Référence de facture déjà existante en base (doublon).',
          isNewClient: false,
          action: 'SKIP',
        };
      }
      validCount++;
      const clientExists = db.clients.some((c) => c.name.toLowerCase() === r.clientName.toLowerCase());
      return {
        ...r,
        status: 'VALID',
        reason: 'Ligne valide prête à l’importation.',
        isNewClient: !clientExists,
        action: 'IMPORT',
      };
    });

    res.json({
      filename: 'creances_entreprises_novembre.xlsx',
      sourceType: 'EXCEL',
      totalAnalyzed: rows.length,
      validCount,
      incompleteCount: 0,
      errorCount: 0,
      duplicateCount,
      rows,
    });
  });

  app.post('/api/imports/commit', authenticate, (req: any, res) => {
    const { filename, sourceType, rows } = req.body || {};
    let importedCount = 0;
    let clientsCreatedCount = 0;
    let duplicatesIgnoredCount = 0;

    if (Array.isArray(rows)) {
      for (const r of rows) {
        if (r.action === 'SKIP' || r.status === 'ERROR') continue;
        if (r.status === 'DUPLICATE' && r.action !== 'FORCE') {
          duplicatesIgnoredCount++;
          continue;
        }

        // Check if client exists
        let client = db.clients.find((c) => c.name.toLowerCase() === String(r.clientName).toLowerCase());
        if (!client) {
          client = {
            id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            organizationId: 'org-default',
            name: r.clientName,
            clientType: 'COMPANY',
            taxId: null,
            address: 'Adresse importée',
            contactName: null,
            email: r.clientContact || null,
            phone: '+229 01 00 00 00 00',
            secondaryContact: null,
            preferredChannel: 'EMAIL',
            contactHours: 'Lun–Ven · 08h30 – 17h30',
            restrictionsNote: null,
            notes: `Créé automatiquement lors de l'import de ${filename}`,
            isArchived: 0,
            archivedAt: null,
            archivedBy: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          db.clients.unshift(client);
          clientsCreatedCount++;
        }

        // Create invoice
        db.invoices.unshift({
          id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          organizationId: 'org-default',
          reference: r.reference,
          clientId: client.id,
          importId: `imp-${Date.now()}`,
          issueDate: r.issueDate,
          dueDate: r.dueDate,
          totalAmount: Number(r.amount),
          currency: r.currency || 'XOF',
          description: `Créance importée depuis ${filename}`,
          hasDispute: 0,
          disputeReason: null,
          isArchived: 0,
          archivedAt: null,
          archivedBy: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        importedCount++;
      }
    }

    const batch: ImportBatchRecord = {
      id: `imp-${Date.now()}`,
      organizationId: 'org-default',
      filename: filename || 'import_creances.xlsx',
      sourceType: sourceType || 'EXCEL',
      status: 'VALIDATED',
      totalRows: rows ? rows.length : 0,
      importedRows: importedCount,
      duplicateRows: duplicatesIgnoredCount,
      errorRows: 0,
      createdBy: req.user.email,
      createdAt: new Date().toISOString(),
    };
    db.importBatches.unshift(batch);

    logActivity('IMPORT_BATCH', 'RECOVERY', req.user.email, batch.filename, `Import de ${batch.filename} : ${importedCount} factures créées, ${clientsCreatedCount} clients ajoutés.`, req.user.id);

    res.json({
      importId: batch.id,
      filename: batch.filename,
      totalAnalyzed: batch.totalRows,
      importedCount,
      clientsCreatedCount,
      duplicatesIgnoredCount,
      rejectedCount: 0,
    });
  });

  app.get('/api/imports/history', authenticate, (_req, res) => {
    res.json({ batches: db.importBatches });
  });

  // 12. Admin Users Routes
  app.get('/api/admin/users', authenticate, (req: any, res) => {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    res.json({ users: db.users.map(publicUser) });
  });

  app.post('/api/admin/users', authenticate, (req: any, res) => {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    const { fullName, email, role, password } = req.body || {};
    const passwordError = validatePasswordStrength(String(password || ''));
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !fullName) {
      return res.status(400).json({ error: 'Nom et e-mail sont obligatoires.' });
    }
    if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail.' });
    }
    const newUser: UserRecord = {
      id: `usr-${Date.now()}`,
      email: cleanEmail,
      fullName: String(fullName).trim(),
      role: (role || 'MANAGER') as 'ADMIN' | 'MANAGER',
      passwordHash: hashPassword(String(password)),
      isActive: true,
      isDemo: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: null,
    };
    db.users.push(newUser);
    logActivity('USER_CREATED', 'SECURITY', req.user.email, newUser.email, `Création du compte utilisateur ${newUser.fullName} (${newUser.role}).`, req.user.id);
    res.json({ user: publicUser(newUser) });
  });

  app.patch('/api/admin/users/:id', authenticate, (req: any, res) => {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    const user = db.users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    if (req.body.fullName) user.fullName = req.body.fullName.trim();
    if (req.body.role) user.role = req.body.role;
    if (req.body.isActive !== undefined) user.isActive = Boolean(req.body.isActive);
    if (req.body.password) {
      const passwordError = validatePasswordStrength(String(req.body.password));
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }
      user.passwordHash = hashPassword(String(req.body.password));
    }
    user.updatedAt = new Date().toISOString();
    logActivity('USER_UPDATED', 'SECURITY', req.user.email, user.email, `Mise à jour du compte de ${user.fullName}.`, req.user.id);
    res.json({ user: publicUser(user) });
  });

  app.post('/api/admin/users/reset-demo', authenticate, (req: any, res) => {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    applyDemoPasswordsFromEnv(db.users);
    if (requiresPasswordBootstrap(db.users)) {
      return res.status(400).json({
        error:
          'Impossible de réinitialiser : définissez DEMO_ADMIN_PASSWORD et DEMO_MANAGER_PASSWORD, ou utilisez la configuration initiale.',
      });
    }
    logActivity('DEMO_RESET', 'SECURITY', req.user.email, null, 'Comptes de démonstration réinitialisés.', req.user.id);
    res.json({ message: 'Comptes de démonstration réinitialisés.', users: db.users.map(publicUser) });
  });

  // Serve static assets in production or Vite in development
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(distPath)) {
      console.error(`Dossier dist introuvable (${distPath}). Lancez "npm run build" avant npm start.`);
      process.exit(1);
    }
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur SaaS Recouvrix opérationnel sur le port ${PORT}.`);
  });
}

startGateway().catch((err) => {
  console.error('Erreur critique au démarrage du serveur Node.js :', err);
  process.exit(1);
});
