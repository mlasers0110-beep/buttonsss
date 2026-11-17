import React, { useEffect, useRef, useState } from 'react';
import { FileCode2, FileJson } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { hapticAudio } from '../lib/hapticAudioEngine';
import {
  downloadLocalArchitectureFile,
  serializeScreenMapToJson,
  serializeScreenMapToMermaid,
  slugifyExportName,
} from '../lib/screenMapExport';
import {
  DEFAULT_AETHER_SCREEN_MAP,
  SCREEN_TRANSITION_PRESETS,
  StudioLiveTabId,
} from '../types/studio';
import { AllDesignedScreensGallery } from './AllDesignedScreensGallery';
import { ScreenMapPlanner } from './ScreenMapPlanner';
import { GitHubAppMapDesigner } from './GitHubAppMapDesigner';
import { ScreenTransitionsLibrary } from './ScreenTransitionsLibrary';
import { ScreenMapExportPanel } from './ScreenMapExportPanel';
import { FileUploadBuildMatrixService } from './FileUploadBuildMatrixService';
import { ScreenMapImagePromptsPanel } from './ScreenMapImagePromptsPanel';
import { ScreenPrototypeDropStage } from './ScreenPrototypeDropStage';

export type ScreenHubSection =
  | 'all'
  | 'prototyper'
  | 'image-prompts'
  | 'file-matrix'
  | 'gallery'
  | 'planner'
  | 'github'
  | 'transitions'
  | 'export';

