import { Building2, Users as UsersIcon, CreditCard, Clock, TrendingUp } from "lucide-react";
import { getDashboardStats, getDashboardRecentActivities } from "@/app/actions/employees";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const statsData = await getDashboardStats();
  const activities = await getDashboardRecentActivities();

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tableau de bord</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Vue d&apos;ensemble de l&apos;activité de l&apos;imprimerie nationale.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Système opérationnel</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className={`relative bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border ${stat.border} overflow-hidden group hover:shadow-md transition-shadow duration-300`}
          >
            {/* Subtle gradient accent top */}
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
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide">Dernières activités</h3>
        </div>
        {activities.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Aucune activité récente</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Les prochaines étapes consisteront à importer des fichiers Excel ou prendre des photos.</p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
