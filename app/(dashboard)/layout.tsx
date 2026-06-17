"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Settings, Users, Image as ImageIcon, LogOut, Printer } from "lucide-react";
import { signOut } from "next-auth/react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Entreprises", href: "/dashboard/companies", icon: Users },
  { name: "Studio (Création)", href: "/dashboard/studio", icon: ImageIcon },
  { name: "Paramètres", href: "/settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-700">
          <Printer className="w-6 h-6 text-blue-600 mr-2" />
          <span className="font-bold text-lg text-slate-900 dark:text-white">Imprimerie Pro</span>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-white"
                }`}
              >
                <item.icon
                  className={`w-5 h-5 mr-3 flex-shrink-0 ${
                    isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
                  }`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3 flex-shrink-0" />
            Déconnexion
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
