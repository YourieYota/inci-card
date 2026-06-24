'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi, X, RefreshCw, Loader2 } from 'lucide-react';
import { getOfflineQueue, clearOfflineQueue, OfflineMutation } from '@/lib/offlineQueue';
import { syncOfflineMutations } from '@/app/actions/sync';
import { fetchAllPreCacheData } from '@/app/actions/preCache';
import { safeSetItem } from '@/lib/storage';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Sync Queue states
  const [queue, setQueue] = useState<OfflineMutation[]>([]);
  const [queueSize, setQueueSize] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    // Initial state
    setIsOnline(navigator.onLine);
    setQueue(getOfflineQueue());
    setQueueSize(getOfflineQueue().length);

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowReconnected(true);
        setDismissed(false);
        setTimeout(() => setShowReconnected(false), 4000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setDismissed(false);
    };

    const handleQueueChange = () => {
      const q = getOfflineQueue();
      setQueue(q);
      setQueueSize(q.length);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('inci-offline-mutations-changed', handleQueueChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('inci-offline-mutations-changed', handleQueueChange);
    };
  }, [wasOffline]);

  // Global background pre-caching
  useEffect(() => {
    if (navigator.onLine) {
      // Run background pre-caching after page is ready
      const cacheTimer = setTimeout(async () => {
        try {
          const data = await fetchAllPreCacheData();
          if (data && data.success) {
            // 1. Companies & lists
            safeSetItem("inci-cache:companies", JSON.stringify(data.companies));
            safeSetItem("inci-cache:companies-list", JSON.stringify(data.companies));

            // 2. Roles & list
            safeSetItem("inci-cache:roles", JSON.stringify(data.roles));
            safeSetItem("inci-cache:roles-list", JSON.stringify(data.roles));

            // 3. Users
            safeSetItem("inci-cache:users", JSON.stringify(data.users));

            // 4. Employees & stats by company
            const empsByCo: Record<string, any[]> = {};
            if (data.employees) {
              data.employees.forEach(emp => {
                if (!empsByCo[emp.companyId]) empsByCo[emp.companyId] = [];
                empsByCo[emp.companyId].push(emp);
              });
            }

            // Populating employees and stats for all companies
            if (data.companies) {
              data.companies.forEach(co => {
                const coEmps = empsByCo[co.id] || [];
                safeSetItem(`inci-cache:employees:${co.id}`, JSON.stringify(coEmps));
                
                const total = coEmps.length;
                const printed = coEmps.filter(e => e.status === 'IMPRIME').length;
                const pending = coEmps.filter(e => e.status === 'A_ENROLER').length;
                const validated = coEmps.filter(e => e.status === 'PHOTO_VALIDEE').length;
                const toVerify = coEmps.filter(e => e.status === 'A_VERIFIER').length;

                const stats = {
                  totalEmployees: total,
                  printedCount: printed,
                  pendingPhotoCount: pending,
                  validatedPhotoCount: validated,
                  toVerifyCount: toVerify,
                };
                safeSetItem(`inci-cache:stats:${co.id}`, JSON.stringify(stats));
              });
            }

            // 5. Templates by company & type
            if (data.templates) {
              data.templates.forEach(t => {
                safeSetItem(`inci-cache:template:${t.companyId}:${t.type}`, JSON.stringify(t));
              });
            }
          }
        } catch (e) {
          console.warn("Background pre-caching failed:", e);
        }
      }, 3000);

      return () => clearTimeout(cacheTimer);
    }
  }, []);

  const handleSync = async () => {
    if (queue.length === 0) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const res = await syncOfflineMutations(queue);
      if (res.success) {
        clearOfflineQueue();
        alert("Synchronisation terminée avec succès !");
        window.location.reload();
      } else {
        // Find if some mutations failed and keep them in queue
        const failedIds = res.results.filter(r => !r.success).map(r => r.id);
        const remainingQueue = queue.filter(mut => failedIds.includes(mut.id));
        
        // Save only remaining failed mutations
        safeSetItem('inci-offline-mutations', JSON.stringify(remainingQueue));
        window.dispatchEvent(new CustomEvent('inci-offline-mutations-changed'));

        setSyncError(`Certaines modifications n'ont pas pu être synchronisées. Veuillez réessayer.`);
      }
    } catch (err: any) {
      setSyncError(err.message || "Erreur de connexion lors de la synchronisation.");
    } finally {
      setIsSyncing(false);
    }
  };

  // 1. Sync Banner (User is online, but has mutations queued)
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
              ? "Synchronisation des données en cours..."
              : syncError
              ? syncError
              : `Connexion rétablie — Vous avez ${queueSize} modification(s) effectuée(s) hors-ligne en attente.`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!isSyncing && (
            <button
              onClick={handleSync}
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

  // 2. Offline Banner
  if (!isOnline && !dismissed) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-2.5 bg-orange-500 text-white text-xs font-semibold shadow-lg animate-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-2.5">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            Vous êtes hors ligne — Les modifications seront enregistrées localement et synchronisées au retour de la connexion.
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

  // 3. Reconnected Confirmation Banner
  if (showReconnected && !dismissed && queueSize === 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-2.5 bg-emerald-500 text-white text-xs font-semibold shadow-lg animate-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-2.5">
          <Wifi className="w-4 h-4 shrink-0" />
          <span>Connexion rétablie — Vous êtes de nouveau en ligne et toutes les données sont à jour.</span>
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
