'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, ShieldCheck, ShieldAlert, Plus, Pencil, Trash2,
  Check, X, Loader2, AlertCircle, Users, Lock, ChevronDown,
  ChevronUp, Search, RefreshCw, Sparkles, Tag
} from 'lucide-react';
import {
  getRoles, createRole, updateRole, deleteRole
} from '@/app/actions/roles';
import { addOfflineMutation } from '@/lib/offlineQueue';
import { PERMISSION_KEYS } from '@/lib/permissions';
import { safeSetItem, safeGetItem } from '@/lib/storage';

// --- Types --------------------------------------------------------------------
interface RoleData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  isSystem: boolean;
  permissions: Record<string, boolean>;
  userCount: number;
  createdAt: Date;
}

// --- Colour presets -----------------------------------------------------------
const COLOR_PRESETS = [
  '#f43f5e', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#6366f1', '#8b5cf6', '#ec4899',
  '#64748b', '#0f172a',
];

// Group permission keys by category
const PERM_GROUPS = PERMISSION_KEYS.reduce((acc, p) => {
  if (!acc[p.category]) acc[p.category] = [];
  acc[p.category].push(p);
  return acc;
}, {} as Record<string, typeof PERMISSION_KEYS[number][]>);

// --- Role Form (shared Create / Edit) -----------------------------------------
function RoleForm({
  initial,
  isSystem,
  onSave,
  onCancel,
  submitLabel,
}: {
  initial: Partial<RoleData>;
  isSystem?: boolean;
  onSave: (data: { name: string; slug: string; description: string; color: string; permissions: Record<string, boolean> }) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial.name || '');
  const [slug, setSlug] = useState(initial.slug || '');
  const [description, setDescription] = useState(initial.description || '');
  const [color, setColor] = useState(initial.color || '#6366f1');
  const [perms, setPerms] = useState<Record<string, boolean>>(
    initial.permissions || Object.fromEntries(PERMISSION_KEYS.map(p => [p.key, false]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(Object.keys(PERM_GROUPS).map(g => [g, true]))
  );

  // Auto-generate slug from name (create only)
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isSystem && !initial.slug) {
      setSlug(val.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '_'));
    }
  };

  const togglePerm = (key: string) => setPerms(p => ({ ...p, [key]: !p[key] }));
  const toggleGroup = (group: string, val: boolean) => {
    const keys = PERM_GROUPS[group].map(p => p.key);
    setPerms(p => {
      const next = { ...p };
      keys.forEach(k => { next[k] = val; });
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Le nom est requis'); return; }
    setError(null);
    setSubmitting(true);
    try {
      await onSave({ name: name.trim(), slug: slug.trim(), description: description.trim(), color, permissions: perms });
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-xl text-red-700 dark:text-red-400 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* Name + Slug */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
            Nom du rôle *
          </label>
          <input
            type="text"
            required
            disabled={isSystem}
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Ex: Superviseur RH"
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
            Identifiant (slug) *
          </label>
          <input
            type="text"
            required
            disabled={isSystem || !!initial.slug}
            value={slug}
            onChange={e => setSlug(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
            placeholder="Ex: SUPERVISEUR_RH"
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {!isSystem && !initial.slug && <p className="text-[9px] text-slate-400 mt-0.5">Généré automatiquement depuis le nom</p>}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Ex: Accès à la supervision des équipes RH"
          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition"
        />
      </div>

      {/* Color */}
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Couleur du rôle</label>
        <div className="flex flex-wrap items-center gap-2">
          {COLOR_PRESETS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-lg transition-all ${color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <div className="flex items-center gap-2 ml-1">
            <div className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-full cursor-pointer border-none bg-transparent scale-125" />
            </div>
            <span className="text-xs font-mono text-slate-500">{color}</span>
          </div>
        </div>
      </div>

      {/* Permissions grouped */}
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Permissions</label>
        <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
          {Object.entries(PERM_GROUPS).map(([group, items]) => {
            const allOn = items.every(p => perms[p.key]);
            const someOn = items.some(p => perms[p.key]);
            const isExpanded = expandedGroups[group];
            return (
              <div key={group}>
                {/* Group header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/70 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedGroups(g => ({ ...g, [group]: !g[group] }))}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{group}</span>
                    {someOn && !allOn && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold">Partiel</span>}
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => toggleGroup(group, true)}
                      className="text-[9px] font-bold px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition">
                      Tout activer
                    </button>
                    <button type="button" onClick={() => toggleGroup(group, false)}
                      className="text-[9px] font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                      Tout désactiver
                    </button>
                  </div>
                </div>
                {/* Permissions list */}
                {isExpanded && (
                  <div className="px-4 py-2 space-y-1">
                    {items.map(perm => (
                      <label key={perm.key} className="flex items-center gap-3 py-1.5 cursor-pointer group/perm">
                        <div
                          onClick={() => togglePerm(perm.key)}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                            perms[perm.key]
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-slate-200 dark:border-slate-600 hover:border-blue-300'
                          }`}
                        >
                          {perms[perm.key] && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`text-xs font-medium transition-colors ${
                          perms[perm.key] ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          {perm.label}
                        </span>
                        <code className="ml-auto text-[9px] font-mono text-slate-300 dark:text-slate-600">{perm.key}</code>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
          Annuler
        </button>
        <button type="submit" disabled={submitting}
          className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          <span>{submitLabel}</span>
        </button>
      </div>
    </form>
  );
}

// --- Main Component -----------------------------------------------------------
export default function RolesClient({ currentUserSlug }: { currentUserSlug: string }) {
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingRole, setEditingRole] = useState<RoleData | null>(null);
  const [deletingRole, setDeletingRole] = useState<RoleData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getRoles();
      const parsed = data.map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
      setRoles(parsed);
      setIsOfflineMode(false);
      safeSetItem("inci-cache:roles", JSON.stringify(parsed));
    } catch (e: any) {
      try {
        const cached = safeGetItem("inci-cache:roles");
        if (cached) {
          setRoles(JSON.parse(cached).map((r: any) => ({ ...r, createdAt: new Date(r.createdAt) })));
          setIsOfflineMode(true);
          setError(null);
        } else {
          setError(e.message || 'Impossible de charger les rôles');
        }
      } catch (err) {
        console.warn("Failed to read roles cache:", err);
        setError(e.message || 'Impossible de charger les rôles');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleCreate = async (data: any) => {
    if (isOfflineMode) {
      const tempId = `temp_role_${Date.now()}`;
      const mockRole = {
        id: tempId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        color: data.color,
        isSystem: false,
        permissions: data.permissions,
        userCount: 0,
        createdAt: new Date(),
      };
      const updatedRoles = [...roles, mockRole].sort((a, b) => a.name.localeCompare(b.name));
      setRoles(updatedRoles);
      safeSetItem("inci-cache:roles", JSON.stringify(updatedRoles));
      
      addOfflineMutation(
        'CREATE_ROLE',
        { data },
        `Créer le rôle "${data.name}" (Hors-ligne)`
      );

      setMode('list');
      showSuccess(`Rôle "${data.name}" créé localement !`);
      return;
    }

    await createRole(data);
    await fetchRoles();
    setMode('list');
    showSuccess(`Rôle "${data.name}" créé avec succès !`);
  };

  const handleUpdate = async (data: any) => {
    if (!editingRole) return;

    if (isOfflineMode) {
      const updatedRoles = roles.map((r) => {
        if (r.id === editingRole.id) {
          return {
            ...r,
            name: data.name,
            slug: data.slug,
            description: data.description,
            color: data.color,
            permissions: data.permissions,
          };
        }
        return r;
      });
      setRoles(updatedRoles);
      safeSetItem("inci-cache:roles", JSON.stringify(updatedRoles));

      addOfflineMutation(
        'UPDATE_ROLE',
        { id: editingRole.id, data },
        `Modifier le rôle "${data.name || editingRole.name}" (Hors-ligne)`
      );

      setMode('list');
      setEditingRole(null);
      showSuccess(`Rôle "${data.name || editingRole.name}" modifié localement !`);
      return;
    }

    await updateRole(editingRole.id, data);
    await fetchRoles();
    setMode('list');
    setEditingRole(null);
    showSuccess(`Rôle "${data.name || editingRole.name}" modifié avec succès !`);
  };

  const handleDelete = async () => {
    if (!deletingRole) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      if (isOfflineMode) {
        const updatedRoles = roles.filter((r) => r.id !== deletingRole.id);
        setRoles(updatedRoles);
        safeSetItem("inci-cache:roles", JSON.stringify(updatedRoles));

        addOfflineMutation(
          'DELETE_ROLE',
          { id: deletingRole.id },
          `Supprimer le rôle "${deletingRole.name}" (Hors-ligne)`
        );

        setDeletingRole(null);
        showSuccess(`Rôle "${deletingRole.name}" supprimé localement.`);
        return;
      }

      await deleteRole(deletingRole.id);
      await fetchRoles();
      setDeletingRole(null);
      showSuccess(`Rôle "${deletingRole.name}" supprimé.`);
    } catch (e: any) {
      setDeleteError(e.message || 'Erreur lors de la suppression');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = roles.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.slug.toLowerCase().includes(search.toLowerCase())
  );



  // -- CREATE/EDIT form view -------------------------------------------------
  if (mode === 'create') {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30">
            <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Créer un nouveau rôle</h3>
            <p className="text-xs text-slate-400 mt-0.5">Définissez le nom, l&apos;identifiant et les permissions</p>
          </div>
        </div>
        <div className="p-6">
          <RoleForm
            initial={{}}
            onSave={handleCreate}
            onCancel={() => setMode('list')}
            submitLabel="Créer le rôle"
          />
        </div>
      </div>
    );
  }

  if (mode === 'edit' && editingRole) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ backgroundColor: editingRole.color + '20' }}>
            <Pencil className="w-4 h-4" style={{ color: editingRole.color }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Modifier : {editingRole.name}</h3>
              {editingRole.isSystem && (
                <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400">
                  <Lock className="w-2.5 h-2.5" />SYSTÈME
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {editingRole.isSystem ? 'Seules les permissions peuvent être modifiées' : 'Modifiez le rôle et ses permissions'}
            </p>
          </div>
        </div>
        <div className="p-6">
          <RoleForm
            initial={editingRole}
            isSystem={editingRole.isSystem}
            onSave={handleUpdate}
            onCancel={() => { setMode('list'); setEditingRole(null); }}
            submitLabel="Enregistrer les modifications"
          />
        </div>
      </div>
    );
  }

  // -- LIST view -------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Success banner */}
      {successMsg && (
        <div className="flex items-center gap-3 px-5 py-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-2xl text-emerald-700 dark:text-emerald-400 text-sm font-semibold animate-in fade-in slide-in-from-top-2 duration-300">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Offline banner */}
      {isOfflineMode && (
        <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40 rounded-2xl text-orange-700 dark:text-orange-400 animate-in fade-in duration-300">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.36 5.64A9 9 0 01-1.64 12c0 2.21.89 4.21 2.34 5.66m13.66 0A9 9 0 0113.64 12c0-2.21-.89-4.21-2.34-5.66m0 0L12 12m0 0l3-3m-3 3l-3-3" />
          </svg>
          <div>
            <p className="text-sm font-bold">Mode Hors-ligne (Données du cache)</p>
            <p className="text-xs mt-0.5 opacity-90">
              Les créations, modifications ou suppressions de rôles effectuées seront sauvegardées localement et synchronisées plus tard.
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un rôle..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={fetchRoles}
            className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition"
            title="Rafraîchir">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMode('create')}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-sm shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau rôle</span>
          </button>
        </div>
      </div>

      {/* Roles grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
          <span className="text-sm font-semibold text-slate-400">Chargement des rôles...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-2xl text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" /><span className="text-sm">{error}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(role => {
            const enabledPerms = Object.entries(role.permissions).filter(([, v]) => v).length;
            const totalPerms = PERMISSION_KEYS.length;
            const pct = Math.round((enabledPerms / totalPerms) * 100);
            const isCurrentUserRole = role.slug === currentUserSlug;

            return (
              <div key={role.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
                {/* Color stripe */}
                <div className="h-1.5 w-full" style={{ backgroundColor: role.color }} />

                <div className="p-5 flex flex-col gap-4 flex-1">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: role.color + '18' }}>
                        {role.isSystem
                          ? <Lock className="w-4 h-4" style={{ color: role.color }} />
                          : <Sparkles className="w-4 h-4" style={{ color: role.color }} />
                        }
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white">{role.name}</h3>
                          {role.isSystem && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">SYSTÈME</span>
                          )}
                          {isCurrentUserRole && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">Mon rôle</span>
                          )}
                        </div>
                        <code className="text-[10px] font-mono text-slate-400">{role.slug}</code>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditingRole(role);
                          setMode('edit');
                        }}
                        className="p-1.5 rounded-lg transition text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700"
                        title="Modifier"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!role.isSystem && (
                        <button
                          onClick={() => {
                            setDeletingRole(role);
                            setDeleteError(null);
                          }}
                          className="p-1.5 rounded-lg transition text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {role.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{role.description}</p>
                  )}

                  {/* Permissions progress bar */}
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5">
                      <span>{enabledPerms}/{totalPerms} permissions</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: role.color }}
                      />
                    </div>
                  </div>

                  {/* Enabled permissions chips */}
                  <div className="flex flex-wrap gap-1">
                    {PERMISSION_KEYS.filter(p => role.permissions[p.key]).map(p => (
                      <span key={p.key}
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: role.color + '15', color: role.color }}>
                        {p.label}
                      </span>
                    ))}
                    {enabledPerms === 0 && (
                      <span className="text-[10px] text-slate-400 italic">Aucune permission accordée</span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Users className="w-3.5 h-3.5" />
                      <span><span className="font-bold text-slate-700 dark:text-slate-300">{role.userCount}</span> utilisateur{role.userCount !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(role.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {filtered.length === 0 && !isLoading && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-3">
                <Tag className="w-6 h-6 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">Aucun rôle trouvé</p>
              <p className="text-xs text-slate-400 mt-1">Créez un nouveau rôle ou modifiez votre recherche.</p>
            </div>
          )}
        </div>
      )}

      {/* DELETE MODAL */}
      {deletingRole && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-md w-full shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Supprimer le rôle ?</h3>
                <p className="text-xs text-slate-400">{deletingRole.name}</p>
              </div>
            </div>

            {deleteError && (
              <div className="flex items-center gap-2 px-3 py-2.5 mb-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-xl text-red-700 dark:text-red-400 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" /><span>{deleteError}</span>
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Cette action est irréversible. Les <strong className="text-slate-700 dark:text-slate-300">{deletingRole.userCount} utilisateur(s)</strong> affectés à ce rôle seront automatiquement rétrogradés en <strong className="text-slate-700 dark:text-slate-300">Opérateur</strong>.
            </p>

            <div className="flex gap-2">
              <button onClick={() => setDeletingRole(null)} disabled={deleteLoading}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-2">
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Confirmer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
