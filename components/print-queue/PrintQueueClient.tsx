'use client';

import React, { useState } from 'react';
import { Company } from '@prisma/client';
import { Printer, CheckSquare, Square, Loader2, Image as ImageIcon, Users } from 'lucide-react';
import { markAsPrinted } from '@/app/actions/batches';

interface PrintQueueClientProps {
  initialCompanies: any[];
  initialQueue: any[];
  dbError?: boolean;
}

export default function PrintQueueClient({ initialCompanies, initialQueue, dbError }: PrintQueueClientProps) {
  const [companies] = useState<any[]>(initialCompanies);
  const [queue, setQueue] = useState<any[]>(initialQueue);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter queue by company if selected
  const filteredQueue = selectedCompanyId 
    ? queue.filter(emp => emp.companyId === selectedCompanyId)
    : queue;

  const toggleSelection = (id: string) => {
    setSelectedEmployeeIds(prev => 
      prev.includes(id) ? prev.filter(eId => eId !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedEmployeeIds.length === filteredQueue.length && filteredQueue.length > 0) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredQueue.map(emp => emp.id));
    }
  };

  const handleMarkPrinted = async () => {
    if (!selectedEmployeeIds.length) return;
    
    const confirmMsg = `Êtes-vous sûr de vouloir marquer ces ${selectedEmployeeIds.length} badges comme imprimés ? Ils seront retirés de cette file d'impression.`;
    if (!confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      await markAsPrinted(selectedEmployeeIds);
      // Remove them from local queue
      setQueue(prev => prev.filter(emp => !selectedEmployeeIds.includes(emp.id)));
      setSelectedEmployeeIds([]);
      alert('Cartes marquées comme imprimées avec succès.');
    } catch (error: any) {
      alert(error.message || "Erreur lors du marquage des impressions.");
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-neutral-850 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-neutral-900 text-indigo-500 rounded-xl border border-indigo-100 dark:border-neutral-800 shadow-sm">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-890 dark:text-white">File d'impression</h1>
            <p className="text-xs text-neutral-450 dark:text-neutral-500">
              {queue.length} badge(s) prêt(s) à être imprimé(s)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedCompanyId}
            onChange={(e) => {
              setSelectedCompanyId(e.target.value);
              setSelectedEmployeeIds([]); // reset selection when filtering
            }}
            className="px-4 py-2 border border-neutral-200 dark:border-neutral-750 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 text-neutral-800 dark:text-neutral-200 w-full md:w-auto"
          >
            <option value="">Toutes les entreprises</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedEmployeeIds.length === 0) return;
                window.open(`/dashboard/employees/print?ids=${selectedEmployeeIds.join(',')}`, '_blank');
              }}
              disabled={selectedEmployeeIds.length === 0 || isSubmitting}
              className="flex items-center gap-2 px-4 py-2 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold rounded-xl transition shadow-sm whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>Générer PDF d'impression</span>
            </button>
            <button
              onClick={handleMarkPrinted}
              disabled={selectedEmployeeIds.length === 0 || isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition shadow-sm whitespace-nowrap"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
              <span>Marquer imprimé(s) ({selectedEmployeeIds.length})</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
        {filteredQueue.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <Printer className="w-10 h-10 text-neutral-300 mb-3" />
            <h3 className="text-neutral-700 dark:text-neutral-300 font-semibold">File d'impression vide</h3>
            <p className="text-neutral-500 text-sm mt-1">Aucun badge en attente d'impression pour cette sélection.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500">
                  <th className="p-4 w-10">
                    <button onClick={toggleAll} className="text-neutral-400 hover:text-indigo-500 transition">
                      {selectedEmployeeIds.length === filteredQueue.length ? (
                        <CheckSquare className="w-5 h-5 text-indigo-500" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </th>
                  <th className="p-4 font-semibold">Photo</th>
                  <th className="p-4 font-semibold">Nom / Identifiant</th>
                  <th className="p-4 font-semibold">Entreprise</th>
                  <th className="p-4 font-semibold">Date d'ajout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredQueue.map(emp => (
                  <tr 
                    key={emp.id} 
                    className={`transition-colors hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 cursor-pointer ${
                      selectedEmployeeIds.includes(emp.id) ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''
                    }`}
                    onClick={() => toggleSelection(emp.id)}
                  >
                    <td className="p-4">
                      {selectedEmployeeIds.includes(emp.id) ? (
                        <CheckSquare className="w-5 h-5 text-indigo-500" />
                      ) : (
                        <Square className="w-5 h-5 text-neutral-300" />
                      )}
                    </td>
                    <td className="p-4">
                      {emp.photoUrl ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700">
                          <img src={emp.photoUrl} alt="Photo" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {emp.dynamicData?.Nom || 'Inconnu'} {emp.dynamicData?.Prenom || ''}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">ID: {emp.uniqueIdentifier}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                        <Users className="w-4 h-4" />
                        <span>{emp.company?.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-neutral-500 text-sm">
                      {new Date(emp.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
