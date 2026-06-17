"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Laptop } from "lucide-react";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Évite les erreurs d'hydratation (le thème n'est connu que côté client)
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Gérez vos préférences et paramètres d'application.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">Apparence</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Personnalisez le thème de l'application selon vos préférences.
          </p>
        </div>
        
        <div className="p-6">
          <div className="flex gap-4">
            <button
              onClick={() => setTheme("light")}
              className={`flex-1 flex flex-col items-center p-4 border-2 rounded-xl transition-all ${
                theme === "light" 
                  ? "border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" 
                  : "border-slate-200 dark:border-slate-700 hover:border-blue-300 text-slate-600 dark:text-slate-400"
              }`}
            >
              <Sun className="w-8 h-8 mb-2" />
              <span className="font-medium text-sm">Clair</span>
            </button>
            
            <button
              onClick={() => setTheme("dark")}
              className={`flex-1 flex flex-col items-center p-4 border-2 rounded-xl transition-all ${
                theme === "dark" 
                  ? "border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" 
                  : "border-slate-200 dark:border-slate-700 hover:border-blue-300 text-slate-600 dark:text-slate-400"
              }`}
            >
              <Moon className="w-8 h-8 mb-2" />
              <span className="font-medium text-sm">Sombre</span>
            </button>
            
            <button
              onClick={() => setTheme("system")}
              className={`flex-1 flex flex-col items-center p-4 border-2 rounded-xl transition-all ${
                theme === "system" 
                  ? "border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" 
                  : "border-slate-200 dark:border-slate-700 hover:border-blue-300 text-slate-600 dark:text-slate-400"
              }`}
            >
              <Laptop className="w-8 h-8 mb-2" />
              <span className="font-medium text-sm">Système</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
