import React, { useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  FileCode2,
  FileJson,
  FolderGit2,
  Layers,
  Save,
  Sparkles,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { hapticAudio } from '../lib/hapticAudioEngine';
import {
  downloadLocalArchitectureFile,
  serializeScreenMapToJson,
  serializeScreenMapToMermaid,
  slugifyExportName,
} from '../lib/screenMapExport';
import { SCREEN_TRANSITION_PRESETS } from '../types/studio';
import { ScreenMapExportPanel } from './ScreenMapExportPanel';

const GITHUB_STARTER_REPOS: Array<{
  slug: string;
  label: string;
  hint: string;
}> = [
  {
    slug: 'radix-ui/primitives',
    label: 'radix-ui/primitives',
    hint: 'Dostępne prymitywy UI, dialogi i przełączniki',
  },
  {
    slug: 'xyflow/xyflow',
    label: 'xyflow/xyflow',
    hint: 'Grafy węzłowe, edytory przepływów i płótna DAG',
  },
  {
    slug: 'TanStack/table',
    label: 'TanStack/table',
    hint: 'Analityczne siatki danych, filtry i raporty',
  },
  {
    slug: 'pmndrs/zustand',
    label: 'pmndrs/zustand',
    hint: 'Architektura stanu reaktywnego i selektorów',
  },
  {
    slug: 'framer/motion',
    label: 'framer/motion',
    hint: 'Animacje sprężynowe, gesty i przejścia widoków',
  },
];

export const GitHubAppMapDesigner: React.FC<{
  onOpenPlanner?: () => void;
  onOpenAllScreens?: () => void;
}> = ({ onOpenPlanner, onOpenAllScreens }) => {
  const {
    palette,
    depth,
    synth,
    haptic,
    patterns,
    activeScreenMap,
    designScreenMapFromGitHub,
    saveActiveScreenMap,
    pulseInteraction,
  } = useStudio();

  const [repoInput, setRepoInput] = useState('radix-ui/primitives');
  const [appGoal, setAppGoal] = useState(
    'Aplikacja studyjna wykorzystująca główne komponenty biblioteki z naciskiem na ergonomię dotykową i przejrzysty przepływ ekranów.'
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [showExportInspector, setShowExportInspector] = useState(false);

  const handleQuickDownloadJson = () => {
    const base = `architektura-${slugifyExportName(activeScreenMap.name || activeScreenMap.sourceRepo)}`;
    const content = serializeScreenMapToJson(activeScreenMap, {
      includeTransitionSpecs: true,
    });
    downloadLocalArchitectureFile(content, `${base}.json`, 'application/json');
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.85);
  };

  const handleQuickDownloadMermaid = () => {
    const base = `architektura-${slugifyExportName(activeScreenMap.name || activeScreenMap.sourceRepo)}`;
    const content = serializeScreenMapToMermaid(activeScreenMap, {
      direction: 'LR',
      groupByRole: true,
      includeMetadataComments: true,
      wrapInMarkdown: false,
    });
    downloadLocalArchitectureFile(content, `${base}.mmd`, 'text/vnd.mermaid');
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.85);
  };

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

  const handleGenerateFromGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedNotice(false);
    setLoading(true);
    try {
      await designScreenMapFromGitHub(repoInput, appGoal);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Nie udało się przeanalizować repozytorium GitHub.'
      );
    } finally {
      setLoading(false);
    }
  };

  const ghMeta = activeScreenMap.githubMeta;

  return (
    <section
      style={cardSurfaceStyle}
      className="p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
            <span>Usługa Projektowania Mapy Aplikacji z Biblioteki GitHub</span>
            <span aria-hidden="true">·</span>
            <span> GitHub REST Tree + Gemini 4 Hydrogen</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-emerald-50 mt-1">
            Generator Architektury i Mapy Ekranów na Podstawie Repozytorium GitHub
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-emerald-100/75 mt-1">
            Wklej link do dowolnej publicznej biblioteki lub repozytorium na GitHubie (np.{' '}
            <span className="font-mono">owner/repo</span>). Usługa pobiera rzeczywiste drzewo
            plików, zależności <span className="font-mono">package.json</span> oraz dokumentację{' '}
            <span className="font-mono">README.md</span>, a następnie buduje kompletną mapę
            ekranów i przejść gotową do edycji w planerze.
          </p>
        </div>
      </div>

      {/* Form + Quick Starter Repos */}
      <form
        onSubmit={handleGenerateFromGitHub}
        className="p-5 rounded-2xl bg-white/70 dark:bg-emerald-950/60 border border-slate-200/80 dark:border-emerald-400/20 space-y-4"
      >
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 dark:text-emerald-300/80 mr-1">
            Popularne biblioteki GitHub:
          </span>
          {GITHUB_STARTER_REPOS.map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => setRepoInput(item.slug)}
              title={item.hint}
              className={`min-h-[34px] px-3 py-1 rounded-lg font-mono text-xs cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                repoInput.trim().toLowerCase() === item.slug.toLowerCase()
                  ? isDark
                    ? 'bg-emerald-400 text-emerald-950 font-semibold'
                    : 'bg-slate-900 text-white font-semibold'
                  : 'bg-white/80 dark:bg-emerald-900/50 text-slate-700 dark:text-emerald-100 border border-slate-200/70 dark:border-emerald-400/20 hover:bg-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <label className="lg:col-span-5 space-y-1 text-xs">
            <span className="font-medium text-slate-700 dark:text-emerald-200 block">
              Adres URL lub identyfikator repozytorium GitHub
            </span>
            <div className="relative">
              <FolderGit2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="https://github.com/owner/repo lub owner/repo"
                className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-xl font-mono text-xs bg-white dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </label>

          <label className="lg:col-span-7 space-y-1 text-xs">
            <span className="font-medium text-slate-700 dark:text-emerald-200 block">
              Kontekst projektowanej aplikacji (opcjonalnie)
            </span>
            <input
              type="text"
              value={appGoal}
              onChange={(e) => setAppGoal(e.target.value)}
              placeholder="Opisz docelowy produkt budowany na bazie tej biblioteki..."
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-400/30 text-xs text-rose-700 dark:text-rose-200">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer hover:opacity-95 disabled:opacity-60 transition-opacity whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {loading
                ? 'Pobieranie drzewa GitHub i projektowanie mapy ekranów...'
                : 'Zaprojektuj mapę aplikacji z biblioteki GitHub'}
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleQuickDownloadJson}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/85 dark:bg-emerald-900/65 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white whitespace-nowrap shrink-0"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>Pobierz JSON</span>
            </button>

            <button
              type="button"
              onClick={handleQuickDownloadMermaid}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/85 dark:bg-emerald-900/65 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white whitespace-nowrap shrink-0"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Pobierz Mermaid (.mmd)</span>
            </button>

            {onOpenPlanner && (
              <button
                type="button"
                onClick={onOpenPlanner}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/85 dark:bg-emerald-900/65 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white whitespace-nowrap shrink-0"
              >
                <span>Otwórz na płótnie planera</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onOpenAllScreens && (
              <button
                type="button"
                onClick={onOpenAllScreens}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/85 dark:bg-emerald-900/65 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white whitespace-nowrap shrink-0"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Wyświetl wszystkie ekrany</span>
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Loading Skeleton */}
      {loading && (
        <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-emerald-400/20 space-y-3 animate-pulse">
          <div className="h-4 w-64 rounded bg-slate-200 dark:bg-emerald-900/60" />
          <div className="h-3 w-full rounded bg-slate-200/80 dark:bg-emerald-900/40" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="h-20 rounded-xl bg-slate-200/75 dark:bg-emerald-900/45" />
            <div className="h-20 rounded-xl bg-slate-200/75 dark:bg-emerald-900/45" />
            <div className="h-20 rounded-xl bg-slate-200/75 dark:bg-emerald-900/45" />
          </div>
        </div>
      )}

      {/* Generated GitHub Architecture Inspection & Screen Table */}
      {!loading && ghMeta && (
        <div className="space-y-5">
          <div className="p-5 rounded-2xl bg-white/70 dark:bg-emerald-950/60 border border-slate-200/80 dark:border-emerald-400/25 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-2">
                  <span>Repozytorium: {ghMeta.repoFullName}</span>
                  <span aria-hidden="true">·</span>
                  <span>Język: {ghMeta.language}</span>
                  <span aria-hidden="true">·</span>
                  <span>Gwiazdki: {ghMeta.stars.toLocaleString('pl-PL')}</span>
                  <span aria-hidden="true">·</span>
                  <span>Gałąź: {ghMeta.defaultBranch}</span>
                  <span aria-hidden="true">·</span>
                  <span>Silnik: {ghMeta.generatedByModel}</span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-emerald-50">
                  {activeScreenMap.name}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={ghMeta.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-emerald-900/70 border border-slate-200 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1.5 hover:underline whitespace-nowrap shrink-0"
                >
                  <span>GitHub</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={handleQuickDownloadJson}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-emerald-900/70 border border-slate-200 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>JSON (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={handleQuickDownloadMermaid}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-emerald-900/70 border border-slate-200 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span>Mermaid (.mmd)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowExportInspector((v) => !v)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-emerald-900/80 border border-indigo-200/80 dark:border-emerald-400/25 text-xs font-medium text-indigo-800 dark:text-emerald-100 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {showExportInspector
                    ? 'Ukryj kod eksportu'
                    : 'Podgląd JSON / Mermaid'}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await saveActiveScreenMap(activeScreenMap.name);
                    setSavedNotice(true);
                    window.setTimeout(() => setSavedNotice(false), 1800);
                  }}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savedNotice ? 'Zapisano w bazie' : 'Zapisz mapę GitHub'}</span>
                </button>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-emerald-100/85 leading-relaxed">
              {ghMeta.architectureSummary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200/70 dark:border-emerald-400/15 text-xs font-mono">
              <div className="truncate text-slate-600 dark:text-emerald-200/85">
                <span className="font-sans font-medium text-slate-500 dark:text-emerald-300/75">
                  Wykryte moduły z drzewa:{' '}
                </span>
                {ghMeta.detectedModules.join(', ') || 'moduły główne'}
              </div>
              <div className="truncate text-slate-600 dark:text-emerald-200/85">
                <span className="font-sans font-medium text-slate-500 dark:text-emerald-300/75">
                  Zależności i pakiety:{' '}
                </span>
                {ghMeta.detectedPackages.join(', ') || 'standardowe'}
              </div>
            </div>
          </div>

          {/* High-Density Data Table of Generated Screens */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-emerald-400/20 bg-white/65 dark:bg-emerald-950/50">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-emerald-400/20 text-slate-500 dark:text-emerald-300/80">
                  <th className="py-3 px-4 font-medium">Ścieżka</th>
                  <th className="py-3 px-4 font-medium">Projektowany ekran</th>
                  <th className="py-3 px-4 font-medium">Komponenty biblioteki GitHub</th>
                  <th className="py-3 px-4 font-medium">Animacja przejścia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-emerald-400/10">
                {activeScreenMap.nodes.map((scr) => {
                  const trans = SCREEN_TRANSITION_PRESETS.find(
                    (t) => t.id === scr.preferredTransition
                  );
                  return (
                    <tr
                      key={scr.id}
                      className="hover:bg-white/75 dark:hover:bg-emerald-900/35 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono tabular-nums text-indigo-700 dark:text-emerald-300 whitespace-nowrap">
                        {scr.route}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-emerald-50">
                          {scr.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-emerald-200/70 line-clamp-1">
                          {scr.summary}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-emerald-100">
                        {scr.components.join(' · ')}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-emerald-200 whitespace-nowrap">
                        {trans?.name.replace(/^0\d\.\s*/, '') || scr.preferredTransition}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {showExportInspector && <ScreenMapExportPanel compact />}
        </div>
      )}
    </section>
  );
};
