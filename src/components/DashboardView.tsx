import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  Eye,
  FileUp,
  FolderGit2,
  GitBranch,
  Layers,
  LayoutGrid,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  ButtonGroupId,
  EngravingSymbol,
  MATERIAL_PROFILES,
  PaletteMode,
  SCREEN_TRANSITION_PRESETS,
  TOP_5_RENDER_PRESETS,
} from '../types/studio';
import { hapticAudio } from '../lib/hapticAudioEngine';
import { ThreeMetricScene } from './ThreeMetricScene';
import { HapticSphereIndicator3D } from './HapticSphereIndicator3D';
import { AudioPlayerCard } from './AudioPlayerCard';
import { ButtonAnimationsLibrary } from './ButtonAnimationsLibrary';
import { SwitchVariantsLibrary } from './SwitchVariantsLibrary';
import { RotaryDriverCalibrationService } from './RotaryDriverCalibrationService';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { OfflineSuiteCard } from './OfflineSuiteCard';
import { ExternalPluginsSection } from './ExternalPluginsHub';
import type { ScreenHubSection } from './ScreenArchitectureHub';
import { TactileButton } from './ui/TactileButton';
import { HapticSlider } from './ui/HapticSlider';
import { ProgressiveImage } from './ui/ProgressiveImage';

interface SymptomItem {
  id: string;
  label: string;
  sub: string;
  symbol: EngravingSymbol;
  pitch: number;
}

const DIAGNOSTIC_ITEMS: SymptomItem[] = [
  {
    id: 'widoczne-naczynka',
    label: 'Widoczne naczynka',
    sub: 'Flebologia · Rycina naczyniowa',
    symbol: 'vascular',
    pitch: 0,
  },
  {
    id: 'obrzeki',
    label: 'Obrzęki i napięcie',
    sub: 'Drenaż · Miękka fala',
    symbol: 'wave',
    pitch: 2,
  },
  {
    id: 'bol-ciezkosc',
    label: 'Ból i ciężkość',
    sub: 'Impuls odciążający',
    symbol: 'spark',
    pitch: 4,
  },
  {
    id: 'skurcze',
    label: 'Skurcze nocne',
    sub: 'Mikro-rezonans relaksacyjny',
    symbol: 'droplet',
    pitch: 5,
  },
  {
    id: 'wzrost-kapitalu',
    label: 'Wzrost i dywidendy',
    sub: 'FinanceAI · Plan 6–12 mies.',
    symbol: 'prism',
    pitch: 7,
  },
  {
    id: 'ochrona-portfela',
    label: 'Bezpieczeństwo aktywów',
    sub: 'Stabilizacja · +7.5% r/r',
    symbol: 'ring',
    pitch: 9,
  },
];

