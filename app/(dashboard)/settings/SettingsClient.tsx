'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { 
  User, Settings, Printer, Bell, Check, Save, AlertCircle, Eye, EyeOff, Loader2,
  Database, Download, Upload, HardDrive, RefreshCw, FileJson, CheckCircle2,
  Clock, ShieldAlert, Trash2, FolderArchive, Play, Sun, Moon, Monitor
} from 'lucide-react';
import { updateUserProfile } from '@/app/actions/users';
import { 
  getDatabaseStats, exportDatabaseBackup, exportDatabaseSql, restoreDatabaseBackup, restoreDatabaseFromSql,
  restoreFromSavedServerFile, uploadAndRestoreBackup,
  getAutoBackupConfig, saveAutoBackupConfig, listLocalServerBackups,
  deleteLocalServerBackup, readLocalServerBackup, executeAutoBackupNow,
  checkAndRunAutoBackupIfNeeded, AutoBackupConfig
} from '@/app/actions/backup';

interface SettingsClientProps {
  initialUser: {
    name: string;
    firstName: string | null;
    phone: string | null;
    email: string;
    login: string | null;
    role: string;
  } | null;
}

type TabType = 'profile' | 'preferences' | 'printing' | 'notifications' | 'backup';

export default function SettingsClient({ initialUser }: SettingsClientProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  
  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile fields
  const [name, setName] = useState(initialUser?.name || '');
  const [firstName, setFirstName] = useState(initialUser?.firstName || '');
  const [phone, setPhone] = useState(initialUser?.phone || '');
  const [email, setEmail] = useState(initialUser?.email || '');
  const [login, setLogin] = useState(initialUser?.login || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Simulated & LocalStorage Preferences
  const [lang, setLang] = useState('fr');
  const [defaultFormat, setDefaultFormat] = useState('CARD');
  const [photoQualityMode, setPhotoQualityMode] = useState<'standard' | 'hd'>('standard');
  const [cameraQualityMode, setCameraQualityMode] = useState<'standard' | 'hd'>('hd');
  const [highDpi, setHighDpi] = useState(true);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [alignHelpers, setAlignHelpers] = useState(true);
  
  // Notifications
  const [emailNotify, setEmailNotify] = useState(true);
  const [audioNotify, setAudioNotify] = useState(true);
  const [pushNotify, setPushNotify] = useState(false);

  // Backup state
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingSql, setIsExportingSql] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [dbStats, setDbStats] = useState<{ companies: number; employees: number; templates: number; deliveryBatches: number; users: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<any | null>(null);

  // Auto Backup configuration state
  const [autoConfig, setAutoConfig] = useState<AutoBackupConfig>({
    enabled: false,
    interval: 'daily',
    maxBackups: 7,
    rotationStrategy: 'delete_oldest',
    format: 'both',
    lastBackupAt: null,
  });
  const [serverBackups, setServerBackups] = useState<Array<{ filename: string; sizeBytes: number; createdAt: string; modifiedAt: string }>>([]);
  const [loadingAutoConfig, setLoadingAutoConfig] = useState(false);
  const [isExecutingNow, setIsExecutingNow] = useState(false);
  const isAdmin = (initialUser?.role || '').toUpperCase() === 'ADMIN';

  // Password modal state for Admin confirmation
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [passModalInput, setPassModalInput] = useState('');
  const [passModalError, setPassModalError] = useState<string | null>(null);
  const [passModalTitle, setPassModalTitle] = useState('');
  const [passModalLoading, setPassModalLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<((password: string) => Promise<void>) | null>(null);

  const requestAdminAuth = (title: string, action: (password: string) => Promise<void>) => {
    if (!isAdmin) {
      setMessage({
        type: 'error',
        text: 'Accès refusé : Seuls les comptes possédant le rôle Administrateur peuvent effectuer des sauvegardes ou restaurations.',
      });
      return;
    }
    setPassModalTitle(title);
    setPendingAction(() => action);
    setPassModalInput('');
    setPassModalError(null);
    setPassModalLoading(false);
    setPassModalOpen(true);
  };

  const handleConfirmPasswordModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passModalInput.trim()) {
      setPassModalError('Veuillez saisir le mot de passe de votre compte.');
      return;
    }
    if (!pendingAction || passModalLoading) return;

    setPassModalError(null);
    setPassModalLoading(true);
    try {
      await pendingAction(passModalInput.trim());
      setPassModalOpen(false);
      setPassModalInput('');
    } catch (err: any) {
      setPassModalError(err.message || 'Action échouée');
    } finally {
      setPassModalLoading(false);
    }
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await getDatabaseStats();
      if (res.success && res.stats) setDbStats(res.stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadAutoBackupData = async () => {
    setLoadingAutoConfig(true);
    try {
      await checkAndRunAutoBackupIfNeeded();
      const config = await getAutoBackupConfig();
      setAutoConfig(config);

      const filesRes = await listLocalServerBackups();
      if (filesRes.success && filesRes.files) {
        setServerBackups(filesRes.files);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAutoConfig(false);
    }
  };

  const updateAutoConfigDirect = async (newConfigPartial: Partial<AutoBackupConfig>) => {
    try {
      const res = await saveAutoBackupConfig(newConfigPartial);
      if (res.success && res.config) {
        setAutoConfig(res.config);
        setMessage({ type: 'success', text: 'Paramètres de sauvegarde mis à jour !' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: res.error || 'Erreur lors de la mise à jour' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Erreur de mise à jour' });
    }
  };

  const updateAutoConfigWithAuth = async (newConfigPartial: Partial<AutoBackupConfig>) => {
    requestAdminAuth('Modifier l\'activation de la sauvegarde automatique', async (pass) => {
      const res = await saveAutoBackupConfig(newConfigPartial, pass);
      if (res.success && res.config) {
        setAutoConfig(res.config);
        setMessage({ type: 'success', text: 'Statut de la sauvegarde automatique mis à jour !' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        throw new Error(res.error || 'Erreur lors de la mise à jour');
      }
    });
  };

  const handleRunAutoNow = () => {
    requestAdminAuth('Exécuter une sauvegarde automatique immédiate', async (pass) => {
      setIsExecutingNow(true);
      setMessage(null);
      try {
        const res = await executeAutoBackupNow(pass, true);
        if (res.success) {
          setMessage({ type: 'success', text: `Sauvegarde automatique créée (${res.filename}) !` });
          loadAutoBackupData();
          fetchStats();
        } else {
          throw new Error(res.error || 'Erreur lors de l\'exécution');
        }
      } finally {
        setIsExecutingNow(false);
      }
    });
  };

  const handleDeleteServerBackup = (filename: string) => {
    requestAdminAuth(`Supprimer la sauvegarde serveur "${filename}"`, async (pass) => {
      const res = await deleteLocalServerBackup(filename, pass);
      if (res.success) {
        setMessage({ type: 'success', text: 'Fichier de sauvegarde supprimé' });
        loadAutoBackupData();
      } else {
        throw new Error(res.error || 'Impossible de supprimer');
      }
    });
  };

  const handleDownloadServerBackup = async (filename: string) => {
    try {
      const res = await readLocalServerBackup(filename);
      if (res.success && res.jsonString) {
        const blob = new Blob([res.jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert(res.error || 'Erreur lors du téléchargement');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRestoreServerBackup = (filename: string) => {
    requestAdminAuth(`Restaurer la base depuis "${filename}"`, async (pass) => {
      setIsRestoring(true);
      setMessage(null);
      try {
        const res = await restoreFromSavedServerFile(filename, pass);
        if (res.success) {
          setMessage({ type: 'success', text: `Base de données restaurée avec succès depuis ${filename} !` });
          fetchStats();
        } else {
          throw new Error(res.error || 'Erreur lors de la restauration');
        }
      } finally {
        setIsRestoring(false);
      }
    });
  };

  useEffect(() => {
    setMounted(true);
    fetchStats();
    loadAutoBackupData();
    // Load local storage preferences if any
    const savedLang = localStorage.getItem('pref_lang');
    if (savedLang) setLang(savedLang);
    const savedFormat = localStorage.getItem('pref_print_format') || localStorage.getItem('pref_format');
    if (savedFormat === 'CARD' || savedFormat === 'A4') setDefaultFormat(savedFormat);
    const savedPhotoMode = localStorage.getItem('inci-photo-quality-mode');
    if (savedPhotoMode === 'hd' || savedPhotoMode === 'standard') setPhotoQualityMode(savedPhotoMode);
    const savedCameraMode = localStorage.getItem('inci-camera-quality-mode');
    if (savedCameraMode === 'hd' || savedCameraMode === 'standard') setCameraQualityMode(savedCameraMode);
    const savedDpi = localStorage.getItem('pref_high_dpi');
    if (savedDpi) setHighDpi(savedDpi === 'true');
    const savedOffsetX = localStorage.getItem('pref_offset_x');
    if (savedOffsetX) setOffsetX(parseFloat(savedOffsetX) || 0);
    const savedOffsetY = localStorage.getItem('pref_offset_y');
    if (savedOffsetY) setOffsetY(parseFloat(savedOffsetY) || 0);
    const savedHelpers = localStorage.getItem('pref_align_helpers');
    if (savedHelpers) setAlignHelpers(savedHelpers === 'true');
    const savedEmail = localStorage.getItem('pref_notify_email');
    if (savedEmail) setEmailNotify(savedEmail === 'true');
    const savedAudio = localStorage.getItem('pref_notify_audio');
    if (savedAudio) setAudioNotify(savedAudio === 'true');
    const savedPush = localStorage.getItem('pref_notify_push');
    if (savedPush) setPushNotify(savedPush === 'true');
  }, []);

  const handleExportBackup = () => {
    requestAdminAuth('Exporter la base de données au format JSON', async (pass) => {
      setIsExporting(true);
      setMessage(null);
      try {
        const res = await exportDatabaseBackup(pass);
        if (res.success && res.jsonString) {
          const blob = new Blob([res.jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = res.filename || 'inci-card-backup.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          setMessage({ type: 'success', text: 'Sauvegarde JSON exportée et téléchargée avec succès !' });
        } else {
          throw new Error(res.error || 'Erreur lors de l\'exportation');
        }
      } finally {
        setIsExporting(false);
      }
    });
  };

  const handleExportSql = () => {
    requestAdminAuth('Générer et télécharger le Dump SQL', async (pass) => {
      setIsExportingSql(true);
      setMessage(null);
      try {
        const res = await exportDatabaseSql(pass);
        if (res.success && res.sqlString) {
          const blob = new Blob([res.sqlString], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = res.filename || 'inci-card-dump.sql';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          setMessage({ type: 'success', text: 'Script Dump SQL complet (.sql) exporté et téléchargé avec succès !' });
        } else {
          throw new Error(res.error || 'Erreur lors de l\'exportation SQL');
        }
      } finally {
        setIsExportingSql(false);
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
  };

  const handleRestoreBackup = () => {
    if (!restoreFile) return;
    requestAdminAuth(`Restaurer la base depuis le fichier "${restoreFile.name}"`, async (pass) => {
      setIsRestoring(true);
      setMessage(null);
      try {
        const response = await fetch('/api/backup/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'x-password-confirm': pass,
            'x-file-name': restoreFile.name,
          },
          body: restoreFile,
        });

        const res = await response.json();
        if (res.success) {
          setMessage({ type: 'success', text: 'Restauration réussie ! Les données ont été mises à jour dans la base.' });
          setRestoreFile(null);
          fetchStats();
        } else {
          throw new Error(res.error || 'Erreur lors de la restauration');
        }
      } catch (err: any) {
        throw new Error(err.message || 'Erreur lors de la restauration');
      } finally {
        setIsRestoring(false);
      }
    });
  };

  const saveLocalPreference = (key: string, value: string) => {
    localStorage.setItem(key, value);
    setMessage({ type: 'success', text: 'Paramètre enregistré localement !' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Le nouveau mot de passe et sa confirmation ne correspondent pas.' });
      return;
    }

    setIsLoading(true);
    try {
      const result = await updateUserProfile({
        name,
        firstName,
        phone,
        email,
        login,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Profil mis à jour avec succès !' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Une erreur est survenue' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="w-full space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Paramètres</h1>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          Configurez votre compte, modifiez vos préférences d&apos;affichage et ajustez les paramètres d&apos;impression.
        </p>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900/90 rounded-2xl border border-neutral-200 dark:border-slate-800/80 shadow-sm p-3 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition w-full whitespace-nowrap lg:whitespace-normal ${
              activeTab === 'profile'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            <User className="w-4 h-4 shrink-0" />
            <span>Mon Profil</span>
          </button>
          
          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition w-full whitespace-nowrap lg:whitespace-normal ${
              activeTab === 'preferences'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Préférences & Thème</span>
          </button>

          <button
            onClick={() => setActiveTab('printing')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition w-full whitespace-nowrap lg:whitespace-normal ${
              activeTab === 'printing'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span>Impression Physique</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition w-full whitespace-nowrap lg:whitespace-normal ${
              activeTab === 'notifications'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            <Bell className="w-4 h-4 shrink-0" />
            <span>Notifications</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition w-full whitespace-nowrap lg:whitespace-normal ${
              activeTab === 'backup'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            <Database className="w-4 h-4 shrink-0" />
            <span>Sauvegarde & Base</span>
          </button>
        </div>

        {/* Form panel */}
        <div className="lg:col-span-9 bg-white dark:bg-slate-900/90 rounded-2xl border border-neutral-200 dark:border-slate-800/80 shadow-sm overflow-hidden min-h-[420px]">
          {/* Notification Banner */}
          {message && (
            <div className={`flex items-center gap-2.5 px-6 py-4 border-b text-xs font-semibold ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400'
                : 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400'
            }`}>
              {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{message.text}</span>
            </div>
          )}

          {/* Tab 1: Profile */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="p-6 space-y-5">
              <div className="border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <h3 className="text-sm font-bold text-neutral-800 dark:text-white uppercase tracking-wide">Informations du profil</h3>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">Modifiez vos informations d&apos;accès et votre mot de passe.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Nom de famille</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Prénoms</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Identifiant (Login)</label>
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Rôle Système</label>
                  <input
                    type="text"
                    disabled
                    value={initialUser?.role || 'OPERATEUR'}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800/50 rounded-xl text-sm font-semibold text-neutral-400 cursor-not-allowed uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Adresse Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Contacts (Téléphone)</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                  />
                </div>
              </div>

              {/* Password change divider */}
              <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4 mt-6">
                <h4 className="text-xs font-bold text-neutral-800 dark:text-white uppercase mb-3">Changer le mot de passe</h4>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-4">Laissez ces champs vides si vous ne souhaitez pas modifier votre mot de passe.</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Mot de passe actuel</label>
                    <div className="relative">
                      <input
                        type={showCurrentPass ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 transition"
                      >
                        {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Nouveau mot de passe</label>
                      <div className="relative">
                        <input
                          type={showNewPass ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min 6 caractères"
                          className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass(!showNewPass)}
                          className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 transition"
                        >
                          {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Confirmer nouveau mot de passe</label>
                      <div className="relative">
                        <input
                          type={showConfirmPass ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirmer"
                          className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPass(!showConfirmPass)}
                          className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 transition"
                        >
                          {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Enregistrer</span>
                </button>
              </div>
            </form>
          )}

          {/* Tab 2: Preferences */}
          {activeTab === 'preferences' && (
            <div className="p-6 space-y-6">
              <div className="border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <h3 className="text-sm font-bold text-neutral-800 dark:text-white uppercase tracking-wide">Préférences de l&apos;application</h3>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">Personnalisez votre environnement de travail global.</p>
              </div>

              {/* Redesigned Compact Theme Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-white">Thème visuel</h4>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Choisissez le mode sombre, clair ou automatique.</p>
                </div>
                <div className="flex bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('light');
                      setMessage({ type: 'success', text: 'Thème visuel appliqué : Mode Clair' });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      theme === 'light'
                        ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Clair</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('dark');
                      setMessage({ type: 'success', text: 'Thème visuel appliqué : Mode Sombre' });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      theme === 'dark'
                        ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Sombre</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('system');
                      setMessage({ type: 'success', text: 'Thème visuel appliqué : Mode Système (Auto)' });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      theme === 'system'
                        ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Système</span>
                  </button>
                </div>
              </div>

              {/* Language Selection */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-white">Langue de l&apos;interface</h4>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Sélectionnez la langue par défaut du tableau de bord.</p>
                </div>
                <select
                  value={lang}
                  onChange={(e) => {
                    setLang(e.target.value);
                    saveLocalPreference('pref_lang', e.target.value);
                  }}
                  className="px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold min-w-[160px]"
                >
                  <option value="fr">Français (FR)</option>
                  <option value="en">English (EN)</option>
                </select>
              </div>

              {/* File Import Photo Quality Preference */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-white">Qualité des fichiers photos importés</h4>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Résolution et compression appliquées lors du chargement manuel de fichiers images.</p>
                </div>
                <select
                  value={photoQualityMode}
                  onChange={(e) => {
                    const mode = e.target.value as 'standard' | 'hd';
                    setPhotoQualityMode(mode);
                    localStorage.setItem('inci-photo-quality-mode', mode);
                    setMessage({
                      type: 'success',
                      text: `Résolution des fichiers importés : ${mode === 'hd' ? 'Haute Définition (800×960, 300 DPI)' : 'Standard (400×480)'}`,
                    });
                  }}
                  className="px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold min-w-[260px]"
                >
                  <option value="standard">Standard (400×480 px - Rapide & Léger)</option>
                  <option value="hd">Haute Définition (800×960 px - Optimal 300 DPI)</option>
                </select>
              </div>

              {/* Camera / Webcam Capture Photo Quality Preference */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-white">Qualité de capture Appareil Photo / Webcam</h4>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Résolution conservée pour les clichés pris directement en direct (Canon EOS / Webcam).</p>
                </div>
                <select
                  value={cameraQualityMode}
                  onChange={(e) => {
                    const mode = e.target.value as 'standard' | 'hd';
                    setCameraQualityMode(mode);
                    localStorage.setItem('inci-camera-quality-mode', mode);
                    setMessage({
                      type: 'success',
                      text: `Qualité de capture Appareil Photo : ${mode === 'hd' ? 'Haute Définition (1250×1650, 300 DPI - Recommandé)' : 'Standard (625×825)'}`,
                    });
                  }}
                  className="px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold min-w-[260px]"
                >
                  <option value="hd">Haute Définition (1250×1650 px - Recommandé)</option>
                  <option value="standard">Standard (625×825 px - Format compact)</option>
                </select>
              </div>

              {/* Default Print Format */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-white">Format d&apos;impression par défaut</h4>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Format sélectionné par défaut sur la page d&apos;impression des badges.</p>
                </div>
                <select
                  value={defaultFormat}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDefaultFormat(val);
                    localStorage.setItem('pref_print_format', val);
                    localStorage.setItem('pref_format', val);
                    setMessage({
                      type: 'success',
                      text: `Format d'impression par défaut : ${val === 'CARD' ? 'Imprimante à badges (Ex: CR80)' : 'Planche A4'}`,
                    });
                  }}
                  className="px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold min-w-[260px]"
                >
                  <option value="CARD">Imprimante à badges (Ex: CR80)</option>
                  <option value="A4">Planche A4</option>
                </select>
              </div>
            </div>
          )}

          {/* Tab 3: Printing */}
          {activeTab === 'printing' && (
            <div className="p-6 space-y-6">
              <div className="border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <h3 className="text-sm font-bold text-neutral-800 dark:text-white uppercase tracking-wide">Paramètres d&apos;impression physique</h3>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">Ajustez les réglages de calibration avec l&apos;imprimante thermique ou papier.</p>
              </div>

              {/* High DPI Render */}
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-white">Rendu Haute Définition (300 DPI)</h4>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Augmente la résolution d&apos;exportation et d&apos;impression des textes et QR codes.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highDpi}
                    onChange={(e) => {
                      setHighDpi(e.target.checked);
                      saveLocalPreference('pref_high_dpi', e.target.checked ? 'true' : 'false');
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-neutral-200 dark:bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Align Helpers */}
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-white">Aimantations et guides (Snapping)</h4>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Activer les guides d&apos;alignement roses magnétiques dans le studio.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alignHelpers}
                    onChange={(e) => {
                      setAlignHelpers(e.target.checked);
                      saveLocalPreference('pref_align_helpers', e.target.checked ? 'true' : 'false');
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-neutral-200 dark:bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Physical Offsets */}
              <div>
                <h4 className="text-xs font-bold text-neutral-800 dark:text-white mb-3">Ajustement du centrage physique (Calibration)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Décalage horizontal X (mm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={offsetX}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setOffsetX(val);
                        saveLocalPreference('pref_offset_x', val.toString());
                      }}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Décalage vertical Y (mm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={offsetY}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setOffsetY(val);
                        saveLocalPreference('pref_offset_y', val.toString());
                      }}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-2">Permet de décaler le rendu physique de quelques fractions de millimètre si les marges de l&apos;imprimante thermique décalent les faces du badge.</p>
              </div>
            </div>
          )}

          {/* Tab 4: Notifications */}
          {activeTab === 'notifications' && (
            <div className="p-6 space-y-6">
              <div className="border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <h3 className="text-sm font-bold text-neutral-800 dark:text-white uppercase tracking-wide">Préférences de notifications</h3>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">Décidez des alertes générées par l&apos;activité du personnel.</p>
              </div>

              {/* Email Alerts */}
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-white">Rapport d&apos;importation Excel par email</h4>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Recevoir un e-mail récapitulatif chaque fois qu&apos;un fichier d&apos;employés est importé.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailNotify}
                    onChange={(e) => {
                      setEmailNotify(e.target.checked);
                      saveLocalPreference('pref_notify_email', e.target.checked ? 'true' : 'false');
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-neutral-200 dark:bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Audio Alerts */}
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-white">Signal sonore à l&apos;envoi d&apos;impression</h4>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Jouer un bip sonore lors du lancement réussi d&apos;une impression de carte.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={audioNotify}
                    onChange={(e) => {
                      setAudioNotify(e.target.checked);
                      saveLocalPreference('pref_notify_audio', e.target.checked ? 'true' : 'false');
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-neutral-200 dark:bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Push Alerts */}
              <div className="flex items-center justify-between pb-2">
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-white">Notifications Push Navigateur</h4>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Afficher des alertes système lorsque des photos d&apos;employés sont prêtes pour validation.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pushNotify}
                    onChange={(e) => {
                      setPushNotify(e.target.checked);
                      saveLocalPreference('pref_notify_push', e.target.checked ? 'true' : 'false');
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-neutral-200 dark:bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          )}

          {/* Tab 5: Backup & Database */}
          {activeTab === 'backup' && (
            <div className="p-6 space-y-6">
              <div className="border-b border-neutral-100 dark:border-neutral-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-800 dark:text-white uppercase tracking-wide">Sauvegarde & Base de données</h3>
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">Exportez une copie de sécurité locale de l&apos;ensemble de vos données ou restaurez un fichier existant.</p>
                </div>
                <button
                  onClick={fetchStats}
                  disabled={loadingStats}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-neutral-600 transition"
                  title="Rafraîchir les statistiques"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Database Overview Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl border border-neutral-100 dark:border-neutral-800 text-center">
                  <span className="block text-lg font-bold text-indigo-600 dark:text-indigo-400">{dbStats?.companies ?? 0}</span>
                  <span className="text-[10px] font-semibold text-neutral-500 uppercase">Entreprises</span>
                </div>
                <div className="p-3 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl border border-neutral-100 dark:border-neutral-800 text-center">
                  <span className="block text-lg font-bold text-emerald-600 dark:text-emerald-400">{dbStats?.employees ?? 0}</span>
                  <span className="text-[10px] font-semibold text-neutral-500 uppercase">Employés</span>
                </div>
                <div className="p-3 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl border border-neutral-100 dark:border-neutral-800 text-center">
                  <span className="block text-lg font-bold text-violet-600 dark:text-violet-400">{dbStats?.templates ?? 0}</span>
                  <span className="text-[10px] font-semibold text-neutral-500 uppercase">Gabarits</span>
                </div>
                <div className="p-3 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl border border-neutral-100 dark:border-neutral-800 text-center">
                  <span className="block text-lg font-bold text-amber-600 dark:text-amber-400">{dbStats?.deliveryBatches ?? 0}</span>
                  <span className="text-[10px] font-semibold text-neutral-500 uppercase">Lots de livraison</span>
                </div>
              </div>

              {/* Manual Export & Restore Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Export Section */}
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl space-y-3 flex flex-col justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-800 dark:text-white">Exporter la base en local</h4>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Génère et télécharge un fichier `.json` sécurisé contenant toutes les données sur votre ordinateur.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleExportBackup}
                      disabled={isExporting}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-sm"
                    >
                      {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileJson className="w-3.5 h-3.5" />}
                      <span>{isExporting ? 'Exportation...' : 'Télécharger (.json)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportSql}
                      disabled={isExportingSql}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-sm"
                    >
                      {isExportingSql ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
                      <span>{isExportingSql ? 'Génération...' : 'Dump SQL (.sql)'}</span>
                    </button>
                  </div>
                </div>

                {/* Restore Section */}
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-800 dark:text-white">Restaurer un fichier de sauvegarde</h4>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Importez un fichier <code className="bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.2 rounded font-mono text-[10px]">.json</code> ou <code className="bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.2 rounded font-mono text-[10px]">.sql</code> pour restaurer vos données dans la base.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="file"
                      accept=".json,.sql"
                      onChange={handleFileChange}
                      className="block w-full text-xs text-neutral-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-100 dark:file:bg-emerald-950 file:text-emerald-700 dark:file:text-emerald-300 hover:file:bg-emerald-200 cursor-pointer"
                    />

                    {restoreFile && (
                      <div className="p-2.5 bg-white dark:bg-neutral-800 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs space-y-1.5 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between font-bold text-emerald-600 dark:text-emerald-400">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{restoreFile.name}</span>
                          </div>
                          <span className="font-mono text-[10px] text-neutral-400 shrink-0 ml-2">
                            {(restoreFile.size / (1024 * 1024)).toFixed(2)} Mo
                          </span>
                        </div>
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={handleRestoreBackup}
                            disabled={isRestoring}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 shadow-sm"
                          >
                            {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                            <span>{isRestoring ? 'Restauration en cours...' : 'Lancer la restauration'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Automated Backups Settings Card */}
              <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl space-y-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 rounded-xl">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-800 dark:text-white uppercase tracking-wide">Programmation & Automatisation des sauvegardes</h4>
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                        Planifiez des sauvegardes régulières avec gestion automatique des quotas. Stockage automatique dans <code className="bg-violet-50 dark:bg-violet-950/60 px-1.5 py-0.5 rounded text-violet-600 dark:text-violet-400 font-mono font-bold">C:\inci-card\</code>.
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoConfig.enabled}
                      onChange={(e) => updateAutoConfigWithAuth({ enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 dark:bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                  </label>
                </div>

                {autoConfig.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
                    {/* Format */}
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
                        Format
                      </label>
                      <select
                        value={autoConfig.format || 'both'}
                        onChange={(e) => updateAutoConfigDirect({ format: e.target.value as any })}
                        className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold text-neutral-800 dark:text-neutral-200"
                      >
                        <option value="both">JSON + Dump SQL (Recommandé)</option>
                        <option value="json">JSON uniquement</option>
                        <option value="sql">Dump SQL (.sql) uniquement</option>
                      </select>
                    </div>

                    {/* Interval */}
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
                        Fréquence
                      </label>
                      <select
                        value={autoConfig.interval}
                        onChange={(e) => updateAutoConfigDirect({ interval: e.target.value as any })}
                        className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold text-neutral-800 dark:text-neutral-200"
                      >
                        <option value="hourly">Toutes les heures (1h)</option>
                        <option value="daily">Quotidienne (Chaque jour)</option>
                        <option value="weekly">Hebdomadaire (Semaine)</option>
                        <option value="monthly">Mensuelle (Mois)</option>
                      </select>
                    </div>

                    {/* Max Backups Quota N */}
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
                        Quota Max (N)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={autoConfig.maxBackups}
                        onChange={(e) => updateAutoConfigDirect({ maxBackups: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold text-neutral-800 dark:text-neutral-200"
                      />
                    </div>

                    {/* Rotation Strategy */}
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
                        Règle d&apos;écrasement
                      </label>
                      <select
                        value={autoConfig.rotationStrategy}
                        onChange={(e) => updateAutoConfigDirect({ rotationStrategy: e.target.value as any })}
                        className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold text-neutral-800 dark:text-neutral-200"
                      >
                        <option value="delete_oldest">Supprimer les N plus anciennes (FIFO)</option>
                        <option value="overwrite_latest">Toujours écraser la dernière</option>
                        <option value="keep_all">Conserver tout l&apos;historique</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Auto Backup Status & Execution */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                  <div className="text-neutral-500 dark:text-neutral-400">
                    {autoConfig.lastBackupAt ? (
                      <span>Dernière sauvegarde auto : <strong>{new Date(autoConfig.lastBackupAt).toLocaleString('fr-FR')}</strong></span>
                    ) : (
                      <span className="italic">Aucune sauvegarde automatique exécutée pour l&apos;instant.</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleRunAutoNow}
                    disabled={isExecutingNow}
                    className="flex items-center gap-2 px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold transition disabled:opacity-50 self-start sm:self-auto shadow-sm text-xs"
                  >
                    {isExecutingNow ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>Exécuter une sauvegarde auto maintenant</span>
                  </button>
                </div>
              </div>

              {/* Local Server Backups List Table */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-white uppercase tracking-wide flex items-center gap-2">
                    <FolderArchive className="w-4 h-4 text-violet-500" />
                    Sauvegardes automatiques stockées sur le serveur ({serverBackups.length})
                  </h4>
                  <button
                    onClick={loadAutoBackupData}
                    className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 rounded-lg transition text-xs flex items-center gap-1 font-bold"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingAutoConfig ? 'animate-spin' : ''}`} />
                    <span>Actualiser</span>
                  </button>
                </div>

                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/60 sticky top-0 font-bold text-neutral-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5">Fichier</th>
                        <th className="px-4 py-2.5">Date & Heure</th>
                        <th className="px-4 py-2.5">Taille</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {serverBackups.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-neutral-400 italic">
                            Aucune sauvegarde automatique stockée localement sur le serveur.
                          </td>
                        </tr>
                      ) : (
                        serverBackups.map((file) => (
                          <tr key={file.filename} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition">
                            <td className="px-4 py-2.5 font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                              {file.filename}
                            </td>
                            <td className="px-4 py-2.5 text-neutral-500">
                              {new Date(file.modifiedAt).toLocaleString('fr-FR')}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-neutral-500">
                              {(file.sizeBytes / 1024).toFixed(1)} Ko
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadServerBackup(file.filename)}
                                  className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-violet-600 transition"
                                  title="Télécharger"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRestoreServerBackup(file.filename)}
                                  className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg text-neutral-500 hover:text-emerald-600 transition"
                                  title="Restaurer directement dans la base"
                                >
                                  <Upload className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteServerBackup(file.filename)}
                                  className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-neutral-500 hover:text-rose-600 transition"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Password Confirmation Modal */}
      {passModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-800 dark:text-white uppercase tracking-wide">Confirmation Administrateur</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{passModalTitle}</p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              Pour des raisons de sécurité, veuillez saisir le mot de passe de votre compte administrateur pour autoriser cette action.
            </p>

            <form onSubmit={handleConfirmPasswordModal} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                  Mot de passe de votre compte
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={passModalInput}
                    onChange={(e) => setPassModalInput(e.target.value)}
                    placeholder="Saisissez votre mot de passe"
                    autoFocus
                    disabled={passModalLoading}
                    required
                    className="w-full px-3.5 py-2.5 pr-10 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold text-neutral-800 dark:text-neutral-100 focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={passModalLoading}
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 disabled:opacity-50"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {passModalLoading && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-700 dark:text-amber-300 font-medium flex items-center gap-2.5 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Traitement en cours... Veuillez patienter pendant l&apos;exécution.</span>
                </div>
              )}

              {passModalError && !passModalLoading && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passModalError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  disabled={passModalLoading}
                  onClick={() => {
                    if (!passModalLoading) setPassModalOpen(false);
                  }}
                  className="px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={passModalLoading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2"
                >
                  {passModalLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Traitement...</span>
                    </>
                  ) : (
                    <span>Confirmer l&apos;action</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
