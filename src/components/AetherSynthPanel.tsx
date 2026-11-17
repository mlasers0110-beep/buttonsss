import React, { useState } from 'react';
import { Check, Loader2, Save, Sliders, Trash2, Wand2 } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { hapticAudio } from '../lib/hapticAudioEngine';
import { studioApiFetch } from '../lib/offlineStudioEngines';
import { HapticSlider } from './ui/HapticSlider';
import { TactileButton } from './ui/TactileButton';

export const AetherSynthPanel: React.FC = () => {
  const {
    synth,
    updateSynth,
    haptic,
    depth,
    palette,
    patterns,
    animation,
    setAnimation,
    savedPresets,
    saveCurrentPreset,
    loadSavedPreset,
    removeSavedPreset,
  } = useStudio();

  const [presetName, setPresetName] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optError, setOptError] = useState<string | null>(null);

  const isDark = palette === 'emerald-clinic';

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveCurrentPreset(presetName || `Aether Patch ${savedPresets.length + 1}`);
    setPresetName('');
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2200);
  };

  const handleOptimizeAnimation = async () => {
    setOptimizing(true);
    setOptError(null);
    try {
      const resp = await studioApiFetch('/api/gemini/optimize-animation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ synth, haptic, depth }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Błąd optymalizacji animacji.');
      }
      setAnimation({
        stiffness: Number(data.stiffness) || 420,
        damping: Number(data.damping) || 26,
        mass: Number(data.mass) || 0.85,
        pressScale: Number(data.pressScale) || 0.96,
        rippleDurationMs: Number(data.rippleDurationMs) || 540,
        glowSpread: Number(data.glowSpread) || 32,
        holdTremorHz: Number(data.holdTremorHz) || 18,
        aiNote: data.aiNote,
      });
      hapticAudio.triggerPress(synth, haptic, patterns, { pitchSemitones: 4 });
    } catch (err: unknown) {
      setOptError(err instanceof Error ? err.message : 'Nie udało się zoptymalizować fizyki.');
    } finally {
      setOptimizing(false);
    }
  };

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left 7 Columns: Modular Button Tone Synthesizer ("Aether Mobile Studio") */}
      <section
        style={cardSurfaceStyle}
        className="lg:col-span-7 p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5">
              <span>Aether Mobile Studio</span>
              <span aria-hidden="true">·</span>
              <span>Modularny Syntezator Tonu Przycisku</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-emerald-50 mt-1">
              Architektura Brzmienia Dotyku
            </h2>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/65 dark:bg-emerald-950/75">
            {(
              [
                ['sine', 'Sinus'],
                ['triangle', 'Trójkąt'],
                ['sawtooth', 'Piła'],
                ['square', 'Kwadrat'],
              ] as [OscillatorType, string][]
            ).map(([wave, label]) => (
              <button
                key={wave}
                type="button"
                onClick={() => {
                  updateSynth({ waveform: wave });
                  hapticAudio.triggerPress({ ...synth, waveform: wave }, haptic, patterns);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  synth.waveform === wave
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

        {/* Modular Parameter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 pt-2">
          <HapticSlider
            label="Niski ton kliknięcia (<160 Hz)"
            value={Math.min(158, Math.max(36, synth.baseFrequency))}
            min={36}
            max={158}
            step={1}
            unit=" Hz"
            onChange={(v) => updateSynth({ baseFrequency: v })}
          />
          <HapticSlider
            label="Współczynnik harmoniczny FM"
            value={synth.harmonicRatio}
            min={1}
            max={4}
            step={0.05}
            unit="×"
            onChange={(v) => updateSynth({ harmonicRatio: v })}
          />
          <HapticSlider
            label="Odcięcie filtra dolnoprzepustowego"
            value={synth.filterCutoff}
            min={250}
            max={8000}
            step={25}
            unit=" Hz"
            onChange={(v) => updateSynth({ filterCutoff: v })}
          />
          <HapticSlider
            label="Rezonans filtra (Q)"
            value={synth.filterResonance}
            min={0.5}
            max={14}
            step={0.1}
            onChange={(v) => updateSynth({ filterResonance: v })}
          />
          <HapticSlider
            label="Atak obwiedni (Attack)"
            value={synth.attackMs}
            min={2}
            max={120}
            step={1}
            unit=" ms"
            onChange={(v) => updateSynth({ attackMs: v })}
          />
          <HapticSlider
            label="Wygaszanie (Decay)"
            value={synth.decayMs}
            min={40}
            max={650}
            step={5}
            unit=" ms"
            onChange={(v) => updateSynth({ decayMs: v })}
          />
          <HapticSlider
            label="Przestrzeń pogłosu (Reverb)"
            value={Math.round(synth.reverbMix * 100)}
            min={0}
            max={85}
            step={1}
            unit="%"
            onChange={(v) => updateSynth({ reverbMix: v / 100 })}
          />
          <HapticSlider
            label="Składowa sub-basowa"
            value={Math.round(synth.subBassLevel * 100)}
            min={0}
            max={80}
            step={1}
            unit="%"
            onChange={(v) => updateSynth({ subBassLevel: v / 100 })}
          />
        </div>

        {/* 4 Tactile Audition Pads */}
        <div className="pt-3 border-t border-slate-200/70 dark:border-emerald-400/15 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-emerald-200/75">
            <span>Klawiatura odsłuchowa (przytrzymaj dłużej, aby podkręcić drgania)</span>
            <span className="font-mono tabular-nums">Auto-zapis w przeglądarce</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Ton Prymy', semi: 0, sym: 'ring' as const },
              { label: 'Tercja Wielka', semi: 4, sym: 'prism' as const },
              { label: 'Kwinta Czysta', semi: 7, sym: 'wave' as const },
              { label: 'Oktawa Kryształ', semi: 12, sym: 'spark' as const },
            ].map((pad) => (
              <TactileButton
                key={pad.label}
                symbol={pad.sym}
                pitchSemitones={pad.semi}
                className="px-4 py-3.5 text-sm"
              >
                {pad.label}
              </TactileButton>
            ))}
          </div>
        </div>
      </section>

      {/* Right 5 Columns: AI Organic Animation Optimizer + Saved Browser/Cloud Presets */}
      <div className="lg:col-span-5 space-y-6">
        <section
          style={cardSurfaceStyle}
          className="p-6 border border-white/80 dark:border-emerald-400/20 space-y-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5">
                <span>Gemini 4 Carbon</span>
                <span aria-hidden="true">·</span>
                <span>Thinking High</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-emerald-50 mt-1">
                Optymalizator Organiki Ruchu
              </h3>
            </div>
            <Sliders className="w-5 h-5 text-indigo-600 dark:text-emerald-300 shrink-0" />
          </div>

          <p className="text-sm text-slate-600 dark:text-emerald-100/80 leading-relaxed">
            Model analizuje obwiednię niskiego tonu (&lt;160 Hz), twardość materiału oraz siłę sprzęgła odwrotnego, dobierając sztywność sprężyny i poświatę grawerunku.
          </p>

          <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-200/70 dark:border-emerald-400/15 text-center">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-emerald-300/75">Sztywność</div>
              <div className="text-base font-mono tabular-nums font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                {animation.stiffness}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-emerald-300/75">Tłumienie</div>
              <div className="text-base font-mono tabular-nums font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                {animation.damping}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-emerald-300/75">Poświata</div>
              <div className="text-base font-mono tabular-nums font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                {animation.glowSpread} px
              </div>
            </div>
          </div>

          {animation.aiNote && (
            <p className="text-xs text-slate-600 dark:text-emerald-200/85 leading-relaxed">
              {animation.aiNote}
            </p>
          )}

          {optError && (
            <p className="text-xs text-rose-600 dark:text-rose-300">{optError}</p>
          )}

          <button
            type="button"
            disabled={optimizing}
            onClick={handleOptimizeAnimation}
            className="w-full py-3 px-4 rounded-2xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-sm font-medium flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            {optimizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Kalibracja fizyki z Gemini 4 Carbon...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Zoptymalizuj animacje pod aktualny dźwięk</span>
              </>
            )}
          </button>
        </section>

        {/* Browser & Cloud Preset Bank */}
        <section
          style={cardSurfaceStyle}
          className="p-6 border border-white/80 dark:border-emerald-400/20 space-y-4"
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-emerald-50">
            Bank Brzmień Aether (Pamięć + Chmura)
          </h3>

          <form onSubmit={handleSavePreset} className="flex items-center gap-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Nazwa własnego ustawienia..."
              className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl text-sm bg-white/80 dark:bg-emerald-950/70 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-indigo-600 dark:bg-emerald-500 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-95 cursor-pointer whitespace-nowrap shrink-0"
            >
              {savedNotice ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{savedNotice ? 'Zapisano' : 'Zapisz'}</span>
            </button>
          </form>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {savedPresets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-white/55 dark:bg-emerald-950/45 border border-slate-200/70 dark:border-emerald-400/15"
              >
                <button
                  type="button"
                  onClick={() => loadSavedPreset(preset)}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <div className="text-sm font-medium text-slate-900 dark:text-emerald-50 truncate">
                    {preset.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-emerald-300/75 font-mono tabular-nums">
                    {preset.synth.baseFrequency} Hz · {preset.materialType}
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={`Usuń preset ${preset.name}`}
                  onClick={() => removeSavedPreset(preset.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
