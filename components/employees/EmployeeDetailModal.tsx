'use client';

import React, { useState } from 'react';
import { Employee } from '@prisma/client';
import { X, Camera, Upload, Printer, Check, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { updateEmployeeStatus, saveEmployeePhoto, updateEmployeeData, deleteEmployee } from '@/app/actions/employees';
import { addOfflineMutation } from '@/lib/offlineQueue';
import { safeSetItem, safeGetItem } from '@/lib/storage';

interface EmployeeDetailModalProps {
  employee: Employee;
  onClose: () => void;
  onRefresh: () => void;
  onTriggerWebcam: (employee: Employee) => void;
  isOfflineMode?: boolean;
  isCompanyLocked?: boolean;
  companyFields?: string[];
}

export default function EmployeeDetailModal({
  employee,
  onClose,
  onRefresh,
  onTriggerWebcam,
  isOfflineMode = false,
  isCompanyLocked = false,
  companyFields = [],
}: EmployeeDetailModalProps) {
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(employee.status);
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const data = employee.dynamicData as Record<string, any>;
    const initialForm: Record<string, string> = {};
    
    // Initialize all company fields to empty strings first
    if (companyFields && Array.isArray(companyFields)) {
      companyFields.forEach((field) => {
        initialForm[field] = '';
      });
    }

    if (data && typeof data === 'object') {
      Object.entries(data).forEach(([key, val]) => {
        const trimmedKey = key.trim();
        if (!trimmedKey) return;
        // Skip if we already have a non-empty value for this trimmed key (from a previous iteration)
        if (trimmedKey in initialForm && initialForm[trimmedKey] !== '') return;
        const isDateKey = trimmedKey.toLowerCase().startsWith('date');
        const isDateVal = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val);
        if ((isDateKey || isDateVal) && val) {
          const dateObj = new Date(val);
          if (!isNaN(dateObj.getTime())) {
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = dateObj.getFullYear();
            initialForm[trimmedKey] = `${day}/${month}/${year}`;
            return;
          }
        }
        initialForm[trimmedKey] = val !== null && val !== undefined ? String(val) : '';
      });
    }
    return initialForm;
  });

  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // File reader & compressor for local photo upload
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Veuillez sélectionner un fichier image valide.');
      return;
    }

    setPhotoError(null);

    // Auto-save textual changes first
    try {
      await saveDataOnly();
      onRefresh();
    } catch (err: any) {
      setPhotoError(err.message || 'Erreur lors de l\'enregistrement des modifications avant chargement.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 480;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setPhotoError('Erreur lors de la préparation de la compression.');
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        setUploadedPhoto(compressedBase64);
      };
      img.onerror = () => {
        setPhotoError('Impossible de charger le fichier image.');
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setPhotoError('Erreur de lecture du fichier.');
    };
    reader.readAsDataURL(file);
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleDelete = async () => {
    if (isCompanyLocked) {
      alert("Cette entreprise est verrouillée, vous ne pouvez pas supprimer cet employé.");
      return;
    }

    if (!confirm("Êtes-vous sûr de vouloir supprimer définitivement cet employé ? Cette action est irréversible.")) {
      return;
    }

    setIsDeleting(true);
    try {
      if (isOfflineMode) {
        addOfflineMutation(
          'DELETE_EMPLOYEE',
          { employeeId: employee.id },
          `Supprimer l'employé ${employee.uniqueIdentifier} (Hors-ligne)`
        );

        // Update local storage cache
        try {
          const cachedRaw = safeGetItem(`inci-cache:employees:${employee.companyId}`);
          if (cachedRaw) {
            const cachedList: Employee[] = JSON.parse(cachedRaw);
            const filtered = cachedList.filter(e => e.id !== employee.id);
            safeSetItem(`inci-cache:employees:${employee.companyId}`, JSON.stringify(filtered));
          }
        } catch (e) {
          console.warn("Failed to write offline cache on delete:", e);
        }

        onRefresh();
        onClose();
        return;
      }

      await deleteEmployee(employee.id);
      onRefresh();
      onClose();
    } catch (err: any) {
      alert(err.message || "Erreur lors de la suppression de l'employé.");
    } finally {
      setIsDeleting(false);
    }
  };

  const saveDataOnly = async () => {
    const processedData: Record<string, any> = {};
    Object.entries(formData).forEach(([key, val]) => {
      const trimmedKey = key.trim();
      if (!trimmedKey) return;
      if (trimmedKey.toLowerCase().startsWith('date') && typeof val === 'string') {
        const trimmedVal = val.trim();
        const dmyMatch = trimmedVal.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmyMatch) {
          const day = parseInt(dmyMatch[1], 10);
          const month = parseInt(dmyMatch[2], 10) - 1;
          const year = parseInt(dmyMatch[3], 10);
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            processedData[trimmedKey] = date;
            return;
          }
        }
      }
      processedData[trimmedKey] = val;
    });

    if (isOfflineMode) {
      // Prepare updated employee object
      const updatedEmployee = {
        ...employee,
        status: uploadedPhoto ? 'PHOTO_VALIDEE' : status,
        dynamicData: processedData,
      };
      
      if (uploadedPhoto) {
        updatedEmployee.photoUrl = uploadedPhoto;
        if (!updatedEmployee.enrollmentNumber) {
          updatedEmployee.enrollmentNumber = `INCI-ENR-${new Date().getFullYear()}-TEMP (HORS-LIGNE)`;
        }
      }

      // Queue mutations
      const tempEmployeeKey = employee.id.startsWith('temp_employee_') ? {
        companyId: employee.companyId,
        uniqueIdentifier: employee.uniqueIdentifier,
      } : undefined;

      if (uploadedPhoto) {
        addOfflineMutation(
          'SAVE_EMPLOYEE_PHOTO',
          { employeeId: employee.id, photoBase64: uploadedPhoto, tempEmployeeKey },
          `Enregistrer la photo de ${employee.uniqueIdentifier} (Hors-ligne)`
        );
      }

      addOfflineMutation(
        'UPDATE_EMPLOYEE_DATA',
        { employeeId: employee.id, dynamicData: processedData, tempEmployeeKey },
        `Modifier les informations de ${employee.uniqueIdentifier} (Hors-ligne)`
      );

      const targetStatus = uploadedPhoto 
        ? (status === employee.status ? 'PHOTO_VALIDEE' : status)
        : status;

      if (targetStatus !== employee.status || uploadedPhoto) {
        addOfflineMutation(
          'UPDATE_EMPLOYEE_STATUS',
          { employeeId: employee.id, status: targetStatus, tempEmployeeKey },
          `Changer le statut de ${employee.uniqueIdentifier} à ${targetStatus} (Hors-ligne)`
        );
      }

      // Update local storage cache
      try {
        const cachedRaw = safeGetItem(`inci-cache:employees:${employee.companyId}`);
        if (cachedRaw) {
          const cachedList: Employee[] = JSON.parse(cachedRaw);
          const idx = cachedList.findIndex(e => e.id === employee.id);
          if (idx !== -1) {
            cachedList[idx] = updatedEmployee;
            safeSetItem(`inci-cache:employees:${employee.companyId}`, JSON.stringify(cachedList));
          }
        }
      } catch (e) {
        console.warn("Failed to write offline detail cache:", e);
      }
    } else {
      // 1. Save Photo first (if new local upload)
      let finalPhotoUrl = employee.photoUrl;
      if (uploadedPhoto) {
        // Upload Base64 to our server to get a real URL
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: uploadedPhoto, employeeId: employee.id })
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success && uploadData.url) {
          finalPhotoUrl = uploadData.url;
        } else {
          throw new Error('Erreur lors de la sauvegarde du fichier image sur le serveur.');
        }

        await saveEmployeePhoto(employee.id, finalPhotoUrl as string);
      }

      // 2. Update Excel Data
      await updateEmployeeData(employee.id, processedData);

      // 3. Update Status
      const targetStatus = uploadedPhoto 
        ? (status === employee.status ? 'PHOTO_VALIDEE' : status)
        : status;

      if (targetStatus !== employee.status || uploadedPhoto) {
        await updateEmployeeStatus(employee.id, targetStatus);
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveDataOnly();
      onRefresh();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la mise à jour des informations.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintReceipt = async () => {
    setIsSaving(true);
    try {
      await saveDataOnly();
      onRefresh();
      window.open(`/receipt?id=${employee.id}`, '_blank');
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'enregistrement des modifications avant impression.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintCard = async () => {
    setIsSaving(true);
    try {
      await saveDataOnly();
      onRefresh();
      window.open(`/dashboard/employees/print?ids=${encodeURIComponent(employee.id)}`, '_blank');
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'enregistrement des modifications avant impression.');
    } finally {
      setIsSaving(false);
    }
  };

  const activePhoto = uploadedPhoto || employee.photoUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 dark:bg-neutral-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-800 dark:text-white">Fiche d&apos;enrôlement - {employee.enrollmentNumber || employee.uniqueIdentifier}</h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">Consultez, modifiez et validez les détails de l&apos;employé</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {employee.photoConflict && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl flex items-start gap-3 text-rose-800 dark:text-rose-400 animate-pulse mb-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Alerte Doublon Détectée</p>
                <p className="text-[11px] mt-1 leading-relaxed opacity-95">
                  L&apos;empreinte de cette photo est identique à celle d&apos;un autre employé. Cette fiche a été verrouillée en statut <strong>&quot;À vérifier&quot;</strong> afin d&apos;éviter les doublons de cartes d&apos;identité.
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* PHOTO COLUMN */}
            <div className="flex flex-col items-center gap-4 border-b md:border-b-0 md:border-r border-neutral-100 dark:border-neutral-800 pb-6 md:pb-0 md:pr-6">
              <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider self-start">Photo de Profil</span>
              
              {/* Image Preview Box */}
              <div className="w-40 h-48 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden flex items-center justify-center relative shadow-inner group">
                {activePhoto ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={activePhoto} alt="Employee Photo" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    <Camera className="w-10 h-10 mx-auto text-neutral-400 opacity-60 mb-2" />
                    <span className="text-[10px] font-bold text-neutral-400">Aucune photo enregistrée</span>
                  </div>
                )}
                {uploadedPhoto && (
                  <div className="absolute top-2 right-2 bg-emerald-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                    Nouvelle
                  </div>
                )}
              </div>

              {photoError && (
                <div className="text-[10px] text-rose-500 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{photoError}</span>
                </div>
              )}

              {/* Photo Actions */}
              <div className="flex flex-col gap-2 w-full">
                <input 
                  type="file" 
                  accept="image/*" 
                  id="local-photo-upload" 
                  className="hidden" 
                  onChange={handlePhotoFileChange} 
                />
                
                <button
                  type="button"
                  onClick={() => document.getElementById('local-photo-upload')?.click()}
                  className="flex items-center justify-center gap-2 py-2 px-4 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-semibold transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Charger localement</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setIsSaving(true);
                    try {
                      await saveDataOnly();
                      onRefresh();
                      
                      // Construct an updated employee object to pass to onTriggerWebcam
                      const processedData: Record<string, any> = {};
                      Object.entries(formData).forEach(([key, val]) => {
                        if (key.toLowerCase().trim().startsWith('date') && typeof val === 'string') {
                          const trimmed = val.trim();
                          const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                          if (dmyMatch) {
                            const day = parseInt(dmyMatch[1], 10);
                            const month = parseInt(dmyMatch[2], 10) - 1;
                            const year = parseInt(dmyMatch[3], 10);
                            const date = new Date(year, month, day);
                            if (!isNaN(date.getTime())) {
                              processedData[key] = date;
                              return;
                            }
                          }
                        }
                        processedData[key] = val;
                      });

                      const updatedEmployee = {
                        ...employee,
                        dynamicData: processedData,
                      };

                      onTriggerWebcam(updatedEmployee);
                      onClose(); // close detail modal to focus on webcam modal
                    } catch (err: any) {
                      alert(err.message || 'Erreur lors de la sauvegarde avant ouverture de la webcam.');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  className="flex items-center justify-center gap-2 py-2 px-4 border border-indigo-100 dark:border-indigo-900 bg-indigo-50/20 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded-xl text-xs font-semibold transition"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Prendre via Webcam</span>
                </button>
              </div>
            </div>

            {/* INFO & DATA COLUMN */}
            <div className="md:col-span-2 space-y-4">
              <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">Détails et Informations</span>
              
              {/* Dynamic Excel Fields Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1">
                {Object.entries(formData).map(([key, val]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500">{key}</label>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/25"
                    />
                  </div>
                ))}
              </div>

              {/* Status Manager */}
              <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4 flex flex-col gap-2">
                <label className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500">Statut de l&apos;enrôlement</label>
                <div className="flex rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-50 dark:bg-neutral-900 p-0.5 w-max">
                  {(['A_ENROLER', 'PHOTO_VALIDEE', 'IMPRIME', 'A_VERIFIER'] as const).map((st) => {
                    const isActive = status === st;

                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setStatus(st);
                        }}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                          isActive 
                            ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-neutral-200 dark:border-neutral-700/50' 
                            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                        }`}
                      >
                        {st === 'A_ENROLER' && 'À enrôler'}
                        {st === 'PHOTO_VALIDEE' && 'Validé'}
                        {st === 'IMPRIME' && 'Imprimé'}
                        {st === 'A_VERIFIER' && 'À vérifier'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrintReceipt}
              className="flex items-center gap-1.5 py-2 px-4 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer le reçu</span>
            </button>
            <button
              type="button"
              disabled={status === 'A_ENROLER'}
              onClick={handlePrintCard}
              className="flex items-center gap-1.5 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-sm"
              title={status === 'A_ENROLER' ? "Veuillez d'abord ajouter une photo et valider l'enrôlement" : "Imprimer la carte de l'employé"}
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer la carte</span>
            </button>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isSaving || isCompanyLocked}
              className={`flex items-center gap-1.5 py-2.5 px-4 border rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                isCompanyLocked
                  ? 'border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500'
                  : 'border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400'
              }`}
              title={isCompanyLocked ? "Cette entreprise est verrouillée, impossible de supprimer cet employé." : "Supprimer définitivement l'employé"}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>Supprimer</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-xl transition"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isDeleting}
              className="flex items-center gap-1.5 py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Enregistrer</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
