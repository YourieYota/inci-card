'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Check, AlertTriangle, Loader2, CheckSquare, Square, Eye } from 'lucide-react';
import { importEmployees } from '@/app/actions/employees';

interface ExcelImporterProps {
  companyId: string;
  onImportSuccess: (count: number, added?: number, updated?: number, skippedProtected?: number) => void;
  onCancel: () => void;
  isOfflineMode?: boolean;
  onImportOffline?: (uniqueField: string, rows: any[]) => void;
}

export default function ExcelImporter({ 
  companyId, 
  onImportSuccess, 
  onCancel,
  isOfflineMode = false,
  onImportOffline
}: ExcelImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [uniqueField, setUniqueField] = useState<string>('');
  const [selectedHeaders, setSelectedHeaders] = useState<Set<string>>(new Set());
  
  // States
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to format values for display in the preview table
  const formatCellValue = (key: string, val: any): string => {
    if (val === undefined || val === null || val === '') return '-';

    // Check if key starts with "date" or val is a Date object
    const isDateKey = key.toLowerCase().trim().startsWith('date');
    if (val instanceof Date) {
      const day = String(val.getDate()).padStart(2, '0');
      const month = String(val.getMonth() + 1).padStart(2, '0');
      const year = val.getFullYear();
      return `${day}/${month}/${year}`;
    }

    if (isDateKey) {
      const dateObj = new Date(val);
      if (!isNaN(dateObj.getTime())) {
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        return `${day}/${month}/${year}`;
      }
    }

    return String(val);
  };

  // Helper to parse values into JS Date objects
  const parseDateValue = (val: any): any => {
    if (val === undefined || val === null || val === '') return val;
    if (val instanceof Date) return val;

    // Excel serial number timestamp
    if (typeof val === 'number') {
      const date = new Date((val - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) return date;
    }

    // String date format dd/mm/yyyy or standard ISO
    if (typeof val === 'string') {
      const trimmed = val.trim();
      const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10);
        const month = parseInt(dmyMatch[2], 10) - 1;
        const year = parseInt(dmyMatch[3], 10);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
      }

      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) return date;
    }

    return val;
  };

  // Read and parse Excel file
  const handleFile = (file: File) => {
    setError(null);
    setIsProcessing(true);
    setFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('Impossible de lire le fichier.');

        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to JSON array
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

        if (jsonData.length === 0) {
          throw new Error('Le fichier Excel est vide.');
        }

        // Get all headers from any row of the JSON data to handle empty cells in the first row
        const allKeys = new Set<string>();
        jsonData.forEach((row: any) => {
          Object.keys(row).forEach((k) => {
            if (k && k.trim()) {
              allKeys.add(k.trim());
            }
          });
        });
        const sheetHeaders = Array.from(allKeys);
        
        // Normalize all row keys (trim whitespace) and convert date values
        const processedRows = jsonData.map((row: any) => {
          const newRow: Record<string, any> = {};
          Object.entries(row).forEach(([key, val]) => {
            const trimmedKey = key.trim();
            if (!trimmedKey) return;
            // If this trimmed key already exists, keep the non-empty value
            if (trimmedKey in newRow && (newRow[trimmedKey] !== undefined && newRow[trimmedKey] !== null && newRow[trimmedKey] !== '')) {
              return;
            }
            if (trimmedKey.toLowerCase().startsWith('date')) {
              newRow[trimmedKey] = parseDateValue(val);
            } else {
              newRow[trimmedKey] = val;
            }
          });
          return newRow;
        });

        setHeaders(sheetHeaders);
        setRows(processedRows);
        setSelectedHeaders(new Set(sheetHeaders));

        // Pre-select first column as unique identifier
        if (sheetHeaders.length > 0) {
          setUniqueField(sheetHeaders[0]);
        }
      } catch (err: any) {
        setError(err.message || 'Erreur lors de la lecture du fichier Excel.');
        setFile(null);
        setHeaders([]);
        setRows([]);
        setSelectedHeaders(new Set());
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setError('Erreur de lecture du fichier.');
      setIsProcessing(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.csv'))) {
      handleFile(droppedFile);
    } else {
      setError('Format de fichier non supporté. Veuillez déposer un fichier .xlsx, .xls ou .csv.');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleUniqueFieldChange = (val: string) => {
    setUniqueField(val);
    setSelectedHeaders((prev) => {
      const next = new Set(prev);
      next.add(val);
      return next;
    });
  };

  const handleCellChange = (rowIndex: number, headerKey: string, newValue: any) => {
    setRows((prevRows) => {
      const updated = [...prevRows];
      updated[rowIndex] = {
        ...updated[rowIndex],
        [headerKey]: newValue,
      };
      return updated;
    });
  };

  const handleImport = async (isModificationOnly: boolean = false) => {
    if (!file || !uniqueField || rows.length === 0) return;

    setIsImporting(true);
    setError(null);

    try {
      // Build clean row objects containing only selected columns (always keeping keys with empty string fallbacks)
      const cleanRows = rows.map((row) => {
        const filteredRow: Record<string, any> = {};
        // Always include uniqueField
        filteredRow[uniqueField] = (row[uniqueField] !== undefined && row[uniqueField] !== null) ? String(row[uniqueField]).trim() : "";
        // Include selected columns
        selectedHeaders.forEach((h) => {
          filteredRow[h] = (row[h] !== undefined && row[h] !== null) ? row[h] : "";
        });
        return filteredRow;
      });

      const serializedRows = JSON.parse(JSON.stringify(cleanRows));
      
      if (isOfflineMode && onImportOffline) {
        onImportOffline(uniqueField, serializedRows);
        return;
      }

      const res = await importEmployees({
        companyId,
        uniqueField,
        rows: serializedRows,
        isModificationOnly,
      });

      if (res.success) {
        onImportSuccess(res.count, res.addedCount, res.updatedCount, res.skippedProtectedCount);
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'importation.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className={`bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm mx-auto transition-all duration-300 ${file ? 'max-w-5xl' : 'max-w-2xl'}`}>
      <div className="border-b border-neutral-100 dark:border-neutral-800 pb-4 mb-6">
        <h2 className="text-lg font-bold text-neutral-800 dark:text-white flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
          <span>Importer des employés</span>
        </h2>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          Uploadez votre fichier d&apos;employés (.xlsx, .xls, ou .csv) pour les enregistrer.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-400 rounded-xl text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!file ? (
        // FILE SELECTOR / DRAG ZONE
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10'
              : 'border-neutral-200 dark:border-neutral-800 hover:border-indigo-400 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />

          {isProcessing ? (
            <div className="flex flex-col items-center">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Traitement du fichier...</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-xl flex items-center justify-center mb-4 border border-neutral-200 dark:border-neutral-700 shadow-sm">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-1">
                Déposez votre fichier ici, ou cliquez pour parcourir
              </p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                Fichiers acceptés : Microsoft Excel (.xlsx, .xls) ou CSV (.csv)
              </p>
            </>
          )}
        </div>
      ) : (
        // COLUMN MAPPING & CONFIGURATION
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
            <div className="truncate flex-1">
              <p className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{file.name}</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">{rows.length} lignes détectées</p>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setHeaders([]);
                setRows([]);
                setSelectedHeaders(new Set());
              }}
              className="text-xs font-semibold text-rose-500 hover:text-rose-600 px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition"
            >
              Changer
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Identifier Selector */}
            <div className="p-5 bg-indigo-50/20 dark:bg-indigo-950/15 border border-indigo-100/50 dark:border-indigo-950/50 rounded-xl flex flex-col justify-between">
              <div>
                <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
                  Clé anti-doublon (Identifiant unique)
                </label>
                <select
                  value={uniqueField}
                  onChange={(e) => handleUniqueFieldChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/25 focus:outline-none"
                >
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-3 leading-relaxed">
                Sélectionnez la colonne Excel qui identifie de manière unique chaque employé (ex: Matricule, ID, Email). 
                Si un employé avec le même identifiant existe déjà, ses informations seront mises à jour.
              </p>
            </div>

            {/* Column Selection */}
            <div className="p-5 bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  Champs à importer
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedHeaders(new Set(headers))}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Tout cocher
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Set<string>();
                      if (uniqueField) next.add(uniqueField);
                      setSelectedHeaders(next);
                    }}
                    className="text-[10px] font-bold text-neutral-500 hover:underline"
                  >
                    Aucun
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[120px] pr-1">
                {headers.map((h) => {
                  const isSelected = selectedHeaders.has(h);
                  const isUnique = h === uniqueField;

                  return (
                    <label
                      key={h}
                      className={`flex items-center gap-2 px-2.5 py-1.5 border rounded-lg cursor-pointer text-xs font-bold select-none transition truncate ${
                        isUnique
                          ? 'border-indigo-200 bg-indigo-50/30 text-indigo-700 dark:border-indigo-900/30 dark:bg-indigo-950/20 cursor-not-allowed opacity-80'
                          : isSelected
                          ? 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-sm'
                          : 'border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isUnique}
                        onChange={() => {
                          if (isUnique) return;
                          setSelectedHeaders((prev) => {
                            const next = new Set(prev);
                            if (next.has(h)) {
                              next.delete(h);
                            } else {
                              next.add(h);
                            }
                            return next;
                          });
                        }}
                        className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                      />
                      <span className="truncate">{h}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Rows Preview Grid */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-neutral-400" />
                <span>Modifier les données avant d&apos;importer ({rows.length} lignes)</span>
              </h4>
              <span className="text-[10px] text-neutral-400 italic">
                Modifiez directement les valeurs des cases blanches ci-dessous
              </span>
            </div>
            
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-neutral-50 dark:bg-neutral-900">
              <div className="overflow-x-auto max-h-[350px]">
                <table className="min-w-full text-left text-xs divide-y divide-neutral-250 dark:divide-neutral-800">
                  <thead className="bg-neutral-100 dark:bg-neutral-800 font-bold text-neutral-600 dark:text-neutral-400 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-3 w-12 text-center bg-neutral-100 dark:bg-neutral-800 sticky left-0 z-20">#</th>
                      {headers.map((h) => {
                        const isSelected = selectedHeaders.has(h);
                        return (
                          <th 
                            key={h} 
                            className={`p-3 whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 transition ${
                              isSelected ? '' : 'text-neutral-400 dark:text-neutral-600 opacity-60 bg-neutral-100/30'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span>{h}</span>
                              {h === uniqueField && (
                                <span className="text-[8px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1 py-0.5 rounded">
                                  Clé unique
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                    {rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-neutral-100/30 dark:hover:bg-neutral-800/10">
                        <td className="p-3 text-center font-bold text-neutral-400 dark:text-neutral-500 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 sticky left-0 z-10">
                          {rowIndex + 1}
                        </td>
                        {headers.map((h) => {
                          const isSelected = selectedHeaders.has(h);
                          const cellValue = row[h] !== undefined ? row[h] : '';
                          
                          let displayVal = '';
                          if (cellValue instanceof Date) {
                            const day = String(cellValue.getDate()).padStart(2, '0');
                            const month = String(cellValue.getMonth() + 1).padStart(2, '0');
                            const year = cellValue.getFullYear();
                            displayVal = `${day}/${month}/${year}`;
                          } else {
                            displayVal = String(cellValue);
                          }

                          return (
                            <td 
                              key={h} 
                              className={`p-1.5 whitespace-nowrap transition ${
                                isSelected ? '' : 'bg-neutral-100/20 dark:bg-neutral-900/40 opacity-40 select-none'
                              }`}
                            >
                              <input
                                type="text"
                                value={displayVal === 'null' || displayVal === 'undefined' ? '' : displayVal}
                                disabled={!isSelected}
                                onChange={(e) => {
                                  let val: any = e.target.value;
                                  if (h.toLowerCase().trim().startsWith('date')) {
                                    val = parseDateValue(val);
                                  }
                                  handleCellChange(rowIndex, h, val);
                                }}
                                className={`w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-transparent transition focus:bg-white dark:focus:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 ${
                                  isSelected 
                                    ? 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200/20 dark:hover:bg-neutral-800/20' 
                                    : 'text-neutral-400 cursor-not-allowed'
                                }`}
                                placeholder="-"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-100 dark:border-neutral-800 pt-5 mt-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs font-bold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-neutral-500 transition"
            >
              Annuler
            </button>
            <button
              onClick={() => handleImport(true)}
              disabled={isImporting || !uniqueField}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition shadow-sm disabled:opacity-50"
              title="Compare le fichier et applique uniquement les modifications aux employés existants sans toucher aux fiches protégées"
            >
              {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
              <span>Importer les modifications</span>
            </button>
            <button
              onClick={() => handleImport(false)}
              disabled={isImporting || !uniqueField}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Lancer l&apos;importation ({rows.length} lignes)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
