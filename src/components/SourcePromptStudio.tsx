import React, { useRef, useState } from 'react';
import {
  Check,
  Copy,
  Loader2,
  Mic,
  Square,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { hapticAudio } from '../lib/hapticAudioEngine';
import { studioApiFetch } from '../lib/offlineStudioEngines';
import { copyTextToClipboard } from '../lib/screenImagePromptGenerator';
import { TOP_5_RENDER_PRESETS } from '../types/studio';

export const SourcePromptStudio: React.FC = () => {
  const {
    palette,
    depth,
    haptic,
    synth,
    patterns,
    sourcePrompts,
    addSourcePrompt,
    removeSourcePrompt,
    applyRenderPreset,
  } = useStudio();

  const [concept, setConcept] = useState('');
  const [aiMode, setAiMode] = useState<'fast' | 'balanced' | 'deep'>('balanced');
  const [generating, setGenerating] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

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

  const copyText = async (text: string, id: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedId(id);
      hapticAudio.triggerPress(synth, haptic, patterns);
      window.setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const handleToggleMicTranscribe = async () => {
    setErrorMsg(null);
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setTranscribing(true);
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const resp = await studioApiFetch('/api/gemini/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64,
              mimeType: blob.type || 'audio/webm',
            }),
          });
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || 'Błąd transkrypcji audio.');
          if (data.text) {
            setConcept((prev) => (prev ? `${prev} ${data.text}` : data.text));
          }
        } catch (err: unknown) {
          setErrorMsg(err instanceof Error ? err.message : 'Błąd transkrypcji mikrofonu.');
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      hapticAudio.triggerPress(synth, haptic, patterns);
    } catch {
      setErrorMsg('Brak dostępu do mikrofonu w przeglądarce.');
    }
  };

  const handleGenerateSourceConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setErrorMsg(null);
    try {
      const resp = await studioApiFetch('/api/gemini/expand-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept,
          mode: aiMode,
          palette,
          material: haptic.material,
          depth,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Błąd generowania konfiguracji sorsa.');

      await addSourcePrompt(data.title, data.category, data.promptText, {
        lightingSetup: data.lightingSetup,
        opticalIor: data.opticalIor,
        recommendedHardness: data.recommendedHardness,
        recommendedReverseClutch: data.recommendedReverseClutch,
        palette,
        material: haptic.material,
        depth,
      });
      setConcept('');
      hapticAudio.triggerPress(synth, haptic, patterns, { pitchSemitones: 5 });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Wystąpił błąd generatora.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Section: 5 Ready-Made Common Renderings */}
      <section
        style={cardSurfaceStyle}
        className="p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-5"
      >
        <div>
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5">
            <span>5 Najczęstszych Renderowań</span>
            <span aria-hidden="true">·</span>
            <span>Natychmiastowe Presety Cieni, Głębi i Promptów</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-emerald-50 mt-1">
            Wzorcowe Sceny Szkła, Metalu i Światła
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
          {TOP_5_RENDER_PRESETS.map((preset) => (
            <div
              key={preset.id}
              className="p-4 rounded-2xl bg-white/55 dark:bg-emerald-950/45 border border-white/80 dark:border-emerald-400/15 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="text-[11px] text-slate-500 dark:text-emerald-300/75">
                  {preset.category}
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-emerald-50 mt-1 leading-snug">
                  {preset.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-emerald-100/75 mt-2 line-clamp-3">
                  {preset.prompt}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => applyRenderPreset(preset)}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                >
                  Zastosuj styl
                </button>
                <button
                  type="button"
                  aria-label="Kopiuj prompt"
                  onClick={() => copyText(preset.prompt, preset.id)}
                  className="p-1.5 rounded-lg bg-white/80 dark:bg-emerald-900/60 text-slate-700 dark:text-emerald-100 border border-slate-200/80 dark:border-emerald-400/20 cursor-pointer"
                >
                  {copiedId === preset.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Generator + User Library of Source Configurations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section
          style={cardSurfaceStyle}
          className="lg:col-span-5 p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-5"
        >
          <div>
            <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5">
              <span>Generator Sorsów AI</span>
              <span aria-hidden="true">·</span>
              <span>Dyktowanie Głosowe Gemini 3.5</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-emerald-50 mt-1">
              Utwórz Rozbudowaną Podpowiedź
            </h3>
          </div>

          <form onSubmit={handleGenerateSourceConfig} className="space-y-4">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/65 dark:bg-emerald-950/75">
              {(
                [
                  ['fast', 'Flash Lite (Szybki)'],
                  ['balanced', 'Gemini 3.8 Flash'],
                  ['deep', 'Carbon Thinking High'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAiMode(id)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap truncate ${
                    aiMode === id
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

            <div className="relative">
              <textarea
                rows={4}
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Opisz swój komponent lub kliknij mikrofon, aby podyktować koncepcję (np. szklany kafelek kardiologiczny ze złotą ryciną)..."
                className="w-full p-3.5 pr-12 rounded-2xl text-sm bg-white/80 dark:bg-emerald-950/70 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                aria-label={recording ? 'Zatrzymaj nagrywanie' : 'Podyktuj głosowo'}
                onClick={handleToggleMicTranscribe}
                className={`absolute top-3 right-3 p-2 rounded-xl transition-colors cursor-pointer ${
                  recording
                    ? 'bg-rose-600 text-white'
                    : 'bg-indigo-100 dark:bg-emerald-800 text-indigo-800 dark:text-emerald-100'
                }`}
              >
                {transcribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : recording ? (
                  <Square className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-600 dark:text-rose-300">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={generating}
              className="w-full py-3 px-4 rounded-2xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-sm font-medium inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generowanie promptu i JSON sorsa...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Wygeneruj i dodaj do biblioteki sorsów</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Library List (7 cols) */}
        <section
          style={cardSurfaceStyle}
          className="lg:col-span-7 p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-4"
        >
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-emerald-50">
              Biblioteka Konfiguracji Sorsów ({sourcePrompts.length})
            </h3>
            <span className="text-xs text-slate-500 dark:text-emerald-300/75">
              Kopiowanie 1-kliknięciem
            </span>
          </div>

          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {sourcePrompts.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-white/55 dark:bg-emerald-950/45 border border-slate-200/75 dark:border-emerald-400/15 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-emerald-300/75 flex items-center gap-1.5">
                      <span>{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.createdAt}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                      {item.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyText(item.promptText, `prompt-${item.id}`)}
                      className="px-2.5 py-1.5 rounded-lg bg-white/85 dark:bg-emerald-900/70 border border-slate-200 dark:border-emerald-400/20 text-[11px] font-medium text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      {copiedId === `prompt-${item.id}` ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>Prompt</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => copyText(item.sourceConfigJson, `json-${item.id}`)}
                      className="px-2.5 py-1.5 rounded-lg bg-white/85 dark:bg-emerald-900/70 border border-slate-200 dark:border-emerald-400/20 text-[11px] font-medium text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      {copiedId === `json-${item.id}` ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>JSON Sorsa</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Usuń ${item.title}`}
                      onClick={() => removeSourcePrompt(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-emerald-100/80 leading-relaxed">
                  {item.promptText}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
