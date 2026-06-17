import { Building2, Users as UsersIcon, CreditCard, Clock } from "lucide-react";

export default function DashboardPage() {
  const stats = [
    { name: "Entreprises clientes", value: "12", icon: Building2, color: "bg-blue-500" },
    { name: "Employés à enrôler", value: "348", icon: UsersIcon, color: "bg-indigo-500" },
    { name: "Badges imprimés", value: "1,204", icon: CreditCard, color: "bg-emerald-500" },
    { name: "En attente de photo", value: "89", icon: Clock, color: "bg-amber-500" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tableau de bord</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Vue d'ensemble de l'activité de l'imprimerie.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center">
            <div className={`p-4 rounded-xl ${stat.color} bg-opacity-10 dark:bg-opacity-20 mr-4`}>
              <stat.icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.name}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">Dernières activités</h3>
        </div>
        <div className="p-6 text-center text-slate-500 dark:text-slate-400 py-12">
          Aucune activité récente. Les prochaines étapes consisteront à importer des fichiers Excel.
        </div>
      </div>
    </div>
  );
}
