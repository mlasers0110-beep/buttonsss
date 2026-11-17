import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  HardDriveDownload,
  Monitor,
  RefreshCw,
  Server,
  Smartphone,
  Tablet,
  Terminal,
  X,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { hapticAudio } from '../lib/hapticAudioEngine';
import {
  buildInteractivePresentationHtml,
   buildLocalhostServerBundleFiles,
  downloadLocalhostServerZip,
  downloadStandalonePresentationHtml,
  LocalhostPresentationBuildInput,
  saveLocalhostServerToLocalDisk,
} from '../lib/localhostPresentationBuilder';
import { getActiveLocalDirectoryHandle } from '../lib/localDiskWorkspace';

type ModalTab = 'live-host' | 'build-server';

export const LocalhostPresentationModal: React.FC = () => {
  const {
    localhostModalOpen,
    setLocalhostModalOpen,
    palette,
    depth,
    engraving,
    synth,
    haptic,
    patterns,
    activeScreenMap,
    activePreviewScreenId,
    setActivePreviewScreenId,
    generatedElements,
    activeBuildMatrix,
    workingFrontendImage,
    localDiskConfig,
    selectLocalDiskDirectory,
    zeroLimitLocalMode,
    setZeroLimitLocalMode,
  } = useStudio();

  const [tab, setTab] = useState<ModalTab>('live-host');
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [portNumber, setPortNumber] = useState<number>(4173);
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [savingToDisk, setSavingToDisk] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  const isDark = palette === 'emerald-clinic';

  const buildInput: LocalhostPresentationBuildInput = useMemo(
    () => ({
      projectName:
        activeBuildMatrix?.projectTitle ||
        activeScreenMap.name ||
        'Aether Frontend Studio',
      screenMap: activeScreenMap,
      generatedElements,
      activeBuildMatrix,
      workingImage: workingFrontendImage,
      palette,
      depth,
      engraving,
      synth,
      haptic,
      defaultPort: portNumber,
    }),
    [
      activeBuildMatrix,
      activeScreenMap,
      generatedElements,
      workingFrontendImage,
      palette,
      depth,
      engraving,
      synth,
      haptic,
      portNumber,
    ]
  );

  const presentationHtml = useMemo(() => {
    if (!localhostModalOpen) return '';
    return buildInteractivePresentationHtml(buildInput, activePreviewScreenId);
  }, [localhostModalOpen, buildInput, activePreviewScreenId]);

  const [blobPreviewUrl, setBlobPreviewUrl] = useState<string>('#');

  useEffect(() => {
    if (!localhostModalOpen || !presentationHtml) return;
    const blob = new Blob([presentationHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setBlobPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [localhostModalOpen, presentationHtml]);

  const bundleManifest = useMemo(() => {
    if (!localhostModalOpen || tab !== 'build-server') return [];
    return buildLocalhostServerBundleFiles(buildInput);
  }, [localhostModalOpen, tab, buildInput]);

  if (!localhostModalOpen) return null;

  const activeScreen =
    activeScreenMap.nodes.find((n) => n.id === activePreviewScreenId) ||
    activeScreenMap.nodes[0];

  const simulatedUrl = `http://localhost:${portNumber}${activeScreen?.route || '/'}`;

  const handleDownloadZip = () => {
    const res = downloadLocalhostServerZip(buildInput);
    setStatusBanner(
      `Pobrano gotowy pakiet serwera Localhost „${res.fileName}” (${res.filesCount} plików, ${res.sizeKb} KB). Rozpakuj i uruchom: node start-localhost.mjs`
    );
    hapticAudio.triggerPress(synth, haptic, patterns, { pitchSemitones: 5 });
  };

  const handleDownloadHtmlOnly = () => {
    const res = downloadStandalonePresentationHtml(buildInput, activePreviewScreenId);
    setStatusBanner(
      `Pobrano samodzielny plik prezentacji „${res.fileName}” (${res.sizeKb} KB) — otworzysz go dwuklikiem w każdej przeglądarce.`
    );
    hapticAudio.triggerPress(synth, haptic, patterns, { pitchSemitones: 4 });
  };

  const handleWriteServerDirectlyToDisk = async () => {
    setSavingToDisk(true);
    setStatusBanner(null);
    try {
      if (!getActiveLocalDirectoryHandle()) {
        const picked = await selectLocalDiskDirectory();
        if (!picked.ok) {
          const zipFallback = downloadLocalhostServerZip(buildInput);
          setStatusBanner(
            `Przeglądarka działa w trybie izolowanym — pobrano kompletny serwer jako archiwum „${zipFallback.fileName}” (${zipFallback.filesCount} plików).`
          );
          return;
        }
      }
      const res = await saveLocalhostServerToLocalDisk(
        localDiskConfig.subFolderName || 'prezentacja',
        buildInput
      );
      setStatusBanner(res.message);
      hapticAudio.triggerPress(synth, haptic, patterns, { pitchSemitones: 6 });
    } finally {
      setSavingToDisk(false);
    }
  };

  const handleCopyTerminalCmd = async () => {
    try {
      await navigator.clipboard.writeText('node start-localhost.mjs --open');
      setCopiedCmd(true);
      hapticAudio.triggerPress(synth, haptic, patterns, { pitchSemitones: 3 });
      window.setTimeout(() => setCopiedCmd(false), 1800);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lokalny Host Prezentacji Frontendów"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/65 backdrop-blur-md"
    >
      <div className="w-full max-w-[1320px] max-h-[92vh] rounded-3xl bg-white dark:bg-[#081C17] text-slate-900 dark:text-emerald-50 border border-slate-200/90 dark:border-emerald-400/25 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-emerald-400/20 flex flex-wrap items-center justify-between gap-3 bg-slate-50/90 dark:bg-emerald-950/70">
          <div className="space-y-0.5">
            <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
              <span>Lokalny Host Prezentacji Frontendów</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {activeScreenMap.nodes.length} ekranów · {generatedElements.length} modułów .tsx · 0 zapytań API
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-semibold">
              Prezentacja Frontendu na Żywo i Generator Serwera Localhost
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Zero-Limit Local Engine Switch */}
            <label className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-emerald-900/75 border border-slate-200/85 dark:border-emerald-400/25 inline-flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={zeroLimitLocalMode}
                onChange={(e) => {
                  setZeroLimitLocalMode(e.target.checked);
                  hapticAudio.triggerPress(synth, haptic, patterns);
                }}
                className="rounded accent-indigo-600 dark:accent-emerald-400"
              />
              <span>Tryb Zero-Limit (0 błędów 429)</span>
            </label>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/80 dark:bg-emerald-950">
              <button
                type="button"
                onClick={() => {
                  setTab('live-host');
                  hapticAudio.triggerPress(synth, haptic, patterns);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  tab === 'live-host'
                    ? isDark
                      ? 'bg-emerald-400 text-emerald-950 shadow-sm'
                      : 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-emerald-200/80'
                }`}
              >
                1. Podgląd Hosta na Żywo
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('build-server');
                  hapticAudio.triggerPress(synth, haptic, patterns);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  tab === 'build-server'
                    ? isDark
                      ? 'bg-emerald-400 text-emerald-950 shadow-sm'
                      : 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-emerald-200/80'
                }`}
              >
                2. Zbuduj Serwer Localhost:{portNumber}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setLocalhostModalOpen(false)}
              aria-label="Zamknij okno Localhost"
              className="w-9 h-9 rounded-xl bg-white dark:bg-emerald-900/80 border border-slate-200/80 dark:border-emerald-400/25 inline-flex items-center justify-center text-slate-600 dark:text-emerald-100 hover:opacity-90 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {statusBanner && (
          <div className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-900/55 border-b border-emerald-200 dark:border-emerald-400/25 text-xs text-emerald-900 dark:text-emerald-100 flex items-center justify-between gap-3">
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="underline text-[11px] cursor-pointer whitespace-nowrap"
            >
              Ukryj
            </button>
          </div>
        )}

        {/* Tab 1: Live Interactive Browser Host */}
        {tab === 'live-host' && (
          <div className="flex-1 min-h-0 flex flex-col bg-slate-100/90 dark:bg-[#05120F]">
            {/* Browser Host Address & Controls Bar */}
            <div className="px-4 py-2.5 border-b border-slate-200/80 dark:border-emerald-400/15 bg-white dark:bg-emerald-950/80 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setIframeKey((k) => k + 1);
                    hapticAudio.triggerPress(synth, haptic, patterns);
                  }}
                  title="Odśwież instancję hosta"
                  className="h-8 px-2.5 rounded-lg bg-slate-100 dark:bg-emerald-900/70 border border-slate-200/80 dark:border-emerald-400/20 text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1 text-xs cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>

                <div className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-emerald-950 border border-slate-200/80 dark:border-emerald-400/20 flex items-center gap-2 text-xs font-mono text-slate-700 dark:text-emerald-200 min-w-0 flex-1 max-w-md truncate">
                  <Server className="w-3.5 h-3.5 text-indigo-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">{simulatedUrl}</span>
                </div>

                <select
                  aria-label="Wybierz ekran startowy prezentacji"
                  value={activeScreen?.id || ''}
                  onChange={(e) => setActivePreviewScreenId(e.target.value)}
                  className="h-8 px-2.5 rounded-lg text-xs font-medium bg-white dark:bg-emerald-900/80 border border-slate-200/85 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 max-w-[210px] truncate cursor-pointer"
                >
                  {activeScreenMap.nodes.map((node, i) => (
                    <option key={node.id} value={node.id}>
                      Ekran {i + 1}: {node.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-slate-200/75 dark:bg-emerald-900/70">
                  {(
                    [
                      ['desktop', Monitor, '1440px'],
                      ['tablet', Tablet, '768px'],
                      ['mobile', Smartphone, '390px'],
                    ] as const
                  ).map(([id, Icon, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setViewport(id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                        viewport === id
                          ? isDark
                            ? 'bg-emerald-400 text-emerald-950 font-semibold'
                            : 'bg-white text-slate-900 font-semibold shadow-sm'
                          : 'text-slate-600 dark:text-emerald-200/80'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                <a
                  href={blobPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => hapticAudio.triggerPress(synth, haptic, patterns)}
                  className="min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-emerald-900/80 border border-slate-200/85 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 hover:opacity-95 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Otwórz pełny ekran w karcie</span>
                </a>

                <button
                  type="button"
                  onClick={handleDownloadHtmlOnly}
                  className="min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 hover:opacity-95 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pobierz .html</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadZip}
                  className="min-h-[34px] px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-800 text-white dark:text-emerald-50 hover:opacity-95 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <HardDriveDownload className="w-3.5 h-3.5" />
                  <span>Pobierz serwer Localhost (.zip)</span>
                </button>
              </div>
            </div>

            {/* Clean Isolated Presentation Viewport */}
            <div className="flex-1 min-h-[460px] p-3 sm:p-5 flex justify-center overflow-auto">
              <div
                className={`w-full h-full min-h-[440px] rounded-2xl overflow-hidden border border-slate-300/90 dark:border-emerald-400/25 shadow-xl bg-white transition-all duration-200 ${
                  viewport === 'mobile'
                    ? 'max-w-[390px]'
                    : viewport === 'tablet'
                      ? 'max-w-[768px]'
                      : 'max-w-full'
                }`}
              >
                <iframe
                  key={`${iframeKey}-${activePreviewScreenId}`}
                  title="Izolowany Host Prezentacji Frontendu"
                  srcDoc={presentationHtml}
                  sandbox="allow-scripts allow-same-origin"
                  className="w-full h-[540px] border-0 block"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Build Standalone Localhost Server on Disk or ZIP */}
        {tab === 'build-server' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-50 dark:bg-emerald-950/60 border border-slate-200/85 dark:border-emerald-400/20 space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="text-xs text-slate-500 dark:text-emerald-300/80 font-mono tabular-nums">
                    Zero zależności zewnętrznych · Działa bez kluczy API i bez limitów zapytań
                  </div>
                  <h3 className="text-lg font-semibold">
                    Gotowy serwer prezentacyjny `http://localhost:{portNumber}`
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-emerald-100/80 leading-relaxed">
                    Pakiet buduje jednocześnie **gotową skompilowaną prezentację `dist/index.html`**
                    obsługiwaną natychmiast przez lekki skrypt `start-localhost.mjs` (bez konieczności
                    uruchamiania `npm install`) oraz pełny projekt źródłowy **Vite + React 19 + TypeScript**.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label
                      htmlFor="localhost-port-input"
                      className="block text-xs font-medium text-slate-700 dark:text-emerald-200"
                    >
                      Domyślny port serwera Localhost
                    </label>
                    <input
                      id="localhost-port-input"
                      type="number"
                      min={1024}
                      max={65535}
                      value={portNumber}
                      onChange={(e) =>
                        setPortNumber(
                          Math.max(1024, Math.min(65535, Number(e.target.value) || 4173))
                        )
                      }
                      className="w-full h-10 px-3 rounded-xl text-xs font-mono tabular-nums bg-white dark:bg-emerald-950 border border-slate-200/90 dark:border-emerald-400/25"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="block text-xs font-medium text-slate-700 dark:text-emerald-200">
                      Polecenie uruchomienia w terminalu
                    </span>
                    <div className="h-10 px-3 rounded-xl bg-slate-900 text-slate-100 flex items-center justify-between gap-2 text-xs font-mono">
                      <span className="truncate flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>node start-localhost.mjs --open</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyTerminalCmd}
                        className="text-[11px] text-emerald-300 hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedCmd ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedCmd ? 'Skopiowano' : 'Kopiuj'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 hover:opacity-95 inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    <span>Pobierz Serwer Localhost (.zip)</span>
                  </button>

                  <button
                    type="button"
                    disabled={savingToDisk}
                    onClick={handleWriteServerDirectlyToDisk}
                    className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-800 text-white dark:text-emerald-50 hover:opacity-95 inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>
                      {savingToDisk
                        ? 'Zapisywanie serwera na dysku...'
                        : localDiskConfig.directoryName
                          ? `Zapisz w folderze „${localDiskConfig.directoryName}”`
                          : 'Wybierz folder i zapisz serwer na dysku'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadHtmlOnly}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-medium bg-white dark:bg-emerald-900/75 border border-slate-200/85 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-50 hover:opacity-95 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <span>Sam plik dist/index.html</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-950 text-slate-100 border border-slate-800 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="text-xs text-emerald-300 font-mono mb-1">
                    Struktura generowanego serwera ({bundleManifest.length} plików)
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1 text-xs font-mono text-slate-300">
                    {bundleManifest.map((f) => (
                      <div
                        key={f.path}
                        className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-800/80"
                      >
                        <span className="truncate">{f.path}</span>
                        <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                          {Math.max(1, Math.round(f.content.length / 1024))} KB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-800">
                  Wskazówka: Po rozpakowaniu paczki kliknij dwukrotnie{' '}
                  <code className="text-emerald-300">URUCHOM_LOCALHOST.bat</code> (Windows) lub uruchom{' '}
                  <code className="text-emerald-300">sh uruchom-localhost.sh</code> (macOS/Linux).
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
