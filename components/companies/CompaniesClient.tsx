'use client';

import React, { useState, useEffect } from 'react';
import { Company } from '@prisma/client';
import { Building2, Plus, Search, Users, Layout, Calendar, ArrowUpRight, Loader2, CheckCircle, Edit2, Lock, Unlock, Trash2, AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import { createCompany, updateCompany, deleteCompany, toggleCompanyLock } from '@/app/actions/templates';

interface CompanyWithCounts extends Company {
  _count: {
    employees: number;
    templates: number;
  };
}

interface CompaniesClientProps {
  initialCompanies: CompanyWithCounts[];
  dbError?: boolean;
}

export default function CompaniesClient({ initialCompanies, dbError }: CompaniesClientProps) {
  const [companies, setCompanies] = useState<CompanyWithCounts[]>(initialCompanies);
  const [search, setSearch] = useState<string>('');
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setCompanies(initialCompanies);
  }, [initialCompanies]);
  
  // UI States
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newCompanyName, setNewCompanyName] = useState<string>( '');
  const [newCompanyPrefix, setNewCompanyPrefix] = useState<string>('');
  const [newCompanyLaser, setNewCompanyLaser] = useState<boolean>(false);
  const [newCompanyProtect, setNewCompanyProtect] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit State
  const [editingCompany, setEditingCompany] = useState<CompanyWithCounts | null>(null);
  const [editCompanyName, setEditCompanyName] = useState<string>('');
  const [editCompanyPrefix, setEditCompanyPrefix] = useState<string>('');
  const [editCompanyLaser, setEditCompanyLaser] = useState<boolean>(false);
  const [editCompanyProtect, setEditCompanyProtect] = useState<boolean>(true);

  // Delete State
  const [deletingCompany, setDeletingCompany] = useState<CompanyWithCounts | null>(null);
  const [confirmNameInput, setConfirmNameInput] = useState<string>('');

  const handleToggleLock = async (company: CompanyWithCounts) => {
    setIsSubmitting(true);
    try {
      const nextLocked = !company.isLocked;
      await toggleCompanyLock(company.id, nextLocked);
      
      const updatedCompanies = companies.map((c) => {
        if (c.id === company.id) {
          return {
            ...c,
            isLocked: nextLocked,
          };
        }
        return c;
      });
      setCompanies(updatedCompanies);
      setSuccessMessage(
        nextLocked 
          ? `L'entreprise "${company.name}" a été verrouillée.` 
          : `L'entreprise "${company.name}" a été déverrouillée.`
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || "Impossible de modifier le verrouillage de l'entreprise.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (company: CompanyWithCounts) => {
    if (company.isLocked) {
      alert("Cette entreprise est verrouillée. Veuillez d'abord la déverrouiller pour pouvoir la supprimer.");
      return;
    }
    setDeletingCompany(company);
    setConfirmNameInput('');
  };

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingCompany) return;
    if (confirmNameInput.trim() !== deletingCompany.name) {
      alert("Le nom saisi ne correspond pas. Veuillez saisir exactement le nom de l'entreprise pour confirmer la suppression.");
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteCompany(deletingCompany.id);
      
      const updatedCompanies = companies.filter((c) => c.id !== deletingCompany.id);
      setCompanies(updatedCompanies);
      setSuccessMessage(`L'entreprise "${deletingCompany.name}" et toutes ses données ont été supprimées.`);
      setDeletingCompany(null);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || "Impossible de supprimer l'entreprise.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Search Filter
  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Create Company Action
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    setIsSubmitting(true);
    try {
      const newCompany = await createCompany(
        newCompanyName.trim(),
        newCompanyPrefix.trim() || null,
        newCompanyLaser,
        newCompanyProtect
      );
      
      const newCompanyWithCounts: CompanyWithCounts = {
        ...newCompany,
        _count: {
          employees: 0,
          templates: 0,
        },
      };

      const updatedCompanies = [newCompanyWithCounts, ...companies].sort((a, b) => a.name.localeCompare(b.name));
      setCompanies(updatedCompanies);
      
      setSuccessMessage(`L'entreprise "${newCompany.name}" a été créée.`);
      setNewCompanyName('');
      setNewCompanyPrefix('');
      setNewCompanyLaser(false);
      setNewCompanyProtect(true);
      setShowCreateModal(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || "Impossible de créer l'entreprise.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Company Action
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany || !editCompanyName.trim()) return;

    setIsSubmitting(true);
    try {
      const updated = await updateCompany(
        editingCompany.id,
        editCompanyName.trim(),
        editCompanyPrefix.trim() || null,
        editCompanyLaser,
        editCompanyProtect
      );

      const updatedCompanies = companies.map((c) => {
        if (c.id === editingCompany.id) {
          return {
            ...c,
            name: updated.name,
            identifierPrefix: updated.identifierPrefix,
            isLaserEnabled: updated.isLaserEnabled,
            protectAppModified: updated.protectAppModified,
          };
        }
        return c;
      }).sort((a, b) => a.name.localeCompare(b.name));

      setCompanies(updatedCompanies);
      setSuccessMessage(`L'entreprise "${updated.name}" a été modifiée.`);
      setEditingCompany(null);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || "Impossible de modifier l'entreprise.");
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all duration-300">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Entreprises clientes</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Gérez la liste de vos clients partenaires et accédez à leurs badges ou listes d&apos;employés.
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Entreprise</span>
        </button>
      </div>



      {/* SUCCESS MESSAGE */}
      {successMessage && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400 rounded-xl text-sm font-medium animate-in fade-in duration-300">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* FILTER BAR */}
      <div className="flex bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Rechercher une entreprise..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/25"
          />
        </div>
      </div>

      {/* COMPANIES LISTING */}
      {filteredCompanies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-center shadow-sm">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">Aucune entreprise trouvée</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
            {search ? "Modifiez votre recherche pour trouver d'autres résultats." : "Ajoutez votre première entreprise cliente pour commencer."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompanies.map((company) => (
            <div
              key={company.id}
              className="group bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 opacity-70" />
                      <span>{new Date(company.createdAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleToggleLock(company)}
                        className={`p-1.5 rounded-lg transition ${
                          company.isLocked
                            ? "text-amber-600 hover:text-amber-700 bg-amber-50 dark:bg-amber-950/30"
                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                        title={company.isLocked ? "Déverrouiller l'entreprise" : "Verrouiller l'entreprise"}
                      >
                        {company.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => {
                           setEditingCompany(company);
                           setEditCompanyName(company.name);
                           setEditCompanyPrefix(company.identifierPrefix || '');
                           setEditCompanyLaser(!!company.isLaserEnabled);
                           setEditCompanyProtect(!!company.protectAppModified);
                        }}
                         className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                        title="Modifier l'entreprise"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(company)}
                        disabled={company.isLocked}
                        className={`p-1.5 rounded-lg transition ${
                          company.isLocked
                            ? "text-slate-200 dark:text-slate-700 cursor-not-allowed opacity-40"
                            : "text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                        }`}
                        title={company.isLocked ? "Entreprise verrouillée" : "Supprimer l'entreprise"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-800 mt-4 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                  {company.name}
                  {company.isLocked && <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                </h3>

                {/* Display unique prefix */}
                <div className="mt-2.5 flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">ID Enrôlement :</span>
                  {company.identifierPrefix ? (
                    <span className="font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded text-[10px] border border-indigo-100/50 dark:border-indigo-900/30">
                      {company.identifierPrefix}xxx
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                      Par défaut (INCI-ENR-...)
                    </span>
                  )}
                </div>

                {/* Laser BioQR Indicator */}
                {company.isLaserEnabled && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400">Laser BioQR :</span>
                    <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] border border-emerald-100/50 dark:border-emerald-900/30 font-semibold">
                      Activé
                    </span>
                  </div>
                )}

                {/* Counters */}
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/40 p-3 rounded-xl">
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Employés</span>
                    </div>
                    <p className="text-lg font-bold text-slate-800 dark:text-white mt-1">
                      {company._count?.employees ?? 0}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/40 p-3 rounded-xl">
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <Layout className="w-3.5 h-3.5 text-slate-400" />
                      <span>Modèles</span>
                    </div>
                    <p className="text-lg font-bold text-slate-800 dark:text-white mt-1">
                      {company._count?.templates ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-5 mt-6 grid grid-cols-2 gap-3">
                <Link
                  href={`/dashboard/studio?companyId=${company.id}`}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 rounded-xl text-xs font-semibold transition"
                >
                  <Layout className="w-3.5 h-3.5" />
                  <span>Studio</span>
                </Link>
                <Link
                  href={`/dashboard/employees?companyId=${company.id}`}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
                >
                  <span>Gérer</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-250">
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 w-full max-w-md p-6 rounded-2xl shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Ajouter une entreprise</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Créez le profil d&apos;une entreprise pour configurer son design et importer ses employés.
            </p>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Nom de l&apos;entreprise</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Acme Corporation"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                  Préfixe d&apos;identification des employés <span className="text-[10px] text-slate-400 lowercase italic">(optionnel)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: INCI-06-23-"
                  value={newCompanyPrefix}
                  onChange={(e) => setNewCompanyPrefix(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Les employés auront des numéros d&apos;enrôlement comme <span className="font-mono">{newCompanyPrefix || 'INCI-06-23-'}001</span>.
                </p>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="newCompanyLaser"
                  checked={newCompanyLaser}
                  onChange={(e) => setNewCompanyLaser(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/25 h-4 w-4"
                />
                <label htmlFor="newCompanyLaser" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Activer les bioQR au laser (Export Excel + Photos ZIP)
                </label>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="newCompanyProtect"
                  checked={newCompanyProtect}
                  onChange={(e) => setNewCompanyProtect(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/25 h-4 w-4"
                />
                <label htmlFor="newCompanyProtect" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Protéger les fiches modifiées sur l&apos;application des imports Excel
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewCompanyName('');
                    setNewCompanyPrefix('');
                    setNewCompanyLaser(false);
                  }}
                  className="px-4 py-2 text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Créer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-250">
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 w-full max-w-md p-6 rounded-2xl shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Modifier l&apos;entreprise</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Mettez à jour le nom ou le préfixe d&apos;enrôlement unique pour cette entreprise.
            </p>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Nom de l&apos;entreprise</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Acme Corporation"
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                  Préfixe d&apos;identification des employés <span className="text-[10px] text-slate-400 lowercase italic">(optionnel)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: INCI-06-23-"
                  value={editCompanyPrefix}
                  onChange={(e) => setEditCompanyPrefix(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Les nouveaux employés auront des numéros d&apos;enrôlement comme <span className="font-mono">{editCompanyPrefix || 'INCI-06-23-'}001</span>.
                </p>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="editCompanyLaser"
                  checked={editCompanyLaser}
                  onChange={(e) => setEditCompanyLaser(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/25 h-4 w-4"
                />
                <label htmlFor="editCompanyLaser" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Activer les bioQR au laser (Export Excel + Photos ZIP)
                </label>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="editCompanyProtect"
                  checked={editCompanyProtect}
                  onChange={(e) => setEditCompanyProtect(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/25 h-4 w-4"
                />
                <label htmlFor="editCompanyProtect" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Protéger les fiches modifiées sur l&apos;application des imports Excel
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCompany(null);
                  }}
                  className="px-4 py-2 text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Enregistrer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-250">
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 w-full max-w-md p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">
                <Trash2 className="w-5 h-5 shrink-0" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Supprimer l&apos;entreprise ?</h3>
                <p className="text-xs text-slate-400">{deletingCompany.name}</p>
              </div>
            </div>

            <div className="flex gap-2 p-3.5 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100/60 dark:border-rose-900/30 rounded-xl text-[11px] text-rose-700 dark:text-rose-400 font-semibold leading-relaxed mb-4">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <div>
                <strong>Attention:</strong> Cette action est irréversible. Toutes les données associées :
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  <li><strong>{deletingCompany._count?.employees ?? 0} employé(s)</strong> (et leurs photos)</li>
                  <li><strong>{deletingCompany._count?.templates ?? 0} modèle(s)</strong> de badges</li>
                  <li>Les formats et catégories associés</li>
                </ul>
                seront définitivement supprimés du système.
              </div>
            </div>

            <form onSubmit={handleDeleteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Saisissez le nom de l&apos;entreprise pour confirmer
                </label>
                <input
                  type="text"
                  required
                  placeholder={deletingCompany.name}
                  value={confirmNameInput}
                  onChange={(e) => setConfirmNameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-bold"
                />
              </div>

              <div className="flex gap-3 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setDeletingCompany(null)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || confirmNameInput.trim() !== deletingCompany.name}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>Supprimer tout</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
