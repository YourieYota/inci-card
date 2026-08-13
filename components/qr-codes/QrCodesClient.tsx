'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  QrCode, Upload, Building2, FileText, Search, CheckCircle2,
  XCircle, AlertCircle, Loader2, Trash2, Eye, ChevronDown, RefreshCw, X,
  CheckSquare, Square, Columns, ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';
import JSZip from 'jszip';
import { getEmployeesQrStatus, saveExternalQrCodesBatch, deleteExternalQrCode } from '@/app/actions/qrcodes';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Company { id: string; name: string; }
interface DocType  { id: string; name: string; slug: string; companyId: string | null; }

interface EmployeeQrStatus {
  id: string;
  uniqueIdentifier: string;
  dynamicData: Record<string, unknown>;
  hasExternalQr: boolean;
}

interface MatchResult {
  filename: string;           // original filename in ZIP
  fieldValue: string;         // extracted value (filename sans extension)
  employee: EmployeeQrStatus | null;
  imageDataUrl: string;       // base64 data URL of the image
  status: 'matched' | 'unmatched' | 'will_replace';
  selected?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SUPPORTED_EXTS = ['.png', '.jpg', '.jpeg', '.bmp'];

/**
 * Load any image blob (BMP, JPG, PNG…) into a canvas and export as
 * compressed PNG — max 400px on the longest side.
 * This keeps the base64 payload small regardless of the source format.
 */
function compressImageBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 400;
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX || h > MAX) {
        const scale = MAX / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load error')); };
    img.src = objectUrl;
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  initialCompanies: Company[];
  initialDocumentTypes: DocType[];
}

