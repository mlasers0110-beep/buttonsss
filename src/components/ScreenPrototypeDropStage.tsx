import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Columns2,
  Copy,
  GripVertical,
  ImagePlus,
  Monitor,
  Plus,
  RotateCcw,
  Search,
  Smartphone,
  Square,
  Tablet,
  Trash2,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { hapticAudio } from '../lib/hapticAudioEngine';
import { resolveElementShadeSpec } from '../lib/frontendElementShades';
import {
  copyTextToClipboard,
  generateScreenImagePrompt,
  ScreenImageViewportFormat,
} from '../lib/screenImagePromptGenerator';
import {
  appendCatalogWidgetToNode,
  attachCatalogDragData,
  buildComponentsArrayFromWidgets,
  DRAG_REORDER_WIDGET_MIME,
  findCatalogItemById,
  hasTactileCatalogDrag,
  parseCatalogItemFromDrop,
  PROTOTYPE_ZONE_LABELS,
  ReorderWidgetDragPayload,
  resolvePrototypeWidgetsForNode,
  setActiveDraggedCatalogItem,
  subscribeActiveDraggedCatalogItem,
  TACTILE_CATEGORY_LABELS,
  TACTILE_UI_CATALOG,
  TactileUiCatalogItem,
} from '../lib/tactileUiCatalog';
import {
  DesignedScreenNode,
  HapticMaterialType,
  MATERIAL_PROFILES,
  PrototypeDropZone,
  PrototypeScreenWidget,
  StudioLiveTabId,
  TactileWidgetCategory,
} from '../types/studio';

