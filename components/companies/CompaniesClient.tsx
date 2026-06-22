'use client';

import React, { useState, useEffect } from 'react';
import { Company } from '@prisma/client';
import { Building2, Plus, Search, Users, Layout, Calendar, ArrowUpRight, Loader2, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { createCompany } from '@/app/actions/templates';

interface CompanyWithCounts extends Company {
  _count: {
    employees: number;
    templates: number;
  };
}

interface CompaniesClientProps {
  initialCompanies: CompanyWithCounts[];
}

export default function CompaniesClient({ initialCompanies }: CompaniesClientProps) {
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
  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      const newCompany = await createCompany(newCompanyName.trim());
      
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
      setShowCreateModal(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || "Impossible de créer l'entreprise.");
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-neutral-850 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all duration-300">
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
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Entreprise</span>
        </button>
      </div>



      {/* SUCCESS MESSAGE */}
      {successMessage && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-250 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400 rounded-xl text-sm font-medium animate-in fade-in duration-300">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* FILTER BAR */}
      <div className="flex bg-white dark:bg-neutral-850 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Rechercher une entreprise..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/25"
          />
        </div>
      </div>

      {/* COMPANIES LISTING */}
      {filteredCompanies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-center shadow-sm">
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
              className="group bg-white dark:bg-neutral-850 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                    <Calendar className="w-3.5 h-3.5 opacity-70" />
                    <span>{new Date(company.createdAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-850 dark:text-white mt-4 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {company.name}
                </h3>

                {/* Counters */}
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-slate-55 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/40 p-3 rounded-xl">
                    <div className="flex items-center gap-2 text-slate-455 text-xs">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Employés</span>
                    </div>
                    <p className="text-lg font-bold text-slate-850 dark:text-white mt-1">
                      {company._count?.employees ?? 0}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/40 p-3 rounded-xl">
                    <div className="flex items-center gap-2 text-slate-450 text-xs">
                      <Layout className="w-3.5 h-3.5 text-slate-400" />
                      <span>Modèles</span>
                    </div>
                    <p className="text-lg font-bold text-slate-850 dark:text-white mt-1">
                      {company._count?.templates ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-5 mt-6 grid grid-cols-2 gap-3">
                <Link
                  href={`/dashboard/studio?companyId=${company.id}`}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/50 text-indigo-750 dark:text-indigo-400 rounded-xl text-xs font-semibold transition"
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
          <div className="bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 w-full max-w-md p-6 rounded-2xl shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Ajouter une entreprise</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Créez le profil d&apos;une entreprise pour configurer son design et importer ses employés.
            </p>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mb-1.5">Nom de l&apos;entreprise</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Acme Corporation"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewCompanyName('');
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
    </div>
  );
}
