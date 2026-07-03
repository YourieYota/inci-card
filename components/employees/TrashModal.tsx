'use client';

import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, X, Loader2, Search, AlertTriangle } from 'lucide-react';
import { restoreEmployees } from '@/app/actions/employees';
import { safeSetItem, safeGetItem, cleanEmployeesForCache } from '@/lib/storage';

interface TrashModalProps {
  companyId: string;
  companyName: string;
  onClose: () => void;
  onRefresh: () => void;
  isOfflineMode?: boolean;
}

export default function TrashModal({
  companyId,
  companyName,
  onClose,
  onRefresh,
  isOfflineMode = false,
}: TrashModalProps) {
  const [trashList, setTrashList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load deleted employees from local storage
  const loadTrash = () => {
    try {
      const trashRaw = localStorage.getItem(`inci-trash:${companyId}`);
      if (trashRaw) {
        setTrashList(JSON.parse(trashRaw));
      } else {
        setTrashList([]);
      }
    } catch (e) {
      console.warn("Failed to load trash list:", e);
      setTrashList([]);
    }
  };

  useEffect(() => {
    loadTrash();
  }, [companyId]);

  // Format date helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} à ${hours}:${minutes}`;
  };

  // Helper to resolve employee name from dynamicData
  const getEmployeeName = (emp: any) => {
    if (emp.dynamicData && typeof emp.dynamicData === 'object') {
      const data = emp.dynamicData as Record<string, any>;
      const firstName = data.Prenom || data.prenom || '';
      const lastName = data.Nom || data.nom || '';
      return `${firstName} ${lastName}`.trim();
    }
    return '';
  };

  // Filter list based on search query
  const filteredTrash = trashList.filter((emp) => {
    const name = getEmployeeName(emp).toLowerCase();
    const ident = (emp.uniqueIdentifier || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || ident.includes(query);
  });

  const handleRestore = async (itemsToRestore: any[]) => {
    if (itemsToRestore.length === 0) return;
    setIsRestoring(true);
    setError(null);

    try {
      if (isOfflineMode) {
        // Offline Restoration
        const { addOfflineMutation } = await import('@/lib/offlineQueue');
        
        // 1. Queue offline restore mutation
        addOfflineMutation(
          'RESTORE_EMPLOYEES',
          { employees: itemsToRestore },
          `Restaurer ${itemsToRestore.length} employé(s) (Hors-ligne)`
        );

        // 2. Add back to cached list in localStorage
        const cachedRaw = safeGetItem(`inci-cache:employees:${companyId}`);
        let cachedList = cachedRaw ? JSON.parse(cachedRaw) : [];
        
        // Remove 'deletedAt' field and merge back
        const cleanedItems = itemsToRestore.map(({ deletedAt, ...rest }) => rest);
        cachedList = [...cleanedItems, ...cachedList];
        safeSetItem(`inci-cache:employees:${companyId}`, JSON.stringify(cleanEmployeesForCache(cachedList)));

        // 3. Remove from trash
        const restoreIds = itemsToRestore.map(item => item.id);
        const updatedTrash = trashList.filter(item => !restoreIds.includes(item.id));
        localStorage.setItem(`inci-trash:${companyId}`, JSON.stringify(updatedTrash));
        
        alert(`${itemsToRestore.length} employé(s) restauré(s) localement ! Ils seront synchronisés au retour en ligne.`);
        setTrashList(updatedTrash);
        onRefresh();
        if (updatedTrash.length === 0) {
          onClose();
        }
        return;
      }

      // Online Restoration
      const res = await restoreEmployees(itemsToRestore);
      if (res.success) {
        // Remove restored items from localStorage
        const restoreIds = itemsToRestore.map(item => item.id);
        const updatedTrash = trashList.filter(item => !restoreIds.includes(item.id));
        localStorage.setItem(`inci-trash:${companyId}`, JSON.stringify(updatedTrash));
        
        setTrashList(updatedTrash);
        onRefresh();
        if (updatedTrash.length === 0) {
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la restauration.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleClearTrash = () => {
    const confirmClear = window.confirm(
      "Êtes-vous sûr de vouloir vider définitivement la corbeille ? Cette action supprimera définitivement ces données de restauration."
    );
    if (!confirmClear) return;

    localStorage.removeItem(`inci-trash:${companyId}`);
    setTrashList([]);
    onRefresh();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-205">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-205 dark:border-neutral-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-205">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 px-6 py-4.5 bg-neutral-50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-500 rounded-xl">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">Corbeille de Restauration</h2>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                {companyName} — {trashList.length} employé(s) restaurable(s)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Warning */}
        {trashList.length > 0 && (
          <div className="p-4 bg-neutral-50/50 dark:bg-neutral-900/20 border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Rechercher par nom ou matricule..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9.5 pr-4 py-2 border border-neutral-250 dark:border-neutral-800 bg-white dark:bg-neutral-950 rounded-xl text-xs focus:ring-2 focus:ring-rose-500/20 focus:outline-none dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRestore(trashList)}
                disabled={isRestoring}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>Restaurer tout ({trashList.length})</span>
              </button>
              <button
                onClick={handleClearTrash}
                disabled={isRestoring}
                className="flex items-center gap-1.5 px-4 py-2 border border-rose-200 text-rose-600 dark:border-rose-900/50 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vider la corbeille</span>
              </button>
            </div>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-400 rounded-xl text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {trashList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 rounded-2xl flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-neutral-850 dark:text-white mb-1">La corbeille est vide</h3>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-xs">
                Aucun membre n&apos;a été supprimé récemment pour cette entreprise.
              </p>
            </div>
          ) : filteredTrash.length === 0 ? (
            <div className="text-center py-12 text-xs text-neutral-400 dark:text-neutral-500">
              Aucun résultat ne correspond à votre recherche.
            </div>
          ) : (
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-neutral-50 dark:bg-neutral-950">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-900 text-neutral-500 font-bold border-b border-neutral-200 dark:border-neutral-800">
                  <tr>
                    <th className="p-3.5">Matricule / Clé</th>
                    <th className="p-3.5">Nom Complet</th>
                    <th className="p-3.5">Dernier Statut</th>
                    <th className="p-3.5">Date suppression</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850 text-neutral-700 dark:text-neutral-300">
                  {filteredTrash.map((emp) => {
                    const empName = getEmployeeName(emp);
                    return (
                      <tr key={emp.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20">
                        <td className="p-3.5 font-bold font-mono text-neutral-800 dark:text-neutral-200">
                          {emp.uniqueIdentifier}
                        </td>
                        <td className="p-3.5 font-semibold">
                          {empName || <span className="text-neutral-400 italic">Non renseigné</span>}
                        </td>
                        <td className="p-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            emp.status === 'IMPRIME' 
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                              : emp.status === 'PHOTO_VALIDEE'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400'
                              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                          }`}>
                            {emp.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-neutral-400 dark:text-neutral-500 font-medium">
                          {formatDate(emp.deletedAt)}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => handleRestore([emp])}
                            disabled={isRestoring}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-neutral-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 text-neutral-700 dark:text-neutral-200 rounded-lg text-[10px] font-bold transition disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restaurer</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-100 dark:border-neutral-800 px-6 py-4 flex items-center justify-end bg-neutral-50 dark:bg-neutral-900/50">
          <button
            onClick={onClose}
            className="px-4.5 py-2 border border-neutral-250 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-xl text-xs font-bold transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
