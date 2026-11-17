import React, { useMemo, useState } from 'react';
import {
  BookmarkPlus,
  Check,
  Copy,
  ImagePlus,
  Loader2,
  Minus,
  Monitor,
  Plus,
  RotateCcw,
  Search,
  Smartphone,
  Tablet,
  Wand2,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { hapticAudio } from '../lib/hapticAudioEngine';
import { studioApiFetch } from '../lib/offlineStudioEngines';
import {
  copyTextToClipboard,
  GeneratedScreenImagePrompt,
  generateScreenImagePrompt,
  ScreenButtonCountOverride,
  ScreenImagePromptLanguage,
  ScreenImageViewportFormat,
  ScreenImageVisualStyle,
} from '../lib/screenImagePromptGenerator';
import {
  MATERIAL_PROFILES,
  ScreenRoleType,
  StudioLiveTabId,
} from '../types/studio';

const ROLE_LABELS: Record<ScreenRoleType, string> = {
  entry: 'Wejściowy',
  core: 'Główny',
  detail: 'Szczegóły',
  settings: 'Ustawienia',
  modal: 'Modal / Arkusz',
};

export const ScreenMapImagePromptsPanel: React.FC<{
  onNavigateLiveTab?: (tab: StudioLiveTabId) => void;
  onSelectScreenInPlanner?: (screenId: string) => void;
}> = ({ onNavigateLiveTab, onSelectScreenInPlanner }) => {
  const {
    palette,
    depth,
    synth,
    haptic,
    engraving,
    patterns,
    activeScreenMap,
    addSourcePrompt,
    setPendingImageGeneratorDraft,
    pulseInteraction,
  } = useStudio();

  const [viewportFormat, setViewportFormat] =
    useState<ScreenImageViewportFormat>('desktop-16-9');
  const [promptLang, setPromptLang] =
    useState<ScreenImagePromptLanguage>('en-with-pl-labels');
  const [visualStyle, setVisualStyle] =
    useState<ScreenImageVisualStyle>('tactile-glass');
  const [searchQuery, setSearchQuery] = useState('');

  // Per-screen button count overrides: { [screenId]: { topBarCount, workspaceCount, bottomBarCount } }
  const [zoneOverrides, setZoneOverrides] = useState<
    Record<string, ScreenButtonCountOverride>
  >({});

  // Optional custom/AI-refined prompt text per screen key
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedLibraryId, setSavedLibraryId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const generatedEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeScreenMap.nodes
      .filter((node) => {
        if (!q) return true;
        return (
          node.title.toLowerCase().includes(q) ||
          node.route.toLowerCase().includes(q) ||
          node.summary.toLowerCase().includes(q) ||
          node.components.some((c) => c.toLowerCase().includes(q))
        );
      })
      .map((node) => {
        const spec = generateScreenImagePrompt({
          node,
          mapProject: activeScreenMap,
          palette,
          depth,
          engraving,
          format: viewportFormat,
          language: promptLang,
          visualStyle,
          override: zoneOverrides[node.id],
        });
        return { node, spec };
      });
  }, [
    activeScreenMap,
    palette,
    depth,
    engraving,
    viewportFormat,
    promptLang,
    visualStyle,
    zoneOverrides,
    searchQuery,
  ]);

  const getEffectivePrompt = (spec: GeneratedScreenImagePrompt): string => {
    const cacheKey = `${spec.screenId}::${viewportFormat}::${promptLang}::${visualStyle}::${spec.topBarButtons.length}-${spec.workspaceButtons.length}-${spec.bottomBarButtons.length}`;
    return customPrompts[cacheKey] ?? spec.promptText;
  };

  const setEffectivePrompt = (
    spec: GeneratedScreenImagePrompt,
    nextVal: string
  ) => {
    const cacheKey = `${spec.screenId}::${viewportFormat}::${promptLang}::${visualStyle}::${spec.topBarButtons.length}-${spec.workspaceButtons.length}-${spec.bottomBarButtons.length}`;
    setCustomPrompts((prev) => ({ ...prev, [cacheKey]: nextVal }));
  };

  const adjustZoneCount = (
    screenId: string,
    zoneField: keyof ScreenButtonCountOverride,
    currentVal: number,
    delta: number,
    min: number,
    max: number
  ) => {
    const next = Math.max(min, Math.min(max, currentVal + delta));
    setZoneOverrides((prev) => ({
      ...prev,
      [screenId]: {
        ...prev[screenId],
        [zoneField]: next,
      },
    }));
    hapticAudio.triggerSliderTick(haptic, 0.55);
  };

  const resetScreenOverride = (screenId: string) => {
    setZoneOverrides((prev) => {
      const next = { ...prev };
      delete next[screenId];
      return next;
    });
    hapticAudio.triggerPress(synth, haptic, patterns);
  };

  const handleCopyPrompt = async (text: string, idKey: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedKey(idKey);
      hapticAudio.triggerPress(synth, haptic, patterns);
      pulseInteraction(0.95);
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === idKey ? null : prev));
      }, 2000);
    }
  };

  const handleCopyAllPromptsBundle = async () => {
    const bundle = generatedEntries
      .map(
        ({ spec }, idx) =>
          `=== EKRAN ${String(idx + 1).padStart(2, '0')}: ${spec.screenTitle} (${spec.route}) | Przyciski: ${spec.totalButtons} | Proporcje: ${spec.aspectRatio} ===\n${getEffectivePrompt(spec)}`
      )
      .join('\n\n');
    await handleCopyPrompt(bundle, 'bundle-all');
  };

  const handleRefineWithAi = async (spec: GeneratedScreenImagePrompt) => {
    setRefiningId(spec.screenId);
    setErrorMsg(null);
    try {
      const resp = await studioApiFetch('/api/screen-map/refine-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePrompt: getEffectivePrompt(spec),
          screenTitle: spec.screenTitle,
          totalButtons: spec.totalButtons,
          language: promptLang,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Nie udało się doprecyzować promptu.');
      }
      if (data.refinedPrompt) {
        setEffectivePrompt(spec, data.refinedPrompt);
        hapticAudio.triggerPress(synth, haptic, patterns, { pitchSemitones: 3 });
        pulseInteraction(1.05);
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Błąd połączenia podczas doprecyzowywania promptu.'
      );
    } finally {
      setRefiningId(null);
    }
  };

  const handleOpenInImageGenerator = (spec: GeneratedScreenImagePrompt) => {
    const text = getEffectivePrompt(spec);
    setPendingImageGeneratorDraft({
      prompt: text,
      aspectRatio: spec.aspectRatio,
      screenTitle: `${spec.screenTitle} (${spec.totalButtons} przyc.)`,
    });
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(1.1);
    if (onNavigateLiveTab) {
      onNavigateLiveTab('gemini');
    }
  };

  const handleSaveToPromptLibrary = async (spec: GeneratedScreenImagePrompt) => {
    const text = getEffectivePrompt(spec);
    await addSourcePrompt(
      `Ekran: ${spec.screenTitle} (${spec.totalButtons} przyc. · ${spec.aspectRatio})`,
      'Mapa Ekranów UI',
      text,
      {
        screenId: spec.screenId,
        route: spec.route,
        aspectRatio: spec.aspectRatio,
        totalButtons: spec.totalButtons,
        topBarButtons: spec.topBarButtons.length,
        workspaceButtons: spec.workspaceButtons.length,
        bottomBarButtons: spec.bottomBarButtons.length,
        buttonCoordinates: spec.allButtons.map((b) => ({
          index: b.index,
          zone: b.zone,
          label: b.label,
          xPercent: b.xPercent,
          yPercent: b.yPercent,
        })),
      }
    );
    setSavedLibraryId(spec.screenId);
    hapticAudio.triggerPress(synth, haptic, patterns);
    window.setTimeout(() => {
      setSavedLibraryId((prev) => (prev === spec.screenId ? null : prev));
    }, 2000);
  };

  return (
    <section
      style={cardSurfaceStyle}
      className="p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-6"
    >
      {/* Header & Global Prompt Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
            <span>Generator Promptów Obrazów z Mapy Ekranów</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {generatedEntries.length} ekranów
            </span>
            <span aria-hidden="true">·</span>
            <span>Kontrola dokładnej liczby i współrzędnych przycisków</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-emerald-50 mt-1">
            Prompty do Generatora Obrazów (Liczba i Rozmieszczenie Przycisków)
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-emerald-100/80 mt-1 leading-relaxed">
            Dla każdego ekranu na mapie system wylicza dokładną liczbę przycisków z połączeń
            nawigacyjnych i roli widoku oraz opisuje ich współrzędne w trzech strefach
            (górny pasek, siatka modułów, dolna belka CTA). Skopiuj prompt jednym kliknięciem
            do dowolnego generatora obrazów lub wyślij bezpośrednio do wbudowanego Studia
            Obrazów.
          </p>
        </div>

        <button
          type="button"
          disabled={generatedEntries.length === 0}
          onClick={handleCopyAllPromptsBundle}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {copiedKey === 'bundle-all' ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span>
            {copiedKey === 'bundle-all'
              ? 'Skopiowano cały pakiet!'
              : `Kopiuj wszystkie prompty (${generatedEntries.length})`}
          </span>
        </button>
      </div>

      {/* Format, Language, Visual Style & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70 dark:border-emerald-400/15">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Viewport Aspect Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-emerald-950/80">
            {(
              [
                ['desktop-16-9', 'Desktop 16:9', Monitor],
                ['mobile-9-16', 'Mobile 9:16', Smartphone],
                ['tablet-4-3', 'Tablet 4:3', Tablet],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setViewportFormat(id)}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  viewportFormat === id
                    ? isDark
                      ? 'bg-emerald-400 text-emerald-950 shadow-sm'
                      : 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-emerald-200/75 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Language Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-emerald-950/80">
            {(
              [
                ['en-with-pl-labels', 'EN + etykiety PL'],
                ['pl', 'Polski (PL)'],
                ['en', 'Angielski (EN)'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPromptLang(id)}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  promptLang === id
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

          {/* Visual Style Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-emerald-950/80">
            {(
              [
                ['tactile-glass', 'Szkło i Haptyka'],
                ['clean-saas-2d', 'Makieta 2D SaaS'],
                ['isometric-showcase', 'Prezentacja 3D'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setVisualStyle(id)}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  visualStyle === id
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
        </div>

        <div className="relative min-w-[230px] flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtruj ekran po nazwie lub ścieżce..."
            className="w-full min-h-[38px] pl-9 pr-3 py-1.5 rounded-xl text-xs bg-white/85 dark:bg-emerald-950/80 border border-slate-200/80 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-400/30 text-xs text-rose-700 dark:text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* Screen Prompt Cards Grid */}
      {generatedEntries.length === 0 ? (
        <div className="p-8 rounded-2xl border border-slate-200/80 dark:border-emerald-400/20 text-center space-y-3">
          <p className="text-sm text-slate-700 dark:text-emerald-100">
            Brak ekranów pasujących do frazy wyszukiwania.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="min-h-[38px] px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold cursor-pointer"
          >
            Pokaż wszystkie ekrany
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {generatedEntries.map(({ node, spec }, idx) => {
            const effectivePrompt = getEffectivePrompt(spec);
            const hasOverride = Boolean(zoneOverrides[node.id]);
            const isCopied = copiedKey === spec.screenId;
            const isSaved = savedLibraryId === spec.screenId;
            const isRefining = refiningId === spec.screenId;

            return (
              <article
                key={node.id}
                className="p-5 sm:p-6 rounded-2xl bg-white/70 dark:bg-emerald-950/55 border border-slate-200/85 dark:border-emerald-400/20 flex flex-col justify-between gap-4"
              >
                {/* Top Metadata + Title */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-emerald-300/80">
                    <div className="flex flex-wrap items-center gap-1.5 font-mono tabular-nums">
                      <span>{String(idx + 1).padStart(2, '0')}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-sans">{ROLE_LABELS[node.role]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{node.route}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-sans">
                        {MATERIAL_PROFILES[node.hapticMaterial].label}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-indigo-700 dark:text-emerald-300">
                      Dokładnie {spec.totalButtons} przyc. · {spec.aspectRatio}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-emerald-50">
                        {node.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-emerald-100/75 mt-0.5">
                        {spec.summaryLinePl}
                      </p>
                    </div>
                    {onSelectScreenInPlanner && (
                      <button
                        type="button"
                        onClick={() => onSelectScreenInPlanner(node.id)}
                        className="text-xs font-medium text-indigo-700 dark:text-emerald-300 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Pokaż na mapie →
                      </button>
                    )}
                  </div>
                </div>

                {/* Spatial Wireframe Blueprint + Per-Zone Button Count Steppers */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-stretch pt-1">
                  {/* Left 6 cols: Visual Coordinate Map of Buttons */}
                  <div className="sm:col-span-6 flex flex-col justify-between rounded-xl bg-slate-100/95 dark:bg-[#061612] border border-slate-200/85 dark:border-emerald-400/20 p-3">
                    <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500 dark:text-emerald-300/80 mb-2">
                      <span>Mapa rozmieszczenia ({spec.aspectRatio})</span>
                      <span>#1–#{spec.totalButtons}</span>
                    </div>

                    <div
                      className={`relative w-full mx-auto rounded-lg border border-slate-300/80 dark:border-emerald-400/25 bg-white/90 dark:bg-emerald-950/75 overflow-hidden ${
                        viewportFormat === 'mobile-9-16'
                          ? 'max-w-[140px] h-[186px]'
                          : viewportFormat === 'tablet-4-3'
                            ? 'h-[156px]'
                            : 'h-[144px]'
                      }`}
                    >
                      {/* Zone Guide Hairlines */}
                      <div
                        style={{ top: '20%' }}
                        className="absolute inset-x-0 border-b border-dashed border-slate-300/80 dark:border-emerald-400/20"
                      />
                      <div
                        style={{ top: '76%' }}
                        className="absolute inset-x-0 border-b border-dashed border-slate-300/80 dark:border-emerald-400/20"
                      />
                      <span className="absolute left-1.5 top-0.5 text-[9px] font-mono text-slate-400 dark:text-emerald-300/50">
                        GÓRA
                      </span>
                      <span className="absolute left-1.5 top-[23%] text-[9px] font-mono text-slate-400 dark:text-emerald-300/50">
                        MODUŁY
                      </span>
                      <span className="absolute left-1.5 top-[79%] text-[9px] font-mono text-slate-400 dark:text-emerald-300/50">
                        CTA / DÓŁ
                      </span>

                      {/* Plotted Button Pins */}
                      {spec.allButtons.map((btn) => {
                        const isPrimary = btn.kind === 'primary-cta';
                        return (
                          <div
                            key={btn.index}
                            title={`#${btn.index}: ${btn.label} (${btn.positionLabelPl})`}
                            style={{
                              left: `${btn.xPercent}%`,
                              top: `${btn.yPercent}%`,
                              transform: 'translate(-50%, -50%)',
                            }}
                            className={`absolute px-1.5 py-0.5 rounded text-[9px] font-mono tabular-nums font-semibold shadow-xs whitespace-nowrap max-w-[84px] truncate ${
                              isPrimary
                                ? isDark
                                  ? 'bg-emerald-400 text-emerald-950 ring-1 ring-emerald-200'
                                  : 'bg-indigo-600 text-white ring-1 ring-indigo-300'
                                : 'bg-slate-800/90 dark:bg-emerald-800/90 text-white dark:text-emerald-50'
                            }`}
                          >
                            #{btn.index} {btn.label.split(' ')[0]}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right 6 cols: Exact Button Steppers per Zone */}
                  <div className="sm:col-span-6 flex flex-col justify-between rounded-xl bg-white/75 dark:bg-emerald-950/65 border border-slate-200/80 dark:border-emerald-400/20 p-3.5 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800 dark:text-emerald-100">
                        Liczba przycisków w strefach
                      </span>
                      {hasOverride && (
                        <button
                          type="button"
                          onClick={() => resetScreenOverride(node.id)}
                          className="text-[11px] text-indigo-600 dark:text-emerald-300 inline-flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Auto z mapy</span>
                        </button>
                      )}
                    </div>

                    {(
                      [
                        [
                          'topBarCount',
                          'Górny pasek (nawigacja)',
                          spec.topBarButtons.length,
                          0,
                          6,
                        ],
                        [
                          'workspaceCount',
                          'Środek (karty modułów)',
                          spec.workspaceButtons.length,
                          0,
                          8,
                        ],
                        [
                          'bottomBarCount',
                          'Dolna strefa (CTA)',
                          spec.bottomBarButtons.length,
                          0,
                          4,
                        ],
                      ] as const
                    ).map(([field, label, count, min, max]) => (
                      <div
                        key={field}
                        className="flex items-center justify-between gap-2 py-1 border-b border-slate-200/60 dark:border-emerald-400/10 last:border-b-0"
                      >
                        <span className="text-slate-600 dark:text-emerald-200/85 truncate">
                          {label}
                        </span>
                        <div className="inline-flex items-center gap-1.5 font-mono tabular-nums shrink-0">
                          <button
                            type="button"
                            aria-label={`Zmniejsz ${label}`}
                            disabled={count <= min}
                            onClick={() =>
                              adjustZoneCount(node.id, field, count, -1, min, max)
                            }
                            className="w-7 h-7 rounded-lg bg-slate-200/75 dark:bg-emerald-900/70 text-slate-800 dark:text-emerald-100 inline-flex items-center justify-center disabled:opacity-40 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center font-semibold text-slate-900 dark:text-emerald-50">
                            {count}
                          </span>
                          <button
                            type="button"
                            aria-label={`Zwiększ ${label}`}
                            disabled={count >= max}
                            onClick={() =>
                              adjustZoneCount(node.id, field, count, 1, min, max)
                            }
                            className="w-7 h-7 rounded-lg bg-slate-200/75 dark:bg-emerald-900/70 text-slate-800 dark:text-emerald-100 inline-flex items-center justify-center disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Editable Copy-Ready Prompt Textarea */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-emerald-300/80">
                    <span>Gotowy prompt do skopiowania (możesz też edytować ręcznie):</span>
                    <span className="font-mono tabular-nums">
                      {effectivePrompt.length} znaków
                    </span>
                  </div>
                  <textarea
                    rows={5}
                    value={effectivePrompt}
                    onChange={(e) => setEffectivePrompt(spec, e.target.value)}
                    aria-label={`Prompt obrazu dla ekranu ${node.title}`}
                    className="w-full p-3 rounded-xl font-mono text-[11px] leading-relaxed bg-white/90 dark:bg-[#061612] border border-slate-200/90 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(effectivePrompt, spec.screenId)}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap shrink-0"
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isCopied ? 'Skopiowano prompt!' : 'Kopiuj prompt'}
                      </span>
                    </button>

                    {onNavigateLiveTab && (
                      <button
                        type="button"
                        onClick={() => handleOpenInImageGenerator(spec)}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-indigo-600 dark:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap shrink-0"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        <span>Otwórz w Generatorze Obrazów</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isRefining}
                      onClick={() => handleRefineWithAi(spec)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/85 dark:bg-emerald-900/65 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white disabled:opacity-55 whitespace-nowrap shrink-0"
                    >
                      {isRefining ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="w-3.5 h-3.5" />
                      )}
                      <span>{isRefining ? 'Ulepszanie...' : 'Doprecyzuj AI'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveToPromptLibrary(spec)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/85 dark:bg-emerald-900/65 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white whitespace-nowrap shrink-0"
                    >
                      {isSaved ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                      ) : (
                        <BookmarkPlus className="w-3.5 h-3.5" />
                      )}
                      <span>{isSaved ? 'Zapisano!' : 'Do biblioteki'}</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
