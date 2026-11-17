import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileImage,
  GitBranch,
  ImagePlus,
  Loader2,
  PlugZap,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  DEFAULT_ZONE_SHADES,
  FRONTEND_ELEMENT_SHADES,
} from '../lib/frontendElementShades';
import { hapticAudio } from '../lib/hapticAudioEngine';
import { copyTextToClipboard } from '../lib/screenImagePromptGenerator';
import {
  PROTOTYPE_ZONE_LABELS,
  resolvePrototypeWidgetsForNode,
} from '../lib/tactileUiCatalog';
import {
  MATERIAL_PROFILES,
  PromptGraphicRole,
  PrototypeDropZone,
} from '../types/studio';

const ROLE_LABELS: Record<PromptGraphicRole, string> = {
  'uklad-ekranu': 'Układ ekranu',
  'styl-materialu': 'Styl materiału',
  'szkic-komponentu': 'Szkic komponentu',
  'zasob-graficzny': 'Zasób graficzny',
};

export function useCompiledStudioMasterPrompt(options: {
  includeScreenContext: boolean;
  includeVisualTokens: boolean;
  includeHapticAudio: boolean;
  includeBuildMatrix: boolean;
  targetZone: PrototypeDropZone;
}): string {
  const {
    palette,
    depth,
    engraving,
    synth,
    haptic,
    activeScreenMap,
    activePreviewScreenId,
    masterPromptDraft,
    attachedPromptGraphics,
    activeBuildMatrix,
    externalPlugins,
    workingFrontendImage,
  } = useStudio();

  return useMemo(() => {
    const activeScreen =
      activeScreenMap.nodes.find((n) => n.id === activePreviewScreenId) ||
      activeScreenMap.nodes[0];
    const widgets = activeScreen ? resolvePrototypeWidgetsForNode(activeScreen) : [];
    const matProfile =
      MATERIAL_PROFILES[haptic.material] || MATERIAL_PROFILES['frosted-glass'];

    const sections: string[] = [];
    sections.push(
      `CEL PROJEKTOWY ELEMENTU:\n${masterPromptDraft.trim() || 'Zaprojektuj kompletny, responsywny moduł interfejsu frontendowego.'}`
    );

    if (options.includeScreenContext && activeScreen) {
      const widgetList = widgets
        .map((w) => `- [${w.zone}] ${w.label} (${w.category})`)
        .join('\n');
      sections.push(
        `KONTEKST PROJEKTOWANEGO EKRANU FRONTENDU:\n- Projekt: ${activeScreenMap.name}\n- Aktywny ekran: ${activeScreen.title} (ścieżka: ${activeScreen.route}, rola: ${activeScreen.role})\n- Strefa osadzenia nowego elementu: ${PROTOTYPE_ZONE_LABELS[options.targetZone]} (${options.targetZone})\n- Opis ekranu: ${activeScreen.summary}\n- Obecne komponenty ekranu (${widgets.length}):\n${widgetList || '- Brak przypisanych widżetów'}`
      );
    }

    if (workingFrontendImage) {
      sections.push(
        `WGRANY OBRAZ PROJEKTOWANEGO FRONTENDU:\n- Plik: ${workingFrontendImage.fileName} (${workingFrontendImage.widthPx}×${workingFrontendImage.heightPx} px)\n- Zmapowane strefy odcieni: ${workingFrontendImage.regions.map((r) => `${r.label} [${r.zone}]`).join(', ')}`
      );
    }

    if (options.includeVisualTokens) {
      sections.push(
        `SYSTEM WIZUALNY, SZKŁO I GŁĘBIA:\n- Paleta: ${palette}\n- Promień zaokrąglenia: ${depth.borderRadius}px, rozmycie szkła: ${depth.glassBlur}px, krycie: ${depth.glassOpacity}\n- Cień uniesienia: ${depth.elevation}px (rozmycie cienia ${depth.blur}px)\n- Podświetlenie grawerunku: ${engraving.glowEnabled ? `${engraving.glowColor} (${engraving.glowIntensity}%)` : 'Wyłączone'}`
      );
    }

    if (options.includeHapticAudio) {
      sections.push(
        `PROFIL HAPTYCZNY I AKUSTYCZNY (<160 Hz):\n- Materiał powierzchni: ${matProfile.label} (${haptic.materialHardness} Shore)\n- Częstotliwość bazowa syntezatora: ${Math.min(158, synth.baseFrequency)} Hz (${synth.waveform}, zanikanie ${synth.decayMs} ms)\n- Sprzęgło zwrotne przy puszczeniu: ${haptic.reverseClutchForce}%`
      );
    }

    if (options.includeBuildMatrix && activeBuildMatrix) {
      sections.push(
        `MATRYCA PROJEKTOWA Z PLIKU (${activeBuildMatrix.projectTitle}):\n- Architektura układu: ${activeBuildMatrix.designTokens.layoutArchitecture}\n- Rekomendowany stos: ${activeBuildMatrix.designTokens.stackRecommendation}`
      );
    }

    const activePlugins = externalPlugins.filter((p) => p.enabled);
    if (activePlugins.length > 0) {
      sections.push(
        `AKTYWNE WTYCZKI DO INNYCH APLIKACJI (${activePlugins.length}):\n${activePlugins.map((p) => `- ${p.targetAppName}: ${p.pluginTitle} (${p.integrationKind})`).join('\n')}`
      );
    }

    if (attachedPromptGraphics.length > 0) {
      const gfxLines = attachedPromptGraphics
        .map(
          (g, idx) =>
            `${idx + 1}. ${g.name} — rola: ${ROLE_LABELS[g.role]} (${g.mimeType})`
        )
        .join('\n');
      sections.push(
        `ZAŁĄCZONE GRAFIKI REFERENCYJNE (${attachedPromptGraphics.length}):\n${gfxLines}`
      );
    }

    sections.push(
      `WYMAGANIA TECHNICZNE KODU:\n- React 19 + TypeScript + Tailwind CSS (pełna obsługa jasnego i ciemnego motywu dark:*)\n- Czytelna typografia z tabular-nums dla wszystkich wartości liczbowych\n- Dostępne etykiety ARIA i natychmiastowa reakcja dotykowa`
    );

    return sections.join('\n\n');
  }, [
    activeScreenMap,
    activePreviewScreenId,
    masterPromptDraft,
    options.includeScreenContext,
    options.includeVisualTokens,
    options.includeHapticAudio,
    options.includeBuildMatrix,
    options.targetZone,
    palette,
    depth,
    engraving,
    synth,
    haptic,
    activeBuildMatrix,
    externalPlugins,
    workingFrontendImage,
    attachedPromptGraphics,
  ]);
}

