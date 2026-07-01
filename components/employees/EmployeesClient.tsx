'use client';

import React, { useState, useEffect } from 'react';
import { Company, Employee } from '@prisma/client';
import { Building2, ArrowLeft, FileSpreadsheet, Plus, CheckCircle, RefreshCw, Loader2, Users as UsersIcon, CreditCard, Clock, AlertCircle, Download } from 'lucide-react';
import Link from 'next/link';
import ExcelImporter from './ExcelImporter';
import EmployeeCardList from './EmployeeCardList';
import WebcamModal from './WebcamModal';
import EmployeeDetailModal from './EmployeeDetailModal';
import LaserExportModal from './LaserExportModal';
import { getEmployees, saveEmployeePhoto, getCompanyDashboardStats } from '@/app/actions/employees';
import { safeSetItem, safeGetItem } from '@/lib/storage';

interface EmployeesClientProps {
  companies: Company[];
  initialCompanyId?: string;
  initialEmployees: Employee[];
  dbError?: boolean;
}

export default function EmployeesClient({
  companies,
  initialCompanyId = '',
  initialEmployees,
  dbError,
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
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  
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
      safeSetItem(`inci-cache:employees:${selectedCompanyId}`, JSON.stringify(data));
      safeSetItem(`inci-cache:stats:${selectedCompanyId}`, JSON.stringify(stats));
    } catch (err: any) {
      // Fetch failed, try local cache
      try {
        const cachedEmployees = safeGetItem(`inci-cache:employees:${selectedCompanyId}`);
        const cachedStats = safeGetItem(`inci-cache:stats:${selectedCompanyId}`);
        if (cachedEmployees) {
          setEmployees(JSON.parse(cachedEmployees));
          if (cachedStats) {
            setCompanyStats(JSON.parse(cachedStats));
          }
          console.warn("Loaded employees from local cache");
        } else {
          alert(err.message || 'Impossible de charger les employés.');
        }
      } catch (e) {
        console.warn("Failed to read employees cache:", e);
        alert(err.message || 'Impossible de charger les employés.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportSuccess = (count: number, added?: number, updated?: number, skippedProtected?: number) => {
    setShowImporter(false);
    
    let msg = `${count} employé(s) importé(s) / mis à jour avec succès !`;
    if (added !== undefined || updated !== undefined || skippedProtected !== undefined) {
      const parts = [];
      if (added !== undefined && added > 0) parts.push(`${added} créé(s)`);
      if (updated !== undefined && updated > 0) parts.push(`${updated} mis à jour`);
      if (skippedProtected !== undefined && skippedProtected > 0) parts.push(`${skippedProtected} protégé(s) et non modifié(s)`);
      if (parts.length > 0) {
        msg = `Importation terminée : ${parts.join(', ')}.`;
      }
    }
    
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 7000);
    refreshEmployees();
  };

  const handleSavePhoto = async (photoUrl: string) => {
    if (!activeWebcamEmployee) return;

    try {
      let finalPhotoUrl = photoUrl;
      
      // If photo comes from the bridge (localhost:4000) or is base64, we upload it to Next.js
      if (photoUrl.startsWith('data:image') || photoUrl.includes('localhost:4000')) {
        let base64 = photoUrl;
        
        if (photoUrl.includes('localhost:4000')) {
          // Fetch the image from the local bridge and convert to a COMPRESSED base64
          const res = await fetch(photoUrl);
          const blob = await res.blob();
          base64 = await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 1250;
              const MAX_HEIGHT = 1650;
              let width = img.width;
              let height = img.height;
              
              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.8)); // 80% quality JPEG
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
          });
        }
        
        // Use the base64 directly to avoid Vercel Read-Only File System errors
        // and Payload Too Large limits on /api/upload
        finalPhotoUrl = base64;
        
        // Save the compressed photo back to the local computer's "Pictures/image-carte" folder
        try {
          // Extraire un nom ou utiliser l'identifiant
          const empData = activeWebcamEmployee.dynamicData as any;
          const empName = empData?.nom || empData?.name || activeWebcamEmployee.uniqueIdentifier;
          const cleanName = String(empName).replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const filename = `photo_${cleanName}_${Date.now()}.jpg`;
          
          await fetch('http://localhost:4000/api/save-local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64: finalPhotoUrl, filename })
          });
        } catch (localErr) {
          console.warn("Le pont local n'est pas joignable pour sauvegarder l'image :", localErr);
        }
      }

      const updatedEmployee = await saveEmployeePhoto(activeWebcamEmployee.id, finalPhotoUrl);
      try {
        sessionStorage.removeItem(`emp-photo:${activeWebcamEmployee.id}`);
      } catch (e) {
        console.warn("Failed to clear sessionStorage cache:", e);
      }
      setSuccessBanner(`Photo enregistrée pour ${updatedEmployee.enrollmentNumber || activeWebcamEmployee.uniqueIdentifier}.`);
      setActiveWebcamEmployee(null);
      setSelectedEmployeeForDetail(updatedEmployee);
      setTimeout(() => setSuccessBanner(null), 4000);
      refreshEmployees();
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'enregistrement de la photo.");
    }
  };
  // Get all unique fields/headers present in dynamicData for all employees of the current company
  const allCompanyFields = React.useMemo(() => {
    const fieldsSet = new Set<string>();
    employees.forEach((emp) => {
      if (emp.dynamicData && typeof emp.dynamicData === 'object') {
        const data = emp.dynamicData as Record<string, any>;
        Object.keys(data).forEach((k) => {
          if (k && k.trim()) {
            fieldsSet.add(k.trim());
          }
        });
      }
    });
    return Array.from(fieldsSet);
  }, [employees]);

  return (
    <div className="flex flex-col gap-6 min-h-screen">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-blue-100/60 dark:border-neutral-800 shadow-sm transition-all duration-300 relative overflow-hidden">
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
              {activeCompany?.isLaserEnabled && (
                <button
                  onClick={() => setShowExportModal(true)}
                  disabled={employees.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Laser (BioQR)</span>
                </button>
              )}
              <button
                onClick={() => setShowImporter(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Importer Excel</span>
              </button>
              <button
                onClick={refreshEmployees}
                className="p-2.5 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-500 hover:text-blue-600 rounded-xl transition"
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
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm text-center min-h-[400px]">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 flex items-center justify-center mb-4 border border-indigo-100 dark:border-indigo-900/50">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-neutral-800 dark:text-white mb-2">Sélectionnez une entreprise</h2>
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
        <div className="flex-1 flex flex-col items-center justify-center py-16 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm min-h-[400px]">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
          <p className="text-sm text-neutral-400 dark:text-neutral-500">Chargement de la liste d&apos;employés...</p>
        </div>
      ) : (
        // VIEW: EMPLOYEES CARD GRID LIST
        <div className="space-y-6">
          {/* Company Stats Summary */}
          {companyStats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 animate-in fade-in duration-300">
              <div className="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-violet-100/70 dark:border-neutral-700/60 shadow-sm flex items-center gap-3">
                <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/40">
                  <UsersIcon className="w-4.5 h-4.5" style={{width:18,height:18}} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Total employés</p>
                  <p className="text-xl font-extrabold text-neutral-800 dark:text-white mt-0.5">{companyStats.totalEmployees}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-orange-100/70 dark:border-neutral-700/60 shadow-sm flex items-center gap-3">
                <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/40">
                  <Clock className="w-4.5 h-4.5" style={{width:18,height:18}} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">En attente de photo</p>
                  <p className="text-xl font-extrabold text-neutral-800 dark:text-white mt-0.5">{companyStats.pendingPhotoCount}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-blue-100/70 dark:border-neutral-700/60 shadow-sm flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
                  <CheckCircle className="w-4.5 h-4.5" style={{width:18,height:18}} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Photos validées</p>
                  <p className="text-xl font-extrabold text-neutral-800 dark:text-white mt-0.5">{companyStats.validatedPhotoCount}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-emerald-100/70 dark:border-neutral-700/60 shadow-sm flex items-center gap-3">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                  <CreditCard className="w-4.5 h-4.5" style={{width:18,height:18}} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Badges imprimés</p>
                  <p className="text-xl font-extrabold text-neutral-800 dark:text-white mt-0.5">{companyStats.printedCount}</p>
                </div>
              </div>
              <div className={`bg-white dark:bg-neutral-800 p-4 rounded-xl border shadow-sm flex items-center gap-3 transition-colors ${
                companyStats.toVerifyCount > 0 
                  ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10' 
                  : 'border-neutral-200/70 dark:border-neutral-700/60'
              }`}>
                <div className={`p-3 rounded-xl border transition-colors ${
                  companyStats.toVerifyCount > 0
                    ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 animate-pulse'
                    : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border-neutral-200 dark:border-neutral-700'
                }`}>
                  <AlertCircle className="w-4.5 h-4.5" style={{width:18,height:18}} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Fiches à vérifier</p>
                  <p className={`text-xl font-extrabold mt-0.5 ${companyStats.toVerifyCount > 0 ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-neutral-800 dark:text-white'}`}>{companyStats.toVerifyCount}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-neutral-800 p-6 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-neutral-800 dark:text-white">
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
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold border border-indigo-100 dark:border-indigo-900/50 transition hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
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
          isCompanyLocked={activeCompany?.isLocked}
          companyFields={allCompanyFields}
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

      {/* LASER EXPORT MODAL */}
      {showExportModal && activeCompany && (
        <LaserExportModal
          companyId={activeCompany.id}
          companyName={activeCompany.name}
          employees={employees}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
