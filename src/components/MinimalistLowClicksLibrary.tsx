import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileAudio,
  FileJson,
  GripVertical,
  Volume2,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  exportMinimalistLowClickAsset,
  hapticAudio,
} from '../lib/hapticAudioEngine';
import {
  attachCatalogDragData,
  findCatalogItemForMinimalistClick,
  setActiveDraggedCatalogItem,
} from '../lib/tactileUiCatalog';
import {
  MATERIAL_PROFILES,
  MINIMALIST_LOW_CLICK_VARIANTS,
  MinimalistLowClickId,
  MinimalistLowClickSpec,
} from '../types/studio';

function buildEnvelopeSvgPath(spec: MinimalistLowClickSpec): string {
  const width = 220;
  const midY = 26;
  const cycles = Math.max(1.4, (spec.fundamentalHz / 1000) * spec.durationMs * 1.6);
  const activeRatio = Math.min(0.88, Math.max(0.28, spec.durationMs / 16));
  const points: string[] = [];
  const steps = 64;

  for (let i = 0; i <= steps; i++) {
    const normX = i / steps;
    const x = (normX * width).toFixed(1);
    let amp = 0;
    if (normX <= activeRatio) {
      const localT = normX / activeRatio;
      const env = Math.min(1, localT * 8) * Math.exp(-3.4 * localT);
      const phase = localT * cycles * Math.PI * 2;
      const wave =
        spec.waveform === 'triangle'
          ? (2 / Math.PI) * Math.asin(Math.sin(phase))
          : Math.sin(phase);
      amp = wave * env * 19;
    }
    const y = (midY - amp).toFixed(1);
    points.push(`${i === 0 ? 'M' : 'L'}${x},${y}`);
  }
  return points.join(' ');
}

