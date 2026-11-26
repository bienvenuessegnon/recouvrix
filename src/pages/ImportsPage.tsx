import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  RefreshCw,
  Search,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  AlertBanner,
  Button,
  DataTable,
  EmptyState,
  LoadingState,
  StatusBadge,
  SummaryCard,
  Tabs,
  useToast,
} from '../components/ui';
import { formatCurrency, formatDateTime } from '../design-system/formatters';
import { ApiError, apiUrl, importsApi } from '../services/api';

export interface ImportsPageProps {
  initialFilter?: string;
  onNavigateToInvoices?: () => void;
}

interface AnalyzedRow {
  rowIndex: number;
  reference: string;
  clientName: string;
  clientContact: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: 'VALID' | 'INCOMPLETE' | 'ERROR' | 'DUPLICATE';
  reason: string;
  existingClientId?: string | null;
  isNewClient: boolean;
  action?: 'IMPORT' | 'SKIP' | 'FORCE';
}

interface PreviewResult {
  filename: string;
  sourceType: string;
  totalAnalyzed: number;
  validCount: number;
  incompleteCount: number;
  errorCount: number;
  duplicateCount: number;
  rows: AnalyzedRow[];
}

export const ImportsPage: React.FC<ImportsPageProps> = ({ initialFilter, onNavigateToInvoices }) => {
  const { notify } = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<string>('CSV');
  const [analyzing, setAnalyzing] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [editableRows, setEditableRows] = useState<AnalyzedRow[]>([]);
  const [filterTab, setFilterTab] = useState<'ALL' | 'VALID' | 'INCOMPLETE' | 'ERROR' | 'DUPLICATE'>('ALL');
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<any | null>(null);
  const [historyBatches, setHistoryBatches] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await importsApi.history();
      setHistoryBatches(res.batches || []);
    } catch {
      // Silently catch history fetch error
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      if (file.name.toLowerCase().endsWith('.xlsx')) {
        setSourceType('EXCEL');
      } else if (file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.png') || file.name.toLowerCase().endsWith('.jpg')) {
        setSourceType('PDF_AI');
      } else {
        setSourceType('CSV');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (file.name.toLowerCase().endsWith('.xlsx')) {
        setSourceType('EXCEL');
      } else if (file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.png') || file.name.toLowerCase().endsWith('.jpg')) {
        setSourceType('PDF_AI');
      } else {
        setSourceType('CSV');
      }
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) return;
    setStep(2);
    setAnalyzing(true);
    try {
      const res = await preview_import_analysis(selectedFile, sourceType);
      setPreviewData(res);
      setEditableRows(
        res.rows.map((r: AnalyzedRow) => ({
          ...r,
          action: r.status === 'DUPLICATE' ? 'SKIP' : r.status === 'ERROR' ? 'SKIP' : 'IMPORT',
        }))
      );
      // Simulate small analysis delay for smooth UX transition
      setTimeout(() => {
        setAnalyzing(false);
        setStep(3); // Go to mapping correspondence
      }, 1000);
    } catch (err) {
      setAnalyzing(false);
      setStep(1);
      notify({
        tone: 'error',
        title: 'Erreur d’analyse',
        description: err instanceof ApiError ? err.message : 'Impossible d’analyser le fichier sélectionné.',
      });
    }
  };

  const preview_import_analysis = async (file: File, type: string) => {
    return await importsApi.preview(file, type);
  };

  const handleUpdateRow = (rowIndex: number, field: keyof AnalyzedRow, value: any) => {
    setEditableRows((prev) =>
      prev.map((r) => {
        if (r.rowIndex === rowIndex) {
          const updated = { ...r, [field]: value };
          // Re-evaluate validity if key fields change
          if (field === 'reference' || field === 'clientName' || field === 'amount') {
            if (!updated.reference.trim() || !updated.clientName.trim()) {
              updated.status = 'INCOMPLETE';
              updated.reason = 'Informations obligatoires incomplètes.';
            } else if (updated.amount <= 0) {
              updated.status = 'ERROR';
              updated.reason = 'Montant initial invalide ou nul.';
            } else if (updated.status === 'INCOMPLETE' || updated.status === 'ERROR') {
              updated.status = 'VALID';
              updated.reason = 'Corrigé par l’utilisateur.';
            }
          }
          return updated;
        }
        return r;
      })
    );
  };

  const handleCommitImport = async () => {
    if (!previewData) return;
    setCommitting(true);
    try {
      const res = await importsApi.commit({
        filename: previewData.filename,
        sourceType: previewData.sourceType,
        rows: editableRows,
      });
      setCommitResult(res);
      setStep(6);
      void loadHistory();
      notify({
        tone: 'success',
        title: 'Importation réussie',
        description: `${res.importedCount} créances ont été intégrées avec succès dans Recouvrix.`,
      });
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Échec de l’importation',
        description: err instanceof ApiError ? err.message : 'Impossible de valider le lot d’importation.',
      });
    } finally {
      setCommitting(false);
    }
  };

  const filteredRows = editableRows.filter((r) => {
    if (filterTab === 'ALL') return true;
    return r.status === filterTab;
  });

  return (
    <div className="space-y-6">
      {/* Top Header / Progress Wizard */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Importation du portefeuille</h2>
            <p className="text-sm text-slate-600">
              Alimentez votre portefeuille de créances à partir de fichiers CSV, Excel ou factures PDF.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Étape {step} sur 6</span>
          </div>
        </div>

        {/* Step Indicator Bar */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 border-t border-slate-100 pt-4">
          {[
            { num: 1, label: 'Sélection' },
            { num: 2, label: 'Analyse IA' },
            { num: 3, label: 'Correspondance' },
            { num: 4, label: 'Vérification' },
            { num: 5, label: 'Validation' },
            { num: 6, label: 'Bilan' },
          ].map((s) => (
            <div
              key={s.num}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                step === s.num
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : step > s.num
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-50 text-slate-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-white shadow-xs">
                {step > s.num ? '✓' : s.num}
              </span>
              <span className="truncate">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: FILE SELECTION */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-8 shadow-xs">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">1. Sélection du document source</h3>
            <p className="text-sm text-slate-600 mb-6">
              Glissez-déposez votre fichier ci-dessous ou sélectionnez-le depuis votre poste. Les formats CSV, Excel (.xlsx) et PDF sont pris en charge.
            </p>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-blue-500 transition-colors bg-slate-50/50 cursor-pointer relative"
            >
              <input
                type="file"
                accept=".csv,.xlsx,.txt,.pdf,.png,.jpg"
                onChange={handleFileSelect}
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label="Sélectionner un fichier d'importation"
              />
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-900 mb-1">
                {selectedFile ? selectedFile.name : 'Glissez votre fichier ici ou cliquez pour parcourir'}
              </p>
              <p className="text-xs text-slate-500">
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} Ko · Prêt pour l’analyse`
                  : 'CSV, Excel (.xlsx), Factures PDF ou scans numérisés'}
              </p>
            </div>

            {selectedFile && (
              <div className="mt-6 flex items-center justify-between bg-blue-50/60 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">{selectedFile.name}</p>
                    <p className="text-xs text-blue-700">Format détecté : {sourceType}</p>
                  </div>
                </div>
                <Button variant="primary" onClick={handleStartAnalysis}>
                  Lancer l’analyse du document
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600" /> Bonnes pratiques d’importation
              </h4>
              <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <li>• Assurez-vous que chaque ligne comporte une référence de facture unique.</li>
                <li>• Le nom du client doit correspondre à sa raison sociale ou son nom complet.</li>
                <li>• Les montants doivent être saisis en chiffres bruts (ex: 1500000 pour 1,5M FCFA).</li>
                <li>• Les dates doivent suivre le format AAAA-MM-JJ ou JJ/MM/AAAA.</li>
                <li>• Les doublons de référence sont automatiquement identifiés et isolés.</li>
              </ul>
              <div className="mt-4 flex flex-col gap-2">
                <a
                  href={apiUrl('/api/demo/sample/sample_creances.csv')}
                  download="sample_creances.csv"
                  className="inline-flex items-center gap-2 text-xs font-medium text-blue-700 hover:text-blue-900"
                >
                  <Download className="w-3.5 h-3.5" />
                  Télécharger l’exemple CSV (5 créances)
                </a>
                <a
                  href={apiUrl('/api/demo/sample/sample_portefeuille_entree.pdf')}
                  download="sample_portefeuille_entree.pdf"
                  className="inline-flex items-center gap-2 text-xs font-medium text-blue-700 hover:text-blue-900"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Télécharger le PDF d’entrée (factures + exceptions)
                </a>
              </div>
            </div>

            {historyBatches.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Derniers imports réalisés</h4>
                <div className="space-y-3">
                  {historyBatches.slice(0, 3).map((b) => (
                    <div key={b.id} className="text-xs border-b border-slate-100 pb-2 last:border-0">
                      <div className="flex justify-between font-medium text-slate-900">
                        <span className="truncate max-w-[140px]">{b.filename}</span>
                        <span className="text-emerald-600 font-mono">+{b.importedRows} créances</span>
                      </div>
                      <div className="text-slate-500 mt-0.5">{formatDateTime(b.createdAt)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: ANALYSIS & AI EXTRACTION LOADING */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <LoadingState label="Analyse du document et extraction des créances en cours..." />
        </div>
      )}

      {/* STEP 3: FIELD MAPPING / CORRESPONDANCE */}
      {step === 3 && previewData && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">3. Correspondance des champs</h3>
            <p className="text-sm text-slate-600">
              Vérifiez ci-dessous l’association entre les colonnes reconnues dans <span className="font-semibold">{previewData.filename}</span> et les champs attendus par Recouvrix.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Référence facture', mapped: 'Référence / Numéro', confidence: '99%' },
              { label: 'Nom du client', mapped: 'Client / Société', confidence: '98%' },
              { label: 'Date d’échéance', mapped: 'Échéance / Date limite', confidence: '95%' },
              { label: 'Montant initial', mapped: 'Montant / Total FCFA', confidence: '99%' },
            ].map((m, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500 mb-1">{m.label}</p>
                <p className="text-sm font-semibold text-slate-900 mb-2">{m.mapped}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono">Correspondance OK</span>
                  <span className="text-slate-400">Confiance {m.confidence}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <p className="text-sm text-blue-900">
              L’analyse a permis d’identifier <span className="font-bold">{previewData.totalAnalyzed} lignes</span> au total.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Précédent
              </Button>
              <Button variant="primary" onClick={() => setStep(4)}>
                Passer à la vérification
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: VERIFICATION & PREVIEW TABLE */}
      {step === 4 && previewData && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">4. Vérification et prévisualisation</h3>
              <p className="text-sm text-slate-600">
                Inspectez les lignes extraites. Les doublons et erreurs sont isolés pour validation humaine.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={() => setStep(3)}>
                Précédent
              </Button>
              <Button variant="primary" onClick={() => setStep(5)}>
                Valider l’analyse et continuer
              </Button>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Lignes valides"
              value={String(previewData.validCount)}
              tone="success"
              helper="Prêtes pour intégration"
            />
            <SummaryCard
              label="Doublons détectés"
              value={String(previewData.duplicateCount)}
              tone="warning"
              helper="Factures déjà existantes"
            />
            <SummaryCard
              label="Incomplètes"
              value={String(previewData.incompleteCount)}
              tone="default"
              helper="À compléter"
            />
            <SummaryCard
              label="Erreurs"
              value={String(previewData.errorCount)}
              tone="danger"
              helper="Montants invalides"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            {[
              { id: 'ALL', label: `Toutes (${previewData.rows.length})` },
              { id: 'VALID', label: `Valides (${previewData.validCount})` },
              { id: 'DUPLICATE', label: `Doublons (${previewData.duplicateCount})` },
              { id: 'INCOMPLETE', label: `Incomplètes (${previewData.incompleteCount})` },
              { id: 'ERROR', label: `Erreurs (${previewData.errorCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  filterTab === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table of Rows */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="p-3">#</th>
                  <th className="p-3">Référence</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Échéance</th>
                  <th className="p-3 text-right">Montant</th>
                  <th className="p-3">Statut & Motif</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRows.map((r) => (
                  <tr key={r.rowIndex} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-mono text-slate-400">{r.rowIndex}</td>
                    <td className="p-3 font-medium text-slate-900">
                      <input
                        type="text"
                        value={r.reference}
                        onChange={(e) => handleUpdateRow(r.rowIndex, 'reference', e.target.value)}
                        className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-hidden w-full font-mono"
                      />
                    </td>
                    <td className="p-3 text-slate-800">
                      <input
                        type="text"
                        value={r.clientName}
                        onChange={(e) => handleUpdateRow(r.rowIndex, 'clientName', e.target.value)}
                        className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-hidden w-full"
                      />
                    </td>
                    <td className="p-3 font-mono text-slate-600">{r.dueDate}</td>
                    <td className="p-3 text-right font-mono font-semibold text-slate-900 tabular-amount">
                      {formatCurrency(r.amount, r.currency)}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit ${
                            r.status === 'VALID'
                              ? 'bg-emerald-50 text-emerald-700'
                              : r.status === 'DUPLICATE'
                              ? 'bg-amber-50 text-amber-700'
                              : r.status === 'INCOMPLETE'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {r.status}
                        </span>
                        <span className="text-[11px] text-slate-500">{r.reason}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <select
                        value={r.action || 'IMPORT'}
                        onChange={(e) => handleUpdateRow(r.rowIndex, 'action', e.target.value)}
                        className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-700"
                      >
                        <option value="IMPORT">Importer</option>
                        <option value="SKIP">Ignorer</option>
                        {r.status === 'DUPLICATE' && <option value="FORCE">Forcer (Mettre à jour)</option>}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STEP 5: FINAL VALIDATION & COMMIT */}
      {step === 5 && previewData && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-2xl mx-auto shadow-xs space-y-6">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Prêt pour l’intégration définitive</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Vous êtes sur le point d’intégrer <span className="font-bold text-slate-900">{previewData.validCount} factures valides</span> issues du fichier <span className="font-semibold">{previewData.filename}</span>. Les doublons et anomalies seront ignorés ou traités selon vos choix.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2 text-xs text-slate-700">
            <div className="flex justify-between">
              <span>Fichier source :</span>
              <span className="font-medium text-slate-900">{previewData.filename}</span>
            </div>
            <div className="flex justify-between">
              <span>Créances prêtes à intégrer :</span>
              <span className="font-medium text-emerald-700 font-mono">{previewData.validCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Doublons ignorés :</span>
              <span className="font-medium text-amber-700 font-mono">{previewData.duplicateCount}</span>
            </div>
          </div>

          <div className="flex justify-center gap-4 pt-2">
            <Button variant="secondary" onClick={() => setStep(4)} disabled={committing}>
              Retour à la vérification
            </Button>
            <Button variant="primary" onClick={handleCommitImport} disabled={committing}>
              {committing ? 'Intégration en cours...' : 'Confirmer l’importation définitive'}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 6: RESULT SUMMARY REPORT */}
      {step === 6 && commitResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-2xl mx-auto shadow-xs space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">Importation réalisée avec succès</h3>
            <p className="text-sm text-slate-600">
              Le lot <span className="font-semibold">{commitResult.filename}</span> a été intégré dans Recouvrix et tracé dans le journal d’activité.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-left">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-xs text-slate-500">Factures importées</p>
              <p className="text-lg font-bold text-emerald-700 font-mono">{commitResult.importedCount}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-xs text-slate-500">Clients créés/associés</p>
              <p className="text-lg font-bold text-blue-700 font-mono">{commitResult.clientsCreatedCount}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-xs text-slate-500">Doublons ignorés</p>
              <p className="text-lg font-bold text-amber-700 font-mono">{commitResult.duplicatesIgnoredCount}</p>
            </div>
          </div>

          <div className="flex justify-center gap-4 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setStep(1);
                setSelectedFile(null);
                setPreviewData(null);
                setCommitResult(null);
              }}
            >
              Importer un autre fichier
            </Button>
            {onNavigateToInvoices ? (
              <Button variant="primary" onClick={onNavigateToInvoices}>
                Consulter les créances importées
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
