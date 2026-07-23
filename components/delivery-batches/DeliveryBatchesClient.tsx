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
  Upload,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
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
  initialCardCategories: { id: string; name: string; slug: string; companyId: string | null }[];
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

export default function DeliveryBatchesClient({ initialCompanies, initialBatches, initialCardCategories, dbError }: DeliveryBatchesClientProps) {
  const [batches, setBatches] = useState<any[]>(initialBatches);
  const [companies] = useState<any[]>(initialCompanies);
  const [cardCategories] = useState(initialCardCategories);
  const [search, setSearch] = useState('');
  const [filterCompanyId, setFilterCompanyId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCardType, setFilterCardType] = useState('');
  
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

  // Card Type filter for editor & details
  const [selectedCardType, setSelectedCardType] = useState('');
  const [detailsCardType, setDetailsCardType] = useState('');

  // Sorting States
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [detailsSortField, setDetailsSortField] = useState<string>('name');
  const [detailsSortDirection, setDetailsSortDirection] = useState<'asc' | 'desc'>('asc');

  // PDF column visibility preferences
  const [pdfFields, setPdfFields] = useState<Record<string, boolean>>({
    name: true,
    identifier: true,
    cardType: true,
    cardNumber: true,
    enrollmentNumber: true,
    printedAt: true,
  });
  const [pdfFieldsOrder, setPdfFieldsOrder] = useState<string[]>(['name', 'identifier', 'cardType', 'cardNumber', 'enrollmentNumber', 'printedAt']);

  // Load from localStorage on client side
  useEffect(() => {
    try {
      const saved = localStorage.getItem('inci-cache:delivery-batch-pdf-fields');
      if (saved) {
        setPdfFields(JSON.parse(saved));
      }
      const savedOrder = localStorage.getItem('inci-cache:delivery-batch-pdf-fields-order');
      if (savedOrder) {
        setPdfFieldsOrder(JSON.parse(savedOrder));
      }
    } catch (e) {
      console.warn("Failed to load pdf fields:", e);
    }
  }, []);

  const handlePdfFieldChange = (field: string, checked: boolean) => {
    const updated = { ...pdfFields, [field]: checked };
    setPdfFields(updated);

    // Track selection order
    const newOrder = checked
      ? [...pdfFieldsOrder.filter(f => f !== field), field]  // add to end if not already present
      : pdfFieldsOrder.filter(f => f !== field);             // remove if unchecked
    setPdfFieldsOrder(newOrder);

    try {
      localStorage.setItem('inci-cache:delivery-batch-pdf-fields', JSON.stringify(updated));
      localStorage.setItem('inci-cache:delivery-batch-pdf-fields-order', JSON.stringify(newOrder));
    } catch (e) {
      console.warn("Failed to save pdf fields:", e);
    }
  };

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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDetailsSort = (field: string) => {
    if (detailsSortField === field) {
      setDetailsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setDetailsSortField(field);
      setDetailsSortDirection('asc');
    }
  };

  // Case-insensitive lookup in dynamicData (handles NOM/Nom/nom, PRENOMS/Prenom/prenom, etc.)
  const getDynField = (data: Record<string, any>, ...keys: string[]): string => {
    if (!data || typeof data !== 'object') return '';
    const dataLower = Object.fromEntries(Object.entries(data).map(([k, v]) => [k.toLowerCase(), v]));
    for (const key of keys) {
      const val = dataLower[key.toLowerCase()];
      if (val !== undefined && val !== null && val !== '') return String(val);
    }
    return '';
  };

  const getEmployeeName = (emp: any): string => {
    const data = emp.dynamicData as Record<string, any>;
    const p = getDynField(data, 'prenom', 'prenoms', 'prénom', 'prénoms');
    const n = getDynField(data, 'nom');
    return `${p} ${n}`.trim() || emp.uniqueIdentifier;
  };

  // Sort key: Nom first, then Prenom — ensures alphabetical sort is by family name
  const getEmployeeSortKey = (emp: any): string => {
    const data = emp.dynamicData as Record<string, any>;
    const n = getDynField(data, 'nom');
    const p = getDynField(data, 'prenom', 'prenoms', 'prénom', 'prénoms');
    return `${n} ${p}`.trim() || emp.uniqueIdentifier;
  };

  const cardTypes = useMemo(() => {
    const types = new Set<string>();
    availableEmployees.forEach(emp => {
      emp.printJobs?.forEach((job: any) => {
        if (job.templateType && job.cardNumber !== 'REIMPRESSION_DEMANDEE') {
          types.add(job.templateType);
        }
      });
    });
    return Array.from(types);
  }, [availableEmployees]);

  const dynamicKeys = useMemo(() => {
    const excludeKeys = ['id', 'photo', 'photourl', 'status', 'printedat', 'createdat', 'updatedat', 'cardnumber', 'enrollmentnumber'];
    const keys = new Set<string>();
    
    // Extract from available employees
    availableEmployees.forEach(emp => {
      if (emp.dynamicData && typeof emp.dynamicData === 'object') {
        Object.keys(emp.dynamicData).forEach(k => {
          if (!k.startsWith('_') && !excludeKeys.includes(k.toLowerCase())) {
            keys.add(k);
          }
        });
      }
    });

    // Extract from selected batch details employees
    batchEmployees.forEach(emp => {
      if (emp.dynamicData && typeof emp.dynamicData === 'object') {
        Object.keys(emp.dynamicData).forEach(k => {
          if (!k.startsWith('_') && !excludeKeys.includes(k.toLowerCase())) {
            keys.add(k);
          }
        });
      }
    });

    return Array.from(keys);
  }, [availableEmployees, batchEmployees]);

  const filteredEmployees = useMemo(() => {
    if (!selectedCompanyId || availableEmployees.length === 0) return [];

    let result = availableEmployees;

    // Filter by Card Type (templateType)
    if (selectedCardType) {
      result = result.filter(emp => 
        emp.printJobs?.some((j: any) => j.templateType === selectedCardType)
      );
    }

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

    // Apply Sorting
    if (sortField) {
      result = [...result].sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (sortField === 'name') {
          valA = getEmployeeSortKey(a);
          valB = getEmployeeSortKey(b);
        } else if (sortField === 'identifier') {
          valA = a.uniqueIdentifier || '';
          valB = b.uniqueIdentifier || '';
        } else if (sortField === 'printedAt') {
          valA = a.printedAt ? new Date(a.printedAt).getTime() : 0;
          valB = b.printedAt ? new Date(b.printedAt).getTime() : 0;
        } else {
          // Dynamic field: case-insensitive key lookup
          const dataA = a.dynamicData as Record<string, any>;
          const dataB = b.dynamicData as Record<string, any>;
          valA = getDynField(dataA, sortField) || '';
          valB = getDynField(dataB, sortField) || '';
        }

        const normalize = (v: any) => typeof v === 'string' ? v.trim() : v;
        valA = normalize(valA);
        valB = normalize(valB);

        if (typeof valA === 'string') {
          return sortDirection === 'asc'
            ? valA.localeCompare(String(valB), 'fr', { numeric: true, sensitivity: 'base' })
            : String(valB).localeCompare(valA, 'fr', { numeric: true, sensitivity: 'base' });
        } else {
          return sortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1);
        }
      });
    }

    return result;
  }, [availableEmployees, manualSearch, selectedGrouping, selectedFieldKey, filterValues, startDate, endDate, selectedCompanyId, selectedCardType, sortField, sortDirection]);

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

  const handlePrintSlip = (batch: any, employees: any[], filterCardType?: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let printedCards = employees.flatMap(emp => {
      const jobs = emp.printJobs || [];
      if (jobs.length === 0) {
        return [{
          name: getEmployeeName(emp),
          sortKey: getEmployeeSortKey(emp),
          uniqueIdentifier: emp.uniqueIdentifier,
          cardType: 'BADGE',
          cardNumber: emp.cardNumber || 'Non généré',
          enrollmentNumber: emp.enrollmentNumber || '-',
          printedAt: emp.printedAt ? new Date(emp.printedAt).toLocaleDateString('fr-FR') : 'N/A',
          dynamicData: emp.dynamicData || {},
        }];
      }
      const uniqueTypes = new Set<string>();
      const uniqueJobs: any[] = [];
      jobs.forEach((job: any) => {
        if (!uniqueTypes.has(job.templateType)) {
          uniqueTypes.add(job.templateType);
          uniqueJobs.push(job);
        }
      });
      return uniqueJobs.map(job => ({
        name: getEmployeeName(emp),
        sortKey: getEmployeeSortKey(emp),
        uniqueIdentifier: emp.uniqueIdentifier,
        cardType: job.templateType,
        cardNumber: job.cardNumber || emp.cardNumber || 'Non généré',
        enrollmentNumber: emp.enrollmentNumber || '-',
        printedAt: job.printedAt ? new Date(job.printedAt).toLocaleDateString('fr-FR') : (emp.printedAt ? new Date(emp.printedAt).toLocaleDateString('fr-FR') : 'N/A'),
        dynamicData: emp.dynamicData || {},
      }));
    });

    if (filterCardType) {
      printedCards = printedCards.filter(c => c.cardType === filterCardType);
    }

    if (detailsSortField) {
      printedCards = [...printedCards].sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (detailsSortField === 'name') {
          // Sort by family name (Nom) first using the sort key stored on the item
          valA = a.sortKey || a.name || '';
          valB = b.sortKey || b.name || '';
        } else if (detailsSortField === 'identifier') {
          valA = a.uniqueIdentifier || '';
          valB = b.uniqueIdentifier || '';
        } else if (detailsSortField === 'cardType') {
          valA = a.cardType || '';
          valB = b.cardType || '';
        } else if (detailsSortField === 'cardNumber') {
          valA = a.cardNumber || '';
          valB = b.cardNumber || '';
        } else if (detailsSortField === 'enrollmentNumber') {
          valA = a.enrollmentNumber || '';
          valB = b.enrollmentNumber || '';
        } else if (detailsSortField === 'printedAt') {
          valA = a.printedAt ? new Date(a.printedAt).getTime() : 0;
          valB = b.printedAt ? new Date(b.printedAt).getTime() : 0;
        } else {
          // Dynamic Excel field: case-insensitive key lookup
          valA = getDynField(a.dynamicData as Record<string, any>, detailsSortField);
          valB = getDynField(b.dynamicData as Record<string, any>, detailsSortField);
        }

        const normalize = (v: any) => typeof v === 'string' ? v.trim() : v;
        valA = normalize(valA);
        valB = normalize(valB);

        if (typeof valA === 'string') {
          return detailsSortDirection === 'asc'
            ? valA.localeCompare(String(valB), 'fr', { numeric: true, sensitivity: 'base' })
            : String(valB).localeCompare(valA, 'fr', { numeric: true, sensitivity: 'base' });
        } else {
          return detailsSortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1);
        }
      });
    }

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
              <div class="details-title">Nombre de cartes</div>
              <div class="details-value" style="font-size: 18px; font-weight: 800; color: #4f46e5;">${printedCards.length}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                ${pdfFields.name ? '<th>Nom Complet</th>' : ''}
                ${pdfFields.identifier ? '<th>Matricule</th>' : ''}
                ${pdfFields.cardType ? '<th>Type de carte</th>' : ''}
                ${pdfFields.cardNumber ? '<th>N° de carte</th>' : ''}
                ${pdfFields.enrollmentNumber ? "<th>N° d'enrôlement</th>" : ''}
                ${pdfFields.printedAt ? "<th>Date d'impression</th>" : ''}
                ${dynamicKeys.map(k => pdfFields[k] ? `<th>${k}</th>` : '').join('')}
              </tr>
            </thead>
            <tbody>
              ${printedCards.map((card, idx) => {
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    ${pdfFields.name ? `<td style="font-weight: 600;">${card.name}</td>` : ''}
                    ${pdfFields.identifier ? `<td style="font-family: monospace;">${card.uniqueIdentifier}</td>` : ''}
                    ${pdfFields.cardType ? `<td><span style="background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">${card.cardType}</span></td>` : ''}
                    ${pdfFields.cardNumber ? `<td style="font-family: monospace; font-weight: 600;">${card.cardNumber}</td>` : ''}
                    ${pdfFields.enrollmentNumber ? `<td>${card.enrollmentNumber}</td>` : ''}
                    ${pdfFields.printedAt ? `<td>${card.printedAt}</td>` : ''}
                    ${dynamicKeys.map(k => pdfFields[k] ? `<td>${(card.dynamicData as any)?.[k] || '-'}</td>` : '').join('')}
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

  // Options for the list filters
  const batchCompanies = useMemo(() => {
    const seen = new Map<string, string>();
    batches.forEach(b => {
      if (b.companyId && b.company?.name) seen.set(b.companyId, b.company.name);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [batches]);

  // Card categories filtered by selected company (or all if no company selected)
  const filteredCardCategories = useMemo(() => {
    if (filterCompanyId) {
      return cardCategories.filter(c => c.companyId === filterCompanyId || c.companyId === null);
    }
    return cardCategories;
  }, [cardCategories, filterCompanyId]);

  const filteredBatches = batches.filter(b => {
    if (filterCompanyId && b.companyId !== filterCompanyId) return false;
    if (filterStatus && b.status !== filterStatus) return false;
    if (filterCardType) {
      // filterCardType is a category slug; check if the batch company has this category
      const batchCompanyId = b.companyId;
      const hasCategory = cardCategories.some(c => c.slug === filterCardType && (c.companyId === batchCompanyId || c.companyId === null));
      if (!hasCategory) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!b.batchNumber?.toLowerCase().includes(q) && !b.company?.name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const activeFilterCount = [filterCompanyId, filterStatus, filterCardType, search.trim()].filter(Boolean).length;

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

          {/* Filter bar */}
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">

              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Rechercher un lot..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/25 placeholder-neutral-400 text-neutral-800 dark:text-neutral-200"
                />
              </div>

              {/* Company filter */}
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                <select
                  value={filterCompanyId}
                  onChange={e => setFilterCompanyId(e.target.value)}
                  className={`pl-8 pr-8 py-2 border rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/25 bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 transition appearance-none cursor-pointer ${
                    filterCompanyId ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300' : 'border-neutral-200'
                  }`}
                >
                  <option value="">Toutes les entreprises</option>
                  {batchCompanies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Card type select */}
              {filteredCardCategories.length > 0 && (
                <div className="relative">
                  <Printer className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                  <select
                    value={filterCardType}
                    onChange={e => setFilterCardType(e.target.value)}
                    className={`pl-8 pr-8 py-2 border rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-violet-500/25 bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 transition appearance-none cursor-pointer ${
                      filterCardType ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300' : 'border-neutral-200'
                    }`}
                  >
                    <option value="">Tous les types de carte</option>
                    {filteredCardCategories.map(c => (
                      <option key={c.id} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status pills */}
              <div className="flex items-center gap-1.5">
                {[{ value: '', label: 'Tous', color: 'neutral' }, { value: 'PREPARE', label: 'Préparé', color: 'amber' }, { value: 'EN_TRANSIT', label: 'En Transit', color: 'blue' }, { value: 'LIVRE', label: 'Livré', color: 'emerald' }].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFilterStatus(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      filterStatus === opt.value
                        ? opt.color === 'amber' ? 'bg-amber-500 text-white border-amber-500'
                          : opt.color === 'blue' ? 'bg-blue-500 text-white border-blue-500'
                          : opt.color === 'emerald' ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>


              {/* Clear filters */}
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setFilterCompanyId(''); setFilterStatus(''); setFilterCardType(''); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 transition"
                >
                  <X className="w-3.5 h-3.5" />
                  Effacer ({activeFilterCount})
                </button>
              )}

              {/* Result count */}
              <span className="ml-auto text-xs text-neutral-400 font-medium">
                {filteredBatches.length} lot{filteredBatches.length !== 1 ? 's' : ''} affiché{filteredBatches.length !== 1 ? 's' : ''}
              </span>
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
                    <div className="flex items-center gap-2 mb-2 text-neutral-800 dark:text-neutral-200 font-bold">
                      <Building2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <span>{batch.company?.name || 'Entreprise inconnue'}</span>
                    </div>
                    {/* Card category badges for this batch's company */}
                    {(() => {
                      const cats = cardCategories.filter(c => c.companyId === batch.companyId || c.companyId === null);
                      return cats.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {cats.map(c => (
                            <span key={c.id} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30">
                              {c.name}
                            </span>
                          ))}
                        </div>
                      ) : null;
                    })()}
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

                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                        Type de carte du lot
                      </label>
                      <select
                        value={selectedCardType}
                        onChange={(e) => {
                          setSelectedCardType(e.target.value);
                          setWizardPage(1);
                        }}
                        className="w-full px-3 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-xl text-sm outline-none"
                      >
                        <option value="">Tous les types</option>
                        {cardTypes.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                        Champs sur le PDF
                      </label>
                      <div className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3.5 max-h-60 overflow-y-auto">
                        <div className="space-y-2">
                          <span className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Champs standards</span>
                          {[
                            { id: 'name', label: 'Nom Complet' },
                            { id: 'identifier', label: 'Matricule' },
                            { id: 'cardType', label: 'Type de carte' },
                            { id: 'cardNumber', label: 'N° de carte' },
                            { id: 'enrollmentNumber', label: "N° d'enrôlement" },
                            { id: 'printedAt', label: "Date d'impression" },
                          ].map((f) => (
                            <label key={f.id} className="flex items-center gap-2.5 cursor-pointer text-xs select-none">
                              <input
                                type="checkbox"
                                checked={!!pdfFields[f.id]}
                                onChange={(e) => handlePdfFieldChange(f.id, e.target.checked)}
                                className="rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-neutral-700 dark:text-neutral-300 font-medium">{f.label}</span>
                            </label>
                          ))}
                        </div>

                        {dynamicKeys.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-700/60">
                            <span className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Champs dynamiques (Excel)</span>
                            {dynamicKeys.map((k) => (
                              <label key={k} className="flex items-center gap-2.5 cursor-pointer text-xs select-none">
                                <input
                                  type="checkbox"
                                  checked={!!pdfFields[k]}
                                  onChange={(e) => handlePdfFieldChange(k, e.target.checked)}
                                  className="rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-neutral-700 dark:text-neutral-300 font-medium">{k}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
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
                        <tr className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider select-none">
                          <th className="py-3 px-4 w-12 text-center">
                            <button type="button" onClick={handleToggleSelectAllFiltered} className="text-neutral-400 hover:text-indigo-500">
                              {filteredEmployees.length > 0 && filteredEmployees.every(emp => selectedEmployeeIds[emp.id]) ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4" />}
                            </button>
                          </th>
                          <th className="py-3 px-3 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition" onClick={() => handleSort('name')}>
                            <div className="flex items-center gap-1">
                              <span>Employé</span>
                              {sortField === 'name' ? (sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-500" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />) : <ArrowUpDown className="w-3 h-3 text-neutral-300 dark:text-neutral-600" />}
                            </div>
                          </th>
                          <th className="py-3 px-3 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition" onClick={() => handleSort('identifier')}>
                            <div className="flex items-center gap-1">
                              <span>Identifiant</span>
                              {sortField === 'identifier' ? (sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-500" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />) : <ArrowUpDown className="w-3 h-3 text-neutral-300 dark:text-neutral-600" />}
                            </div>
                          </th>
                          <th className="py-3 px-3 text-right cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition" onClick={() => handleSort('printedAt')}>
                            <div className="flex items-center justify-end gap-1">
                              <span>Impression</span>
                              {sortField === 'printedAt' ? (sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-500" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />) : <ArrowUpDown className="w-3 h-3 text-neutral-300 dark:text-neutral-600" />}
                            </div>
                          </th>
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
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 w-full max-w-6xl p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] h-full min-w-0 overflow-hidden">
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
            <div className="flex-1 overflow-y-auto py-5 max-w-full overflow-x-hidden min-w-0">
              {loadingBatchEmployees ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <p className="text-xs text-neutral-500">Chargement de la liste des badges...</p>
                </div>
              ) : batchEmployees.length === 0 ? (
                <div className="text-center py-16 text-neutral-400">Aucun badge trouvé dans ce lot.</div>
              ) : (
                <>
                  {(() => {
                    const detailsCardTypes = Array.from(new Set(batchEmployees.flatMap(emp => 
                      (emp.printJobs || []).filter((j: any) => j.cardNumber !== 'REIMPRESSION_DEMANDEE' && j.templateType !== 'DEBLOCAGE').map((j: any) => j.templateType)
                    )));

                    let printedCards = batchEmployees.flatMap(emp => {
                      const jobs = emp.printJobs || [];
                      if (jobs.length === 0) {
                        return [{
                          key: `${emp.id}_BADGE`,
                          emp,
                          name: getEmployeeName(emp),
                          sortKey: getEmployeeSortKey(emp),
                          uniqueIdentifier: emp.uniqueIdentifier,
                          enrollmentNumber: emp.enrollmentNumber || '-',
                          cardType: 'BADGE',
                          cardNumber: emp.cardNumber || '-',
                          printedAt: emp.printedAt,
                        }];
                      }
                      const uniqueTypes = new Set<string>();
                      const uniqueJobs: any[] = [];
                      jobs.forEach((job: any) => {
                        if (!uniqueTypes.has(job.templateType)) {
                          uniqueTypes.add(job.templateType);
                          uniqueJobs.push(job);
                        }
                      });
                      return uniqueJobs.map(job => ({
                        key: `${emp.id}_${job.templateType}`,
                        emp,
                        name: getEmployeeName(emp),
                        sortKey: getEmployeeSortKey(emp),
                        uniqueIdentifier: emp.uniqueIdentifier,
                        enrollmentNumber: emp.enrollmentNumber || '-',
                        cardType: job.templateType,
                        cardNumber: job.cardNumber || '-',
                        printedAt: job.printedAt || emp.printedAt,
                      }));
                    });

                    if (detailsCardType) {
                      printedCards = printedCards.filter(c => c.cardType === detailsCardType);
                    }

                    if (detailsSortField) {
                      printedCards = [...printedCards].sort((a, b) => {
                        let valA: any = '';
                        let valB: any = '';

                        if (detailsSortField === 'name') {
                          // Sort by family name (Nom) first
                          valA = a.sortKey || a.name || '';
                          valB = b.sortKey || b.name || '';
                        } else if (detailsSortField === 'identifier') {
                          valA = a.uniqueIdentifier || '';
                          valB = b.uniqueIdentifier || '';
                        } else if (detailsSortField === 'cardType') {
                          valA = a.cardType || '';
                          valB = b.cardType || '';
                        } else if (detailsSortField === 'cardNumber') {
                          valA = a.cardNumber || '';
                          valB = b.cardNumber || '';
                        } else if (detailsSortField === 'enrollmentNumber') {
                          valA = a.enrollmentNumber || '';
                          valB = b.enrollmentNumber || '';
                        } else if (detailsSortField === 'printedAt') {
                          valA = a.printedAt ? new Date(a.printedAt).getTime() : 0;
                          valB = b.printedAt ? new Date(b.printedAt).getTime() : 0;
                        } else {
                          // Dynamic Excel field: case-insensitive key lookup
                          valA = getDynField(a.emp?.dynamicData as Record<string, any>, detailsSortField);
                          valB = getDynField(b.emp?.dynamicData as Record<string, any>, detailsSortField);
                        }

                        const normalize = (v: any) => typeof v === 'string' ? v.trim() : v;
                        valA = normalize(valA);
                        valB = normalize(valB);

                        if (typeof valA === 'string') {
                          return detailsSortDirection === 'asc'
                            ? valA.localeCompare(String(valB), 'fr', { numeric: true, sensitivity: 'base' })
                            : String(valB).localeCompare(valA, 'fr', { numeric: true, sensitivity: 'base' });
                        } else {
                          return detailsSortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1);
                        }
                      });
                    }

                    return (
                      <div className="space-y-4 w-full max-w-full min-w-0">
                        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 overflow-hidden">

                          {/* Header bar */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-indigo-500" />
                                <span className="text-sm font-bold text-neutral-800 dark:text-white">Liste des cartes</span>
                                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold rounded-full">{printedCards.length}</span>
                              </div>
                              {detailsCardTypes.length > 1 && (
                                <select
                                  value={detailsCardType}
                                  onChange={(e) => setDetailsCardType(e.target.value)}
                                  className="px-2.5 py-1 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/30"
                                >
                                  <option value="">Tous les types</option>
                                  {detailsCardTypes.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <button onClick={() => handlePrintSlip(selectedBatchDetails, batchEmployees, detailsCardType)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors">
                              <Printer className="w-3.5 h-3.5" />
                              <span>Imprimer Bon de Livraison</span>
                            </button>
                          </div>

                          {/* PDF fields panel */}
                          <div className="px-5 py-4 space-y-4">

                            {/* Standard fields */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Champs standards</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const standardIds = ['name', 'identifier', 'cardType', 'cardNumber', 'enrollmentNumber', 'printedAt'];
                                    const allOn = standardIds.every(id => pdfFields[id]);
                                    const next = { ...pdfFields };
                                    standardIds.forEach(id => { next[id] = !allOn; });
                                    setPdfFields(next);
                                    try { localStorage.setItem('inci-cache:delivery-batch-pdf-fields', JSON.stringify(next)); } catch {}
                                  }}
                                  className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
                                >
                                  {['name', 'identifier', 'cardType', 'cardNumber', 'enrollmentNumber', 'printedAt'].every(id => pdfFields[id]) ? 'Tout désélectionner' : 'Tout sélectionner'}
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  { id: 'name', label: 'Nom Complet', icon: '👤' },
                                  { id: 'identifier', label: 'Matricule', icon: '#' },
                                  { id: 'cardType', label: 'Type de carte', icon: '🪪' },
                                  { id: 'cardNumber', label: 'N° de carte', icon: '💳' },
                                  { id: 'enrollmentNumber', label: "N° d'enrôlement", icon: '📋' },
                                  { id: 'printedAt', label: "Date d'impression", icon: '📅' },
                                ].map((f) => (
                                  <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => handlePdfFieldChange(f.id, !pdfFields[f.id])}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all select-none ${
                                      pdfFields[f.id]
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200 dark:shadow-indigo-900'
                                        : 'bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                                    }`}
                                  >
                                    <span className="text-[11px]">{f.icon}</span>
                                    {f.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Dynamic Excel fields */}
                            {dynamicKeys.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Champs Excel</span>
                                    <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold rounded-full">{dynamicKeys.filter(k => pdfFields[k]).length}/{dynamicKeys.length}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allOn = dynamicKeys.every(k => pdfFields[k]);
                                      const next = { ...pdfFields };
                                      dynamicKeys.forEach(k => { next[k] = !allOn; });
                                      setPdfFields(next);
                                      try { localStorage.setItem('inci-cache:delivery-batch-pdf-fields', JSON.stringify(next)); } catch {}
                                    }}
                                    className="text-[10px] font-semibold text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 transition"
                                  >
                                    {dynamicKeys.every(k => pdfFields[k]) ? 'Tout désélectionner' : 'Tout sélectionner'}
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {dynamicKeys.map(k => (
                                    <button
                                      key={k}
                                      type="button"
                                      onClick={() => handlePdfFieldChange(k, !pdfFields[k])}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all select-none ${
                                        pdfFields[k]
                                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-200 dark:shadow-emerald-900'
                                          : 'bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-emerald-300 dark:hover:border-emerald-700'
                                      }`}
                                    >
                                      {k}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 rounded-xl overflow-x-auto max-w-full w-full">
                          <table className="w-full text-left border-collapse min-w-max whitespace-nowrap">
                            <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                              <tr>
                                <th className="py-2.5 px-4 w-12">Photo</th>
                                {pdfFieldsOrder.filter(f => pdfFields[f]).map(f => {
                                  const labelMap: Record<string, string> = {
                                    name: 'Nom',
                                    identifier: 'Matricule',
                                    cardType: 'Type de carte',
                                    cardNumber: 'N° de carte',
                                    enrollmentNumber: "N° d'enrôlement",
                                    printedAt: 'Impression',
                                  };
                                  const label = labelMap[f] || f;
                                  const isRight = f === 'printedAt';
                                  return (
                                    <th
                                      key={f}
                                      className={`py-2.5 px-3 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition${isRight ? ' text-right' : ''}`}
                                      onClick={() => handleDetailsSort(f)}
                                    >
                                      <div className={`flex items-center gap-1 select-none${isRight ? ' justify-end' : ''}`}>
                                        <span>{label}</span>
                                        {detailsSortField === f
                                          ? (detailsSortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-500" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />)
                                          : <ArrowUpDown className="w-3 h-3 text-neutral-300 dark:text-neutral-600" />}
                                      </div>
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850">
                              {printedCards.map(({ key, emp, cardType, cardNumber, printedAt }) => (
                                <tr key={key} className="text-xs hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10">
                                  <td className="py-2.5 px-4">
                                    <div className="w-8 h-8 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center overflow-hidden">
                                      {emp.photoUrl ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                          src={emp.photoUrl}
                                          alt=""
                                          className={`w-full h-full ${((emp.dynamicData as any)?._photoFit === 'contain') ? 'object-contain' : 'object-cover'}`}
                                        />
                                      ) : (
                                        <User className="w-3.5 h-3.5 text-neutral-400" />
                                      )}
                                    </div>
                                  </td>
                                  {pdfFieldsOrder.filter(f => pdfFields[f]).map(f => {
                                    if (f === 'name') return <td key={f} className="py-2.5 px-3 font-semibold">{getEmployeeName(emp)}</td>;
                                    if (f === 'identifier') return <td key={f} className="py-2.5 px-3 font-mono text-neutral-500">{emp.uniqueIdentifier}</td>;
                                    if (f === 'cardType') return (
                                      <td key={f} className="py-2.5 px-3">
                                        <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">{cardType}</span>
                                      </td>
                                    );
                                    if (f === 'cardNumber') return <td key={f} className="py-2.5 px-3 font-mono font-bold">{cardNumber}</td>;
                                    if (f === 'enrollmentNumber') return <td key={f} className="py-2.5 px-3 font-mono">{emp.enrollmentNumber || '-'}</td>;
                                    if (f === 'printedAt') return <td key={f} className="py-2.5 px-3 text-right text-neutral-400">{printedAt ? new Date(printedAt).toLocaleDateString('fr-FR') : '-'}</td>;
                                    // dynamic Excel key
                                    return <td key={f} className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">{(emp.dynamicData as any)?.[f] || '-'}</td>;
                                  })}
                                </tr>
                              ))}
                            </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
                </>
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
