'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Search, Edit2, Trash2, Mail, Phone, Shield, User,
  Check, AlertCircle, Eye, EyeOff, Loader2, X, Key
} from 'lucide-react';
import { 
  getUsers, adminCreateUser, adminUpdateUser, adminDeleteUser 
} from '@/app/actions/users';
import { getRoles } from '@/app/actions/roles';
import { addOfflineMutation } from '@/lib/offlineQueue';
import { safeSetItem, safeGetItem } from '@/lib/storage';
import Pagination from '@/components/ui/Pagination';

interface AccountsClientProps {
  currentUser: {
    id: string;
    email: string;
    name: string;
  } | null;
}

interface UserAccount {
  id: string;
  name: string;
  firstName: string | null;
  phone: string | null;
  email: string;
  login: string | null;
  role: string;
  createdAt: Date;
}

interface RoleOption {
  id: string;
  name: string;
  slug: string;
  color: string;
  isSystem: boolean;
}

export default function AccountsClient({ currentUser }: AccountsClientProps) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([]);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [login, setLogin] = useState('');
  const [role, setRole] = useState<string>('OPERATEUR');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [showPass, setShowPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const data = await getRoles();
      const mapped = data.map(r => ({ id: r.id, name: r.name, slug: r.slug, color: r.color, isSystem: r.isSystem }));
      setAvailableRoles(mapped);
      safeSetItem("inci-cache:roles-list", JSON.stringify(mapped));
    } catch {
      try {
        const cached = safeGetItem("inci-cache:roles-list");
        if (cached) {
          setAvailableRoles(JSON.parse(cached));
        }
      } catch (e) {
        console.warn("Failed to read roles-list cache:", e);
      }
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      const parsedData = data.map(u => ({
        ...u,
        role: u.role as string,
        createdAt: new Date(u.createdAt)
      }));
      setUsers(parsedData);
      setIsOfflineMode(false);
      safeSetItem("inci-cache:users", JSON.stringify(parsedData));
    } catch (err: any) {
      try {
        const cached = safeGetItem("inci-cache:users");
        if (cached) {
          setUsers(JSON.parse(cached).map((u: any) => ({
            ...u,
            createdAt: new Date(u.createdAt)
          })));
          setIsOfflineMode(true);
          setError(null);
        } else {
          setError(err.message || 'Impossible de charger les utilisateurs');
        }
      } catch (e) {
        console.warn("Failed to read users cache:", e);
        setError(err.message || 'Impossible de charger les utilisateurs');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setName('');
    setFirstName('');
    setPhone('');
    setEmail('');
    setLogin('');
    setRole('OPERATEUR');
    setPassword('');
    setActionError(null);
    setActionSuccess(null);
    setShowPass(false);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (user: UserAccount) => {
    setSelectedUser(user);
    setName(user.name);
    setFirstName(user.firstName || '');
    setPhone(user.phone || '');
    setEmail(user.email);
    setLogin(user.login || '');
    setRole(user.role);
    setNewPassword('');
    setActionError(null);
    setActionSuccess(null);
    setShowNewPass(false);
    setIsEditOpen(true);
  };

  const handleOpenDelete = (user: UserAccount) => {
    setSelectedUser(user);
    setActionError(null);
    setIsDeleteOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!password || password.length < 6) {
      setActionError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isOfflineMode) {
        const tempId = `temp_user_${Date.now()}`;
        const mockUser = {
          id: tempId,
          name,
          firstName: firstName || null,
          phone: phone || null,
          email,
          login: login || null,
          role,
          createdAt: new Date(),
        };

        const updatedUsers = [mockUser, ...users];
        setUsers(updatedUsers);
        safeSetItem("inci-cache:users", JSON.stringify(updatedUsers));

        addOfflineMutation(
          'CREATE_USER',
          { data: { name, firstName, phone, email, login, role, password } },
          `Créer le compte pour ${firstName} ${name} (Hors-ligne)`
        );

        setActionSuccess('Compte créé localement !');
        setTimeout(() => setIsCreateOpen(false), 1500);
        return;
      }

      const result = await adminCreateUser({
        name,
        firstName,
        phone,
        email,
        login,
        role,
        passwordHash: password
      });

      if (result.success) {
        setActionSuccess('Compte créé avec succès !');
        fetchUsers();
        setTimeout(() => setIsCreateOpen(false), 1500);
      }
    } catch (err: any) {
      setActionError(err.message || 'Une erreur est survenue lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setActionError(null);
    setActionSuccess(null);

    setIsSubmitting(true);
    try {
      if (isOfflineMode) {
        const updatedUsers = users.map((u) => {
          if (u.id === selectedUser.id) {
            return {
              ...u,
              name,
              firstName: firstName || null,
              phone: phone || null,
              email,
              login: login || null,
              role,
            };
          }
          return u;
        });
        setUsers(updatedUsers);
        safeSetItem("inci-cache:users", JSON.stringify(updatedUsers));

        addOfflineMutation(
          'UPDATE_USER',
          { id: selectedUser.id, data: { name, firstName, phone, email, login, role, newPassword: newPassword || undefined } },
          `Modifier le compte de ${firstName} ${name} (Hors-ligne)`
        );

        setActionSuccess('Compte modifié localement !');
        setTimeout(() => setIsEditOpen(false), 1500);
        return;
      }

      const result = await adminUpdateUser(selectedUser.id, {
        name,
        firstName,
        phone,
        email,
        login,
        role,
        newPassword: newPassword || undefined
      });

      if (result.success) {
        setActionSuccess('Compte modifié avec succès !');
        fetchUsers();
        setTimeout(() => setIsEditOpen(false), 1500);
      }
    } catch (err: any) {
      setActionError(err.message || 'Une erreur est survenue lors de la modification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedUser) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      if (isOfflineMode) {
        const updatedUsers = users.filter((u) => u.id !== selectedUser.id);
        setUsers(updatedUsers);
        safeSetItem("inci-cache:users", JSON.stringify(updatedUsers));

        addOfflineMutation(
          'DELETE_USER',
          { id: selectedUser.id },
          `Supprimer le compte de ${selectedUser.firstName} ${selectedUser.name} (Hors-ligne)`
        );

        setIsDeleteOpen(false);
        return;
      }

      const result = await adminDeleteUser(selectedUser.id);
      if (result.success) {
        fetchUsers();
        setIsDeleteOpen(false);
      }
    } catch (err: any) {
      setActionError(err.message || 'Une erreur est survenue lors de la suppression');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter users based on search term & selected role
  const filteredUsers = users.filter(user => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = 
      user.name.toLowerCase().includes(term) ||
      (user.firstName && user.firstName.toLowerCase().includes(term)) ||
      user.email.toLowerCase().includes(term) ||
      (user.login && user.login.toLowerCase().includes(term)) ||
      (user.phone && user.phone.includes(term));

    const matchesRole = selectedRole === 'ALL' || user.role === selectedRole;

    return matchesSearch && matchesRole;
  });

  // Paginated slice — reset to page 1 when filters change
  React.useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedRole]);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getRoleBadge = (roleSlug: string) => {
    const found = availableRoles.find(r => r.slug === roleSlug);
    const name = found?.name || roleSlug;
    const color = found?.color || '#64748b';
    return (
      <span
        className="px-2.5 py-1 rounded-full text-[10px] font-bold border"
        style={{
          backgroundColor: color + '18',
          borderColor: color + '40',
          color: color,
        }}
      >
        {name.toUpperCase()}
      </span>
    );
  };



  return (
    <div className="space-y-6">
      {/* Offline banner */}
      {isOfflineMode && (
        <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40 rounded-2xl text-orange-700 dark:text-orange-400 animate-in fade-in duration-300">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.36 5.64A9 9 0 01-1.64 12c0 2.21.89 4.21 2.34 5.66m13.66 0A9 9 0 0113.64 12c0-2.21-.89-4.21-2.34-5.66m0 0L12 12m0 0l3-3m-3 3l-3-3" />
          </svg>
          <div>
            <p className="text-sm font-bold">Mode Hors-ligne (Données du cache)</p>
            <p className="text-xs mt-0.5 opacity-90">
              Les créations, modifications ou suppressions de comptes effectuées seront sauvegardées localement et synchronisées plus tard.
            </p>
          </div>
        </div>
      )}

      {/* Top Controls: Search and Add Button */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
        {/* Search & Filter Group */}
        <div className="flex flex-col sm:flex-row flex-1 max-w-2xl gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-blue-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Rechercher par nom, mail, login, contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-blue-100/60 dark:border-slate-700 rounded-xl text-sm outline-none transition focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex flex-wrap bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700 self-start sm:self-auto shrink-0 gap-1">
            <button
              onClick={() => setSelectedRole('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                selectedRole === 'ALL' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100/60 dark:border-slate-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              Tous
            </button>
            {availableRoles.map(r => (
              <button
                key={r.slug}
                onClick={() => setSelectedRole(r.slug)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedRole === r.slug ? 'bg-white dark:bg-slate-700 shadow-sm border border-slate-200/60 dark:border-slate-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
                style={selectedRole === r.slug ? { color: r.color } : {}}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        {/* Add User Button */}
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>Créer un compte</span>
        </button>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-sm font-semibold text-slate-400">Chargement des comptes...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-6 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-2xl text-red-600 dark:text-red-400">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <div>
            <h4 className="font-bold text-sm">Erreur</h4>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-10 text-center py-16">
          <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="font-bold text-slate-800 dark:text-white">Aucun compte trouvé</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Aucun compte utilisateur ne correspond aux critères de recherche actuels.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedUsers.map((user) => {
              const isMe = user.id === currentUser?.id;
              const roleColor = availableRoles.find(r => r.slug === user.role)?.color;
              return (
                <div 
                  key={user.id} 
                  className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100/80 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between relative overflow-hidden"
                >
                  {/* Top gradient accent using role color */}
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5"
                    style={{ background: roleColor ? `linear-gradient(to right, ${roleColor}90, ${roleColor}30)` : 'linear-gradient(to right, #3b82f6, #8b5cf6)' }}
                  />
                  <div>
                    {/* Header: User Role & Action buttons */}
                    <div className="flex justify-between items-start mb-4 mt-0.5">
                      {getRoleBadge(user.role)}
                      <div className="flex gap-1">
                        <button 
                          onClick={() => {
                            handleOpenEdit(user);
                          }}
                          className="p-2 rounded-xl transition text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                          title="Modifier le compte"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => {
                            handleOpenDelete(user);
                          }}
                          disabled={isMe}
                          className={`p-2 rounded-xl transition ${
                            isMe 
                              ? 'text-slate-200 dark:text-slate-700 cursor-not-allowed opacity-50'
                              : 'text-red-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20'
                          }`}
                          title={isMe ? "Vous ne pouvez pas supprimer votre propre compte" : "Supprimer le compte"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Profile Details */}
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate flex items-center gap-1.5">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{user.name} {user.firstName && <span className="font-medium text-slate-500">{user.firstName}</span>}</span>
                        </h4>
                        {user.login && (
                          <p className="text-[10px] text-indigo-500 font-bold uppercase mt-0.5 tracking-wider">
                            Identifiant : @{user.login}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{user.phone || 'Non renseigné'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer details */}
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-[10px] text-slate-400">
                    <span>Créé le {user.createdAt.toLocaleDateString('fr-FR')}</span>
                    {isMe && <span className="font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">(Vous)</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* PAGINATION */}
          {filteredUsers.length > pageSize && (
            <div className="bg-white dark:bg-slate-800 border border-blue-100/50 dark:border-slate-700 rounded-2xl px-4 py-3 shadow-sm">
              <Pagination
                currentPage={currentPage}
                totalItems={filteredUsers.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                pageSizeOptions={[6, 12, 24, 48]}
                itemLabel="comptes"
              />
            </div>
          )}
        </div>
      )}


      {/* MODAL: CREATE USER */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-lg w-full overflow-hidden shadow-xl my-8">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide">
                <UserPlus className="w-4 h-4 text-blue-500" />
                <span>Créer un nouveau compte</span>
              </h3>
              <button 
                onClick={() => setIsCreateOpen(false)} 
                className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {actionError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs font-semibold dark:bg-red-950/20 dark:border-red-900 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}
              {actionSuccess && (
                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-semibold dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Nom de famille *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: KOUASSI"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Prénoms</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ex: Jean-Marc"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Identifiant (Login)</label>
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="Ex: jm.kouassi"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Rôle *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  >
                    {availableRoles.map(r => (
                      <option key={r.slug} value={r.slug}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Adresse Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex: j.kouassi@imprimerie.ci"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Contacts (Téléphone)</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: +225 07 08 09 10"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Mot de passe *</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 caractères"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none transition pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Créer le compte</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER */}
      {isEditOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-lg w-full overflow-hidden shadow-xl my-8">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide">
                <Edit2 className="w-4 h-4 text-blue-500" />
                <span>Modifier le compte</span>
              </h3>
              <button 
                onClick={() => setIsEditOpen(false)} 
                className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {actionError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs font-semibold dark:bg-red-950/20 dark:border-red-900 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}
              {actionSuccess && (
                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-semibold dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Nom de famille *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Prénoms</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Identifiant (Login)</label>
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Rôle *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={selectedUser.id === currentUser?.id}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {availableRoles.map(r => (
                      <option key={r.slug} value={r.slug}>{r.name}</option>
                    ))}
                  </select>
                  {selectedUser.id === currentUser?.id && (
                    <p className="text-[9px] text-slate-400 mt-1">Vous ne pouvez pas modifier votre propre rôle.</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Adresse Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Contacts (Téléphone)</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mt-2">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase flex items-center gap-1 mb-2">
                  <Key className="w-3.5 h-3.5" />
                  <span>Réinitialiser le mot de passe</span>
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-3">
                  Laissez ce champ vide si vous ne souhaitez pas modifier le mot de passe de cet utilisateur.
                </p>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nouveau mot de passe (min 6 car.)"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none transition pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Enregistrer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRM */}
      {isDeleteOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-md w-full overflow-hidden shadow-xl p-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase mb-2">
              Supprimer le compte ?
            </h3>
            
            {actionError && (
              <div className="flex items-center gap-2 px-3 py-2.5 mb-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs font-semibold dark:bg-red-950/20 dark:border-red-900 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Êtes-vous sûr de vouloir supprimer définitivement le compte de <strong className="text-slate-800 dark:text-white">{selectedUser.name} {selectedUser.firstName}</strong> ({selectedUser.email}) ? 
              Cette action est irréversible et supprimera ses accès à l&apos;application.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Confirmer la suppression</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
