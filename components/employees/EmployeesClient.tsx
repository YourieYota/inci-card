'use client';

import React, { useState, useEffect } from 'react';
import { Company, Employee } from '@prisma/client';
import { Building2, ArrowLeft, FileSpreadsheet, Plus, CheckCircle, RefreshCw, Loader2, Users as UsersIcon, CreditCard, Clock, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import ExcelImporter from './ExcelImporter';
import EmployeeCardList from './EmployeeCardList';
import WebcamModal from './WebcamModal';
import EmployeeDetailModal from './EmployeeDetailModal';
import { getEmployees, saveEmployeePhoto, getCompanyDashboardStats } from '@/app/actions/employees';

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
  const [localCompanies, setLocalCompanies] = useState<Company[]>(companies);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync companies list
  useEffect(() => {
    setLocalCompanies(companies || []);
  }, [companies]);

  // UI views / modals
  const [showImporter, setShowImporter] = useState<boolean>(false);
  const [activeWebcamEmployee, setActiveWebcamEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeForDetail, setSelectedEmployeeForDetail] = useState<Employee | null>(null);
  
  // States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [companyStats, setCompanyStats] = useState<{
    totalEmployees: number;
    printedCount: number;
    pendingPhotoCount: number;
    validatedPhotoCount: number;
    toVerifyCount: number;
  } | null>(null);

  const activeCompany = localCompanies.find((c) => c.id === selectedCompanyId);

  // Fetch employees when selected company changes
  useEffect(() => {
    if (!selectedCompanyId) {
      setEmployees([]);
      setCompanyStats(null);
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
      const [data, stats] = await Promise.all([
        getEmployees(selectedCompanyId),
        getCompanyDashboardStats(selectedCompanyId)
      ]);
      setEmployees(data);
      setCompanyStats(stats);
      setIsOfflineMode(false);
      try {
        localStorage.setItem(`inci-cache:employees:${selectedCompanyId}`, JSON.stringify(data));
        localStorage.setItem(`inci-cache:stats:${selectedCompanyId}`, JSON.stringify(stats));
      } catch (e) {
        console.error("Failed to write employees cache:", e);
      }
    } catch (err: any) {
      // Fetch failed, try local cache
      try {
        const cachedEmployees = localStorage.getItem(`inci-cache:employees:${selectedCompanyId}`);
        const cachedStats = localStorage.getItem(`inci-cache:stats:${selectedCompanyId}`);
        if (cachedEmployees) {
          setEmployees(JSON.parse(cachedEmployees));
          if (cachedStats) {
            setCompanyStats(JSON.parse(cachedStats));
          }
          setIsOfflineMode(true);
          console.warn("Loaded employees from local cache");
        } else {
          alert(err.message || 'Impossible de charger les employés.');
        }
      } catch (e) {
        console.error("Failed to read employees cache:", e);
        alert(err.message || 'Impossible de charger les employés.');
      }
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

  const handleSavePhoto = async (photoUrl: string) => {
    if (!activeWebcamEmployee) return;

    try {
      let finalPhotoUrl = photoUrl;
      
      // Upload Base64 to our server to get a real URL
      if (photoUrl.startsWith('data:image')) {
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: photoUrl, employeeId: activeWebcamEmployee.id })
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success && uploadData.url) {
          finalPhotoUrl = uploadData.url;
        } else {
          throw new Error('Erreur lors de la sauvegarde de la photo sur le serveur.');
        }
      }

      const updatedEmployee = await saveEmployeePhoto(activeWebcamEmployee.id, finalPhotoUrl);
      setSuccessBanner(`Photo enregistrée pour ${updatedEmployee.enrollmentNumber || activeWebcamEmployee.uniqueIdentifier}.`);
      setActiveWebcamEmployee(null);
      setSelectedEmployeeForDetail(updatedEmployee);
      setTimeout(() => setSuccessBanner(null), 4000);
      refreshEmployees();
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'enregistrement de la photo.");
    }
  };




  return (
    <div className="flex flex-col gap-6 min-h-screen">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-neutral-850 p-6 rounded-2xl border border-blue-100/60 dark:border-neutral-800 shadow-sm transition-all duration-300 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-orange-400 to-emerald-500" />
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2.5 rounded-xl border border-blue-100 dark:border-neutral-700 hover:bg-blue-50 dark:hover:bg-neutral-800 text-blue-500 transition"
          >
            <ArrowLeft className="w-4 h-4" />
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
            className="px-3.5 py-2.5 border border-blue-100 dark:border-neutral-700 bg-blue-50/30 dark:bg-neutral-900 rounded-xl text-sm font-medium min-w-[220px] focus:ring-2 focus:ring-blue-500/20 outline-none"
          >
            <option value="">Choisir une entreprise</option>
            {localCompanies.map((c) => (
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
                className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Importer Excel</span>
              </button>
              <button
                onClick={refreshEmployees}
                className="p-2.5 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-550 hover:text-blue-600 rounded-xl transition"
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
            {localCompanies.map((c) => (
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
          {/* Company Stats Summary */}
          {companyStats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 animate-in fade-in duration-300">
              <div className="bg-white dark:bg-neutral-850 p-4 rounded-xl border border-violet-100/70 dark:border-neutral-700/60 shadow-sm flex items-center gap-3">
                <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/40">
                  <UsersIcon className="w-4.5 h-4.5" style={{width:18,height:18}} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-550 uppercase tracking-wide">Total employés</p>
                  <p className="text-xl font-extrabold text-neutral-850 dark:text-white mt-0.5">{companyStats.totalEmployees}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-neutral-850 p-4 rounded-xl border border-orange-100/70 dark:border-neutral-700/60 shadow-sm flex items-center gap-3">
                <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/40">
                  <Clock className="w-4.5 h-4.5" style={{width:18,height:18}} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-550 uppercase tracking-wide">En attente de photo</p>
                  <p className="text-xl font-extrabold text-neutral-850 dark:text-white mt-0.5">{companyStats.pendingPhotoCount}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-neutral-850 p-4 rounded-xl border border-blue-100/70 dark:border-neutral-700/60 shadow-sm flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
                  <CheckCircle className="w-4.5 h-4.5" style={{width:18,height:18}} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-550 uppercase tracking-wide">Photos validées</p>
                  <p className="text-xl font-extrabold text-neutral-850 dark:text-white mt-0.5">{companyStats.validatedPhotoCount}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-neutral-850 p-4 rounded-xl border border-emerald-100/70 dark:border-neutral-700/60 shadow-sm flex items-center gap-3">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                  <CreditCard className="w-4.5 h-4.5" style={{width:18,height:18}} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-550 uppercase tracking-wide">Badges imprimés</p>
                  <p className="text-xl font-extrabold text-neutral-850 dark:text-white mt-0.5">{companyStats.printedCount}</p>
                </div>
              </div>
              <div className={`bg-white dark:bg-neutral-850 p-4 rounded-xl border shadow-sm flex items-center gap-3 transition-colors ${
                companyStats.toVerifyCount > 0 
                  ? 'border-rose-250 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10' 
                  : 'border-neutral-200/70 dark:border-neutral-700/60'
              }`}>
                <div className={`p-3 rounded-xl border transition-colors ${
                  companyStats.toVerifyCount > 0
                    ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-150 dark:border-rose-900/40 animate-pulse'
                    : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-450 dark:text-neutral-500 border-neutral-200 dark:border-neutral-700'
                }`}>
                  <AlertCircle className="w-4.5 h-4.5" style={{width:18,height:18}} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-555 uppercase tracking-wide">Fiches à vérifier</p>
                  <p className={`text-xl font-extrabold mt-0.5 ${companyStats.toVerifyCount > 0 ? 'text-rose-600 dark:text-rose-455 font-black' : 'text-neutral-850 dark:text-white'}`}>{companyStats.toVerifyCount}</p>
                </div>
              </div>
            </div>
          )}

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
                onClick={() => {
                  setShowImporter(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-655 dark:text-indigo-400 rounded-xl text-xs font-bold border border-indigo-100 dark:border-indigo-900/50 transition hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
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
            onOpenDetail={setSelectedEmployeeForDetail}
          />
        </div>
      )}

      {/* EMPLOYEE DETAIL MODAL */}
      {selectedEmployeeForDetail && (
        <EmployeeDetailModal
          employee={selectedEmployeeForDetail}
          onClose={() => setSelectedEmployeeForDetail(null)}
          onRefresh={refreshEmployees}
          onTriggerWebcam={(emp) => {
            setActiveWebcamEmployee(emp);
          }}
        />
      )}

      {/* WEBCAM CAPTURE DIALOG */}
      {activeWebcamEmployee && (
        <WebcamModal
          employeeName={activeWebcamEmployee.enrollmentNumber || activeWebcamEmployee.uniqueIdentifier}
          onSave={handleSavePhoto}
          onClose={() => setActiveWebcamEmployee(null)}
        />
      )}
    </div>
  );
}
