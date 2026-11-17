import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileCode2,
  FileJson,
  FileText,
  Upload,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { hapticAudio } from '../lib/hapticAudioEngine';
import {
  downloadLocalArchitectureFile,
  MermaidDirection,
  parseImportedScreenMapJson,
  serializeScreenMapToJson,
  serializeScreenMapToMermaid,
  slugifyExportName,
} from '../lib/screenMapExport';

export type ExportFormatTab = 'json' | 'mermaid' | 'markdown';

export const ScreenMapExportPanel: React.FC<{
  compact?: boolean;
}> = ({ compact = false }) => {
  const {
    palette,
    depth,
    synth,
    haptic,
    patterns,
    activeScreenMap,
    setActiveScreenMap,
    pulseInteraction,
  } = useStudio();

  const [format, setFormat] = useState<ExportFormatTab>('mermaid');
  const [direction, setDirection] = useState<MermaidDirection>('LR');
  const [groupByRole, setGroupByRole] = useState<boolean>(true);
  const [includeTransitionSpecs, setIncludeTransitionSpecs] =
    useState<boolean>(true);
  const [customSlug, setCustomSlug] = useState<string>('');
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);
  const [downloadedNotice, setDownloadedNotice] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<{
    type: 'ok' | 'err';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isDark = palette === 'emerald-clinic';

  const defaultFileBase = useMemo(
    () => `architektura-${slugifyExportName(activeScreenMap.name || activeScreenMap.sourceRepo)}`,
    [activeScreenMap.name, activeScreenMap.sourceRepo]
  );

  const resolvedFileBase = customSlug.trim()
    ? slugifyExportName(customSlug.trim())
    : defaultFileBase;

  const exportedOutput = useMemo(() => {
    if (format === 'json') {
      return serializeScreenMapToJson(activeScreenMap, {
        includeTransitionSpecs,
      });
    }
    if (format === 'markdown') {
      return serializeScreenMapToMermaid(activeScreenMap, {
        direction,
        groupByRole,
        includeMetadataComments: true,
        wrapInMarkdown: true,
      });
    }
    return serializeScreenMapToMermaid(activeScreenMap, {
      direction,
      groupByRole,
      includeMetadataComments: true,
      wrapInMarkdown: false,
    });
  }, [
    activeScreenMap,
    format,
    direction,
    groupByRole,
    includeTransitionSpecs,
  ]);

  const fileExtension =
    format === 'json' ? '.json' : format === 'markdown' ? '.md' : '.mmd';
  const fullFilename = `${resolvedFileBase}${fileExtension}`;

  const outputStats = useMemo(() => {
    const lines = exportedOutput.split('\n').length;
    const bytes = new TextEncoder().encode(exportedOutput).length;
    const kb = (bytes / 1024).toFixed(1);
    return { lines, kb };
  }, [exportedOutput]);

  const cardSurfaceStyle: React.CSSProperties = compact
    ? {}
    : {
        borderRadius: `${depth.borderRadius}px`,
        backdropFilter: `blur(${depth.glassBlur}px)`,
        backgroundColor: isDark
          ? `rgba(11, 34, 29, ${depth.glassOpacity})`
          : `rgba(255, 255, 255, ${depth.glassOpacity})`,
        boxShadow: isDark
          ? `0 ${depth.elevation}px ${depth.blur}px rgba(0,0,0,0.46)`
          : `0 ${depth.elevation}px ${depth.blur}px rgba(88, 76, 148, 0.13)`,
      };

  const triggerDownload = (targetFormat: ExportFormatTab) => {
    const base = resolvedFileBase;
    let content = '';
    let filename = '';
    let mime = 'text/plain';

    if (targetFormat === 'json') {
      content = serializeScreenMapToJson(activeScreenMap, {
        includeTransitionSpecs,
      });
      filename = `${base}.json`;
      mime = 'application/json';
    } else if (targetFormat === 'markdown') {
      content = serializeScreenMapToMermaid(activeScreenMap, {
        direction,
        groupByRole,
        includeMetadataComments: true,
        wrapInMarkdown: true,
      });
      filename = `${base}.md`;
      mime = 'text/markdown';
    } else {
      content = serializeScreenMapToMermaid(activeScreenMap, {
        direction,
        groupByRole,
        includeMetadataComments: true,
        wrapInMarkdown: false,
      });
      filename = `${base}.mmd`;
      mime = 'text/vnd.mermaid';
    }

    downloadLocalArchitectureFile(content, filename, mime);
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.85);
    setDownloadedNotice(filename);
    window.setTimeout(() => setDownloadedNotice(null), 2400);
  };

  const handleCopyCurrent = async () => {
    try {
      await navigator.clipboard.writeText(exportedOutput);
      hapticAudio.triggerPress(synth, haptic, patterns);
      setCopiedNotice(true);
      window.setTimeout(() => setCopiedNotice(false), 1800);
    } catch {
      // Clipboard unavailable in restricted context
    }
  };

  const handleImportJsonFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const importedMap = parseImportedScreenMapJson(raw);
      setActiveScreenMap(importedMap);
      hapticAudio.triggerPress(synth, haptic, patterns);
      pulseInteraction(0.95);
      setImportFeedback({
        type: 'ok',
        message: `Wczytano mapę „${importedMap.name}” (${importedMap.nodes.length} ekranów, ${importedMap.edges.length} połączeń).`,
      });
    } catch (err: unknown) {
      setImportFeedback({
        type: 'err',
        message:
          err instanceof Error
            ? err.message
            : 'Nie udało się odczytać lokalnego pliku JSON.',
      });
    } finally {
      e.target.value = '';
    }
  };

  return (
    <section
      style={cardSurfaceStyle}
      className={
        compact
          ? 'p-5 rounded-2xl bg-white/75 dark:bg-emerald-950/65 border border-slate-200/80 dark:border-emerald-400/25 space-y-4'
          : 'p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-6'
      }
    >
      {/* Header + Instant One-Click Download Actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
            <span>Lokalny Zapis Architektury Projektu</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {activeScreenMap.nodes.length} ekranów · {activeScreenMap.edges.length} przejść
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {outputStats.lines} linii ({outputStats.kb} KB)
            </span>
          </div>
          <h2
            className={
              compact
                ? 'text-lg font-semibold text-slate-900 dark:text-emerald-50 mt-0.5'
                : 'text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-emerald-50 mt-1'
            }
          >
            Eksport Mapy Ekranów do Pliku JSON lub Mermaid.js
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => triggerDownload('json')}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>Pobierz JSON (.json)</span>
          </button>

          <button
            type="button"
            onClick={() => triggerDownload('mermaid')}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 dark:bg-emerald-500 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Pobierz Mermaid (.mmd)</span>
          </button>

          <button
            type="button"
            onClick={() => triggerDownload('markdown')}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/85 dark:bg-emerald-900/70 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white transition-colors whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Pobierz Markdown (.md)</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportJsonFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/85 dark:bg-emerald-900/70 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Wczytaj JSON z dysku</span>
          </button>
        </div>
      </div>

      {/* Format Tabs + Configuration Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70 dark:border-emerald-400/15">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-emerald-950/80">
          {(
            [
              ['mermaid', 'Diagram Mermaid.js (.mmd)'],
              ['json', 'Struktura JSON (.json)'],
              ['markdown', 'Dokumentacja GitHub (.md)'],
            ] as [ExportFormatTab, string][]
          ).map(([tabId, label]) => (
            <button
              key={tabId}
              type="button"
              onClick={() => {
                setFormat(tabId);
                hapticAudio.triggerPress(synth, haptic, patterns);
              }}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                format === tabId
                  ? isDark
                    ? 'bg-emerald-400 text-emerald-950 shadow-sm'
                    : 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-emerald-200/75 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Format-Specific Options + Filename Input */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {format !== 'json' ? (
            <>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/65 dark:bg-emerald-950/75">
                {(
                  [
                    ['LR', 'Układ poziomy (LR)'],
                    ['TD', 'Układ pionowy (TD)'],
                  ] as [MermaidDirection, string][]
                ).map(([dir, label]) => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => setDirection(dir)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                      direction === dir
                        ? isDark
                          ? 'bg-emerald-400 text-emerald-950'
                          : 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 dark:text-emerald-200/75'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="inline-flex items-center gap-2 text-slate-700 dark:text-emerald-100 cursor-pointer select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={groupByRole}
                  onChange={(e) => setGroupByRole(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Grupuj podgrafy ról (subgraph)</span>
              </label>
            </>
          ) : (
            <label className="inline-flex items-center gap-2 text-slate-700 dark:text-emerald-100 cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={includeTransitionSpecs}
                onChange={(e) => setIncludeTransitionSpecs(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Dołącz parametry fizyki sprężyn przejść</span>
            </label>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-emerald-300/80 whitespace-nowrap">
              Plik:
            </span>
            <input
              type="text"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value)}
              placeholder={defaultFileBase}
              aria-label="Nazwa eksportowanego pliku"
              className="min-h-[36px] w-48 px-2.5 py-1 rounded-lg font-mono text-xs bg-white dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50"
            />
            <span className="font-mono text-slate-500 dark:text-emerald-300/80">
              {fileExtension}
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Banner for Download or Import */}
      {(downloadedNotice || importFeedback) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white/80 dark:bg-emerald-900/60 border border-slate-200/80 dark:border-emerald-400/25 text-xs">
          {downloadedNotice ? (
            <span className="text-slate-800 dark:text-emerald-100">
              Zapisano plik lokalnie:{' '}
              <strong className="font-mono">{downloadedNotice}</strong>
            </span>
          ) : importFeedback ? (
            <span
              className={
                importFeedback.type === 'err'
                  ? 'text-rose-700 dark:text-rose-200'
                  : 'text-slate-800 dark:text-emerald-100'
              }
            >
              {importFeedback.message}
            </span>
          ) : null}
        </div>
      )}

      {/* Live Code Preview + Copy / Save Current Format */}
      <div className="rounded-2xl overflow-hidden border border-slate-200/80 dark:border-emerald-400/20 bg-slate-950 text-slate-100">
        <div className="px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-mono tabular-nums text-slate-300 flex items-center gap-2">
            <span>{fullFilename}</span>
            <span aria-hidden="true">·</span>
            <span>{outputStats.lines} linii</span>
            <span aria-hidden="true">·</span>
            <span>{outputStats.kb} KB</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCurrent}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {copiedNotice ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedNotice ? 'Skopiowano kod' : 'Kopiuj kod'}</span>
            </button>

            <button
              type="button"
              onClick={() => triggerDownload(format)}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-emerald-400 text-emerald-950 font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Zapisz {fullFilename}</span>
            </button>
          </div>
        </div>

        <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto max-h-[300px] overflow-y-auto text-emerald-100/95">
          <code>{exportedOutput}</code>
        </pre>
      </div>
    </section>
  );
};