export default function QrCodesClient({ initialCompanies, initialDocumentTypes }: Props) {
  // ── Step 1: configuration
  const [companyId, setCompanyId]     = useState('');
  const [docTypeSlug, setDocTypeSlug] = useState('');
  const [matchingField, setMatchingField] = useState('');
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [employees, setEmployees]     = useState<EmployeeQrStatus[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // ── Step 2: ZIP import
  const [isDragging, setIsDragging]   = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [zipFileName, setZipFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 3: import
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveProgress, setSaveProgress] = useState(0);

  // ── Preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ── Filter for match table
  const [tableFilter, setTableFilter] = useState<'all' | 'matched' | 'unmatched'>('all');
  // ── Matching options
  const [ignoreSpaces, setIgnoreSpaces] = useState(false);

  // ── Column Visibility & Ordering States
  const [hiddenFields, setHiddenFields] = useState<string[]>([]);
  const [customFieldOrder, setCustomFieldOrder] = useState<string[]>([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState<boolean>(false);

  // ── Search & Sort States for Existing QR codes
  const [existingSearchTerm, setExistingSearchTerm] = useState<string>('');
  const [existingSortField, setExistingSortField] = useState<string>('name');
  const [existingSortDirection, setExistingSortDirection] = useState<'asc' | 'desc'>('asc');

  // Sync column preferences from localStorage per company
  useEffect(() => {
    if (!companyId) {
      setHiddenFields([]);
      setCustomFieldOrder([]);
      return;
    }
    try {
      const savedHidden = localStorage.getItem(`qrCodes_hiddenFields_${companyId}`);
      if (savedHidden) setHiddenFields(JSON.parse(savedHidden));
      else setHiddenFields([]);

      const savedOrder = localStorage.getItem(`qrCodes_fieldOrder_${companyId}`);
      if (savedOrder) setCustomFieldOrder(JSON.parse(savedOrder));
      else setCustomFieldOrder([]);
    } catch (e) {
      console.error("Error loading column preferences:", e);
    }
  }, [companyId]);

  const toggleFieldVisibility = (key: string) => {
    setHiddenFields((prev) => {
      const updated = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      if (companyId) {
        try { localStorage.setItem(`qrCodes_hiddenFields_${companyId}`, JSON.stringify(updated)); } catch (e) {}
      }
      return updated;
    });
  };

  const moveField = (key: string, direction: 'up' | 'down') => {
    const currentList = [...orderedAllKeys];
    const index = currentList.indexOf(key);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;

    const temp = currentList[index];
    currentList[index] = currentList[targetIndex];
    currentList[targetIndex] = temp;

    setCustomFieldOrder(currentList);
    if (companyId) {
      try { localStorage.setItem(`qrCodes_fieldOrder_${companyId}`, JSON.stringify(currentList)); } catch (e) {}
    }
  };

  const resetColumnPreferences = () => {
    setHiddenFields([]);
    setCustomFieldOrder([]);
    if (companyId) {
      try {
        localStorage.removeItem(`qrCodes_hiddenFields_${companyId}`);
        localStorage.removeItem(`qrCodes_fieldOrder_${companyId}`);
      } catch (e) {}
    }
  };

  const handleExistingSort = (field: string) => {
    if (existingSortField === field) {
      setExistingSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setExistingSortField(field);
      setExistingSortDirection('asc');
    }
  };

  // ─── Fetch employees when company changes ───────────────────────────────
  const handleCompanyChange = async (cid: string) => {
    setCompanyId(cid);
    setMatchingField('');
    setAvailableFields([]);
    setEmployees([]);
    setMatchResults([]);
    setSaveSuccess(false);
    if (!cid) return;

    setLoadingEmployees(true);
    try {
      const emps = await getEmployeesQrStatus(cid);
      setEmployees(emps);
      // Extract all dynamic fields from first employee that has data
      const firstWithData = emps.find(e => Object.keys(e.dynamicData).length > 0);
      if (firstWithData) {
        setAvailableFields(Object.keys(firstWithData.dynamicData));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEmployees(false);
    }
  };

  // ─── Process ZIP file ────────────────────────────────────────────────────
  const processZip = useCallback(async (file: File) => {
    if (!matchingField) {
      alert('Veuillez d\'abord sélectionner le champ de correspondance.');
      return;
    }
    setIsProcessing(true);
    setMatchResults([]);
    setSaveSuccess(false);
    setSaveError('');
    setZipFileName(file.name);

    try {
      const zip = await JSZip.loadAsync(file);
      const results: MatchResult[] = [];

      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        const fname = relativePath.split('/').pop() || relativePath;
        const dotIdx = fname.lastIndexOf('.');
        const ext = dotIdx >= 0 ? fname.slice(dotIdx).toLowerCase() : '';
        if (!SUPPORTED_EXTS.includes(ext)) continue;

        const fieldValue = dotIdx >= 0 ? fname.slice(0, dotIdx) : fname;
        const blob = await zipEntry.async('blob');
        const imageDataUrl = await compressImageBlob(blob);

        // Find matching employee
        const normalize = (s: string) => ignoreSpaces ? s.replace(/\s+/g, '') : s;
        const emp = employees.find(e => {
          const val = e.dynamicData[matchingField];
          return val !== undefined && val !== null &&
            normalize(String(val).trim()) === normalize(fieldValue.trim());
        }) ?? null;

        let status: MatchResult['status'] = 'unmatched';
        if (emp) {
          status = emp.hasExternalQr ? 'will_replace' : 'matched';
        }

        results.push({ filename: fname, fieldValue, employee: emp, imageDataUrl, status, selected: status !== 'unmatched' });
      }

      // Sort: matched first, then unmatched
      results.sort((a, b) => {
        const order = { matched: 0, will_replace: 1, unmatched: 2 };
        return order[a.status] - order[b.status];
      });

      setMatchResults(results);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la lecture du fichier ZIP. Vérifiez que le fichier est valide.');
    } finally {
      setIsProcessing(false);
    }
  }, [matchingField, employees, ignoreSpaces]);

  // ─── Toggle item selection for import ─────────────────────────────────────
  const toggleSelectResult = (filename: string) => {
    setMatchResults(prev => prev.map(r => 
      r.filename === filename ? { ...r, selected: r.selected === false } : r
    ));
  };

  const toggleSelectAllResults = () => {
    const matchedItems = matchResults.filter(r => r.status !== 'unmatched');
    const allSelected = matchedItems.every(r => r.selected !== false);
    setMatchResults(prev => prev.map(r => 
      r.status !== 'unmatched' ? { ...r, selected: !allSelected } : r
    ));
  };

  // ─── Drag and drop ──────────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.zip')) processZip(file);
    else alert('Veuillez déposer un fichier .zip');
  }, [processZip]);

  // ─── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const toSave = matchResults.filter(r => (r.status === 'matched' || r.status === 'will_replace') && r.selected !== false);
    if (!toSave.length) return;
    setIsSaving(true);
    setSaveError('');
    setSaveProgress(0);
    try {
      // Save one by one to stay within server action payload limits
      for (let i = 0; i < toSave.length; i++) {
        const r = toSave[i];
        await saveExternalQrCodesBatch([{ employeeId: r.employee!.id, qrBase64: r.imageDataUrl }]);
        setSaveProgress(i + 1);
      }
      setSaveSuccess(true);
      // Refresh employee QR status
      const updated = await getEmployeesQrStatus(companyId);
      setEmployees(updated);
      setMatchResults(prev => prev.map(r => ({
        ...r,
        status: r.employee
          ? updated.find(e => e.id === r.employee!.id)?.hasExternalQr
            ? 'will_replace'
            : r.status
          : r.status,
      })));
    } catch (e: any) {
      setSaveError(e.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Delete a single employee's external QR ─────────────────────────────
  const handleDelete = async (employeeId: string) => {
    if (!confirm('Supprimer le QR code externe de cet employé ?')) return;
    try {
      await deleteExternalQrCode(employeeId);
      setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, hasExternalQr: false } : e));
    } catch (e: any) {
      alert(e.message);
    }
  };

  // ─── Extract Excel Dynamic Keys & Sorting ──────────────────────────────────
  const dynamicKeys = React.useMemo(() => {
    const excludeKeys = ['id', 'photo', 'photourl', 'status', 'printedat', 'createdat', 'updatedat', 'cardnumber', 'enrollmentnumber'];
    const keysSet = new Set<string>();
    employees.forEach((emp) => {
      if (emp.dynamicData && typeof emp.dynamicData === 'object') {
        const data = emp.dynamicData as Record<string, any>;
        Object.keys(data).forEach((k) => {
          if (k && k.trim() && !k.startsWith('_') && !excludeKeys.includes(k.toLowerCase().trim())) {
            keysSet.add(k.trim());
          }
        });
      }
    });
    return Array.from(keysSet);
  }, [employees]);

  const orderedAllKeys = React.useMemo(() => {
    if (customFieldOrder.length === 0) return dynamicKeys;
    const sorted = [...customFieldOrder.filter((k) => dynamicKeys.includes(k))];
    dynamicKeys.forEach((k) => {
      if (!sorted.includes(k)) sorted.push(k);
    });
    return sorted;
  }, [dynamicKeys, customFieldOrder]);

  const displayedDynamicKeys = React.useMemo(() => {
    return orderedAllKeys.filter((key) => !hiddenFields.includes(key));
  }, [orderedAllKeys, hiddenFields]);

  const getDynField = (data: Record<string, any>, ...keys: string[]): string => {
    if (!data || typeof data !== 'object') return '';
    const dataLower = Object.fromEntries(Object.entries(data).map(([k, v]) => [k.toLowerCase(), v]));
    for (const key of keys) {
      const val = dataLower[key.toLowerCase()];
      if (val !== undefined && val !== null && val !== '') return String(val);
    }
    return '';
  };

  const getEmployeeSortKey = (emp: any): string => {
    const data = emp.dynamicData as Record<string, any>;
    const n = getDynField(data, 'nom', 'noms', 'lastname', 'surname', 'familyname');
    const p = getDynField(data, 'prenom', 'prenoms', 'prénom', 'prénoms', 'firstname');
    return `${n} ${p}`.trim() || emp.uniqueIdentifier;
  };

  const filteredExistingEmployees = React.useMemo(() => {
    let result = employees.filter((e) => e.hasExternalQr);

    // Apply Search
    const query = existingSearchTerm.toLowerCase().trim();
    if (query) {
      result = result.filter((emp) => {
        if (emp.uniqueIdentifier.toLowerCase().includes(query)) return true;
        const data = emp.dynamicData as Record<string, any>;
        if (data && typeof data === 'object') {
          return Object.values(data).some((val) =>
            val !== null && val !== undefined && String(val).toLowerCase().includes(query)
          );
        }
        return false;
      });
    }

    // Apply Sorting
    if (existingSortField) {
      result = [...result].sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (existingSortField === 'name' || existingSortField === 'Nom Complet') {
          valA = getEmployeeSortKey(a);
          valB = getEmployeeSortKey(b);
        } else if (existingSortField === 'uniqueIdentifier' || existingSortField === 'Identifiant') {
          valA = a.uniqueIdentifier || '';
          valB = b.uniqueIdentifier || '';
        } else {
          const dataA = a.dynamicData as Record<string, any>;
          const dataB = b.dynamicData as Record<string, any>;
          valA = getDynField(dataA, existingSortField) || '';
          valB = getDynField(dataB, existingSortField) || '';
        }

        const normalize = (v: any) => (typeof v === 'string' ? v.trim() : v);
        valA = normalize(valA);
        valB = normalize(valB);

        if (typeof valA === 'string') {
          return existingSortDirection === 'asc'
            ? valA.localeCompare(String(valB), 'fr', { numeric: true, sensitivity: 'base' })
            : String(valB).localeCompare(valA, 'fr', { numeric: true, sensitivity: 'base' });
        } else {
          return existingSortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1);
        }
      });
    }

    return result;
  }, [employees, existingSearchTerm, existingSortField, existingSortDirection]);

  // ─── Derived stats ───────────────────────────────────────────────────────
  const matched    = matchResults.filter(r => r.status !== 'unmatched').length;
  const unmatched  = matchResults.filter(r => r.status === 'unmatched').length;
  const selectedToImportCount = matchResults.filter(r => r.status !== 'unmatched' && r.selected !== false).length;
  const filteredResults = matchResults.filter(r => {
    if (tableFilter === 'matched') return r.status !== 'unmatched';
    if (tableFilter === 'unmatched') return r.status === 'unmatched';
    return true;
  });

  const filteredDocTypes = initialDocumentTypes.filter(
    t => !companyId || t.companyId === companyId || t.companyId === null
  );
  const alreadyWithQr = employees.filter(e => e.hasExternalQr).length;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 dark:bg-violet-950/40 rounded-2xl">
            <QrCode className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-800 dark:text-white">Gestion des QR Codes</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Importez un ZIP de QR codes externes et associez-les aux employés
            </p>
          </div>
        </div>
      </div>

      {/* ── Step 1: Configuration ── */}
      <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-6 space-y-5">
        <h2 className="text-sm font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">1</span>
          Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Company */}
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">
              Entreprise <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
              <select
                value={companyId}
                onChange={e => handleCompanyChange(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/25 appearance-none"
              >
                <option value="">Sélectionnez une entreprise...</option>
                {initialCompanies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Doc type (optional) */}
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">
              Type de document <span className="text-neutral-300">(optionnel)</span>
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
              <select
                value={docTypeSlug}
                onChange={e => setDocTypeSlug(e.target.value)}
                disabled={!companyId}
                className={`w-full pl-9 pr-8 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/25 appearance-none transition ${
                  docTypeSlug
                    ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300'
                    : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200'
                } disabled:opacity-50`}
              >
                <option value="">Tous les types</option>
                {filteredDocTypes.map(t => (
                  <option key={t.id} value={t.slug}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Matching field */}
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">
              Champ de correspondance <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
              <select
                value={matchingField}
                onChange={e => setMatchingField(e.target.value)}
                disabled={!companyId || availableFields.length === 0}
                className="w-full pl-9 pr-8 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/25 appearance-none disabled:opacity-50"
              >
                <option value="">-- Choisir le champ --</option>
                {availableFields.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            {companyId && availableFields.length === 0 && !loadingEmployees && (
              <p className="text-[11px] text-amber-500 mt-1">Aucun employé avec données dynamiques trouvé</p>
            )}
            {loadingEmployees && (
              <p className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Chargement...
              </p>
            )}
          </div>
        </div>


        {/* Ignore spaces — full width row */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
          <button
            type="button"
            onClick={() => setIgnoreSpaces(v => !v)}
            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 focus:outline-none ${
              ignoreSpaces ? 'bg-violet-600' : 'bg-neutral-300 dark:bg-neutral-600'
            }`}
            aria-pressed={ignoreSpaces}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              ignoreSpaces ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
          <div>
            <p className="text-xs font-bold text-neutral-700 dark:text-neutral-200">
              Ignorer les espaces lors du matching
            </p>
            <p className="text-[11px] text-neutral-400">
              {ignoreSpaces
                ? 'Activé — "123 456" correspondra à "123456"'
                : 'Désactivé — la valeur doit être identique caractère par caractère'}
            </p>
          </div>
        </div>

        {/* Stats bar */}
        {companyId && employees.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500">
            <span><strong className="text-neutral-700 dark:text-neutral-200">{employees.length}</strong> employés</span>
            <span className="w-px h-4 bg-neutral-200 dark:bg-neutral-700" />
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <strong className="text-emerald-600 dark:text-emerald-400">{alreadyWithQr}</strong> avec QR externe
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 text-neutral-300" />
              <strong>{employees.length - alreadyWithQr}</strong> sans QR externe
            </span>
          </div>
        )}
      </div>

      {/* ── Step 2: ZIP Import ── */}
      <div className={`bg-white dark:bg-slate-900/90 rounded-2xl border border-neutral-200 dark:border-slate-800/80 p-6 space-y-4 transition-opacity ${!companyId || !matchingField ? 'opacity-50 pointer-events-none' : ''}`}>
        <h2 className="text-sm font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">2</span>
          Import du fichier ZIP
        </h2>
        <p className="text-xs text-neutral-500">
          Le nom de chaque image (sans extension) doit correspondre à la valeur du champ&nbsp;
          <strong className="text-violet-600 dark:text-violet-400">{matchingField || '…'}</strong>.
          Formats acceptés : PNG, JPG, BMP.
        </p>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
            isDragging
              ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20'
              : 'border-neutral-200 dark:border-neutral-700 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-950/10'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
              <p className="text-sm font-semibold text-neutral-500">Analyse du ZIP en cours…</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
                <Upload className="w-7 h-7 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-neutral-700 dark:text-neutral-200">
                  {zipFileName ? `Recharger (${zipFileName})` : 'Glissez un fichier ZIP ici'}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">ou cliquez pour parcourir</p>
              </div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) processZip(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* ── Step 3: Matching results ── */}
      {matchResults.length > 0 && (
        <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-neutral-200 dark:border-slate-800/80 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-700 flex flex-wrap items-center gap-4">
            <h2 className="text-sm font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">3</span>
              Résultats du matching
            </h2>
            {/* Stats chips */}
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30 flex items-center gap-1">
                <CheckSquare className="w-3 h-3" /> {selectedToImportCount}/{matched} sélectionné{selectedToImportCount !== 1 ? 's' : ''}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {matched} correspondance{matched !== 1 ? 's' : ''}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 flex items-center gap-1">
                <XCircle className="w-3 h-3" /> {unmatched} sans correspondance
              </span>
            </div>
            {/* Filter tabs */}
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl p-1">
              {([['all', 'Tout'], ['matched', 'Trouvés'], ['unmatched', 'Non trouvés']] as const).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setTableFilter(v)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    tableFilter === v
                      ? 'bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-center w-12">
                    <button
                      type="button"
                      onClick={toggleSelectAllResults}
                      disabled={matched === 0}
                      className="text-neutral-400 hover:text-violet-600 dark:hover:text-violet-400 disabled:opacity-30 transition"
                      title="Tout sélectionner / Tout désélectionner"
                    >
                      {matched > 0 && selectedToImportCount === matched ? (
                        <CheckSquare className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">Fichier</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">Valeur ({matchingField})</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">Employé</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">Aperçu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredResults.map((r, i) => {
                  const isSelected = r.selected !== false;
                  const isSelectable = r.status !== 'unmatched';

                  return (
                    <tr 
                      key={i} 
                      onClick={() => { if (isSelectable) toggleSelectResult(r.filename); }}
                      className={`transition-colors ${
                        r.status === 'unmatched' 
                          ? 'opacity-50' 
                          : isSelected 
                          ? 'hover:bg-neutral-50 dark:hover:bg-neutral-900/50 cursor-pointer' 
                          : 'bg-neutral-50/50 dark:bg-neutral-900/20 opacity-60 hover:opacity-80 cursor-pointer'
                      }`}
                    >
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        {isSelectable ? (
                          <button
                            type="button"
                            onClick={() => toggleSelectResult(r.filename)}
                            className="text-neutral-400 hover:text-violet-600 dark:hover:text-violet-400 transition"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <Square className="w-4 h-4 text-neutral-300 dark:text-neutral-700 opacity-40 cursor-not-allowed" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.status === 'matched' && (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" /> Associé
                          </span>
                        )}
                        {r.status === 'will_replace' && (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                            <RefreshCw className="w-4 h-4" /> Remplacement
                          </span>
                        )}
                        {r.status === 'unmatched' && (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-rose-500">
                            <XCircle className="w-4 h-4" /> Non trouvé
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-neutral-600 dark:text-neutral-400 max-w-[160px] truncate">{r.filename}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-neutral-800 dark:text-neutral-200">{r.fieldValue}</td>
                      <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400">
                        {r.employee
                          ? <span className="font-semibold text-neutral-800 dark:text-neutral-200">{r.employee.uniqueIdentifier}</span>
                          : <span className="text-neutral-400 italic">—</span>
                        }
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setPreviewUrl(r.imageDataUrl)}
                          className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center hover:bg-violet-50 dark:hover:bg-violet-950/30 transition overflow-hidden"
                        >
                          <img src={r.imageDataUrl} alt="" className="w-full h-full object-contain" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-700 flex items-center gap-4">
            {saveSuccess && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Importation réussie !
              </span>
            )}
            {saveError && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-rose-500">
                <AlertCircle className="w-4 h-4" /> {saveError}
              </span>
            )}
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={() => { setMatchResults([]); setZipFileName(''); setSaveSuccess(false); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition border border-neutral-200 dark:border-neutral-700"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || selectedToImportCount === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSaving
                  ? `Sauvegarde ${saveProgress}/${selectedToImportCount}…`
                  : `Importer ${selectedToImportCount > 0 ? `${selectedToImportCount} QR code${selectedToImportCount !== 1 ? 's' : ''}` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Existing QR codes list ── */}
      {employees.filter(e => e.hasExternalQr).length > 0 && matchResults.length === 0 && (
        <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
          {/* Section Header with Search and Column Options */}
          <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-sm font-bold text-neutral-700 dark:text-neutral-200 flex items-center gap-2">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
              <span>QR codes externes existants ({alreadyWithQr})</span>
            </h2>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, identifiant..."
                  value={existingSearchTerm}
                  onChange={(e) => setExistingSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-violet-500/20 text-neutral-800 dark:text-neutral-200"
                />
              </div>

              {/* Column Selection Dropdown */}
              {dynamicKeys.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 transition shadow-sm"
                    title="Personnaliser les colonnes"
                  >
                    <Columns className="w-3.5 h-3.5 text-violet-500" />
                    <span>Colonnes</span>
                    <span className="py-0.5 px-1.5 bg-violet-100 dark:bg-violet-950 text-[10px] font-mono text-violet-600 dark:text-violet-400 rounded-full font-bold">
                      {displayedDynamicKeys.length}/{dynamicKeys.length}
                    </span>
                    <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform ${showColumnDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showColumnDropdown && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowColumnDropdown(false)} 
                      />
                      <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl z-50 p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-700 pb-2 mb-2">
                          <div>
                            <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Ordre & affichage</h4>
                            <p className="text-[9px] text-neutral-400">Flèches pour déplacer les colonnes</p>
                          </div>
                          <button
                            type="button"
                            onClick={resetColumnPreferences}
                            className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline"
                          >
                            Réinitialiser
                          </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                          {orderedAllKeys.map((key, index) => {
                            const isVisible = !hiddenFields.includes(key);
                            return (
                              <div
                                key={key}
                                className="flex items-center justify-between p-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 rounded-lg text-xs transition group"
                              >
                                <div className="flex items-center gap-0.5 shrink-0 mr-1.5">
                                  <button
                                    type="button"
                                    disabled={index === 0}
                                    onClick={() => moveField(key, 'up')}
                                    className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-20 disabled:hover:bg-transparent transition"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === orderedAllKeys.length - 1}
                                    onClick={() => moveField(key, 'down')}
                                    className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-20 disabled:hover:bg-transparent transition"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>
                                <span 
                                  className={`flex-1 font-medium truncate mr-2 cursor-pointer ${isVisible ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-400 dark:text-neutral-500 line-through'}`} 
                                  title={key}
                                  onClick={() => toggleFieldVisibility(key)}
                                >
                                  {key}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={isVisible}
                                  onChange={() => toggleFieldVisibility(key)}
                                  className="w-4 h-4 text-violet-600 rounded border-neutral-300 dark:border-neutral-600 focus:ring-violet-500 cursor-pointer shrink-0"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-neutral-50 dark:bg-neutral-900 sticky top-0 z-10 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  {dynamicKeys.length > 0 ? (
                    displayedDynamicKeys.map((key) => (
                      <th
                        key={key}
                        onClick={() => handleExistingSort(key)}
                        className="px-4 py-3 whitespace-nowrap cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition select-none"
                        title={`Trier par ${key}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{key}</span>
                          {existingSortField === key ? (
                            existingSortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-violet-500" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-violet-500" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-neutral-300 dark:text-neutral-600 opacity-60" />
                          )}
                        </div>
                      </th>
                    ))
                  ) : (
                    <th 
                      onClick={() => handleExistingSort('Identifiant')}
                      className="px-4 py-3 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition select-none"
                      title="Trier par Identifiant"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Identifiant</span>
                        {existingSortField === 'Identifiant' || existingSortField === 'uniqueIdentifier' ? (
                          existingSortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-violet-500" /> : <ArrowDown className="w-3.5 h-3.5 text-violet-500" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-neutral-300 dark:text-neutral-600 opacity-60" />
                        )}
                      </div>
                    </th>
                  )}
                  <th className="px-4 py-3 whitespace-nowrap">QR Code</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredExistingEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={(dynamicKeys.length > 0 ? displayedDynamicKeys.length : 1) + 2} className="px-4 py-8 text-center text-neutral-400 text-xs">
                      Aucun résultat ne correspond à la recherche.
                    </td>
                  </tr>
                ) : (
                  filteredExistingEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition">
                      {dynamicKeys.length > 0 ? (
                        displayedDynamicKeys.map((key) => {
                          const val = (emp.dynamicData as Record<string, any>)?.[key];
                          const displayVal = typeof val === 'object' && val !== null 
                            ? JSON.stringify(val) 
                            : (val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : '-');
                          return (
                            <td key={key} className="px-4 py-3 text-xs font-semibold text-neutral-800 dark:text-neutral-200 whitespace-nowrap max-w-[200px] truncate" title={displayVal}>
                              {displayVal}
                            </td>
                          );
                        })
                      ) : (
                        <td className="px-4 py-3 text-xs font-semibold text-neutral-800 dark:text-neutral-200">{emp.uniqueIdentifier}</td>
                      )}
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                          ✓ QR externe
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(emp.id)}
                          className="p-1.5 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition"
                          title="Supprimer le QR externe"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Preview modal ── */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-neutral-700 dark:text-neutral-200">Aperçu QR Code</span>
              <button onClick={() => setPreviewUrl(null)} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
            <img src={previewUrl} alt="QR Code" className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700" />
          </div>
        </div>
      )}
    </div>
  );
}
