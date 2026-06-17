'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { User, Settings, Printer, Bell, Check, Save, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { updateUserProfile } from '@/app/actions/users';

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

type TabType = 'profile' | 'preferences' | 'printing' | 'notifications';

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
  const [defaultFormat, setDefaultFormat] = useState('CR80_PAYSAGE');
  const [highDpi, setHighDpi] = useState(true);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [alignHelpers, setAlignHelpers] = useState(true);
  
  // Notifications
  const [emailNotify, setEmailNotify] = useState(true);
  const [audioNotify, setAudioNotify] = useState(true);
  const [pushNotify, setPushNotify] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load local storage preferences if any
    const savedLang = localStorage.getItem('pref_lang');
    if (savedLang) setLang(savedLang);
    const savedFormat = localStorage.getItem('pref_format');
    if (savedFormat) setDefaultFormat(savedFormat);
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Paramètres</h1>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          Configurez votre compte, modifiez vos préférences d&apos;affichage et ajustez les paramètres d&apos;impression.
        </p>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Navigation Sidebar */}
        <div className="md:col-span-4 bg-white dark:bg-neutral-850 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-3 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition w-full whitespace-nowrap md:whitespace-normal ${
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
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition w-full whitespace-nowrap md:whitespace-normal ${
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
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition w-full whitespace-nowrap md:whitespace-normal ${
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
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition w-full whitespace-nowrap md:whitespace-normal ${
              activeTab === 'notifications'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            <Bell className="w-4 h-4 shrink-0" />
            <span>Notifications</span>
          </button>
        </div>

        {/* Form panel */}
        <div className="md:col-span-8 bg-white dark:bg-neutral-850 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden min-h-[420px]">
          {/* Notification Banner */}
          {message && (
            <div className={`flex items-center gap-2.5 px-6 py-4 border-b text-xs font-semibold ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400'
                : 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-450'
            }`}>
              {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{message.text}</span>
            </div>
          )}

          {/* Tab 1: Profile */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="p-6 space-y-5">
              <div className="border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <h3 className="text-sm font-bold text-neutral-850 dark:text-white uppercase tracking-wide">Informations du profil</h3>
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
                    className="w-full px-3 py-2 border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Prénoms</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
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
                    className="w-full px-3 py-2 border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
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
                    className="w-full px-3 py-2 border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Contacts (Téléphone)</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                  />
                </div>
              </div>

              {/* Password change divider */}
              <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4 mt-6">
                <h4 className="text-xs font-bold text-neutral-850 dark:text-white uppercase mb-3">Changer le mot de passe</h4>
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
                        className="w-full px-3 py-2 border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="absolute right-3 top-2.5 text-neutral-450 hover:text-neutral-600 transition"
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
                          className="w-full px-3 py-2 border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass(!showNewPass)}
                          className="absolute right-3 top-2.5 text-neutral-450 hover:text-neutral-600 transition"
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
                          className="w-full px-3 py-2 border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPass(!showConfirmPass)}
                          className="absolute right-3 top-2.5 text-neutral-450 hover:text-neutral-600 transition"
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
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
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
                <h3 className="text-sm font-bold text-neutral-850 dark:text-white uppercase tracking-wide">Préférences de l&apos;application</h3>
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
                    onClick={() => setTheme('light')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      theme === 'light' ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    Clair
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      theme === 'dark' ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    Sombre
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      theme === 'system' ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    Système
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

              {/* Default template Format */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-white">Gabarit par défaut</h4>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Format par défaut chargé lors de la création d&apos;un nouveau gabarit.</p>
                </div>
                <select
                  value={defaultFormat}
                  onChange={(e) => {
                    setDefaultFormat(e.target.value);
                    saveLocalPreference('pref_format', e.target.value);
                  }}
                  className="px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold min-w-[160px]"
                >
                  <option value="CR80_PAYSAGE">CR80 Paysage (324x204 px)</option>
                  <option value="CR80_PORTRAIT">CR80 Portrait (204x324 px)</option>
                  <option value="GRAND_BADGE">Grand Badge (700x450 px)</option>
                </select>
              </div>
            </div>
          )}

          {/* Tab 3: Printing */}
          {activeTab === 'printing' && (
            <div className="p-6 space-y-6">
              <div className="border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <h3 className="text-sm font-bold text-neutral-850 dark:text-white uppercase tracking-wide">Paramètres d&apos;impression physique</h3>
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
                  <div className="w-9 h-5 bg-neutral-200 dark:bg-neutral-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
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
                  <div className="w-9 h-5 bg-neutral-200 dark:bg-neutral-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
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
                      className="w-full px-3 py-2 border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
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
                      className="w-full px-3 py-2 border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
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
                <h3 className="text-sm font-bold text-neutral-850 dark:text-white uppercase tracking-wide">Préférences de notifications</h3>
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
                  <div className="w-9 h-5 bg-neutral-200 dark:bg-neutral-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
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
                  <div className="w-9 h-5 bg-neutral-200 dark:bg-neutral-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
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
                  <div className="w-9 h-5 bg-neutral-200 dark:bg-neutral-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
