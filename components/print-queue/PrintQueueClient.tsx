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
  RotateCcw
} from 'lucide-react';
import { getEmployees, requestReprint } from '@/app/actions/employees';
import { getCardDocumentTypes } from '@/app/actions/cards';
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
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

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
      return;
    }

    const fetchDocTypes = async () => {
      try {
        const types = await getCardDocumentTypes(selectedCompanyId);
        setDocumentTypes(types);
      } catch (err) {
        console.error("Failed to fetch document types:", err);
      }
    };
    
    fetchDocTypes();
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
  const readyToPrintList = employees.filter((emp) => 
    emp.hasPhoto && 
    (emp.status === 'PHOTO_VALIDEE' || emp.status === 'REIMPRESSION') &&
    !emp.isBlocked
  );

  const notReadyList = employees.filter((emp) => 
    emp.status === 'A_ENROLER' || 
    emp.status === 'A_VERIFIER' || 
    !emp.hasPhoto ||
    emp.isBlocked
  );

  const toReprintList = employees.filter((emp) => 
    emp.status === 'REIMPRESSION'
  );

  const alreadyPrintedList = employees.filter((emp) => 
    emp.status === 'IMPRIME'
  );

  const reprintedList = employees.filter((emp) => 
    emp.status === 'REIMPRIME'
  );

  const historyList = employees.filter((emp) => 
    emp.printedAt !== null || 
    emp.status === 'IMPRIME' || 
    emp.status === 'REIMPRESSION' || 
    emp.status === 'REIMPRIME'
  );

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

  const filteredEmployees = getActiveList().filter((emp) => {
    const name = getEmployeeName(emp).toLowerCase();
    const id = (emp.enrollmentNumber || '').toLowerCase();
    const query = searchTerm.toLowerCase();
    return name.includes(query) || id.includes(query) || emp.uniqueIdentifier.toLowerCase().includes(query);
  });

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
    window.open(`/dashboard/employees/print?ids=${encodeURIComponent(selectedIds.join(','))}`, '_blank');
  };

  const handleMarkPrintedSelected = async () => {
    if (!selectedIds.length) return;
    
    const confirmMsg = `Êtes-vous sûr de vouloir marquer ces ${selectedIds.length} badges comme imprimés ?`;
    if (!confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      await markAsPrinted(selectedIds);
      // Update local state so they move to the correct tab instantly
      setEmployees(prev => prev.map(emp => {
        if (selectedIds.includes(emp.id)) {
          const isReprint = emp.printCount > 0 || emp.status === 'REIMPRESSION' || emp.status === 'REIMPRIME';
          return {
            ...emp,
            status: isReprint ? 'REIMPRIME' : 'IMPRIME',
            printCount: emp.printCount + 1,
            printedAt: new Date().toISOString()
          };
        }
        return emp;
      }));
      setSelectedIds([]);
      alert('Cartes marquées comme imprimées avec succès.');
    } catch (error: any) {
      alert(error.message || "Erreur lors du marquage des impressions.");
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-neutral-800 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-2.5">
          <div className="p-3 bg-indigo-50 dark:bg-neutral-900 text-indigo-500 rounded-xl border border-indigo-100 dark:border-neutral-800 shadow-sm">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-800 dark:text-white">File d&apos;impression</h1>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              Gérez, filtrez et lancez l&apos;impression des badges pour l&apos;entreprise sélectionnée.
            </p>
          </div>
        </div>

        {/* Company Selector */}
        <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
          <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider hidden sm:block">
            Entreprise :
          </label>
          <div className="relative w-full sm:w-auto">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="pl-10 pr-10 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer appearance-none min-w-[220px] w-full"
            >
              <option value="">Sélectionner une entreprise...</option>
              {initialCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
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

          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
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
                      <th className="py-4 px-4">Nom Complet</th>
                      <th className="py-4 px-4">Identifiant Unique</th>
                      <th className="py-4 px-4">N° d&apos;enrôlement</th>
                      <th className="py-4 px-4">Statut / Détails</th>
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
                              <EmployeePhoto employeeId={emp.id} hasPhoto={emp.hasPhoto} />
                            </div>
                          </td>
                          <td className="py-4 px-4 font-semibold text-xs text-neutral-800 dark:text-neutral-200">
                            {name}
                          </td>
                          <td className="py-4 px-4 text-xs text-neutral-500 dark:text-neutral-400">
                            {emp.uniqueIdentifier}
                          </td>
                          <td className="py-4 px-4 font-mono text-xs font-bold text-neutral-800 dark:text-neutral-200">
                            {emp.enrollmentNumber || (
                              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 italic font-normal">Non généré</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {activeTab === 'ready' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200/25 dark:border-indigo-900/30">
                                Prêt à imprimer
                              </span>
                            )}
                            {activeTab === 'to-reprint' && (
                              <div className="flex flex-col gap-0.5">
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-200/25 dark:border-violet-900/30 w-max">
                                  À réimprimer
                                </span>
                                {(() => {
                                  const reqJob = emp.printJobs?.find((j: any) => j.cardNumber === 'REIMPRESSION_DEMANDEE');
                                  if (reqJob && reqJob.reprintReason) {
                                    return (
                                      <span className="text-[9px] text-neutral-500 dark:text-neutral-400 mt-1 max-w-[200px] truncate" title={reqJob.reprintReason}>
                                        Motif: {reqJob.reprintReason}
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            )}
                            {activeTab === 'printed' && (
                              <div className="flex flex-col gap-0.5">
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200/25 dark:border-emerald-900/30 w-max">
                                  Imprimé
                                </span>
                                {emp.printedAt && (
                                  <span className="text-[9px] text-neutral-400 dark:text-neutral-500">
                                    le {new Date(emp.printedAt).toLocaleDateString('fr-FR')}
                                  </span>
                                )}
                              </div>
                            )}
                            {activeTab === 'reprinted' && (
                              <div className="flex flex-col gap-0.5">
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-200/25 dark:border-teal-900/30 w-max">
                                  Réimprimé
                                </span>
                                {emp.printedAt && (
                                  <span className="text-[9px] text-neutral-400 dark:text-neutral-500">
                                    le {new Date(emp.printedAt).toLocaleDateString('fr-FR')}
                                  </span>
                                )}
                              </div>
                            )}
                            {activeTab === 'history' && (
                              <div className="flex flex-col gap-0.5">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold w-max ${
                                  emp.status === 'IMPRIME'
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200/25 dark:border-emerald-900/30'
                                    : emp.status === 'REIMPRIME'
                                    ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-200/25 dark:border-teal-900/30'
                                    : emp.status === 'REIMPRESSION'
                                    ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-200/25 dark:border-violet-900/30'
                                    : emp.status === 'A_VERIFIER'
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200/25 dark:border-rose-900/30'
                                    : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200/25 dark:border-indigo-900/30'
                                }`}>
                                  {emp.status === 'IMPRIME' && 'Imprimé'}
                                  {emp.status === 'REIMPRIME' && 'Réimprimé'}
                                  {emp.status === 'REIMPRESSION' && 'À réimprimer'}
                                  {emp.status === 'A_ENROLER' && 'À enrôler'}
                                  {emp.status === 'PHOTO_VALIDEE' && 'Validé (Prêt)'}
                                  {emp.status === 'A_VERIFIER' && 'À vérifier'}
                                </span>
                                {emp.printedAt && (
                                  <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium">
                                    Dernière impression le {new Date(emp.printedAt).toLocaleDateString('fr-FR')}
                                  </span>
                                )}
                              </div>
                            )}
                            {activeTab === 'not-ready' && (
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
                            )}
                          </td>
                          <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end items-center gap-1.5">
                              {/* Print Button */}
                              {(activeTab === 'ready' || activeTab === 'to-reprint' || activeTab === 'printed' || activeTab === 'reprinted' || activeTab === 'history') && (
                                <button
                                  type="button"
                                  onClick={() => window.open(`/dashboard/employees/print?ids=${encodeURIComponent(emp.id)}`, '_blank')}
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
                  pageSizeOptions={[10, 25, 50, 100]}
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
              <RotateCcw className="w-4 h-4 text-violet-500" /> Demande de réimpression
            </h3>
            <p className="text-xs text-neutral-500">Un motif est obligatoire. Il sera visible sur la fiche et dans la file d&apos;impression.</p>
            
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

            <textarea
              value={reprintReason}
              onChange={(e) => setReprintReason(e.target.value)}
              placeholder="Ex: Badge perdu, nom incorrect, photo à changer..."
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs min-h-[80px] focus:ring-2 focus:ring-violet-500/25"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowReprintDialog(false); setReprintReason(''); }} className="px-4 py-2 text-xs font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition">Annuler</button>
              <button
                disabled={!reprintReason.trim() || isSaving}
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    await requestReprint(reprintEmployeeId, reprintReason.trim(), reprintTemplateType);
                    setShowReprintDialog(false);
                    setReprintReason('');
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