export const ScreenArchitectureHub: React.FC<{
  initialSection?: ScreenHubSection;
  initialFocusedScreenId?: string | null;
  onNavigateLiveTab: (tab: StudioLiveTabId) => void;
}> = ({ initialSection = 'all', initialFocusedScreenId = null, onNavigateLiveTab }) => {
  const {
    palette,
    depth,
    synth,
    haptic,
    patterns,
    activeScreenMap,
    setActiveScreenMap,
    activeScreenTransition,
    setActivePreviewScreenId,
    pulseInteraction,
  } = useStudio();

  const [section, setSection] = useState<ScreenHubSection>(initialSection);
  const [focusedScreenId, setFocusedScreenId] = useState<string | null>(
    initialFocusedScreenId
  );

  const plannerAnchorRef = useRef<HTMLDivElement | null>(null);
  const galleryAnchorRef = useRef<HTMLDivElement | null>(null);
  const prototyperAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (initialFocusedScreenId) {
      setFocusedScreenId(initialFocusedScreenId);
    }
  }, [initialFocusedScreenId]);

  const isDark = palette === 'emerald-clinic';

  const activeTransitionSpec =
    SCREEN_TRANSITION_PRESETS.find((t) => t.id === activeScreenTransition) ||
    SCREEN_TRANSITION_PRESETS[0];

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

  const handleSwitchSection = (next: ScreenHubSection) => {
    setSection(next);
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.7);
  };

  const handleFocusScreenInPlanner = (screenId: string) => {
    setFocusedScreenId(screenId);
    setActivePreviewScreenId(screenId);
    hapticAudio.triggerPress(synth, haptic, patterns);
    if (section !== 'all' && section !== 'planner') {
      setSection('planner');
    } else {
      window.requestAnimationFrame(() => {
        plannerAnchorRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
  };

  const handleFocusScreenInPrototyper = (screenId: string) => {
    setFocusedScreenId(screenId);
    setActivePreviewScreenId(screenId);
    hapticAudio.triggerPress(synth, haptic, patterns);
    if (section !== 'all' && section !== 'prototyper') {
      setSection('prototyper');
    } else {
      window.requestAnimationFrame(() => {
        prototyperAnchorRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
  };

  const handleOpenPlannerAfterGitHub = () => {
    if (section !== 'all') {
      setSection('planner');
    } else {
      window.requestAnimationFrame(() => {
        plannerAnchorRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
  };

  const handleOpenGalleryAfterGitHub = () => {
    if (section !== 'all') {
      setSection('gallery');
    } else {
      window.requestAnimationFrame(() => {
        galleryAnchorRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
  };

  const handleRestoreStudioDefaultMap = () => {
    setActiveScreenMap(DEFAULT_AETHER_SCREEN_MAP);
    setFocusedScreenId(DEFAULT_AETHER_SCREEN_MAP.nodes[0]?.id || null);
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.8);
  };

  const handleDirectJsonExport = () => {
    const base = `architektura-${slugifyExportName(activeScreenMap.name || activeScreenMap.sourceRepo)}`;
    downloadLocalArchitectureFile(
      serializeScreenMapToJson(activeScreenMap, { includeTransitionSpecs: true }),
      `${base}.json`,
      'application/json'
    );
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.85);
  };

  const handleDirectMermaidExport = () => {
    const base = `architektura-${slugifyExportName(activeScreenMap.name || activeScreenMap.sourceRepo)}`;
    downloadLocalArchitectureFile(
      serializeScreenMapToMermaid(activeScreenMap, {
        direction: 'LR',
        groupByRole: true,
        includeMetadataComments: true,
        wrapInMarkdown: false,
      }),
      `${base}.mmd`,
      'text/vnd.mermaid'
    );
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.85);
  };

  return (
    <div className="space-y-8">
      {/* Top Architecture Command Strip */}
      <section
        style={cardSurfaceStyle}
        className="p-6 border border-white/80 dark:border-emerald-400/20 space-y-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
              <span>Architektura Nawigacji Aether</span>
              <span aria-hidden="true">·</span>
              <span>
                Prompty Obrazów UI · Plan i Matryca z Pliku AI · Wszystkie Ekrany · Planer DAG · GitHub · Eksport
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-semibold text-slate-900 dark:text-emerald-50 mt-1">
              Studio Mapy Ekranów, Promptów Obrazów UI i Animacji Przejść
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDirectJsonExport}
              className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium bg-white/85 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 hover:bg-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>Zapisz JSON</span>
            </button>

            <button
              type="button"
              onClick={handleDirectMermaidExport}
              className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium bg-white/85 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 hover:bg-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Zapisz Mermaid (.mmd)</span>
            </button>

            {activeScreenMap.id !== DEFAULT_AETHER_SCREEN_MAP.id && (
              <button
                type="button"
                onClick={handleRestoreStudioDefaultMap}
                className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium bg-white/80 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/25 text-slate-700 dark:text-emerald-100 hover:bg-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Przywróć bazową mapę Aether Studio
              </button>
            )}
          </div>
        </div>

        {/* Sub-service Segmented Navigation + Live Project Telemetry */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-200/70 dark:border-emerald-400/15">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-emerald-950/80">
            {(
              [
                ['all', 'Pełny pakiet'],
                ['prototyper', 'Prototypowanie Drag & Drop'],
                ['image-prompts', 'Prompty obrazów UI'],
                ['planner', 'Planer mapy'],
                ['gallery', 'Wszystkie ekrany'],
                ['file-matrix', 'Plan i matryca z pliku AI'],
                ['github', 'Mapa z GitHub'],
                ['export', 'Eksport JSON / Mermaid'],
                ['transitions', 'Animacje przejść'],
              ] as [ScreenHubSection, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSwitchSection(id)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  section === id
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

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-emerald-200/85">
            <span>
              Projekt:{' '}
              <strong className="font-semibold text-slate-900 dark:text-emerald-50">
                {activeScreenMap.name}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {activeScreenMap.nodes.length} ekranów
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {activeScreenMap.edges.length} połączeń
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Przejście:{' '}
              <strong className="font-semibold text-slate-900 dark:text-emerald-50">
                {activeTransitionSpec.name.replace(/^\d+\.\s*/, '')}
              </strong>
            </span>
          </div>
        </div>
      </section>

      {/* 0A. Service: Drag & Drop Screen Prototyping Stage (TactileComponentsHub -> Screen Preview) */}
      {(section === 'all' || section === 'prototyper') && (
        <div ref={prototyperAnchorRef}>
          <ScreenPrototypeDropStage
            mode="full"
            selectedScreenIdOverride={focusedScreenId}
            onSelectScreenIdChange={(id) => setFocusedScreenId(id)}
            onNavigateLiveTab={onNavigateLiveTab}
          />
        </div>
      )}

      {/* 0B. Service: Screen Map Image Generator Prompts (Exact Button Count & Spatial Placement) */}
      {(section === 'all' || section === 'image-prompts') && (
        <ScreenMapImagePromptsPanel
          onNavigateLiveTab={onNavigateLiveTab}
          onSelectScreenInPlanner={handleFocusScreenInPlanner}
        />
      )}

      {/* 1. Service: Interactive Screen Map Planner & DAG Builder */}
      {(section === 'all' || section === 'planner') && (
        <div ref={plannerAnchorRef}>
          <ScreenMapPlanner
            focusedScreenId={focusedScreenId}
            onNavigateLiveTab={onNavigateLiveTab}
            onOpenScreenInPrototyper={handleFocusScreenInPrototyper}
          />
        </div>
      )}

      {/* 2. Service: Display All Designed Screens */}
      {(section === 'all' || section === 'gallery') && (
        <div ref={galleryAnchorRef}>
          <AllDesignedScreensGallery
            onNavigateLiveTab={onNavigateLiveTab}
            onSelectScreenInPlanner={handleFocusScreenInPlanner}
            onOpenScreenInPrototyper={handleFocusScreenInPrototyper}
          />
        </div>
      )}

      {/* 3. Service: File Upload -> AI Screen Plan & Website / Web App Build Matrix */}
      {(section === 'all' || section === 'file-matrix') && (
        <FileUploadBuildMatrixService
          onOpenPlanner={handleOpenPlannerAfterGitHub}
          onOpenAllScreens={handleOpenGalleryAfterGitHub}
          onSelectScreenInPlanner={handleFocusScreenInPlanner}
        />
      )}

      {/* 4. Service: Design Application Map from GitHub Library */}
      {(section === 'all' || section === 'github') && (
        <GitHubAppMapDesigner
          onOpenPlanner={handleOpenPlannerAfterGitHub}
          onOpenAllScreens={handleOpenGalleryAfterGitHub}
        />
      )}

      {/* 5. Service: Local Export to JSON, Mermaid.js (.mmd), or GitHub Markdown (.md) */}
      {(section === 'all' || section === 'export') && <ScreenMapExportPanel />}

      {/* 6. Library: Screen-to-Screen Transition Animations */}
      {(section === 'all' || section === 'transitions') && (
        <ScreenTransitionsLibrary />
      )}
    </div>
  );
};
