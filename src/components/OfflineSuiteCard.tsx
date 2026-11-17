import React, { useState } from 'react';
import {
  Download,
  HardDriveDownload,
  Loader2,
  ShieldCheck,
  Smartphone,
  UserCheck,
  UserPlus,
  WifiOff,
  X,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  isRunningAsStandaloneHtmlFile,
  useOnlineStatus,
  usePWAInstall,
} from '../hooks/usePWAInstall';

function formatSizeMb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled || isRunningAsStandaloneHtmlFile()) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[42px] px-4 py-2 rounded-xl bg-white/85 dark:bg-emerald-900/75 border border-slate-200/85 dark:border-emerald-400/25 text-xs font-semibold text-slate-800 dark:text-emerald-100 hover:bg-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>Zainstaluj PWA</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSModal(true)}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-white/85 dark:bg-emerald-900/75 border border-slate-200/85 dark:border-emerald-400/25 text-xs font-semibold text-slate-800 dark:text-emerald-100 hover:bg-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Zainstaluj na iOS</span>
        </button>

        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#081C17] border border-slate-200 dark:border-emerald-400/25 p-6 shadow-xl space-y-3 text-slate-900 dark:text-emerald-50">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">
                  Instalacja na iPhone / iPad
                </h3>
                <button
                  type="button"
                  aria-label="Zamknij instrukcję"
                  onClick={() => setShowIOSModal(false)}
                  className="p-1 text-slate-500 dark:text-emerald-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-600 dark:text-emerald-100/80 leading-relaxed">
                1. Stuknij przycisk <strong>Udostępnij</strong> w pasku narzędzi Safari.
                <br />
                2. Przewiń w dół i wybierz{' '}
                <strong>Dodaj do ekranu początkowego</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="w-full min-h-[40px] rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold cursor-pointer"
              >
                Rozumiem
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineSuiteCard: React.FC = () => {
  const {
    palette,
    depth,
    studioAccount,
    user,
    activeIdentityLabel,
    openAuthModal,
    downloadOfflineHtmlApp,
  } = useStudio();

  const { isOnline, isStandaloneFile } = useOnlineStatus();
  const [quickBundling, setQuickBundling] = useState(false);
  const [quickStatus, setQuickStatus] = useState<string | null>(null);

  const isDark = palette === 'emerald-clinic';

  const cardSurfaceStyle: React.CSSProperties = {
    borderRadius: `${depth.borderRadius}px`,
    backdropFilter: `blur(${depth.glassBlur}px)`,
    backgroundColor: isDark
      ? `rgba(11, 34, 29, ${depth.glassOpacity})`
      : `rgba(255, 255, 255, ${depth.glassOpacity})`,
    boxShadow: isDark
      ? `0 ${depth.elevation}px ${depth.blur}px rgba(0,0,0,0.46)`
      : `0 ${depth.elevation}px ${depth.blur}px rgba(88, 76, 148, 0.13)`,
  };

  const handleQuickDownloadHtml = async () => {
    setQuickBundling(true);
    setQuickStatus(null);
    try {
      const res = await downloadOfflineHtmlApp({
        includeAccountsVault: true,
        keepSessionSignedIn: true,
        requireAuthOnBoot: false,
      });
      setQuickStatus(
        `Wygenerowano i pobrano plik ${res.fileName} (${formatSizeMb(res.sizeBytes)}) ze wszystkimi zachowanymi funkcjami.`
      );
    } catch (err: unknown) {
      setQuickStatus(
        err instanceof Error
          ? err.message
          : 'Otwórz konfigurator pakietu Offline, aby pobrać plik.'
      );
    } finally {
      setQuickBundling(false);
    }
  };

  return (
    <section
      style={cardSurfaceStyle}
      className="p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl space-y-1">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
            <span>Aplikacja Offline (.html / PWA)</span>
            <span aria-hidden="true">·</span>
            <span>Wbudowana Autoryzacja Konta Studio AI</span>
            <span aria-hidden="true">·</span>
            <span>
              {isStandaloneFile
                ? 'Aktywny plik lokalny HTML'
                : isOnline
                  ? 'Gotowość Offline + Chmura'
                  : 'Tryb Offline aktywny'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-emerald-50 flex items-center gap-2">
            <HardDriveDownload className="w-5 h-5 text-indigo-600 dark:text-emerald-300 shrink-0" />
            <span>
              Odrębny plik aplikacji do pracy Offline oraz Konto Studio AI
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-emerald-100/80 leading-relaxed">
            Pobierz całe środowisko Aether Tactile Studio w jednym niezależnym pliku HTML ze
            wszystkimi zachowanymi modułami (sceny 3D, syntezator &lt;160 Hz, oscyloskop WAV/JSON,
            prototypowanie Drag &amp; Drop, mapa ekranów DAG i lokalne silniki generatywne) oraz
            zarejestruj Konto Studio AI działające bez dostępu do sieci.
          </p>
        </div>

        {/* Action Strip */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={quickBundling}
            onClick={handleQuickDownloadHtml}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-2 hover:opacity-95 disabled:opacity-60 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
          >
            {quickBundling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generowanie pliku .html...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>
                  {isStandaloneFile
                    ? 'Zapisz nową kopię pliku Offline (.html)'
                    : 'Pobierz aplikację Offline (.html)'}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => openAuthModal('auth')}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 dark:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
          >
            {studioAccount || user ? (
              <>
                <UserCheck className="w-3.5 h-3.5" />
                <span>Konto: {activeIdentityLabel}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>Rejestracja / Konto Studio AI</span>
              </>
            )}
          </button>

          <PWAInstallButton />

          <button
            type="button"
            onClick={() => openAuthModal('offline')}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/85 dark:bg-emerald-950/75 border border-slate-200/85 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-100 hover:bg-white transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Opcje pakietu i blokady startu</span>
          </button>
        </div>
      </div>

      {quickStatus && (
        <div className="px-4 py-2.5 rounded-xl bg-white/80 dark:bg-emerald-950/70 border border-slate-200/80 dark:border-emerald-400/25 text-xs text-slate-800 dark:text-emerald-100 font-mono tabular-nums">
          {quickStatus}
        </div>
      )}
    </section>
  );
};

export const OfflineConnectivityBanner: React.FC = () => {
  const { isOnline, isStandaloneFile } = useOnlineStatus();
  const { openAuthModal } = useStudio();
  const [dismissedStandalone, setDismissedStandalone] = useState(false);

  if (isOnline && (!isStandaloneFile || dismissedStandalone)) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-md rounded-2xl bg-slate-900/95 dark:bg-[#07211B]/95 border border-slate-700/80 dark:border-emerald-400/30 px-4 py-2.5 text-xs text-white dark:text-emerald-50 shadow-xl flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {!isOnline ? (
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <HardDriveDownload className="w-4 h-4 text-emerald-400 shrink-0" />
        )}
        <span className="truncate">
          {!isOnline
            ? 'Tryb Offline — lokalne silniki i skarbiec Konta Studio AI aktywne.'
            : 'Samodzielny plik aplikacji Offline (.html) — pełna funkcjonalność aktywna.'}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => openAuthModal('offline')}
          className="underline text-emerald-300 font-medium cursor-pointer whitespace-nowrap"
        >
          Pakiet
        </button>
        {isStandaloneFile && isOnline && (
          <button
            type="button"
            aria-label="Ukryj komunikat"
            onClick={() => setDismissedStandalone(true)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
