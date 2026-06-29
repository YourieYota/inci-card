'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Trash2, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Upload, Type, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown } from 'lucide-react';
import { StudioElement } from './Canvas';

interface PropertiesPanelProps {
  // Canvas settings
  canvasWidth: number;
  canvasHeight: number;
  canvasBackground: string;
  canvasBackgroundOpacity: number; // range 0 to 1
  canvasBorderRadius: number;
  onUpdateCanvas: (width: number, height: number, background: string, opacity: number, borderRadius: number) => void;

  // Selected element settings
  selectedElement: StudioElement | null;
  onUpdateElement: (element: StudioElement) => void;
  onDeleteElement: (id: string) => void;
  suggestedFields?: string[];
  formats: any[];
  onMoveElement?: (direction: 'front' | 'back' | 'up' | 'down') => void;
}

interface DimensionInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  elementId?: string; // used to reset state when a different element is selected
  isMm?: boolean;
}

function DimensionInput({ label, value, onChange, min, elementId, isMm = false }: DimensionInputProps) {
  const getDisplayVal = (val: number) => isMm ? (val * 0.264583).toFixed(1) : val.toString();
  const [localValue, setLocalValue] = useState<string>(getDisplayVal(value));
  const isFocused = React.useRef(false);

  // Sync from prop when a DIFFERENT element is selected (elementId changes)
  useEffect(() => {
    isFocused.current = false;
    setLocalValue(getDisplayVal(value));
  }, [elementId, value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Also resync when focus is lost so we have the latest committed value
  const handleFocus = () => {
    isFocused.current = true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setLocalValue(valStr);

    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && (min === undefined || parsed >= min)) {
      onChange(isMm ? Math.round(parsed / 0.264583) : Math.round(parsed));
    }
  };

  const handleBlur = () => {
    isFocused.current = false;
    const parsed = parseFloat(localValue);
    if (isNaN(parsed) || (min !== undefined && parsed < min)) {
      setLocalValue(getDisplayVal(value));
    } else {
      onChange(isMm ? Math.round(parsed / 0.264583) : Math.round(parsed));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div>
      <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      <input
        type="number"
        step={isMm ? "0.1" : "1"}
        value={localValue}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
      />
    </div>
  );
}

export default function PropertiesPanel({
  canvasWidth,
  canvasHeight,
  canvasBackground,
  canvasBackgroundOpacity,
  canvasBorderRadius,
  onUpdateCanvas,
  selectedElement,
  onUpdateElement,
  onDeleteElement,
  suggestedFields = ['Nom', 'Prenom', 'Role', 'Matricule', 'Entreprise'],
  formats = [],
  onMoveElement,
}: PropertiesPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('studio_recent_colors');
    if (saved) {
      try {
        setRecentColors(JSON.parse(saved));
      } catch (e) {
        setRecentColors(['#000000', '#ffffff', '#1e3c72', '#ff9966', '#0f9b0f', '#764ba2', '#1f2937']);
      }
    } else {
      setRecentColors(['#000000', '#ffffff', '#1e3c72', '#ff9966', '#0f9b0f', '#764ba2', '#1f2937']);
    }
  }, []);

  useEffect(() => {
    if (!selectedElement) return;
    
    let colorToSave: string | undefined;
    if (selectedElement.type === 'text' && selectedElement.color) {
      colorToSave = selectedElement.color;
    } else if ((selectedElement.type === 'image' || selectedElement.type === 'logo' || selectedElement.type === 'qr') && selectedElement.borderColor) {
      colorToSave = selectedElement.borderColor;
    }

    if (colorToSave) {
      const color = colorToSave.toLowerCase();
      const timer = setTimeout(() => {
        setRecentColors((prev) => {
          const filtered = prev.filter((c) => c.toLowerCase() !== color);
          const updated = [colorToSave!, ...filtered].slice(0, 10);
          localStorage.setItem('studio_recent_colors', JSON.stringify(updated));
          return updated;
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedElement?.id, selectedElement?.color, selectedElement?.borderColor]);

  // Preset background images
  const presets = [
    { name: 'Aucun (Blanc)', url: '' },
    { name: 'Gradient Bleu', url: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' },
    { name: 'Sunset Orange', url: 'linear-gradient(135deg, #ff9966 0%, #ff5e62 100%)' },
    { name: 'Émeraude', url: 'linear-gradient(135deg, #0f9b0f 0%, #000000 100%)' },
    { name: 'Royal Purple', url: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { name: 'Sleek Dark', url: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)' },
  ];

  // Handle local background image upload (converts file to Base64)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          onUpdateCanvas(canvasWidth, canvasHeight, reader.result as string, canvasBackgroundOpacity, canvasBorderRadius);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="w-full bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col gap-6 max-h-[85vh] overflow-y-auto">
      {selectedElement ? (
        // ELEMENT PROPERTIES
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
            <div>
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 uppercase tracking-wide">
                Propriétés de l&apos;élément
              </h3>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                Type : {selectedElement.type === 'text' ? 'Texte' : selectedElement.type === 'image' ? 'Photo' : selectedElement.type === 'logo' ? 'Logo / Image' : 'QR Code'}
              </p>
            </div>
            <button
              onClick={() => onDeleteElement(selectedElement.id)}
              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all duration-200"
              title="Supprimer l'élément"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Sizing & Position (x, y, w, h) */}
          <div className="grid grid-cols-2 gap-3">
            <DimensionInput
              label="Largeur (mm)"
              value={selectedElement.width}
              min={1}
              isMm={true}
              elementId={selectedElement.id}
              onChange={(val) => onUpdateElement({ ...selectedElement, width: val })}
            />
            <DimensionInput
              label="Hauteur (mm)"
              value={selectedElement.height}
              min={1}
              isMm={true}
              elementId={selectedElement.id}
              onChange={(val) => onUpdateElement({ ...selectedElement, height: val })}
            />
            <DimensionInput
              label="Position X (mm)"
              value={selectedElement.x}
              isMm={true}
              elementId={selectedElement.id}
              onChange={(val) => onUpdateElement({ ...selectedElement, x: val })}
            />
            <DimensionInput
              label="Position Y (mm)"
              value={selectedElement.y}
              isMm={true}
              elementId={selectedElement.id}
              onChange={(val) => onUpdateElement({ ...selectedElement, y: val })}
            />
          </div>

          {/* Opacity Slider for Elements */}
          <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4">
            <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
              Opacité ({Math.round((selectedElement.opacity !== undefined ? selectedElement.opacity : 1) * 100)}%)
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={selectedElement.opacity !== undefined ? selectedElement.opacity : 1}
              onChange={(e) => onUpdateElement({ ...selectedElement, opacity: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Border Radius for Element */}
          <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4">
            <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
              Arrondi des angles ({selectedElement.borderRadius || 0}px)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={selectedElement.borderRadius || 0}
              onChange={(e) => onUpdateElement({ ...selectedElement, borderRadius: parseInt(e.target.value) || 0 })}
              className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Rotation (Pivotement) */}
          <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4">
            <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
              Rotation ({selectedElement.rotation || 0}°)
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={selectedElement.rotation || 0}
                onChange={(e) => onUpdateElement({ ...selectedElement, rotation: parseInt(e.target.value) || 0 })}
                className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <input
                type="number"
                min="0"
                max="360"
                value={selectedElement.rotation || 0}
                onChange={(e) => {
                  let val = parseInt(e.target.value) || 0;
                  if (val < 0) val = 0;
                  if (val > 360) val = 360;
                  onUpdateElement({ ...selectedElement, rotation: val });
                }}
                className="w-16 px-2 py-1 text-center border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Layer Ordering (Calques) */}
          {onMoveElement && (
            <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4">
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
                Ordre du calque
              </label>
              <div className="flex border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-50 dark:bg-neutral-900 p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => onMoveElement('front')}
                  className="flex-1 py-2 flex justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                  title="Placer tout devant (Premier plan)"
                >
                  <ChevronsUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveElement('up')}
                  className="flex-1 py-2 flex justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                  title="Avancer d'un niveau"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveElement('down')}
                  className="flex-1 py-2 flex justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                  title="Reculer d'un niveau"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveElement('back')}
                  className="flex-1 py-2 flex justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                  title="Placer tout derrière (Arrière-plan)"
                >
                  <ChevronsDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Options de Fusion (Blend Mode) */}
          <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4">
            <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
              Mode de fusion
            </label>
            <div className="relative">
              <select
                value={selectedElement.blendMode || 'normal'}
                onChange={(e) => onUpdateElement({ ...selectedElement, blendMode: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer transition appearance-none pr-8"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundPosition: 'right 0.5rem center',
                  backgroundSize: '1.25em 1.25em',
                  backgroundRepeat: 'no-repeat',
                }}
              >
                <option value="normal">Normal (Défaut)</option>
                <option value="multiply">Produit (Multiply)</option>
                <option value="screen">Superposition (Screen)</option>
                <option value="overlay">Incrustation (Overlay)</option>
                <option value="darken">Obscurcir (Darken)</option>
                <option value="lighten">Éclaircir (Lighten)</option>
                <option value="color-dodge">Densité couleur - (Color Dodge)</option>
                <option value="color-burn">Densité couleur + (Color Burn)</option>
                <option value="hard-light">Lumière crue (Hard Light)</option>
                <option value="soft-light">Lumière tamisée (Soft Light)</option>
                <option value="difference">Différence (Difference)</option>
                <option value="exclusion">Exclusion</option>
                <option value="hue">Teinte (Hue)</option>
                <option value="saturation">Saturation</option>
                <option value="color">Couleur (Color)</option>
                <option value="luminosity">Luminosité (Luminosity)</option>
              </select>
            </div>
          </div>

          {/* Border Width & Color for Image/Logo/QR */}
          {(selectedElement.type === 'image' || selectedElement.type === 'logo' || selectedElement.type === 'qr') && (
            <div className="flex flex-col gap-4 border-t border-neutral-100 dark:border-neutral-800 pt-4">
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
                  Épaisseur de la bordure ({selectedElement.borderWidth || 0}px)
                </label>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="1"
                  value={selectedElement.borderWidth || 0}
                  onChange={(e) => onUpdateElement({ ...selectedElement, borderWidth: parseInt(e.target.value) || 0, borderColor: selectedElement.borderColor || '#000000' })}
                  className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {selectedElement.borderWidth !== undefined && selectedElement.borderWidth > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
                    Couleur de la bordure
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={selectedElement.borderColor || '#000000'}
                      onChange={(e) => onUpdateElement({ ...selectedElement, borderColor: e.target.value })}
                      className="w-10 h-10 border border-neutral-200 dark:border-neutral-800 bg-transparent rounded-lg cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={selectedElement.borderColor || '#000000'}
                      onChange={(e) => onUpdateElement({ ...selectedElement, borderColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm uppercase font-mono font-semibold"
                    />
                  </div>
                  
                  {recentColors.length > 0 && (
                    <div className="mt-2.5">
                      <span className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
                        Couleurs récentes
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {recentColors.map((color, idx) => (
                          <button
                            key={`border-${color}-${idx}`}
                            type="button"
                            onClick={() => onUpdateElement({ ...selectedElement, borderColor: color })}
                            className="w-6 h-6 rounded-full border border-neutral-200 dark:border-neutral-700 cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Intaglio security effect for Employee Photo (image) */}
          {selectedElement.type === 'image' && (
            <div className="flex flex-col gap-4 border-t border-neutral-100 dark:border-neutral-800 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-xs font-bold text-neutral-800 dark:text-white">
                    Effet Intaglio (Taille-douce)
                  </span>
                  <span className="block text-[10px] text-neutral-400 dark:text-neutral-500">
                    Simuler une gravure de billet de banque
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedElement.intaglio || false}
                    onChange={(e) =>
                      onUpdateElement({
                        ...selectedElement,
                        intaglio: e.target.checked,
                        intaglioSpacing: selectedElement.intaglioSpacing || 10,
                        intaglioLineWidth: selectedElement.intaglioLineWidth || 0.85,
                        intaglioWaveAmp: selectedElement.intaglioWaveAmp || 7,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-neutral-200 dark:bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {selectedElement.intaglio && (
                <div className="flex flex-col gap-3.5 bg-neutral-50 dark:bg-neutral-900/50 p-3 rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50">
                  {/* Spacing */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
                        Espacement des traits ({selectedElement.intaglioSpacing || 10})
                      </label>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="25"
                      step="1"
                      value={selectedElement.intaglioSpacing || 10}
                      onChange={(e) =>
                        onUpdateElement({
                          ...selectedElement,
                          intaglioSpacing: parseInt(e.target.value) || 10,
                        })
                      }
                      className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Line Width */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
                        Épaisseur de l&apos;encre ({selectedElement.intaglioLineWidth || 0.85})
                      </label>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="2.0"
                      step="0.05"
                      value={selectedElement.intaglioLineWidth || 0.85}
                      onChange={(e) =>
                        onUpdateElement({
                          ...selectedElement,
                          intaglioLineWidth: parseFloat(e.target.value) || 0.85,
                        })
                      }
                      className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Wave Amplitude */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
                        Amplitude de l&apos;ondulation ({selectedElement.intaglioWaveAmp || 7})
                      </label>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="0.5"
                      value={selectedElement.intaglioWaveAmp || 7}
                      onChange={(e) =>
                        onUpdateElement({
                          ...selectedElement,
                          intaglioWaveAmp: parseFloat(e.target.value) || 7,
                        })
                      }
                      className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Logo Image Uploader */}
          {selectedElement.type === 'logo' && (
            <div className="flex flex-col gap-3 border-t border-neutral-100 dark:border-neutral-800 pt-4">
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
                  Source de l&apos;Image / Logo
                </label>
                <input
                  type="text"
                  value={selectedElement.logoUrl || ''}
                  onChange={(e) => onUpdateElement({ ...selectedElement, logoUrl: e.target.value })}
                  placeholder="URL de l'image (ex: https://...)"
                  className="w-full px-3 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-mono"
                />
              </div>
              {selectedElement.logoUrl && (
                <div className="flex items-center gap-3 p-2 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
                  <img src={selectedElement.logoUrl} className="w-10 h-10 object-contain rounded bg-white border border-neutral-200 dark:border-neutral-700" alt="Preview" />
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate flex-1 font-mono">
                    {selectedElement.logoUrl.startsWith('data:') ? 'Image locale (Base64)' : selectedElement.logoUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateElement({ ...selectedElement, logoUrl: '' })}
                    className="text-xs text-rose-500 hover:text-rose-600 font-bold px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
                  >
                    Effacer
                  </button>
                </div>
              )}
              <div>
                <input
                  type="file"
                  id="logo-upload-input"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        if (reader.result) {
                          onUpdateElement({ ...selectedElement, logoUrl: reader.result as string });
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('logo-upload-input')?.click()}
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-3 border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 rounded-xl text-xs font-bold transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Uploader un logo/image</span>
                </button>
              </div>
            </div>
          ) }

          {/* Text-specific properties */}
          {selectedElement.type === 'text' && (
            <div className="flex flex-col gap-4 border-t border-neutral-100 dark:border-neutral-800 pt-4">
              {/* Field binding vs static text */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">Source de donnée</label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => onUpdateElement({ ...selectedElement, field: undefined, content: 'Texte' })}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-all ${
                      !selectedElement.field
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-900 dark:text-indigo-400'
                        : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    Statique
                  </button>
                  <button
                    onClick={() => onUpdateElement({ ...selectedElement, field: suggestedFields[0], content: undefined })}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-all ${
                      selectedElement.field
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-900 dark:text-indigo-400'
                        : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    Dynamique
                  </button>
                </div>

                {selectedElement.field ? (
                  <select
                    value={selectedElement.field || ''}
                    onChange={(e) => onUpdateElement({ ...selectedElement, field: e.target.value })}
                    className="w-full px-3 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold"
                  >
                    {suggestedFields.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <input
                      type="text"
                      value={selectedElement.content || ''}
                      onChange={(e) => onUpdateElement({ ...selectedElement, content: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold"
                      placeholder="Saisir le texte"
                    />
                    <div className="text-[10px] text-neutral-400 dark:text-neutral-500 leading-normal px-1">
                      Astuce : Insérez des champs dynamiques en écrivant :{" "}
                      <span className="font-bold text-neutral-600 dark:text-neutral-400">
                        {suggestedFields.map(f => `{${f}}`).join(", ")}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Font properties */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Taille</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      value={selectedElement.fontSize || 14}
                      onChange={(e) => onUpdateElement({ ...selectedElement, fontSize: Math.max(6, parseInt(e.target.value) || 12) })}
                      className="w-full px-2.5 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold"
                    />
                    <select
                      value={selectedElement.fontSizeUnit || 'px'}
                      onChange={(e) => onUpdateElement({ ...selectedElement, fontSizeUnit: e.target.value as 'px' | 'pt' })}
                      className="px-2 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold min-w-[55px] cursor-pointer"
                    >
                      <option value="px">px</option>
                      <option value="pt">pt</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Police</label>
                  <select
                    value={selectedElement.fontFamily || 'sans-serif'}
                    onChange={(e) => onUpdateElement({ ...selectedElement, fontFamily: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold"
                  >
                    <optgroup label="Bases">
                      <option value="sans-serif">Sans-Serif par défaut</option>
                      <option value="serif">Serif par défaut</option>
                      <option value="monospace">Monospace</option>
                    </optgroup>
                    <optgroup label="Sans-Serif populaires">
                      <option value="Arial, sans-serif">Arial</option>
                      <option value="Helvetica, sans-serif">Helvetica</option>
                      <option value="Verdana, sans-serif">Verdana</option>
                      <option value='"Trebuchet MS", sans-serif'>Trebuchet MS</option>
                      <option value="Tahoma, sans-serif">Tahoma</option>
                    </optgroup>
                    <optgroup label="Serif populaires">
                      <option value='"Times New Roman", serif'>Times New Roman</option>
                      <option value="Georgia, serif">Georgia</option>
                      <option value="Garamond, serif">Garamond</option>
                      <option value='"Palatino Linotype", Palatino, serif'>Palatino</option>
                      <option value='"Bookman Old Style", Bookman, serif'>Bookman</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Color & Styling */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Couleur du texte</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={selectedElement.color || '#000000'}
                    onChange={(e) => onUpdateElement({ ...selectedElement, color: e.target.value })}
                    className="w-10 h-10 border border-neutral-200 dark:border-neutral-800 bg-transparent rounded-lg cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={selectedElement.color || '#000000'}
                    onChange={(e) => onUpdateElement({ ...selectedElement, color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm uppercase font-mono font-semibold"
                  />
                </div>
                
                {recentColors.length > 0 && (
                  <div className="mt-2.5">
                    <span className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
                      Couleurs récentes
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {recentColors.map((color, idx) => (
                        <button
                          key={`${color}-${idx}`}
                          type="button"
                          onClick={() => onUpdateElement({ ...selectedElement, color })}
                          className="w-6 h-6 rounded-full border border-neutral-200 dark:border-neutral-700 cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Formatting & Alignment */}
              <div className="flex gap-4 pt-1">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Alignement</label>
                  <div className="flex border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-50 dark:bg-neutral-900">
                    <button
                      onClick={() => onUpdateElement({ ...selectedElement, alignment: 'left' })}
                      className={`flex-1 py-2 flex justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
                        selectedElement.alignment === 'left' || !selectedElement.alignment ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' : 'text-neutral-500'
                      }`}
                    >
                      <AlignLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onUpdateElement({ ...selectedElement, alignment: 'center' })}
                      className={`flex-1 py-2 flex justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
                        selectedElement.alignment === 'center' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' : 'text-neutral-500'
                      }`}
                    >
                      <AlignCenter className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onUpdateElement({ ...selectedElement, alignment: 'right' })}
                      className={`flex-1 py-2 flex justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
                        selectedElement.alignment === 'right' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' : 'text-neutral-500'
                      }`}
                    >
                      <AlignRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="w-36">
                  <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Style</label>
                  <div className="flex border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-50 dark:bg-neutral-900">
                    <button
                      onClick={() =>
                        onUpdateElement({
                          ...selectedElement,
                          fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold',
                        })
                      }
                      className={`flex-1 py-2 flex justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
                        selectedElement.fontWeight === 'bold' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' : 'text-neutral-500'
                      }`}
                      title="Gras"
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        onUpdateElement({
                          ...selectedElement,
                          fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic',
                        })
                      }
                      className={`flex-1 py-2 flex justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
                        selectedElement.fontStyle === 'italic' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' : 'text-neutral-500'
                      }`}
                      title="Italique"
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        onUpdateElement({
                          ...selectedElement,
                          textTransform: selectedElement.textTransform === 'uppercase' ? 'none' : 'uppercase',
                        })
                      }
                      className={`flex-1 py-2 flex justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
                        selectedElement.textTransform === 'uppercase' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' : 'text-neutral-500'
                      }`}
                      title="Majuscules"
                    >
                      <Type className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* QR Code specific properties */}
          {selectedElement.type === 'qr' && (
            <div className="flex flex-col gap-4 border-t border-neutral-100 dark:border-neutral-800 pt-4">
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">Lier la valeur au champ</label>
                <select
                  value={selectedElement.field || ''}
                  onChange={(e) => onUpdateElement({ ...selectedElement, field: e.target.value })}
                  className="w-full px-3 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold"
                >
                  {suggestedFields.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
                  La valeur contenue dans ce champ Excel sera encodée dans le QR Code.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        // CANVAS/TEMPLATE PROPERTIES
        <div className="flex flex-col gap-5">
          <div className="border-b border-neutral-100 dark:border-neutral-800 pb-4">
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 uppercase tracking-wide">
              Propriétés de la Carte
            </h3>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">Ajustez les dimensions globales et le fond.</p>
          </div>

          {/* Width & Height */}
          <div className="grid grid-cols-2 gap-3">
            <DimensionInput
              label="Largeur (mm)"
              value={canvasWidth}
              min={10}
              isMm={true}
              onChange={(val) => onUpdateCanvas(val, canvasHeight, canvasBackground, canvasBackgroundOpacity, canvasBorderRadius)}
            />
            <DimensionInput
              label="Hauteur (mm)"
              value={canvasHeight}
              min={10}
              isMm={true}
              onChange={(val) => onUpdateCanvas(canvasWidth, val, canvasBackground, canvasBackgroundOpacity, canvasBorderRadius)}
            />
          </div>
          {/* Preset format selector */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
              Format Prédéfini
            </label>
            <select
              value={(() => {
                const matched = formats.find(f => {
                  const wPx = Math.round(f.width / 0.264583);
                  const hPx = Math.round(f.height / 0.264583);
                  return (canvasWidth === wPx && canvasHeight === hPx) || (canvasWidth === hPx && canvasHeight === wPx);
                });
                return matched ? matched.id : 'custom';
              })()}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'custom') return;
                const matched = formats.find(f => f.id === val);
                if (matched) {
                  const wPx = Math.round(matched.width / 0.264583);
                  const hPx = Math.round(matched.height / 0.264583);
                  
                  if (canvasWidth >= canvasHeight) {
                    const targetW = Math.max(wPx, hPx);
                    const targetH = Math.min(wPx, hPx);
                    onUpdateCanvas(targetW, targetH, canvasBackground, canvasBackgroundOpacity, canvasBorderRadius);
                  } else {
                    const targetW = Math.min(wPx, hPx);
                    const targetH = Math.max(wPx, hPx);
                    onUpdateCanvas(targetW, targetH, canvasBackground, canvasBackgroundOpacity, canvasBorderRadius);
                  }
                }
              }}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
            >
              <option value="custom">Format Personnalisé</option>
              {formats.map((fmt) => (
                <option key={fmt.id} value={fmt.id}>
                  {fmt.name} ({fmt.width} x {fmt.height} {fmt.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Orientation Selector */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              type="button"
              onClick={() => {
                if (canvasWidth < canvasHeight) {
                  onUpdateCanvas(canvasHeight, canvasWidth, canvasBackground, canvasBackgroundOpacity, canvasBorderRadius);
                }
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                canvasWidth >= canvasHeight
                  ? 'border-indigo-500 bg-indigo-50/50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              Paysage
            </button>
            <button
              type="button"
              onClick={() => {
                if (canvasWidth > canvasHeight) {
                  onUpdateCanvas(canvasHeight, canvasWidth, canvasBackground, canvasBackgroundOpacity, canvasBorderRadius);
                }
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                canvasWidth < canvasHeight
                  ? 'border-indigo-500 bg-indigo-50/50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              Portrait
            </button>
          </div>

          {/* Background URL input & File Upload */}
          <div className="flex flex-col gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                Image de fond (URL)
              </label>
              <input
                type="text"
                value={(canvasBackground || '').startsWith('data:') ? 'Image Locale (Base64)' : (canvasBackground || '')}
                onChange={(e) => onUpdateCanvas(canvasWidth, canvasHeight, e.target.value, canvasBackgroundOpacity, canvasBorderRadius)}
                placeholder="Insérer l'URL de l'image"
                className="w-full px-3 py-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-mono"
              />
            </div>

            {/* Local Image Uploader */}
            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-3 border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 rounded-xl text-xs font-bold transition"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Uploader une création locale</span>
              </button>
            </div>

            {/* Background Opacity */}
            <div className="mt-1">
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
                Opacité du fond ({Math.round(canvasBackgroundOpacity * 100)}%)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={canvasBackgroundOpacity}
                onChange={(e) => onUpdateCanvas(canvasWidth, canvasHeight, canvasBackground, parseFloat(e.target.value), canvasBorderRadius)}
                className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Card Border Radius */}
            <div className="mt-1">
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
                Arrondi de la carte ({canvasBorderRadius}px)
              </label>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={canvasBorderRadius}
                onChange={(e) => onUpdateCanvas(canvasWidth, canvasHeight, canvasBackground, canvasBackgroundOpacity, parseInt(e.target.value) || 0)}
                className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Themes Presets */}
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-2">Thèmes de Couleur & Gradients</label>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => onUpdateCanvas(canvasWidth, canvasHeight, preset.url, canvasBackgroundOpacity, canvasBorderRadius)}
                    className={`p-2.5 rounded-xl text-[10px] border font-bold text-left truncate transition ${
                      canvasBackground === preset.url
                        ? 'border-indigo-500 bg-indigo-50/50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-xl bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-950/50 text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="font-bold text-indigo-700 dark:text-indigo-400 block mb-1">Raccourcis Clavier :</span>
            <ul className="list-disc pl-4 space-y-1 mt-1 font-medium">
              <li>Déplacer : <span className="font-bold text-neutral-700 dark:text-neutral-200">Flèches</span> (+ Shift pour +10px)</li>
              <li>Supprimer : <span className="font-bold text-neutral-700 dark:text-neutral-200">Delete / Backspace</span></li>
              <li>Copier / Coller : <span className="font-bold text-neutral-700 dark:text-neutral-200">Ctrl + C / V</span></li>
              <li>Annuler / Rétablir : <span className="font-bold text-neutral-700 dark:text-neutral-200">Ctrl + Z / Y</span></li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
