import React, { useMemo, useState } from 'react';
import {
  Check,
  CloudUpload,
  Copy,
  Download,
  FileArchive,
  HardDriveDownload,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  ShieldCheck,
  Smartphone,
  Upload,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  isRunningAsStandaloneHtmlFile,
  useOnlineStatus,
  usePWAInstall,
} from '../hooks/usePWAInstall';
import { copyTextToClipboard } from '../lib/screenImagePromptGenerator';
import {
  evaluatePasswordStrength,
  listRegisteredLocalStudioAccounts,
} from '../lib/studioAccountAuth';

type AuthSubMode = 'register' | 'login' | 'recover';

function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const StudioAuthAndOfflineModal: React.FC = () => {
  const {
    user,
    studioAccount,
    isAuthenticatedAny,
    isBootAuthLocked,
    authModalOpen,
    authModalTab,
    openAuthModal,
    closeAuthModal,
    lastRecoveryCode,
    clearLastRecoveryCode,
    signInWithGoogle,
    signOutUser,
    registerStudioAccount,
    loginStudioAccount,
    recoverStudioAccount,
    syncStudioWorkspaceNow,
    downloadOfflineHtmlApp,
    exportStudioJsonBackup,
    importStudioJsonBackup,
    palette,
    activeScreenMap,
    savedPresets,
    sourcePrompts,
    snapshots,
  } = useStudio();

  const { isOnline } = useOnlineStatus();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isStandaloneHtml = isRunningAsStandaloneHtmlFile();
  const isDark = palette === 'emerald-clinic';

  // Form states for Studio AI Account Registration / Login / Recovery
  const [authSubMode, setAuthSubMode] = useState<AuthSubMode>('register');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organization, setOrganization] = useState('Pracownia Aether Studio');
  const [role, setRole] = useState('Projektant Systemów Dotykowych');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [copiedRecovery, setCopiedRecovery] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Offline Standalone HTML Builder states
  const [includeAccountsVault, setIncludeAccountsVault] = useState(true);
  const [keepSessionSignedIn, setKeepSessionSignedIn] = useState(true);
  const [requireAuthOnBoot, setRequireAuthOnBoot] = useState(false);
  const [customFileName, setCustomFileName] = useState(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    return `aether-tactile-studio-offline-${stamp}.html`;
  });
  const [bundlingHtml, setBundlingHtml] = useState(false);
  const [bundleResult, setBundleResult] = useState<{
    fileName: string;
    sizeBytes: number;
    builtVia: 'server-compiler' | 'local-repack';
  } | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [archiveNotice, setArchiveNotice] = useState<string | null>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const registeredLocalAccounts = useMemo(
    () => listRegisteredLocalStudioAccounts(),
    // Re-read whenever modal opens or active account changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authModalOpen, studioAccount?.uid, authSuccess]
  );

  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(password),
    [password]
  );

  const isVisible = authModalOpen || isBootAuthLocked;
  if (!isVisible) return null;

  const activeTab = isBootAuthLocked ? 'auth' : authModalTab;

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthBusy(true);
    try {
      const res = await registerStudioAccount({
        displayName,
        email,
        password,
        organization,
        role,
      });
      setPassword('');
      setAuthSuccess(
        `Utworzono i autoryzowano konto Studio AI (${res.profile.studioId}). Zapisz poniżej swój klucz odzyskiwania Offline.`
      );
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Nie udało się zarejestrować konta Studio AI.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthBusy(true);
    try {
      const profile = await loginStudioAccount({ email, password });
      setPassword('');
      setAuthSuccess(
        `Zalogowano pomyślnie jako ${profile.displayName} (${profile.studioId}).`
      );
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Nie udało się zalogować na konto Studio AI.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRecoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthBusy(true);
    try {
      const profile = await recoverStudioAccount({
        email,
        recoveryCode: recoveryCodeInput,
        newPassword: newPasswordInput,
      });
      setRecoveryCodeInput('');
      setNewPasswordInput('');
      setAuthSubMode('login');
      setAuthSuccess(
        `Hasło zostało zresetowane kluczem odzyskiwania. Aktywna sesja: ${profile.displayName}.`
      );
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Błąd weryfikacji klucza odzyskiwania konta.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await signInWithGoogle();
      setAuthSuccess('Połączono z kontem chmurowym Google.');
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Logowanie Google OAuth jest niedostępne w bieżącym trybie.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCopyRecovery = async () => {
    if (!lastRecoveryCode) return;
    const ok = await copyTextToClipboard(lastRecoveryCode);
    if (ok) {
      setCopiedRecovery(true);
      window.setTimeout(() => setCopiedRecovery(false), 2200);
    }
  };

  const handleManualCloudSync = async () => {
    setSyncStatusMsg(null);
    const res = await syncStudioWorkspaceNow();
    if (res.synced) {
      setSyncStatusMsg(
        `Zsynchronizowano stan projektu i migawek z serwerem Studio AI (${res.syncedAt}).`
      );
    } else {
      setSyncStatusMsg(
        'Dane zapisano w lokalnym skarbcu Offline (synchronizacja z chmurą nastąpi po połączeniu z serwerem).'
      );
    }
  };

  const handleBuildAndDownloadOfflineHtml = async () => {
    setBundleError(null);
    setBundleResult(null);
    setBundlingHtml(true);
    try {
      const result = await downloadOfflineHtmlApp({
        includeAccountsVault,
        keepSessionSignedIn: requireAuthOnBoot ? false : keepSessionSignedIn,
        requireAuthOnBoot,
        customFileName,
      });
      setBundleResult(result);
    } catch (err: unknown) {
      setBundleError(
        err instanceof Error
          ? err.message
          : 'Nie udało się wygenerować odrębnego pliku HTML aplikacji Offline.'
      );
    } finally {
      setBundlingHtml(false);
    }
  };

  const handleExportJson = () => {
    setArchiveNotice(null);
    const res = exportStudioJsonBackup();
    setArchiveNotice(
      `Pobrano archiwum projektu ${res.fileName} (${formatByteSize(res.sizeBytes)}).`
    );
  };

  const handleImportJsonFile = (file: File) => {
    setArchiveNotice(null);
    setBundleError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importStudioJsonBackup(String(reader.result || ''));
        setArchiveNotice(
          `Wczytano pełną konfigurację studia oraz migawki z pliku ${file.name}.`
        );
      } catch (err: unknown) {
        setBundleError(
          err instanceof Error
            ? err.message
            : 'Nieprawidłowy format pliku archiwum projektu.'
        );
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Autoryzacja Konta Studio AI oraz Aplikacja Offline"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-md overflow-y-auto"
    >
      <div className="w-full max-w-3xl my-auto rounded-3xl bg-white dark:bg-[#081C17] border border-slate-200/90 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 shadow-2xl overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-slate-200/80 dark:border-emerald-400/15 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
              <span>Aether Tactile Studio</span>
              <span aria-hidden="true">·</span>
              <span>
                {isStandaloneHtml
                  ? 'Uruchomiono z odrębnego pliku Offline (.html)'
                  : isOnline
                    ? 'Tryb Połączony (Chmura + Offline)'
                    : 'Tryb Offline (Pamięć lokalna)'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {isBootAuthLocked
                ? 'Wymagana autoryzacja Konta Studio AI'
                : 'Konto Studio AI oraz Pakiet Aplikacji Offline'}
            </h2>
          </div>

          {!isBootAuthLocked && (
            <button
              type="button"
              aria-label="Zamknij okno"
              onClick={closeAuthModal}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-emerald-950/80 border border-slate-200/80 dark:border-emerald-400/20 text-slate-600 dark:text-emerald-200 hover:text-slate-900 dark:hover:text-white inline-flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Mode Switcher Tabs (Hidden only if boot-locked until user signs in) */}
        {!isBootAuthLocked && (
          <div className="px-6 sm:px-8 pt-4">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-emerald-950/90 border border-slate-200/80 dark:border-emerald-400/20">
              <button
                type="button"
                onClick={() => openAuthModal('auth')}
                className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'auth'
                    ? isDark
                      ? 'bg-emerald-400 text-emerald-950 shadow-xs'
                      : 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-emerald-200/75 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Konto Studio AI (Autoryzacja)</span>
              </button>
              <button
                type="button"
                onClick={() => openAuthModal('offline')}
                className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'offline'
                    ? isDark
                      ? 'bg-emerald-400 text-emerald-950 shadow-xs'
                      : 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-emerald-200/75 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <HardDriveDownload className="w-3.5 h-3.5" />
                <span>Pobierz Aplikację Offline (.html / PWA)</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[76vh] overflow-y-auto">
          {activeTab === 'auth' ? (
            <>
              {/* One-Time Recovery Code Banner immediately after Registration */}
              {lastRecoveryCode && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/45 border border-amber-300/80 dark:border-amber-400/35 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                      Klucz odzyskiwania Konta Studio AI (zapisz w bezpiecznym miejscu)
                    </span>
                    <button
                      type="button"
                      onClick={clearLastRecoveryCode}
                      className="text-xs text-amber-800 dark:text-amber-300 underline cursor-pointer"
                    >
                      Zapisałem klucz
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <code className="text-sm sm:text-base font-mono tabular-nums font-bold tracking-wider text-amber-950 dark:text-amber-100">
                      {lastRecoveryCode}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyRecovery}
                      className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-amber-900 dark:bg-amber-400 text-white dark:text-amber-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {copiedRecovery ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedRecovery ? 'Skopiowano klucz' : 'Kopiuj klucz'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-amber-800/90 dark:text-amber-200/80">
                    Klucz umożliwia zresetowanie hasła w pobranym pliku Offline (.html) nawet bez połączenia z internetem.
                  </p>
                </div>
              )}

              {/* Alerts */}
              {(authError || authSuccess) && (
                <div
                  className={`px-4 py-3 rounded-xl border text-xs ${
                    authError
                      ? 'bg-rose-50 dark:bg-rose-950/55 border-rose-200 dark:border-rose-400/35 text-rose-700 dark:text-rose-200'
                      : 'bg-emerald-50/80 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-400/30 text-emerald-900 dark:text-emerald-100'
                  }`}
                >
                  {authError || authSuccess}
                </div>
              )}

              {/* Active Signed-In Profile Card */}
              {isAuthenticatedAny ? (
                <div className="space-y-5">
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-emerald-950/60 border border-slate-200/80 dark:border-emerald-400/20 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5 font-mono tabular-nums">
                          <span>
                            {studioAccount
                              ? studioAccount.studioId
                              : 'GOOGLE-CLOUD-AUTH'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-sans">
                            {studioAccount
                              ? studioAccount.authMode === 'studio-cloud'
                                ? 'Konto Studio AI (Zsynchronizowane z chmurą i Offline)'
                                : 'Konto Studio AI (Skarbiec kryptograficzny Offline)'
                              : 'Konto Google Cloud / Firestore'}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-emerald-50 flex items-center gap-2">
                          <UserCheck className="w-5 h-5 text-indigo-600 dark:text-emerald-300 shrink-0" />
                          <span>
                            {studioAccount?.displayName ||
                              user?.displayName ||
                              'Użytkownik Studio'}
                          </span>
                        </h3>
                        <div className="text-xs text-slate-600 dark:text-emerald-200/80 flex flex-wrap items-center gap-1.5">
                          <span>{studioAccount?.email || user?.email}</span>
                          {studioAccount?.role && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{studioAccount.role}</span>
                            </>
                          )}
                          {studioAccount?.organization && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{studioAccount.organization}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={signOutUser}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-white dark:bg-emerald-900/70 border border-slate-200 dark:border-emerald-400/25 text-xs font-semibold text-slate-800 dark:text-emerald-100 hover:bg-slate-100 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Wyloguj sesję</span>
                      </button>
                    </div>

                    <div className="pt-3 border-t border-slate-200/75 dark:border-emerald-400/15 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <div className="text-slate-500 dark:text-emerald-300/75">
                          Ekrany na mapie
                        </div>
                        <div className="font-mono tabular-nums font-semibold text-sm mt-0.5">
                          {activeScreenMap.nodes.length}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 dark:text-emerald-300/75">
                          Migawki wersji
                        </div>
                        <div className="font-mono tabular-nums font-semibold text-sm mt-0.5">
                          {snapshots.length}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 dark:text-emerald-300/75">
                          Presety brzmień
                        </div>
                        <div className="font-mono tabular-nums font-semibold text-sm mt-0.5">
                          {savedPresets.length}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 dark:text-emerald-300/75">
                          Prompty sorsów
                        </div>
                        <div className="font-mono tabular-nums font-semibold text-sm mt-0.5">
                          {sourcePrompts.length}
                        </div>
                      </div>
                    </div>

                    {syncStatusMsg && (
                      <p className="text-xs text-indigo-700 dark:text-emerald-300">
                        {syncStatusMsg}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      {studioAccount && (
                        <button
                          type="button"
                          onClick={handleManualCloudSync}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap shrink-0"
                        >
                          <CloudUpload className="w-3.5 h-3.5" />
                          <span>Synchronizuj projekt z kontem Studio AI</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openAuthModal('offline')}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 dark:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap shrink-0"
                      >
                        <HardDriveDownload className="w-3.5 h-3.5" />
                        <span>Przejdź do pobrania aplikacji Offline (.html)</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Registration / Login / Recovery Forms */
                <div className="space-y-5">
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-emerald-100/80 leading-relaxed">
                    Zarejestruj lub zaloguj się na wbudowane{' '}
                    <strong className="font-semibold text-slate-900 dark:text-emerald-50">
                      Konto Studio AI
                    </strong>
                    . Narzędzie autoryzacyjne działa zarówno online z serwerem Studio, jak i w
                    100% offline wewnątrz pobranego pliku HTML (lokalny skarbiec skrótów
                    kryptograficznych SHA-256).
                  </p>

                  {/* Sub-mode Segmented Switch */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-emerald-950/90 border border-slate-200/80 dark:border-emerald-400/20">
                      {(
                        [
                          ['register', 'Rejestracja konta', UserPlus],
                          ['login', 'Logowanie', LogIn],
                          ['recover', 'Odzyskiwanie hasła', KeyRound],
                        ] as const
                      ).map(([id, label, Icon]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setAuthSubMode(id);
                            setAuthError(null);
                            setAuthSuccess(null);
                          }}
                          className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            authSubMode === id
                              ? isDark
                                ? 'bg-emerald-400 text-emerald-950 shadow-xs'
                                : 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 dark:text-emerald-200/75 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>

                    {!isStandaloneHtml && isOnline && (
                      <button
                        type="button"
                        disabled={authBusy}
                        onClick={handleGoogleSignIn}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-100 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Lub połącz przez Google Cloud
                      </button>
                    )}
                  </div>

                  {/* Quick Account Picker if local vault already has accounts */}
                  {authSubMode === 'login' && registeredLocalAccounts.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium text-slate-600 dark:text-emerald-200/85">
                        Zarejestrowane konta w skarbcu tej aplikacji:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {registeredLocalAccounts.map((acc) => (
                          <button
                            key={acc.email}
                            type="button"
                            onClick={() => setEmail(acc.email)}
                            className={`px-3 py-1.5 rounded-xl border text-xs text-left cursor-pointer transition-colors ${
                              email.toLowerCase() === acc.email
                                ? 'bg-indigo-50 dark:bg-emerald-900/70 border-indigo-400 dark:border-emerald-300 text-slate-900 dark:text-emerald-50'
                                : 'bg-slate-50 dark:bg-emerald-950/60 border-slate-200/80 dark:border-emerald-400/20 text-slate-700 dark:text-emerald-100'
                            }`}
                          >
                            <span className="font-semibold">{acc.displayName}</span>{' '}
                            <span className="font-mono tabular-nums text-[11px] opacity-75">
                              ({acc.email})
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {authSubMode === 'register' && (
                    <form onSubmit={handleRegisterSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                        <label className="space-y-1">
                          <span className="font-medium text-slate-700 dark:text-emerald-200 block">
                            Imię i nazwisko / Nazwa twórcy
                          </span>
                          <input
                            type="text"
                            required
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="np. Marta Kowalska"
                            className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="font-medium text-slate-700 dark:text-emerald-200 block">
                            Adres e-mail konta Studio AI
                          </span>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="projektant@studio.pl"
                            className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="font-medium text-slate-700 dark:text-emerald-200 block">
                            Pracownia / Organizacja
                          </span>
                          <input
                            type="text"
                            value={organization}
                            onChange={(e) => setOrganization(e.target.value)}
                            placeholder="Pracownia Aether Studio"
                            className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="font-medium text-slate-700 dark:text-emerald-200 block">
                            Rola w projekcie
                          </span>
                          <input
                            type="text"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            placeholder="Projektant Systemów Dotykowych"
                            className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </label>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <label className="space-y-1 block">
                          <span className="font-medium text-slate-700 dark:text-emerald-200 flex items-center justify-between">
                            <span>Hasło autoryzacyjne (min. 8 znaków)</span>
                            <span className="font-mono tabular-nums text-slate-500 dark:text-emerald-300/80">
                              Siła: {passwordStrength.label} ({passwordStrength.score}/4)
                            </span>
                          </span>
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Wprowadź silne hasło do konta Studio AI..."
                            className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </label>
                        <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-emerald-950 overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 dark:bg-emerald-400 transition-transform duration-150 origin-left"
                            style={{
                              transform: `scaleX(${Math.max(0.06, passwordStrength.score / 4)})`,
                            }}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={authBusy}
                        className="w-full min-h-[44px] py-2.5 px-5 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60 cursor-pointer whitespace-nowrap"
                      >
                        {authBusy ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Rejestrowanie konta Studio AI...</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            <span>Zarejestruj Konto Studio AI i wygeneruj klucz Offline</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {authSubMode === 'login' && (
                    <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <label className="space-y-1">
                          <span className="font-medium text-slate-700 dark:text-emerald-200 block">
                            Adres e-mail konta Studio AI
                          </span>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="projektant@studio.pl"
                            className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="font-medium text-slate-700 dark:text-emerald-200 block">
                            Hasło
                          </span>
                          <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Twoje hasło Studio AI..."
                            className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={authBusy}
                        className="w-full min-h-[44px] py-2.5 px-5 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60 cursor-pointer whitespace-nowrap"
                      >
                        {authBusy ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Weryfikacja poświadczeń...</span>
                          </>
                        ) : (
                          <>
                            <LogIn className="w-4 h-4" />
                            <span>Zaloguj na Konto Studio AI</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {authSubMode === 'recover' && (
                    <form onSubmit={handleRecoverSubmit} className="space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        <label className="space-y-1">
                          <span className="font-medium text-slate-700 dark:text-emerald-200 block">
                            Adres e-mail konta
                          </span>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="projektant@studio.pl"
                            className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="font-medium text-slate-700 dark:text-emerald-200 block">
                            Klucz odzyskiwania (AETH-...)
                          </span>
                          <input
                            type="text"
                            required
                            value={recoveryCodeInput}
                            onChange={(e) => setRecoveryCodeInput(e.target.value)}
                            placeholder="AETH-XXXX-XXXX-XXXX"
                            className="w-full min-h-[42px] px-3.5 py-2 rounded-xl font-mono uppercase bg-slate-50 dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="font-medium text-slate-700 dark:text-emerald-200 block">
                            Nowe hasło (min. 8 znaków)
                          </span>
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={newPasswordInput}
                            onChange={(e) => setNewPasswordInput(e.target.value)}
                            placeholder="Nowe hasło..."
                            className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={authBusy}
                        className="w-full min-h-[44px] py-2.5 px-5 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60 cursor-pointer whitespace-nowrap"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>Zweryfikuj klucz i ustaw nowe hasło</span>
                      </button>
                    </form>
                  )}
                </div>
              )}
            </>
          ) : (
            /* TAB 2: Standalone Single-File Offline HTML Generator + PWA + JSON Archive */
            <div className="space-y-6">
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-emerald-950/60 border border-slate-200/85 dark:border-emerald-400/25 space-y-4">
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
                    <span>Samodzielny Plik Wykonywalny Przeglądarki</span>
                    <span aria-hidden="true">·</span>
                    <span>Pełna Praca Bez Sieci (file:// oraz Offline)</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-emerald-50">
                    Pobierz kompletną aplikację w jednym odrębnym pliku (.html)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-emerald-100/80 leading-relaxed">
                    Kompilator pakuje cały silnik 3D WebGL (Three.js), syntezator akustyczny
                    (&lt;160 Hz), oscyloskop haptyczny z eksportem WAV/JSON, prototypowanie
                    Drag &amp; Drop, mapę ekranów DAG, obrazy referencyjne Base64, lokalne
                    silniki generatywne Offline oraz narzędzie autoryzacyjne Konta Studio AI do
                    jednego niezależnego pliku HTML.
                  </p>
                </div>

                {/* Bundle Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                  <label className="p-3 rounded-xl bg-white dark:bg-emerald-950/80 border border-slate-200/80 dark:border-emerald-400/20 flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeAccountsVault}
                      onChange={(e) => setIncludeAccountsVault(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-emerald-50">
                        Osadź skarbiec Konta Studio AI
                      </div>
                      <div className="text-slate-500 dark:text-emerald-200/70 mt-0.5">
                        Przenosi zaszyfrowane skróty haseł zarejestrowanych kont do pobranego pliku.
                      </div>
                    </div>
                  </label>

                  <label className="p-3 rounded-xl bg-white dark:bg-emerald-950/80 border border-slate-200/80 dark:border-emerald-400/20 flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireAuthOnBoot}
                      onChange={(e) => setRequireAuthOnBoot(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-emerald-50">
                        Wymagaj logowania przy starcie pliku
                      </div>
                      <div className="text-slate-500 dark:text-emerald-200/70 mt-0.5">
                        Chroni pobrany plik ekranem logowania/rejestracji Konta Studio AI przed otwarciem projektu.
                      </div>
                    </div>
                  </label>
                </div>

                {!requireAuthOnBoot && studioAccount && (
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-emerald-100 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={keepSessionSignedIn}
                      onChange={(e) => setKeepSessionSignedIn(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      Zachowaj aktywnie zalogowany profil ({studioAccount.displayName} ·{' '}
                      {studioAccount.studioId}) w pobranym pliku
                    </span>
                  </label>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
                  <label className="sm:col-span-6 space-y-1 text-xs">
                    <span className="font-medium text-slate-700 dark:text-emerald-200 block">
                      Nazwa odrębnego pliku aplikacji (.html)
                    </span>
                    <input
                      type="text"
                      value={customFileName}
                      onChange={(e) => setCustomFileName(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl font-mono text-xs bg-white dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </label>

                  <div className="sm:col-span-6">
                    <button
                      type="button"
                      disabled={bundlingHtml}
                      onClick={handleBuildAndDownloadOfflineHtml}
                      className="w-full min-h-[42px] py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60 cursor-pointer whitespace-nowrap"
                    >
                      {bundlingHtml ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Kompilowanie pełnej aplikacji Offline...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Pobierz aplikację w całości (.html)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {bundleResult && (
                  <div className="px-4 py-3 rounded-xl bg-emerald-50/90 dark:bg-emerald-900/55 border border-emerald-200 dark:border-emerald-400/30 text-xs text-emerald-950 dark:text-emerald-100 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Pobrano samodzielną aplikację:{' '}
                      <strong className="font-mono">{bundleResult.fileName}</strong>
                    </span>
                    <span className="font-mono tabular-nums font-semibold">
                      {formatByteSize(bundleResult.sizeBytes)} ·{' '}
                      {bundleResult.builtVia === 'local-repack'
                        ? 'Re-eksport lokalny DOM'
                        : 'Kompilator jednopakietowy'}
                    </span>
                  </div>
                )}

                {bundleError && (
                  <div className="px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/55 border border-rose-200 dark:border-rose-400/35 text-xs text-rose-700 dark:text-rose-200">
                    {bundleError}
                  </div>
                )}
              </div>

              {/* Secondary Row: Installable Offline PWA + Project JSON Archive */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* PWA Install Card */}
                <div className="p-4 rounded-2xl bg-white dark:bg-emerald-950/45 border border-slate-200/80 dark:border-emerald-400/20 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 dark:text-emerald-300/75">
                      Progressive Web App · Service Worker Cache
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
                      Instalacja aplikacji na pulpicie / ekranie głównym (PWA)
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-emerald-200/75 leading-relaxed">
                      {isInstalled
                        ? 'Aplikacja działa już w zainstalowanym oknie systemowym Standalone PWA z pamięcią podręczną Offline.'
                        : isStandaloneHtml
                          ? 'Korzystasz już z pobranego, niezależnego pliku lokalnego HTML (działa całkowicie bez serwera).'
                          : 'Zainstaluj Aether Tactile Studio jako natywną aplikację okienkową z automatyczną pamięcią podręczną zasobów.'}
                    </p>
                  </div>

                  {!isInstalled && !isStandaloneHtml && (
                    <div>
                      {isInstallable ? (
                        <button
                          type="button"
                          onClick={install}
                          className="min-h-[38px] px-4 py-2 rounded-xl bg-indigo-600 dark:bg-emerald-500 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Zainstaluj aplikację PWA</span>
                        </button>
                      ) : isIOS ? (
                        <button
                          type="button"
                          onClick={() => setShowIOSGuide((v) => !v)}
                          className="min-h-[38px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Instrukcja instalacji na iOS / iPadOS</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-emerald-300/80">
                          Pamięć podręczna Service Worker aktywna (użyj ikony instalacji w pasku adresu przeglądarki lub pobierz plik .html powyżej).
                        </span>
                      )}

                      {showIOSGuide && (
                        <p className="mt-2 text-xs text-slate-700 dark:text-emerald-200 bg-slate-100 dark:bg-emerald-900/50 p-2.5 rounded-xl">
                          1. Stuknij przycisk <strong>Udostępnij</strong> w pasku Safari. 2. Wybierz{' '}
                          <strong>Dodaj do ekranu początkowego</strong>.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Portable Project JSON Archive */}
                <div className="p-4 rounded-2xl bg-white dark:bg-emerald-950/45 border border-slate-200/80 dark:border-emerald-400/20 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 dark:text-emerald-300/75">
                      Wymiana Stanu Projektu (.aether.json)
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
                      Archiwum konfiguracji, mapy ekranów i migawek
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-emerald-200/75 leading-relaxed">
                      Zapisz lekki plik projektu JSON lub wczytaj go ponownie między wersją
                      chmurową a pobraną aplikacją Offline HTML.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap shrink-0"
                    >
                      <FileArchive className="w-3.5 h-3.5" />
                      <span>Eksportuj .aether.json</span>
                    </button>

                    <label className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-emerald-900/70 border border-slate-200 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-200/70 whitespace-nowrap shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Wczytaj archiwum</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImportJsonFile(f);
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {archiveNotice && (
                    <p className="text-xs text-indigo-700 dark:text-emerald-300">
                      {archiveNotice}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
