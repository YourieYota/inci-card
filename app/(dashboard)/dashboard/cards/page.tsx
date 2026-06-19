'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Trash2, Sliders, Layers, Info, Check, RefreshCw, Loader2, Cpu } from 'lucide-react';
import {
  getCardFormats,
  createCardFormat,
  deleteCardFormat,
  getCardCategories,
  createCardCategory,
  deleteCardCategory,
  getCardPhysicalTypes,
  createCardPhysicalType,
  deleteCardPhysicalType
} from '@/app/actions/cards';
import { getCompanies } from '@/app/actions/templates';

interface CardFormat {
  id: string;
  name: string;
  width: number;
  height: number;
  unit: string;
}

interface CardCategory {
  id: string;
  name: string;
  slug: string;
  color: string;
  description: string | null;
  formatId: string;
  format: CardFormat;
}

interface CardPhysicalType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cardCode: string;
  createdAt: Date;
}

export default function CardsManagementPage() {
  const [activeTab, setActiveTab] = useState<'categories' | 'formats' | 'types'>('categories');
  const [formats, setFormats] = useState<CardFormat[]>([]);
  const [categories, setCategories] = useState<CardCategory[]>([]);
  const [physicalTypes, setPhysicalTypes] = useState<CardPhysicalType[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);

  // Form states
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState('#6366f1');
  const [categoryDesc, setCategoryDesc] = useState('');
  const [categoryFormatId, setCategoryFormatId] = useState('');

  const [formatName, setFormatName] = useState('');
  const [formatWidth, setFormatWidth] = useState('85.6');
  const [formatHeight, setFormatHeight] = useState('53.98');
  const [formatUnit, setFormatUnit] = useState('mm');

  const [typeName, setTypeName] = useState('');
  const [typeDesc, setTypeDesc] = useState('');
  const [codePart1, setCodePart1] = useState('');
  const [codePart2, setCodePart2] = useState('');
  const [codePart3, setCodePart3] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  const colorsPreset = [
    '#6366f1', // Indigo
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#14b8a6', // Teal
    '#6b7280', // Gray
  ];

  const loadData = async (companyId: string) => {
    setIsLoading(true);
    try {
      const [formatsData, categoriesData, typesData, companiesData] = await Promise.all([
        getCardFormats(companyId || null),
        getCardCategories(companyId || null),
        getCardPhysicalTypes(companyId || null),
        getCompanies()
      ]);
      setFormats(formatsData);
      setCategories(categoriesData);
      setPhysicalTypes(typesData);
      setCompanies(companiesData);
      if (formatsData.length > 0) {
        setCategoryFormatId(formatsData[0].id);
      }
    } catch (error) {
      console.error('Error loading card settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    loadData(selectedCompanyId);
  }, [selectedCompanyId]);

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
        <p className="text-sm text-neutral-500">Chargement de la gestion des cartes...</p>
      </div>
    );
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim() || !categoryFormatId) return;

    setIsSubmitting(true);
    try {
      const newCat = await createCardCategory({
        name: categoryName.trim(),
        color: categoryColor,
        description: categoryDesc.trim() || undefined,
        formatId: categoryFormatId,
        companyId: selectedCompanyId || undefined,
      });
      setCategories((prev) => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));
      setShowCategoryModal(false);
      setCategoryName('');
      setCategoryDesc('');
    } catch (err: any) {
      alert(err.message || 'Impossible de créer la catégorie.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateFormat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formatName.trim() || !formatWidth || !formatHeight) return;

    setIsSubmitting(true);
    try {
      const newFormat = await createCardFormat({
        name: formatName.trim(),
        width: parseFloat(formatWidth),
        height: parseFloat(formatHeight),
        unit: formatUnit,
        companyId: selectedCompanyId || undefined,
      });
      setFormats((prev) => [...prev, newFormat].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryFormatId(newFormat.id);
      setShowFormatModal(false);
      setFormatName('');
      setFormatWidth('85.6');
      setFormatHeight('53.98');
    } catch (err: any) {
      alert(err.message || 'Impossible de créer le format.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePhysicalType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeName.trim()) return;

    const prefixCode = (codePart1.trim() + codePart2.trim()).toUpperCase();
    if (prefixCode.length < 6 || prefixCode.length > 11) {
      alert(`Le préfixe (Partie 1 + Partie 2) doit faire entre 6 et 11 caractères pour que l'identifiant complet (avec le compteur de 4 chiffres) fasse entre 10 et 15 caractères (Actuellement: ${prefixCode.length} caractères).`);
      return;
    }

    setIsSubmitting(true);
    try {
      const newType = await createCardPhysicalType({
        name: typeName.trim(),
        description: typeDesc.trim() || undefined,
        cardCode: prefixCode,
        companyId: selectedCompanyId || undefined,
      });
      setPhysicalTypes((prev) => [...prev, newType].sort((a, b) => a.name.localeCompare(b.name)));
      setShowTypeModal(false);
      setTypeName('');
      setTypeDesc('');
      setCodePart1('');
      setCodePart2('');
      setCodePart3('');
    } catch (err: any) {
      alert(err.message || 'Impossible de créer le type de carte.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer la catégorie "${name}" ?`)) return;
    try {
      await deleteCardCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.message || 'Impossible de supprimer la catégorie.');
    }
  };

  const handleDeleteFormat = async (id: string, name: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer le format "${name}" ?`)) return;
    try {
      await deleteCardFormat(id);
      setFormats((prev) => prev.filter((f) => f.id !== id));
    } catch (err: any) {
      alert(err.message || 'Impossible de supprimer le format.');
    }
  };

  const handleDeletePhysicalType = async (id: string, name: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer le type de carte "${name}" ?`)) return;
    try {
      await deleteCardPhysicalType(id);
      setPhysicalTypes((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(err.message || 'Impossible de supprimer le type de carte.');
    }
  };

  return (
    <div className="space-y-8">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-neutral-850 p-6 rounded-2xl border border-blue-100/60 dark:border-neutral-800 shadow-sm relative overflow-hidden transition-all duration-300">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-orange-400" />
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 dark:bg-neutral-900 text-blue-500 rounded-xl border border-blue-100 dark:border-neutral-800 shadow-sm">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-890 dark:text-white">Gestion des Cartes</h1>
            <p className="text-xs text-neutral-450 dark:text-neutral-500">
              Configurez les catégories, les types physiques de badges (RFID, NFC...) et les formats d&apos;impression
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-750 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 text-neutral-800 dark:text-neutral-200"
          >
            <option value="">(Global / Toutes les entreprises)</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadData(selectedCompanyId)}
            className="p-2.5 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-500 rounded-xl transition"
            title="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {activeTab === 'categories' ? (
            <button
              onClick={() => setShowCategoryModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-650 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Catégorie</span>
            </button>
          ) : activeTab === 'formats' ? (
            <button
              onClick={() => setShowFormatModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-650 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Format</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setCodePart3('0001');
                setShowTypeModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-650 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Type de carte</span>
            </button>
          )}
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 gap-6">
        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-4 text-sm font-bold transition-all relative flex items-center gap-2 ${
            activeTab === 'categories'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-neutral-450 hover:text-neutral-750 dark:hover:text-neutral-300'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Catégories de cartes</span>
          {activeTab === 'categories' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('formats')}
          className={`pb-4 text-sm font-bold transition-all relative flex items-center gap-2 ${
            activeTab === 'formats'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-neutral-450 hover:text-neutral-750 dark:hover:text-neutral-300'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Formats de cartes</span>
          {activeTab === 'formats' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('types')}
          className={`pb-4 text-sm font-bold transition-all relative flex items-center gap-2 ${
            activeTab === 'types'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-neutral-450 hover:text-neutral-750 dark:hover:text-neutral-300'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Types de cartes</span>
          {activeTab === 'types' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
          )}
        </button>
      </div>

      {/* LOADER */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
          <p className="text-sm text-neutral-500">Chargement de la configuration...</p>
        </div>
      ) : activeTab === 'categories' ? (
        /* ───────────────── TAB: CATEGORIES ───────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-center shadow-sm">
              <Info className="w-8 h-8 text-neutral-400 mb-2" />
              <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Aucune catégorie de cartes configurée.</p>
              <p className="text-xs text-neutral-500 mt-1">Créez votre première catégorie pour classifier vos badges.</p>
            </div>
          ) : (
            categories.map((cat) => (
              <div
                key={cat.id}
                className="group bg-white dark:bg-neutral-850 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Badge & Color */}
                  <div className="flex items-center justify-between">
                    <span
                      className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-sm"
                      style={{ backgroundColor: cat.color }}
                    >
                      {cat.name}
                    </span>
                    <button
                      onClick={() => handleDeleteCategory(cat.id, cat.name)}
                      className="p-1.5 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      title="Supprimer la catégorie"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Dimension indicator / CR80 label */}
                  <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-neutral-500">
                    <CreditCard className="w-4 h-4 text-neutral-400" />
                    <span>Format: {cat.format.name}</span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      ({cat.format.width}x{cat.format.height} {cat.format.unit})
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-neutral-550 dark:text-neutral-400 mt-3 leading-relaxed">
                    {cat.description || "Aucune description fournie pour cette catégorie de cartes."}
                  </p>
                </div>

                {/* Mock Visual Preview CR80 Layout */}
                <div className="mt-5 border border-dashed border-neutral-200 dark:border-neutral-800 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/40">
                  <div className="aspect-[1.58] w-full rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/60 shadow-inner relative overflow-hidden flex flex-col justify-between p-3">
                    <div className="flex justify-between items-start">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      <div className="w-8 h-2 rounded bg-neutral-200 dark:bg-neutral-700" />
                    </div>
                    <div>
                      <div className="w-14 h-1.5 rounded bg-neutral-200 dark:bg-neutral-700 mb-1" />
                      <div className="w-8 h-1 rounded bg-neutral-100 dark:bg-neutral-700" />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'formats' ? (
        /* ───────────────── TAB: FORMATS ───────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {formats.map((fmt) => {
            const isCr80 = fmt.name.toLowerCase().includes('cr80') || (fmt.width === 85.6 && fmt.height === 53.98);
            return (
              <div
                key={fmt.id}
                className={`group bg-white dark:bg-neutral-850 rounded-2xl border p-5 hover:shadow-lg transition-all duration-300 flex flex-col justify-between ${
                  isCr80 
                    ? 'border-blue-200 dark:border-blue-900/40 ring-1 ring-blue-500/5'
                    : 'border-neutral-200 dark:border-neutral-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-neutral-850 dark:text-white flex items-center gap-1.5">
                        {fmt.name}
                        {isCr80 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-extrabold uppercase tracking-wide">
                            CR80 Standard
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-neutral-450 dark:text-neutral-500 mt-1">
                        Dimensions fixes recommandées pour badges CR80 standardisé.
                      </p>
                    </div>
                    {!isCr80 && (
                      <button
                        onClick={() => handleDeleteFormat(fmt.id, fmt.name)}
                        className="p-1.5 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        title="Supprimer le format"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Dimensions panel */}
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800/40 p-3 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-neutral-450 uppercase tracking-wide">Largeur</p>
                      <p className="text-base font-extrabold text-neutral-850 dark:text-white mt-1">
                        {fmt.width} <span className="text-xs font-semibold text-neutral-400">{fmt.unit}</span>
                      </p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800/40 p-3 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-neutral-450 uppercase tracking-wide">Hauteur</p>
                      <p className="text-base font-extrabold text-neutral-850 dark:text-white mt-1">
                        {fmt.height} <span className="text-xs font-semibold text-neutral-400">{fmt.unit}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 text-[10px] text-neutral-400 font-mono text-center border-t border-neutral-100 dark:border-neutral-800/40 pt-4">
                  Rapport d&apos;aspect : {(fmt.width / fmt.height).toFixed(2)}:1
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ───────────────── TAB: PHYSICAL TYPES ───────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {physicalTypes.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-center shadow-sm">
              <Cpu className="w-8 h-8 text-neutral-400 mb-2" />
              <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Aucun type de carte configuré.</p>
              <p className="text-xs text-neutral-500 mt-1">Ajoutez des technologies de cartes (ex: RFID, NFC, Magnétique, PVC standard).</p>
            </div>
          ) : (
            physicalTypes.map((type) => (
              <div
                key={type.id}
                className="group bg-white dark:bg-neutral-850 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-neutral-850 dark:text-white flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-indigo-500" />
                        {type.name}
                      </h3>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 text-[10px] font-mono">
                        {type.slug}
                      </span>
                      {type.cardCode && (
                        <div className="mt-2 flex items-center gap-1">
                          <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">CODE ID:</span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 text-[10px] font-mono font-bold tracking-wider border border-indigo-100/35 dark:border-indigo-900/30">
                            {type.cardCode}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeletePhysicalType(type.id, type.name)}
                      className="p-1.5 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      title="Supprimer le type de carte"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-neutral-550 dark:text-neutral-400 mt-4 leading-relaxed">
                    {type.description || "Aucune description fournie pour cette technologie ou ce type de carte."}
                  </p>
                </div>

                <div className="mt-5 text-[10px] text-neutral-400 font-mono text-center border-t border-neutral-100 dark:border-neutral-800/40 pt-4">
                  Créé le : {new Date(type.createdAt as any || Date.now()).toLocaleDateString('fr-FR')}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* CREATE CATEGORY MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-850 border border-neutral-250 dark:border-neutral-800 w-full max-w-md p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-neutral-850 dark:text-white mb-2">Ajouter une catégorie de carte</h3>
            <p className="text-xs text-neutral-450 dark:text-neutral-500 mb-4">
              Définit un groupe de badges partageant le même format physique et repère couleur.
            </p>

            <form onSubmit={handleCreateCategory} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Nom de la catégorie</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Visiteur temporaire, VIP, Intervenant"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Couleur d&apos;identification</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {colorsPreset.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategoryColor(c)}
                      className="w-7 h-7 rounded-lg transition-transform hover:scale-110 flex items-center justify-center text-white"
                      style={{ backgroundColor: c }}
                    >
                      {categoryColor === c && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={categoryColor}
                    onChange={(e) => setCategoryColor(e.target.value)}
                    className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={categoryColor}
                    onChange={(e) => setCategoryColor(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Format de Carte</label>
                <select
                  value={categoryFormatId}
                  onChange={(e) => setCategoryFormatId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-medium outline-none"
                >
                  {formats.map((fmt) => (
                    <option key={fmt.id} value={fmt.id}>
                      {fmt.name} ({fmt.width} x {fmt.height} {fmt.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Description (Optionnel)</label>
                <textarea
                  placeholder="Expliquez à quoi sert cette catégorie de badge..."
                  value={categoryDesc}
                  onChange={(e) => setCategoryDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-neutral-100 dark:border-neutral-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 text-xs font-bold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-neutral-500 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Ajouter</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE FORMAT MODAL */}
      {showFormatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-850 border border-neutral-250 dark:border-neutral-800 w-full max-w-md p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-neutral-850 dark:text-white mb-2">Ajouter un format de carte</h3>
            <p className="text-xs text-neutral-450 dark:text-neutral-500 mb-4">
              Configurez des dimensions spécifiques pour d&apos;autres supports ou standards que le CR80.
            </p>

            <form onSubmit={handleCreateFormat} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Nom du format</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Passeport, Badge Événementiel, CR79"
                  value={formatName}
                  onChange={(e) => setFormatName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Largeur</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formatWidth}
                    onChange={(e) => setFormatWidth(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Hauteur</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formatHeight}
                    onChange={(e) => setFormatHeight(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Unité de mesure</label>
                <select
                  value={formatUnit}
                  onChange={(e) => setFormatUnit(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-medium outline-none"
                >
                  <option value="mm">Millimètres (mm)</option>
                  <option value="px">Pixels (px)</option>
                  <option value="in">Pouces (in)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-neutral-100 dark:border-neutral-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowFormatModal(false)}
                  className="px-4 py-2 text-xs font-bold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-neutral-500 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Ajouter</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE PHYSICAL TYPE MODAL */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-850 border border-neutral-250 dark:border-neutral-800 w-full max-w-md p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-neutral-850 dark:text-white mb-2">Ajouter un type de carte</h3>
            <p className="text-xs text-neutral-450 dark:text-neutral-500 mb-4">
              Configurez une technologie de support de carte physique ou d&apos;identification.
            </p>

            <form onSubmit={handleCreatePhysicalType} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Nom du type / Technologie</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: RFID (Mifare 1k), NFC, Bande Magnétique, Code-barres, PVC standard"
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Description (Optionnel)</label>
                <textarea
                  placeholder="Détails techniques, cas d'usage ou consignes pour cette technologie..."
                  value={typeDesc}
                  onChange={(e) => setTypeDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4">
                <label className="block text-xs font-bold text-neutral-550 dark:text-neutral-450 uppercase tracking-wider mb-2">
                  Code unique d&apos;identification (10-15 chars)
                </label>
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-450 dark:text-neutral-500 mb-1">
                      Partie 1 (Max 6)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      placeholder="ABCDEF"
                      value={codePart1}
                      onChange={(e) => setCodePart1(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      className="w-full px-2 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-mono font-bold text-center outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-450 dark:text-neutral-500 mb-1">
                      Partie 2 (Max 5)
                    </label>
                    <input
                      type="text"
                      maxLength={5}
                      required
                      placeholder="12345"
                      value={codePart2}
                      onChange={(e) => setCodePart2(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      className="w-full px-2 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-mono font-bold text-center outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-450 dark:text-neutral-500 mb-1">
                      Partie 3 (Auto-incrément)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="0001"
                      title="S'incrémente automatiquement lors de l'impression de chaque carte"
                      className="w-full px-2 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950 text-neutral-500 rounded-xl text-xs font-mono font-bold text-center outline-none select-none"
                    />
                  </div>
                </div>

                {/* Preview and validation indicator */}
                <div className="mt-3.5 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-150 dark:border-neutral-800 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-neutral-450 dark:text-neutral-500 font-bold uppercase tracking-wider">Aperçu du Code</span>
                    <span className="text-xs font-mono font-bold text-neutral-850 dark:text-white mt-0.5 tracking-wider">
                      {codePart1 || '••••••'}{codePart2 || '•••••'}{codePart3 || '••••'}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-neutral-450 dark:text-neutral-500 font-bold uppercase tracking-wider">Longueur</span>
                    <span className={`text-[10.5px] font-bold font-mono mt-0.5 px-2 py-0.5 rounded-full ${
                      (codePart1.length + codePart2.length + codePart3.length) >= 10 && (codePart1.length + codePart2.length + codePart3.length) <= 15
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                    }`}>
                      {codePart1.length + codePart2.length + codePart3.length} / 15 chars
                    </span>
                  </div>
                </div>

                {(codePart1.length + codePart2.length + codePart3.length) < 10 && (
                  <p className="text-[10px] text-orange-550 dark:text-orange-450 mt-2 font-semibold">
                    * Le code complet doit faire au moins 10 caractères (Partie 1 + Partie 2 doivent faire au moins 6 caractères à elles deux).
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-neutral-100 dark:border-neutral-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTypeModal(false);
                    setTypeName('');
                    setTypeDesc('');
                    setCodePart1('');
                    setCodePart2('');
                    setCodePart3('');
                  }}
                  className="px-4 py-2 text-xs font-bold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-neutral-500 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (codePart1.length + codePart2.length) < 6 || (codePart1.length + codePart2.length) > 11}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition disabled:bg-neutral-100 disabled:text-neutral-400 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500 disabled:cursor-not-allowed shadow-sm"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Ajouter</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
