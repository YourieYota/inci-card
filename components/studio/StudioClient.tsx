'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Company, CardType } from '@prisma/client';
import { Save, Plus, ArrowLeft, Loader2, CheckCircle, AlertCircle, RefreshCw, ZoomIn } from 'lucide-react';
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
  const [canvasBackgroundOpacity, setCanvasBackgroundOpacity] = useState<number>(1);
  const [elements, setElements] = useState<StudioElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Zoom State
  const [zoom, setZoom] = useState<number>(1.5); // Default 150% for larger workspace

  // Clipboard & History State
  const [copiedElement, setCopiedElement] = useState<StudioElement | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // UI States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState<boolean>(false);
  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-clear notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Undo / Redo Stack Management
  const pushHistoryState = (
    newElements: StudioElement[],
    newBgOpacity = canvasBackgroundOpacity,
    newWidth = canvasWidth,
    newHeight = canvasHeight,
    newBg = canvasBackground
  ) => {
    const newState = {
      elements: JSON.parse(JSON.stringify(newElements)),
      backgroundOpacity: newBgOpacity,
      canvasWidth: newWidth,
      canvasHeight: newHeight,
      canvasBackground: newBg,
    };

    setHistory((prev) => {
      const truncated = prev.slice(0, historyIndex + 1);
      return [...truncated, newState];
    });
    setHistoryIndex((prev) => prev + 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setElements(prevState.elements);
      setCanvasBackgroundOpacity(prevState.backgroundOpacity);
      setCanvasWidth(prevState.canvasWidth);
      setCanvasHeight(prevState.canvasHeight);
      setCanvasBackground(prevState.canvasBackground);
      setHistoryIndex(historyIndex - 1);
      setSelectedElementId(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setElements(nextState.elements);
      setCanvasBackgroundOpacity(nextState.backgroundOpacity);
      setCanvasWidth(nextState.canvasWidth);
      setCanvasHeight(nextState.canvasHeight);
      setCanvasBackground(nextState.canvasBackground);
      setHistoryIndex(historyIndex + 1);
      setSelectedElementId(null);
    }
  };

  // Enforce global deselect on clicking escape or outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      // If clicked outside editor container, deselect
      const studioWorkspace = document.getElementById('studio-workspace');
      if (studioWorkspace && !studioWorkspace.contains(e.target as Node)) {
        setSelectedElementId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Bypass if focus is in input forms
      const active = document.activeElement;
      if (active) {
        const tag = active.tagName.toLowerCase();
        if (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          active.getAttribute('contenteditable') === 'true'
        ) {
          return;
        }
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl + Z: Undo
      if (isCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl + Y: Redo
      if (isCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl + C: Copy
      if (isCtrl && e.key.toLowerCase() === 'c') {
        if (selectedElementId) {
          const el = elements.find((item) => item.id === selectedElementId);
          if (el) {
            e.preventDefault();
            setCopiedElement(el);
          }
        }
        return;
      }

      // Ctrl + X: Cut
      if (isCtrl && e.key.toLowerCase() === 'x') {
        if (selectedElementId) {
          const el = elements.find((item) => item.id === selectedElementId);
          if (el) {
            e.preventDefault();
            setCopiedElement(el);
            const newElements = elements.filter((item) => item.id !== selectedElementId);
            setElements(newElements);
            setSelectedElementId(null);
            pushHistoryState(newElements);
          }
        }
        return;
      }

      // Ctrl + V: Paste
      if (isCtrl && e.key.toLowerCase() === 'v') {
        if (copiedElement) {
          e.preventDefault();
          const newId = `${copiedElement.type}_${Date.now()}`;
          const pastedElement: StudioElement = {
            ...copiedElement,
            id: newId,
            x: Math.min(canvasWidth - copiedElement.width, copiedElement.x + 10),
            y: Math.min(canvasHeight - copiedElement.height, copiedElement.y + 10),
          };
          const newElements = [...elements, pastedElement];
          setElements(newElements);
          setSelectedElementId(newId);
          pushHistoryState(newElements);
        }
        return;
      }

      // Ctrl + A: Select first element as fallback
      if (isCtrl && e.key.toLowerCase() === 'a') {
        if (elements.length > 0) {
          e.preventDefault();
          setSelectedElementId(elements[0].id);
        }
        return;
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedElementId(null);
        return;
      }

      // Delete / Backspace: delete element
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementId) {
          e.preventDefault();
          const newElements = elements.filter((item) => item.id !== selectedElementId);
          setElements(newElements);
          setSelectedElementId(null);
          pushHistoryState(newElements);
        }
        return;
      }

      // Nudge elements (Arrows / Arrows + Shift)
      if (selectedElementId) {
        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (arrowKeys.includes(e.key)) {
          e.preventDefault();
          const el = elements.find((item) => item.id === selectedElementId);
          if (!el) return;

          const nudgeAmount = e.shiftKey ? 10 : 1;
          let newX = el.x;
          let newY = el.y;

          if (e.key === 'ArrowLeft') newX = Math.max(0, el.x - nudgeAmount);
          if (e.key === 'ArrowRight') newX = Math.min(canvasWidth - el.width, el.x + nudgeAmount);
          if (e.key === 'ArrowUp') newY = Math.max(0, el.y - nudgeAmount);
          if (e.key === 'ArrowDown') newY = Math.min(canvasHeight - el.height, el.y + nudgeAmount);

          const updated = { ...el, x: newX, y: newY };
          const newElements = elements.map((item) => (item.id === selectedElementId ? updated : item));
          setElements(newElements);
          // Push state to history
          pushHistoryState(newElements);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    elements,
    selectedElementId,
    copiedElement,
    historyIndex,
    history,
    canvasBackgroundOpacity,
    canvasWidth,
    canvasHeight,
    canvasBackground,
  ]);

  // Load Template when company or type changes
  useEffect(() => {
    if (!selectedCompanyId) {
      setElements([]);
      setCanvasWidth(324);
      setCanvasHeight(204);
      setCanvasBackground('');
      setCanvasBackgroundOpacity(1);
      setHistory([]);
      setHistoryIndex(-1);
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
          
          // Parse layoutConfig
          const config = template.layoutConfig as any;
          let loadedElements: StudioElement[] = [];
          let loadedOpacity = 1;

          if (config && typeof config === 'object' && 'elements' in config) {
            loadedElements = config.elements || [];
            loadedOpacity = config.backgroundOpacity !== undefined ? config.backgroundOpacity : 1;
          } else {
            // Legacy format (pure elements array)
            loadedElements = (config as unknown as StudioElement[]) || [];
          }

          setElements(loadedElements);
          setCanvasBackgroundOpacity(loadedOpacity);
          
          // Initialize history stack
          const initialState = {
            elements: JSON.parse(JSON.stringify(loadedElements)),
            backgroundOpacity: loadedOpacity,
            canvasWidth: template.width,
            canvasHeight: template.height,
            canvasBackground: template.backgroundUrl || '',
          };
          setHistory([initialState]);
          setHistoryIndex(0);
        } else {
          // Reset to default empty template for this company
          setElements([]);
          setCanvasWidth(324);
          setCanvasHeight(204);
          setCanvasBackground('');
          setCanvasBackgroundOpacity(1);
          
          const initialState = {
            elements: [],
            backgroundOpacity: 1,
            canvasWidth: 324,
            canvasHeight: 204,
            canvasBackground: '',
          };
          setHistory([initialState]);
          setHistoryIndex(0);
        }
      } catch (err: any) {
        setNotification({ type: 'error', message: err.message || 'Erreur lors du chargement.' });
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
      x: 20,
      y: 20,
      width: type === 'text' ? 120 : type === 'image' ? 80 : 60,
      height: type === 'text' ? 30 : type === 'image' ? 90 : 60,
      opacity: 1,
      ...customProps,
    };

    const newElements = [...elements, newElement];
    setElements(newElements);
    setSelectedElementId(id);
    pushHistoryState(newElements);
  };

  const handleUpdateElement = (updatedElement: StudioElement) => {
    const newElements = elements.map((el) => (el.id === updatedElement.id ? updatedElement : el));
    setElements(newElements);
    // Push history on completed edits (like from PropertiesPanel slider/input)
    pushHistoryState(newElements);
  };

  // Specific callback for when dragging/resizing stops, so we log the history state
  const handleElementDragResize = (updatedElement: StudioElement) => {
    const newElements = elements.map((el) => (el.id === updatedElement.id ? updatedElement : el));
    setElements(newElements);
    pushHistoryState(newElements);
  };

  const handleDeleteElement = (id: string) => {
    const newElements = elements.filter((el) => el.id !== id);
    setElements(newElements);
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
    pushHistoryState(newElements);
  };

  const handleUpdateCanvas = (width: number, height: number, background: string, opacity: number) => {
    setCanvasWidth(width);
    setCanvasHeight(height);
    setCanvasBackground(background);
    setCanvasBackgroundOpacity(opacity);
    pushHistoryState(elements, opacity, width, height, background);
  };

  // Save Template Action
  const handleSave = async () => {
    if (!selectedCompanyId) {
      setNotification({ type: 'error', message: 'Veuillez sélectionner une entreprise.' });
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
        layoutConfig: {
          elements,
          backgroundOpacity: canvasBackgroundOpacity,
        } as any,
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
    <div className="flex flex-col gap-6 min-h-screen" id="studio-workspace">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-neutral-850 py-4 px-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Studio de Création</h1>
            <p className="text-xs text-neutral-450 dark:text-neutral-500">
              Concevez des modèles de badges et cartes d&apos;impression
            </p>
          </div>
        </div>

        {/* NOTIFICATION FLOATER */}
        {notification && (
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold border shadow-md animate-in fade-in slide-in-from-top-4 duration-300 ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-255 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400'
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
              className="px-3.5 py-2.5 border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/25 min-w-[200px]"
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
              className="p-2.5 bg-indigo-55 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 text-indigo-650 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/50 transition"
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
                  : 'text-neutral-550 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              Badge
            </button>
            <button
              onClick={() => setCardType('CARTE_PRO')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                cardType === 'CARTE_PRO'
                  ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-neutral-550 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              Carte Pro
            </button>
          </div>

          {/* Zoom Controller */}
          <div className="flex items-center gap-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-1.5">
            <ZoomIn className="w-3.5 h-3.5 text-neutral-400 mr-1" />
            <select
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="bg-transparent border-none p-0 text-xs font-bold text-neutral-700 dark:text-neutral-300 outline-none cursor-pointer focus:ring-0"
            >
              <option value="1">100%</option>
              <option value="1.25">125%</option>
              <option value="1.5">150%</option>
              <option value="2">200%</option>
              <option value="2.5">250%</option>
            </select>
          </div>

          {/* Undo / Redo buttons */}
          {selectedCompanyId && (
            <div className="flex border border-neutral-250 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-50 dark:bg-neutral-900 p-0.5">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="px-3 py-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 transition"
                title="Annuler (Ctrl+Z)"
              >
                Annuler
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="px-3 py-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 transition"
                title="Rétablir (Ctrl+Y)"
              >
                Rétablir
              </button>
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving || !selectedCompanyId}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-750 disabled:bg-neutral-200 dark:disabled:bg-neutral-800 disabled:text-neutral-400 dark:disabled:text-neutral-650 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition shadow-sm"
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
          <p className="text-sm text-neutral-450 dark:text-neutral-500 max-w-sm mb-6">
            Sélectionnez une entreprise cliente dans la barre supérieure pour charger son modèle ou commencez à en créer un nouveau.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="px-4 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-medium"
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
              className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"
            >
              Créer une entreprise
            </button>
          </div>
        </div>
      ) : isLoading ? (
        // STATE: LOADING
        <div className="flex-1 flex flex-col items-center justify-center py-16 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm min-h-[450px]">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
          <p className="text-sm text-neutral-450 dark:text-neutral-505">Chargement de la configuration...</p>
        </div>
      ) : (
        // STATE: ACTIVE EDITOR
        <div className="flex flex-col xl:flex-row gap-6 items-start w-full">
          {/* Left Toolbar */}
          <div className="w-full xl:w-72 shrink-0">
            <Toolbar onAddElement={handleAddElement} />
          </div>

          {/* Central Workspace Canvas */}
          <div className="flex-1 min-w-0 w-full">
            <Canvas
              width={canvasWidth}
              height={canvasHeight}
              backgroundUrl={canvasBackground}
              backgroundOpacity={canvasBackgroundOpacity}
              elements={elements}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onChangeElement={handleElementDragResize}
              zoom={zoom}
            />
          </div>

          {/* Right Properties Panel */}
          <div className="w-full xl:w-80 shrink-0">
            <PropertiesPanel
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              canvasBackground={canvasBackground}
              canvasBackgroundOpacity={canvasBackgroundOpacity}
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
                  className="w-full px-3 py-2.5 border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-neutral-100 dark:border-neutral-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateCompanyModal(false);
                    setNewCompanyName('');
                  }}
                  className="px-4 py-2 text-xs font-bold border border-neutral-250 dark:border-neutral-800 hover:bg-neutral-55 dark:hover:bg-neutral-800 rounded-xl text-neutral-600 dark:text-neutral-450 transition"
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
