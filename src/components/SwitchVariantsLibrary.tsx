import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, GripVertical, Lock, RotateCcw, Unlock } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { HapticMaterialType, MATERIAL_PROFILES } from '../types/studio';
import { hapticAudio } from '../lib/hapticAudioEngine';
import {
  attachCatalogDragData,
  findCatalogItemById,
  setActiveDraggedCatalogItem,
} from '../lib/tactileUiCatalog';

type SwitchCategoryFilter = 'all' | 'sliders' | 'levers' | 'touch';

const CatalogDragChip: React.FC<{ catalogId: string }> = ({ catalogId }) => {
  const item = findCatalogItemById(catalogId);
  if (!item) return null;
  return (
    <span
      draggable
      onDragStart={(e) => attachCatalogDragData(e, item)}
      onDragEnd={() => setActiveDraggedCatalogItem(null)}
      title="Chwyć i przeciągnij na podgląd ekranu w ScreenArchitectureHub"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/80 dark:bg-emerald-900/70 border border-slate-200/80 dark:border-emerald-400/25 text-[11px] font-medium text-slate-600 dark:text-emerald-200 cursor-grab active:cursor-grabbing whitespace-nowrap shrink-0 select-none"
    >
      <GripVertical className="w-3 h-3" />
      <span>Przeciągnij</span>
    </span>
  );
};

const MAGNETIC_DETENTS = [0, 25, 50, 75, 100];
const TOUCH_STRIP_LEVELS = [
  { level: 1, label: 'Cichy' },
  { level: 2, label: 'Miękki' },
  { level: 3, label: 'Studyjny' },
  { level: 4, label: 'Szczytowy' },
];