export const DashboardView: React.FC<{
  onNavigateTab: (tab: string, section?: ScreenHubSection) => void;
}> = ({ onNavigateTab }) => {
  const {
    palette,
    setPalette,
    depth,
    updateDepth,
    haptic,
    updateHaptic,
    synth,
    updateSynth,
    patterns,
    selectedGroups,
    toggleGroupSelection,
    unifySelectedGroupsNow,
    mediaLibrary,
    applyRenderPreset,
    activeHoldLevel,
    interactionEnergy,
    pulseInteraction,
    activeScreenMap,
    activeScreenTransition,
  } = useStudio();

  const [metricMode, setMetricMode] = useState<'flebologia' | 'finance'>('flebologia');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([
    'widoczne-naczynka',
    'wzrost-kapitalu',
  ]);
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'image' | 'video'>('all');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [dalejCount, setDalejCount] = useState(1);

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

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredMedia = mediaLibrary.filter((m) =>
    libraryFilter === 'all' ? true : m.mediaType === libraryFilter
  );

  return (
    <div className="space-y-8">
      {/* 1. Real-Time Depth, Shadows, Palette & 5 Render Presets Control Strip */}
      <section
        style={cardSurfaceStyle}
        className="p-6 border border-white/80 dark:border-emerald-400/20 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5">
              <span>Cienie, Głębia i Matowe Szkło</span>
              <span aria-hidden="true">·</span>
              <span>Regulacja w Czasie Rzeczywistym</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-semibold text-slate-900 dark:text-emerald-50 mt-1">
              Co Cię niepokoi i jak chcesz poczuć interfejs?
            </h1>
          </div>

          {/* Palette Switcher Matching Reference Photos */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-emerald-950/80">
            {(
              [
                ['pearl-flebologia', 'Perłowa Flebologia'],
                ['finance-ice', 'FinanceAI Błękit'],
                ['emerald-clinic', 'Szmaragdowa Klinika'],
              ] as [PaletteMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setPalette(mode);
                  hapticAudio.triggerPress(synth, haptic, patterns);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  palette === mode
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

        {/* Real-Time Sliders for Shadows, Glass Blur & Corner Radius */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-1">
          <HapticSlider
            label="Głębia cienia (Elevation)"
            value={depth.elevation}
            min={4}
            max={40}
            step={1}
            unit=" px"
            onChange={(v) => updateDepth({ elevation: v })}
          />
          <HapticSlider
            label="Rozmycie szkła (Backdrop Blur)"
            value={depth.glassBlur}
            min={6}
            max={36}
            step={1}
            unit=" px"
            onChange={(v) => updateDepth({ glassBlur: v })}
          />
          <HapticSlider
            label="Przezroczystość kart"
            value={Math.round(depth.glassOpacity * 100)}
            min={35}
            max={92}
            step={1}
            unit="%"
            onChange={(v) => updateDepth({ glassOpacity: v / 100 })}
          />
          <HapticSlider
            label="Promień zaokrąglenia rogów"
            value={depth.borderRadius}
            min={16}
            max={38}
            step={1}
            unit=" px"
            onChange={(v) => updateDepth({ borderRadius: v })}
          />
        </div>

        {/* Quick 5 Common Render Presets + Interactive Activity Meter */}
        <div className="pt-4 border-t border-slate-200/70 dark:border-emerald-400/15 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-emerald-300/80 mr-1">
              Gotowe presety renderowań:
            </span>
            {TOP_5_RENDER_PRESETS.map((preset, idx) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyRenderPreset(preset)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/65 dark:bg-emerald-950/60 hover:bg-white dark:hover:bg-emerald-900/80 text-slate-700 dark:text-emerald-100 border border-slate-200/70 dark:border-emerald-400/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                0{idx + 1}. {preset.title.replace(/^0\d\.\s*/, '')}
              </button>
            ))}
          </div>

          {/* Organic User Activity & Hold Vibration Indicator */}
          <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-600 dark:text-emerald-200">
            <span>
              Materiał: {MATERIAL_PROFILES[haptic.material].label} ({haptic.materialHardness} Sh)
            </span>
            <div className="w-24 h-2 rounded-full bg-slate-200/80 dark:bg-emerald-950 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-fuchsia-400 to-cyan-400 transition-transform duration-75 origin-left"
                style={{
                  transform: `scaleX(${Math.min(
                    1,
                    0.08 + interactionEnergy * 0.35 + activeHoldLevel * 0.85
                  )})`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 1A. Standalone Offline Application (.html / PWA) & Studio AI Account Suite */}
      <OfflineSuiteCard />

      {/* 1A-Plugins. External Application Plugins Hub (SDK, Figma, VS Code, Webhook, 3D) */}
      <ExternalPluginsSection />

      {/* 1B. Studio Configuration Version History (Save & Restore Snapshots in Firestore & Offline Vault) */}
      <VersionHistoryPanel />

      {/* 2. Real-Time Three.js Animated 3D Haptic Feedback Indicator (Strength, Material Textures & Live Slider Coupling) */}
      <HapticSphereIndicator3D onOpenHapticSettings={() => onNavigateTab('haptics')} />

      {/* 2B. Rotary Controller Click & Haptic Calibration Service (for the attached CNC Spun-Metal Knob) */}
      <RotaryDriverCalibrationService />

      {/* 2C. Screen Architecture Suite: Transitions Library, All Designed Screens, DAG Map Planner & GitHub Generator */}
      <section
        style={cardSurfaceStyle}
        className="p-6 border border-white/80 dark:border-emerald-400/20 space-y-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
              <span>Architektura Ekranów i Nawigacji</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {activeScreenMap.nodes.length} ekranów · {activeScreenMap.edges.length} przejść
              </span>
              <span aria-hidden="true">·</span>
              <span>Źródło: {activeScreenMap.sourceRepo}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-emerald-50 mt-1">
              {activeScreenMap.name} — Plan Ekranów, Matryca Budowy z Pliku AI i GitHub
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('screens', 'file-matrix')}
              className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 dark:bg-emerald-500 text-white dark:text-emerald-950 hover:opacity-95 inline-flex items-center gap-1.5 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>Wgraj plik → Matryca AI</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('screens', 'export')}
              className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-medium bg-white/85 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 hover:bg-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Eksportuj JSON / Mermaid.js
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('screens', 'all')}
              className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Otwórz Studio Mapy Ekranów</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Screen Flow Preview Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => onNavigateTab('screens', 'file-matrix')}
            className="p-4 rounded-2xl text-left bg-white/75 dark:bg-emerald-950/70 border border-indigo-200/90 dark:border-emerald-400/35 hover:bg-white dark:hover:bg-emerald-900/65 transition-colors cursor-pointer space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-emerald-300">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <FileUp className="w-3.5 h-3.5" />
                <span>Wgraj plik AI</span>
              </span>
              <span className="font-mono tabular-nums">WWW + App</span>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
              Plan ekranów i matryca z pliku
            </div>
            <p className="text-xs text-slate-500 dark:text-emerald-200/70 line-clamp-2">
              Analizuje PDF, makiety PNG/JPG, Markdown, JSON lub CSV i generuje plan ekranów oraz matrycę strony i aplikacji.
            </p>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('screens', 'gallery')}
            className="p-4 rounded-2xl text-left bg-white/65 dark:bg-emerald-950/60 border border-slate-200/80 dark:border-emerald-400/20 hover:bg-white dark:hover:bg-emerald-900/65 transition-colors cursor-pointer space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-emerald-300/80">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Usługa podglądu</span>
              </span>
              <span className="font-mono tabular-nums">
                {activeScreenMap.nodes.length} widoków
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
              Wszystkie projektowane ekrany
            </div>
            <p className="text-xs text-slate-500 dark:text-emerald-200/70 line-clamp-2">
              Tablica wszystkich ekranów z filtrami ról, podglądem Mobile / Tablet / Desktop i trybem prezentacji.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('screens', 'planner')}
            className="p-4 rounded-2xl text-left bg-white/65 dark:bg-emerald-950/60 border border-slate-200/80 dark:border-emerald-400/20 hover:bg-white dark:hover:bg-emerald-900/65 transition-colors cursor-pointer space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-emerald-300/80">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <GitBranch className="w-3.5 h-3.5" />
                <span>Planer DAG</span>
              </span>
              <span className="font-mono tabular-nums">
                {activeScreenMap.edges.length} połączeń
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
              Planowanie i budowa mapy ekranów
            </div>
            <p className="text-xs text-slate-500 dark:text-emerald-200/70 line-clamp-2">
              Interaktywne płótno węzłów, krzywe Béziera, inspektor tras, eksport Mermaid.js oraz zapis Cloud SQL.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('screens', 'github')}
            className="p-4 rounded-2xl text-left bg-white/65 dark:bg-emerald-950/60 border border-slate-200/80 dark:border-emerald-400/20 hover:bg-white dark:hover:bg-emerald-900/65 transition-colors cursor-pointer space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-emerald-300/80">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>Generator GitHub</span>
              </span>
              <span className="font-mono tabular-nums">AST + AI</span>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
              Mapa aplikacji z biblioteki GitHub
            </div>
            <p className="text-xs text-slate-500 dark:text-emerald-200/70 line-clamp-2">
              Analizuje drzewo plików, package.json i README repozytorium GitHub, budując kompletną architekturę ekranów.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('screens', 'transitions')}
            className="p-4 rounded-2xl text-left bg-white/65 dark:bg-emerald-950/60 border border-slate-200/80 dark:border-emerald-400/20 hover:bg-white dark:hover:bg-emerald-900/65 transition-colors cursor-pointer space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-emerald-300/80">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Layers className="w-3.5 h-3.5" />
                <span>Fizyka 60 fps</span>
              </span>
              <span className="font-mono tabular-nums">
                {SCREEN_TRANSITION_PRESETS.length} presetów
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
              Biblioteka animacji przejść ekranów
            </div>
            <p className="text-xs text-slate-500 dark:text-emerald-200/70 line-clamp-2">
              Aktywna animacja:{' '}
              {
                (
                  SCREEN_TRANSITION_PRESETS.find(
                    (p) => p.id === activeScreenTransition
                  ) || SCREEN_TRANSITION_PRESETS[0]
                ).name.replace(/^\d+\.\s*/, '')
              }
              .
            </p>
          </button>
        </div>
      </section>

      {/* 3. Main 2-Column Balanced Split: Central 3D Health/Metric Widget + Tactile Engraved Button Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left 6 Columns: Interactive Three.js Haptic & Sound 3D Visualization Widget */}
        <section
          style={cardSurfaceStyle}
          className="lg:col-span-6 p-6 border border-white/80 dark:border-emerald-400/20 flex flex-col justify-between gap-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5">
                <span>Widżet Wizualizacji 3D (Three.js)</span>
                <span aria-hidden="true">·</span>
                <span>Reakcja Haptyczno-Dźwiękowa Live</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                {metricMode === 'flebologia'
                  ? 'Zadbaj o lekkość i mikrokrążenie'
                  : 'Inteligentna analiza celów i kapitału'}
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onNavigateTab('synth')}
                className="px-3 py-1.5 rounded-xl bg-white/75 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 cursor-pointer whitespace-nowrap shrink-0"
              >
                Syntezator
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('haptics')}
                className="px-3 py-1.5 rounded-xl bg-white/75 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Haptyka</span>
              </button>
            </div>
          </div>

          <ThreeMetricScene
            metricMode={metricMode}
            onToggleMetricMode={() =>
              setMetricMode((m) => (m === 'flebologia' ? 'finance' : 'flebologia'))
            }
          />

          {/* Live Haptic & Sound Coupling Controls for Real-Time 3D Feedback */}
          <div className="pt-3 border-t border-slate-200/60 dark:border-emerald-400/15 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Waveform Selector Morphing 3D GLSL Flutes */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/65 dark:bg-emerald-950/75">
                {(
                  [
                    ['sine', 'Sinus'],
                    ['triangle', 'Trójkąt'],
                    ['sawtooth', 'Piła'],
                    ['square', 'Kwadrat'],
                  ] as [OscillatorType, string][]
                ).map(([wf, label]) => (
                  <button
                    key={wf}
                    type="button"
                    onClick={() => {
                      const nextSynth = { ...synth, waveform: wf };
                      updateSynth({ waveform: wf });
                      hapticAudio.triggerPress(nextSynth, haptic, patterns);
                      pulseInteraction(0.95);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      synth.waveform === wf
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

              {/* Haptic Pattern Selector Sculpting 32-Resonator 3D Crown */}
              <select
                aria-label="Aktywny wzorzec haptyczny 3D"
                value={haptic.activePatternId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  const nextHaptic = { ...haptic, activePatternId: nextId };
                  updateHaptic({ activePatternId: nextId });
                  hapticAudio.triggerPress(synth, nextHaptic, patterns);
                  pulseInteraction(1.0);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/80 dark:bg-emerald-950/80 border border-slate-200/80 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 cursor-pointer max-w-[230px]"
              >
                {patterns.map((p) => (
                  <option key={p.id} value={p.id}>
                    Wzorzec: {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
              <HapticSlider
                label="Intensywność haptyki"
                value={haptic.intensity}
                min={0}
                max={100}
                step={2}
                unit="%"
                onChange={(v) => updateHaptic({ intensity: v })}
              />
              <HapticSlider
                label="Twardość materiału (Shore)"
                value={haptic.materialHardness}
                min={5}
                max={100}
                step={1}
                unit=" Sh"
                onChange={(v) => updateHaptic({ materialHardness: v })}
              />
              <HapticSlider
                label="Niski ton kliku (<160 Hz)"
                value={Math.min(158, Math.max(36, synth.baseFrequency))}
                min={36}
                max={158}
                step={1}
                unit=" Hz"
                onChange={(v) => updateSynth({ baseFrequency: v })}
              />
              <HapticSlider
                label="Filtr akustyczny i iryzacja"
                value={synth.filterCutoff}
                min={250}
                max={8000}
                step={50}
                unit=" Hz"
                onChange={(v) => updateSynth({ filterCutoff: v })}
              />
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1 text-xs font-mono tabular-nums text-slate-600 dark:text-emerald-200/85">
              <div>
                Sprzęgło zwrotne:{' '}
                <span className="font-semibold text-slate-900 dark:text-emerald-50">
                  {haptic.reverseClutchForce}%
                </span>
              </div>
              <div>
                Czas impulsu:{' '}
                <span className="font-semibold text-slate-900 dark:text-emerald-50">
                  {haptic.durationMs} ms
                </span>
              </div>
              <div>
                Pogłos 3D:{' '}
                <span className="font-semibold text-slate-900 dark:text-emerald-50">
                  {Math.round(synth.reverbMix * 100)}%
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Right 6 Columns: Button Group Multi-Select + Engraved Symptom/Goal Cards + Macro "Dalej" Button */}
        <section
          style={cardSurfaceStyle}
          className="lg:col-span-6 p-6 border border-white/80 dark:border-emerald-400/20 flex flex-col justify-between gap-5"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5">
                  <span>Krok {dalejCount} z 2</span>
                  <span aria-hidden="true">·</span>
                  <span>Symbole, Ryciny i Unifikacja Grup</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                  Wybierz obszary analizy ({selectedSymptoms.length})
                </h2>
              </div>

              <button
                type="button"
                onClick={unifySelectedGroupsNow}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-emerald-900/70 text-indigo-800 dark:text-emerald-100 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ujednolić zaznaczone grupy</span>
              </button>
            </div>

            {/* Interactive Button Group Multi-Selector */}
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ['group-primary', 'Grupa A: Akcje'],
                  ['group-diagnostic', 'Grupa B: Kafelki'],
                  ['group-audio', 'Grupa C: Audio'],
                ] as [ButtonGroupId, string][]
              ).map(([gid, label]) => {
                const active = selectedGroups.includes(gid);
                return (
                  <button
                    key={gid}
                    type="button"
                    onClick={() => {
                      toggleGroupSelection(gid);
                      hapticAudio.triggerPress(synth, haptic, patterns);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? isDark
                          ? 'bg-emerald-400 text-emerald-950 border-emerald-300'
                          : 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white/50 dark:bg-emerald-950/45 border-slate-200 dark:border-emerald-400/20 text-slate-600 dark:text-emerald-200'
                    }`}
                  >
                    {active ? `✓ ${label}` : label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6 Tactile Engraved Glass Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DIAGNOSTIC_ITEMS.map((item) => (
              <TactileButton
                key={item.id}
                groupId="group-diagnostic"
                symbol={item.symbol}
                pitchSemitones={item.pitch}
                selected={selectedSymptoms.includes(item.id)}
                subtitle={item.sub}
                onClick={() => toggleSymptom(item.id)}
                className="px-4 py-3.5 text-sm"
              >
                {item.label}
              </TactileButton>
            ))}
          </div>

          {/* Iconic Macro Frosted Crystal "Dalej" Button (inspired by Reference Photo 5) */}
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-emerald-300/75">
              <span>Przytrzymaj przycisk „Dalej”, aby poczuć narastające drgania</span>
              <span className="font-mono tabular-nums">
                {activeHoldLevel > 0
                  ? `Drgania: ${Math.round(activeHoldLevel * 100)}%`
                  : 'Gotowy'}
              </span>
            </div>

            <div className="p-2 rounded-full bg-white/45 dark:bg-emerald-950/55 border border-white/80 dark:border-emerald-400/20 shadow-inner">
              <TactileButton
                groupId="group-primary"
                variant="crystal-pill"
                symbol="compass"
                pitchSemitones={5}
                onClick={() => setDalejCount((c) => (c === 1 ? 2 : 1))}
                className="w-full py-4 px-6"
              >
                <span className="w-full flex items-center justify-between gap-4">
                  <span className="font-editorial text-2xl font-semibold tracking-wide text-slate-900 dark:text-emerald-50">
                    Dalej
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-sans font-medium text-indigo-700 dark:text-emerald-300">
                    <span>Rozpocznij analizę</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </span>
              </TactileButton>
            </div>
          </div>
        </section>
      </div>

      {/* 4. Latest Button Motion Physics & Optical Backlight Library */}
      <ButtonAnimationsLibrary />

      {/* 5. Tactile Switch Variants Library: Sliders, Lever Switches & Capacitive Touch Controls */}
      <SwitchVariantsLibrary />

      {/* 6. Bottom Row: Neumorphic Rotary Audio Player (5 cols) + Vertical List of Rounded Glassy Cards & Library (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5">
          <AudioPlayerCard />
        </div>

        {/* Vertical List of Rounded Frosted Glass Cards with Silent Visual Selection */}
        <section
          style={cardSurfaceStyle}
          className="lg:col-span-7 p-6 border border-white/80 dark:border-emerald-400/20 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5">
                <span>Biblioteka Wizualna</span>
                <span aria-hidden="true">·</span>
                <span>Progresywne Ładowanie Zasobów</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                Szkliste Karty Referencyjne i Wygenerowane ({filteredMedia.length})
              </h3>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/65 dark:bg-emerald-950/75">
              {(
                [
                  ['all', 'Wszystkie'],
                  ['image', 'Obrazy'],
                  ['video', 'Wideo'],
                ] as const
              ).map(([fKey, label]) => (
                <button
                  key={fKey}
                  type="button"
                  onClick={() => setLibraryFilter(fKey)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                    libraryFilter === fKey
                      ? isDark
                        ? 'bg-emerald-400 text-emerald-950 shadow-sm'
                        : 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-emerald-200/75'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {selectedAssetId && (() => {
            const activeAsset = mediaLibrary.find((m) => m.id === selectedAssetId);
            if (!activeAsset) return null;
            return (
              <div className="p-3.5 rounded-2xl bg-white/75 dark:bg-emerald-950/70 border border-indigo-200/80 dark:border-emerald-400/25 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-800 dark:text-emerald-100 truncate">
                    Podgląd grafiki: {activeAsset.title}
                  </span>
                  <button
                    type="button"
                    aria-label="Zamknij podgląd grafiki"
                    onClick={() => setSelectedAssetId(null)}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:text-emerald-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {activeAsset.mediaType === 'video' ? (
                  <video
                    src={activeAsset.src}
                    controls
                    muted
                    playsInline
                    className="w-full max-h-60 rounded-xl object-cover bg-slate-900"
                  />
                ) : (
                  <ProgressiveImage
                    src={activeAsset.src}
                    alt={activeAsset.title}
                    aspectClass="aspect-video"
                    className="w-full max-h-60 rounded-xl"
                  />
                )}
              </div>
            );
          })()}

          {/* Vertical Stack of Rounded Frosted Glass Cards (Silent Selection — Zero Audio Tone) */}
          <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
            {filteredMedia.map((asset) => {
              const isSelected = selectedAssetId === asset.id;
              return (
                <div
                  key={asset.id}
                  onClick={() =>
                    setSelectedAssetId((prev) => (prev === asset.id ? null : asset.id))
                  }
                  style={{
                    borderRadius: `${Math.max(16, depth.borderRadius - 6)}px`,
                  }}
                  className={`p-3.5 border flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                    isSelected
                      ? isDark
                        ? 'bg-emerald-900/65 border-emerald-300/60'
                        : 'bg-white/90 border-indigo-400/80'
                      : 'bg-white/60 dark:bg-emerald-950/45 border-white/85 dark:border-emerald-400/15 hover:bg-white/80 dark:hover:bg-emerald-900/45'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {asset.mediaType === 'video' ? (
                      <video
                        src={asset.src}
                        muted
                        playsInline
                        className="w-20 h-16 rounded-2xl object-cover shrink-0 bg-slate-900"
                      />
                    ) : (
                      <ProgressiveImage
                        src={asset.src}
                        alt={asset.title}
                        aspectClass="aspect-auto"
                        className="w-20 h-16 rounded-2xl shrink-0"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-slate-500 dark:text-emerald-300/75 flex items-center gap-1.5">
                        <span>{asset.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{asset.aspectRatio}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{asset.resolution}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-emerald-50 truncate mt-0.5">
                        {asset.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-emerald-200/70 truncate">
                        {asset.subtitle}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label={`Pokaż podgląd ${asset.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAssetId((prev) => (prev === asset.id ? null : asset.id));
                    }}
                    className={`w-11 h-11 rounded-full border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                      isSelected
                        ? isDark
                          ? 'bg-emerald-400 text-emerald-950 border-emerald-300'
                          : 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white/80 dark:bg-emerald-950/75 text-slate-700 dark:text-emerald-100 border-white/90 dark:border-emerald-400/25 hover:bg-white'
                    }`}
                  >
                    {isSelected ? (
                      <Check className="w-4 h-4 mx-auto" />
                    ) : (
                      <Eye className="w-4 h-4 mx-auto" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
