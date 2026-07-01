'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  Search, 
  ArrowRight, 
  Loader2, 
  Building2, 
  Printer, 
  Calendar, 
  X, 
  User, 
  FileText,
  CheckSquare,
  Square,
  AlertTriangle,
  Info,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Upload
} from 'lucide-react';
import { 
  createDeliveryBatch, 
  updateBatchStatus, 
  getUnassignedPrintedEmployees, 
  getBatchEmployees,
  deleteDeliveryBatch,
  updateDeliveryBatch,
  uploadDeliveryBatchProof
} from '@/app/actions/batches';

interface DeliveryBatchesClientProps {
  initialCompanies: any[];
  initialBatches: any[];
  dbError?: boolean;
}

type GroupingType = 'manual' | 'structure' | 'campagne' | 'type' | 'site' | 'periode';

interface GroupingOption {
  fieldKey: string;
  displayName: string;
  uniqueValues: { value: string; count: number }[];
}

interface AnalyzedFields {
  structure: GroupingOption[];
  campagne: GroupingOption[];
  site: GroupingOption[];
  type: GroupingOption[];
}

export default function DeliveryBatchesClient({ initialCompanies, initialBatches, dbError }: DeliveryBatchesClientProps) {
  const [batches, setBatches] = useState<any[]>(initialBatches);
  const [companies] = useState<any[]>(initialCompanies);
  const [search, setSearch] = useState('');
  
  // View State: 'list' | 'editor'
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  
  // Editor State
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [editingBatch, setEditingBatch] = useState<any | null>(null);
  
  // Available Employees
  const [availableEmployees, setAvailableEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingBatchId, setUploadingBatchId] = useState<string | null>(null);

  // Selection State (IDs of employees to be included in the batch)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Record<string, boolean>>({});

  // Batch Details
  const [customBatchNumber, setCustomBatchNumber] = useState('');

  // Filters State
  const [selectedGrouping, setSelectedGrouping] = useState<GroupingType>('manual');
  const [analyzedFields, setAnalyzedFields] = useState<AnalyzedFields>({
    structure: [], campagne: [], site: [], type: []
  });
  const [selectedFieldKey, setSelectedFieldKey] = useState<string>('');
  const [filterValues, setFilterValues] = useState<Record<string, boolean>>({});
  const [manualSearch, setManualSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // View batch details state (read-only modal)
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<any | null>(null);
  const [batchEmployees, setBatchEmployees] = useState<any[]>([]);
  const [loadingBatchEmployees, setLoadingBatchEmployees] = useState(false);

  // Pagination for list
  const [wizardPage, setWizardPage] = useState(1);
  const wizardPageSize = 20;

  // Analyze dynamic fields
  const analyzeDynamicData = (employees: any[]): AnalyzedFields => {
    const fields: AnalyzedFields = {
      structure: [],
      campagne: [],
      site: [],
      type: []
    };

    if (employees.length === 0) return fields;

    const allKeys = new Set<string>();
    employees.forEach(emp => {
      if (emp.dynamicData && typeof emp.dynamicData === 'object') {
        Object.keys(emp.dynamicData).forEach(k => allKeys.add(k));
      }
    });

    const getUniqueValuesWithCounts = (key: string) => {
      const counts: Record<string, number> = {};
      employees.forEach(emp => {
        const val = emp.dynamicData?.[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const strVal = String(val).trim();
          counts[strVal] = (counts[strVal] || 0) + 1;
        }
      });
      return Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    };

    allKeys.forEach(key => {
      const lowerKey = key.toLowerCase();
      const uniqueValues = getUniqueValuesWithCounts(key);
      if (uniqueValues.length === 0) return;

      const option: GroupingOption = { fieldKey: key, displayName: key, uniqueValues };

      if (lowerKey.includes('structure') || lowerKey.includes('département') || lowerKey.includes('departement') || lowerKey.includes('service') || lowerKey.includes('direction') || lowerKey.includes('division') || lowerKey.includes('bureau')) {
        fields.structure.push(option);
      } else if (lowerKey.includes('campagne') || lowerKey.includes('promotion') || lowerKey.includes('session') || lowerKey.includes('promo') || lowerKey.includes('lot')) {
        fields.campagne.push(option);
      } else if (lowerKey.includes('site') || lowerKey.includes('lieu') || lowerKey.includes('agence') || lowerKey.includes('ville') || lowerKey.includes('centre') || lowerKey.includes('enrôlement') || lowerKey.includes('enrolement')) {
        fields.site.push(option);
      } else if (lowerKey.includes('type') || lowerKey.includes('catégorie') || lowerKey.includes('categorie') || lowerKey.includes('classe') || lowerKey.includes('grade') || lowerKey.includes('profil')) {
        fields.type.push(option);
      }
    });

    return fields;
  };

  // Load employees
  useEffect(() => {
    if (!selectedCompanyId && view === 'editor') {
      setAvailableEmployees([]);
      return;
    }
    
    if (view === 'editor') {
      const fetchAvailable = async () => {
        setLoadingEmployees(true);
        try {
          const unassigned = await getUnassignedPrintedEmployees(selectedCompanyId);
          let allAvailable = [...unassigned];
          
          if (editorMode === 'edit' && editingBatch) {
            const currentEmployees = await getBatchEmployees(editingBatch.id);
            allAvailable = [...unassigned, ...currentEmployees];
            
            const initialSelected: Record<string, boolean> = {};
            currentEmployees.forEach(emp => {
              initialSelected[emp.id] = true;
            });
            setSelectedEmployeeIds(initialSelected);
          } else {
            setSelectedEmployeeIds({});
          }
          
          setAvailableEmployees(allAvailable);
          
          const fields = analyzeDynamicData(allAvailable);
          setAnalyzedFields(fields);
          
          setSelectedGrouping('manual');
          setSelectedFieldKey('');
          setFilterValues({});
          setManualSearch('');
          setStartDate('');
          setEndDate('');
          setWizardPage(1);

        } catch (err) {
          console.error("Failed to load cards:", err);
        } finally {
          setLoadingEmployees(false);
        }
      };
      
      fetchAvailable();
    }
  }, [selectedCompanyId, view, editorMode, editingBatch]);

  useEffect(() => {
    let keyToSelect = '';
    if (selectedGrouping === 'structure' && analyzedFields.structure.length > 0) {
      keyToSelect = analyzedFields.structure[0].fieldKey;
    } else if (selectedGrouping === 'campagne' && analyzedFields.campagne.length > 0) {
      keyToSelect = analyzedFields.campagne[0].fieldKey;
    } else if (selectedGrouping === 'site' && analyzedFields.site.length > 0) {
      keyToSelect = analyzedFields.site[0].fieldKey;
    } else if (selectedGrouping === 'type' && analyzedFields.type.length > 0) {
      keyToSelect = analyzedFields.type[0].fieldKey;
    }
    
    setSelectedFieldKey(keyToSelect);
    setFilterValues({});
    setWizardPage(1);
  }, [selectedGrouping, analyzedFields]);

  const getEmployeeName = (emp: any): string => {
    const data = emp.dynamicData as Record<string, any>;
    if (data && typeof data === 'object') {
      const p = data.Prenom || data.prenom || '';
      const n = data.Nom || data.nom || '';
      return `${p} ${n}`.trim() || emp.uniqueIdentifier;
    }
    return emp.uniqueIdentifier;
  };

  const filteredEmployees = useMemo(() => {
    if (!selectedCompanyId || availableEmployees.length === 0) return [];

    let result = availableEmployees;

    if (manualSearch.trim()) {
      const query = manualSearch.toLowerCase();
      result = result.filter(emp => {
        const name = getEmployeeName(emp).toLowerCase();
        const matricule = emp.uniqueIdentifier.toLowerCase();
        return name.includes(query) || matricule.includes(query);
      });
    }

    if (selectedGrouping === 'periode') {
      if (startDate || endDate) {
        result = result.filter(emp => {
          if (!emp.printedAt) return false;
          const printTime = new Date(emp.printedAt).getTime();
          const start = startDate ? new Date(startDate).getTime() : 0;
          const end = endDate ? new Date(endDate).getTime() + 86400000 - 1 : Infinity;
          return printTime >= start && printTime <= end;
        });
      }
    } else if (selectedGrouping !== 'manual' && selectedFieldKey) {
      const hasSelections = Object.values(filterValues).some(v => v);
      if (hasSelections) {
        result = result.filter(emp => {
          const val = emp.dynamicData?.[selectedFieldKey];
          if (val === undefined || val === null) return false;
          const strVal = String(val).trim();
          return filterValues[strVal];
        });
      }
    }

    return result;
  }, [availableEmployees, manualSearch, selectedGrouping, selectedFieldKey, filterValues, startDate, endDate, selectedCompanyId]);

  const handleToggleSelectAllFiltered = () => {
    if (filteredEmployees.length === 0) return;
    const allSelected = filteredEmployees.every(emp => selectedEmployeeIds[emp.id]);
    
    const nextIds = { ...selectedEmployeeIds };
    filteredEmployees.forEach(emp => {
      if (allSelected) {
        delete nextIds[emp.id];
      } else {
        nextIds[emp.id] = true;
      }
    });
    setSelectedEmployeeIds(nextIds);
  };

  const handleToggleEmployee = (id: string) => {
    setSelectedEmployeeIds(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const handleCreateNewClick = () => {
    setEditorMode('create');
    setSelectedCompanyId('');
    setCustomBatchNumber('');
    setEditingBatch(null);
    setSelectedEmployeeIds({});
    setView('editor');
  };

  const handleEditClick = (batch: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditorMode('edit');
    setEditingBatch(batch);
    setSelectedCompanyId(batch.companyId);
    setCustomBatchNumber(batch.batchNumber || '');
    setView('editor');
  };

  const handleDeleteClick = async (batchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Voulez-vous vraiment supprimer ce lot ? Les employés redeviendront non assignés.')) return;
    try {
      await deleteDeliveryBatch(batchId);
      setBatches(prev => prev.filter(b => b.id !== batchId));
      if (selectedBatchDetails?.id === batchId) setSelectedBatchDetails(null);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleSaveBatch = async () => {
    const employeeIds = Object.keys(selectedEmployeeIds).filter(id => selectedEmployeeIds[id]);
    if (employeeIds.length === 0) {
      alert('Veuillez sélectionner au moins un employé.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editorMode === 'create') {
        const newBatch = await createDeliveryBatch({
          companyId: selectedCompanyId,
          employeeIds
        });
        
        if (customBatchNumber.trim() && newBatch.batchNumber !== customBatchNumber.trim()) {
           await updateDeliveryBatch(newBatch.id, customBatchNumber.trim(), employeeIds);
        }
      } else if (editorMode === 'edit' && editingBatch) {
        await updateDeliveryBatch(
          editingBatch.id, 
          customBatchNumber.trim() || editingBatch.batchNumber, 
          employeeIds
        );
      }
      
      window.location.reload();
    } catch (error: any) {
      alert(error.message);
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (batchId: string, newStatus: string) => {
    const confirmMsg = newStatus === 'EN_TRANSIT' 
      ? 'Voulez-vous marquer ce lot comme Expédié ?'
      : 'Voulez-vous marquer ce lot comme Réceptionné / Livré ?';
    if (!confirm(confirmMsg)) return;

    try {
      await updateBatchStatus(batchId, newStatus);
      setBatches(prev => prev.map(b => b.id === batchId ? { ...b, status: newStatus } : b));
      if (selectedBatchDetails && selectedBatchDetails.id === batchId) {
        setSelectedBatchDetails((prev: any) => ({ ...prev, status: newStatus }));
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleViewDetails = async (batch: any) => {
    setSelectedBatchDetails(batch);
    setLoadingBatchEmployees(true);
    try {
      const emps = await getBatchEmployees(batch.id);
      setBatchEmployees(emps);
    } catch (err) {
      console.error("Failed to load batch employees:", err);
      alert("Impossible de charger les employés de ce lot.");
    } finally {
      setLoadingBatchEmployees(false);
    }
  };

  const handlePrintSlip = (batch: any, employees: any[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Bon de Livraison - ${batch.batchNumber || 'LOT'}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; color: #1f2937; padding: 40px; margin: 0; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 22px; font-weight: 800; color: #4f46e5; letter-spacing: -0.025em; }
            .title { font-size: 24px; font-weight: 700; text-align: right; }
            .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .details-box { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
            .details-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }
            .details-value { font-size: 14px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th { background-color: #f3f4f6; color: #374151; font-weight: 700; font-size: 11px; text-transform: uppercase; padding: 10px 14px; text-align: left; border-bottom: 2px solid #e5e7eb; }
            td { padding: 12px 14px; font-size: 13px; border-bottom: 1px solid #e5e7eb; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; page-break-inside: avoid; }
            .signature-box { border: 1px dashed #d1d5db; border-radius: 12px; padding: 24px; height: 120px; display: flex; flex-direction: column; justify-content: space-between; }
            .signature-title { font-size: 12px; font-weight: 700; color: #4b5563; }
            @media print { body { padding: 20px; } button { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">Imprimerie Nationale</div>
              <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0 0;">Plateforme de gestion de cartes</p>
            </div>
            <div>
              <div class="title">BON DE LIVRAISON</div>
              <p style="font-size: 13px; font-family: monospace; color: #4b5563; margin: 4px 0 0 0; text-align: right;">${batch.batchNumber || 'N/A'}</p>
            </div>
          </div>
          <div class="details">
            <div class="details-box">
              <div class="details-title">Expéditeur</div>
              <div class="details-value" style="font-weight: 700;">Imprimerie Nationale</div>
              <p style="font-size: 12px; color: #4b5563; margin: 4px 0 0 0;">Service Production & Expéditions</p>
            </div>
            <div class="details-box">
              <div class="details-title">Destinataire (Entreprise)</div>
              <div class="details-value" style="font-weight: 700;">${batch.company?.name || 'N/A'}</div>
              <p style="font-size: 12px; color: #4b5563; margin: 4px 0 0 0;">Lots de badges imprimés</p>
            </div>
          </div>
          <div class="details-box" style="margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div class="details-title">Informations de livraison</div>
              <span style="font-size: 13px; font-weight: 600;">Statut actuel : </span>
              <span style="font-size: 13px; font-weight: 700; color: #4f46e5;">${batch.status === 'PREPARE' ? 'Préparé' : batch.status === 'EN_TRANSIT' ? 'En Transit' : 'Livré'}</span>
            </div>
            <div style="text-align: right;">
              <div class="details-title">Date d'édition</div>
              <div class="details-value">${new Date().toLocaleDateString('fr-FR')}</div>
            </div>
            <div style="text-align: right;">
              <div class="details-title">Nombre de badges</div>
              <div class="details-value" style="font-size: 18px; font-weight: 800; color: #4f46e5;">${employees.length}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th>Nom Complet</th>
                <th>Identifiant Unique (Matricule)</th>
                <th>Numéro d'enrôlement</th>
                <th>Date d'impression</th>
              </tr>
            </thead>
            <tbody>
              ${employees.map((emp, idx) => {
                const data = emp.dynamicData || {};
                const name = `${data.Prenom || data.prenom || ''} ${data.Nom || data.nom || ''}`.trim() || emp.uniqueIdentifier;
                const printDate = emp.printedAt ? new Date(emp.printedAt).toLocaleDateString('fr-FR') : 'N/A';
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td style="font-weight: 600;">${name}</td>
                    <td style="font-family: monospace;">${emp.uniqueIdentifier}</td>
                    <td style="font-family: monospace; font-weight: 600;">${emp.enrollmentNumber || 'Non généré'}</td>
                    <td>${printDate}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div class="signatures">
            <div class="signature-box">
              <div class="signature-title">Signature Expéditeur (Imprimerie)</div>
              <div style="font-size: 10px; color: #9ca3af;">Date et signature</div>
            </div>
            <div class="signature-box">
              <div class="signature-title">Signature Destinataire (Client)</div>
              <div style="font-size: 10px; color: #9ca3af;">Date, nom et signature du réceptionnaire</div>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'PREPARE': return <span className="px-2.5 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-[10px] font-bold uppercase tracking-wider">Préparé</span>;
      case 'EN_TRANSIT': return <span className="px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-[10px] font-bold uppercase tracking-wider">En Transit</span>;
      case 'LIVRE': return <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-bold uppercase tracking-wider">Livré</span>;
      default: return null;
    }
  };

  const downloadSignedProof = (batch: any) => {
    if (!batch.signedProof) return;
    const link = document.createElement('a');
    link.href = batch.signedProof;
    link.download = batch.signedProofName || `preuve-livraison-${batch.batchNumber || batch.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadProof = async (batchId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Le fichier est trop volumineux (maximum 5 Mo).");
      return;
    }

    setUploadingBatchId(batchId);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Content = e.target?.result as string;
      if (!base64Content) {
        setUploadingBatchId(null);
        return;
      }

      try {
        await uploadDeliveryBatchProof(batchId, base64Content, file.name, file.type);
        setBatches(prev => prev.map(b => 
          b.id === batchId 
            ? { ...b, signedProof: base64Content, signedProofName: file.name, signedProofType: file.type }
            : b
        ));
      } catch (err: any) {
        alert(err.message || "Erreur lors du chargement de la preuve.");
      } finally {
        setUploadingBatchId(null);
      }
    };
    reader.onerror = () => {
      alert("Erreur lors de la lecture du fichier.");
      setUploadingBatchId(null);
    };
    reader.readAsDataURL(file);
  };

  const filteredBatches = batches.filter(b => 
    b.batchNumber?.toLowerCase().includes(search.toLowerCase()) ||
    b.company?.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (dbError) {
    return (
      <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl border border-red-200">
        <p>Erreur de connexion à la base de données. Impossible de charger les lots d'expédition.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {view === 'list' ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 dark:bg-neutral-900 text-indigo-500 rounded-xl border border-indigo-100 dark:border-neutral-800 shadow-sm">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-neutral-800 dark:text-white">Lots d&apos;expédition</h1>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  Gérez les colis de badges imprimés, organisez-les en lots de livraison et suivez leur expédition.
                </p>
              </div>
            </div>

            <button
              onClick={handleCreateNewClick}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition shadow-sm cursor-pointer"
            >
              <Package className="w-4 h-4" />
              <span>Créer un Lot</span>
            </button>
          </div>

          <div className="flex bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Rechercher par n° de lot ou entreprise..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-sm rounded-xl outline-none transition-all focus:ring-2 focus:ring-indigo-500/25 placeholder-neutral-400 text-neutral-800 dark:text-neutral-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBatches.length === 0 ? (
              <div className="col-span-full py-16 text-center flex flex-col items-center bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                <Package className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mb-3" />
                <h3 className="text-neutral-700 dark:text-neutral-300 font-semibold">Aucun lot trouvé</h3>
                <p className="text-neutral-500 text-xs mt-1">Créez votre premier lot de livraison pour expédier vos badges.</p>
              </div>
            ) : (
              filteredBatches.map(batch => (
                <div key={batch.id} className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="font-mono text-xs font-bold bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1.5 rounded text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800">
                        {batch.batchNumber || 'LOT-INCONNU'}
                      </span>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(batch.status)}
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => handleEditClick(batch, e)} className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="Modifier">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={(e) => handleDeleteClick(batch.id, e)} className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Supprimer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2.5 text-neutral-800 dark:text-neutral-200 font-bold">
                      <Building2 className="w-4 h-4 text-indigo-500" />
                      <span>{batch.company?.name || 'Entreprise inconnue'}</span>
                    </div>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-4 flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      Créé le {new Date(batch.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                    <div className="p-4.5 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Cartes incluses</p>
                      <p className="text-2xl font-bold text-neutral-800 dark:text-neutral-200 mt-1">
                        {batch._count?.employees || 0}
                      </p>
                    </div>

                    <div className="mt-4 p-4.5 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 flex flex-col gap-2">
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Preuve de livraison</p>
                      {uploadingBatchId === batch.id ? (
                        <div className="flex items-center gap-2 py-1">
                          <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                          <span className="text-[10px] text-neutral-500">Chargement...</span>
                        </div>
                      ) : batch.signedProof ? (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium truncate max-w-[150px]" title={batch.signedProofName || 'Preuve.bin'}>
                            {batch.signedProofName || 'Preuve signée'}
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => downloadSignedProof(batch)}
                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 bg-indigo-50 dark:bg-indigo-950/20 rounded border border-indigo-200/25 cursor-pointer"
                            >
                              Télécharger
                            </button>
                            <label className="text-[10px] font-bold text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700 cursor-pointer">
                              <span>Modifier</span>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => handleUploadProof(batch.id, e)}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-neutral-400 italic">Aucune preuve fournie</span>
                          <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 px-2 py-1 bg-indigo-50 dark:bg-indigo-950/20 rounded border border-indigo-200/25 cursor-pointer flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            <span>Charger</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={(e) => handleUploadProof(batch.id, e)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex gap-2">
                    {batch.status === 'PREPARE' && (
                      <button onClick={() => handleUpdateStatus(batch.id, 'EN_TRANSIT')} className="flex-1 flex justify-center items-center gap-1.5 py-2.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition border border-blue-200/50 cursor-pointer">
                        <Truck className="w-3.5 h-3.5" /> Expédier
                      </button>
                    )}
                    {batch.status === 'EN_TRANSIT' && (
                      <button onClick={() => handleUpdateStatus(batch.id, 'LIVRE')} className="flex-1 flex justify-center items-center gap-1.5 py-2.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition border border-emerald-200/50 cursor-pointer">
                        <CheckCircle className="w-3.5 h-3.5" /> Réceptionné
                      </button>
                    )}
                    <button 
                      onClick={() => handleViewDetails(batch)}
                      className="flex-1 flex justify-center items-center gap-1.5 py-2.5 text-xs font-bold text-neutral-600 bg-neutral-50 hover:bg-neutral-100 rounded-xl transition border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 cursor-pointer"
                    >
                      Détails <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* EDITOR VIEW (Creation / Modification) */
        <div className="flex flex-col h-[calc(100vh-140px)] bg-neutral-100 dark:bg-neutral-950 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm animate-in fade-in duration-300">
          
          <div className="flex justify-between items-center px-6 py-4 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-4">
              <button onClick={() => setView('list')} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition text-neutral-500">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-neutral-800 dark:text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-500" />
                  {editorMode === 'create' ? 'Créer un lot d\'expédition' : 'Modifier le lot d\'expédition'}
                </h2>
                {editorMode === 'edit' && editingBatch && (
                  <p className="text-xs text-neutral-500 font-mono mt-0.5">{editingBatch.batchNumber}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {Object.values(selectedEmployeeIds).filter(Boolean).length}
                </span>
                <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Sélectionnés</span>
              </div>
              <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800 mx-2" />
              <button
                onClick={() => setView('list')}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 rounded-xl transition"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveBatch}
                disabled={isSubmitting || Object.values(selectedEmployeeIds).filter(Boolean).length === 0}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editorMode === 'create' ? 'Créer le lot' : 'Enregistrer'}
              </button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* LEFT SIDEBAR : FILTERS */}
            <div className="w-80 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col overflow-y-auto">
              <div className="p-5 space-y-6">
                
                {/* Company Selection */}
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                    Entreprise
                  </label>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    disabled={editorMode === 'edit'}
                    className="w-full px-3 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-xl text-sm outline-none disabled:opacity-60"
                  >
                    <option value="">Sélectionnez...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {selectedCompanyId && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                        Numéro de lot
                      </label>
                      <input
                        type="text"
                        placeholder="Automatique si vide"
                        value={customBatchNumber}
                        onChange={(e) => setCustomBatchNumber(e.target.value)}
                        className="w-full px-3 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-xl text-sm outline-none"
                      />
                    </div>

                    <div className="h-px bg-neutral-200 dark:bg-neutral-800 my-2" />

                    <div>
                      <label className="flex items-center gap-2 text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
                        <Filter className="w-4 h-4" /> Filtres & Recherches
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {[
                          { id: 'manual', label: 'Recherche' },
                          { id: 'structure', label: 'Structure' },
                          { id: 'campagne', label: 'Campagne' },
                          { id: 'type', label: 'Type' },
                          { id: 'site', label: 'Site' },
                          { id: 'periode', label: 'Période' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedGrouping(t.id as GroupingType)}
                            className={`px-3 py-1.5 border rounded-lg text-[11px] font-bold transition ${
                              selectedGrouping === t.id
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-900 dark:text-indigo-400'
                                : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-800 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {/* Filter Details */}
                      <div className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
                        {selectedGrouping === 'manual' && (
                          <div>
                            <input
                              type="text"
                              placeholder="Nom, matricule..."
                              value={manualSearch}
                              onChange={(e) => { setManualSearch(e.target.value); setWizardPage(1); }}
                              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-lg text-xs outline-none"
                            />
                          </div>
                        )}

                        {(selectedGrouping === 'structure' || selectedGrouping === 'campagne' || selectedGrouping === 'site' || selectedGrouping === 'type') && (() => {
                          const categoryFields = analyzedFields[selectedGrouping];
                          if (categoryFields.length === 0) {
                            return <p className="text-xs text-neutral-500 italic text-center py-2">Aucune donnée trouvée.</p>;
                          }
                          const currentField = categoryFields.find(f => f.fieldKey === selectedFieldKey) || categoryFields[0];
                          
                          return (
                            <div className="space-y-3">
                              {categoryFields.length > 1 && (
                                <select
                                  value={selectedFieldKey}
                                  onChange={(e) => { setSelectedFieldKey(e.target.value); setFilterValues({}); }}
                                  className="w-full px-2 py-1.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-lg text-xs"
                                >
                                  {categoryFields.map(f => <option key={f.fieldKey} value={f.fieldKey}>{f.displayName}</option>)}
                                </select>
                              )}
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase">Valeurs</span>
                                <button
                                  onClick={() => {
                                    const allSelected = currentField.uniqueValues.every(uv => filterValues[uv.value]);
                                    const nextVals = { ...filterValues };
                                    currentField.uniqueValues.forEach(uv => nextVals[uv.value] = !allSelected);
                                    setFilterValues(nextVals);
                                  }}
                                  className="text-[10px] font-bold text-indigo-600 hover:underline"
                                >
                                  {currentField.uniqueValues.every(uv => filterValues[uv.value]) ? 'Tout décocher' : 'Tout cocher'}
                                </button>
                              </div>
                              <div className="max-h-48 overflow-y-auto space-y-1">
                                {currentField.uniqueValues.map(uv => (
                                  <label key={uv.value} className="flex items-center gap-2 p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer text-xs">
                                    <input 
                                      type="checkbox" 
                                      checked={!!filterValues[uv.value]}
                                      onChange={() => setFilterValues(prev => ({ ...prev, [uv.value]: !prev[uv.value] }))}
                                      className="rounded border-neutral-300"
                                    />
                                    <span className="flex-1 truncate">{uv.value}</span>
                                    <span className="text-[10px] text-neutral-400">({uv.count})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {selectedGrouping === 'periode' && (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Du</label>
                              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-2 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Au</label>
                              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-2 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT SIDE : TABLE */}
            <div className="flex-1 bg-neutral-50 dark:bg-neutral-950 overflow-hidden flex flex-col p-6">
              {!selectedCompanyId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-neutral-400">
                  <Building2 className="w-12 h-12 mb-4 opacity-20" />
                  <p>Sélectionnez une entreprise pour commencer.</p>
                </div>
              ) : loadingEmployees ? (
                <div className="flex-1 flex flex-col items-center justify-center text-indigo-500 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-xs font-semibold">Chargement des badges disponibles...</p>
                </div>
              ) : (
                <div className="flex flex-col h-full bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800">
                    <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      Résultats du filtre ({filteredEmployees.length} badges)
                    </span>
                    <button
                      onClick={handleToggleSelectAllFiltered}
                      className="px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold text-neutral-700 dark:text-neutral-300 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 transition"
                    >
                      {filteredEmployees.length > 0 && filteredEmployees.every(emp => selectedEmployeeIds[emp.id]) 
                        ? 'Tout désélectionner' 
                        : 'Tout sélectionner'
                      }
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 z-10">
                        <tr className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          <th className="py-3 px-4 w-12 text-center">
                            <button type="button" onClick={handleToggleSelectAllFiltered} className="text-neutral-400 hover:text-indigo-500">
                              {filteredEmployees.length > 0 && filteredEmployees.every(emp => selectedEmployeeIds[emp.id]) ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4" />}
                            </button>
                          </th>
                          <th className="py-3 px-3">Employé</th>
                          <th className="py-3 px-3">Identifiant</th>
                          <th className="py-3 px-3 text-right">Impression</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                        {filteredEmployees.length === 0 ? (
                          <tr><td colSpan={4} className="py-12 text-center text-neutral-400 text-sm">Aucun badge ne correspond aux filtres.</td></tr>
                        ) : (
                          filteredEmployees
                            .slice((wizardPage - 1) * wizardPageSize, wizardPage * wizardPageSize)
                            .map(emp => {
                              const isSelected = !!selectedEmployeeIds[emp.id];
                              return (
                                <tr 
                                  key={emp.id} 
                                  onClick={() => handleToggleEmployee(emp.id)}
                                  className={`hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors cursor-pointer text-xs ${isSelected ? 'bg-indigo-50/30 dark:bg-indigo-900/10 font-medium' : ''}`}
                                >
                                  <td className="py-2.5 px-4 text-center">
                                    <button type="button" className="text-neutral-400">
                                      {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4" />}
                                    </button>
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-neutral-800 dark:text-neutral-200">
                                    {getEmployeeName(emp)}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-neutral-500">
                                    {emp.uniqueIdentifier}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-neutral-400">
                                    {emp.printedAt ? new Date(emp.printedAt).toLocaleDateString('fr-FR') : '-'}
                                  </td>
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {filteredEmployees.length > wizardPageSize && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase">Page {wizardPage} / {Math.ceil(filteredEmployees.length / wizardPageSize)}</span>
                      <div className="flex gap-1.5">
                        <button disabled={wizardPage === 1} onClick={() => setWizardPage(prev => prev - 1)} className="p-1.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                        <button disabled={wizardPage >= Math.ceil(filteredEmployees.length / wizardPageSize)} onClick={() => setWizardPage(prev => prev + 1)} className="p-1.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW BATCH DETAILS MODAL (Read Only) */}
      {selectedBatchDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 w-full max-w-3xl p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-start pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-neutral-800 dark:text-white font-mono">{selectedBatchDetails.batchNumber}</h3>
                  {getStatusBadge(selectedBatchDetails.status)}
                </div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 flex items-center gap-3">
                  <span>Client : <strong>{selectedBatchDetails.company?.name}</strong></span>
                  <span>•</span>
                  <span>Créé le : {new Date(selectedBatchDetails.createdAt).toLocaleDateString('fr-FR')}</span>
                </p>
              </div>
              <button onClick={() => setSelectedBatchDetails(null)} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-5">
              {loadingBatchEmployees ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <p className="text-xs text-neutral-500">Chargement de la liste des badges...</p>
                </div>
              ) : batchEmployees.length === 0 ? (
                <div className="text-center py-16 text-neutral-400">Aucun badge trouvé dans ce lot.</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-900 px-4 py-3 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Liste des badges ({batchEmployees.length})</span>
                    <button onClick={() => handlePrintSlip(selectedBatchDetails, batchEmployees)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-50 border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 text-xs font-bold rounded-lg shadow-sm">
                      <Printer className="w-4 h-4 text-indigo-500" />
                      <span>Imprimer Bon de Livraison</span>
                    </button>
                  </div>
                  <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4 w-12">Photo</th>
                          <th className="py-2.5 px-3">Nom</th>
                          <th className="py-2.5 px-3">Matricule</th>
                          <th className="py-2.5 px-3">Enrôlement</th>
                          <th className="py-2.5 px-3 text-right">Impression</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850">
                        {batchEmployees.map(emp => (
                          <tr key={emp.id} className="text-xs hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10">
                            <td className="py-2.5 px-4">
                              <div className="w-8 h-8 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center overflow-hidden">
                                {emp.photoUrl ? <img src={emp.photoUrl} alt="" className="w-full h-full object-contain" /> : <User className="w-3.5 h-3.5 text-neutral-400" />}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-semibold">{getEmployeeName(emp)}</td>
                            <td className="py-2.5 px-3 font-mono text-neutral-500">{emp.uniqueIdentifier}</td>
                            <td className="py-2.5 px-3 font-mono font-bold">{emp.enrollmentNumber || '-'}</td>
                            <td className="py-2.5 px-3 text-right text-neutral-400">{emp.printedAt ? new Date(emp.printedAt).toLocaleDateString('fr-FR') : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
              <button onClick={() => setSelectedBatchDetails(null)} className="px-4 py-2 text-xs font-bold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-neutral-500">Fermer</button>
              {selectedBatchDetails.status === 'PREPARE' && (
                <button onClick={() => handleUpdateStatus(selectedBatchDetails.id, 'EN_TRANSIT')} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl"><Truck className="w-4 h-4" /><span>Expédier</span></button>
              )}
              {selectedBatchDetails.status === 'EN_TRANSIT' && (
                <button onClick={() => handleUpdateStatus(selectedBatchDetails.id, 'LIVRE')} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"><CheckCircle className="w-4 h-4" /><span>Livré</span></button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
