import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  ImagePlus,
  Monitor,
  Play,
  Search,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { hapticAudio } from '../lib/hapticAudioEngine';
import {
  copyTextToClipboard,
  generateScreenImagePrompt,
  ScreenImageViewportFormat,
} from '../lib/screenImagePromptGenerator';
import {
  appendCatalogWidgetToNode,
  hasTactileCatalogDrag,
  parseCatalogItemFromDrop,
  setActiveDraggedCatalogItem,
} from '../lib/tactileUiCatalog';
import {
  DesignedScreenNode,
  MATERIAL_PROFILES,
  SCREEN_TRANSITION_PRESETS,
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

const STATUS_LABELS: Record<DesignedScreenNode['status'], string> = {
  ready: 'Gotowy',
  designing: 'W projekcie',
  review: 'Do przeglądu',
};

export const AllDesignedScreensGallery: React.FC<{
  onNavigateLiveTab?: (tab: StudioLiveTabId) => void;
  onSelectScreenInPlanner?: (screenId: string) => void;
  onOpenScreenInPrototyper?: (screenId: string) => void;
}> = ({ onNavigateLiveTab, onSelectScreenInPlanner, onOpenScreenInPrototyper }) => {
  const {
    palette,
    depth,
    synth,
    haptic,
    engraving,
    patterns,
    activeScreenMap,
    setActiveScreenMap,
    activeScreenTransition,
    setPendingImageGeneratorDraft,
    pulseInteraction,
  } = useStudio();

  const [roleFilter, setRoleFilter] = useState<'all' | ScreenRoleType>('all');
  const [query, setQuery] = useState('');
  const [viewportDevice, setViewportDevice] = useState<'mobile' | 'tablet' | 'desktop'>(
    'desktop'
  );
  const [walkthroughIndex, setWalkthroughIndex] = useState<number | null>(null);
  const [copiedScreenId, setCopiedScreenId] = useState<string | null>(null);
  const [dragHoverScreenId, setDragHoverScreenId] = useState<string | null>(null);
  const [droppedFeedback, setDroppedFeedback] = useState<string | null>(null);

  const mappedPromptFormat: ScreenImageViewportFormat =
    viewportDevice === 'mobile'
      ? 'mobile-9-16'
      : viewportDevice === 'tablet'
        ? 'tablet-4-3'
        : 'desktop-16-9';

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

  const filteredScreens = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeScreenMap.nodes.filter((scr) => {
      if (roleFilter !== 'all' && scr.role !== roleFilter) return false;
      if (!q) return true;
      return (
        scr.title.toLowerCase().includes(q) ||
        scr.route.toLowerCase().includes(q) ||
        scr.summary.toLowerCase().includes(q) ||
        scr.components.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [activeScreenMap.nodes, roleFilter, query]);

  const getOutgoingEdges = (screenId: string) =>
    activeScreenMap.edges.filter((e) => e.fromScreenId === screenId);

  const getIncomingCount = (screenId: string) =>
    activeScreenMap.edges.filter((e) => e.toScreenId === screenId).length;

  const activeWalkthroughScreen =
    walkthroughIndex !== null && filteredScreens[walkthroughIndex]
      ? filteredScreens[walkthroughIndex]
      : null;

  const activeWalkthroughSpec = useMemo(() => {
    const transId =
      activeWalkthroughScreen?.preferredTransition || activeScreenTransition;
    return (
      SCREEN_TRANSITION_PRESETS.find((t) => t.id === transId) ||
      SCREEN_TRANSITION_PRESETS[0]
    );
  }, [activeWalkthroughScreen, activeScreenTransition]);

  const stepWalkthrough = (delta: number) => {
    if (filteredScreens.length === 0) return;
    setWalkthroughIndex((prev) => {
      const base = prev ?? 0;
      return (base + delta + filteredScreens.length) % filteredScreens.length;
    });
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.95);
  };

  const handleScreenDragOver = (
    e: React.DragEvent<HTMLElement>,
    screenId: string
  ) => {
    if (!hasTactileCatalogDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (dragHoverScreenId !== screenId) {
      setDragHoverScreenId(screenId);
    }
  };

  const handleScreenDrop = (
    e: React.DragEvent<HTMLElement>,
    targetScreen: DesignedScreenNode
  ) => {
    if (!hasTactileCatalogDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragHoverScreenId(null);
    const item = parseCatalogItemFromDrop(e);
    setActiveDraggedCatalogItem(null);
    if (!item) return;

    setActiveScreenMap((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === targetScreen.id ? appendCatalogWidgetToNode(n, item) : n
      ),
    }));
    hapticAudio.triggerPress(synth, haptic, patterns, {
      material: item.recommendedMaterial,
      pitchSemitones: 3,
    });
    pulseInteraction(1.0);
    setDroppedFeedback(
      `Upuszczono „${item.labelPl}” na podgląd ekranu „${targetScreen.title}”`
    );
    window.setTimeout(() => setDroppedFeedback(null), 2400);
  };

  return (
    <section
      style={cardSurfaceStyle}
      className="p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-6"
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
            <span>Usługa Podglądu Wszystkich Projektowanych Ekranów</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {filteredScreens.length} z {activeScreenMap.nodes.length} ekranów
            </span>
            <span aria-hidden="true">·</span>
            <span>Projekt: {activeScreenMap.name}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-emerald-50 mt-1">
            Tablica Wszystkich Projektowanych Ekranów (Storyboard Live)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Device Aspect Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-emerald-950/80">
            {(
              [
                ['mobile', 'Mobile', Smartphone],
                ['tablet', 'Tablet', Tablet],
                ['desktop', 'Desktop', Monitor],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setViewportDevice(id)}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  viewportDevice === id
                    ? isDark
                      ? 'bg-emerald-400 text-emerald-950 shadow-sm'
                      : 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-emerald-200/75'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={filteredScreens.length === 0}
            onClick={() => {
              setWalkthroughIndex(0);
              hapticAudio.triggerPress(synth, haptic, patterns);
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 disabled:opacity-50 transition-opacity whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Prezentuj ścieżkę ekranów</span>
          </button>
        </div>
      </div>

      {/* Filter Bar & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-200/65 dark:bg-emerald-950/75">
          {(
            [
              ['all', 'Wszystkie role'],
              ['entry', 'Wejściowe'],
              ['core', 'Główne'],
              ['detail', 'Szczegóły'],
              ['settings', 'Ustawienia'],
              ['modal', 'Modale'],
            ] as const
          ).map(([rId, label]) => (
            <button
              key={rId}
              type="button"
              onClick={() => setRoleFilter(rId)}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                roleFilter === rId
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

        <div className="relative min-w-[240px] flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj ekranu, ścieżki / lub modułu..."
            className="w-full min-h-[40px] pl-9 pr-3.5 py-2 rounded-xl text-xs bg-white/85 dark:bg-emerald-950/80 border border-slate-200/80 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {droppedFeedback && (
        <div className="px-4 py-2.5 rounded-xl bg-indigo-50/90 dark:bg-emerald-900/60 border border-indigo-200 dark:border-emerald-400/30 text-xs font-medium text-indigo-900 dark:text-emerald-100">
          {droppedFeedback}
        </div>
      )}

      {/* Interactive Full-Flow Walkthrough Stage (when active) */}
      {activeWalkthroughScreen && walkthroughIndex !== null && (
        <div className="p-5 rounded-2xl bg-slate-100/90 dark:bg-[#061512] border border-indigo-300/80 dark:border-emerald-400/35 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-mono tabular-nums text-slate-700 dark:text-emerald-200">
               tryb prezentacji · Ekran {walkthroughIndex + 1} z {filteredScreens.length} ·
              Animacja: {activeWalkthroughSpec.name.replace(/^0\d\.\s*/, '')}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => stepWalkthrough(-1)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-emerald-900/70 border border-slate-200 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Poprzedni</span>
              </button>
              <button
                type="button"
                onClick={() => stepWalkthrough(1)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>Następny ekran</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Zamknij prezentację ścieżki"
                onClick={() => setWalkthroughIndex(null)}
                className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-emerald-950 text-slate-600 dark:text-emerald-200 border border-slate-200 dark:border-emerald-400/20 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            style={{ perspective: 1200 }}
            className="min-h-[220px] flex items-center justify-center overflow-hidden py-2"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeWalkthroughScreen.id}
                onDragOver={(e) => handleScreenDragOver(e, activeWalkthroughScreen.id)}
                onDragLeave={() => setDragHoverScreenId(null)}
                onDrop={(e) => handleScreenDrop(e, activeWalkthroughScreen)}
                initial={activeWalkthroughSpec.enterInitial}
                animate={activeWalkthroughSpec.enterAnimate}
                exit={activeWalkthroughSpec.exitTarget}
                transition={{
                  type: 'spring',
                  stiffness: activeWalkthroughSpec.spring.stiffness,
                  damping: activeWalkthroughSpec.spring.damping,
                  mass: activeWalkthroughSpec.spring.mass,
                }}
                className={`w-full ${
                  viewportDevice === 'mobile'
                    ? 'max-w-[360px]'
                    : viewportDevice === 'tablet'
                      ? 'max-w-[640px]'
                      : 'max-w-4xl'
                } p-5 rounded-2xl bg-white dark:bg-emerald-950/95 border ${
                  dragHoverScreenId === activeWalkthroughScreen.id
                    ? 'border-indigo-500 dark:border-emerald-300 ring-2 ring-indigo-500/40 dark:ring-emerald-300/50'
                    : 'border-slate-200 dark:border-emerald-400/30'
                } shadow-md space-y-3`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums text-slate-500 dark:text-emerald-300/80 border-b border-slate-200/70 dark:border-emerald-400/15 pb-2">
                  <span>{activeWalkthroughScreen.route}</span>
                  <span>
                    {ROLE_LABELS[activeWalkthroughScreen.role]} ·{' '}
                    {STATUS_LABELS[activeWalkthroughScreen.status]}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-emerald-50">
                  {activeWalkthroughScreen.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-emerald-100/80">
                  {activeWalkthroughScreen.summary}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {activeWalkthroughScreen.components.map((comp) => (
                    <div
                      key={comp}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-emerald-900/50 border border-slate-200/80 dark:border-emerald-400/15 text-xs font-mono text-slate-800 dark:text-emerald-100 truncate"
                    >
                      {comp}
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredScreens.length === 0 ? (
        <div className="p-10 rounded-2xl border border-slate-200/80 dark:border-emerald-400/20 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-emerald-100">
            Brak projektowanych ekranów spełniających wybrane kryteria wyszukiwania.
          </p>
          <button
            type="button"
            onClick={() => {
              setRoleFilter('all');
              setQuery('');
            }}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold cursor-pointer"
          >
            Wyczyść filtry
          </button>
        </div>
      ) : (
        /* Multi-Artboard Screen Grid */
        <div
          className={`grid gap-5 ${
            viewportDevice === 'mobile'
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
              : viewportDevice === 'tablet'
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          }`}
        >
          {filteredScreens.map((scr, idx) => {
            const outgoing = getOutgoingEdges(scr.id);
            const incomingCount = getIncomingCount(scr.id);
            const transSpec =
              SCREEN_TRANSITION_PRESETS.find((t) => t.id === scr.preferredTransition) ||
              SCREEN_TRANSITION_PRESETS[0];
            const promptSpec = generateScreenImagePrompt({
              node: scr,
              mapProject: activeScreenMap,
              palette,
              depth,
              engraving,
              format: mappedPromptFormat,
              language: 'en-with-pl-labels',
              visualStyle: 'tactile-glass',
            });
            const isCopied = copiedScreenId === scr.id;
            const isDropTarget = dragHoverScreenId === scr.id;

            return (
              <article
                key={scr.id}
                onDragOver={(e) => handleScreenDragOver(e, scr.id)}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setDragHoverScreenId((prev) => (prev === scr.id ? null : prev));
                  }
                }}
                onDrop={(e) => handleScreenDrop(e, scr)}
                className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-colors ${
                  isDropTarget
                    ? isDark
                      ? 'bg-emerald-900/65 border-emerald-300 ring-2 ring-emerald-300/50'
                      : 'bg-indigo-50/95 border-indigo-500 ring-2 ring-indigo-500/35'
                    : 'bg-white/70 dark:bg-emerald-950/55 border-slate-200/85 dark:border-emerald-400/20 hover:bg-white/90 dark:hover:bg-emerald-900/45'
                }`}
              >
                <div className="space-y-3">
                  {/* Quiet inline metadata — Zero pills */}
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-emerald-300/80">
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <span className="font-mono tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{ROLE_LABELS[scr.role]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{STATUS_LABELS[scr.status]}</span>
                    </div>
                    <span className="font-mono tabular-nums text-slate-700 dark:text-emerald-200 shrink-0">
                      {scr.route}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-emerald-50">
                      {scr.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-emerald-100/75 mt-1 leading-relaxed">
                      {scr.summary}
                    </p>
                  </div>

                  {/* Miniature Screen Artboard Wireframe */}
                  <div
                    className={`rounded-xl bg-slate-100/90 dark:bg-[#071814] border border-slate-200/80 dark:border-emerald-400/20 p-3 space-y-2 ${
                      viewportDevice === 'mobile' ? 'max-w-[230px] mx-auto' : 'w-full'
                    }`}
                  >
                    {/* Simulated Screen Top Bar */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-emerald-300/70 pb-1.5 border-b border-slate-200/80 dark:border-emerald-400/15">
                      <span className="truncate">{scr.route}</span>
                      <span>{MATERIAL_PROFILES[scr.hapticMaterial].label}</span>
                    </div>

                    {/* Component Blocks */}
                    <div
                      className={`grid gap-1.5 ${
                        viewportDevice === 'mobile' ? 'grid-cols-1' : 'grid-cols-2'
                      }`}
                    >
                      {scr.components.map((comp) => (
                        <div
                          key={comp}
                          className="px-2 py-1.5 rounded-lg bg-white/90 dark:bg-emerald-950/80 border border-slate-200/70 dark:border-emerald-400/15 text-[11px] font-mono text-slate-700 dark:text-emerald-100 truncate"
                        >
                          {comp}
                        </div>
                      ))}
                    </div>

                    {scr.githubSourcePath && (
                      <div className="text-[10px] font-mono text-indigo-700 dark:text-emerald-300/85 truncate pt-0.5">
                        GitHub: {scr.githubSourcePath}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Connections & Actions */}
                <div className="pt-3 border-t border-slate-200/70 dark:border-emerald-400/15 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-500 dark:text-emerald-300/80">
                    <span>
                      Wejścia: {incomingCount} · Wyjścia: {outgoing.length} · Przyciski:{' '}
                      {promptSpec.totalButtons}
                    </span>
                    <span className="truncate">
                      {transSpec.name.replace(/^0\d\.\s*/, '')}
                    </span>
                  </div>

                  {outgoing.length > 0 && (
                    <div className="text-[11px] text-slate-600 dark:text-emerald-200/80 truncate">
                      {outgoing.map((edge, eIdx) => {
                        const targetNode = activeScreenMap.nodes.find(
                          (n) => n.id === edge.toScreenId
                        );
                        return (
                          <span key={edge.id}>
                            {eIdx > 0 ? ' · ' : '→ '}
                            {edge.triggerLabel} ({targetNode?.route || edge.toScreenId})
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setWalkthroughIndex(idx);
                        hapticAudio.triggerPress(synth, haptic, patterns);
                      }}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap shrink-0"
                    >
                      <Play className="w-3 h-3" />
                      <span>Podgląd przejścia</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await copyTextToClipboard(promptSpec.promptText);
                        if (ok) {
                          setCopiedScreenId(scr.id);
                          hapticAudio.triggerPress(synth, haptic, patterns);
                          pulseInteraction(0.8);
                          window.setTimeout(() => {
                            setCopiedScreenId((prev) => (prev === scr.id ? null : prev));
                          }, 1800);
                        }
                      }}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/85 dark:bg-emerald-900/60 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white whitespace-nowrap shrink-0"
                    >
                      {isCopied ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>
                        {isCopied
                          ? 'Skopiowano prompt'
                          : `Kopiuj prompt (${promptSpec.totalButtons} przyc.)`}
                      </span>
                    </button>

                    {onNavigateLiveTab && (
                      <button
                        type="button"
                        onClick={() => {
                          setPendingImageGeneratorDraft({
                            prompt: promptSpec.promptText,
                            aspectRatio: promptSpec.aspectRatio,
                            screenTitle: scr.title,
                          });
                          hapticAudio.triggerPress(synth, haptic, patterns);
                          onNavigateLiveTab('gemini');
                        }}
                        title="Przekaż prompt ekranu bezpośrednio do Generatora Obrazów"
                        className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white/85 dark:bg-emerald-900/60 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1 cursor-pointer hover:bg-white whitespace-nowrap shrink-0"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        <span>Obraz UI</span>
                      </button>
                    )}

                    {onOpenScreenInPrototyper && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenScreenInPrototyper(scr.id);
                          hapticAudio.triggerPress(synth, haptic, patterns);
                        }}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/85 dark:bg-emerald-900/60 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1 cursor-pointer hover:bg-white whitespace-nowrap shrink-0"
                      >
                        <span>Prototypuj Drag &amp; Drop</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}

                    {onSelectScreenInPlanner && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectScreenInPlanner(scr.id);
                          hapticAudio.triggerPress(synth, haptic, patterns);
                        }}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/85 dark:bg-emerald-900/60 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1 cursor-pointer hover:bg-white whitespace-nowrap shrink-0"
                      >
                        <span>Edytuj na mapie</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}

                    {scr.studioTabLink && onNavigateLiveTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateLiveTab(scr.studioTabLink!)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-emerald-900/80 text-indigo-800 dark:text-emerald-200 text-xs font-medium inline-flex items-center gap-1 cursor-pointer hover:opacity-90 whitespace-nowrap shrink-0"
                      >
                        <span>Otwórz żywy widok</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
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