export const SwitchVariantsLibrary: React.FC = () => {
  const {
    palette,
    depth,
    haptic,
    synth,
    patterns,
    engraving,
    animation,
    selectMaterialProfile,
    setActiveHoldLevel,
    pulseInteraction,
  } = useStudio();

  const [categoryFilter, setCategoryFilter] = useState<SwitchCategoryFilter>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // --- Category 1: Sliders State ---
  const [vernierVal, setVernierVal] = useState(68);
  const [fluidCapsuleVal, setFluidCapsuleVal] = useState(74);
  const [bandLow, setBandLow] = useState(46);
  const [bandHigh, setBandHigh] = useState(134);
  const [magneticStep, setMagneticStep] = useState<number>(75);

  // --- Category 2: Lever Switches State ---
  const [cncLeverOn, setCncLeverOn] = useState(true);
  const [safetyGuardOpen, setSafetyGuardOpen] = useState(false);
  const [guardedLeverArmed, setGuardedLeverArmed] = useState(false);
  const [rockerOn, setRockerOn] = useState(true);
  const [triWayState, setTriWayState] = useState<-1 | 0 | 1>(1);

  // --- Category 3: Capacitive & Touch Buttons State ---
  const [forcePadProgress, setForcePadProgress] = useState(0);
  const [forcePadLatched, setForcePadLatched] = useState(false);
  const [isHoldingForcePad, setIsHoldingForcePad] = useState(false);
  const [xyCoords, setXyCoords] = useState({ x: 62, y: 38 });
  const [xyDragging, setXyDragging] = useState(false);
  const [piezoMode, setPiezoMode] = useState<0 | 1 | 2>(1);
  const [touchStripLevel, setTouchStripLevel] = useState<number>(3);
  const [stripDragging, setStripDragging] = useState(false);

  const vernierBucketRef = useRef(vernierVal);
  const fluidBucketRef = useRef(fluidCapsuleVal);
  const xyBucketRef = useRef({ x: 6, y: 4 });
  const touchStripLevelRef = useRef<number>(3);
  const xyPadRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const forceRafRef = useRef<number>(0);

  const isDark = palette === 'emerald-clinic';
  const accentColor = engraving.glowColor || '#8B7CFF';

  const containerStyle: React.CSSProperties = {
    borderRadius: `${depth.borderRadius}px`,
    backdropFilter: `blur(${depth.glassBlur}px)`,
    backgroundColor: isDark
      ? `rgba(11, 34, 29, ${depth.glassOpacity})`
      : `rgba(255, 255, 255, ${depth.glassOpacity})`,
    boxShadow: isDark
      ? `0 ${depth.elevation}px ${depth.blur}px rgba(0,0,0,0.46)`
      : `0 ${depth.elevation}px ${depth.blur}px rgba(88, 76, 148, 0.13)`,
  };

  const springCfg = {
    type: 'spring' as const,
    stiffness: animation.stiffness,
    damping: animation.damping,
    mass: animation.mass,
  };

  const copySpec = async (key: string, spec: string) => {
    try {
      await navigator.clipboard.writeText(spec);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1800);
    } catch {
      setCopiedKey(key);
    }
  };

  const resetAllControls = () => {
    setVernierVal(68);
    setFluidCapsuleVal(74);
    setBandLow(46);
    setBandHigh(134);
    setMagneticStep(75);
    setCncLeverOn(true);
    setSafetyGuardOpen(false);
    setGuardedLeverArmed(false);
    setRockerOn(true);
    setTriWayState(1);
    setForcePadProgress(0);
    setForcePadLatched(false);
    setXyCoords({ x: 62, y: 38 });
    setPiezoMode(1);
    touchStripLevelRef.current = 3;
    setTouchStripLevel(3);
    hapticAudio.triggerReleaseReverseClutch(haptic);
    pulseInteraction(0.9);
  };

  // Continuous hold sensor loop for Capacitive Force-Hold Pad
  useEffect(() => {
    if (!isHoldingForcePad) return;
    let startTs = performance.now();
    const initialProgress = forcePadProgress;

    const step = (now: number) => {
      const elapsed = now - startTs;
      const next = Math.min(100, initialProgress + (elapsed / 950) * 100);
      setForcePadProgress(next);
      setActiveHoldLevel(next / 100);

      if (next >= 100) {
        setForcePadLatched((prev) => !prev);
        setIsHoldingForcePad(false);
        setForcePadProgress(0);
        setActiveHoldLevel(0);
        hapticAudio.stopHoldRamp();
        hapticAudio.triggerPress(synth, haptic, patterns, { pitchSemitones: 7 });
        pulseInteraction(1.3);
        return;
      }
      forceRafRef.current = requestAnimationFrame(step);
    };

    forceRafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(forceRafRef.current);
  }, [isHoldingForcePad]);

  const startForceHold = () => {
    setIsHoldingForcePad(true);
    hapticAudio.triggerPress(synth, haptic, patterns, { pitchSemitones: -2 });
    hapticAudio.startHoldRamp(
      synth,
      haptic,
      (lvl) => setActiveHoldLevel(lvl),
      haptic.material
    );
  };

  const stopForceHold = () => {
    if (!isHoldingForcePad) return;
    setIsHoldingForcePad(false);
    cancelAnimationFrame(forceRafRef.current);
    setForcePadProgress(0);
    setActiveHoldLevel(0);
    hapticAudio.stopHoldRamp();
    hapticAudio.triggerReleaseReverseClutch(haptic);
  };

  const updateXyFromPointer = (clientX: number, clientY: number) => {
    const el = xyPadRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / Math.max(1, rect.width)) * 100)));
    const ny = Math.max(0, Math.min(100, Math.round(((clientY - rect.top) / Math.max(1, rect.height)) * 100)));
    setXyCoords({ x: nx, y: ny });

    const bx = Math.floor(nx / 10);
    const by = Math.floor(ny / 10);
    if (bx !== xyBucketRef.current.x || by !== xyBucketRef.current.y) {
      xyBucketRef.current = { x: bx, y: by };
      hapticAudio.triggerSliderTick(haptic, (nx + (100 - ny)) / 200);
      pulseInteraction(0.25);
    }
  };

  const updateStripFromPointer = (clientX: number) => {
    const el = stripRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(0.999, (clientX - rect.left) / Math.max(1, rect.width)));
    const nextLvl = Math.floor(ratio * 4) + 1;
    if (touchStripLevelRef.current !== nextLvl) {
      touchStripLevelRef.current = nextLvl;
      setTouchStripLevel(nextLvl);
      hapticAudio.triggerPress(synth, haptic, patterns, {
        pitchSemitones: (nextLvl - 2) * 2,
        intensityScale: 0.85,
      });
      pulseInteraction(0.55);
    }
  };

  const surfaceCellClass =
    'p-5 rounded-2xl bg-white/55 dark:bg-emerald-950/40 border border-slate-200/75 dark:border-emerald-400/20 flex flex-col justify-between gap-4';

  const metalOrGlassThumbClass =
    haptic.material === 'matte-metal'
      ? 'bg-gradient-to-b from-slate-100 via-slate-200 to-slate-400 border border-slate-500 text-slate-900 shadow-md'
      : haptic.material === 'suede'
        ? 'bg-[#2C284B] dark:bg-emerald-300 border border-white/70 text-white dark:text-emerald-950 shadow-sm'
        : 'bg-white/95 border border-white text-slate-900 shadow-[0_4px_14px_rgba(79,70,229,0.25)]';

  return (
    <section
      style={containerStyle}
      className="p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-8"
    >
      {/* Header, Category Filter & Material Profile Sync */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-200/70 dark:border-emerald-400/15">
        <div className="space-y-1 max-w-2xl">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
            <span>Biblioteka Elementów Sterujących</span>
            <span aria-hidden="true">·</span>
            <span>Suwaki · Dźwignie · Pady Pojemnościowe</span>
            <span aria-hidden="true">·</span>
            <span>Niski ton kliku &lt;160 Hz</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-emerald-50">
            Warianty przełączników: suwaki, przełączniki dźwigniowe i przyciski dotykowe
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-emerald-950/80">
            {(
              [
                ['all', 'Wszystkie (12)'],
                ['sliders', 'Suwaki (4)'],
                ['levers', 'Dźwigniowe (4)'],
                ['touch', 'Dotykowe (4)'],
              ] as [SwitchCategoryFilter, string][]
            ).map(([cat, label]) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[36px] ${
                  categoryFilter === cat
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

          <button
            type="button"
            onClick={resetAllControls}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/75 dark:bg-emerald-950/75 text-slate-700 dark:text-emerald-100 border border-slate-200/80 dark:border-emerald-400/25 hover:opacity-90 cursor-pointer whitespace-nowrap shrink-0 min-h-[38px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Resetuj stany</span>
          </button>
        </div>
      </div>

      {/* Quick Tactile Material Bar Affecting All 12 Switches */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-100/70 dark:bg-emerald-950/55 border border-slate-200/70 dark:border-emerald-400/20">
        <div className="text-xs text-slate-600 dark:text-emerald-200/85 flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-slate-900 dark:text-emerald-50">
            Profil materiałowy przełączników:
          </span>
          <span>{MATERIAL_PROFILES[haptic.material].label}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{haptic.materialHardness} Shore</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">Sprzęgło {haptic.reverseClutchForce}%</span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              ['shiny-glass', 'Błyszczące szkło'],
              ['frosted-glass', 'Szkło matowe'],
              ['matte-metal', 'Matowy metal'],
              ['suede', 'Zamsz'],
            ] as [HapticMaterialType, string][]
          ).map(([mat, label]) => (
            <button
              key={mat}
              type="button"
              onClick={() => selectMaterialProfile(mat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[34px] ${
                haptic.material === mat
                  ? isDark
                    ? 'bg-emerald-400 text-emerald-950'
                    : 'bg-slate-900 text-white'
                  : 'text-slate-600 dark:text-emerald-200/80 hover:bg-white/60 dark:hover:bg-emerald-900/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================================
          CATEGORY 1: SUWAKI (SLIDERS — 4 VARIANTS)
         ===================================================================== */}
      {(categoryFilter === 'all' || categoryFilter === 'sliders') && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-emerald-50">
              01. Suwaki haptyczne i optyczne (Sliders)
            </h3>
            <span className="text-xs text-slate-500 dark:text-emerald-300/75">
              Zapadki proporcjonalne do twardości Shore oraz odbicie sprzęgła przy puszczeniu
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Slider 1: Vernier Precision Detent Fader */}
            <div className={surfaceCellClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500 dark:text-emerald-300/80">
                    Suwak 01 · Skala noniuszowa z zapadkami
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                    Suwak Precyzyjny z Noniuszem
                  </h4>
                </div>
                <span className="text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-emerald-100">
                  {vernierVal}%
                </span>
              </div>

              <div className="space-y-2 py-2">
                {/* Engraved Ruler Ticks */}
                <div className="flex items-end justify-between px-2 h-3" aria-hidden="true">
                  {Array.from({ length: 21 }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`w-[1.5px] rounded-full transition-colors ${
                        idx * 5 <= vernierVal
                          ? 'bg-indigo-600 dark:bg-emerald-300'
                          : 'bg-slate-300 dark:bg-emerald-800/70'
                      } ${idx % 5 === 0 ? 'h-3' : 'h-1.5'}`}
                    />
                  ))}
                </div>

                <div className="relative h-11 flex items-center">
                  <div className="w-full h-3 rounded-full bg-slate-200/85 dark:bg-emerald-950/90 border border-slate-300/80 dark:border-emerald-500/25 overflow-hidden">
                    <div
                      style={{
                        transform: `scaleX(${vernierVal / 100})`,
                        backgroundColor: accentColor,
                      }}
                      className="h-full origin-left opacity-80 transition-transform duration-75"
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={vernierVal}
                    aria-label="Suwak Precyzyjny z Noniuszem"
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setVernierVal(next);
                      if (Math.floor(next / 4) !== Math.floor(vernierBucketRef.current / 4)) {
                        vernierBucketRef.current = next;
                        hapticAudio.triggerSliderTick(haptic, next / 100);
                        pulseInteraction(0.25);
                      }
                    }}
                    onPointerUp={() => hapticAudio.triggerReleaseReverseClutch(haptic)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  />
                  <div
                    style={{ left: `calc(${vernierVal}% - 18px)` }}
                    className={`pointer-events-none absolute top-1/2 -translate-y-1/2 w-9 h-7 rounded-lg flex items-center justify-center z-10 ${metalOrGlassThumbClass}`}
                  >
                    <span className="w-[2px] h-3.5 rounded-full bg-indigo-600 dark:bg-emerald-500" />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-emerald-400/15 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-emerald-300/75">
                <span className="truncate">21 nacięć kalibracyjnych · Optyczny celownik</span>
                <div className="flex items-center gap-2 shrink-0">
                  <CatalogDragChip catalogId="slider-vernier" />
                  <button
                    type="button"
                    onClick={() =>
                      copySpec(
                        'slider-vernier',
                        '<VernierDetentSlider min={0} max={100} detents={25} reverseClutch />'
                      )
                    }
                    className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-emerald-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedKey === 'slider-vernier' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Skopiowano</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopiuj</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Slider 2: Fluid Glass Capsule Slider */}
            <div className={surfaceCellClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500 dark:text-emerald-300/80">
                    Suwak 02 · Kapsuła tafli świetlnej
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                    Suwak Kapsułowy Płynnego Szkła
                  </h4>
                </div>
                <span className="text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-emerald-100">
                  {fluidCapsuleVal} lm
                </span>
              </div>

              <div className="py-2">
                <div className="relative h-12 rounded-2xl bg-slate-200/75 dark:bg-emerald-950/85 border border-white/85 dark:border-emerald-400/25 overflow-hidden flex items-center px-4 select-none">
                  <div
                    style={{
                      transform: `scaleX(${fluidCapsuleVal / 100})`,
                      background: `linear-gradient(90deg, ${accentColor}55 0%, ${accentColor}cc 100%)`,
                    }}
                    className="pointer-events-none absolute inset-0 origin-left transition-transform duration-75"
                  />
                  <span className="pointer-events-none relative z-10 text-xs font-medium text-slate-800 dark:text-emerald-50">
                    Strumień podświetlenia tafli
                  </span>
                  <span className="pointer-events-none relative z-10 ml-auto text-xs font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {fluidCapsuleVal}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={fluidCapsuleVal}
                    aria-label="Suwak Kapsułowy Płynnego Szkła"
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setFluidCapsuleVal(next);
                      if (Math.floor(next / 5) !== Math.floor(fluidBucketRef.current / 5)) {
                        fluidBucketRef.current = next;
                        hapticAudio.triggerSliderTick(haptic, next / 100);
                      }
                    }}
                    onPointerUp={() => hapticAudio.triggerReleaseReverseClutch(haptic)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-emerald-400/15 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-emerald-300/75">
                <span className="truncate">Wysokość 48 px · Wypełnienie GPU scaleX</span>
                <div className="flex items-center gap-2 shrink-0">
                  <CatalogDragChip catalogId="slider-fluid-capsule" />
                  <button
                    type="button"
                    onClick={() =>
                      copySpec(
                        'slider-capsule',
                        '<FluidGlassCapsuleSlider height="48px" transformOrigin="left" />'
                      )
                    }
                    className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-emerald-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedKey === 'slider-capsule' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Skopiowano</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopiuj</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Slider 3: Dual-Thumb Band / Range Slider */}
            <div className={surfaceCellClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500 dark:text-emerald-300/80">
                    Suwak 03 · Podwójny kursor przedziału
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                    Suwak Dwukursorowy Pasma (&lt;160 Hz)
                  </h4>
                </div>
                <span className="text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-emerald-100">
                  {bandLow}–{bandHigh} Hz
                </span>
              </div>

              <div className="space-y-3 py-1">
                <div className="relative h-8 flex items-center">
                  <div className="w-full h-2.5 rounded-full bg-slate-200/85 dark:bg-emerald-950/90 border border-slate-300/70 dark:border-emerald-400/20 relative overflow-hidden">
                    <div
                      style={{
                        left: `${((bandLow - 36) / (158 - 36)) * 100}%`,
                        width: `${((bandHigh - bandLow) / (158 - 36)) * 100}%`,
                        backgroundColor: accentColor,
                      }}
                      className="absolute inset-y-0 opacity-85"
                    />
                  </div>
                  <div
                    style={{ left: `calc(${((bandLow - 36) / (158 - 36)) * 100}% - 10px)` }}
                    className={`pointer-events-none absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full ${metalOrGlassThumbClass}`}
                  />
                  <div
                    style={{ left: `calc(${((bandHigh - 36) / (158 - 36)) * 100}% - 10px)` }}
                    className={`pointer-events-none absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full ${metalOrGlassThumbClass}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-emerald-200">
                    <span>Próg dolny</span>
                    <input
                      type="range"
                      min={36}
                      max={bandHigh - 8}
                      value={bandLow}
                      aria-label="Dolny próg pasma Hz"
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setBandLow(v);
                        hapticAudio.triggerSliderTick(haptic, (v - 36) / 122);
                      }}
                      className="w-24 accent-indigo-600 dark:accent-emerald-400 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-emerald-200">
                    <span>Próg górny</span>
                    <input
                      type="range"
                      min={bandLow + 8}
                      max={158}
                      value={bandHigh}
                      aria-label="Górny próg pasma Hz"
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setBandHigh(v);
                        hapticAudio.triggerSliderTick(haptic, (v - 36) / 122);
                      }}
                      className="w-24 accent-indigo-600 dark:accent-emerald-400 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-emerald-400/15 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-emerald-300/75">
                <span className="truncate">Szerokość pasma: {bandHigh - bandLow} Hz</span>
                <div className="flex items-center gap-2 shrink-0">
                  <CatalogDragChip catalogId="slider-dual-band" />
                  <button
                    type="button"
                    onClick={() =>
                      copySpec(
                        'slider-dual',
                        `<DualBandHapticSlider low={${bandLow}} high={${bandHigh}} maxHz={158} />`
                      )
                    }
                    className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-emerald-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedKey === 'slider-dual' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Skopiowano</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopiuj</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Slider 4: 5-Detent Magnetic Snap Slider */}
            <div className={surfaceCellClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500 dark:text-emerald-300/80">
                    Suwak 04 · Skokowe gniazda magnetyczne
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                    Suwak Krokowy 5-Punktowy
                  </h4>
                </div>
                <span className="text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-emerald-100">
                  Stopień {magneticStep}%
                </span>
              </div>

              <div className="py-2 space-y-2.5">
                <div className="relative h-11 rounded-2xl bg-slate-200/75 dark:bg-emerald-950/85 border border-slate-300/70 dark:border-emerald-400/20 px-2 flex items-center justify-between">
                  {MAGNETIC_DETENTS.map((stepVal) => {
                    const active = magneticStep === stepVal;
                    return (
                      <button
                        key={stepVal}
                        type="button"
                        onClick={() => {
                          setMagneticStep(stepVal);
                          hapticAudio.triggerPress(synth, haptic, patterns, {
                            pitchSemitones: (stepVal / 25 - 2) * 2,
                          });
                          pulseInteraction(0.8);
                        }}
                        className={`relative z-10 flex-1 h-9 rounded-xl text-xs font-mono tabular-nums font-medium transition-colors cursor-pointer ${
                          active
                            ? isDark
                              ? 'text-emerald-950 font-semibold'
                              : 'text-white font-semibold'
                            : 'text-slate-600 dark:text-emerald-200/75 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="magnetic-detent-pill"
                            transition={springCfg}
                            className={`absolute inset-0 rounded-xl -z-10 ${
                              isDark ? 'bg-emerald-400 shadow-sm' : 'bg-slate-900 shadow-sm'
                            }`}
                          />
                        )}
                        {stepVal}%
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-emerald-400/15 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-emerald-300/75">
                <span className="truncate">5 gniazd magnetycznych · Dociąganie sprężyste</span>
                <div className="flex items-center gap-2 shrink-0">
                  <CatalogDragChip catalogId="slider-magnetic-5" />
                  <button
                    type="button"
                    onClick={() =>
                      copySpec(
                        'slider-magnetic',
                        '<MagneticSteppedSlider steps={[0, 25, 50, 75, 100]} />'
                      )
                    }
                    className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-emerald-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedKey === 'slider-magnetic' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Skopiowano</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopiuj</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          CATEGORY 2: PRZEŁĄCZNIKI DŹWIGNIOWE (LEVER & TOGGLE SWITCHES — 4 VARIANTS)
         ===================================================================== */}
      {(categoryFilter === 'all' || categoryFilter === 'levers') && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-emerald-50">
              02. Przełączniki dźwigniowe i kołyskowe (Lever & Rocker Switches)
            </h3>
            <span className="text-xs text-slate-500 dark:text-emerald-300/75">
              Mechaniczny klik zapadkowy jak w aparaturze studyjnej i lotniczej
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Lever 1: CNC Bat-Handle Lever Switch */}
            <div className={surfaceCellClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500 dark:text-emerald-300/80">
                    Dźwignia 01 · Przegub kulowy CNC
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                    Przełącznik Dźwigniowy Lotniczy
                  </h4>
                </div>
                <span className="text-xs font-mono tabular-nums font-semibold text-slate-900 dark:text-emerald-100">
                  {cncLeverOn ? 'ZAŁĄCZONY' : 'ROZŁĄCZONY'}
                </span>
              </div>

              <div className="py-2 flex items-center justify-between gap-4">
                <button
                  type="button"
                  role="switch"
                  aria-checked={cncLeverOn}
                  aria-label="Przełącznik Dźwigniowy Lotniczy"
                  onClick={() => {
                    const next = !cncLeverOn;
                    setCncLeverOn(next);
                    hapticAudio.triggerPress(synth, haptic, patterns, {
                      material: 'matte-metal',
                      pitchSemitones: next ? 3 : -4,
                    });
                    hapticAudio.triggerReleaseReverseClutch(haptic, 'matte-metal');
                    pulseInteraction(1.0);
                  }}
                  className="relative w-44 h-16 rounded-2xl bg-gradient-to-b from-slate-300/90 to-slate-200/90 dark:from-emerald-950 dark:to-[#071512] border border-slate-400/60 dark:border-emerald-400/30 shadow-inner flex items-center justify-between px-4 cursor-pointer select-none"
                >
                  <span className="text-[11px] font-mono font-semibold text-slate-600 dark:text-emerald-300/70">
                    WYŁ
                  </span>

                  {/* Slotted Bezel Track */}
                  <span className="relative w-20 h-4 rounded-full bg-slate-900/85 dark:bg-black/80 shadow-inner flex items-center">
                    <span
                      style={{
                        opacity: cncLeverOn ? 0.9 : 0.15,
                        backgroundColor: accentColor,
                      }}
                      className="inset-0 absolute rounded-full transition-opacity duration-150"
                    />
                    {/* Bat-Handle Lever Shaft & Tip */}
                    <motion.span
                      animate={{
                        x: cncLeverOn ? 44 : 4,
                        rotate: cncLeverOn ? 14 : -14,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 580,
                        damping: 30,
                      }}
                      className="relative z-10 w-8 h-10 -my-3 rounded-xl bg-gradient-to-b from-white via-slate-200 to-slate-400 border border-slate-500/80 shadow-[0_6px_14px_rgba(0,0,0,0.35)] flex flex-col items-center justify-center gap-0.5"
                    >
                      <span className="w-4 h-[1.5px] bg-slate-500/70 rounded-full" />
                      <span className="w-4 h-[1.5px] bg-slate-500/70 rounded-full" />
                    </motion.span>
                  </span>

                  <span className="text-[11px] font-mono font-semibold text-indigo-700 dark:text-emerald-300">
                    ZAŁ
                  </span>
                </button>

                <div className="text-xs text-slate-600 dark:text-emerald-200/80 leading-snug flex-1">
                  Toczony trzpień z podwójnym ryflowaniem i szczeliną świetlną stanu.
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-emerald-400/15 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-emerald-300/75">
                <span className="truncate">Wychył ±14° · Sprężyna 580 N/m</span>
                <div className="flex items-center gap-2 shrink-0">
                  <CatalogDragChip catalogId="lever-cnc-aircraft" />
                  <button
                    type="button"
                    onClick={() =>
                      copySpec('lever-cnc', '<MachinedLeverSwitch checked={on} angleDeg={14} />')
                    }
                    className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-emerald-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedKey === 'lever-cnc' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Skopiowano</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopiuj</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Lever 2: Guarded Safety Flip-Cover Lever */}
            <div className={surfaceCellClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500 dark:text-emerald-300/80">
                    Dźwignia 02 · Dwustopniowa blokada bezpieczeństwa
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                    Dźwignia z Osłoną Uchylną
                  </h4>
                </div>
                <span className="text-xs font-mono tabular-nums font-semibold text-slate-900 dark:text-emerald-100">
                  {guardedLeverArmed
                    ? 'UZBROJONY'
                    : safetyGuardOpen
                      ? 'OSŁONA OTWARTA'
                      : 'ZABLOKOWANY'}
                </span>
              </div>

              <div className="py-2 flex flex-wrap items-center gap-3">
                {/* Step 1: Safety Cover Flip Button */}
                <button
                  type="button"
                  onClick={() => {
                    const nextOpen = !safetyGuardOpen;
                    setSafetyGuardOpen(nextOpen);
                    if (!nextOpen && guardedLeverArmed) {
                      setGuardedLeverArmed(false);
                    }
                    hapticAudio.triggerPress(synth, haptic, patterns, {
                      pitchSemitones: nextOpen ? 2 : -5,
                    });
                    pulseInteraction(0.85);
                  }}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-medium border inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 min-h-[44px] transition-colors ${
                    safetyGuardOpen
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-900 dark:text-amber-200'
                      : 'bg-white/75 dark:bg-emerald-950/75 border-slate-300/80 dark:border-emerald-400/25 text-slate-700 dark:text-emerald-100'
                  }`}
                >
                  {safetyGuardOpen ? (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>Zamknij osłonę</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>1. Uchyl osłonę</span>
                    </>
                  )}
                </button>

                {/* Step 2: Actuate Guarded Master Lever */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={guardedLeverArmed}
                  disabled={!safetyGuardOpen}
                  onClick={() => {
                    const next = !guardedLeverArmed;
                    setGuardedLeverArmed(next);
                    hapticAudio.triggerPress(synth, haptic, patterns, {
                      material: 'matte-metal',
                      pitchSemitones: next ? 6 : -3,
                      intensityScale: 1.2,
                    });
                    pulseInteraction(1.15);
                  }}
                  className={`relative flex-1 min-w-[150px] min-h-[44px] px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-between ${
                    guardedLeverArmed
                      ? isDark
                        ? 'bg-emerald-400 text-emerald-950 border-emerald-200 shadow-md'
                        : 'bg-slate-900 text-white border-slate-800 shadow-md'
                      : 'bg-white/80 dark:bg-emerald-950/80 text-slate-800 dark:text-emerald-100 border-slate-300/80 dark:border-emerald-400/25'
                  }`}
                >
                  <span>2. Dźwignia toru</span>
                  <span className="font-mono tabular-nums">
                    {guardedLeverArmed ? 'AKTYWNA' : 'GOTOWA'}
                  </span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-emerald-400/15 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-emerald-300/75">
                <span className="truncate">Zamknięcie klosza automatycznie rozłącza dźwignię</span>
                <div className="flex items-center gap-2 shrink-0">
                  <CatalogDragChip catalogId="lever-safety-guard" />
                  <button
                    type="button"
                    onClick={() =>
                      copySpec(
                        'lever-guarded',
                        '<GuardedSafetyLever guardOpen={open} armed={armed} autoDisarm />'
                      )
                    }
                    className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-emerald-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedKey === 'lever-guarded' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Skopiowano</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopiuj</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Lever 3: Architectural Split-Axis Rocker Switch */}
            <div className={surfaceCellClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500 dark:text-emerald-300/80">
                    Dźwignia 03 · Klawisz kołyskowy 3D
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                    Przełącznik Kołyskowy Krawędziowy (O / I)
                  </h4>
                </div>
                <span className="text-xs font-mono tabular-nums font-semibold text-slate-900 dark:text-emerald-100">
                  POZYCJA {rockerOn ? 'I' : 'O'}
                </span>
              </div>

              <div className="py-2" style={{ perspective: '620px' }}>
                <motion.button
                  type="button"
                  role="switch"
                  aria-checked={rockerOn}
                  onClick={() => {
                    const next = !rockerOn;
                    setRockerOn(next);
                    hapticAudio.triggerPress(synth, haptic, patterns, {
                      pitchSemitones: next ? 4 : -2,
                    });
                    pulseInteraction(0.95);
                  }}
                  animate={{
                    rotateY: rockerOn ? 8 : -8,
                  }}
                  transition={springCfg}
                  className="relative w-full h-14 rounded-2xl bg-gradient-to-r from-slate-200/90 via-white to-slate-200/90 dark:from-emerald-950 dark:via-emerald-900/80 dark:to-emerald-950 border border-slate-300/90 dark:border-emerald-400/30 shadow-md grid grid-cols-2 items-center cursor-pointer overflow-hidden"
                >
                  <span
                    className={`text-sm font-mono font-semibold transition-opacity ${
                      !rockerOn
                        ? 'text-slate-900 dark:text-white opacity-100'
                        : 'text-slate-400 dark:text-emerald-400/45 opacity-70'
                    }`}
                  >
                    O · Spoczynek
                  </span>
                  <span
                    className={`text-sm font-mono font-semibold border-l border-slate-300/70 dark:border-emerald-400/20 transition-opacity ${
                      rockerOn
                        ? 'text-indigo-700 dark:text-emerald-200 opacity-100'
                        : 'text-slate-400 dark:text-emerald-400/45 opacity-70'
                    }`}
                  >
                    I · Zasilanie
                  </span>

                  {/* Illuminated Active Rocker Edge */}
                  <span
                    aria-hidden="true"
                    style={{
                      backgroundColor: accentColor,
                      transform: rockerOn ? 'translateX(100%)' : 'translateX(0%)',
                    }}
                    className="pointer-events-none absolute bottom-0 left-0 w-1/2 h-[3px] transition-transform duration-200"
                  />
                </motion.button>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-emerald-400/15 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-emerald-300/75">
                <span className="truncate">Oś centralna 620 px · Podświetlenie aktywnej krawędzi</span>
                <div className="flex items-center gap-2 shrink-0">
                  <CatalogDragChip catalogId="lever-split-rocker" />
                  <button
                    type="button"
                    onClick={() =>
                      copySpec('lever-rocker', '<SplitAxisRockerSwitch checked={on} tiltDeg={8} />')
                    }
                    className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-emerald-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedKey === 'lever-rocker' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Skopiowano</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopiuj</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Lever 4: 3-Position Center-Off Toggle Lever */}
            <div className={surfaceCellClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500 dark:text-emerald-300/80">
                    Dźwignia 04 · Selektor trójpozycyjny I–0–II
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                    Dźwignia Trójpozycyjna z Punktem Zero
                  </h4>
                </div>
                <span className="text-xs font-mono tabular-nums font-semibold text-slate-900 dark:text-emerald-100">
                  {triWayState === -1
                    ? 'I · TŁUMIENIE'
                    : triWayState === 0
                      ? '0 · NEUTRALNY'
                      : 'II · REZONANS'}
                </span>
              </div>

              <div className="py-2">
                <div className="relative grid grid-cols-3 p-1.5 rounded-2xl bg-slate-200/80 dark:bg-emerald-950/85 border border-slate-300/80 dark:border-emerald-400/25 min-h-[52px]">
                  {(
                    [
                      [-1, 'I · Tłumienie'],
                      [0, '0 · Zero'],
                      [1, 'II · Rezonans'],
                    ] as const
                  ).map(([val, label]) => {
                    const active = triWayState === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setTriWayState(val);
                          if (val === 0) {
                            hapticAudio.triggerReleaseReverseClutch(haptic);
                          } else {
                            hapticAudio.triggerPress(synth, haptic, patterns, {
                              pitchSemitones: val * 5,
                            });
                          }
                          pulseInteraction(0.9);
                        }}
                        className={`relative z-10 py-2 px-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap truncate ${
                          active
                            ? isDark
                              ? 'text-emerald-950 font-semibold'
                              : 'text-slate-900 font-semibold'
                            : 'text-slate-600 dark:text-emerald-200/75'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="tri-way-lever-handle"
                            transition={springCfg}
                            className={`absolute inset-0 rounded-xl -z-10 border ${
                              isDark
                                ? 'bg-emerald-400 border-emerald-200 shadow-sm'
                                : 'bg-white border-white shadow-sm'
                            }`}
                          />
                        )}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-emerald-400/15 flex items-center justify-between text-xs text-slate-500 dark:text-emerald-300/75">
                <span>Impuls sprzęgła zwrotnego przy przejściu przez 0</span>
                <button
                  type="button"
                  onClick={() =>
                    copySpec('lever-3way', '<CenterOffToggleLever positions={[-1, 0, 1]} />')
                  }
                  className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-emerald-200 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedKey === 'lever-3way' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Skopiowano</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Kopiuj</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          CATEGORY 3: PRZYCISKI DOTYKOWE (CAPACITIVE & TOUCH PADS — 4 VARIANTS)
         ===================================================================== */}
      {(categoryFilter === 'all' || categoryFilter === 'touch') && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-emerald-50">
              03. Przyciski dotykowe i powierzchnie pojemnościowe (Touch Controls)
            </h3>
            <span className="text-xs text-slate-500 dark:text-emerald-300/75">
              Bezszczelinowe sensory szkła i metalu z pomiarem czasu nacisku oraz wektora XY
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Touch 1: Capacitive Force-Hold Sensor Pad */}
            <div className={surfaceCellClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500 dark:text-emerald-300/80">
                    Dotyk 01 · Czujnik ciągłego nacisku
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                    Pojemnościowy Pad Siły Przytrzymania
                  </h4>
                </div>
                <span className="text-xs font-mono tabular-nums font-semibold text-slate-900 dark:text-emerald-100">
                  {isHoldingForcePad
                    ? `${Math.round(forcePadProgress)}%`
                    : forcePadLatched
                      ? 'ZATRZAŚNIĘTY'
                      : 'CZUWANIE'}
                </span>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onPointerDown={startForceHold}
                  onPointerUp={stopForceHold}
                  onPointerLeave={stopForceHold}
                  onPointerCancel={stopForceHold}
                  className="relative w-full h-20 rounded-2xl bg-slate-200/70 dark:bg-emerald-950/80 border border-white/85 dark:border-emerald-400/25 overflow-hidden flex items-center justify-between px-5 cursor-pointer select-none"
                >
                  {/* Smooth Horizontal Subsurface Charge Fill (compositor scaleX, NO click rings) */}
                  <span
                    aria-hidden="true"
                    style={{
                      transform: `scaleX(${
                        isHoldingForcePad ? forcePadProgress / 100 : forcePadLatched ? 1 : 0.04
                      })`,
                      background: `linear-gradient(90deg, ${accentColor}35 0%, ${accentColor}95 100%)`,
                    }}
                    className="pointer-events-none absolute inset-0 origin-left transition-transform duration-75"
                  />

                  <span className="relative z-10 text-left">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-emerald-50">
                      {forcePadLatched
                        ? 'Przytrzymaj ponownie, aby zwolnić'
                        : 'Przytrzymaj 0.95 s do pełnego naładowania'}
                    </span>
                    <span className="block text-xs text-slate-600 dark:text-emerald-200/80 mt-0.5">
                      Narastająca wibracja podpowierzchniowa bez przypadkowych kliknięć
                    </span>
                  </span>

                  <span className="relative z-10 text-sm font-mono tabular-nums font-bold text-slate-900 dark:text-white shrink-0 ml-3">
                    {isHoldingForcePad
                      ? `${Math.round(forcePadProgress)}%`
                      : forcePadLatched
                        ? '100%'
                        : '0%'}
                  </span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-emerald-400/15 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-emerald-300/75">
                <span className="truncate">Zabezpieczenie przed przypadkowym muśnięciem</span>
                <div className="flex items-center gap-2 shrink-0">
                  <CatalogDragChip catalogId="touch-force-pad" />
                  <button
                    type="button"
                    onClick={() =>
                      copySpec('touch-force', '<CapacitiveForceHoldPad holdDurationMs={950} />')
                    }
                    className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-emerald-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedKey === 'touch-force' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Skopiowano</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopiuj</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Touch 2: 2D Tactile XY Capacitive Touchpad */}
            <div className={surfaceCellClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500 dark:text-emerald-300/80">
                    Dotyk 02 · Wektorowa powierzchnia 2D
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                    Gładzik Pojemnościowy XY
                  </h4>
                </div>
                <span className="text-xs font-mono tabular-nums font-semibold text-slate-900 dark:text-emerald-100">
                  X:{xyCoords.x}% · Y:{xyCoords.y}%
                </span>
              </div>

              <div className="py-1">
                <div
                  ref={xyPadRef}
                  role="slider"
                  tabIndex={0}
                  aria-label="Gładzik Pojemnościowy XY"
                  aria-valuenow={xyCoords.x}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setXyDragging(true);
                    updateXyFromPointer(e.clientX, e.clientY);
                    hapticAudio.triggerPress(synth, haptic, patterns, {
                      intensityScale: 0.85,
                    });
                  }}
                  onPointerMove={(e) => {
                    if (!xyDragging) return;
                    updateXyFromPointer(e.clientX, e.clientY);
                  }}
                  onPointerUp={() => {
                    if (!xyDragging) return;
                    setXyDragging(false);
                    hapticAudio.triggerReleaseReverseClutch(haptic);
                  }}
                  className="relative w-full h-24 rounded-2xl bg-slate-200/75 dark:bg-[#071915] border border-white/85 dark:border-emerald-400/25 overflow-hidden cursor-crosshair select-none touch-none"
                >
                  {/* Radial Spotlight Tracking Finger */}
                  <span
                    aria-hidden="true"
                    style={{
                      background: `radial-gradient(120px circle at ${xyCoords.x}% ${xyCoords.y}%, ${accentColor}66, transparent 72%)`,
                    }}
                    className="pointer-events-none absolute inset-0"
                  />
                  {/* Hairline Crosshairs */}
                  <span
                    aria-hidden="true"
                    style={{ left: `${xyCoords.x}%` }}
                    className="pointer-events-none absolute inset-y-0 w-[1px] bg-indigo-500/45 dark:bg-emerald-300/45"
                  />
                  <span
                    aria-hidden="true"
                    style={{ top: `${xyCoords.y}%` }}
                    className="pointer-events-none absolute inset-x-0 h-[1px] bg-indigo-500/45 dark:bg-emerald-300/45"
                  />
                  {/* Touch Node */}
                  <span
                    aria-hidden="true"
                    style={{
                      left: `calc(${xyCoords.x}% - 8px)`,
                      top: `calc(${xyCoords.y}% - 8px)`,
                    }}
                    className="pointer-events-none absolute w-4 h-4 rounded-full bg-white border-2 border-indigo-600 dark:border-emerald-400 shadow-md"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-emerald-400/15 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-emerald-300/75">
                <span className="truncate">Siatka mikro-impulsów 10×10 podczas ruchu palca</span>
                <div className="flex items-center gap-2 shrink-0">
                  <CatalogDragChip catalogId="touch-xy-vector" />
                  <button
                    type="button"
                    onClick={() =>
                      copySpec('touch-xy', `<CapacitiveXYPad x={${xyCoords.x}} y={${xyCoords.y}} />`)
                    }
                    className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-emerald-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedKey === 'touch-xy' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Skopiowano</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopiuj</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Touch 3: Piezo Solid-State Latching Touch Key */}
            <div className={surfaceCellClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500 dark:text-emerald-300/80">
                    Dotyk 03 · Klawisz monolityczny bez szczelin
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                    Piezoelektryczny Przycisk Dotykowy
                  </h4>
                </div>
                <span className="text-xs font-mono tabular-nums font-semibold text-slate-900 dark:text-emerald-100">
                  {piezoMode === 0
                    ? 'UŚPIONY'
                    : piezoMode === 1
                      ? 'MONITORING'
                      : 'IMPULS PEŁNY'}
                </span>
              </div>

              <div className="py-1">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.982 }}
                  transition={{ type: 'spring', stiffness: 680, damping: 36 }}
                  onClick={() => {
                    const next = ((piezoMode + 1) % 3) as 0 | 1 | 2;
                    setPiezoMode(next);
                    hapticAudio.triggerPress(synth, haptic, patterns, {
                      pitchSemitones: next * 3 - 2,
                    });
                    pulseInteraction(0.95);
                  }}
                  className="relative w-full h-16 rounded-2xl bg-white/80 dark:bg-emerald-950/75 border border-white/90 dark:border-emerald-400/25 px-5 flex items-center justify-between cursor-pointer select-none shadow-sm"
                >
                  <span className="text-left">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-emerald-50">
                      Dotknij tafli piezoelektrycznej
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-emerald-200/75">
                      Trójstopniowa szczelina świetlna LED
                    </span>
                  </span>

                  {/* Precision Slit Indicator Bars (Non-pulsing hardware LED slits) */}
                  <span className="flex items-center gap-1.5 shrink-0">
                    {[1, 2].map((barIdx) => {
                      const lit = piezoMode >= barIdx;
                      return (
                        <span
                          key={barIdx}
                          style={{
                            backgroundColor: lit ? accentColor : undefined,
                            boxShadow: lit ? `0 0 10px ${accentColor}` : undefined,
                          }}
                          className={`w-5 h-1.5 rounded-full transition-colors ${
                            lit ? '' : 'bg-slate-300 dark:bg-emerald-900'
                          }`}
                        />
                      );
                    })}
                  </span>
                </motion.button>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-emerald-400/15 flex items-center justify-between text-xs text-slate-500 dark:text-emerald-300/75">
                <span>Mikro-ugięcie 98.2% · Podwójna szczelina LED</span>
                <button
                  type="button"
                  onClick={() =>
                    copySpec('touch-piezo', `<PiezoTouchKey mode={${piezoMode}} stages={3} />`)
                  }
                  className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-emerald-200 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedKey === 'touch-piezo' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Skopiowano</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Kopiuj</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Touch 4: 4-Zone Illuminated Swipe & Tap Capacitive Touch Strip */}
            <div className={surfaceCellClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500 dark:text-emerald-300/80">
                    Dotyk 04 · Przeciągnij lub dotknij segmentu
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                    Segmentowa Belka Pojemnościowa
                  </h4>
                </div>
                <span className="text-xs font-mono tabular-nums font-semibold text-slate-900 dark:text-emerald-100">
                  POZIOM {touchStripLevel}/4
                </span>
              </div>

              <div className="py-1">
                <div
                  ref={stripRef}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setStripDragging(true);
                    updateStripFromPointer(e.clientX);
                  }}
                  onPointerMove={(e) => {
                    if (!stripDragging) return;
                    updateStripFromPointer(e.clientX);
                  }}
                  onPointerUp={() => {
                    if (!stripDragging) return;
                    setStripDragging(false);
                    hapticAudio.triggerReleaseReverseClutch(haptic);
                  }}
                  className="grid grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-slate-200/80 dark:bg-emerald-950/85 border border-slate-300/75 dark:border-emerald-400/25 select-none touch-none cursor-pointer min-h-[56px]"
                >
                  {TOUCH_STRIP_LEVELS.map((seg) => {
                    const active = seg.level <= touchStripLevel;
                    return (
                      <div
                        key={seg.level}
                        style={{
                          backgroundColor: active ? `${accentColor}30` : undefined,
                          borderColor: active ? accentColor : 'transparent',
                        }}
                        className={`rounded-xl border px-2 py-2 flex flex-col items-center justify-center transition-colors ${
                          active
                            ? 'text-slate-900 dark:text-emerald-50 font-semibold'
                            : 'text-slate-500 dark:text-emerald-300/60'
                        }`}
                      >
                        <span className="text-xs font-mono tabular-nums">0{seg.level}</span>
                        <span className="text-[11px] truncate max-w-full">{seg.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-emerald-400/15 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-emerald-300/75">
                <span className="truncate">Obsługa płynnego gestu ślizgowego po 4 strefach</span>
                <div className="flex items-center gap-2 shrink-0">
                  <CatalogDragChip catalogId="touch-segmented-strip" />
                  <button
                    type="button"
                    onClick={() =>
                      copySpec(
                        'touch-strip',
                        `<CapacitiveTouchStrip zones={4} level={${touchStripLevel}} />`
                      )
                    }
                    className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-emerald-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedKey === 'touch-strip' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Skopiowano</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopiuj</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
