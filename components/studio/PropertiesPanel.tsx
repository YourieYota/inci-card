'use client';

import React from 'react';
import { Trash2, AlignLeft, AlignCenter, AlignRight, Bold, Italic } from 'lucide-react';
import { StudioElement } from './Canvas';

interface PropertiesPanelProps {
  // Canvas settings
  canvasWidth: number;
  canvasHeight: number;
  canvasBackground: string;
  onUpdateCanvas: (width: number, height: number, background: string) => void;

  // Selected element settings
  selectedElement: StudioElement | null;
  onUpdateElement: (element: StudioElement) => void;
  onDeleteElement: (id: string) => void;
  suggestedFields?: string[];
}

export default function PropertiesPanel({
  canvasWidth,
  canvasHeight,
  canvasBackground,
  onUpdateCanvas,
  selectedElement,
  onUpdateElement,
  onDeleteElement,
  suggestedFields = ['Nom', 'Prenom', 'Role', 'Matricule', 'Entreprise'],
}: PropertiesPanelProps) {
  // Preset backgrounds for easier testing
  const presets = [
    { name: 'Aucun (Blanc)', url: '' },
    { name: 'Gradient Bleu', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80' },
    { name: 'Abstrait Sombre', url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=500&auto=format&fit=crop&q=80' },
    { name: 'Texture Papier', url: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=500&auto=format&fit=crop&q=80' },
  ];

  return (
    <div className="w-full bg-white dark:bg-neutral-850 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col gap-6 max-h-[85vh] overflow-y-auto">
      {selectedElement ? (
        // ELEMENT PROPERTIES
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-850 pb-4">
            <div>
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 uppercase tracking-wide">
                Propriétés de l&apos;élément
              </h3>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                Type : {selectedElement.type === 'text' ? 'Texte' : selectedElement.type === 'image' ? 'Photo' : 'QR Code'}
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
            <div>
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Largeur (px)</label>
              <input
                type="number"
                value={selectedElement.width}
                onChange={(e) => onUpdateElement({ ...selectedElement, width: Math.max(10, parseInt(e.target.value) || 0) })}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Hauteur (px)</label>
              <input
                type="number"
                value={selectedElement.height}
                onChange={(e) => onUpdateElement({ ...selectedElement, height: Math.max(10, parseInt(e.target.value) || 0) })}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Position X</label>
              <input
                type="number"
                value={selectedElement.x}
                onChange={(e) => onUpdateElement({ ...selectedElement, x: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Position Y</label>
              <input
                type="number"
                value={selectedElement.y}
                onChange={(e) => onUpdateElement({ ...selectedElement, y: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm"
              />
            </div>
          </div>

          {/* Text-specific properties */}
          {selectedElement.type === 'text' && (
            <div className="flex flex-col gap-4 border-t border-neutral-100 dark:border-neutral-800 pt-4">
              {/* Field binding vs static text */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">Source de donnée</label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => onUpdateElement({ ...selectedElement, field: undefined, content: 'Texte' })}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      !selectedElement.field
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-900 dark:text-indigo-400'
                        : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    Statique
                  </button>
                  <button
                    onClick={() => onUpdateElement({ ...selectedElement, field: suggestedFields[0], content: undefined })}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
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
                    value={selectedElement.field}
                    onChange={(e) => onUpdateElement({ ...selectedElement, field: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm"
                  >
                    {suggestedFields.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={selectedElement.content || ''}
                    onChange={(e) => onUpdateElement({ ...selectedElement, content: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm"
                    placeholder="Saisir le texte"
                  />
                )}
              </div>

              {/* Font properties */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Taille (px)</label>
                  <input
                    type="number"
                    value={selectedElement.fontSize || 14}
                    onChange={(e) => onUpdateElement({ ...selectedElement, fontSize: Math.max(6, parseInt(e.target.value) || 12) })}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Police</label>
                  <select
                    value={selectedElement.fontFamily || 'sans-serif'}
                    onChange={(e) => onUpdateElement({ ...selectedElement, fontFamily: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm"
                  >
                    <option value="sans-serif">Sans-Serif</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
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
                    className="flex-1 px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm uppercase"
                  />
                </div>
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

                <div className="w-24">
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
                    >
                      <Italic className="w-4 h-4" />
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
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm"
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
          <div className="border-b border-neutral-100 dark:border-neutral-850 pb-4">
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 uppercase tracking-wide">
              Propriétés de la Carte
            </h3>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">Ajustez les dimensions globales et le fond.</p>
          </div>

          {/* Width & Height */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Largeur (px)</label>
              <input
                type="number"
                value={canvasWidth}
                onChange={(e) => onUpdateCanvas(Math.max(100, parseInt(e.target.value) || 324), canvasHeight, canvasBackground)}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Hauteur (px)</label>
              <input
                type="number"
                value={canvasHeight}
                onChange={(e) => onUpdateCanvas(canvasWidth, Math.max(100, parseInt(e.target.value) || 204), canvasBackground)}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onUpdateCanvas(324, 204, canvasBackground)}
              className="flex-1 py-1 px-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-900 text-[10px] text-neutral-600 dark:text-neutral-400 font-medium"
            >
              CR80 Paysage (324x204)
            </button>
            <button
              onClick={() => onUpdateCanvas(204, 324, canvasBackground)}
              className="flex-1 py-1 px-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-900 text-[10px] text-neutral-600 dark:text-neutral-400 font-medium"
            >
              CR80 Portrait (204x324)
            </button>
          </div>

          {/* Background URL input */}
          <div className="flex flex-col gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Image de fond (URL)</label>
              <input
                type="text"
                value={canvasBackground}
                onChange={(e) => onUpdateCanvas(canvasWidth, canvasHeight, e.target.value)}
                placeholder="Insérer l'URL de l'image"
                className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-2">Exemples Prédéfinis</label>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => onUpdateCanvas(canvasWidth, canvasHeight, preset.url)}
                    className={`p-2 rounded-xl text-[10px] border font-medium text-left truncate transition ${
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
            <span className="font-semibold text-indigo-700 dark:text-indigo-400 block mb-1">Astuce :</span>
            Cliquez sur un élément dans le canevas pour en modifier ses coordonnées, sa police de caractère, sa couleur ou le lier à une variable Excel.
          </div>
        </div>
      )}
    </div>
  );
}