const InteractivePreviewWidget: React.FC<{
  widget: PrototypeScreenWidget;
  screenId: string;
  screenMaterial: HapticMaterialType;
  isDark: boolean;
  accentColor: string;
  isMobileViewport: boolean;
  onRename: (instanceId: string, nextLabel: string) => void;
  onToggleSpan: (instanceId: string) => void;
  onMoveZone: (instanceId: string, nextZone: PrototypeDropZone) => void;
  onRemove: (instanceId: string) => void;
}> = ({
  widget,
  screenId,
  screenMaterial,
  isDark,
  accentColor,
  isMobileViewport,
  onRename,
  onToggleSpan,
  onMoveZone,
  onRemove,
}) => {
  const { synth, haptic, patterns, driverCalibration, pulseInteraction } = useStudio();
  const [sliderVal, setSliderVal] = useState<number>(68);
  const [bandHighVal, setBandHighVal] = useState<number>(132);
  const [toggleOn, setToggleOn] = useState<boolean>(true);
  const [guardOpen, setGuardOpen] = useState<boolean>(false);
  const [rotaryDeg, setRotaryDeg] = useState<number>(168);
  const [stripIdx, setStripIdx] = useState<number>(2);
  const [xyPoint, setXyPoint] = useState<{ x: number; y: number }>({ x: 62, y: 38 });
  const [pressed, setPressed] = useState<boolean>(false);

  const catalogSpec = findCatalogItemById(widget.catalogId);

  const handleReorderDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const payload: ReorderWidgetDragPayload = {
      screenId,
      instanceId: widget.instanceId,
      fromZone: widget.zone,
    };
    try {
      e.dataTransfer.setData(DRAG_REORDER_WIDGET_MIME, JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'move';
    } catch {
      // ignore
    }
  };

  const triggerWidgetPress = (semitones = 0) => {
    setPressed(true);
    hapticAudio.triggerPress(synth, haptic, patterns, {
      material: screenMaterial,
      pitchSemitones: semitones,
    });
    pulseInteraction(0.75);
    window.setTimeout(() => setPressed(false), 150);
  };

  const renderInteractiveControl = () => {
    // 1. Buttons
    if (widget.category === 'buttons') {
      const isPrimary = widget.catalogId === 'btn-primary-cta';
      const isCnc = widget.catalogId === 'btn-cnc-detent';
      return (
        <button
          type="button"
          onClick={() => triggerWidgetPress(isPrimary ? 5 : isCnc ? 2 : 0)}
          style={{
            transform: pressed ? 'scale(0.968)' : 'scale(1)',
            boxShadow: isPrimary
              ? `0 6px 20px -6px ${accentColor}88`
              : undefined,
          }}
          className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-between gap-2 transition-transform duration-150 cursor-pointer whitespace-nowrap ${
            isPrimary
              ? isDark
                ? 'bg-emerald-400 text-emerald-950'
                : 'bg-slate-900 text-white'
              : isCnc
                ? 'bg-slate-200/90 dark:bg-emerald-900/85 border border-slate-400/60 dark:border-emerald-300/40 text-slate-900 dark:text-emerald-50 font-mono'
                : 'bg-white/90 dark:bg-emerald-900/60 border border-slate-200/90 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-50'
          }`}
        >
          <span className="truncate">{widget.label}</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-80" />
        </button>
      );
    }

    // 2. Sliders
    if (widget.category === 'sliders') {
      if (widget.catalogId === 'slider-magnetic-5') {
        const steps = [0, 25, 50, 75, 100];
        return (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-emerald-200">
              <span className="truncate font-medium">{widget.label}</span>
              <span className="font-mono tabular-nums">{sliderVal}%</span>
            </div>
            <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-slate-200/80 dark:bg-emerald-950/90">
              {steps.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setSliderVal(st);
                    triggerWidgetPress((st / 25 - 2) * 2);
                  }}
                  className={`min-h-[30px] rounded-lg text-[10px] font-mono tabular-nums cursor-pointer transition-colors ${
                    sliderVal === st
                      ? isDark
                        ? 'bg-emerald-400 text-emerald-950 font-semibold'
                        : 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-600 dark:text-emerald-200/75'
                  }`}
                >
                  {st}%
                </button>
              ))}
            </div>
          </div>
        );
      }

      if (widget.catalogId === 'slider-dual-band') {
        return (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-emerald-200">
              <span className="truncate font-medium">{widget.label}</span>
              <span className="font-mono tabular-nums">
                {Math.min(sliderVal, bandHighVal - 10)}–{bandHighVal} Hz
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="range"
                min={36}
                max={120}
                value={Math.min(sliderVal, 120)}
                aria-label={`${widget.label} dolny próg`}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSliderVal(v);
                  hapticAudio.triggerSliderTick(haptic, v / 158);
                }}
                className="w-full accent-indigo-600 dark:accent-emerald-400 cursor-pointer"
              />
              <input
                type="range"
                min={80}
                max={158}
                value={bandHighVal}
                aria-label={`${widget.label} górny próg`}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setBandHighVal(v);
                  hapticAudio.triggerSliderTick(haptic, v / 158);
                }}
                className="w-full accent-indigo-600 dark:accent-emerald-400 cursor-pointer"
              />
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-emerald-200">
            <span className="truncate font-medium">{widget.label}</span>
            <span className="font-mono tabular-nums">{sliderVal}%</span>
          </div>
          <div className="relative h-8 rounded-xl bg-slate-200/80 dark:bg-emerald-950/90 border border-slate-300/60 dark:border-emerald-400/20 overflow-hidden flex items-center px-2.5">
            <div
              style={{
                transform: `scaleX(${sliderVal / 100})`,
                backgroundColor: accentColor,
              }}
              className="pointer-events-none absolute inset-0 origin-left opacity-35 transition-transform duration-75"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={sliderVal}
              aria-label={widget.label}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSliderVal(v);
                hapticAudio.triggerSliderTick(haptic, v / 100);
              }}
              onPointerUp={() => hapticAudio.triggerReleaseReverseClutch(haptic, screenMaterial)}
              className="relative z-10 w-full accent-indigo-600 dark:accent-emerald-400 cursor-pointer"
            />
          </div>
        </div>
      );
    }

    // 3. Levers & Rockers
    if (widget.category === 'levers') {
      if (widget.catalogId === 'lever-safety-guard') {
        return (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                const nextGuard = !guardOpen;
                setGuardOpen(nextGuard);
                if (!nextGuard) setToggleOn(false);
                triggerWidgetPress(nextGuard ? 2 : -4);
              }}
              className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-[11px] font-medium border cursor-pointer whitespace-nowrap ${
                guardOpen
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-900 dark:text-amber-200'
                  : 'bg-white/80 dark:bg-emerald-950/80 border-slate-300/80 dark:border-emerald-400/25 text-slate-700 dark:text-emerald-100'
              }`}
            >
              {guardOpen ? 'Osłona otw.' : '1. Osłona'}
            </button>
            <button
              type="button"
              disabled={!guardOpen}
              onClick={() => {
                const next = !toggleOn;
                setToggleOn(next);
                triggerWidgetPress(next ? 6 : -3);
              }}
              className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold border cursor-pointer disabled:opacity-45 whitespace-nowrap ${
                toggleOn && guardOpen
                  ? isDark
                    ? 'bg-emerald-400 text-emerald-950 border-emerald-300'
                    : 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white/80 dark:bg-emerald-950/80 border-slate-300/80 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100'
              }`}
            >
              {toggleOn && guardOpen ? 'UZBROJONY' : 'GOTOWY'}
            </button>
          </div>
        );
      }

      return (
        <button
          type="button"
          role="switch"
          aria-checked={toggleOn}
          onClick={() => {
            const next = !toggleOn;
            setToggleOn(next);
            triggerWidgetPress(next ? 3 : -3);
            hapticAudio.triggerReleaseReverseClutch(haptic, 'matte-metal');
          }}
          className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-200/85 dark:bg-emerald-950/90 border border-slate-300/80 dark:border-emerald-400/25 flex items-center justify-between gap-2 cursor-pointer"
        >
          <span className="text-xs font-medium text-slate-800 dark:text-emerald-100 truncate">
            {widget.label}
          </span>
          <span
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-colors ${
              toggleOn
                ? isDark
                  ? 'bg-emerald-400 text-emerald-950'
                  : 'bg-slate-900 text-white'
                : 'bg-white/85 dark:bg-emerald-900/60 text-slate-600 dark:text-emerald-200'
            }`}
          >
            {toggleOn ? 'ZAŁ (I)' : 'WYŁ (O)'}
          </span>
        </button>
      );
    }

    // 4. Touch & Rotary CNC
    if (widget.catalogId === 'rotary-cnc-270') {
      return (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-800 dark:text-emerald-100 truncate">
              {widget.label}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-emerald-300/80">
              Kąt: {rotaryDeg}° / 270°
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const next = (rotaryDeg + 18) % 271;
                setRotaryDeg(next);
                hapticAudio.triggerCalibratedRotaryDetent(
                  driverCalibration,
                  next / 270,
                  next % 36 === 0,
                  0.4
                );
                pulseInteraction(0.6);
              }}
              aria-label={`Obróć pokrętło ${widget.label}`}
              className="w-11 h-11 rounded-full bg-gradient-to-b from-slate-100 via-slate-300 to-slate-400 dark:from-emerald-800 dark:to-emerald-950 border border-slate-400 dark:border-emerald-300/40 shadow-sm flex items-center justify-center cursor-pointer"
            >
              <span
                style={{ transform: `rotate(${rotaryDeg - 135}deg)` }}
                className="w-1 h-4 rounded-full bg-slate-900 dark:bg-emerald-300 origin-bottom -translate-y-1 transition-transform duration-100"
              />
            </button>
          </div>
        </div>
      );
    }

    if (widget.catalogId === 'touch-xy-vector') {
      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-emerald-200">
            <span className="truncate font-medium">{widget.label}</span>
            <span className="font-mono tabular-nums">
              X:{xyPoint.x}% · Y:{xyPoint.y}%
            </span>
          </div>
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const nx = Math.max(
                0,
                Math.min(100, Math.round(((e.clientX - rect.left) / Math.max(1, rect.width)) * 100))
              );
              const ny = Math.max(
                0,
                Math.min(100, Math.round(((e.clientY - rect.top) / Math.max(1, rect.height)) * 100))
              );
              setXyPoint({ x: nx, y: ny });
              hapticAudio.triggerSliderTick(haptic, (nx + ny) / 200);
            }}
            className="relative h-14 rounded-xl bg-slate-200/75 dark:bg-[#061512] border border-slate-300/80 dark:border-emerald-400/25 cursor-crosshair overflow-hidden"
          >
            <span
              style={{
                left: `calc(${xyPoint.x}% - 6px)`,
                top: `calc(${xyPoint.y}% - 6px)`,
                backgroundColor: accentColor,
              }}
              className="absolute w-3 h-3 rounded-full shadow-sm ring-2 ring-white dark:ring-emerald-950 transition-transform duration-75"
            />
          </div>
        </div>
      );
    }

    if (widget.catalogId === 'touch-segmented-strip') {
      const levels = ['Cichy', 'Miękki', 'Studyjny', 'Szczyt'];
      return (
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-slate-700 dark:text-emerald-200 truncate">
            {widget.label}
          </div>
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-200/80 dark:bg-emerald-950/90">
            {levels.map((lv, idx) => (
              <button
                key={lv}
                type="button"
                onClick={() => {
                  setStripIdx(idx);
                  triggerWidgetPress((idx - 1) * 2);
                }}
                className={`min-h-[32px] px-1.5 rounded-lg text-[10px] font-medium cursor-pointer truncate transition-colors ${
                  stripIdx === idx
                    ? isDark
                      ? 'bg-emerald-400 text-emerald-950 font-semibold'
                      : 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-600 dark:text-emerald-200/75'
                }`}
              >
                {lv}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Force-hold pad fallback
    return (
      <button
        type="button"
        onPointerDown={() => triggerWidgetPress(-2)}
        onPointerUp={() => hapticAudio.triggerReleaseReverseClutch(haptic, 'suede')}
        className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-200/85 dark:bg-emerald-900/60 border border-slate-300/80 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-50 flex items-center justify-between gap-2 cursor-pointer"
      >
        <span className="truncate">{widget.label}</span>
        <span className="text-[10px] font-mono tabular-nums opacity-75">Force-Hold</span>
      </button>
    );
  };

  return (
    <div
      draggable
      onDragStart={handleReorderDragStart}
      className={`group rounded-xl bg-white/85 dark:bg-emerald-950/75 border border-slate-200/90 dark:border-emerald-400/20 p-2.5 space-y-2 transition-colors hover:border-indigo-400/80 dark:hover:border-emerald-300/60 ${
        !isMobileViewport && widget.zone !== 'header' && widget.spanCols === 2
          ? 'sm:col-span-2'
          : 'col-span-1'
      }`}
    >
      {/* Compact Widget Toolbar */}
      <div className="flex items-center justify-between gap-1.5 text-[10px] text-slate-500 dark:text-emerald-300/80">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <GripVertical
            className="w-3.5 h-3.5 shrink-0 cursor-grab active:cursor-grabbing text-slate-400 dark:text-emerald-400/70"
            aria-hidden="true"
          />
          <input
            type="text"
            value={widget.label}
            aria-label={`Etykieta elementu ${widget.componentName}`}
            onChange={(e) => onRename(widget.instanceId, e.target.value)}
            className="min-w-0 flex-1 bg-transparent font-medium text-[11px] text-slate-700 dark:text-emerald-100 focus:outline-none focus:underline truncate"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="hidden xl:inline font-mono opacity-75">
            {catalogSpec?.componentName || widget.componentName}
          </span>

          {widget.zone !== 'header' && !isMobileViewport && (
            <button
              type="button"
              onClick={() => onToggleSpan(widget.instanceId)}
              title={
                widget.spanCols === 2
                  ? 'Zmień szerokość na 1 kolumnę'
                  : 'Rozszerz na 2 kolumny'
              }
              className="p-1 rounded-md hover:bg-slate-200/70 dark:hover:bg-emerald-900/70 text-slate-600 dark:text-emerald-200 cursor-pointer"
            >
              {widget.spanCols === 2 ? (
                <Columns2 className="w-3 h-3" />
              ) : (
                <Square className="w-3 h-3" />
              )}
            </button>
          )}

          <select
            aria-label="Strefa docelowa ekranu"
            value={widget.zone}
            onChange={(e) =>
              onMoveZone(widget.instanceId, e.target.value as PrototypeDropZone)
            }
            className="bg-slate-100 dark:bg-emerald-900/70 border border-slate-200/80 dark:border-emerald-400/20 rounded-md px-1 py-0.5 text-[10px] text-slate-700 dark:text-emerald-100 cursor-pointer"
          >
            <option value="header">Góra</option>
            <option value="main">Środek</option>
            <option value="footer">Dół</option>
          </select>

          <button
            type="button"
            aria-label={`Usuń ${widget.label} z podglądu ekranu`}
            onClick={() => onRemove(widget.instanceId)}
            className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Interactive Tactile Control Render */}
      {renderInteractiveControl()}
    </div>
  );
};

export const ScreenPrototypeDropStage: React.FC<{
  mode?: 'full' | 'docked-preview';
  selectedScreenIdOverride?: string | null;
  onSelectScreenIdChange?: (screenId: string) => void;
  onNavigateLiveTab?: (tab: StudioLiveTabId) => void;
  onOpenFullPrototyperInScreens?: (screenId: string) => void;
}> = ({
  mode = 'full',
  selectedScreenIdOverride,
  onSelectScreenIdChange,
  onNavigateLiveTab,
  onOpenFullPrototyperInScreens,
}) => {
  const {
    palette,
    depth,
    synth,
    haptic,
    engraving,
    patterns,
    activeScreenMap,
    setActiveScreenMap,
    setActivePreviewScreenId,
    composedElementShades,
    markElementAsActivelyModified,
    setPendingImageGeneratorDraft,
    pulseInteraction,
  } = useStudio();

  const [internalScreenId, setInternalScreenId] = useState<string>(
    activeScreenMap.nodes[0]?.id || ''
  );
  const [categoryFilter, setCategoryFilter] = useState<'all' | TactileWidgetCategory>('all');
  const [paletteQuery, setPaletteQuery] = useState('');
  const [viewportDevice, setViewportDevice] = useState<'mobile' | 'tablet' | 'desktop'>(
    'desktop'
  );
  const [hoveredDropZone, setHoveredDropZone] = useState<PrototypeDropZone | null>(null);
  const [activeDraggedItem, setActiveDraggedItem] = useState<TactileUiCatalogItem | null>(
    null
  );
  const [lastDropBanner, setLastDropBanner] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  useEffect(() => {
    return subscribeActiveDraggedCatalogItem((item) => {
      setActiveDraggedItem(item);
      if (!item) {
        setHoveredDropZone(null);
      }
    });
  }, []);

  useEffect(() => {
    if (
      selectedScreenIdOverride &&
      activeScreenMap.nodes.some((n) => n.id === selectedScreenIdOverride)
    ) {
      setInternalScreenId(selectedScreenIdOverride);
    } else if (
      !activeScreenMap.nodes.some((n) => n.id === internalScreenId) &&
      activeScreenMap.nodes[0]
    ) {
      setInternalScreenId(activeScreenMap.nodes[0].id);
    }
  }, [activeScreenMap.nodes, selectedScreenIdOverride, internalScreenId]);

  const isDark = palette === 'emerald-clinic';
  const accentColor = engraving.glowColor || '#8B7CFF';

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

  const selectedScreen: DesignedScreenNode | null = useMemo(
    () =>
      activeScreenMap.nodes.find((n) => n.id === internalScreenId) ||
      activeScreenMap.nodes[0] ||
      null,
    [activeScreenMap.nodes, internalScreenId]
  );

  const widgets = useMemo(
    () => (selectedScreen ? resolvePrototypeWidgetsForNode(selectedScreen) : []),
    [selectedScreen]
  );

  const filteredCatalog = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    return TACTILE_UI_CATALOG.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        item.labelPl.toLowerCase().includes(q) ||
        item.componentName.toLowerCase().includes(q) ||
        item.descriptionPl.toLowerCase().includes(q) ||
        item.sourceModulePl.toLowerCase().includes(q)
      );
    });
  }, [categoryFilter, paletteQuery]);

  const mappedPromptFormat: ScreenImageViewportFormat =
    viewportDevice === 'mobile'
      ? 'mobile-9-16'
      : viewportDevice === 'tablet'
        ? 'tablet-4-3'
        : 'desktop-16-9';

  const promptSpec = useMemo(() => {
    if (!selectedScreen) return null;
    return generateScreenImagePrompt({
      node: selectedScreen,
      mapProject: activeScreenMap,
      palette,
      depth,
      engraving,
      format: mappedPromptFormat,
      language: 'en-with-pl-labels',
      visualStyle: 'tactile-glass',
    });
  }, [selectedScreen, activeScreenMap, palette, depth, engraving, mappedPromptFormat]);

  const commitScreenWidgets = (
    targetScreenId: string,
    updater: (current: PrototypeScreenWidget[], node: DesignedScreenNode) => PrototypeScreenWidget[]
  ) => {
    setActiveScreenMap((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) => {
        if (node.id !== targetScreenId) return node;
        const current = resolvePrototypeWidgetsForNode(node);
        const nextWidgets = updater(current, node).slice(0, 24);
        return {
          ...node,
          prototypeWidgets: nextWidgets,
          components: buildComponentsArrayFromWidgets(nextWidgets, node.components),
        };
      }),
    }));
  };

  const handleSelectScreen = (nextId: string) => {
    setInternalScreenId(nextId);
    setActivePreviewScreenId(nextId);
    onSelectScreenIdChange?.(nextId);
    hapticAudio.triggerPress(synth, haptic, patterns);
  };

  const announceDrop = (label: string, zone: PrototypeDropZone) => {
    setLastDropBanner(`Dodano „${label}” → ${PROTOTYPE_ZONE_LABELS[zone]}`);
    window.setTimeout(() => {
      setLastDropBanner((prev) =>
        prev?.includes(label) ? null : prev
      );
    }, 2400);
  };

  const handleQuickInsertItem = (
    item: TactileUiCatalogItem,
    zoneOverride?: PrototypeDropZone
  ) => {
    if (!selectedScreen) return;
    const targetZone = zoneOverride || item.defaultZone;
    let addedId = '';
    setActiveScreenMap((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => {
        if (n.id !== selectedScreen.id) return n;
        const updated = appendCatalogWidgetToNode(n, item, targetZone);
        const last = updated.prototypeWidgets?.[updated.prototypeWidgets.length - 1];
        if (last) addedId = last.instanceId;
        return updated;
      }),
    }));
    if (addedId) {
      const shade = resolveElementShadeSpec(addedId, composedElementShades, widgets.length);
      setActivePreviewScreenId(selectedScreen.id);
      markElementAsActivelyModified({
        id: addedId,
        kind: 'widget',
        label: item.labelPl,
        zone: targetZone,
        screenId: selectedScreen.id,
        shadeId: shade.id,
        sourceSurface: 'Prototypowanie Drag & Drop',
      });
    }
    hapticAudio.triggerPress(synth, haptic, patterns, {
      material: item.recommendedMaterial,
      pitchSemitones: 3,
    });
    pulseInteraction(1.0);
    announceDrop(item.labelPl, targetZone);
  };

  const handleZoneDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    zone: PrototypeDropZone
  ) => {
    const types = Array.from(e.dataTransfer?.types || []);
    const isReorder = types.includes(DRAG_REORDER_WIDGET_MIME);
    if (isReorder || hasTactileCatalogDrag(e)) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = isReorder ? 'move' : 'copy';
      if (hoveredDropZone !== zone) {
        setHoveredDropZone(zone);
      }
    }
  };

  const handleZoneDrop = (
    e: React.DragEvent<HTMLDivElement>,
    zone: PrototypeDropZone
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredDropZone(null);
    if (!selectedScreen) return;

    // Case 1: Reordering / moving an existing widget between zones
    try {
      const rawReorder = e.dataTransfer.getData(DRAG_REORDER_WIDGET_MIME);
      if (rawReorder) {
        const parsed = JSON.parse(rawReorder) as ReorderWidgetDragPayload;
        if (parsed?.instanceId && parsed.screenId === selectedScreen.id) {
          commitScreenWidgets(selectedScreen.id, (curr) => {
            const moving = curr.find((w) => w.instanceId === parsed.instanceId);
            if (!moving) return curr;
            const rest = curr.filter((w) => w.instanceId !== parsed.instanceId);
            return [
              ...rest,
              {
                ...moving,
                zone,
                spanCols: zone === 'header' ? 1 : moving.spanCols,
              },
            ];
          });
          hapticAudio.triggerSliderTick(haptic, 0.7);
          pulseInteraction(0.8);
          return;
        }
      }
    } catch {
      // Proceed to catalog drop check
    }

    // Case 2: Dropping a new UI element from TactileComponentsHub
    const droppedCatalogItem = parseCatalogItemFromDrop(e);
    setActiveDraggedCatalogItem(null);
    if (!droppedCatalogItem) return;

    handleQuickInsertItem(droppedCatalogItem, zone);
  };

  const handleRenameWidget = (instanceId: string, nextLabel: string) => {
    if (!selectedScreen) return;
    const idx = widgets.findIndex((w) => w.instanceId === instanceId);
    const target = widgets[idx];
    commitScreenWidgets(selectedScreen.id, (curr) =>
      curr.map((w) => (w.instanceId === instanceId ? { ...w, label: nextLabel } : w))
    );
    if (target) {
      const shade = resolveElementShadeSpec(instanceId, composedElementShades, Math.max(0, idx));
      setActivePreviewScreenId(selectedScreen.id);
      markElementAsActivelyModified({
        id: instanceId,
        kind: 'widget',
        label: nextLabel,
        zone: target.zone,
        screenId: selectedScreen.id,
        shadeId: shade.id,
        sourceSurface: 'Prototyper ekranu',
      });
    }
  };

  const handleToggleSpan = (instanceId: string) => {
    if (!selectedScreen) return;
    const idx = widgets.findIndex((w) => w.instanceId === instanceId);
    const target = widgets[idx];
    commitScreenWidgets(selectedScreen.id, (curr) =>
      curr.map((w) =>
        w.instanceId === instanceId
          ? { ...w, spanCols: w.spanCols === 2 ? 1 : 2 }
          : w
      )
    );
    if (target) {
      const shade = resolveElementShadeSpec(instanceId, composedElementShades, Math.max(0, idx));
      setActivePreviewScreenId(selectedScreen.id);
      markElementAsActivelyModified({
        id: instanceId,
        kind: 'widget',
        label: target.label,
        zone: target.zone,
        screenId: selectedScreen.id,
        shadeId: shade.id,
        sourceSurface: 'Zmiana szerokości kolumny',
      });
    }
    hapticAudio.triggerSliderTick(haptic, 0.5);
  };

  const handleMoveZone = (instanceId: string, nextZone: PrototypeDropZone) => {
    if (!selectedScreen) return;
    const idx = widgets.findIndex((w) => w.instanceId === instanceId);
    const target = widgets[idx];
    commitScreenWidgets(selectedScreen.id, (curr) =>
      curr.map((w) =>
        w.instanceId === instanceId
          ? { ...w, zone: nextZone, spanCols: nextZone === 'header' ? 1 : w.spanCols }
          : w
      )
    );
    if (target) {
      const shade = resolveElementShadeSpec(instanceId, composedElementShades, Math.max(0, idx));
      setActivePreviewScreenId(selectedScreen.id);
      markElementAsActivelyModified({
        id: instanceId,
        kind: 'widget',
        label: target.label,
        zone: nextZone,
        screenId: selectedScreen.id,
        shadeId: shade.id,
        sourceSurface: 'Przeniesienie do innej strefy',
      });
    }
    hapticAudio.triggerSliderTick(haptic, 0.6);
  };

  const handleRemoveWidget = (instanceId: string) => {
    if (!selectedScreen) return;
    commitScreenWidgets(selectedScreen.id, (curr) =>
      curr.filter((w) => w.instanceId !== instanceId)
    );
    hapticAudio.triggerReleaseReverseClutch(haptic, selectedScreen.hapticMaterial);
  };

  const handleResetScreenPrototype = () => {
    if (!selectedScreen) return;
    setActiveScreenMap((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === selectedScreen.id ? { ...n, prototypeWidgets: undefined } : n
      ),
    }));
    hapticAudio.triggerReleaseReverseClutch(haptic);
    pulseInteraction(0.75);
  };

  const headerWidgets = widgets.filter((w) => w.zone === 'header');
  const mainWidgets = widgets.filter((w) => w.zone === 'main');
  const footerWidgets = widgets.filter((w) => w.zone === 'footer');

  const renderDropZone = (
    zone: PrototypeDropZone,
    zoneWidgets: PrototypeScreenWidget[],
    emptyHint: string
  ) => {
    const isHighlighted = hoveredDropZone === zone;
    const isAnyDragActive = Boolean(activeDraggedItem);

    return (
      <div
        onDragOver={(e) => handleZoneDragOver(e, zone)}
        onDragEnter={(e) => handleZoneDragOver(e, zone)}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setHoveredDropZone((prev) => (prev === zone ? null : prev));
          }
        }}
        onDrop={(e) => handleZoneDrop(e, zone)}
        className={`rounded-2xl border p-3 transition-colors space-y-2.5 ${
          isHighlighted
            ? isDark
              ? 'bg-emerald-900/55 border-emerald-300 ring-2 ring-emerald-300/50'
              : 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/30'
            : isAnyDragActive
              ? 'bg-white/60 dark:bg-emerald-950/45 border-dashed border-indigo-400/80 dark:border-emerald-300/60'
              : 'bg-white/55 dark:bg-emerald-950/35 border-slate-200/85 dark:border-emerald-400/20'
        }`}
      >
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-emerald-300/80">
          <span className="font-medium text-slate-700 dark:text-emerald-100">
            {PROTOTYPE_ZONE_LABELS[zone]}
          </span>
          <span className="font-mono tabular-nums">
            {zoneWidgets.length} elem.
          </span>
        </div>

        {zoneWidgets.length === 0 ? (
          <div className="py-5 px-3 rounded-xl border border-dashed border-slate-300/80 dark:border-emerald-400/25 text-center text-xs text-slate-500 dark:text-emerald-200/75">
            {emptyHint}
          </div>
        ) : (
          <div
            className={`grid gap-2.5 ${
              viewportDevice === 'mobile' || zone === 'header'
                ? 'grid-cols-1'
                : 'grid-cols-1 sm:grid-cols-2'
            }`}
          >
            {selectedScreen &&
              zoneWidgets.map((w) => (
                <InteractivePreviewWidget
                  key={w.instanceId}
                  widget={w}
                  screenId={selectedScreen.id}
                  screenMaterial={selectedScreen.hapticMaterial}
                  isDark={isDark}
                  accentColor={accentColor}
                  isMobileViewport={viewportDevice === 'mobile'}
                  onRename={handleRenameWidget}
                  onToggleSpan={handleToggleSpan}
                  onMoveZone={handleMoveZone}
                  onRemove={handleRemoveWidget}
                />
              ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <section
      style={cardSurfaceStyle}
      className="p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-6"
    >
      {/* Workspace Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
            <span>Prototypowanie Drag &amp; Drop na Żywo</span>
            <span aria-hidden="true">·</span>
            <span>TactileComponentsHub → ScreenArchitectureHub</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {widgets.length} aktywnych elementów na ekranie
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-emerald-50">
            {mode === 'docked-preview'
              ? 'Szybkie Przeciąganie Komponentów UI Bezpośrednio na Podgląd Ekranu'
              : 'Stół Szybkiego Prototypowania Ekranów (Drag & Drop z TactileComponentsHub)'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-emerald-100/80">
            Przeciągnij dowolny przycisk, suwak, dźwignię lub enkoder CNC z biblioteki{' '}
            <strong className="font-semibold text-slate-800 dark:text-emerald-100">
              TactileComponentsHub
            </strong>{' '}
            wprost do wybranej strefy podglądu ekranu. Upuszczone elementy działają
            interaktywnie z dźwiękiem &lt;160 Hz i automatycznie aktualizują architekturę oraz
            prompty obrazów UI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === 'docked-preview' &&
            onOpenFullPrototyperInScreens &&
            selectedScreen && (
              <button
                type="button"
                onClick={() => onOpenFullPrototyperInScreens(selectedScreen.id)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap shrink-0"
              >
                <span>Otwórz pełną Mapę Ekranów</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

          {selectedScreen && promptSpec && (
            <>
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyTextToClipboard(promptSpec.promptText);
                  if (ok) {
                    setCopiedPrompt(true);
                    hapticAudio.triggerPress(synth, haptic, patterns);
                    window.setTimeout(() => setCopiedPrompt(false), 1800);
                  }
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/85 dark:bg-emerald-950/80 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white whitespace-nowrap shrink-0"
              >
                {copiedPrompt ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>
                  {copiedPrompt
                    ? 'Skopiowano prompt ekranu'
                    : `Kopiuj prompt (${promptSpec.totalButtons} przyc.)`}
                </span>
              </button>

              {onNavigateLiveTab && (
                <button
                  type="button"
                  onClick={() => {
                    setPendingImageGeneratorDraft({
                      prompt: promptSpec.promptText,
                      aspectRatio: promptSpec.aspectRatio,
                      screenTitle: selectedScreen.title,
                    });
                    hapticAudio.triggerPress(synth, haptic, patterns);
                    onNavigateLiveTab('gemini');
                  }}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap shrink-0"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>Generuj obraz UI</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {lastDropBanner && (
        <div className="px-4 py-2.5 rounded-xl bg-indigo-50/90 dark:bg-emerald-900/60 border border-indigo-200 dark:border-emerald-400/30 text-xs font-medium text-indigo-900 dark:text-emerald-100 flex items-center justify-between gap-2">
          <span>{lastDropBanner}</span>
          <span className="font-mono tabular-nums text-[11px] opacity-80">
            Zsynchronizowano z mapą ekranów
          </span>
        </div>
      )}

      {/* 12-Column Split: Draggable TactileComponentsHub Palette | Live Screen Preview Drop Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Columns: Draggable TactileComponentsHub Library */}
        <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-white/65 dark:bg-emerald-950/55 border border-slate-200/80 dark:border-emerald-400/20 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-emerald-50">
                Biblioteka TactileComponentsHub
              </h3>
              <p className="text-xs text-slate-500 dark:text-emerald-300/80">
                Chwyć kartę i przeciągnij na podgląd ekranu po prawej
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-emerald-200">
              {filteredCatalog.length} / {TACTILE_UI_CATALOG.length}
            </span>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-emerald-950/85">
            {(
              ['all', 'buttons', 'sliders', 'levers', 'touch-rotary'] as const
            ).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === cat
                    ? isDark
                      ? 'bg-emerald-400 text-emerald-950 shadow-xs'
                      : 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-emerald-200/75 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {TACTILE_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={paletteQuery}
              onChange={(e) => setPaletteQuery(e.target.value)}
              placeholder="Szukaj komponentu (np. Noniusz, Dalej, CNC)..."
              className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-emerald-950/85 border border-slate-200/80 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Draggable UI Element Cards */}
          <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {filteredCatalog.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => {
                  attachCatalogDragData(e, item);
                  hapticAudio.triggerSliderTick(haptic, 0.45);
                }}
                onDragEnd={() => setActiveDraggedCatalogItem(null)}
                className="p-3 rounded-xl bg-white/90 dark:bg-emerald-950/80 border border-slate-200/85 dark:border-emerald-400/20 hover:border-indigo-400 dark:hover:border-emerald-300/60 cursor-grab active:cursor-grabbing transition-colors flex items-start justify-between gap-3 select-none"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <GripVertical
                    className="w-4 h-4 mt-0.5 shrink-0 text-slate-400 dark:text-emerald-400/70"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-[11px] text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5">
                      <span>{item.sourceModulePl}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono truncate">{item.componentName}</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-emerald-50 truncate">
                      {item.labelPl}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-emerald-100/75 line-clamp-2 leading-snug">
                      {item.descriptionPl}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleQuickInsertItem(item)}
                  title={`Dodaj ${item.labelPl} do aktywnego ekranu`}
                  className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-emerald-900/75 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-800 dark:text-emerald-100 hover:bg-indigo-600 hover:text-white dark:hover:bg-emerald-400 dark:hover:text-emerald-950 inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Dodaj</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right 7 Columns: Live ScreenArchitectureHub Screen Preview Drop Canvas */}
        <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-slate-100/85 dark:bg-[#061512] border border-slate-200/90 dark:border-emerald-400/25 space-y-4">
          {/* Screen Selector & Device Frame Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-emerald-400/15">
            <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
              <label
                htmlFor={`proto-screen-select-${mode}`}
                className="text-xs font-medium text-slate-600 dark:text-emerald-200 whitespace-nowrap"
              >
                Podgląd ekranu:
              </label>
              <select
                id={`proto-screen-select-${mode}`}
                value={selectedScreen?.id || ''}
                onChange={(e) => handleSelectScreen(e.target.value)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-emerald-950 border border-slate-200 dark:border-emerald-400/30 text-slate-900 dark:text-emerald-50 max-w-full sm:max-w-[300px]"
              >
                {activeScreenMap.nodes.map((n, idx) => (
                  <option key={n.id} value={n.id}>
                    {String(idx + 1).padStart(2, '0')}. {n.title} ({n.route})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/80 dark:bg-emerald-950/90">
                {(
                  [
                    ['mobile', 'Mobile', Smartphone],
                    ['tablet', 'Tablet', Tablet],
                    ['desktop', 'Desktop', Monitor],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setViewportDevice(id)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      viewportDevice === id
                        ? isDark
                          ? 'bg-emerald-400 text-emerald-950 shadow-xs'
                          : 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 dark:text-emerald-200/75'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleResetScreenPrototype}
                title="Przywróć domyślny układ komponentów dla tego ekranu"
                className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-emerald-950 border border-slate-200 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1 cursor-pointer hover:opacity-90 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Resetuj układ</span>
              </button>
            </div>
          </div>

          {/* Simulated Device Viewport Frame */}
          {selectedScreen && (
            <div
              className={`mx-auto transition-all ${
                viewportDevice === 'mobile'
                  ? 'max-w-[380px]'
                  : viewportDevice === 'tablet'
                    ? 'max-w-[580px]'
                    : 'w-full'
              } rounded-2xl bg-gradient-to-b from-white/95 to-slate-50/95 dark:from-[#0B231E] dark:to-[#071814] border border-slate-300/85 dark:border-emerald-400/30 shadow-md p-4 space-y-3.5`}
            >
              {/* Screen Top Metadata Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80 dark:border-emerald-400/15 text-xs">
                <div className="min-w-0">
                  <div className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5">
                    <span>{selectedScreen.route}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Materiał: {MATERIAL_PROFILES[selectedScreen.hapticMaterial].label}
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-emerald-50 truncate">
                    {selectedScreen.title}
                  </h4>
                </div>

                <select
                  aria-label="Materiał haptyczny projektowanego ekranu"
                  value={selectedScreen.hapticMaterial}
                  onChange={(e) => {
                    const nextMat = e.target.value as HapticMaterialType;
                    setActiveScreenMap((prev) => ({
                      ...prev,
                      nodes: prev.nodes.map((n) =>
                        n.id === selectedScreen.id
                          ? { ...n, hapticMaterial: nextMat }
                          : n
                      ),
                    }));
                    hapticAudio.triggerPress(synth, haptic, patterns, {
                      material: nextMat,
                    });
                  }}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-emerald-950 border border-slate-200 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 cursor-pointer"
                >
                  {(Object.keys(MATERIAL_PROFILES) as HapticMaterialType[]).map((m) => (
                    <option key={m} value={m}>
                      {MATERIAL_PROFILES[m].label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Zone 1: Header Drop Zone */}
              {renderDropZone(
                'header',
                headerWidgets,
                'Upuść tutaj przycisk powrotu, nawigacji lub akcji górnego paska'
              )}

              {/* Zone 2: Main Workspace Drop Zone */}
              {renderDropZone(
                'main',
                mainWidgets,
                'Przeciągnij i upuść tutaj karty szkła, suwaki, dźwignie lub pokrętło CNC 270°'
              )}

              {/* Zone 3: Bottom Action Dock Drop Zone */}
              {renderDropZone(
                'footer',
                footerWidgets,
                'Upuść tutaj główny przycisk CTA „Dalej” lub listwę dotykową dolnego paska'
              )}

              {/* Live Synced Components Footer */}
              <div className="pt-2 border-t border-slate-200/75 dark:border-emerald-400/15 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-500 dark:text-emerald-300/80">
                <span className="truncate">
                  Moduły ekranu: {selectedScreen.components.slice(0, 4).join(', ')}
                  {selectedScreen.components.length > 4
                    ? ` +${selectedScreen.components.length - 4}`
                    : ''}
                </span>
                {promptSpec && <span>{promptSpec.summaryLinePl}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
