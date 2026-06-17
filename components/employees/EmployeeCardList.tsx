'use client';

import React, { useState } from 'react';
import { Employee } from '@prisma/client';
import { Camera, Search, UserCheck, Check, Printer, AlertCircle, RefreshCw } from 'lucide-react';
import { updateEmployeeStatus } from '@/app/actions/employees';

interface EmployeeCardListProps {
  employees: Employee[];
  onTriggerWebcam: (employee: Employee) => void;
  onRefresh: () => void;
}

type FilterStatus = 'ALL' | 'A_ENROLER' | 'PHOTO_VALIDEE' | 'IMPRIME';

export default function EmployeeCardList({ employees, onTriggerWebcam, onRefresh }: EmployeeCardListProps) {
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Search filter implementation
  const matchesSearch = (emp: Employee) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    // Check uniqueIdentifier
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

  const handleUpdateStatus = async (id: string, nextStatus: string) => {
    setIsUpdating(id);
    try {
      await updateEmployeeStatus(id, nextStatus);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Impossible de mettre à jour le statut.');
    } finally {
      setIsUpdating(null);
    }
  };

  // Helper to extract main employee details from dynamicData
  const getEmployeeDetails = (emp: Employee) => {
    const data = emp.dynamicData as Record<string, any>;
    if (!data) return { name: 'Employé', fields: [] };

    // Try common keys to construct a name
    const firstName = data.Prenom || data.Prénom || data.firstname || '';
    const lastName = data.Nom || data.nom || data.lastname || '';
    const fullName = `${firstName} ${lastName}`.trim() || emp.uniqueIdentifier;

    // Filter out name keys to show other attributes
    const nameKeys = ['nom', 'prenom', 'prénom', 'firstname', 'lastname', 'name', 'fullname'];
    const fields = Object.entries(data)
      .filter(([key]) => !nameKeys.includes(key.toLowerCase()))
      .slice(0, 4); // Limit to 4 key info fields for aesthetics

    return { name: fullName, fields };
  };

  return (
    <div className="space-y-6">
      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-white dark:bg-neutral-850 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        {/* Status Filters */}
        <div className="flex flex-wrap gap-1.5 p-0.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-150 dark:border-neutral-800 rounded-xl w-full lg:w-auto">
          {(['ALL', 'A_ENROLER', 'PHOTO_VALIDEE', 'IMPRIME'] as FilterStatus[]).map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                filter === st
                  ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-neutral-150 dark:border-neutral-700/50'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              {st === 'ALL' && 'Tous'}
              {st === 'A_ENROLER' && 'À enrôler'}
              {st === 'PHOTO_VALIDEE' && 'Photo Validée'}
              {st === 'IMPRIME' && 'Imprimés'}
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

      {/* CARDS GRID */}
      {filteredEmployees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-center shadow-sm">
          <AlertCircle className="w-8 h-8 text-neutral-400 mb-2" />
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Aucun employé ne correspond aux critères.</p>
          <p className="text-xs text-neutral-450 dark:text-neutral-550 mt-0.5">Essayez de modifier vos filtres ou effectuez un import Excel.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredEmployees.map((emp) => {
            const { name, fields } = getEmployeeDetails(emp);
            const isSelfUpdating = isUpdating === emp.id;

            return (
              <div
                key={emp.id}
                className="group bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-between"
              >
                {/* Employee Info Header */}
                <div className="p-5 flex gap-4 items-start">
                  {/* Photo area */}
                  <div className="w-18 h-18 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shrink-0 overflow-hidden flex items-center justify-center shadow-inner relative group-hover:border-neutral-350 dark:group-hover:border-neutral-750 transition-colors">
                    {emp.photoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={emp.photoUrl} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-1 text-center text-[8px] font-bold text-neutral-400">
                        <Camera className="w-5 h-5 mb-0.5 opacity-60" />
                        <span>Pas de photo</span>
                      </div>
                    )}
                  </div>

                  {/* Text details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-neutral-400 dark:text-neutral-550 font-mono tracking-tight truncate">
                        ID: {emp.uniqueIdentifier}
                      </span>
                      {/* Status Tag */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          emp.status === 'A_ENROLER'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/50'
                            : emp.status === 'PHOTO_VALIDEE'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-200/50'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/50'
                        }`}
                      >
                        {emp.status === 'A_ENROLER' && 'À enrôler'}
                        {emp.status === 'PHOTO_VALIDEE' && 'Validé'}
                        {emp.status === 'IMPRIME' && 'Imprimé'}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-neutral-850 dark:text-white mt-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                      {name}
                    </h4>

                    {/* Meta dynamic list items */}
                    <div className="mt-3 space-y-1">
                      {fields.map(([key, val]) => (
                        <div key={key} className="flex text-[11px] justify-between gap-2 truncate">
                          <span className="text-neutral-450 dark:text-neutral-500 font-medium">{key} :</span>
                          <span className="text-neutral-800 dark:text-neutral-350 font-bold truncate max-w-[120px]" title={String(val)}>
                            {String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card footer action buttons */}
                <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex gap-2.5 items-center justify-between">
                  <div className="text-[10px] text-neutral-400 font-mono tracking-tight">
                    {emp.printedAt && `Imprimé le ${new Date(emp.printedAt).toLocaleDateString('fr-FR')}`}
                  </div>
                  
                  <div className="flex gap-2">
                    {/* Capture Webcam */}
                    {(emp.status === 'A_ENROLER' || emp.status === 'PHOTO_VALIDEE') && (
                      <button
                        onClick={() => onTriggerWebcam(emp)}
                        disabled={isSelfUpdating}
                        className="flex items-center gap-1.5 py-1.5 px-3 border border-neutral-250 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-semibold transition"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{emp.photoUrl ? 'Reprendre' : 'Webcam'}</span>
                      </button>
                    )}

                    {/* Validate Photo / Approve */}
                    {emp.status === 'PHOTO_VALIDEE' && (
                      <button
                        onClick={() => handleUpdateStatus(emp.id, 'IMPRIME')}
                        disabled={isSelfUpdating}
                        className="flex items-center gap-1.5 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-sm"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimer</span>
                      </button>
                    )}

                    {/* Reprint / Mark as printed */}
                    {emp.status === 'IMPRIME' && (
                      <button
                        onClick={() => handleUpdateStatus(emp.id, 'PHOTO_VALIDEE')}
                        disabled={isSelfUpdating}
                        className="flex items-center gap-1.5 py-1.5 px-3 border border-neutral-250 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-850 text-neutral-600 dark:text-neutral-400 rounded-xl text-xs font-semibold transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Ré-imprimer</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
