'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, ArrowRight, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { importEmployees } from '@/app/actions/employees';

interface ExcelImporterProps {
  companyId: string;
  onImportSuccess: (count: number) => void;
  onCancel: () => void;
}

export default function ExcelImporter({ companyId, onImportSuccess, onCancel }: ExcelImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [uniqueField, setUniqueField] = useState<string>('');
  
  // States
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to JSON array
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

        if (jsonData.length === 0) {
          throw new Error('Le fichier Excel est vide.');
        }

        // Get all headers
        const sheetHeaders = Object.keys(jsonData[0]);
        setHeaders(sheetHeaders);
        setRows(jsonData);

        // Pre-select first column as unique identifier
        if (sheetHeaders.length > 0) {
          setUniqueField(sheetHeaders[0]);
        }
      } catch (err: any) {
        setError(err.message || 'Erreur lors de la lecture du fichier Excel.');
        setFile(null);
        setHeaders([]);
        setRows([]);
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

  const handleImport = async () => {
    if (!file || !uniqueField || rows.length === 0) return;

    setIsImporting(true);
    setError(null);

    try {
      const cleanRows = JSON.parse(JSON.stringify(rows));
      const res = await importEmployees({
        companyId,
        uniqueField,
        rows: cleanRows,
      });

      if (res.success) {
        onImportSuccess(res.count);
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'importation.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm max-w-2xl mx-auto transition-all duration-300">
      <div className="border-b border-neutral-100 dark:border-neutral-800 pb-4 mb-6">
        <h2 className="text-lg font-bold text-neutral-850 dark:text-white flex items-center gap-2">
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
              : 'border-neutral-250 dark:border-neutral-800 hover:border-indigo-400 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30'
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
              <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-450 rounded-xl flex items-center justify-center mb-4 border border-neutral-200 dark:border-neutral-700 shadow-sm">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-1">
                Déposez votre fichier ici, ou cliquez pour parcourir
              </p>
              <p className="text-xs text-neutral-450 dark:text-neutral-500">
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
              }}
              className="text-xs font-semibold text-rose-500 hover:text-rose-600 px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition"
            >
              Changer
            </button>
          </div>

          {/* Identifier Selector */}
          <div className="p-5 bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-950/50 rounded-xl">
            <label className="block text-xs font-bold text-neutral-550 dark:text-neutral-400 uppercase tracking-wide mb-2">
              Clé anti-doublon (Identifiant unique)
            </label>
            <select
              value={uniqueField}
              onChange={(e) => setUniqueField(e.target.value)}
              className="w-full px-3 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-550/25"
            >
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-550 mt-1.5">
              Sélectionnez la colonne Excel qui identifie de manière unique chaque employé (ex: Matricule, ID, Email). 
              Si un employé avec le même identifiant existe déjà, ses informations seront mises à jour.
            </p>
          </div>

          {/* Rows Preview */}
          <div>
            <h4 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
              Aperçu des données (3 premières lignes)
            </h4>
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-x-auto bg-neutral-50 dark:bg-neutral-900">
              <table className="min-w-full text-left text-xs divide-y divide-neutral-200 dark:divide-neutral-800">
                <thead className="bg-neutral-100 dark:bg-neutral-850 font-bold text-neutral-600 dark:text-neutral-400">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="p-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-250 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                  {rows.slice(0, 3).map((row, idx) => (
                    <tr key={idx}>
                      {headers.map((h) => (
                        <td key={h} className="p-3 whitespace-nowrap font-medium">
                          {row[h] !== undefined ? String(row[h]) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 border-t border-neutral-100 dark:border-neutral-800 pt-5 mt-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs font-bold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 rounded-xl text-neutral-550 transition"
            >
              Annuler
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting || !uniqueField}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Lancer l&apos;importation</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
