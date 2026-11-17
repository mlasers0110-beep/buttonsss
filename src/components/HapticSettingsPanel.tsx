import React, { useState } from 'react';
import {
  Activity,
  Check,
  Download,
  FileAudio,
  FileJson,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { hapticAudio } from '../lib/hapticAudioEngine';
import {
  exportHapticWaveformAndParams,
  HapticExportFormat,
  HapticWaveformExportResult,
} from '../lib/hapticWaveformExporter';
import {
  EngravingSymbol,
  HapticMaterialType,
  MATERIAL_PROFILES,
} from '../types/studio';
import { HapticSlider } from './ui/HapticSlider';
import { TactileButton } from './ui/TactileButton';
import { EngravingGlyph } from './ui/EngravingGlyph';
import { RotaryDriverCalibrationService } from './RotaryDriverCalibrationService';
import { HapticOscilloscopePanel } from './HapticOscilloscopePanel';
import { MinimalistLowClicksLibrary } from './MinimalistLowClicksLibrary';

export const HapticSettingsPanel: React.FC = () => {
  const {
    haptic,
    updateHaptic,
    selectMaterialProfile,
    engraving,
    updateEngraving,
    synth,
    depth,
    palette,
    patterns,
    importCustomPattern,
    removeCustomPattern,
    selectedGroups,
    toggleGroupSelection,
    unifySelectedGroupsNow,
    driverCalibration,
  } = useStudio();

  const [patternName, setPatternName] = useState('');
  const [patternRawInput, setPatternRawInput] = useState(
    '{"name": "Podwójny Impuls Szklany", "pulses": [16, 18, 36, 14, 58]}'
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [calibrationSliderVal, setCalibrationSliderVal] = useState(64);
  const [exportBusyFormat, setExportBusyFormat] = useState<HapticExportFormat | null>(null);
  const [panelExportStatus, setPanelExportStatus] = useState<HapticWaveformExportResult | null>(
    null
  );

  const isDark = palette === 'emerald-clinic';

  const cardSurfaceStyle: React.CSSProperties = {
    borderRadius: `${depth.borderRadius}px`,
    backdropFilter: `blur(${depth.glassBlur}px)`,
    backgroundColor: isDark
      ? `rgba(11, 34, 29, ${depth.glassOpacity})`
      : `rgba(255, 255, 255, ${depth.glassOpacity})`,
    boxShadow: isDark
      ? `0 ${depth.elevation}px ${depth.blur}px rgba(0,0,0,0.45)`
      : `0 ${depth.elevation}px ${depth.blur}px rgba(88, 76, 148, 0.12)`,
  };

  const handleImportPattern = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    setImportSuccess(null);

    const trimmed = patternRawInput.trim();
    if (!trimmed) {
      setImportError('Wklej tablicę impulsów lub obiekt JSON.');
      return;
    }

    let extractedName = patternName.trim();
    let pulses: number[] = [];

    try {
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          pulses = parsed.map(Number);
        } else if (parsed && Array.isArray(parsed.pulses)) {
          pulses = parsed.pulses.map(Number);
          if (!extractedName && typeof parsed.name === 'string') {
            extractedName = parsed.name;
          }
        } else if (
          parsed?.hapticParameters &&
          Array.isArray(parsed.hapticParameters.effectivePulsesMs)
        ) {
          pulses = parsed.hapticParameters.effectivePulsesMs.map(Number);
          if (!extractedName && typeof parsed.hapticParameters.activePatternName === 'string') {
            extractedName = parsed.hapticParameters.activePatternName;
          }
        }
      } else {
        pulses = trimmed
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map(Number);
      }
    } catch {
      setImportError(
        'Nieprawidłowy format JSON. Użyj np. [18, 24, 42] lub {"name":"Mój Wzorzec","pulses":[18,24,42]}.'
      );
      return;
    }

    const validPulses = pulses.filter((n) => Number.isFinite(n) && n > 0);
    if (validPulses.length === 0) {
      setImportError('Podaj przynajmniej jedną dodatnią wartość czasu trwania w milisekundach.');
      return;
    }

    const finalName = extractedName || `Wzorzec użytkownika #${patterns.length + 1}`;
    await importCustomPattern(finalName, validPulses);
    setPatternName('');
    setImportSuccess(`Zaimportowano i aktywowano wzorzec „${finalName}”.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPatternRawInput(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleExportWaveAndParams = async (format: HapticExportFormat) => {
    setExportBusyFormat(format);
    try {
      const res = await exportHapticWaveformAndParams(format, {
        synth,
        haptic,
        patterns,
        engraving,
        driverCalibration,
        scope: 'pattern-sequence',
      });
      setPanelExportStatus(res);
    } finally {
      setExportBusyFormat(null);
    }
  };

  const effectivePreviewPulses = hapticAudio.computeEffectivePulses(haptic, patterns);

  return (
    <div className="space-y-8">
      {/* Real-Time Haptic Oscilloscope (Frequency & Amplitude Waveform per Material: Glass, Metal, Plastic, Suede) */}
      <HapticOscilloscopePanel />

      {/* Curated Minimalist Short Low-Frequency Clicks Library (<160 Hz, 4–14 ms) */}
      <MinimalistLowClicksLibrary />

      {/* Dedicated Rotary Controller Click & Haptic Calibration Service */}
      <RotaryDriverCalibrationService />

      {/* Top Row: Core Intensity/Duration/Physics + 4 Material Profiles */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left 6 Columns: Intensity, Duration, Material Hardness & Reverse Clutch */}
        <section
          style={cardSurfaceStyle}
          className="lg:col-span-6 p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 flex flex-col justify-between space-y-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5">
                <span>Ustawienia Główne Haptyki</span>
                <span aria-hidden="true">·</span>
                <span>Globalna Odpowiedź Elementów</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-emerald-50 mt-1">
                Kalibracja Siły, Czasu i Sprzęgła
              </h2>
            </div>

            <button
              type="button"
              onClick={() => updateHaptic({ enabled: !haptic.enabled })}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                haptic.enabled
                  ? 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950'
                  : 'bg-slate-200 text-slate-600 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              {haptic.enabled ? 'Haptyka Aktywna' : 'Wyciszona'}
            </button>
          </div>

          <div className="space-y-5">
            <HapticSlider
              label="Intensywność odpowiedzi haptycznej (Intensity)"
              value={haptic.intensity}
              min={0}
              max={100}
              step={1}
              unit="%"
              description="Skaluje amplitudę wibracji oraz transjent akustyczny wszystkich przycisków, suwaków i pokręteł."
              onChange={(v) => updateHaptic({ intensity: v })}
            />

            <HapticSlider
              label="Czas trwania impulsu (Duration)"
              value={haptic.durationMs}
              min={8}
              max={260}
              step={2}
              unit=" ms"
              description="Reguluje długość bazowego impulsu dotykowego przy naciśnięciu i przesuwaniu suwaków."
              onChange={(v) => updateHaptic({ durationMs: v })}
            />

            <HapticSlider
              label="Twardość materiału (Material Hardness)"
              value={haptic.materialHardness}
              min={0}
              max={100}
              step={1}
              unit=" Shore"
              description="Wpływa na ostrość kliknięcia, liczbę zapadek na suwakach oraz sztywność animacji sprężyny."
              onChange={(v) => updateHaptic({ materialHardness: v })}
            />

            <HapticSlider
              label="Siła sprzęgła odwrotnego (Reverse Clutch)"
              value={haptic.reverseClutchForce}
              min={0}
              max={100}
              step={1}
              unit="%"
              description="Definiuje opór powrotny i wyczuwalną zapadkę mechaniczną podczas puszczania przycisku lub suwaka."
              onChange={(v) => updateHaptic({ reverseClutchForce: v })}
            />

            <HapticSlider
              label="Wzmocnienie drgań przy dłuższym trzymaniu"
              value={haptic.holdRampMultiplier}
              min={1}
              max={3}
              step={0.05}
              unit="×"
              description="Standardowo podkręca intensywność wibracji i rezonansu przy przytrzymaniu dowolnego przycisku."
              onChange={(v) => updateHaptic({ holdRampMultiplier: v })}
            />
          </div>
        </section>

        {/* Right 6 Columns: 4 Tactile Material Profiles + Live Calibration Bench */}
        <section
          style={cardSurfaceStyle}
          className="lg:col-span-6 p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 flex flex-col justify-between space-y-6"
        >
          <div>
            <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5">
              <span>Profile Materiałowe</span>
              <span aria-hidden="true">·</span>
              <span>Szkło · Metal · Plastik · Zamsz</span>
            </div>
            <h3 className="text-2xl font-semibold text-slate-900 dark:text-emerald-50 mt-1">
              Wybór Wrażenia Dotykowego
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-5">
              {(Object.keys(MATERIAL_PROFILES) as HapticMaterialType[]).map((matKey) => {
                const spec = MATERIAL_PROFILES[matKey];
                const isSelected = haptic.material === matKey;
                return (
                  <button
                    key={matKey}
                    type="button"
                    onClick={() => selectMaterialProfile(matKey)}
                    className={`p-4 rounded-2xl text-left border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? isDark
                          ? 'bg-emerald-900/75 border-emerald-300/70 ring-1 ring-emerald-300/50'
                          : 'bg-white/90 border-indigo-500 ring-1 ring-indigo-500/40 shadow-md'
                        : 'bg-white/45 dark:bg-emerald-950/40 border-white/70 dark:border-emerald-400/15 hover:bg-white/70 dark:hover:bg-emerald-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
                        {spec.label}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-emerald-300/80">
                        {spec.defaultHardness} Sh
                      </span>
                    </div>
                    <div className="text-[11px] text-indigo-600 dark:text-emerald-300 font-medium mt-0.5">
                      {spec.englishLabel}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-emerald-100/75 mt-2 leading-snug">
                      {spec.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Haptic Calibration Test Bench (Buttons + Slider) */}
          <div className="pt-5 border-t border-slate-200/70 dark:border-emerald-400/15 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
                Stół Testowy Haptyki (Przyciski i Suwak)
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-emerald-300/80">
                Impulsy: [{effectivePreviewPulses.join(', ')}] ms
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TactileButton
                variant="crystal-pill"
                symbol="prism"
                className="px-4 py-3 text-sm"
              >
                Testuj Klik & Przytrzymanie
              </TactileButton>
              <TactileButton
                variant="primary-cta"
                symbol="spark"
                pitchSemitones={5}
                className="px-4 py-3 text-sm"
              >
                Testuj Sprzęgło Zwrotne
              </TactileButton>
            </div>

            <HapticSlider
              label="Suwak kalibracyjny zapadek haptycznych"
              value={calibrationSliderVal}
              min={0}
              max={100}
              step={1}
              unit=" pkt"
              onChange={setCalibrationSliderVal}
            />
          </div>
        </section>
      </div>

      {/* Second Row: Custom Haptic Pattern Importer + Engravings/Backlight & Button Group Unifier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Custom Haptic Pattern Importer (7 cols) */}
        <section
          style={cardSurfaceStyle}
          className="lg:col-span-7 p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5">
                <span>Zaawansowana Haptyka</span>
                <span aria-hidden="true">·</span>
                <span>Import i Edycja Wzorców</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-emerald-50 mt-1">
                Biblioteka i Importer Własnych Wzorców
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="min-h-[38px] px-3 py-2 rounded-xl bg-white/75 dark:bg-emerald-950/75 border border-slate-200 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 whitespace-nowrap shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>Wczytaj plik .json</span>
                <input
                  type="file"
                  accept=".json,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                disabled={exportBusyFormat !== null}
                onClick={() => handleExportWaveAndParams('wav')}
                className="min-h-[38px] px-3 py-2 rounded-xl bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <FileAudio className="w-3.5 h-3.5" />
                <span>
                  {exportBusyFormat === 'wav' ? 'Zapisywanie WAV...' : 'Eksportuj WAV'}
                </span>
              </button>
              <button
                type="button"
                disabled={exportBusyFormat !== null}
                onClick={() => handleExportWaveAndParams('json')}
                className="min-h-[38px] px-3 py-2 rounded-xl bg-white/75 dark:bg-emerald-950/75 border border-slate-200 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {exportBusyFormat === 'json' ? 'Zapisywanie JSON...' : 'Eksportuj JSON'}
                </span>
              </button>
            </div>
          </div>

          {panelExportStatus && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Pobrano: {panelExportStatus.filename}</span>
              </span>
              <span className="text-slate-500 dark:text-emerald-200/80">
                {(panelExportStatus.sizeBytes / 1024).toFixed(1)} KB · {panelExportStatus.durationMs}{' '}
                ms · {Math.round(panelExportStatus.sampleRate / 1000)} kHz
              </span>
            </div>
          )}

          {/* Selectable Active Pattern Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {patterns.map((pat) => {
              const isActive = haptic.activePatternId === pat.id;
              return (
                <div
                  key={pat.id}
                  className={`p-3.5 rounded-2xl border transition-colors flex flex-col justify-between gap-2.5 ${
                    isActive
                      ? isDark
                        ? 'bg-emerald-900/70 border-emerald-300/60'
                        : 'bg-white/90 border-indigo-500 shadow-sm'
                      : 'bg-white/45 dark:bg-emerald-950/40 border-white/70 dark:border-emerald-400/15'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateHaptic({ activePatternId: pat.id });
                        hapticAudio.triggerPress(
                          synth,
                          { ...haptic, activePatternId: pat.id },
                          patterns
                        );
                      }}
                      className="text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="text-sm font-semibold text-slate-900 dark:text-emerald-50 truncate">
                        {pat.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-emerald-200/70 line-clamp-1 mt-0.5">
                        {pat.description}
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label={`Testuj wzorzec ${pat.name}`}
                        onClick={() => {
                          const eff = hapticAudio.computeEffectivePulses(
                            { ...haptic, activePatternId: pat.id },
                            patterns
                          );
                          hapticAudio.triggerVibrate(eff);
                          hapticAudio.triggerPress(
                            synth,
                            { ...haptic, activePatternId: pat.id },
                            patterns
                          );
                        }}
                        className="p-1.5 rounded-lg bg-indigo-50 dark:bg-emerald-800/60 text-indigo-700 dark:text-emerald-200 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      {pat.isCustom && (
                        <button
                          type="button"
                          aria-label={`Usuń wzorzec ${pat.name}`}
                          onClick={() => removeCustomPattern(pat.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Visual Pulse Envelope Bars */}
                  <div className="flex items-end gap-1 h-6 pt-1">
                    {pat.pulses.map((ms, idx) => (
                      <div
                        key={`${pat.id}-${idx}`}
                        style={{
                          height: `${Math.max(22, Math.min(100, (ms / 80) * 100))}%`,
                          width: `${Math.max(8, Math.min(36, ms * 0.6))}px`,
                        }}
                        className={`rounded-sm ${
                          idx % 2 === 0
                            ? 'bg-indigo-500 dark:bg-emerald-400'
                            : 'bg-slate-300/60 dark:bg-emerald-800/40'
                        }`}
                        title={`${idx % 2 === 0 ? 'Wibracja' : 'Przerwa'}: ${ms} ms`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom Pattern Form */}
          <form
            onSubmit={handleImportPattern}
            className="pt-4 border-t border-slate-200/70 dark:border-emerald-400/15 space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-emerald-200">
              <FileJson className="w-4 h-4 text-indigo-600 dark:text-emerald-300" />
              <span>Wklej własną sekwencję ms (np. 14, 18, 36, 12, 64) lub obiekt JSON</span>
            </div>

            <input
              type="text"
              value={patternName}
              onChange={(e) => setPatternName(e.target.value)}
              placeholder="Opcjonalna nazwa wzorca..."
              className="w-full px-3.5 py-2 rounded-xl text-sm bg-white/80 dark:bg-emerald-950/70 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <textarea
              rows={3}
              value={patternRawInput}
              onChange={(e) => setPatternRawInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono bg-white/80 dark:bg-emerald-950/70 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {importError && (
              <p className="text-xs text-rose-600 dark:text-rose-300">{importError}</p>
            )}
            {importSuccess && (
              <p className="text-xs text-emerald-700 dark:text-emerald-300">{importSuccess}</p>
            )}

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-2 hover:opacity-95 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Importuj i zastosuj globalnie</span>
            </button>
          </form>
        </section>

        {/* Engravings, Subsurface Backlight & Button Group Unifier (5 cols) */}
        <section
          style={cardSurfaceStyle}
          className="lg:col-span-5 p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-6"
        >
          <div>
            <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5">
              <span>Ryciny & Grupy Przycisków</span>
              <span aria-hidden="true">·</span>
              <span>Podświetlenie Podpowierzchniowe</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-emerald-50 mt-1">
              Symbole, Ryciny i Unifikacja Grup
            </h3>
          </div>

          {/* Symbol Picker */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-700 dark:text-emerald-200">
              Wybierz rycinę na przyciskach
            </span>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ['vascular', 'Naczynia'],
                  ['droplet', 'Kropla'],
                  ['wave', 'Fala'],
                  ['spark', 'Impuls'],
                  ['prism', 'Pryzmat'],
                  ['ring', 'Soczewka'],
                  ['compass', 'Kompas'],
                  ['none', 'Brak'],
                ] as [EngravingSymbol, string][]
              ).map(([sym, label]) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => {
                    updateEngraving({ symbol: sym });
                  }}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-[11px] font-medium cursor-pointer transition-colors ${
                    engraving.symbol === sym
                      ? isDark
                        ? 'bg-emerald-800/80 border-emerald-300 text-emerald-50'
                        : 'bg-indigo-50 border-indigo-500 text-indigo-950'
                      : 'bg-white/50 dark:bg-emerald-950/40 border-slate-200/70 dark:border-emerald-400/15 text-slate-600 dark:text-emerald-200/80'
                  }`}
                >
                  {sym !== 'none' ? (
                    <EngravingGlyph
                      symbol={sym}
                      size={18}
                      glowEnabled={engraving.glowEnabled}
                      glowColor={engraving.glowColor}
                      glowIntensity={engraving.glowIntensity}
                      etchDepth={engraving.etchDepth}
                    />
                  ) : (
                    <Activity className="w-4 h-4 opacity-35" />
                  )}
                  <span className="truncate max-w-full">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Backlight Color & Sliders */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-700 dark:text-emerald-200">
                Kolor i aktywacja podświetlenia ryciny
              </span>
              <div className="flex items-center gap-2">
                {['#8B7CFF', '#38BDF8', '#74BFA1', '#F472B6', '#F59E0B'].map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Kolor podświetlenia ${hex}`}
                    onClick={() => updateEngraving({ glowColor: hex, glowEnabled: true })}
                    style={{ backgroundColor: hex }}
                    className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                      engraving.glowColor === hex
                        ? 'border-slate-900 dark:border-white scale-110'
                        : 'border-white/80'
                    }`}
                  />
                ))}
              </div>
            </div>

            <HapticSlider
              label="Intensywność podświetlenia ryciny"
              value={engraving.glowIntensity}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(v) => updateEngraving({ glowIntensity: v, glowEnabled: v > 0 })}
            />

            <HapticSlider
              label="Głębokość grawerunku linii"
              value={engraving.etchDepth}
              min={10}
              max={100}
              step={1}
              unit="%"
              onChange={(v) => updateEngraving({ etchDepth: v })}
            />
          </div>

          {/* Button Group Unification Selector */}
          <div className="pt-4 border-t border-slate-200/70 dark:border-emerald-400/15 space-y-3">
            <div className="text-xs font-medium text-slate-700 dark:text-emerald-200">
              Zaznacz grupy przycisków do ujednolicenia reakcji:
            </div>
            <div className="space-y-2">
              {(
                [
                  ['group-primary', 'Grupa A · Nawigacja i przycisk „Dalej”'],
                  ['group-diagnostic', 'Grupa B · Kafelki diagnostyczne i cele'],
                  ['group-audio', 'Grupa C · Transport odtwarzacza audio'],
                ] as const
              ).map(([gid, title]) => {
                const checked = selectedGroups.includes(gid);
                return (
                  <button
                    key={gid}
                    type="button"
                    onClick={() => {
                      toggleGroupSelection(gid);
                      hapticAudio.triggerPress(synth, haptic, patterns);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl border flex items-center justify-between text-xs font-medium cursor-pointer transition-colors ${
                      checked
                        ? isDark
                          ? 'bg-emerald-900/70 border-emerald-300/60 text-emerald-50'
                          : 'bg-indigo-50/90 border-indigo-400 text-slate-900'
                        : 'bg-white/45 dark:bg-emerald-950/35 border-slate-200/70 dark:border-emerald-400/15 text-slate-600 dark:text-emerald-200/75'
                    }`}
                  >
                    <span>{title}</span>
                    <span className="font-mono">{checked ? 'ZAZNACZONA' : 'NIEZALEŻNA'}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={unifySelectedGroupsNow}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              <span>Zastosuj materiał i ton do zaznaczonych grup</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
