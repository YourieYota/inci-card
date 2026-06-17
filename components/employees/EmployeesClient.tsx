'use client';

import React, { useState, useEffect } from 'react';
import { Company, Employee } from '@prisma/client';
import { Building2, ArrowLeft, FileSpreadsheet, Plus, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';
import Link from 'next/link';
import ExcelImporter from './ExcelImporter';
import EmployeeCardList from './EmployeeCardList';
import WebcamModal from './WebcamModal';
import { getEmployees, saveEmployeePhoto } from '@/app/actions/employees';

interface EmployeesClientProps {
  companies: Company[];
  initialCompanyId?: string;
  initialEmployees: Employee[];
}

export default function EmployeesClient({
  companies,
  initialCompanyId = '',
  initialEmployees,
}: EmployeesClientProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompanyId);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  
  // UI views / modals
  const [showImporter, setShowImporter] = useState<boolean>(false);
  const [activeWebcamEmployee, setActiveWebcamEmployee] = useState<Employee | null>(null);
  
  // States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const activeCompany = companies.find((c) => c.id === selectedCompanyId);

  // Fetch employees when selected company changes
  useEffect(() => {
    if (!selectedCompanyId) {
      setEmployees([]);
      setShowImporter(false);
      return;
    }

    // Set URL query param without full page reload for cleaner UX
    const url = new URL(window.location.href);
    url.searchParams.set('companyId', selectedCompanyId);
    window.history.replaceState({}, '', url.toString());

    refreshEmployees();
  }, [selectedCompanyId]);

  const refreshEmployees = async () => {
    if (!selectedCompanyId) return;
    setIsLoading(true);
    try {
      const data = await getEmployees(selectedCompanyId);
      setEmployees(data);
    } catch (err: any) {
      alert(err.message || 'Impossible de charger les employés.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportSuccess = (count: number) => {
    setShowImporter(false);
    setSuccessBanner(`${count} employés ont été importés / mis à jour avec succès !`);
    setTimeout(() => setSuccessBanner(null), 5000);
    refreshEmployees();
  };

  const handleSavePhoto = async (photoBase64: string) => {
    if (!activeWebcamEmployee) return;

    try {
      await saveEmployeePhoto(activeWebcamEmployee.id, photoBase64);
      setSuccessBanner(`Photo enregistrée pour ${activeWebcamEmployee.uniqueIdentifier}.`);
      setActiveWebcamEmployee(null);
      setTimeout(() => setSuccessBanner(null), 4000);
      refreshEmployees();
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'enregistrement de la photo.");
    }
  };

  return (
    <div className="flex flex-col gap-6 min-h-screen">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-neutral-850 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Gestion des Employés</h1>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              Enrôlez le personnel et validez les photos d&apos;impression
            </p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Company Selector */}
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-medium min-w-[220px]"
          >
            <option value="">Choisir une entreprise</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Action buttons if company selected */}
          {selectedCompanyId && !showImporter && (
            <>
              <button
                onClick={() => setShowImporter(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Importer Excel</span>
              </button>
              <button
                onClick={refreshEmployees}
                className="p-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-700 rounded-xl transition"
                title="Rafraîchir"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* SUCCESS MESSAGE */}
      {successBanner && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400 rounded-xl text-sm font-medium animate-in fade-in duration-300">
          <CheckCircle className="w-4.5 h-4.5 text-emerald-500" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* VIEWPORT CONTROLLER */}
      {!selectedCompanyId ? (
        // VIEW: SELECT A COMPANY
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm text-center min-h-[400px]">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 flex items-center justify-center mb-4 border border-indigo-100 dark:border-indigo-900/50">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-neutral-850 dark:text-white mb-2">Sélectionnez une entreprise</h2>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 max-w-sm mb-6">
            Pour importer, filtrer ou gérer les employés, veuillez d&apos;abord sélectionner l&apos;entreprise cliente dans la liste déroulante supérieure.
          </p>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="px-4 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-medium"
          >
            <option value="">Sélectionnez une entreprise...</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : showImporter ? (
        // VIEW: EXCEL IMPORTER WORKSPACE
        <ExcelImporter
          companyId={selectedCompanyId}
          onImportSuccess={handleImportSuccess}
          onCancel={() => setShowImporter(false)}
        />
      ) : isLoading ? (
        // VIEW: LOADING
        <div className="flex-1 flex flex-col items-center justify-center py-16 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm min-h-[400px]">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
          <p className="text-sm text-neutral-450 dark:text-neutral-500">Chargement de la liste d&apos;employés...</p>
        </div>
      ) : (
        // VIEW: EMPLOYEES CARD GRID LIST
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-850 p-6 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-neutral-850 dark:text-white">
                Liste d&apos;enrôlement : {activeCompany?.name}
              </h2>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                {employees.length} employés inscrits en base de données.
              </p>
            </div>
            {employees.length === 0 && (
              <button
                onClick={() => setShowImporter(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 text-indigo-650 dark:text-indigo-400 rounded-xl text-xs font-bold border border-indigo-100 dark:border-indigo-900/50 transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Importer le premier Excel</span>
              </button>
            )}
          </div>

          <EmployeeCardList
            employees={employees}
            onTriggerWebcam={setActiveWebcamEmployee}
            onRefresh={refreshEmployees}
          />
        </div>
      )}

      {/* WEBCAM CAPTURE DIALOG */}
      {activeWebcamEmployee && (
        <WebcamModal
          employeeName={activeWebcamEmployee.uniqueIdentifier}
          onSave={handleSavePhoto}
          onClose={() => setActiveWebcamEmployee(null)}
        />
      )}
    </div>
  );
}
