'use client';

import React, { useState, useEffect } from 'react';
import { Company, Employee } from '@prisma/client';
import { 
  Printer, 
  Search, 
  Building2, 
  CheckSquare, 
  Square,
  RefreshCw,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Users,
  RotateCcw,
  Columns,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import { getEmployees, requestReprint, requestReprintBatch } from '@/app/actions/employees';
import { useToast } from '@/components/ui/Toast';
import { getCardDocumentTypes, getCardCategories } from '@/app/actions/cards';
import { markAsPrinted } from '@/app/actions/batches';
import Pagination from '@/components/ui/Pagination';
import EmployeePhoto from '@/components/employees/EmployeePhoto';

interface PrintQueueClientProps {
  initialCompanies: any[];
  initialCompanyId?: string;
  dbError?: boolean;
}

type TabType = 'ready' | 'not-ready' | 'to-reprint' | 'printed' | 'reprinted' | 'history';

export default function PrintQueueClient({
  initialCompanies,
  initialCompanyId = '',
  dbError = false,
}: PrintQueueClientProps) {
  const { toast } = useToast();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompanyId);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabType>('ready');

  // Reprint dialog states
  const [showReprintDialog, setShowReprintDialog] = useState<boolean>(false);
  const [reprintEmployeeId, setReprintEmployeeId] = useState<string>('');
  const [reprintReason, setReprintReason] = useState<string>('');
  const [reprintTemplateType, setReprintTemplateType] = useState<string>('BADGE');
  const [reprintCardNumberOption, setReprintCardNumberOption] = useState<'KEEP' | 'GENERATE' | 'CUSTOM'>('KEEP');
  const [reprintCustomCardNumber, setReprintCustomCardNumber] = useState<string>('');
  const [selectedTemplateType, setSelectedTemplateType] = useState<string>('BADGE');
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Column visibility & ordering states
  const [hiddenFields, setHiddenFields] = useState<string[]>([]);
  const [customFieldOrder, setCustomFieldOrder] = useState<string[]>([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState<boolean>(false);

  // Sync hidden fields & ordering preferences from localStorage per company
  useEffect(() => {
    if (!selectedCompanyId) {
      setHiddenFields([]);
      setCustomFieldOrder([]);
      return;
    }
    try {
      const savedHidden = localStorage.getItem(`printQueue_hiddenFields_${selectedCompanyId}`);
      if (savedHidden) setHiddenFields(JSON.parse(savedHidden));
      else setHiddenFields([]);

      const savedOrder = localStorage.getItem(`printQueue_fieldOrder_${selectedCompanyId}`);
      if (savedOrder) setCustomFieldOrder(JSON.parse(savedOrder));
      else setCustomFieldOrder([]);
    } catch (e) {
      console.error("Error loading column preferences:", e);
    }
  }, [selectedCompanyId]);

  const toggleFieldVisibility = (key: string) => {
    setHiddenFields((prev) => {
      const updated = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      if (selectedCompanyId) {
        try {
          localStorage.setItem(`printQueue_hiddenFields_${selectedCompanyId}`, JSON.stringify(updated));
        } catch (e) {}
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
    if (selectedCompanyId) {
      try {
        localStorage.setItem(`printQueue_fieldOrder_${selectedCompanyId}`, JSON.stringify(currentList));
      } catch (e) {}
    }
  };

  const resetColumnPreferences = () => {
    setHiddenFields([]);
    setCustomFieldOrder([]);
    if (selectedCompanyId) {
      try {
        localStorage.removeItem(`printQueue_hiddenFields_${selectedCompanyId}`);
        localStorage.removeItem(`printQueue_fieldOrder_${selectedCompanyId}`);
      } catch (e) {}
    }
  };

  // Load print queue when company changes
  useEffect(() => {
    if (!selectedCompanyId) {
      setEmployees([]);
      setSelectedIds([]);
      setCurrentPage(1);
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('companyId', selectedCompanyId);
    window.history.replaceState({}, '', url.toString());

    fetchQueue();
    setCurrentPage(1);
  }, [selectedCompanyId]);

  // Fetch document types when company changes
  useEffect(() => {
    if (!selectedCompanyId) {
      setDocumentTypes([]);
      setSelectedTemplateType('BADGE');
      return;
    }

    const fetchData = async () => {
      try {
        const types = await getCardDocumentTypes(selectedCompanyId);
        setDocumentTypes(types);
        if (types.length > 0) {
          setSelectedTemplateType(types[0].slug);
        } else {
          setSelectedTemplateType('BADGE');
        }
      } catch (err) {
        console.error("Failed to fetch card metadata:", err);
      }
    };
    
    fetchData();
  }, [selectedCompanyId]);

  // Reset selected IDs when tab changes
  useEffect(() => {
    setSelectedIds([]);
    setCurrentPage(1);
  }, [activeTab]);

  // Reset page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchQueue = async () => {
    if (!selectedCompanyId) return;
    setIsLoading(true);
    try {
      const allEmployees = await getEmployees(selectedCompanyId);
      setEmployees(allEmployees);
      setSelectedIds([]);
    } catch (err) {
      console.error("Failed to fetch employees list:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getEmployeeName = (emp: any): string => {
    const data = emp.dynamicData as Record<string, any>;
    if (data && typeof data === 'object') {
      const p = data.Prenom || data.prenom || '';
      const n = data.Nom || data.nom || '';
      return `${p} ${n}`.trim() || emp.uniqueIdentifier;
    }
    return emp.uniqueIdentifier;
  };

  // Categories Filtering
  const readyToPrintList = employees.filter((emp) => {
    const isEnrolledAndValid = emp.hasPhoto && !emp.isBlocked && emp.status !== 'A_ENROLER' && emp.status !== 'A_VERIFIER';
    if (!isEnrolledAndValid) return false;
    const hasReprintRequest = emp.printJobs?.some((j: any) => 
      j.templateType === selectedTemplateType &&
      j.cardNumber === 'REIMPRESSION_DEMANDEE'
    );
    if (hasReprintRequest) return false;

    const hasJob = emp.printJobs?.some((j: any) => 
      j.templateType === selectedTemplateType &&
      j.cardNumber !== 'REIMPRESSION_DEMANDEE'
    );
    return !hasJob;
  });

  const notReadyList = employees.filter((emp) => {
    return emp.status === 'A_ENROLER' || 
      emp.status === 'A_VERIFIER' || 
      !emp.hasPhoto ||
      emp.isBlocked;
  });

  const toReprintList = employees.filter((emp) => {
    return emp.printJobs?.some((j: any) => 
      j.templateType === selectedTemplateType &&
      j.cardNumber === 'REIMPRESSION_DEMANDEE'
    );
  });

  const alreadyPrintedList = employees.filter((emp) => {
    return emp.printJobs?.some((j: any) => 
      j.templateType === selectedTemplateType &&
      j.cardNumber !== 'REIMPRESSION_DEMANDEE'
    );
  });

  const reprintedList = employees.filter((emp) => {
    const printCount = emp.printJobs?.filter((j: any) => 
      j.templateType === selectedTemplateType &&
      j.cardNumber !== 'REIMPRESSION_DEMANDEE'
    ).length || 0;
    return printCount > 1;
  });

  const historyList = employees.filter((emp) => {
    return emp.printJobs?.some((j: any) => 
      j.templateType === selectedTemplateType
    );
  });

  // Get active list based on selected tab
  const getActiveList = () => {
    switch (activeTab) {
      case 'ready': return readyToPrintList;
      case 'not-ready': return notReadyList;
      case 'to-reprint': return toReprintList;
      case 'printed': return alreadyPrintedList;
      case 'reprinted': return reprintedList;
      case 'history': return historyList;
    }
  };

  // Extract all unique dynamic keys from employees of the selected company
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

  // All dynamic keys ordered according to user preference (customFieldOrder)
  const orderedAllKeys = React.useMemo(() => {
    if (customFieldOrder.length === 0) return dynamicKeys;
    const sorted = [...customFieldOrder.filter((k) => dynamicKeys.includes(k))];
    dynamicKeys.forEach((k) => {
      if (!sorted.includes(k)) sorted.push(k);
    });
    return sorted;
  }, [dynamicKeys, customFieldOrder]);

  // Filtered keys to display in table according to hiddenFields and custom ordering
  const displayedDynamicKeys = React.useMemo(() => {
    return orderedAllKeys.filter((key) => !hiddenFields.includes(key));
  }, [orderedAllKeys, hiddenFields]);

  // Sorting States (identical to Delivery Batches logic)
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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

  const filteredEmployees = React.useMemo(() => {
    let result = getActiveList().filter((emp) => {
      const query = searchTerm.toLowerCase().trim();
      if (!query) return true;

      const name = getEmployeeName(emp).toLowerCase();
      const id = (emp.enrollmentNumber || '').toLowerCase();
      if (name.includes(query) || id.includes(query) || emp.uniqueIdentifier.toLowerCase().includes(query)) {
        return true;
      }

      const data = emp.dynamicData as Record<string, any>;
      if (data && typeof data === 'object') {
        return Object.values(data).some((val) =>
          val !== null && val !== undefined && String(val).toLowerCase().includes(query)
        );
      }

      return false;
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (sortField === 'name' || sortField === 'Nom Complet') {
          valA = getEmployeeSortKey(a);
          valB = getEmployeeSortKey(b);
        } else if (sortField === 'uniqueIdentifier' || sortField === 'Identifiant Unique') {
          valA = a.uniqueIdentifier || '';
          valB = b.uniqueIdentifier || '';
        } else if (sortField === 'enrollmentNumber' || sortField === "N° d'enrôlement") {
          valA = a.enrollmentNumber || '';
          valB = b.enrollmentNumber || '';
        } else if (sortField === 'status' || sortField === 'Statut / Détails') {
          valA = a.status || '';
          valB = b.status || '';
        } else {
          // Dynamic field lookup
          const dataA = a.dynamicData as Record<string, any>;
          const dataB = b.dynamicData as Record<string, any>;
          valA = getDynField(dataA, sortField) || '';
          valB = getDynField(dataB, sortField) || '';
        }

        const normalize = (v: any) => typeof v === 'string' ? v.trim() : v;
        valA = normalize(valA);
        valB = normalize(valB);

        if (typeof valA === 'string') {
          return sortDirection === 'asc'
            ? valA.localeCompare(String(valB), 'fr', { numeric: true, sensitivity: 'base' })
            : String(valB).localeCompare(valA, 'fr', { numeric: true, sensitivity: 'base' });
        } else {
          return sortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1);
        }
      });
    }

    return result;
  }, [employees, activeTab, selectedTemplateType, searchTerm, sortField, sortDirection]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => 
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredEmployees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEmployees.map((e) => e.id));
    }
  };

  const handlePrintSelected = () => {
    if (selectedIds.length === 0) return;
    window.open(`/dashboard/employees/print?ids=${encodeURIComponent(selectedIds.join(','))}&type=${selectedTemplateType}`, '_blank');
  };

  const handleMarkPrintedSelected = async () => {
    if (!selectedIds.length) return;
    
    const confirmMsg = `Êtes-vous sûr de vouloir marquer ces ${selectedIds.length} cartes comme imprimées ?`;
    if (!confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      await markAsPrinted(selectedIds, selectedTemplateType);
      // Update local state so they move to the correct tab instantly
      setEmployees(prev => prev.map(emp => {
        if (selectedIds.includes(emp.id)) {
          const isReprint = emp.printCount > 0 || emp.status === 'REIMPRESSION' || emp.status === 'REIMPRIME';
          const newJob = {
            id: `temp-${Date.now()}-${emp.id}`,
            employeeId: emp.id,
            cardNumber: emp.cardNumber || 'GENERE',
            templateType: selectedTemplateType,
            categoryId: null,
            physicalTypeId: null,
            isReprint,
            reprintReason: null,
            printedBy: 'Opérateur',
            printedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };
          return {
            ...emp,
            status: isReprint ? 'REIMPRIME' : 'IMPRIME',
            printCount: emp.printCount + 1,
            printedAt: new Date().toISOString(),
            printJobs: [newJob, ...(emp.printJobs || [])]
          };
        }
        return emp;
      }));
      setSelectedIds([]);
      toast({ title: "Impression", message: "Cartes marquées comme imprimées avec succès.", variant: "success" });
    } catch (error: any) {
      toast({ title: "Erreur", message: error.message || "Erreur lors du marquage des impressions.", variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getNotReadyReasons = (emp: any) => {
    const reasons: string[] = [];
    if (emp.photoConflict) reasons.push("Conflit de photo");
    if (emp.status === 'A_VERIFIER') reasons.push("À vérifier");
    if (emp.photoUrl === null) reasons.push("Photo manquante");
    if (emp.enrollmentNumber === null) reasons.push("N° d'enrôlement manquant");
    return reasons;
  };

  if (dbError) {
    return (
      <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl border border-red-200">
        <p>Erreur de connexion à la base de données. Impossible de charger la file d'impression.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/90 p-6 rounded-3xl border border-neutral-200 dark:border-slate-800/80 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-2.5">
          <div className="p-3 bg-indigo-50 dark:bg-slate-950 text-indigo-500 rounded-xl border border-indigo-100 dark:border-slate-800/80 shadow-sm">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-800 dark:text-white">File d&apos;impression</h1>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              Gérez, filtrez et lancez l&apos;impression des badges pour l&apos;entreprise sélectionnée.
            </p>
          </div>
        </div>

        {/* Filters and Selectors */}
        <div className="flex flex-wrap items-center gap-3 shrink-0 w-full md:w-auto">
          {/* Company Selector */}
          <div className="relative w-full sm:w-auto">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="pl-10 pr-10 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer appearance-none min-w-[200px] w-full"
            >
              <option value="">Sélectionner une entreprise...</option>
              {initialCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {selectedCompanyId && (
            <>
              {/* Document Type Selector */}
              <div className="relative w-full sm:w-auto">
                <select
                  value={selectedTemplateType}
                  onChange={(e) => setSelectedTemplateType(e.target.value)}
                  className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer appearance-none min-w-[150px] w-full"
                >
                  {documentTypes.map((t) => (
                    <option key={t.id} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedCompanyId ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* CATEGORIES TAB SELECTOR */}
          <div className="flex flex-wrap gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-px">
            <button
              onClick={() => setActiveTab('ready')}
              className={`pb-3 px-4 text-xs font-bold transition-all relative ${
                activeTab === 'ready'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <span>Prêt à imprimer</span>
              <span className="ml-2 py-0.5 px-2 bg-indigo-50 dark:bg-indigo-950/50 text-[10px] text-indigo-600 dark:text-indigo-400 rounded-full font-mono font-bold">
                {readyToPrintList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('not-ready')}
              className={`pb-3 px-4 text-xs font-bold transition-all relative ${
                activeTab === 'not-ready'
                  ? 'text-rose-600 dark:text-rose-400 border-b-2 border-rose-600 dark:border-rose-400'
                  : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <span>Pas prêt</span>
              <span className="ml-2 py-0.5 px-2 bg-rose-50 dark:bg-rose-950/50 text-[10px] text-rose-600 dark:text-rose-400 rounded-full font-mono font-bold">
                {notReadyList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('to-reprint')}
              className={`pb-3 px-4 text-xs font-bold transition-all relative ${
                activeTab === 'to-reprint'
                  ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-600 dark:border-violet-400'
                  : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <span>À réimprimer</span>
              <span className="ml-2 py-0.5 px-2 bg-violet-50 dark:bg-violet-950/50 text-[10px] text-violet-600 dark:text-violet-400 rounded-full font-mono font-bold">
                {toReprintList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('printed')}
              className={`pb-3 px-4 text-xs font-bold transition-all relative ${
                activeTab === 'printed'
                  ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
                  : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <span>Déjà imprimé</span>
              <span className="ml-2 py-0.5 px-2 bg-emerald-50 dark:bg-emerald-950/50 text-[10px] text-emerald-600 dark:text-emerald-400 rounded-full font-mono font-bold">
                {alreadyPrintedList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('reprinted')}
              className={`pb-3 px-4 text-xs font-bold transition-all relative ${
                activeTab === 'reprinted'
                  ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <span>Réimprimé</span>
              <span className="ml-2 py-0.5 px-2 bg-teal-50 dark:bg-teal-950/50 text-[10px] text-teal-600 dark:text-teal-400 rounded-full font-mono font-bold">
                {reprintedList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 px-4 text-xs font-bold transition-all relative ${
                activeTab === 'history'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <span>Historique</span>
              <span className="ml-2 py-0.5 px-2 bg-indigo-50 dark:bg-indigo-950/50 text-[10px] text-indigo-600 dark:text-indigo-400 rounded-full font-mono font-bold">
                {historyList.length}
              </span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-neutral-200 dark:border-slate-800/80 overflow-hidden shadow-sm">
            {/* ACTIONS BAR */}
            <div className="p-5 border-b border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, matricule ou identifiant..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder-neutral-400 text-neutral-800 dark:text-neutral-200"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {(activeTab === 'ready' || activeTab === 'to-reprint' || activeTab === 'printed' || activeTab === 'reprinted' || activeTab === 'history') && selectedIds.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrintSelected}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-bold rounded-xl transition shadow-sm whitespace-nowrap border border-indigo-100 dark:border-indigo-900"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Générer PDF d&apos;impression ({selectedIds.length})</span>
                    </button>

                    {(activeTab === 'printed' || activeTab === 'reprinted' || activeTab === 'history') && (
                      <button
                        type="button"
                        onClick={() => {
                          setReprintEmployeeId('');
                          setReprintTemplateType(selectedTemplateType || 'BADGE');
                          setReprintReason('');
                          setShowReprintDialog(true);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition shadow-sm whitespace-nowrap"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Demander réimpression ({selectedIds.length})</span>
                      </button>
                    )}
                    
                    {(activeTab === 'ready' || activeTab === 'to-reprint') && (
                      <button
                        type="button"
                        onClick={handleMarkPrintedSelected}
                        disabled={isSubmitting}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition shadow-sm whitespace-nowrap"
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                        <span>Marquer imprimé(s)</span>
                      </button>
                    )}
                  </>
                )}

                {/* Column Selection Dropdown */}
                {dynamicKeys.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 transition shadow-sm"
                      title="Personnaliser les colonnes"
                    >
                      <Columns className="w-4 h-4 text-indigo-500" />
                      <span>Colonnes</span>
                      <span className="py-0.5 px-1.5 bg-indigo-100 dark:bg-indigo-950 text-[10px] font-mono text-indigo-600 dark:text-indigo-400 rounded-full font-bold">
                        {displayedDynamicKeys.length}/{dynamicKeys.length}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${showColumnDropdown ? 'rotate-180' : ''}`} />
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
                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
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
                                  {/* Reorder Up/Down */}
                                  <div className="flex items-center gap-0.5 shrink-0 mr-1.5">
                                    <button
                                      type="button"
                                      disabled={index === 0}
                                      onClick={() => moveField(key, 'up')}
                                      className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-20 disabled:hover:bg-transparent transition"
                                      title="Déplacer vers la gauche"
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={index === orderedAllKeys.length - 1}
                                      onClick={() => moveField(key, 'down')}
                                      className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-20 disabled:hover:bg-transparent transition"
                                      title="Déplacer vers la droite"
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {/* Field label */}
                                  <span 
                                    className={`flex-1 font-medium truncate mr-2 cursor-pointer ${isVisible ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-400 dark:text-neutral-500 line-through'}`} 
                                    title={key}
                                    onClick={() => toggleFieldVisibility(key)}
                                  >
                                    {key}
                                  </span>

                                  {/* Checkbox */}
                                  <input
                                    type="checkbox"
                                    checked={isVisible}
                                    onChange={() => toggleFieldVisibility(key)}
                                    className="w-4 h-4 text-indigo-600 rounded border-neutral-300 dark:border-neutral-600 focus:ring-indigo-500 cursor-pointer shrink-0"
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

                <button
                  type="button"
                  onClick={fetchQueue}
                  className="inline-flex items-center justify-center p-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 transition"
                  title="Actualiser la file"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* TABLE SECTION */}
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">Chargement de la file d&apos;impression...</p>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <Printer className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mb-3" />
                  <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Aucun badge</h3>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 max-w-sm">
                    {searchTerm 
                      ? "Aucun résultat ne correspond à votre recherche."
                      : "Il n'y a aucun employé répertorié sous cet onglet actuellement."}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800/80 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                      <th className="py-4 px-6 w-12 text-center">
                        {(activeTab === 'ready' || activeTab === 'to-reprint' || activeTab === 'printed' || activeTab === 'reprinted' || activeTab === 'history') && (
                          <button 
                            type="button"
                            onClick={toggleSelectAll}
                            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition"
                          >
                            {selectedIds.length === filteredEmployees.length ? (
                              <CheckSquare className="w-4.5 h-4.5 text-indigo-500" />
                            ) : (
                              <Square className="w-4.5 h-4.5" />
                            )}
                          </button>
                        )}
                      </th>
                      <th className="py-4 px-4 w-16">Photo</th>
                      {dynamicKeys.length > 0 ? (
                        displayedDynamicKeys.map((key) => (
                          <th 
                            key={key} 
                            onClick={() => handleSort(key)}
                            className="py-4 px-4 whitespace-nowrap cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition select-none"
                            title={`Trier par ${key}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span>{key}</span>
                              {sortField === key ? (
                                sortDirection === 'asc' ? (
                                  <ArrowUp className="w-3.5 h-3.5 text-indigo-500" />
                                ) : (
                                  <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-neutral-300 dark:text-neutral-600 opacity-60" />
                              )}
                            </div>
                          </th>
                        ))
                      ) : (
                        <>
                          <th 
                            onClick={() => handleSort('Nom Complet')}
                            className="py-4 px-4 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition select-none"
                            title="Trier par Nom Complet"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Nom Complet</span>
                              {sortField === 'Nom Complet' || sortField === 'name' ? (
                                sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-500" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-neutral-300 dark:text-neutral-600 opacity-60" />
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort('Identifiant Unique')}
                            className="py-4 px-4 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition select-none"
                            title="Trier par Identifiant Unique"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Identifiant Unique</span>
                              {sortField === 'Identifiant Unique' || sortField === 'uniqueIdentifier' ? (
                                sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-500" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-neutral-300 dark:text-neutral-600 opacity-60" />
                              )}
                            </div>
                          </th>
                        </>
                      )}
                      <th 
                        onClick={() => handleSort("N° d'enrôlement")}
                        className="py-4 px-4 whitespace-nowrap cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition select-none"
                        title="Trier par N° d'enrôlement"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>N° d&apos;enrôlement</span>
                          {sortField === "N° d'enrôlement" || sortField === 'enrollmentNumber' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-500" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-neutral-300 dark:text-neutral-600 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('Statut / Détails')}
                        className="py-4 px-4 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition select-none"
                        title="Trier par Statut"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Statut / Détails</span>
                          {sortField === 'Statut / Détails' || sortField === 'status' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-500" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-neutral-300 dark:text-neutral-600 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th className="py-4 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                    {filteredEmployees.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((emp) => {
                      const isSelected = selectedIds.includes(emp.id);
                      const name = getEmployeeName(emp);

                      return (
                        <tr 
                          key={emp.id}
                          onClick={() => {
                            if (activeTab === 'ready' || activeTab === 'to-reprint' || activeTab === 'printed' || activeTab === 'reprinted' || activeTab === 'history') {
                              toggleSelect(emp.id);
                            }
                          }}
                          className={`hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors cursor-pointer ${
                            isSelected ? 'bg-indigo-50/10 dark:bg-indigo-950/5' : ''
                          }`}
                        >
                          <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                            {(activeTab === 'ready' || activeTab === 'to-reprint' || activeTab === 'printed' || activeTab === 'reprinted' || activeTab === 'history') && (
                              <button
                                type="button"
                                onClick={() => toggleSelect(emp.id)}
                                className="text-neutral-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4.5 h-4.5 text-indigo-500 dark:text-indigo-400" />
                                ) : (
                                  <Square className="w-4.5 h-4.5" />
                                )}
                              </button>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden flex items-center justify-center">
                              <EmployeePhoto 
                                employeeId={emp.id} 
                                hasPhoto={emp.hasPhoto} 
                                photoFit={(emp.dynamicData as any)?._photoFit}
                              />
                            </div>
                          </td>
                          {dynamicKeys.length > 0 ? (
                            displayedDynamicKeys.map((key) => {
                              const val = (emp.dynamicData as Record<string, any>)?.[key];
                              const displayVal = typeof val === 'object' && val !== null 
                                ? JSON.stringify(val) 
                                : (val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : '-');
                              return (
                                <td 
                                  key={key} 
                                  className="py-4 px-4 text-xs font-medium text-neutral-800 dark:text-neutral-200 whitespace-nowrap max-w-[200px] truncate" 
                                  title={displayVal}
                                >
                                  {displayVal}
                                </td>
                              );
                            })
                          ) : (
                            <>
                              <td className="py-4 px-4 font-semibold text-xs text-neutral-800 dark:text-neutral-200">
                                {name}
                              </td>
                              <td className="py-4 px-4 text-xs text-neutral-500 dark:text-neutral-400">
                                {emp.uniqueIdentifier}
                              </td>
                            </>
                          )}
                          <td className="py-4 px-4 font-mono text-xs font-bold text-neutral-800 dark:text-neutral-200">
                            {emp.enrollmentNumber || (
                              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 italic font-normal">Non généré</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {(() => {
                              const jobsForType = emp.printJobs?.filter((j: any) => j.templateType === selectedTemplateType) || [];
                              const validJobs = jobsForType.filter((j: any) => j.cardNumber !== 'REIMPRESSION_DEMANDEE');
                              const reqJob = jobsForType.find((j: any) => j.cardNumber === 'REIMPRESSION_DEMANDEE');
                              const lastValidJob = validJobs[validJobs.length - 1];

                              if (activeTab === 'ready') {
                                return (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200/25 dark:border-indigo-900/30">
                                    Prêt à imprimer
                                  </span>
                                );
                              }

                              if (activeTab === 'to-reprint') {
                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-200/25 dark:border-violet-900/30 w-max">
                                      À réimprimer
                                    </span>
                                    {reqJob?.reprintReason && (
                                      <span className="text-[9px] text-neutral-500 dark:text-neutral-400 mt-1 max-w-[200px] truncate" title={reqJob.reprintReason}>
                                        Motif: {reqJob.reprintReason}
                                      </span>
                                    )}
                                  </div>
                                );
                              }

                              if (activeTab === 'printed') {
                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200/25 dark:border-emerald-900/30 w-max">
                                      Imprimé
                                    </span>
                                    {lastValidJob?.createdAt && (
                                      <span className="text-[9px] text-neutral-400 dark:text-neutral-500">
                                        le {new Date(lastValidJob.createdAt).toLocaleDateString('fr-FR')}
                                      </span>
                                    )}
                                  </div>
                                );
                              }

                              if (activeTab === 'reprinted') {
                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-200/25 dark:border-teal-900/30 w-max">
                                      Réimprimé ({validJobs.length}x)
                                    </span>
                                    {lastValidJob?.createdAt && (
                                      <span className="text-[9px] text-neutral-400 dark:text-neutral-500">
                                        le {new Date(lastValidJob.createdAt).toLocaleDateString('fr-FR')}
                                      </span>
                                    )}
                                  </div>
                                );
                              }

                              if (activeTab === 'history') {
                                const isReprinted = validJobs.length > 1;
                                const isPrinted = validJobs.length === 1;
                                const isToReprint = !!reqJob;

                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold w-max ${
                                      isReprinted
                                        ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-200/25 dark:border-teal-900/30'
                                        : isPrinted
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200/25 dark:border-emerald-900/30'
                                        : isToReprint
                                        ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-200/25 dark:border-violet-900/30'
                                        : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200/25 dark:border-indigo-900/30'
                                    }`}>
                                      {isReprinted ? `Réimprimé (${validJobs.length}x)` : isPrinted ? 'Imprimé' : isToReprint ? 'À réimprimer' : 'Prêt à imprimer'}
                                    </span>
                                    {lastValidJob?.createdAt && (
                                      <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium">
                                        Dernière impression le {new Date(lastValidJob.createdAt).toLocaleDateString('fr-FR')}
                                      </span>
                                    )}
                                  </div>
                                );
                              }

                              if (activeTab === 'not-ready') {
                                return (
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {getNotReadyReasons(emp).map((reason) => (
                                      <span 
                                        key={reason}
                                        className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/20 text-[9px] font-bold text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30"
                                      >
                                        {reason}
                                      </span>
                                    ))}
                                  </div>
                                );
                              }

                              return null;
                            })()}
                          </td>
                          <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end items-center gap-1.5">
                              {/* Print Button */}
                              {(activeTab === 'ready' || activeTab === 'to-reprint' || activeTab === 'printed' || activeTab === 'reprinted' || activeTab === 'history') && (
                                <button
                                  type="button"
                                  onClick={() => window.open(`/dashboard/employees/print?ids=${encodeURIComponent(emp.id)}&type=${selectedTemplateType}`, '_blank')}
                                  className="inline-flex items-center justify-center p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-neutral-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                                  title="Imprimer ce badge"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                              )}
                              {/* Reprint request Button */}
                              {(emp.status === 'IMPRIME' || emp.status === 'REIMPRIME') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReprintEmployeeId(emp.id);
                                    const historyTypes = emp.printJobs
                                      ?.filter((j: any) => j.templateType && j.templateType !== 'PENDING' && j.templateType !== 'DEBLOCAGE')
                                      .map((j: any) => j.templateType) || [];
                                    const firstType = historyTypes.length > 0 ? historyTypes[0] : (documentTypes[0]?.slug || 'BADGE');
                                    setReprintTemplateType(firstType);
                                    setReprintReason('');
                                    setShowReprintDialog(true);
                                  }}
                                  className="inline-flex items-center justify-center p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-violet-200 hover:bg-violet-50 dark:hover:bg-violet-950/20 text-neutral-500 dark:text-neutral-400 hover:text-violet-600 dark:hover:text-violet-400 transition"
                                  title="Demander une réimpression"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                              {/* Fallback if no actions */}
                              {!(activeTab === 'ready' || activeTab === 'to-reprint' || activeTab === 'printed' || activeTab === 'reprinted' || activeTab === 'history') && !(emp.status === 'IMPRIME' || emp.status === 'REIMPRIME') && (
                                <span className="text-xs text-neutral-400 italic">Non applicable</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {filteredEmployees.length > 0 && (
              <div className="bg-white dark:bg-neutral-800 border-t border-neutral-100 dark:border-neutral-800 px-6 py-3">
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredEmployees.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                  pageSizeOptions={[10, 25, 50, 100, 250]}
                  itemLabel="employés"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-800 text-center shadow-sm">
          <Printer className="w-16 h-16 text-neutral-300 dark:text-neutral-700 mb-4 animate-pulse" />
          <h2 className="text-lg font-bold text-neutral-800 dark:text-white">Sélectionnez une entreprise</h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm">
            Veuillez sélectionner une entreprise cliente dans la liste déroulante ci-dessus pour charger sa file d&apos;impression.
          </p>
        </div>
      )}

      {/* REPRINT DIALOG */}
      {showReprintDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-neutral-800 dark:text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-violet-500" /> 
              {selectedIds.length > 1 
                ? `Demande de réimpression en lot (${selectedIds.length} cartes)` 
                : 'Demande de réimpression'}
            </h3>
            <p className="text-xs text-neutral-500">
              {selectedIds.length > 1
                ? `Un motif est obligatoire. Il sera appliqué aux ${selectedIds.length} cartes sélectionnées.`
                : "Un motif est obligatoire. Il sera visible sur la fiche et dans la file d'impression."}
            </p>
            
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Type de carte à réimprimer</label>
              <select
                value={reprintTemplateType}
                onChange={(e) => setReprintTemplateType(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold focus:outline-none"
              >
                {documentTypes.length > 0 ? (
                  documentTypes.map((t) => (
                    <option key={t.id} value={t.slug || t.name}>{t.name}</option>
                  ))
                ) : (
                  <>
                    <option value="BADGE">BADGE</option>
                    <option value="CARTE_PRO">CARTE_PRO</option>
                    <option value="RECU">RECU</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Numéro de carte</label>
              <div className="flex flex-col gap-2 bg-neutral-50 dark:bg-neutral-900 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-neutral-700 dark:text-neutral-300">
                  <input
                    type="radio"
                    name="reprintCardOptionQueue"
                    value="KEEP"
                    checked={reprintCardNumberOption === 'KEEP'}
                    onChange={() => setReprintCardNumberOption('KEEP')}
                    className="text-violet-600 focus:ring-violet-500"
                  />
                  <span>Conserver le numéro actuel</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-neutral-700 dark:text-neutral-300">
                  <input
                    type="radio"
                    name="reprintCardOptionQueue"
                    value="GENERATE"
                    checked={reprintCardNumberOption === 'GENERATE'}
                    onChange={() => setReprintCardNumberOption('GENERATE')}
                    className="text-violet-600 focus:ring-violet-500"
                  />
                  <span>Générer un nouveau numéro de carte automatique</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-neutral-700 dark:text-neutral-300">
                  <input
                    type="radio"
                    name="reprintCardOptionQueue"
                    value="CUSTOM"
                    checked={reprintCardNumberOption === 'CUSTOM'}
                    onChange={() => setReprintCardNumberOption('CUSTOM')}
                    className="text-violet-600 focus:ring-violet-500"
                  />
                  <span>Modifier / Numéro de carte personnalisé</span>
                </label>
                {reprintCardNumberOption === 'CUSTOM' && (
                  <input
                    type="text"
                    value={reprintCustomCardNumber}
                    onChange={(e) => setReprintCustomCardNumber(e.target.value)}
                    placeholder="Saisir un numéro de carte (ex: 225AGR260050)"
                    className="mt-1 w-full px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 rounded-lg text-xs font-mono"
                  />
                )}
              </div>
            </div>

            <textarea
              value={reprintReason}
              onChange={(e) => setReprintReason(e.target.value)}
              placeholder="Ex: Badge perdu, nom incorrect, photo à changer..."
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs min-h-[80px] focus:ring-2 focus:ring-violet-500/25"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowReprintDialog(false); setReprintReason(''); }} className="px-4 py-2 text-xs font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition">Annuler</button>
              <button
                disabled={!reprintReason.trim() || isSaving || (reprintCardNumberOption === 'CUSTOM' && !reprintCustomCardNumber.trim())}
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    const rawIds = selectedIds.length > 0 ? selectedIds : (reprintEmployeeId ? [reprintEmployeeId] : []);
                    const selectedEmps = employees.filter((e) => rawIds.includes(e.id));
                    const eligibleEmps = selectedEmps.filter(
                      (emp) => emp.status === 'IMPRIME' || emp.status === 'REIMPRIME' || (emp.printJobs && emp.printJobs.length > 0)
                    );
                    const targetIds = eligibleEmps.map((e) => e.id);

                    if (targetIds.length === 0) {
                      toast({
                        title: "Réimpression impossible",
                        message: "Aucun des employés sélectionnés n'a le statut d'imprimé.",
                        variant: "warning",
                      });
                      setIsSaving(false);
                      return;
                    }

                    await requestReprintBatch(
                      targetIds, 
                      reprintReason.trim(), 
                      reprintTemplateType,
                      reprintCardNumberOption,
                      reprintCustomCardNumber.trim()
                    );
                    setShowReprintDialog(false);
                    setReprintReason('');
                    setSelectedIds([]);
                    toast({
                      title: "Demande enregistrée",
                      message: `${targetIds.length} carte(s) demandée(s) en réimpression avec succès.`,
                      variant: "success",
                    });
                    // Refresh queue
                    fetchQueue();
                  } catch (err: any) {
                    alert(err.message || 'Erreur lors de la demande de réimpression.');
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer la réimpression'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
