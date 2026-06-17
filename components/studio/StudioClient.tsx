'use client';

import React, { useState, useEffect } from 'react';
import { Company, CardType } from '@prisma/client';
import { Save, Plus, ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import Canvas, { StudioElement } from './Canvas';
import Toolbar from './Toolbar';
import PropertiesPanel from './PropertiesPanel';
import { getTemplate, saveTemplate, createCompany } from '@/app/actions/templates';

interface StudioClientProps {
  initialCompanies: Company[];
}

export default function StudioClient({ initialCompanies }: StudioClientProps) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [cardType, setCardType] = useState<CardType>('BADGE');

  // Canvas State
  const [canvasWidth, setCanvasWidth] = useState<number>(324);
  const [canvasHeight, setCanvasHeight] = useState<number>(204);
  const [canvasBackground, setCanvasBackground] = useState<string>('');
  const [elements, setElements] = useState<StudioElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // UI States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState<boolean>(false);
  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-clear notification after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Load Template when company or type changes
  useEffect(() => {
    if (!selectedCompanyId) {
      setElements([]);
      setCanvasWidth(324);
      setCanvasHeight(204);
      setCanvasBackground('');
      return;
    }

    const loadTemplateData = async () => {
      setIsLoading(true);
      try {
        const template = await getTemplate(selectedCompanyId, cardType);
        if (template) {
          setCanvasWidth(template.width);
          setCanvasHeight(template.height);
          setCanvasBackground(template.backgroundUrl || '');
          setElements((template.layoutConfig as unknown as StudioElement[]) || []);
        } else {
          // Reset to default empty template for this company
          setElements([]);
          setCanvasWidth(324);
          setCanvasHeight(204);
          setCanvasBackground('');
        }
      } catch (err: any) {
        setNotification({ type: 'error', message: err.message || 'Erreur lors du chargement du modèle.' });
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplateData();
  }, [selectedCompanyId, cardType]);

  // Element Actions
  const handleAddElement = (type: 'text' | 'image' | 'qr', customProps?: Partial<StudioElement>) => {
    const id = `${type}_${Date.now()}`;
    const newElement: StudioElement = {
      id,
      type,
      x: 10,
      y: 10,
      width: type === 'text' ? 120 : type === 'image' ? 80 : 60,
      height: type === 'text' ? 30 : type === 'image' ? 90 : 60,
      ...customProps,
    };

    setElements((prev) => [...prev, newElement]);
    setSelectedElementId(id);
  };

  const handleUpdateElement = (updatedElement: StudioElement) => {
    setElements((prev) => prev.map((el) => (el.id === updatedElement.id ? updatedElement : el)));
  };

  const handleDeleteElement = (id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
  };

  const handleUpdateCanvas = (width: number, height: number, background: string) => {
    setCanvasWidth(width);
    setCanvasHeight(height);
    setCanvasBackground(background);
  };

  // Save Template Action
  const handleSave = async () => {
    if (!selectedCompanyId) {
      setNotification({ type: 'error', message: 'Veuillez sélectionner une entreprise avant de sauvegarder.' });
      return;
    }

    setIsSaving(true);
    try {
      await saveTemplate({
        companyId: selectedCompanyId,
        type: cardType,
        width: canvasWidth,
        height: canvasHeight,
        backgroundUrl: canvasBackground,
        layoutConfig: elements as any,
      });
      setNotification({ type: 'success', message: 'Le modèle a été sauvegardé avec succès.' });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Erreur lors de la sauvegarde.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Create Company Action
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    try {
      const newCompany = await createCompany(newCompanyName.trim());
      setCompanies((prev) => [...prev, newCompany].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCompanyId(newCompany.id);
      setNewCompanyName('');
      setShowCreateCompanyModal(false);
      setNotification({ type: 'success', message: `Entreprise "${newCompany.name}" créée !` });
    } catch (err: any) {
      alert(err.message || "Impossible d'ajouter cette entreprise.");
    }
  };

  const selectedElement = elements.find((el) => el.id === selectedElementId) || null;

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
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Studio de Création</h1>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              Concevez des modèles de badges et cartes d&apos;impression
            </p>
          </div>
        </div>

        {/* NOTIFICATION FLOATER */}
        {notification && (
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold border shadow-md animate-in fade-in slide-in-from-top-4 duration-300 ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400'
                : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-400'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* CONFIG BAR CONTROLS */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Company Selector */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/25 min-w-[200px]"
            >
              <option value="">Sélectionnez l&apos;entreprise</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCreateCompanyModal(true)}
              className="p-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/50 transition"
              title="Ajouter une entreprise"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Card Type Selector */}
          <div className="flex rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-50 dark:bg-neutral-900 p-0.5">
            <button
              onClick={() => setCardType('BADGE')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                cardType === 'BADGE'
                  ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              Badge
            </button>
            <button
              onClick={() => setCardType('CARTE_PRO')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                cardType === 'CARTE_PRO'
                  ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              Carte Pro
            </button>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving || !selectedCompanyId}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-750 disabled:bg-neutral-200 dark:disabled:bg-neutral-800 disabled:text-neutral-450 dark:disabled:text-neutral-600 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition shadow-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Sauvegarder</span>
          </button>
        </div>
      </div>

      {/* STUDIO WORKSPACE */}
      {!selectedCompanyId ? (
        // STATE: NO COMPANY SELECTED
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm text-center min-h-[450px]">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 flex items-center justify-center mb-4 border border-indigo-100 dark:border-indigo-900/50">
            <Save className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-neutral-850 dark:text-white mb-2">Configurez votre modèle</h2>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 max-w-sm mb-6">
            Sélectionnez une entreprise cliente dans la barre supérieure pour charger son modèle ou commencez à en créer un nouveau.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="px-4 py-2 border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-medium"
            >
              <option value="">Choisir une entreprise...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCreateCompanyModal(true)}
              className="px-4 py-2 text-sm font-bold bg-indigo-550 text-white rounded-xl hover:bg-indigo-700 transition"
            >
              Créer une entreprise
            </button>
          </div>
        </div>
      ) : isLoading ? (
        // STATE: LOADING
        <div className="flex-1 flex flex-col items-center justify-center py-16 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm min-h-[450px]">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
          <p className="text-sm text-neutral-400 dark:text-neutral-500">Chargement de la configuration...</p>
        </div>
      ) : (
        // STATE: ACTIVE EDITOR
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Left Toolbar */}
          <div className="lg:col-span-1">
            <Toolbar onAddElement={handleAddElement} />
          </div>

          {/* Central Workspace Canvas */}
          <div className="lg:col-span-2">
            <Canvas
              width={canvasWidth}
              height={canvasHeight}
              backgroundUrl={canvasBackground}
              elements={elements}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onChangeElement={handleUpdateElement}
            />
          </div>

          {/* Right Properties Panel */}
          <div className="lg:col-span-1">
            <PropertiesPanel
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              canvasBackground={canvasBackground}
              onUpdateCanvas={handleUpdateCanvas}
              selectedElement={selectedElement}
              onUpdateElement={handleUpdateElement}
              onDeleteElement={handleDeleteElement}
            />
          </div>
        </div>
      )}

      {/* CREATE COMPANY MODAL */}
      {showCreateCompanyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 w-full max-w-md p-6 rounded-2xl shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-neutral-850 dark:text-white mb-2">Ajouter une entreprise</h3>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-4">
              Créez une fiche pour une nouvelle entreprise cliente pour laquelle vous imprimerez des cartes.
            </p>

            <form onSubmit={handleCreateCompany} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Nom de l&apos;entreprise</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Acme Corp"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-neutral-100 dark:border-neutral-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateCompanyModal(false);
                    setNewCompanyName('');
                  }}
                  className="px-4 py-2 text-xs font-bold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-55 dark:hover:bg-neutral-800 rounded-xl text-neutral-600 dark:text-neutral-450 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
