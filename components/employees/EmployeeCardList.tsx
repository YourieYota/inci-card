'use client';

import React, { useState, useEffect } from 'react';
import { Employee } from '@prisma/client';
import { Camera, Search, UserCheck, Check, Printer, AlertCircle, RefreshCw } from 'lucide-react';
import { updateEmployeeStatus } from '@/app/actions/employees';
import Pagination from '@/components/ui/Pagination';
import EmployeePhoto from './EmployeePhoto';

interface EmployeeCardListProps {
  employees: Employee[];
  onTriggerWebcam: (employee: Employee) => void;
  onRefresh: () => void;
  onOpenDetail: (employee: Employee) => void;
  isOfflineMode?: boolean;
}

type FilterStatus = 'ALL' | 'A_ENROLER' | 'PHOTO_VALIDEE' | 'IMPRIME' | 'A_VERIFIER' | 'REIMPRESSION';

export default function EmployeeCardList({ employees, onTriggerWebcam, onRefresh, onOpenDetail, isOfflineMode = false }: EmployeeCardListProps) {
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Auto-refresh when the operator returns from the print preview tab
  useEffect(() => {
    const handleFocus = () => {
      onRefresh();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [onRefresh]);

  // Clear selection if employees list changes (e.g., filter/company change)
  useEffect(() => {
    setSelectedIds([]);
    setCurrentPage(1);
  }, [employees]);

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  // Search filter implementation
  const matchesSearch = (emp: Employee) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    // Check enrollmentNumber and uniqueIdentifier
    if (emp.enrollmentNumber && emp.enrollmentNumber.toLowerCase().includes(query)) return true;
    if (emp.uniqueIdentifier.toLowerCase().includes(query)) return true;

    // Check all dynamic data values
    const data = emp.dynamicData as Record<string, any>;
    if (data) {
      return Object.values(data).some((val) =>
        String(val).toLowerCase().includes(query)
      );
    }

    return false;
  };

  // Status filter implementation
  const matchesFilter = (emp: Employee) => {
    if (filter === 'ALL') return true;
    return emp.status === filter;
  };

  const filteredEmployees = employees.filter((e) => matchesSearch(e) && matchesFilter(e));

  // Paginated slice
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const printableEmployees = filteredEmployees.filter((emp) => emp.status !== 'A_ENROLER');
    if (selectedIds.length === printableEmployees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(printableEmployees.map((emp) => emp.id));
    }
  };

  const handlePrintSelection = () => {
    if (selectedIds.length === 0) return;
    window.open(`/dashboard/employees/print?ids=${encodeURIComponent(selectedIds.join(','))}`, '_blank');
  };

  const handlePrintIndividual = (id: string) => {
    window.open(`/dashboard/employees/print?ids=${encodeURIComponent(id)}`, '_blank');
  };

  // Helper to extract main employee details from dynamicData
  const getEmployeeDetails = (emp: Employee) => {
    const data = emp.dynamicData as Record<string, any>;
    if (!data) return { name: 'Employé', fields: [] };

    const keys = Object.keys(data);
    const getValueForKeys = (possibleKeys: string[]) => {
      const foundKey = keys.find(k => possibleKeys.includes(k.toLowerCase().trim()));
      return foundKey ? String(data[foundKey]).trim() : '';
    };

    // 1. Try to find a single full name key
    let fullName = getValueForKeys([
      'noms et prénoms', 'noms et prenoms', 'nom et prénom', 'nom et prenom',
      'nom & prénom', 'nom & prenom', 'nom complet', 'nom_prenom',
      'name', 'fullname', 'employee name', 'employe', 'employé'
    ]);

    // 2. If no full name key, try to combine first name and last name
    if (!fullName) {
      const firstName = getValueForKeys(['prenom', 'prénom', 'prenoms', 'prénoms', 'firstname', 'firstnames']);
      const lastName = getValueForKeys(['nom', 'noms', 'lastname', 'lastnames', 'surname', 'surnames', 'familyname']);
      fullName = `${lastName} ${firstName}`.trim();
    }

    // 3. Fallback to enrollmentNumber or uniqueIdentifier
    if (!fullName) {
      fullName = emp.enrollmentNumber || emp.uniqueIdentifier;
    }

    // Filter out name keys to show other attributes
    const nameKeys = [
      'nom', 'noms', 'prenom', 'prénom', 'prenoms', 'prénoms', 'firstname', 'lastname',
      'name', 'fullname', 'employee name', 'employe', 'employé',
      'noms et prénoms', 'noms et prenoms', 'nom et prénom', 'nom et prenom',
      'nom & prénom', 'nom & prenom', 'nom complet', 'nom_prenom'
    ];
    const fields = Object.entries(data)
      .filter(([key]) => !nameKeys.includes(key.toLowerCase().trim()))
      .slice(0, 4); // Limit to 4 key info fields for aesthetics

    return { name: fullName, fields };
  };

  // Only employees with validated photo or already printed can be printed
  const printableFilteredCount = filteredEmployees.filter((emp) => emp.status !== 'A_ENROLER').length;

  return (
    <div className="space-y-6">
      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-blue-100/50 dark:border-neutral-800/80 shadow-sm">
        {/* Status Filters */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-50 dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800/60 rounded-xl w-full lg:w-auto">
          {(['ALL', 'A_ENROLER', 'PHOTO_VALIDEE', 'IMPRIME', 'A_VERIFIER', 'REIMPRESSION'] as FilterStatus[]).map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                filter === st
                  ? st === 'ALL' ? 'bg-white dark:bg-neutral-800 text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200/80 dark:border-neutral-700'
                  : st === 'A_ENROLER' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 shadow-sm border border-amber-200/60 dark:border-amber-900/40'
                  : st === 'PHOTO_VALIDEE' ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 shadow-sm border border-blue-200/60 dark:border-blue-900/40'
                  : st === 'A_VERIFIER' ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 shadow-sm border border-rose-200/60 dark:border-rose-900/40'
                  : st === 'REIMPRESSION' ? 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 shadow-sm border border-violet-200/60 dark:border-violet-900/40'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 shadow-sm border border-emerald-200/60 dark:border-emerald-900/40'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 hover:bg-white/60 dark:hover:bg-neutral-800/50'
              }`}
            >
              {st === 'ALL' && 'Tous'}
              {st === 'A_ENROLER' && 'À enrôler'}
              {st === 'PHOTO_VALIDEE' && 'Photo Validée'}
              {st === 'IMPRIME' && 'Imprimés'}
              {st === 'A_VERIFIER' && 'À vérifier'}
              {st === 'REIMPRESSION' && 'Réimpression'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full lg:w-80">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Rechercher par nom, matricule..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500/25"
          />
        </div>
      </div>

      {/* BULK ACTIONS BAR */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 px-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/40 shadow-sm animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
              {selectedIds.length} employé{selectedIds.length > 1 ? 's' : ''} sélectionné{selectedIds.length > 1 ? 's' : ''} pour impression
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 border border-indigo-200/50 dark:border-indigo-900 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-indigo-700 dark:text-indigo-400 rounded-xl text-[11px] font-bold transition"
            >
              {selectedIds.length === printableFilteredCount ? 'Tout désélectionner' : 'Sélectionner tous les validés'}
            </button>
            <button
              onClick={handlePrintSelection}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold transition shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer la sélection</span>
            </button>
          </div>
        </div>
      )}

      {/* CARDS GRID */}
      {filteredEmployees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-center shadow-sm">
          <AlertCircle className="w-8 h-8 text-neutral-400 mb-2" />
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Aucun employé ne correspond aux critères.</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">Essayez de modifier vos filtres ou effectuez un import Excel.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {paginatedEmployees.map((emp) => {
            const { name, fields } = getEmployeeDetails(emp);
            const isSelfUpdating = isUpdating === emp.id;
            const isSelectable = emp.status !== 'A_ENROLER';

            return (
              <div
                key={emp.id}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (
                    target.closest('button') ||
                    target.closest('input[type="checkbox"]')
                  ) {
                    return;
                  }
                  onOpenDetail(emp);
                }}
                className={`cursor-pointer group bg-white dark:bg-neutral-800 border rounded-2xl hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col justify-between ${
                  selectedIds.includes(emp.id)
                    ? 'border-indigo-400 ring-2 ring-indigo-500/15 shadow-sm'
                    : emp.status === 'A_VERIFIER' || (emp as any).photoConflict
                    ? 'border-rose-300 dark:border-rose-900/40 ring-1 ring-rose-500/10 shadow-sm'
                    : emp.status === 'A_ENROLER'
                    ? 'border-amber-100/80 dark:border-amber-900/20 hover:border-amber-300/60 dark:hover:border-amber-800/40'
                    : emp.status === 'PHOTO_VALIDEE'
                    ? 'border-blue-100/80 dark:border-blue-900/20 hover:border-blue-300/60 dark:hover:border-blue-800/40'
                    : emp.status === 'REIMPRESSION'
                    ? 'border-violet-200/80 dark:border-violet-900/20 hover:border-violet-300/60 dark:hover:border-violet-800/40'
                    : 'border-emerald-100/80 dark:border-emerald-900/20 hover:border-emerald-300/60 dark:hover:border-emerald-800/40'
                }`}
              >
                {/* Top color strip by status */}
                <div className={`h-0.5 w-full ${
                  emp.status === 'A_VERIFIER' || (emp as any).photoConflict ? 'bg-rose-500' :
                  emp.status === 'A_ENROLER' ? 'bg-amber-400/60' :
                  emp.status === 'PHOTO_VALIDEE' ? 'bg-blue-400/60' :
                  emp.status === 'REIMPRESSION' ? 'bg-violet-400/60' :
                  'bg-emerald-400/60'
                }`} />

                {/* Employee Info Header */}
                <div className="p-5 flex gap-4.5 items-start relative">
                  {/* Selection Checkbox */}
                  {isSelectable && (
                    <div className="flex items-center pt-1.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(emp.id)}
                        onChange={() => handleToggleSelect(emp.id)}
                        className="w-4 h-4 rounded text-indigo-600 border-neutral-300 dark:border-neutral-700 accent-indigo-600 cursor-pointer transition"
                      />
                    </div>
                  )}

                  {/* Photo area */}
                  <div className="w-18 h-18 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shrink-0 overflow-hidden flex items-center justify-center shadow-inner relative group-hover:border-neutral-300 dark:group-hover:border-neutral-700 transition-colors">
                    <EmployeePhoto employeeId={emp.id} hasPhoto={(emp as any).hasPhoto} />
                    {(emp as any).photoConflict && (
                      <div className="absolute inset-0 bg-rose-500/10 flex items-center justify-center">
                        <div className="bg-rose-600 text-white rounded-full p-1 shadow-sm">
                          <AlertCircle className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Text details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-neutral-400 dark:text-neutral-500 font-mono tracking-tight truncate">
                        ID: {emp.enrollmentNumber || emp.uniqueIdentifier}
                      </span>
                      {/* Status Tag */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          emp.status === 'A_VERIFIER' || (emp as any).photoConflict
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/70 dark:border-rose-800/40'
                            : emp.status === 'A_ENROLER'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/40'
                            : emp.status === 'PHOTO_VALIDEE'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200/70 dark:border-blue-800/40'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/40'
                        }`}
                      >
                        {emp.status === 'A_VERIFIER' && 'À vérifier'}
                        {emp.status === 'A_ENROLER' && 'À enrôler'}
                        {emp.status === 'PHOTO_VALIDEE' && 'Validé'}
                        {emp.status === 'IMPRIME' && ((emp as any).isLocked ? '🔒 Imprimé' : 'Imprimé')}
                        {emp.status === 'REIMPRESSION' && '♻️ Réimpression'}
                      </span>
                      {(emp as any).isBlocked && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/70 dark:border-rose-800/40">
                          🚫 Bloqué
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-neutral-800 dark:text-white mt-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {name}
                    </h4>

                    {/* Meta dynamic list items */}
                    <div className="mt-3 space-y-1">
                      {fields.map(([key, val]) => {
                        let displayedVal = String(val);
                        const isDateKey = key.toLowerCase().trim().startsWith('date');
                        const isDateVal = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val);
                        if ((isDateKey || isDateVal) && val) {
                          const dateObj = new Date(val);
                          if (!isNaN(dateObj.getTime())) {
                            const day = String(dateObj.getDate()).padStart(2, '0');
                            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                            const year = dateObj.getFullYear();
                            displayedVal = `${day}/${month}/${year}`;
                          }
                        }
                        return (
                          <div key={key} className="flex text-[11px] justify-between gap-2 truncate">
                            <span className="text-neutral-400 dark:text-neutral-500 font-medium">{key} :</span>
                            <span className="text-neutral-800 dark:text-neutral-300 font-bold truncate max-w-[120px]" title={displayedVal}>
                              {displayedVal}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Card footer action buttons */}
                <div className={`px-5 py-3 border-t flex gap-2.5 items-center justify-between ${
                  emp.status === 'A_VERIFIER' || (emp as any).photoConflict
                    ? 'border-rose-100/50 dark:border-neutral-800/60 bg-rose-50/20 dark:bg-neutral-900/30'
                    : emp.status === 'A_ENROLER'
                    ? 'border-amber-100/50 dark:border-neutral-800/60 bg-amber-50/30 dark:bg-neutral-900/30'
                    : emp.status === 'PHOTO_VALIDEE'
                    ? 'border-blue-100/50 dark:border-neutral-800/60 bg-blue-50/20 dark:bg-neutral-900/30'
                    : 'border-emerald-100/50 dark:border-neutral-800/60 bg-emerald-50/20 dark:bg-neutral-900/30'
                }`}>
                  <div className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono tracking-tight">
                    {emp.printedAt && `Imprimé le ${new Date(emp.printedAt).toLocaleDateString('fr-FR')}`}
                  </div>
                  
                  <div className="flex gap-2">
                     {/* Capture Webcam */}
                    {(emp.status === 'A_ENROLER' || emp.status === 'PHOTO_VALIDEE' || emp.status === 'A_VERIFIER') && (
                      <button
                        onClick={() => {
                          if (isOfflineMode) {
                            alert("La capture photo est indisponible en mode hors-ligne.");
                            return;
                          }
                          onTriggerWebcam(emp);
                        }}
                        disabled={isSelfUpdating || isOfflineMode}
                        className={`flex items-center gap-1.5 py-1.5 px-3 border rounded-xl text-xs font-semibold transition ${
                          isOfflineMode
                            ? 'bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-slate-500 border-neutral-200 dark:border-neutral-700 cursor-not-allowed opacity-50'
                            : (emp as any).photoConflict || emp.status === 'A_VERIFIER'
                            ? 'border-rose-200/70 dark:border-rose-800/30 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400'
                            : 'border-orange-200/70 dark:border-orange-800/30 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/40 text-orange-700 dark:text-orange-400'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{emp.photoUrl ? 'Reprendre' : 'Webcam'}</span>
                      </button>
                    )}

                    {/* Print Card */}
                    {(emp.status === 'PHOTO_VALIDEE' || emp.status === 'IMPRIME') && (
                      <button
                        onClick={() => handlePrintIndividual(emp.id)}
                        className="flex items-center gap-1.5 py-1.5 px-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-xl text-xs font-semibold transition shadow-sm"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimer</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>

          {/* PAGINATION */}
          {filteredEmployees.length > pageSize && (
            <div className="bg-white dark:bg-neutral-800 border border-blue-100/50 dark:border-neutral-800 rounded-2xl px-4 py-3 shadow-sm">
              <Pagination
                currentPage={currentPage}
                totalItems={filteredEmployees.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                pageSizeOptions={[12, 24, 48, 96]}
                itemLabel="employés"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
