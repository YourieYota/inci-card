'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { WifiOff, Wifi, X, RefreshCw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getOfflineQueue } from '@/lib/offlineQueue';
import { fetchAllPreCacheData } from '@/app/actions/preCache';
import { safeSetItem, safeGetItem, cleanEmployeesForCache } from '@/lib/storage';
import { runFullSync, getSyncStatus } from '@/lib/syncEngine';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const [queueSize, setQueueSize] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<string>('');

  // Mettre à jour le statut de sync depuis le moteur
  const refreshStatus = useCallback(() => {
    const status = getSyncStatus();
    setQueueSize(status.pendingCount);
    setIsSyncing(status.isRunning);
    setLastSyncedAt(status.lastSyncedAt);
  }, []);

  // Sync automatique au retour en ligne
  const triggerAutoSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    setSyncError(null);
    setSyncProgress('Envoi des modifications...');

    try {
      const result = await runFullSync();
      if (result.success) {
        setSyncProgress('');
        refreshStatus();
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 4000);
      } else {
        setSyncError(
          result.errors.length > 0
            ? result.errors[0]
            : 'Certaines modifications n\'ont pas pu être synchronisées.'
        );
      }
    } catch (err: any) {
      setSyncError(err.message || 'Erreur lors de la synchronisation.');
    } finally {
      setIsSyncing(false);
      setSyncProgress('');
      refreshStatus();
    }
  }, [isSyncing, refreshStatus]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshStatus();

    const handleOnline = () => {
      setIsOnline(true);
      setDismissed(false);
      if (wasOffline) {
        setShowReconnected(true);
        setWasOffline(false);
        setTimeout(() => setShowReconnected(false), 4000);
        // Déclencher la sync automatiquement
        triggerAutoSync();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setDismissed(false);
    };

    const handleQueueChange = () => refreshStatus();

    const handleSyncStart = () => {
      setIsSyncing(true);
      setSyncProgress('Synchronisation en cours...');
    };

    const handleSyncComplete = (e: Event) => {
      const result = (e as CustomEvent).detail;
      setIsSyncing(false);
      setSyncProgress('');
      refreshStatus();
      if (result?.errors?.length > 0) {
        setSyncError(result.errors[0]);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('inci-offline-mutations-changed', handleQueueChange);
    window.addEventListener('inci-sync-start', handleSyncStart);
    window.addEventListener('inci-sync-complete', handleSyncComplete);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('inci-offline-mutations-changed', handleQueueChange);
      window.removeEventListener('inci-sync-start', handleSyncStart);
      window.removeEventListener('inci-sync-complete', handleSyncComplete);
    };
  }, [wasOffline, triggerAutoSync, refreshStatus]);

  // Pre-caching en arrière-plan au démarrage
  useEffect(() => {
    if (!navigator.onLine) return;

    const cacheTimer = setTimeout(async () => {
      try {
        const data = await fetchAllPreCacheData();
        if (data?.success) {
          safeSetItem('inci-cache:companies', JSON.stringify(data.companies));
          safeSetItem('inci-cache:companies-list', JSON.stringify(data.companies));
          safeSetItem('inci-cache:roles', JSON.stringify(data.roles));
          safeSetItem('inci-cache:roles-list', JSON.stringify(data.roles));
          safeSetItem('inci-cache:users', JSON.stringify(data.users));

          const empsByCo: Record<string, any[]> = {};
          if (data.employees) {
            data.employees.forEach((emp: any) => {
              if (!empsByCo[emp.companyId]) empsByCo[emp.companyId] = [];
              empsByCo[emp.companyId].push(emp);
            });
          }

          if (data.companies) {
            data.companies.forEach((co: any) => {
              const coEmps = empsByCo[co.id] || [];
              safeSetItem(`inci-cache:employees:${co.id}`, JSON.stringify(cleanEmployeesForCache(coEmps)));

              const stats = {
                totalEmployees: coEmps.length,
                printedCount: coEmps.filter((e: any) => e.status === 'IMPRIME').length,
                pendingPhotoCount: coEmps.filter((e: any) => e.status === 'A_ENROLER').length,
                validatedPhotoCount: coEmps.filter((e: any) => e.status === 'PHOTO_VALIDEE').length,
                toVerifyCount: coEmps.filter((e: any) => e.status === 'A_VERIFIER').length,
              };
              safeSetItem(`inci-cache:stats:${co.id}`, JSON.stringify(stats));
            });
          }

          if (data.templates) {
            data.templates.forEach((t: any) => {
              safeSetItem(`inci-cache:template:${t.companyId}:${t.type}`, JSON.stringify(t));
            });
          }
        }
      } catch (e) {
        console.warn('Background pre-caching failed:', e);
      }
    }, 3000);

    return () => clearTimeout(cacheTimer);
  }, []);

  // Formater la date de dernière sync
  const formatLastSync = (isoDate: string | null): string => {
    if (!isoDate) return '';
    const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (diff < 60) return 'il y a quelques secondes';
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
    return `il y a ${Math.floor(diff / 3600)}h`;
  };

  // --- Bannière Sync en attente (en ligne, mutations non envoyées) ---
  if (isOnline && queueSize > 0 && !dismissed) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 bg-indigo-600 text-white text-xs font-semibold shadow-lg">
        <div className="flex items-center gap-2.5">
          {isSyncing ? (
            <Loader2 className="w-4 h-4 shrink-0 animate-spin text-indigo-200" />
          ) : (
            <RefreshCw className="w-4 h-4 shrink-0 text-indigo-200" />
          )}
          <span>
            {isSyncing
              ? (syncProgress || 'Synchronisation des données en cours...')
              : syncError
              ? syncError
              : `${queueSize} modification(s) hors-ligne en attente de synchronisation`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!isSyncing && (
            <button
              onClick={triggerAutoSync}
              className="px-3 py-1 bg-white text-indigo-700 hover:bg-indigo-50 rounded-lg transition text-[11px] font-extrabold"
            >
              Synchroniser maintenant
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            disabled={isSyncing}
            className="p-1 rounded-lg hover:bg-indigo-700 transition shrink-0 disabled:opacity-50"
            aria-label="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // --- Bannière Hors-ligne ---
  if (!isOnline && !dismissed) {
    return (
      <div className="no-print print:hidden fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-2.5 bg-orange-500 text-white text-xs font-semibold shadow-lg animate-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-2.5">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            Vous êtes hors ligne — Les modifications sont enregistrées localement et seront synchronisées au retour de la connexion.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {queueSize > 0 && (
            <span className="bg-orange-600 px-2 py-0.5 rounded-full text-[10px]">
              {queueSize} en attente
            </span>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg hover:bg-orange-600 transition shrink-0"
            aria-label="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // --- Bannière Connexion rétablie ---
  if (showReconnected && !dismissed && queueSize === 0) {
    return (
      <div className="no-print print:hidden fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-2.5 bg-emerald-500 text-white text-xs font-semibold shadow-lg animate-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            Connexion rétablie — Données synchronisées {lastSyncedAt ? formatLastSync(lastSyncedAt) : ''}.
          </span>
        </div>
        <button
          onClick={() => setShowReconnected(false)}
          className="p-1 rounded-lg hover:bg-emerald-600 transition shrink-0"
          aria-label="Fermer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return null;
}
