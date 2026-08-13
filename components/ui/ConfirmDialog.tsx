'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, Trash2, Info, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────
type Variant = 'danger' | 'warning' | 'info';

interface ConfirmOptions {
  title: string;
  message: string;
  variant?: Variant;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmDialogContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | undefined>(undefined);

// ── Variant config ─────────────────────────────────────────────────────
const VARIANT_CONFIG: Record<Variant, {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  btnBg: string;
  btnHover: string;
}> = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-red-100 dark:bg-red-950/40',
    iconColor: 'text-red-600 dark:text-red-400',
    btnBg: 'bg-red-600 dark:bg-red-600',
    btnHover: 'hover:bg-red-700 dark:hover:bg-red-500',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100 dark:bg-amber-950/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    btnBg: 'bg-amber-600 dark:bg-amber-600',
    btnHover: 'hover:bg-amber-700 dark:hover:bg-amber-500',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-100 dark:bg-blue-950/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    btnBg: 'bg-blue-600 dark:bg-blue-600',
    btnHover: 'hover:bg-blue-700 dark:hover:bg-blue-500',
  },
};

// ── Provider ───────────────────────────────────────────────────────────
export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
    message: '',
    variant: 'info',
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    setOpen(false);
    // Wait for exit animation before resolving
    setTimeout(() => {
      resolveRef.current?.(result);
      resolveRef.current = null;
    }, 150);
  }, []);

  const variant = options.variant || 'info';
  const config = VARIANT_CONFIG[variant];
  const IconComponent = config.icon;

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}

      {/* Overlay + Modal */}
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => handleClose(false)}
          />

          {/* Dialog */}
          <div className="relative w-full max-w-md bg-white dark:bg-[#131b2e] rounded-2xl shadow-2xl dark:shadow-black/40 border border-slate-200 dark:border-slate-700/80 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            {/* Close button */}
            <button
              onClick={() => handleClose(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Content */}
            <div className="p-6 pt-8 flex flex-col items-center text-center">
              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl ${config.iconBg} flex items-center justify-center mb-4`}>
                <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {options.title}
              </h3>

              {/* Message */}
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
                {options.message}
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => handleClose(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {options.cancelText || 'Annuler'}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white ${config.btnBg} ${config.btnHover} shadow-sm transition-colors`}
              >
                {options.confirmText || 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────
export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within a ConfirmDialogProvider');
  }
  return context;
}
