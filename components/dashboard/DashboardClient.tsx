'use client';

import React, { useState, useEffect, useRef } from "react";
import { Building2, Users as UsersIcon, CreditCard, Clock, TrendingUp, AlertTriangle, WifiOff, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { safeSetItem, safeGetItem } from "@/lib/storage";
import { getDashboardRecentActivities } from "@/app/actions/employees";

interface StatsData {
  companiesCount: number;
  totalEmployees: number;
  printedCount: number;
  pendingPhotoCount: number;
}

interface Activity {
  id: string;
  type: 'enrollment' | 'print';
  date: string; // Serialized date ISO string
  employeeName: string;
  enrollmentNumber: string | null;
  companyName: string;
  enrolledBy?: string | null;
  printedBy?: string | null;
}

interface DashboardClientProps {
  initialStats: StatsData;
  initialActivities: Activity[];
  initialTotalActivities: number;
  dbError: boolean;
}

export default function DashboardClient({
  initialStats,
  initialActivities,
  initialTotalActivities,
  dbError,
}: DashboardClientProps) {
  const [statsData, setStatsData] = useState<StatsData>(initialStats);
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [totalActivities, setTotalActivities] = useState<number>(initialTotalActivities);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoadingActivities, setIsLoadingActivities] = useState<boolean>(false);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [cacheLoaded, setCacheLoaded] = useState<boolean>(false);

  const isFirstMount = useRef(true);

  // Sync with props when server-side data refreshes (on initial render or layout transitions)
  useEffect(() => {
    if (!dbError) {
      // DB is online, save data to cache
      safeSetItem("inci-cache:dashboard-stats", JSON.stringify(initialStats));
      safeSetItem("inci-cache:dashboard-activities", JSON.stringify(initialActivities));
      safeSetItem("inci-cache:dashboard-total-activities", String(initialTotalActivities));
      setStatsData(initialStats);
      setActivities(initialActivities);
      setTotalActivities(initialTotalActivities);
      setIsOfflineMode(false);
    } else {
      // DB is offline/inaccessible, read from cache
      try {
        const cachedStats = safeGetItem("inci-cache:dashboard-stats");
        const cachedActivities = safeGetItem("inci-cache:dashboard-activities");
        const cachedTotal = safeGetItem("inci-cache:dashboard-total-activities");
        
        if (cachedStats) {
          setStatsData(JSON.parse(cachedStats));
          setCacheLoaded(true);
        }
        if (cachedActivities) {
          setActivities(JSON.parse(cachedActivities));
          setCacheLoaded(true);
        }
        if (cachedTotal) {
          setTotalActivities(Number(cachedTotal));
        }
        
        if (cachedStats || cachedActivities) {
          setIsOfflineMode(true);
        }
      } catch (e) {
        console.warn("Failed to read dashboard cache:", e);
      }
    }
  }, [initialStats, initialActivities, initialTotalActivities, dbError]);

  // Fetch new page dynamically
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const fetchPage = async () => {
      setIsLoadingActivities(true);
      try {
        const res = await getDashboardRecentActivities(currentPage, 10);
        const serialized = res.activities.map(act => ({
          ...act,
          date: act.date.toISOString(),
        }));
        setActivities(serialized);
        setTotalActivities(res.total);
      } catch (err) {
        console.warn("Failed to fetch paginated activities:", err);
      } finally {
        setIsLoadingActivities(false);
      }
    };

    fetchPage();
  }, [currentPage]);

  const totalPages = Math.ceil(totalActivities / 10);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      if (start > 2) {
        pages.push('...');
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (end < totalPages - 1) {
        pages.push('...');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  const stats = [
    {
      name: "Entreprises clientes",
      value: statsData.companiesCount.toString(),
      icon: Building2,
      gradient: "from-blue-500 to-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      border: "border-blue-100 dark:border-blue-900/40",
      text: "text-blue-600 dark:text-blue-400",
    },
    {
      name: "Employés inscrits",
      value: statsData.totalEmployees.toString(),
      icon: UsersIcon,
      gradient: "from-violet-500 to-indigo-600",
      bg: "bg-violet-50 dark:bg-violet-950/30",
      border: "border-violet-100 dark:border-violet-900/40",
      text: "text-violet-600 dark:text-violet-400",
    },
    {
      name: "Badges imprimés",
      value: statsData.printedCount.toString(),
      icon: CreditCard,
      gradient: "from-emerald-500 to-green-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      border: "border-emerald-100 dark:border-emerald-900/40",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    {
      name: "En attente de photo",
      value: statsData.pendingPhotoCount.toString(),
      icon: Clock,
      gradient: "from-orange-400 to-amber-500",
      bg: "bg-orange-50 dark:bg-orange-950/30",
      border: "border-orange-100 dark:border-orange-900/40",
      text: "text-orange-600 dark:text-orange-400",
    },
  ];



  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tableau de bord</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Vue d&apos;ensemble de l&apos;activité de l&apos;imprimerie nationale.
          </p>
        </div>
        
        {/* Status Badge */}
        <div className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border ${
          isOfflineMode
            ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200/60 dark:border-orange-900/40 text-orange-700 dark:text-orange-400'
            : dbError
            ? 'bg-red-50 dark:bg-red-950/30 border-red-200/60 dark:border-red-900/40 text-red-700 dark:text-red-400'
            : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400'
        }`}>
          {isOfflineMode ? (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              <span>Mode Hors-ligne (Données du cache)</span>
            </>
          ) : dbError ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Base de données inaccessible</span>
            </>
          ) : (
            <>
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Système opérationnel</span>
            </>
          )}
        </div>
      </div>

      {/* Offline Alert Banner */}
      {isOfflineMode && (
        <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40 rounded-2xl text-orange-700 dark:text-orange-400 animate-in fade-in duration-300">
          <WifiOff className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">Mode Hors-ligne / Base de données inaccessible</p>
            <p className="text-xs mt-0.5 opacity-90">
              Affichage des dernières données enregistrées localement dans votre navigateur (Cache JSON). L&apos;application est en lecture seule pour le moment.
            </p>
          </div>
        </div>
      )}

      {/* DB Inaccessible Alert (without cache fallback) */}
      {!isOfflineMode && dbError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 rounded-2xl text-red-700 dark:text-red-400">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">Base de données temporairement inaccessible</p>
            <p className="text-xs mt-0.5 opacity-80">
              Aucune donnée en cache disponible. Veuillez vérifier votre connexion ou recharger la page.
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className={`relative bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border ${stat.border} overflow-hidden group hover:shadow-md transition-shadow duration-300`}
          >
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient} opacity-80`} />
            <div className="flex items-start justify-between mt-1">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{stat.name}</p>
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.border} border`}>
                <stat.icon className={`w-5 h-5 ${stat.text}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity Feed */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100/80 dark:border-slate-700/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isOfflineMode ? 'bg-orange-500' : 'bg-emerald-500 animate-pulse'}`} />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide">
            {isOfflineMode ? "Dernières activités (Enregistrées)" : "Dernières activités"}
          </h3>
        </div>
        {isLoadingActivities ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold">Chargement des activités...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Aucune activité récente</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {isOfflineMode ? "Aucune activité en cache." : "Les prochaines étapes consisteront à importer des fichiers Excel ou prendre des photos."}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100/80 dark:divide-slate-700/40">
              {activities.map((act) => (
                <div key={act.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-700/20 transition">
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl border ${
                      act.type === 'print'
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                        : 'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/40 text-blue-600 dark:text-blue-400'
                    }`}>
                      {act.type === 'print' ? <CreditCard className="w-4 h-4" /> : <UsersIcon className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">
                        {act.type === 'print' ? 'Impression de carte réussie' : 'Nouvel enrôlement enregistré'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{act.employeeName}</span>
                        {act.enrollmentNumber ? <span className="text-slate-400 dark:text-slate-500"> ({act.enrollmentNumber})</span> : ''}
                        {' · '}
                        <span className="font-medium text-blue-600 dark:text-blue-400">{act.companyName}</span>
                        {act.type === 'print' && (
                          <>
                            {' · '}
                            <span className="text-slate-450 dark:text-slate-500">par <strong className="font-semibold text-slate-700 dark:text-slate-300">{act.printedBy || "Système"}</strong></span>
                          </>
                        )}
                        {act.type === 'enrollment' && (
                          <>
                            {' · '}
                            <span className="text-slate-450 dark:text-slate-500">par <strong className="font-semibold text-slate-700 dark:text-slate-300">{act.enrolledBy || "Système"}</strong></span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono shrink-0">
                    {new Date(act.date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalActivities > 10 && (
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Affichage de <span className="font-semibold text-slate-700 dark:text-slate-300">{(currentPage - 1) * 10 + 1}</span> à <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(currentPage * 10, totalActivities)}</span> sur <span className="font-semibold text-slate-700 dark:text-slate-300">{totalActivities}</span> activités
                </span>
                <div className="flex items-center gap-2">
                  {/* Previous button */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || isLoadingActivities}
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((pageNum, idx) => {
                      if (pageNum === '...') {
                        return (
                          <span
                            key={`ellipsis-${idx}`}
                            className="px-2 py-1 text-xs font-semibold text-slate-400 dark:text-slate-500 select-none"
                          >
                            ...
                          </span>
                        );
                      }

                      const pageVal = pageNum as number;
                      const isActive = pageVal === currentPage;

                      return (
                        <button
                          key={pageVal}
                          type="button"
                          onClick={() => setCurrentPage(pageVal)}
                          disabled={isLoadingActivities}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm border ${
                            isActive
                              ? 'bg-indigo-600 border-indigo-600 text-white dark:bg-indigo-500 dark:border-indigo-500'
                              : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-slate-650 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          {pageVal}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next button */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage >= totalPages || isLoadingActivities}
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
