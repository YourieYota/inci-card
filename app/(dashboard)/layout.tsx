"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Settings, Users, Image as ImageIcon,
  LogOut, UserCheck, UserCog, Shield, ChevronRight, Menu, X
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

// ─── Navigation définition ────────────────────────────────────────────────────
const navigation = [
  { name: "Dashboard",          href: "/dashboard",          icon: LayoutDashboard, roles: ['ADMIN', 'DESIGNER', 'OPERATEUR'] },
  { name: "Entreprises",        href: "/dashboard/companies", icon: Users,           roles: ['ADMIN', 'DESIGNER', 'OPERATEUR'] },
  { name: "Enrôlement",         href: "/dashboard/employees", icon: UserCheck,       roles: ['ADMIN', 'OPERATEUR'] },
  { name: "Studio (Création)",  href: "/dashboard/studio",   icon: ImageIcon,       roles: ['ADMIN', 'DESIGNER'] },
  { name: "Comptes",            href: "/dashboard/accounts", icon: UserCog,         roles: ['ADMIN'] },
  { name: "Rôles & Permissions",href: "/dashboard/roles",    icon: Shield,          roles: ['ADMIN'] },
  { name: "Paramètres",         href: "/settings",           icon: Settings,        roles: ['ADMIN', 'DESIGNER', 'OPERATEUR'] },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN:     "Administrateur",
  DESIGNER:  "Designer",
  OPERATEUR: "Opérateur",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN:     "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  DESIGNER:  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  OPERATEUR: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

// ─── Sidebar content (shared between desktop & mobile) ────────────────────────
function SidebarContent({ pathname, role, name, onClose }: {
  pathname: string;
  role: string;
  name: string;
  onClose?: () => void;
}) {
  const visibleLinks = navigation.filter(item => item.roles.includes(role));
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-blue-100/60 dark:border-slate-700/60 gap-2.5 shrink-0 bg-gradient-to-r from-blue-50/40 to-orange-50/20 dark:from-slate-800 dark:to-slate-800">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-orange-500 flex items-center justify-center shadow-sm shrink-0">
          <img src="/logo-imprimerie.png" className="h-6 object-contain" alt="Logo" />
        </div>
        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">Imprimerie Nationale</span>
        {onClose && (
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        {/* Group label */}
        <p className="text-[9px] font-bold text-slate-400/80 uppercase tracking-widest px-3 mb-2">Navigation</p>

        {visibleLinks.map((item) => {
          const isActive = item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                isActive
                  ? "bg-gradient-to-r from-blue-50 to-blue-50/50 text-blue-700 dark:from-blue-900/40 dark:to-blue-900/10 dark:text-blue-300 shadow-sm border border-blue-100/80 dark:border-blue-800/40"
                  : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/40 dark:hover:text-white"
              }`}
            >
              <item.icon
                className={`mr-3 flex-shrink-0 transition-colors ${
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                }`}
                style={{ width: 17, height: 17 }}
              />
              <span className="flex-1">{item.name}</span>
              {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-50 text-blue-500" />}
            </Link>
          );
        })}
      </nav>

      {/* User card + logout */}
      <div className="p-3 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1 shrink-0">
        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-slate-50 to-blue-50/30 dark:from-slate-900/50 dark:to-slate-900/30 border border-slate-100/80 dark:border-slate-700/40 mb-1">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow-sm ${ROLE_COLORS[role] || 'bg-slate-500/10 text-slate-600'}`}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{name || 'Utilisateur'}</p>
            <p className={`text-[10px] font-semibold truncate ${ROLE_COLORS[role]?.split(' ').filter(c => c.startsWith('text-')).join(' ') || 'text-slate-500'}`}>
              {ROLE_LABELS[role] || role}
            </p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center px-3 py-2.5 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="mr-3 flex-shrink-0" style={{ width: 16, height: 16 }} />
          Déconnexion
        </button>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = (session?.user as any)?.role || 'OPERATEUR';
  const name = session?.user?.name || '';

  return (
    <div className="h-screen bg-slate-50/80 dark:bg-slate-900 flex overflow-hidden">

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200/60 dark:border-slate-700/60 hidden md:flex flex-col h-full shadow-sm">
        <SidebarContent pathname={pathname} role={role} name={name} />
      </div>

      {/* ── Mobile overlay sidebar ──────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="relative w-64 bg-white dark:bg-slate-800 shadow-2xl flex flex-col h-full">
            <SidebarContent
              pathname={pathname}
              role={role}
              name={name}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="h-14 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-3 md:hidden shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img src="/logo-imprimerie.png" className="h-7 object-contain" alt="Logo" />
          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">Imprimerie Nationale</span>
        </div>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
