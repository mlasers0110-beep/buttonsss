import React, { useState } from 'react';
import { ArrowRight, Check, Copy, GripVertical, RotateCcw } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  attachCatalogDragData,
  findCatalogItemForIlluminationPreset,
  findCatalogItemForMotionPreset,
  setActiveDraggedCatalogItem,
} from '../lib/tactileUiCatalog';
import {
  BUTTON_ILLUMINATION_PRESETS,
  BUTTON_MOTION_PRESETS,
  ButtonIlluminationPresetId,
  ButtonMotionPresetId,
  MATERIAL_PROFILES,
} from '../types/studio';
import { TactileButton } from './ui/TactileButton';
import { HapticSlider } from './ui/HapticSlider';

const GLOW_SWATCHES = [
  { hex: '#8B7CFF', label: 'Fiolet Aether' },
  { hex: '#38BDF8', label: 'Błękit Optyczny' },
  { hex: '#34D399', label: 'Szmaragd Kliniczny' },
  { hex: '#F472B6', label: 'Róż Pryzmatyczny' },
  { hex: '#F59E0B', label: 'Bursztyn Ciepły' },
  { hex: '#A78BFA', label: 'Lawenda Perłowa' },
];

export const ButtonAnimationsLibrary: React.FC = () => {
  const {
    palette,
    depth,
    haptic,
    engraving,
    updateEngraving,
    animation,
    setAnimation,
    applyButtonMotionPreset,
    applyButtonIlluminationPreset,
  } = useStudio();

  const [sectionFilter, setSectionFilter] = useState<'all' | 'motion' | 'illumination'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [demoSelected, setDemoSelected] = useState(true);

  const isDark = palette === 'emerald-clinic';

  const activeMotionId: ButtonMotionPresetId =
    animation.motionPreset ?? 'magnetic-levitation';
  const activeIlluminationId: ButtonIlluminationPresetId =
    animation.illuminationPreset ?? 'cursor-spotlight';

  const activeMotionSpec =
    BUTTON_MOTION_PRESETS.find((m) => m.id === activeMotionId) || BUTTON_MOTION_PRESETS[0];
  const activeIllumSpec =
    BUTTON_ILLUMINATION_PRESETS.find((i) => i.id === activeIlluminationId) ||
    BUTTON_ILLUMINATION_PRESETS[0];

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

  const handleCopySnippet = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 1800);
    } catch {
      setCopiedId(id);
    }
  };

  const resetToStudioDefault = () => {
    applyButtonMotionPreset('magnetic-levitation');
    applyButtonIlluminationPreset('cursor-spotlight', true);
  };

  const combinedSpecSnippet = JSON.stringify(
    {
      motionPreset: activeMotionSpec.id,
      spring: {
        stiffness: animation.stiffness,
        damping: animation.damping,
        mass: animation.mass,
        pressScale: animation.pressScale,
      },
      illuminationPreset: activeIllumSpec.id,
      backlight: {
        glowColor: engraving.glowColor,
        glowIntensity: engraving.glowIntensity,
        glowSpreadPx: animation.glowSpread,
      },
    },
    null,
    2
  );

  return (
    <section
      style={containerStyle}
      className="p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-8"
    >
      {/* Header & Filter Bar */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-200/70 dark:border-emerald-400/15">
        <div className="space-y-1 max-w-2xl">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
            <span>Biblioteka Ruchu i Światła</span>
            <span aria-hidden="true">·</span>
            <span>Akceleracja GPU (transform, opacity)</span>
            <span aria-hidden="true">·</span>
            <span>Materiał: {MATERIAL_PROFILES[haptic.material].label}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-emerald-50">
            Najnowsze animacje przycisków i podświetleń optycznych
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-emerald-950/80">
            {(
              [
                ['all', 'Wszystkie (12)'],
                ['motion', 'Animacje ruchu (6)'],
                ['illumination', 'Podświetlenia (6)'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSectionFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[36px] ${
                  sectionFilter === key
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
            onClick={resetToStudioDefault}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/75 dark:bg-emerald-950/75 text-slate-700 dark:text-emerald-100 border border-slate-200/80 dark:border-emerald-400/25 hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap shrink-0 min-h-[38px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Domyślne</span>
          </button>
        </div>
      </div>

      {/* Live Combined Studio Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch pb-6 border-b border-slate-200/70 dark:border-emerald-400/15">
        <div className="lg:col-span-7 flex flex-col justify-between gap-5 p-5 rounded-2xl bg-slate-100/70 dark:bg-emerald-950/55 border border-slate-200/70 dark:border-emerald-400/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600 dark:text-emerald-200/85 flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-900 dark:text-emerald-50">
                Aktywna para w studiu:
              </span>
              <span>{activeMotionSpec.name}</span>
              <span aria-hidden="true">·</span>
              <span>{activeIllumSpec.name}</span>
            </div>

            <button
              type="button"
              onClick={() => handleCopySnippet('combined-stage', combinedSpecSnippet)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/85 dark:bg-emerald-900/75 text-slate-800 dark:text-emerald-100 border border-slate-200/80 dark:border-emerald-400/25 cursor-pointer whitespace-nowrap shrink-0"
            >
              {copiedId === 'combined-stage' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                  <span>Skopiowano JSON</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Kopiuj konfigurację</span>
                </>
              )}
            </button>
          </div>

          {/* 3 Archetype Buttons Responding Live to Active Motion + Illumination */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 py-2">
            <TactileButton
              variant="glass-card"
              symbol="prism"
              selected={demoSelected}
              subtitle="Karta matrycowa"
              onClick={() => setDemoSelected((s) => !s)}
              className="px-4 py-3.5 text-sm min-h-[64px]"
            >
               Analiza Optyczna
            </TactileButton>

            <TactileButton
              variant="crystal-pill"
              symbol="compass"
              pitchSemitones={4}
              className="px-5 py-3.5 text-sm min-h-[64px]"
            >
              <span className="w-full flex items-center justify-between gap-2">
                <span>Kapsuła Szkła</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </span>
            </TactileButton>

            <TactileButton
              variant="primary-cta"
              symbol="spark"
              pitchSemitones={7}
              subtitle="Główny akcent"
              className="px-4 py-3.5 text-sm min-h-[64px]"
            >
              Zatwierdź Impuls
            </TactileButton>
          </div>

          <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-emerald-300/75 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Sztywność: {animation.stiffness} N/m</span>
            <span aria-hidden="true">·</span>
            <span>Tłumienie: {animation.damping}</span>
            <span aria-hidden="true">·</span>
            <span>Skala nacisku: {(animation.pressScale * 100).toFixed(1)}%</span>
            <span aria-hidden="true">·</span>
            <span>Promień poświaty: {animation.glowSpread} px</span>
          </div>
        </div>

        {/* Optical Backlight Tuning Controls */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4 p-5 rounded-2xl bg-white/55 dark:bg-emerald-950/40 border border-slate-200/70 dark:border-emerald-400/20">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700 dark:text-emerald-100">
                Barwa wiązki podświetlenia
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-emerald-300/80">
                {engraving.glowColor}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {GLOW_SWATCHES.map((sw) => {
                const active =
                  engraving.glowColor.toLowerCase() === sw.hex.toLowerCase();
                return (
                  <button
                    key={sw.hex}
                    type="button"
                    title={sw.label}
                    aria-label={`Ustaw kolor podświetlenia ${sw.label}`}
                    onClick={() =>
                      updateEngraving({ glowEnabled: true, glowColor: sw.hex })
                    }
                    className={`w-9 h-9 rounded-xl border transition-transform cursor-pointer flex items-center justify-center ${
                      active
                        ? 'scale-105 ring-2 ring-slate-900 dark:ring-emerald-300 border-white'
                        : 'border-white/80 dark:border-emerald-400/25 hover:scale-105'
                    }`}
                    style={{ backgroundColor: sw.hex }}
                  >
                    {active && <Check className="w-4 h-4 text-slate-950" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <HapticSlider
              label="Natężenie podświetlenia przycisków"
              value={engraving.glowIntensity}
              min={0}
              max={100}
              step={2}
              unit="%"
              onChange={(v) => updateEngraving({ glowEnabled: v > 0, glowIntensity: v })}
            />
            <HapticSlider
              label="Rozproszenie otoczki świetlnej (Spread)"
              value={animation.glowSpread}
              min={12}
              max={64}
              step={2}
              unit=" px"
              onChange={(v) => setAnimation((prev) => ({ ...prev, glowSpread: v }))}
            />
          </div>
        </div>
      </div>

      {/* Part 1: 6 Button Motion Presets */}
      {(sectionFilter === 'all' || sectionFilter === 'motion') && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-emerald-50">
              01. Architektury ruchu przycisków (Fizyka Sprężyn i Wektorów 3D)
            </h3>
            <span className="text-xs text-slate-500 dark:text-emerald-300/75">
              Najedź, przechyl kursor i przytrzymaj dowolny przycisk testowy
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {BUTTON_MOTION_PRESETS.map((preset, idx) => {
              const isSelected = activeMotionId === preset.id;
              return (
                <div
                  key={preset.id}
                  className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-colors ${
                    isSelected
                      ? isDark
                        ? 'bg-emerald-900/45 border-emerald-300/60'
                        : 'bg-white/85 border-indigo-400/80'
                      : 'bg-white/50 dark:bg-emerald-950/35 border-slate-200/75 dark:border-emerald-400/15'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5 min-w-0 truncate">
                        <span className="font-mono tabular-nums">0{idx + 1}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{preset.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{preset.latencyLabel}</span>
                      </div>

                      <span
                        draggable
                        onDragStart={(e) =>
                          attachCatalogDragData(
                            e,
                            findCatalogItemForMotionPreset(preset.id, preset.name)
                          )
                        }
                        onDragEnd={() => setActiveDraggedCatalogItem(null)}
                        title="Chwyć i przeciągnij na podgląd ekranu w ScreenArchitectureHub"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/80 dark:bg-emerald-900/70 border border-slate-200/80 dark:border-emerald-400/25 text-[11px] font-medium text-slate-600 dark:text-emerald-200 cursor-grab active:cursor-grabbing whitespace-nowrap shrink-0 select-none"
                      >
                        <GripVertical className="w-3 h-3" />
                        <span>Przeciągnij</span>
                      </span>
                    </div>
                    <h4 className="text-base font-semibold text-slate-900 dark:text-emerald-50">
                      {preset.name}
                    </h4>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-emerald-100/75">
                      {preset.description}
                    </p>
                  </div>

                  {/* Independent Live Motion Preview Button */}
                  <div className="py-1">
                    <TactileButton
                      motionPresetOverride={preset.id}
                      symbol="prism"
                      pitchSemitones={idx * 2 - 2}
                      subtitle={`Skok ${(preset.pressScale * 100).toFixed(1)}% · ${preset.stiffness} N/m`}
                      className="w-full px-4 py-3.5 text-sm min-h-[58px]"
                    >
                      Przetestuj: {preset.name.split(' ')[0]}
                    </TactileButton>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 dark:border-emerald-400/15 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => applyButtonMotionPreset(preset.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[38px] ${
                        isSelected
                          ? isDark
                            ? 'bg-emerald-400 text-emerald-950'
                            : 'bg-slate-900 text-white'
                          : 'bg-white/80 dark:bg-emerald-950/80 text-slate-800 dark:text-emerald-100 border border-slate-200/80 dark:border-emerald-400/25 hover:opacity-90'
                      }`}
                    >
                      {isSelected ? '✓ Aktywna w studiu' : 'Zastosuj w studiu'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopySnippet(preset.id, preset.codeSnippet)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-emerald-200 hover:text-slate-900 dark:hover:text-white cursor-pointer whitespace-nowrap shrink-0 min-h-[38px]"
                    >
                      {copiedId === preset.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                          <span>Skopiowano</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Kopiuj kod</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Part 2: 6 Optical Illumination & Backlight Presets */}
      {(sectionFilter === 'all' || sectionFilter === 'illumination') && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-emerald-50">
              02. Biblioteka podświetleń optycznych i światłowodów krawędziowych
            </h3>
            <span className="text-xs text-slate-500 dark:text-emerald-300/75">
              Zero rozchodzących się pierścieni kliknięcia · Płynna modulacja fotoniczna
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {BUTTON_ILLUMINATION_PRESETS.map((illum, idx) => {
              const isSelected = activeIlluminationId === illum.id;
              return (
                <div
                  key={illum.id}
                  className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-colors ${
                    isSelected
                      ? isDark
                        ? 'bg-emerald-900/45 border-emerald-300/60'
                        : 'bg-white/85 border-indigo-400/80'
                      : 'bg-white/50 dark:bg-emerald-950/35 border-slate-200/75 dark:border-emerald-400/15'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5 min-w-0 truncate">
                        <span className="font-mono tabular-nums">0{idx + 1}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{illum.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{illum.opticalTrait}</span>
                      </div>

                      <span
                        draggable
                        onDragStart={(e) =>
                          attachCatalogDragData(
                            e,
                            findCatalogItemForIlluminationPreset(illum.name)
                          )
                        }
                        onDragEnd={() => setActiveDraggedCatalogItem(null)}
                        title="Chwyć i przeciągnij na podgląd ekranu w ScreenArchitectureHub"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/80 dark:bg-emerald-900/70 border border-slate-200/80 dark:border-emerald-400/25 text-[11px] font-medium text-slate-600 dark:text-emerald-200 cursor-grab active:cursor-grabbing whitespace-nowrap shrink-0 select-none"
                      >
                        <GripVertical className="w-3 h-3" />
                        <span>Przeciągnij</span>
                      </span>
                    </div>
                    <h4 className="text-base font-semibold text-slate-900 dark:text-emerald-50">
                      {illum.name}
                    </h4>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-emerald-100/75">
                      {illum.description}
                    </p>
                  </div>

                  {/* Independent Live Illumination Preview Button */}
                  <div className="py-1">
                    <TactileButton
                      illuminationPresetOverride={illum.id}
                      glowColorOverride={illum.defaultColor}
                      symbol="spark"
                      pitchSemitones={idx + 1}
                      subtitle={`Poświata ${illum.glowSpread} px · Barwa ${illum.defaultColor}`}
                      className="w-full px-4 py-3.5 text-sm min-h-[58px]"
                    >
                      Podgląd: {illum.name.split(' (')[0]}
                    </TactileButton>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 dark:border-emerald-400/15 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyButtonIlluminationPreset(illum.id, true)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[38px] ${
                          isSelected
                            ? isDark
                              ? 'bg-emerald-400 text-emerald-950'
                              : 'bg-slate-900 text-white'
                            : 'bg-white/80 dark:bg-emerald-950/80 text-slate-800 dark:text-emerald-100 border border-slate-200/80 dark:border-emerald-400/25 hover:opacity-90'
                        }`}
                      >
                        {isSelected ? '✓ Aktywne światło' : 'Zastosuj światło'}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopySnippet(illum.id, illum.codeSnippet)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-emerald-200 hover:text-slate-900 dark:hover:text-white cursor-pointer whitespace-nowrap shrink-0 min-h-[38px]"
                    >
                      {copiedId === illum.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                          <span>Skopiowano</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Kopiuj CSS</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
