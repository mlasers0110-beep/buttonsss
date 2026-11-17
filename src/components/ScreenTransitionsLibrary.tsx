import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeftRight,
  Check,
  Copy,
  Layers,
  Play,
  Sparkles,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { hapticAudio } from '../lib/hapticAudioEngine';
import {
  MATERIAL_PROFILES,
  SCREEN_TRANSITION_PRESETS,
  ScreenTransitionPresetId,
  ScreenTransitionSpec,
} from '../types/studio';

export const ScreenTransitionsLibrary: React.FC = () => {
  const {
    palette,
    depth,
    synth,
    haptic,
    patterns,
    activeScreenTransition,
    setActiveScreenTransition,
    activeScreenMap,
    setActiveScreenMap,
    pulseInteraction,
  } = useStudio();

  const nodes = activeScreenMap.nodes;
  const [fromIndex, setFromIndex] = useState(0);
  const [toIndex, setToIndex] = useState(nodes.length > 1 ? 1 : 0);
  const [showingTarget, setShowingTarget] = useState(false);
  const [reverseDirection, setReverseDirection] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedToAllEdges, setAppliedToAllEdges] = useState(false);

  const isDark = palette === 'emerald-clinic';

  const activeSpec: ScreenTransitionSpec =
    SCREEN_TRANSITION_PRESETS.find((p) => p.id === activeScreenTransition) ||
    SCREEN_TRANSITION_PRESETS[0];

  const safeFromIdx = nodes.length > 0 ? fromIndex % nodes.length : 0;
  const safeToIdx =
    nodes.length > 1 ? toIndex % nodes.length : safeFromIdx;
  const currentSimulatedScreen = showingTarget
    ? nodes[safeToIdx]
    : nodes[safeFromIdx];

  useEffect(() => {
    if (!autoPlay) return;
    const timer = window.setInterval(() => {
      setShowingTarget((prev) => !prev);
    }, 2100);
    return () => window.clearInterval(timer);
  }, [autoPlay]);

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

  const triggerSimulatedStep = () => {
    setShowingTarget((prev) => !prev);
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.95);
  };

  const handleSelectPreset = (id: ScreenTransitionPresetId) => {
    setActiveScreenTransition(id);
    setShowingTarget((prev) => !prev);
  };

  const handleApplyToAllMapEdges = () => {
    setActiveScreenMap((prev) => ({
      ...prev,
      defaultTransition: activeSpec.id,
      edges: prev.edges.map((edge) => ({
        ...edge,
        transitionId: activeSpec.id,
      })),
    }));
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(1.1);
    setAppliedToAllEdges(true);
    window.setTimeout(() => setAppliedToAllEdges(false), 1800);
  };

  const handleCopySnippet = async (spec: ScreenTransitionSpec) => {
    try {
      await navigator.clipboard.writeText(spec.codeSnippet);
      setCopiedId(spec.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  // Directional inversion when testing reverse navigation
  const dirSign = reverseDirection ? -1 : 1;
  const simInitial = {
    opacity: activeSpec.enterInitial.opacity,
    x: (activeSpec.enterInitial.x ?? 0) * dirSign,
    y: (activeSpec.enterInitial.y ?? 0) * dirSign,
    scale: activeSpec.enterInitial.scale ?? 1,
    rotateX: (activeSpec.enterInitial.rotateX ?? 0) * dirSign,
    rotateY: (activeSpec.enterInitial.rotateY ?? 0) * dirSign,
  };
  const simAnimate = {
    opacity: activeSpec.enterAnimate.opacity,
    x: activeSpec.enterAnimate.x ?? 0,
    y: activeSpec.enterAnimate.y ?? 0,
    scale: activeSpec.enterAnimate.scale ?? 1,
    rotateX: activeSpec.enterAnimate.rotateX ?? 0,
    rotateY: activeSpec.enterAnimate.rotateY ?? 0,
  };
  const simExit = {
    opacity: activeSpec.exitTarget.opacity,
    x: (activeSpec.exitTarget.x ?? 0) * dirSign,
    y: (activeSpec.exitTarget.y ?? 0) * dirSign,
    scale: activeSpec.exitTarget.scale ?? 1,
    rotateX: (activeSpec.exitTarget.rotateX ?? 0) * dirSign,
    rotateY: (activeSpec.exitTarget.rotateY ?? 0) * dirSign,
  };

  return (
    <section
      style={cardSurfaceStyle}
      className="p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-7"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
            <span>Biblioteka Animacji Przejść Między Ekranami</span>
            <span aria-hidden="true">·</span>
            <span>8 Fizyk GPU (Transform &amp; Opacity)</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Aktywna: {activeSpec.name.replace(/^0\d\.\s*/, '')} ({activeSpec.durationMs} ms)
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-emerald-50 mt-1">
            Przejścia Pomiędzy Ekranami i Symulator Nawigacji A ↔ B
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-emerald-100/75 mt-1">
            Wybierz fizykę przejścia dla całej aplikacji oraz krawędzi na mapie ekranów. Każda
            zmiana widoku działa na właściwościach kompozytora GPU i wyzwala niski ton poniżej
            160 Hz z mikro-klikiem myszy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleApplyToAllMapEdges}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/80 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white transition-colors whitespace-nowrap shrink-0"
          >
            {appliedToAllEdges ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>
              {appliedToAllEdges
                ? 'Zastosowano na mapie ekranów'
                : 'Ujednolić przejścia na mapie'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAutoPlay((p) => !p)}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              autoPlay
                ? 'bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950'
                : 'bg-slate-900 dark:bg-emerald-900/80 text-white dark:text-emerald-50'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>{autoPlay ? 'Zatrzymaj auto-pokaz' : 'Auto-pokaz przejść'}</span>
          </button>
        </div>
      </div>

      {/* Main Split: Left (Interactive Dual-Screen Stage) | Right (8 Preset Selector Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left 5 Columns: Live Screen-to-Screen Simulator */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-100/85 dark:bg-emerald-950/70 border border-slate-200/80 dark:border-emerald-400/20 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-800 dark:text-emerald-100">
                Scena testowa przejścia między ekranami
              </span>
              <button
                type="button"
                onClick={() => setReverseDirection((d) => !d)}
                className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-emerald-900/60 border border-slate-200/80 dark:border-emerald-400/20 text-slate-700 dark:text-emerald-100 font-mono tabular-nums cursor-pointer whitespace-nowrap shrink-0"
              >
                Kierunek: {reverseDirection ? '← Wstecz' : 'W przód →'}
              </button>
            </div>

            {nodes.length >= 2 && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="space-y-1">
                  <span className="text-[11px] text-slate-500 dark:text-emerald-300/75 block">
                    Ekran A (źródłowy)
                  </span>
                  <select
                    value={safeFromIdx}
                    onChange={(e) => {
                      setFromIndex(Number(e.target.value));
                      setShowingTarget(false);
                    }}
                    className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white/90 dark:bg-emerald-950/90 border border-slate-200 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 text-xs"
                  >
                    {nodes.map((n, i) => (
                      <option key={n.id} value={i}>
                        {n.route} — {n.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] text-slate-500 dark:text-emerald-300/75 block">
                    Ekran B (docelowy)
                  </span>
                  <select
                    value={safeToIdx}
                    onChange={(e) => {
                      setToIndex(Number(e.target.value));
                      setShowingTarget(true);
                    }}
                    className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white/90 dark:bg-emerald-950/90 border border-slate-200 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 text-xs"
                  >
                    {nodes.map((n, i) => (
                      <option key={n.id} value={i}>
                        {n.route} — {n.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          {/* Viewport Frame with Perspective */}
          <div
            style={{ perspective: 1200 }}
            className="relative h-[270px] rounded-2xl bg-slate-200/75 dark:bg-[#05120F] border border-slate-300/70 dark:border-emerald-400/20 overflow-hidden p-4 flex items-center justify-center"
          >
            <AnimatePresence mode="wait">
              {currentSimulatedScreen && (
                <motion.div
                  key={`${currentSimulatedScreen.id}-${showingTarget ? 'B' : 'A'}-${activeSpec.id}`}
                  initial={simInitial}
                  animate={simAnimate}
                  exit={simExit}
                  transition={{
                    type: 'spring',
                    stiffness: activeSpec.spring.stiffness,
                    damping: activeSpec.spring.damping,
                    mass: activeSpec.spring.mass,
                  }}
                  className="w-full h-full rounded-xl bg-white/92 dark:bg-emerald-950/92 border border-white dark:border-emerald-400/25 p-4 flex flex-col justify-between shadow-md"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-500 dark:text-emerald-300/80 border-b border-slate-200/70 dark:border-emerald-400/15 pb-2">
                      <span>{currentSimulatedScreen.route}</span>
                      <span>
                        {showingTarget ? 'EKRAN B' : 'EKRAN A'} ·{' '}
                        {MATERIAL_PROFILES[currentSimulatedScreen.hapticMaterial].label}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-slate-900 dark:text-emerald-50 truncate">
                      {currentSimulatedScreen.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-emerald-100/75 line-clamp-2">
                      {currentSimulatedScreen.summary}
                    </p>
                  </div>

                  {/* Miniature Wireframe Component Slots */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {currentSimulatedScreen.components.slice(0, 4).map((comp) => (
                      <div
                        key={comp}
                        className="px-2.5 py-2 rounded-lg bg-slate-100/90 dark:bg-emerald-900/45 border border-slate-200/70 dark:border-emerald-400/15 text-[11px] font-mono text-slate-700 dark:text-emerald-200 truncate"
                      >
                        {comp}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={triggerSimulatedStep}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer hover:opacity-95 transition-opacity whitespace-nowrap"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>
                Przełącz teraz: {showingTarget ? 'Wróć do Ekranu A' : 'Przejdź do Ekranu B'}
              </span>
            </button>

            <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-600 dark:text-emerald-200/80">
              <span>{activeSpec.physicsSummary}</span>
              <button
                type="button"
                onClick={() => handleCopySnippet(activeSpec)}
                className="inline-flex items-center gap-1 text-indigo-700 dark:text-emerald-300 hover:underline cursor-pointer whitespace-nowrap"
              >
                {copiedId === activeSpec.id ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Skopiowano kod Motion</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Kopiuj parametry Motion</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right 7 Columns: 8 Screen Transition Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {SCREEN_TRANSITION_PRESETS.map((spec) => {
            const isSelected = spec.id === activeScreenTransition;
            return (
              <div
                key={spec.id}
                onClick={() => handleSelectPreset(spec.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectPreset(spec.id);
                  }
                }}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-colors cursor-pointer ${
                  isSelected
                    ? isDark
                      ? 'bg-emerald-900/75 border-emerald-300/70'
                      : 'bg-white/95 border-indigo-500 shadow-sm'
                    : 'bg-white/55 dark:bg-emerald-950/45 border-slate-200/80 dark:border-emerald-400/15 hover:bg-white/80 dark:hover:bg-emerald-900/40'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-emerald-300/75">
                    <span className="truncate">{spec.category}</span>
                    <span className="font-mono tabular-nums shrink-0">{spec.durationMs} ms</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
                    {spec.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-emerald-100/75 leading-relaxed">
                    {spec.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-emerald-400/15 flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                  <span className="text-slate-600 dark:text-emerald-200/80 truncate">
                    <Layers className="w-3 h-3 inline mr-1 -mt-0.5" />
                    {spec.physicsSummary}
                  </span>
                  <span
                    className={`font-semibold shrink-0 ${
                      isSelected
                        ? 'text-indigo-700 dark:text-emerald-300'
                        : 'text-slate-500 dark:text-emerald-300/60'
                    }`}
                  >
                    {isSelected ? 'AKTYWNA' : 'Wybierz'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
