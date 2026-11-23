'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, ListX, Loader2, Lock, Search, Trash2, X } from 'lucide-react';
import { getCompanyFieldUsage, removeCompanyField, type CompanyFieldUsage } from '@/app/actions/templates';
import { useToast } from '@/components/ui/Toast';

interface ManageFieldsModalProps {
  company: { id: string; name: string; isLocked: boolean };
  onClose: () => void;
}

export default function ManageFieldsModal({ company, onClose }: ManageFieldsModalProps) {
  const { toast } = useToast();
  const [fields, setFields] = useState<CompanyFieldUsage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [pendingField, setPendingField] = useState<CompanyFieldUsage | null>(null);
  const [isRemoving, setIsRemoving] = useState<boolean>(false);
  const [confirmNameInput, setConfirmNameInput] = useState<string>('');

  const openConfirm = (field: CompanyFieldUsage | null) => {
    setConfirmNameInput('');
    setPendingField(field);
  };

  const loadFields = () =>
    getCompanyFieldUsage(company.id)
      .then((result) => {
        setFields(result);
        setLoadError(null);
      })
      .catch((e: any) => setLoadError(e?.message || 'Impossible de charger les champs'));

  useEffect(() => {
    loadFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  const handleRemove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingField || confirmNameInput.trim() !== pendingField.key) return;
    setIsRemoving(true);
    try {
      const res = await removeCompanyField(company.id, pendingField.key);
      toast({
        title: 'Champ supprimé',
        message: res.skippedLocked > 0
          ? `« ${pendingField.key} » retiré de ${res.updated} employé(s). ${res.skippedLocked} fiche(s) verrouillée(s) (badge imprimé) conservée(s).`
          : `« ${pendingField.key} » retiré de ${res.updated} employé(s).`,
        variant: res.skippedLocked > 0 ? 'warning' : 'success',
      });
      openConfirm(null);
      await loadFields();
    } catch (e: any) {
      toast({ title: 'Suppression impossible', message: e?.message || 'Erreur inconnue', variant: 'error' });
    } finally {
      setIsRemoving(false);
    }
  };

  const visibleFields = (fields || []).filter((f) => f.key.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-250">
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 w-full max-w-lg max-h-[85vh] flex flex-col p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
            <ListX className="w-5 h-5 shrink-0" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Champs importés</h3>
            <p className="text-xs text-slate-400 truncate">{company.name}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isRemoving}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {company.isLocked && (
          <div className="flex gap-2 p-3 bg-amber-50/60 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-xl text-[11px] text-amber-700 dark:text-amber-400 font-semibold mb-3">
            <Lock className="w-4 h-4 shrink-0" />
            <span>Entreprise verrouillée : déverrouillez-la pour supprimer des champs.</span>
          </div>
        )}

        {pendingField ? (
          <form onSubmit={handleRemove} className="space-y-4">
            <div className="flex gap-2 p-3.5 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100/60 dark:border-rose-900/30 rounded-xl text-[11px] text-rose-700 dark:text-rose-400 font-semibold leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <div>
                Supprimer définitivement le champ <strong>« {pendingField.key} »</strong> ?
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  <li>Sa valeur sera effacée de <strong>{pendingField.employeeCount - pendingField.lockedCount} employé(s)</strong>.</li>
                  {pendingField.lockedCount > 0 && (
                    <li>{pendingField.lockedCount} fiche(s) verrouillée(s) (badge imprimé) ne seront pas modifiées.</li>
                  )}
                  {pendingField.templates.length > 0 && (
                    <li>Utilisé dans les modèles : <strong>{pendingField.templates.join(', ')}</strong>. Ces zones s&apos;imprimeront vides.</li>
                  )}
                </ul>
                Cette action est irréversible : faites une sauvegarde (Paramètres) avant si nécessaire.
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-2">
                Saisissez le nom du champ pour confirmer
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder={pendingField.key}
                value={confirmNameInput}
                onChange={(e) => setConfirmNameInput(e.target.value)}
                disabled={isRemoving}
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-bold"
              />
            </div>
            <div className="flex gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => openConfirm(null)}
                disabled={isRemoving}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isRemoving || confirmNameInput.trim() !== pendingField.key}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Supprimer le champ</span>
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="relative mb-3">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="Rechercher un champ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5">
              {loadError ? (
                <p className="text-xs text-rose-500 font-semibold text-center py-8">{loadError}</p>
              ) : fields === null ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                </div>
              ) : visibleFields.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  {fields.length === 0 ? 'Aucun champ importé pour cette entreprise.' : 'Aucun champ ne correspond.'}
                </p>
              ) : (
                visibleFields.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={field.key}>{field.key}</p>
                      <p className="text-[10px] text-slate-400">
                        {field.employeeCount} employé(s)
                        {field.templates.length > 0 && (
                          <span className="text-amber-600 dark:text-amber-400"> · utilisé dans {field.templates.join(', ')}</span>
                        )}
                      </p>
                    </div>
                    {field.protectedReason ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 shrink-0" title={field.protectedReason}>
                        <Lock className="w-3 h-3" />
                        Protégé
                      </span>
                    ) : (
                      <button
                        onClick={() => openConfirm(field)}
                        disabled={company.isLocked}
                        className="p-1.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:text-slate-300 dark:disabled:text-slate-700 disabled:hover:bg-transparent disabled:cursor-not-allowed transition shrink-0"
                        title={company.isLocked ? 'Entreprise verrouillée' : 'Supprimer ce champ'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
