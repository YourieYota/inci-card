'use client';

import React from 'react';
import { Type, User, QrCode, FileText, Plus } from 'lucide-react';
import { StudioElement } from './Canvas';

interface ToolbarProps {
  onAddElement: (type: 'text' | 'image' | 'qr', customProps?: Partial<StudioElement>) => void;
  suggestedFields?: string[];
}

export default function Toolbar({ onAddElement, suggestedFields = ['Nom', 'Prenom', 'Role', 'Matricule', 'Entreprise'] }: ToolbarProps) {
  return (
    <div className="w-full bg-white dark:bg-neutral-850 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-1">Outils de création</h3>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">Ajoutez des éléments sur votre canevas.</p>
      </div>

      <div className="flex flex-col gap-2">
        {/* Static Text */}
        <button
          onClick={() => onAddElement('text', { content: 'Texte Statique' })}
          className="flex items-center gap-3 w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-indigo-50/50 hover:border-indigo-200 dark:hover:bg-indigo-950/20 dark:hover:border-indigo-900 text-neutral-700 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium text-sm transition-all duration-200"
        >
          <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50">
            <Type className="w-4 h-4" />
          </div>
          <span>Texte Statique</span>
          <Plus className="w-3.5 h-3.5 ml-auto opacity-50" />
        </button>

        {/* Photo Area */}
        <button
          onClick={() => onAddElement('image')}
          className="flex items-center gap-3 w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-indigo-50/50 hover:border-indigo-200 dark:hover:bg-indigo-950/20 dark:hover:border-indigo-900 text-neutral-700 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium text-sm transition-all duration-200"
        >
          <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
            <User className="w-4 h-4" />
          </div>
          <span>Photo Employé</span>
          <Plus className="w-3.5 h-3.5 ml-auto opacity-50" />
        </button>

        {/* QR Code */}
        <button
          onClick={() => onAddElement('qr', { field: 'Matricule' })}
          className="flex items-center gap-3 w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-indigo-50/50 hover:border-indigo-200 dark:hover:bg-indigo-950/20 dark:hover:border-indigo-900 text-neutral-700 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium text-sm transition-all duration-200"
        >
          <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
            <QrCode className="w-4 h-4" />
          </div>
          <span>QR Code</span>
          <Plus className="w-3.5 h-3.5 ml-auto opacity-50" />
        </button>
      </div>

      <div className="border-t border-neutral-150 dark:border-neutral-800 pt-5">
        <h4 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-3">Champs Excel Dynamiques</h4>
        <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
          {suggestedFields.map((field) => (
            <button
              key={field}
              onClick={() => onAddElement('text', { field })}
              className="flex items-center gap-2.5 w-full p-2.5 text-left rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 text-xs font-medium border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 transition-all duration-200"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>{field}</span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 ml-auto bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded font-mono">
                {`{${field}}`}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