export const PersistentMasterPromptWindow: React.FC<{
  targetZone: PrototypeDropZone;
  onChangeTargetZone: (zone: PrototypeDropZone) => void;
  includeScreenContext: boolean;
  onToggleScreenContext: () => void;
  includeVisualTokens: boolean;
  onToggleVisualTokens: () => void;
  includeHapticAudio: boolean;
  onToggleHapticAudio: () => void;
  includeBuildMatrix: boolean;
  onToggleBuildMatrix: () => void;
  compiledMasterPrompt: string;
}> = ({
  targetZone,
  onChangeTargetZone,
  includeScreenContext,
  onToggleScreenContext,
  includeVisualTokens,
  onToggleVisualTokens,
  includeHapticAudio,
  onToggleHapticAudio,
  includeBuildMatrix,
  onToggleBuildMatrix,
  compiledMasterPrompt,
}) => {
  const {
    palette,
    depth,
    synth,
    haptic,
    patterns,
    activeScreenMap,
    activePreviewScreenId,
    setActivePreviewScreenId,
    masterPromptDraft,
    setMasterPromptDraft,
    attachedPromptGraphics,
    addAttachedPromptGraphic,
    removeAttachedPromptGraphic,
    updateAttachedPromptGraphicRole,
    clearAttachedPromptGraphics,
    mediaLibrary,
    generatedElements,
    generateCompleteUiElement,
    setGitHubExportModalOpen,
    externalPlugins,
    setPluginsModalOpen,
    markElementAsActivelyModified,
  } = useStudio();

  const [generating, setGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCompiledPreview, setShowCompiledPreview] = useState<boolean>(false);
  const [showMediaPicker, setShowMediaPicker] = useState<boolean>(false);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [lastCreatedInfo, setLastCreatedInfo] = useState<string | null>(null);
  const [brokenThumbIds, setBrokenThumbIds] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDark = palette === 'emerald-clinic';

  const cardSurfaceStyle: React.CSSProperties = {
    borderRadius: `${Math.min(28, depth.borderRadius)}px`,
    backdropFilter: `blur(${depth.glassBlur}px)`,
    backgroundColor: isDark
      ? `rgba(11, 34, 29, ${Math.max(0.75, depth.glassOpacity)})`
      : `rgba(255, 255, 255, ${Math.max(0.78, depth.glassOpacity)})`,
    boxShadow: isDark
      ? `0 ${Math.round(depth.elevation * 0.7)}px ${depth.blur}px rgba(0,0,0,0.42)`
      : `0 ${Math.round(depth.elevation * 0.7)}px ${depth.blur}px rgba(88, 76, 148, 0.12)`,
  };

  const readFilesAsAttachments = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList).slice(0, 6);
    for (const file of arr) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      if (dataUrl) {
        addAttachedPromptGraphic({
          name: file.name,
          mimeType: file.type || 'image/png',
          dataUrl,
          role: 'uklad-ekranu',
        });
      }
    }
  };

  const handlePasteImages = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) files.push(blob);
      }
    }
    if (files.length > 0) {
      await readFilesAsAttachments(files);
    }
  };

  const handleCopyFullPrompt = async () => {
    const ok = await copyTextToClipboard(compiledMasterPrompt);
    if (ok) {
      setCopiedPrompt(true);
      hapticAudio.triggerPress(synth, haptic, patterns, { pitchSemitones: 3 });
      window.setTimeout(() => setCopiedPrompt(false), 1800);
    }
  };

  const handleGenerateElement = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLastCreatedInfo(null);
    setGenerating(true);
    try {
      const created = await generateCompleteUiElement({
        compiledPrompt: compiledMasterPrompt,
        userBrief: masterPromptDraft,
        targetScreenId: activePreviewScreenId,
        targetZone,
      });
      setLastCreatedInfo(
        `Osadzono „${created.name}” (${created.fileName}) w strefie ${PROTOTYPE_ZONE_LABELS[targetZone]}.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Wystąpił błąd podczas generowania kompletnego elementu.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const imageMediaItems = useMemo(
    () => mediaLibrary.filter((m) => m.mediaType === 'image' && m.src),
    [mediaLibrary]
  );

  return (
    <section
      style={cardSurfaceStyle}
      className="p-5 border border-white/80 dark:border-emerald-400/20 space-y-4"
    >
      {/* Header + Prominent GitHub Export Button */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
            <span>Stałe Okno Kompletnego Promptu</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Załączone grafiki: {attachedPromptGraphics.length}
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
            Kreator Elementów z Grafikami i Eksport GitHub
          </h2>
        </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setPluginsModalOpen(true)}
              className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium bg-white/90 dark:bg-emerald-900/75 border border-slate-200/85 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-50 hover:opacity-95 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <PlugZap className="w-3.5 h-3.5" />
              <span>Wtyczki ({externalPlugins.filter((p) => p.enabled).length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setGitHubExportModalOpen(true);
                hapticAudio.triggerPress(synth, haptic, patterns, { pitchSemitones: 5 });
              }}
              className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 hover:opacity-95 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Eksportuj na GitHub</span>
            </button>
          </div>
        </div>

      <form onSubmit={handleGenerateElement} className="space-y-4">
        {/* Target Screen + Zone Placement */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="space-y-1 block">
            <span className="text-[11px] font-medium text-slate-600 dark:text-emerald-200/85">
              Docelowy ekran modelu
            </span>
            <select
              value={activePreviewScreenId}
              onChange={(e) => setActivePreviewScreenId(e.target.value)}
              className="w-full h-9 px-2.5 rounded-xl text-xs bg-white/90 dark:bg-emerald-950/85 border border-slate-200/85 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 cursor-pointer"
            >
              {activeScreenMap.nodes.map((n, i) => (
                <option key={n.id} value={n.id}>
                  {i + 1}. {n.title}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] font-medium text-slate-600 dark:text-emerald-200/85">
              Strefa osadzenia elementu (podświetlana tym samym odcieniem)
            </span>
            <select
              value={targetZone}
              onChange={(e) => {
                const nextZ = e.target.value as PrototypeDropZone;
                onChangeTargetZone(nextZ);
                const zShade = DEFAULT_ZONE_SHADES[nextZ];
                markElementAsActivelyModified({
                  id: `zone-${nextZ}`,
                  kind: 'zone',
                  label: `Komponowana strefa: ${PROTOTYPE_ZONE_LABELS[nextZ]}`,
                  zone: nextZ,
                  screenId: activePreviewScreenId,
                  shadeId: zShade,
                  sourceSurface: 'Stałe Okno Promptu',
                });
              }}
              className="w-full h-9 px-2.5 rounded-xl text-xs bg-white/90 dark:bg-emerald-950/85 border border-slate-200/85 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 cursor-pointer"
            >
              {(['header', 'main', 'footer'] as const).map((z) => (
                <option key={z} value={z}>
                  {PROTOTYPE_ZONE_LABELS[z]} ({FRONTEND_ELEMENT_SHADES[DEFAULT_ZONE_SHADES[z]].shortNamePl})
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Context Fusion Switches */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-slate-600 dark:text-emerald-200/85">
            Warstwy włączone do kompletnego promptu:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                [includeScreenContext, onToggleScreenContext, 'Układ ekranu'],
                [includeVisualTokens, onToggleVisualTokens, 'Szkło i paleta'],
                [includeHapticAudio, onToggleHapticAudio, 'Haptyka <160 Hz'],
                [includeBuildMatrix, onToggleBuildMatrix, 'Matryca pliku'],
              ] as const
            ).map(([enabled, toggle, label]) => (
              <button
                key={label}
                type="button"
                onClick={toggle}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  enabled
                    ? isDark
                      ? 'bg-emerald-400 text-emerald-950 font-semibold'
                      : 'bg-slate-900 text-white font-semibold'
                    : 'bg-white/75 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/20 text-slate-600 dark:text-emerald-200/75'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Editable Prompt Specification */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <label
              htmlFor="persistent-master-prompt-input"
              className="font-medium text-slate-700 dark:text-emerald-100"
            >
              Specyfikacja projektowa elementu (obsługuje wklejanie obrazów Ctrl+V)
            </label>
            <button
              type="button"
              onClick={handleCopyFullPrompt}
              className="inline-flex items-center gap-1 text-indigo-600 dark:text-emerald-300 font-medium cursor-pointer whitespace-nowrap"
            >
              {copiedPrompt ? (
                <Check className="w-3 h-3" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>{copiedPrompt ? 'Skopiowano' : 'Kopiuj pełny prompt'}</span>
            </button>
          </div>
          <textarea
            id="persistent-master-prompt-input"
            rows={3}
            value={masterPromptDraft}
            onFocus={() => {
              const zShade = DEFAULT_ZONE_SHADES[targetZone];
              markElementAsActivelyModified({
                id: `zone-${targetZone}`,
                kind: 'zone',
                label: `Komponowana strefa: ${PROTOTYPE_ZONE_LABELS[targetZone]}`,
                zone: targetZone,
                screenId: activePreviewScreenId,
                shadeId: zShade,
                sourceSurface: 'Edycja specyfikacji w Stałym Oknie Promptu',
              });
            }}
            onChange={(e) => setMasterPromptDraft(e.target.value)}
            onPaste={handlePasteImages}
            placeholder="Opisz kompletny element UI do wygenerowania (np. karta diagnostyczna z wykresem parametrów, przełącznikiem trybu i głównym przyciskiem akcji)..."
            className="w-full p-3 rounded-2xl text-xs leading-relaxed bg-white/90 dark:bg-emerald-950/85 border border-slate-200/85 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/35"
          />
        </div>

        {/* Attached Reference Graphics Dropzone & Strip */}
        <div
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
            }
          }}
          onDrop={async (e) => {
            if (e.dataTransfer.files?.length) {
              e.preventDefault();
              await readFilesAsAttachments(e.dataTransfer.files);
            }
          }}
          className="p-3 rounded-2xl border border-dashed border-slate-300/90 dark:border-emerald-400/30 bg-white/60 dark:bg-emerald-950/45 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-700 dark:text-emerald-100">
              Załączone grafiki referencyjne ({attachedPromptGraphics.length}/8)
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  if (e.target.files?.length) {
                    await readFilesAsAttachments(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white dark:bg-emerald-900/75 border border-slate-200/85 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-50 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <ImagePlus className="w-3 h-3" />
                <span>Wgraj grafikę</span>
              </button>

              {imageMediaItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowMediaPicker((v) => !v)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white dark:bg-emerald-900/75 border border-slate-200/85 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-50 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <FileImage className="w-3 h-3" />
                  <span>Z biblioteki</span>
                </button>
              )}

              {attachedPromptGraphics.length > 0 && (
                <button
                  type="button"
                  onClick={clearAttachedPromptGraphics}
                  className="px-2 py-1 rounded-lg text-[11px] text-rose-600 dark:text-rose-300 hover:underline cursor-pointer whitespace-nowrap"
                >
                  Wyczyść
                </button>
              )}
            </div>
          </div>

          {showMediaPicker && imageMediaItems.length > 0 && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              {imageMediaItems.slice(0, 6).map((media) => (
                <button
                  key={media.id}
                  type="button"
                  onClick={() => {
                    addAttachedPromptGraphic({
                      name: `${media.title}.jpg`,
                      mimeType: 'image/jpeg',
                      dataUrl: media.src,
                      role: 'styl-materialu',
                    });
                    setShowMediaPicker(false);
                  }}
                  className="p-1.5 rounded-xl bg-white/90 dark:bg-emerald-900/60 border border-slate-200/80 dark:border-emerald-400/20 text-left hover:opacity-90 cursor-pointer space-y-1"
                >
                  <div className="h-12 rounded-lg overflow-hidden bg-slate-200 dark:bg-emerald-950 flex items-center justify-center">
                    {brokenThumbIds[media.id] ? (
                      <FileImage className="w-4 h-4 text-slate-400" />
                    ) : (
                      <img
                        src={media.src}
                        alt={media.title}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenThumbIds((p) => ({ ...p, [media.id]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="text-[10px] font-medium truncate text-slate-700 dark:text-emerald-100">
                    {media.title}
                  </div>
                </button>
              ))}
            </div>
          )}

          {attachedPromptGraphics.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {attachedPromptGraphics.map((gfx) => (
                <div
                  key={gfx.id}
                  className="p-2 rounded-xl bg-white/90 dark:bg-emerald-900/60 border border-slate-200/80 dark:border-emerald-400/20 flex items-center gap-2.5"
                >
                  <div className="h-11 w-11 rounded-lg overflow-hidden bg-slate-100 dark:bg-emerald-950 shrink-0 flex items-center justify-center">
                    {brokenThumbIds[gfx.id] ? (
                      <FileImage className="w-4 h-4 text-slate-400" />
                    ) : (
                      <img
                        src={gfx.dataUrl}
                        alt={gfx.name}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenThumbIds((p) => ({ ...p, [gfx.id]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-[11px] font-medium truncate text-slate-800 dark:text-emerald-50">
                      {gfx.name}
                    </div>
                    <select
                      aria-label={`Rola grafiki ${gfx.name}`}
                      value={gfx.role}
                      onChange={(e) =>
                        updateAttachedPromptGraphicRole(
                          gfx.id,
                          e.target.value as PromptGraphicRole
                        )
                      }
                      className="h-6 px-1.5 rounded-md text-[10px] bg-slate-100 dark:bg-emerald-950 text-slate-700 dark:text-emerald-200 border border-slate-200/70 dark:border-emerald-400/20 cursor-pointer"
                    >
                      {(Object.keys(ROLE_LABELS) as PromptGraphicRole[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachedPromptGraphic(gfx.id)}
                    aria-label={`Usuń grafikę ${gfx.name}`}
                    className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 dark:text-emerald-300/70">
              Upuść tutaj szkice UI, makiety lub tekstury referencyjne (PNG, JPG, WEBP), aby uwzględnić je przy generowaniu kompletnego elementu.
            </p>
          )}
        </div>

        {/* Collapsible Live Compiled Master Prompt Inspector */}
        <div className="rounded-xl border border-slate-200/75 dark:border-emerald-400/20 bg-white/65 dark:bg-emerald-950/55 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCompiledPreview((v) => !v)}
            className="w-full px-3 py-2 flex items-center justify-between text-[11px] font-medium text-slate-700 dark:text-emerald-100 cursor-pointer"
          >
            <span>
              Podgląd skompilowanego kompletnego promptu ({compiledMasterPrompt.length} zn.)
            </span>
            {showCompiledPreview ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {showCompiledPreview && (
            <pre className="px-3 pb-3 text-[11px] font-mono whitespace-pre-wrap text-slate-600 dark:text-emerald-200/85 max-h-44 overflow-y-auto leading-relaxed">
              {compiledMasterPrompt}
            </pre>
          )}
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/55 border border-rose-200 dark:border-rose-400/30 text-xs text-rose-700 dark:text-rose-200">
            {errorMsg}
          </div>
        )}

        {lastCreatedInfo && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/45 border border-emerald-200 dark:border-emerald-400/30 text-xs text-emerald-900 dark:text-emerald-100">
            {lastCreatedInfo}
          </div>
        )}

        {/* Primary Generate Complete Element + GitHub Repo Export Action Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="submit"
            disabled={generating}
            className="flex-1 min-h-[42px] px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 hover:opacity-95 inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generowanie kompletnego elementu...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Generuj Kompletny Element UI</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setGitHubExportModalOpen(true)}
            className="min-h-[42px] px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white/90 dark:bg-emerald-900/75 border border-slate-200/85 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 hover:opacity-95 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Repozytorium GitHub ({generatedElements.length})</span>
          </button>
        </div>
      </form>
    </section>
  );
};