export const MinimalistLowClicksLibrary: React.FC<{
  compact?: boolean;
}> = ({ compact = false }) => {
  const {
    palette,
    depth,
    haptic,
    updateHaptic,
    pulseInteraction,
  } = useStudio();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastTriggeredId, setLastTriggeredId] = useState<MinimalistLowClickId | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [durationFilter, setDurationFilter] = useState<'all' | 'ultra-short' | 'deep-sub'>('all');

  const isDark = palette === 'emerald-clinic';
  const activeGlobalVariant = haptic.minimalistClickVariant || 'none';

  const filteredVariants = MINIMALIST_LOW_CLICK_VARIANTS.filter((v) => {
    if (durationFilter === 'ultra-short') return v.durationMs <= 7;
    if (durationFilter === 'deep-sub') return v.fundamentalHz <= 68;
    return true;
  });

  const containerStyle: React.CSSProperties = {
    borderRadius: `${depth.borderRadius}px`,
    backdropFilter: `blur(${depth.glassBlur}px)`,
    backgroundColor: isDark
      ? `rgba(11, 34, 29, ${depth.glassOpacity})`
      : `rgba(255, 255, 255, ${depth.glassOpacity})`,
    boxShadow: isDark
      ? `0 ${depth.elevation}px ${depth.blur}px rgba(0,0,0,0.45)`
      : `0 ${depth.elevation}px ${depth.blur}px rgba(88, 76, 148, 0.12)`,
  };

  const handleTriggerClick = (variantId: MinimalistLowClickId) => {
    const scale = Math.max(0.15, haptic.intensity / 100);
    hapticAudio.triggerMinimalistLowClick(variantId, scale);
    pulseInteraction(0.85);
    setLastTriggeredId(variantId);
  };

  const handleToggleGlobal = (variantId: MinimalistLowClickId) => {
    const next = activeGlobalVariant === variantId ? 'none' : variantId;
    updateHaptic({ enabled: true, minimalistClickVariant: next });
    if (next !== 'none') {
      hapticAudio.triggerMinimalistLowClick(variantId, Math.max(0.2, haptic.intensity / 100));
      pulseInteraction(0.9);
    }
  };

  const handleCopyCode = async (id: string, snippet: string) => {
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      // Ignore clipboard restriction
    }
    setCopiedId(id);
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 1600);
  };

  const handleExportVariant = (variantId: MinimalistLowClickId, format: 'wav' | 'json') => {
    const res = exportMinimalistLowClickAsset(variantId, format);
    setExportNotice(
      `Pobrano ${res.fileName} (${res.fundamentalHz} Hz · ${res.durationMs} ms)`
    );
    window.setTimeout(() => {
      setExportNotice((prev) => (prev?.includes(res.fileName) ? null : prev));
    }, 3600);
  };

  return (
    <section
      style={containerStyle}
      className="p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-200/70 dark:border-emerald-400/15">
        <div className="space-y-1 max-w-2xl">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
            <span>Kolekcja Mikro-Impulsów Niskotonowych</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">42–112 Hz (&lt;160 Hz)</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums"> Obwiednia 4–14 ms</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-emerald-50">
            Krótkie, niskie minimalistyczne kliknięcia
          </h2>
          <p className="text-sm text-slate-600 dark:text-emerald-100/80">
            Osiem studyjnych mikro-kliknięć wygaszanych w przejściu przez zero — zero ostrych wysokich częstotliwości, natychmiastowa odpowiedź dotykowa i pełny eksport do WAV/JSON.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-emerald-950/80">
            {(
              [
                ['all', 'Wszystkie (8)'],
                ['ultra-short', 'Ultrakrótkie 4–7 ms'],
                ['deep-sub', 'Sub-bas 42–68 Hz'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDurationFilter(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[36px] ${
                  durationFilter === id
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

          {activeGlobalVariant !== 'none' && (
            <button
              type="button"
              onClick={() => updateHaptic({ minimalistClickVariant: 'none' })}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-400/40 hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap shrink-0 min-h-[38px]"
            >
              Przywróć pełny syntezator materiału
            </button>
          )}
        </div>
      </div>

      {/* Quick Audition Strip */}
      <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-emerald-950/60 border border-slate-200/75 dark:border-emerald-400/20 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-600 dark:text-emerald-100/85 flex flex-wrap items-center gap-2">
          <Volume2 className="w-4 h-4 text-indigo-600 dark:text-emerald-300 shrink-0" />
          <span className="font-medium text-slate-900 dark:text-emerald-50">
            Tryb globalny Studio:
          </span>
          <span>
            {activeGlobalVariant === 'none'
              ? 'Wielowarstwowy syntezator materiału (domyślny)'
              : MINIMALIST_LOW_CLICK_VARIANTS.find((v) => v.id === activeGlobalVariant)
                  ?.namePl || activeGlobalVariant}
          </span>
          {exportNotice && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                {exportNotice}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {MINIMALIST_LOW_CLICK_VARIANTS.slice(0, 4).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => handleTriggerClick(v.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono tabular-nums font-medium bg-white dark:bg-emerald-900/75 text-slate-800 dark:text-emerald-100 border border-slate-200/85 dark:border-emerald-400/25 hover:border-indigo-400 dark:hover:border-emerald-300 active:scale-[0.97] transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              {v.fundamentalHz} Hz · {v.durationMs} ms
            </button>
          ))}
        </div>
      </div>

      {/* Variants Grid */}
      <div
        className={`grid grid-cols-1 ${
          compact ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-4'
        } gap-4`}
      >
        {filteredVariants.map((spec) => {
          const isGlobal = activeGlobalVariant === spec.id;
          const wasJustPlayed = lastTriggeredId === spec.id;
          const svgPath = buildEnvelopeSvgPath(spec);

          return (
            <div
              key={spec.id}
              className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all duration-150 ${
                isGlobal
                  ? isDark
                    ? 'bg-emerald-900/55 border-emerald-300/75 shadow-[0_0_28px_-6px_rgba(52,211,153,0.38)]'
                    : 'bg-white/95 border-indigo-500/80 shadow-[0_10px_28px_-8px_rgba(79,70,229,0.22)]'
                  : 'bg-white/60 dark:bg-emerald-950/40 border-slate-200/80 dark:border-emerald-400/15 hover:border-slate-300 dark:hover:border-emerald-400/35'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5">
                    <span>{spec.fundamentalHz}→{spec.pitchDropHz} Hz</span>
                    <span aria-hidden="true">·</span>
                    <span>{spec.durationMs} ms</span>
                  </div>

                  <span
                    draggable
                    onDragStart={(e) =>
                      attachCatalogDragData(
                        e,
                        findCatalogItemForMinimalistClick(spec.id, spec.shortLabelPl)
                      )
                    }
                    onDragEnd={() => setActiveDraggedCatalogItem(null)}
                    title="Przeciągnij ten wariant kliknięcia bezpośrednio na ekran w ScreenArchitectureHub"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/85 dark:bg-emerald-900/70 border border-slate-200/80 dark:border-emerald-400/25 text-[11px] font-medium text-slate-600 dark:text-emerald-200 cursor-grab active:cursor-grabbing whitespace-nowrap shrink-0 select-none"
                  >
                    <GripVertical className="w-3 h-3" />
                    <span>Przeciągnij</span>
                  </span>
                </div>

                <h3 className="text-base font-semibold text-slate-900 dark:text-emerald-50">
                  {spec.namePl}
                </h3>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-emerald-100/75">
                  {spec.descriptionPl}
                </p>
              </div>

              {/* Micro Envelope SVG Preview & Interactive Tactile Test Pad */}
              <div className="space-y-2.5">
                <div className="px-3 py-2 rounded-xl bg-slate-900/95 dark:bg-black/45 border border-slate-800 dark:border-emerald-400/20 flex items-center justify-between gap-3">
                  <svg
                    viewBox="0 0 220 52"
                    className="w-full h-10 overflow-visible"
                    aria-label={`Obwiednia fali ${spec.namePl}`}
                  >
                    <line
                      x1="0"
                      y1="26"
                      x2="220"
                      y2="26"
                      stroke="rgba(148,163,184,0.22)"
                      strokeDasharray="3 3"
                    />
                    <path
                      d={svgPath}
                      fill="none"
                      stroke={spec.accentHex}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-[11px] font-mono tabular-nums text-slate-300 whitespace-nowrap shrink-0">
                    {MATERIAL_PROFILES[spec.recommendedMaterial].label.split(' ')[0]}
                  </span>
                </div>

                <button
                  type="button"
                  onPointerDown={() => handleTriggerClick(spec.id)}
                  style={{
                    boxShadow: wasJustPlayed
                      ? `0 0 0 1.5px ${spec.accentHex}, 0 8px 22px -6px ${spec.accentHex}66`
                      : undefined,
                  }}
                  className="w-full px-4 py-3 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 hover:opacity-95 active:scale-[0.975] transition-all duration-100 cursor-pointer flex items-center justify-between gap-2 min-h-[44px]"
                >
                  <span className="whitespace-nowrap">Kliknij testowo ({spec.shortLabelPl})</span>
                  <span className="font-mono tabular-nums text-[11px] opacity-85 whitespace-nowrap">
                    impuls {spec.vibratePulseMs} ms
                  </span>
                </button>
              </div>

              {/* Footer Actions: Set Global + WAV/JSON + Copy */}
              <div className="pt-3 border-t border-slate-200/70 dark:border-emerald-400/15 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleGlobal(spec.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[36px] ${
                    isGlobal
                      ? isDark
                        ? 'bg-emerald-300 text-emerald-950 font-semibold'
                        : 'bg-indigo-600 text-white font-semibold'
                      : 'bg-white/85 dark:bg-emerald-950/80 text-slate-700 dark:text-emerald-100 border border-slate-200/85 dark:border-emerald-400/25 hover:opacity-90'
                  }`}
                >
                  {isGlobal ? '✓ Aktywne w Studio' : 'Ustaw globalnie'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleExportVariant(spec.id, 'wav')}
                    title="Pobierz wygenerowaną falę 48 kHz 16-bit WAV"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/80 dark:bg-emerald-900/60 text-slate-700 dark:text-emerald-100 border border-slate-200/80 dark:border-emerald-400/20 hover:opacity-90 cursor-pointer whitespace-nowrap shrink-0 min-h-[34px]"
                  >
                    <FileAudio className="w-3.5 h-3.5" />
                    <span>WAV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportVariant(spec.id, 'json')}
                    title="Pobierz parametry impulsu JSON"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/80 dark:bg-emerald-900/60 text-slate-700 dark:text-emerald-100 border border-slate-200/80 dark:border-emerald-400/20 hover:opacity-90 cursor-pointer whitespace-nowrap shrink-0 min-h-[34px]"
                  >
                    <FileJson className="w-3.5 h-3.5" />
                    <span>JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(spec.id, spec.codeSnippet)}
                    title="Kopiuj wywołanie TS"
                    className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-600 dark:text-emerald-200 hover:text-slate-900 dark:hover:text-white cursor-pointer min-h-[34px] min-w-[34px]"
                  >
                    {copiedId === spec.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500 dark:text-emerald-300/75">
        <span>
          Wszystkie 8 wariantów spełnia rygor akustyczny Aether (&lt;160 Hz) oraz eliminuje przesterowania dzięki miękkiemu domknięciu fazy (+6 ms).
        </span>
        <button
          type="button"
          onClick={() => handleExportVariant(filteredVariants[0]?.id || 'sub-carbon-6ms', 'wav')}
          className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-emerald-300 font-medium hover:underline cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Pobierz referencyjny klik .WAV (48 kHz)</span>
        </button>
      </div>
    </section>
  );
};
