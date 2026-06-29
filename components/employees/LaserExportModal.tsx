'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Employee } from '@prisma/client';
import { X, Search, CheckSquare, Square, Download, Loader2, AlertCircle, Users, Columns } from 'lucide-react';

interface LaserExportModalProps {
  companyId: string;
  companyName: string;
  employees: Employee[];
  onClose: () => void;
}

export default function LaserExportModal({ companyId, companyName, employees, onClose }: LaserExportModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number; text: string } | null>(null);

  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedDocTypeSlug, setSelectedDocTypeSlug] = useState<string>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');

  useEffect(() => {
    async function loadData() {
      try {
        const { getCardCategories, getCardDocumentTypes } = await import('@/app/actions/cards');
        const [dTypes, cats] = await Promise.all([
          getCardDocumentTypes(companyId),
          getCardCategories(companyId)
        ]);
        setDocTypes(dTypes);
        setCategories(cats);
      } catch (err) {
        console.error("Failed to load docTypes / categories in LaserExportModal:", err);
      }
    }
    loadData();
  }, [companyId]);

  // 1. Compute all unique fields available across employees
  const allAvailableFields = useMemo(() => {
    const fields = new Set<string>();
    // Standard system fields
    fields.add("Numéro d'enrôlement");
    fields.add("Identifiant unique");
    fields.add("Statut");

    if (selectedDocTypeSlug !== 'ALL') {
      fields.add("Type de carte");
    }
    if (selectedCategoryId !== 'ALL') {
      fields.add("Catégorie");
      const cat = categories.find((c) => c.id === selectedCategoryId);
      if (cat && cat.validityUnit && cat.validityUnit !== 'NONE') {
        fields.add("Durée de validité");
        fields.add("Date d'expiration");
      }
    }

    // Scan dynamic fields
    employees.forEach((emp) => {
      const data = emp.dynamicData as Record<string, any>;
      if (data && typeof data === 'object') {
        Object.keys(data).forEach((k) => {
          if (k && k.trim()) fields.add(k.trim());
        });
      }
    });

    // Link file column
    fields.add("Fichier Photo");
    return Array.from(fields);
  }, [employees, selectedDocTypeSlug, selectedCategoryId, categories]);

  // 2. Selection states
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(() => {
    return new Set(employees.map((e) => e.id));
  });

  const [selectedFields, setSelectedFields] = useState<Set<string>>(() => {
    return new Set(allAvailableFields);
  });

  // Automatically select new dynamic fields when export options change
  useEffect(() => {
    const fieldsToAdd: string[] = [];
    if (selectedDocTypeSlug !== 'ALL') {
      fieldsToAdd.push("Type de carte");
    }
    if (selectedCategoryId !== 'ALL') {
      fieldsToAdd.push("Catégorie");
      const cat = categories.find((c) => c.id === selectedCategoryId);
      if (cat && cat.validityUnit && cat.validityUnit !== 'NONE') {
        fieldsToAdd.push("Durée de validité");
        fieldsToAdd.push("Date d'expiration");
      }
    }
    
    if (fieldsToAdd.length > 0) {
      setSelectedFields((prev) => {
        const next = new Set(prev);
        fieldsToAdd.forEach((f) => next.add(f));
        return next;
      });
    }
  }, [selectedDocTypeSlug, selectedCategoryId, categories]);

  // 3. Filtering logic
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (selectedStatus !== 'ALL' && emp.status !== selectedStatus) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        const data = emp.dynamicData as Record<string, any>;
        const nom = String(data?.NOM || data?.nom || '').toLowerCase();
        const prenom = String(data?.PRENOMS || data?.prenoms || '').toLowerCase();
        const matricule = String(data?.MATRICULE || data?.matricule || emp.enrollmentNumber || '').toLowerCase();
        
        return nom.includes(query) || prenom.includes(query) || matricule.includes(query);
      }
      return true;
    });
  }, [employees, selectedStatus, searchQuery]);

  // 4. Helper utilities
  const toggleEmployee = (id: string) => {
    const next = new Set(selectedEmployeeIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedEmployeeIds(next);
  };

  const selectAllDisplayed = () => {
    const next = new Set(selectedEmployeeIds);
    filteredEmployees.forEach((emp) => next.add(emp.id));
    setSelectedEmployeeIds(next);
  };

  const deselectAllDisplayed = () => {
    const next = new Set(selectedEmployeeIds);
    filteredEmployees.forEach((emp) => next.delete(emp.id));
    setSelectedEmployeeIds(next);
  };

  const toggleField = (field: string) => {
    const next = new Set(selectedFields);
    if (next.has(field)) {
      next.delete(field);
    } else {
      next.add(field);
    }
    setSelectedFields(next);
  };

  const selectAllFields = () => {
    setSelectedFields(new Set(allAvailableFields));
  };

  const deselectAllFields = () => {
    setSelectedFields(new Set());
  };

  const handleExport = async () => {
    const employeesToExport = filteredEmployees.filter((emp) => selectedEmployeeIds.has(emp.id));
    if (employeesToExport.length === 0) {
      alert("Veuillez sélectionner au moins un employé à exporter.");
      return;
    }
    if (selectedFields.size === 0) {
      alert("Veuillez sélectionner au moins une colonne pour le fichier Excel.");
      return;
    }

    setIsExporting(true);
    setProgress({ current: 0, total: employeesToExport.length, text: "Récupération des photos..." });

    try {
      const { getEmployeesPhotos } = await import('@/app/actions/employees');
      const photoMap = await getEmployeesPhotos(employeesToExport.map(e => e.id));

      const employeesWithPhotos = employeesToExport.map(emp => ({
        ...emp,
        photoUrl: photoMap[emp.id] || null,
      }));

      const { exportLaserBioQR } = await import('@/lib/laserExport');
      const docTypeObj = selectedDocTypeSlug !== 'ALL' ? docTypes.find(dt => dt.slug === selectedDocTypeSlug) : null;
      const categoryObj = selectedCategoryId !== 'ALL' ? categories.find(c => c.id === selectedCategoryId) : null;

      await exportLaserBioQR(
        companyName,
        employeesWithPhotos,
        Array.from(selectedFields),
        (current, total, text) => {
          setProgress({ current, total, text });
        },
        docTypeObj,
        categoryObj
      );
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Erreur lors de la génération de l'export.");
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 dark:bg-neutral-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-800 dark:text-white">Exportation Laser BioQR - {companyName}</h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">Sélectionnez les lignes d&apos;employés et les colonnes du fichier Excel</p>
          </div>
          <button 
            onClick={onClose}
            disabled={isExporting}
            className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-neutral-100 dark:divide-neutral-800">
          
          {/* LEFT SECTION: EMPLOYEES CHECKLIST (60% width) */}
          <div className="md:col-span-3 flex flex-col overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>1. Sélectionner les Employés</span>
              </span>
              <span className="text-xs text-neutral-400 dark:text-neutral-500 font-bold">
                {filteredEmployees.filter(e => selectedEmployeeIds.has(e.id)).length} sélectionné(s)
              </span>
            </div>

            {/* FILTERS CONTAINER */}
            <div className="flex gap-2">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                disabled={isExporting}
                className="px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold focus:outline-none"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="A_ENROLER">À enrôler</option>
                <option value="PHOTO_VALIDEE">Photo Validée</option>
                <option value="IMPRIME">Imprimé</option>
                <option value="A_VERIFIER">À vérifier</option>
              </select>

              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="Rechercher nom, prénom, matricule..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isExporting}
                  className="w-full pl-8 pr-4 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs outline-none transition focus:ring-1 focus:ring-indigo-500/25"
                />
              </div>
            </div>

            {/* ACTIONS BAR FOR SELECTION */}
            <div className="flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-900/30 p-2 rounded-xl border border-neutral-100 dark:border-neutral-800/60 text-xs">
              <span className="text-[11px] font-medium text-neutral-500">
                {filteredEmployees.length} affiché(s)
              </span>
              <div className="flex gap-3">
                <button
                  onClick={selectAllDisplayed}
                  disabled={isExporting}
                  className="text-indigo-600 hover:underline font-semibold disabled:opacity-50"
                >
                  Sélectionner tout
                </button>
                <button
                  onClick={deselectAllDisplayed}
                  disabled={isExporting}
                  className="text-neutral-500 hover:underline font-semibold disabled:opacity-50"
                >
                  Tout désélectionner
                </button>
              </div>
            </div>

            {/* EMPLOYEES SCROLLABLE VIEW */}
            <div className="flex-1 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-2xl divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredEmployees.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-400 dark:text-neutral-500">
                  Aucun employé ne correspond à vos filtres.
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const data = emp.dynamicData as Record<string, any>;
                  const name = `${data?.NOM || data?.nom || ''} ${data?.PRENOMS || data?.prenoms || ''}`.trim() || emp.uniqueIdentifier;
                  const matricule = data?.MATRICULE || data?.matricule || emp.enrollmentNumber || emp.uniqueIdentifier;
                  const isChecked = selectedEmployeeIds.has(emp.id);

                  return (
                    <div 
                      key={emp.id}
                      onClick={() => !isExporting && toggleEmployee(emp.id)}
                      className={`px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition cursor-pointer select-none ${
                        isChecked ? 'bg-indigo-50/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-neutral-400 dark:text-neutral-500">
                          {isChecked ? (
                            <CheckSquare className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square className="w-4.5 h-4.5" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{name}</span>
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono mt-0.5">Matricule: {matricule}</span>
                        </div>
                      </div>

                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        emp.status === 'PHOTO_VALIDEE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900' :
                        emp.status === 'IMPRIME' ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900' :
                        emp.status === 'A_VERIFIER' ? 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900' :
                        'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900'
                      }`}>
                        {emp.status === 'A_ENROLER' ? 'À ENRÔLER' :
                         emp.status === 'PHOTO_VALIDEE' ? 'VALIDÉ' :
                         emp.status === 'IMPRIME' ? 'IMPRIMÉ' : 'À VÉRIFIER'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT SECTION: COLUMNS / FIELDS CHECKLIST (40% width) */}
          <div className="md:col-span-2 flex flex-col overflow-hidden p-6 space-y-4 bg-neutral-50/20 dark:bg-neutral-900/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                <Columns className="w-4 h-4" />
                <span>2. Paramètres & Colonnes</span>
              </span>
              <span className="text-xs text-neutral-400 dark:text-neutral-500 font-bold">
                {selectedFields.size} sélectionnée(s)
              </span>
            </div>

            {/* EXPORT OPTIONS */}
            <div className="bg-white dark:bg-neutral-900 p-4.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3 shadow-sm">
              <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">
                Options d&apos;exportation (Optionnel)
              </span>
              
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Type de carte</label>
                  <select
                    value={selectedDocTypeSlug}
                    onChange={(e) => {
                      setSelectedDocTypeSlug(e.target.value);
                      setSelectedCategoryId('ALL'); // Reset category
                    }}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold focus:outline-none"
                  >
                    <option value="ALL">Aucun type sélectionné</option>
                    {docTypes.map((dt) => (
                      <option key={dt.id} value={dt.slug}>{dt.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Catégorie</label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    disabled={selectedDocTypeSlug === 'ALL'}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="ALL">Aucune catégorie</option>
                    {categories
                      .filter((c) => !c.documentTypeSlug || c.documentTypeSlug === selectedDocTypeSlug)
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SELECTION SHORTCUTS */}
            <div className="flex justify-between items-center text-xs pb-1">
              <span className="text-[10px] text-neutral-400 italic">Cochez les colonnes à exporter</span>
              <div className="flex gap-2.5">
                <button
                  onClick={selectAllFields}
                  disabled={isExporting}
                  className="text-indigo-600 hover:underline font-semibold disabled:opacity-50"
                >
                  Toutes
                </button>
                <button
                  onClick={deselectAllFields}
                  disabled={isExporting}
                  className="text-neutral-500 hover:underline font-semibold disabled:opacity-50"
                >
                  Aucune
                </button>
              </div>
            </div>

            {/* SCROLLABLE LIST OF FIELDS */}
            <div className="flex-1 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900 divide-y divide-neutral-100 dark:divide-neutral-800 p-2">
              {allAvailableFields.map((field) => {
                const isSelected = selectedFields.has(field);
                const isSystemField = ["Numéro d'enrôlement", "Identifiant unique", "Statut", "Fichier Photo"].includes(field);

                return (
                  <div
                    key={field}
                    onClick={() => !isExporting && toggleField(field)}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-lg transition cursor-pointer select-none"
                  >
                    <div className="text-neutral-400 dark:text-neutral-500">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{field}</span>
                      {isSystemField && (
                        <span className="text-[8px] font-bold text-neutral-400 uppercase bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">Système</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-bold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-500 transition disabled:opacity-40"
          >
            Annuler
          </button>
          
          <button
            onClick={handleExport}
            disabled={isExporting || filteredEmployees.filter(e => selectedEmployeeIds.has(e.id)).length === 0}
            className="flex items-center gap-1.5 py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-800 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Générer l&apos;export ({filteredEmployees.filter(e => selectedEmployeeIds.has(e.id)).length} employés)</span>
          </button>
        </div>

        {/* EXPORTING LOADING INDICATOR STATE (MODAL OVERLAY) */}
        {isExporting && progress && (
          <div className="absolute inset-0 bg-neutral-900/40 dark:bg-neutral-950/60 backdrop-blur-[2px] flex items-center justify-center p-4 z-40">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 w-full max-w-sm text-center space-y-4 animate-in zoom-in-95 duration-200">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
              <div>
                <h3 className="font-bold text-neutral-900 dark:text-white text-sm">Génération de l&apos;export Laser</h3>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{progress.text}</p>
              </div>
              {progress.total > 0 && (
                <div className="space-y-1.5">
                  <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full transition-all duration-300"
                      style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold">
                    {progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
