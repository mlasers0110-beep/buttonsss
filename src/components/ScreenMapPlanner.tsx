import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Copy,
  FileCode2,
  FileJson,
  GitBranch,
  ImagePlus,
  LayoutGrid,
  Link2,
  Play,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { hapticAudio } from '../lib/hapticAudioEngine';
import {
  copyTextToClipboard,
  generateScreenImagePrompt,
  ScreenImageViewportFormat,
} from '../lib/screenImagePromptGenerator';
import {
  downloadLocalArchitectureFile,
  serializeScreenMapToJson,
  serializeScreenMapToMermaid,
  slugifyExportName,
} from '../lib/screenMapExport';
import {
  appendCatalogWidgetToNode,
  hasTactileCatalogDrag,
  parseCatalogItemFromDrop,
  setActiveDraggedCatalogItem,
} from '../lib/tactileUiCatalog';
import {
  DesignedScreenNode,
  HapticMaterialType,
  MATERIAL_PROFILES,
  SCREEN_TRANSITION_PRESETS,
  ScreenDesignStatus,
  ScreenMapEdge,
  ScreenRoleType,
  ScreenTransitionPresetId,
  StudioLiveTabId,
} from '../types/studio';

const NODE_WIDTH = 252;
const NODE_HEIGHT = 144;

const ROLE_LABELS: Record<ScreenRoleType, string> = {
  entry: 'Wejściowy',
  core: 'Główny',
  detail: 'Szczegóły',
  settings: 'Ustawienia',
  modal: 'Modal',
};

export const ScreenMapPlanner: React.FC<{
  focusedScreenId?: string | null;
  onNavigateLiveTab?: (tab: StudioLiveTabId) => void;
  onOpenScreenInPrototyper?: (screenId: string) => void;
}> = ({ focusedScreenId, onNavigateLiveTab, onOpenScreenInPrototyper }) => {
  const {
    palette,
    depth,
    synth,
    haptic,
    engraving,
    patterns,
    activeScreenMap,
    setActiveScreenMap,
    savedScreenMaps,
    saveActiveScreenMap,
    loadScreenMapProject,
    removeScreenMapProject,
    setPendingImageGeneratorDraft,
    pulseInteraction,
  } = useStudio();

  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    activeScreenMap.nodes[0]?.id || ''
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(
    activeScreenMap.edges[0]?.id || null
  );
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [previewToggleTarget, setPreviewToggleTarget] = useState(false);

  // Add screen form state
  const [newScreenTitle, setNewScreenTitle] = useState('');
  const [newScreenRoute, setNewScreenRoute] = useState('');
  const [newScreenRole, setNewScreenRole] = useState<ScreenRoleType>('core');

  // Add connection form state
  const [edgeFromId, setEdgeFromId] = useState<string>(
    activeScreenMap.nodes[0]?.id || ''
  );
  const [edgeToId, setEdgeToId] = useState<string>(
    activeScreenMap.nodes[1]?.id || activeScreenMap.nodes[0]?.id || ''
  );
  const [edgeTrigger, setEdgeTrigger] = useState('Kliknięcie akcji');
  const [edgeTransition, setEdgeTransition] =
    useState<ScreenTransitionPresetId>('spatial-glass-push');

  const [copiedMermaid, setCopiedMermaid] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [inspectorPromptFormat, setInspectorPromptFormat] =
    useState<ScreenImageViewportFormat>('desktop-16-9');
  const [copiedPromptNodeId, setCopiedPromptNodeId] = useState<string | null>(null);
  const [dragHoverNodeId, setDragHoverNodeId] = useState<string | null>(null);

  // Dragging state via refs for smooth 60fps pointer updates
  const draggingNodeRef = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    if (
      focusedScreenId &&
      activeScreenMap.nodes.some((n) => n.id === focusedScreenId)
    ) {
      setSelectedNodeId(focusedScreenId);
    } else if (
      !activeScreenMap.nodes.some((n) => n.id === selectedNodeId) &&
      activeScreenMap.nodes[0]
    ) {
      setSelectedNodeId(activeScreenMap.nodes[0].id);
    }
    if (activeScreenMap.nodes[0] && !activeScreenMap.nodes.some((n) => n.id === edgeFromId)) {
      setEdgeFromId(activeScreenMap.nodes[0].id);
    }
    if (activeScreenMap.nodes[1] && !activeScreenMap.nodes.some((n) => n.id === edgeToId)) {
      setEdgeToId(activeScreenMap.nodes[1].id);
    }
  }, [activeScreenMap, focusedScreenId, selectedNodeId, edgeFromId, edgeToId]);

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

  const selectedNode = useMemo(
    () => activeScreenMap.nodes.find((n) => n.id === selectedNodeId) || null,
    [activeScreenMap.nodes, selectedNodeId]
  );

  const selectedEdge = useMemo(
    () => activeScreenMap.edges.find((e) => e.id === selectedEdgeId) || null,
    [activeScreenMap.edges, selectedEdgeId]
  );

  const nodePromptSpecsById = useMemo(() => {
    const map: Record<string, ReturnType<typeof generateScreenImagePrompt>> = {};
    for (const node of activeScreenMap.nodes) {
      map[node.id] = generateScreenImagePrompt({
        node,
        mapProject: activeScreenMap,
        palette,
        depth,
        engraving,
        format: inspectorPromptFormat,
        language: 'en-with-pl-labels',
        visualStyle: 'tactile-glass',
      });
    }
    return map;
  }, [activeScreenMap, palette, depth, engraving, inspectorPromptFormat]);

  const selectedNodePromptSpec = selectedNode
    ? nodePromptSpecsById[selectedNode.id] || null
    : null;

  const handleCopyNodeImagePrompt = async (nodeId: string, promptText: string) => {
    const ok = await copyTextToClipboard(promptText);
    if (ok) {
      setCopiedPromptNodeId(nodeId);
      hapticAudio.triggerPress(synth, haptic, patterns);
      pulseInteraction(0.85);
      window.setTimeout(() => {
        setCopiedPromptNodeId((prev) => (prev === nodeId ? null : prev));
      }, 1900);
    }
  };

  const updateSelectedNode = (patch: Partial<DesignedScreenNode>) => {
    if (!selectedNode) return;
    setActiveScreenMap((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === selectedNode.id ? { ...n, ...patch } : n)),
    }));
  };

  const handleAddScreenNode = (e: React.FormEvent) => {
    e.preventDefault();
    const index = activeScreenMap.nodes.length + 1;
    const title = newScreenTitle.trim() || `Nowy Ekran #${index}`;
    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const rawRoute = newScreenRoute.trim() || `/${slug || `ekran-${index}`}`;
    const route = rawRoute.startsWith('/') ? rawRoute : `/${rawRoute}`;

    const newNode: DesignedScreenNode = {
      id: `scr-custom-${Date.now()}`,
      title,
      route,
      role: newScreenRole,
      status: 'designing',
      summary: 'Nowo zaplanowany ekran w architekturze przepływu użytkownika.',
      components: ['HeaderSection', 'MainContentCard', 'TactileActionCTA'],
      hapticMaterial: haptic.material,
      preferredTransition: activeScreenMap.defaultTransition,
      x: 80 + ((index - 1) % 4) * 320,
      y: 70 + Math.floor((index - 1) / 4) * 180,
    };

    setActiveScreenMap((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
    setSelectedNodeId(newNode.id);
    setNewScreenTitle('');
    setNewScreenRoute('');
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.95);
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedNode || activeScreenMap.nodes.length <= 1) return;
    const deletedId = selectedNode.id;
    setActiveScreenMap((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== deletedId),
      edges: prev.edges.filter(
        (e) => e.fromScreenId !== deletedId && e.toScreenId !== deletedId
      ),
    }));
    hapticAudio.triggerReleaseReverseClutch(haptic);
  };

  const handleAddEdge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!edgeFromId || !edgeToId || edgeFromId === edgeToId) return;
    const newEdge: ScreenMapEdge = {
      id: `edge-${Date.now()}`,
      fromScreenId: edgeFromId,
      toScreenId: edgeToId,
      triggerLabel: edgeTrigger.trim() || 'Nawiguj',
      transitionId: edgeTransition,
    };
    setActiveScreenMap((prev) => ({
      ...prev,
      edges: [...prev.edges, newEdge],
    }));
    setSelectedEdgeId(newEdge.id);
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.9);
  };

  const handleDeleteEdge = (edgeId: string) => {
    setActiveScreenMap((prev) => ({
      ...prev,
      edges: prev.edges.filter((e) => e.id !== edgeId),
    }));
    if (selectedEdgeId === edgeId) {
      setSelectedEdgeId(null);
    }
    hapticAudio.triggerReleaseReverseClutch(haptic);
  };

  const handleAutoLayout = () => {
    const roleCol: Record<ScreenRoleType, number> = {
      entry: 0,
      core: 1,
      detail: 2,
      settings: 2,
      modal: 3,
    };
    const counts: Record<number, number> = {};
    setActiveScreenMap((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) => {
        const col = roleCol[node.role] ?? 1;
        const row = counts[col] ?? 0;
        counts[col] = row + 1;
        return {
          ...node,
          x: 60 + col * 330,
          y: 55 + row * 175,
        };
      }),
    }));
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(1.0);
  };

  const handleCopyMermaid = async () => {
    const diagram = serializeScreenMapToMermaid(activeScreenMap, {
      direction: 'LR',
      groupByRole: true,
      includeMetadataComments: true,
      wrapInMarkdown: false,
    });
    try {
      await navigator.clipboard.writeText(diagram);
      hapticAudio.triggerPress(synth, haptic, patterns);
      setCopiedMermaid(true);
      window.setTimeout(() => setCopiedMermaid(false), 1800);
    } catch {
      // Ignore
    }
  };

  const handleDownloadMermaidFile = () => {
    const diagram = serializeScreenMapToMermaid(activeScreenMap, {
      direction: 'LR',
      groupByRole: true,
      includeMetadataComments: true,
      wrapInMarkdown: false,
    });
    const base = `architektura-${slugifyExportName(activeScreenMap.name || activeScreenMap.sourceRepo)}`;
    downloadLocalArchitectureFile(diagram, `${base}.mmd`, 'text/vnd.mermaid');
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.85);
  };

  const handleExportMapJson = () => {
    const jsonPayload = serializeScreenMapToJson(activeScreenMap, {
      includeTransitionSpecs: true,
    });
    const base = `architektura-${slugifyExportName(activeScreenMap.name || activeScreenMap.sourceRepo)}`;
    downloadLocalArchitectureFile(
      jsonPayload,
      `${base}.json`,
      'application/json'
    );
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.85);
  };

  const handleSaveProject = async () => {
    await saveActiveScreenMap(activeScreenMap.name);
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 1800);
  };

  // Compute canvas dimensions dynamically from node positions
  const canvasWidth = useMemo(() => {
    const maxX = activeScreenMap.nodes.reduce(
      (acc, n) => Math.max(acc, n.x + NODE_WIDTH + 90),
      1380
    );
    return maxX;
  }, [activeScreenMap.nodes]);

  const canvasHeight = useMemo(() => {
    const maxY = activeScreenMap.nodes.reduce(
      (acc, n) => Math.max(acc, n.y + NODE_HEIGHT + 80),
      560
    );
    return maxY;
  }, [activeScreenMap.nodes]);

  // Selected edge live transition preview data
  const edgePreviewData = useMemo(() => {
    if (!selectedEdge) return null;
    const fromNode = activeScreenMap.nodes.find((n) => n.id === selectedEdge.fromScreenId);
    const toNode = activeScreenMap.nodes.find((n) => n.id === selectedEdge.toScreenId);
    const spec =
      SCREEN_TRANSITION_PRESETS.find((t) => t.id === selectedEdge.transitionId) ||
      SCREEN_TRANSITION_PRESETS[0];
    if (!fromNode || !toNode) return null;
    return { fromNode, toNode, spec };
  }, [selectedEdge, activeScreenMap.nodes]);

  return (
    <section
      style={cardSurfaceStyle}
      className="p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-6"
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
            <span>Usługa Planowania i Budowania Mapy Ekranów</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {activeScreenMap.nodes.length} węzłów · {activeScreenMap.edges.length} połączeń
            </span>
            <span aria-hidden="true">·</span>
            <span>Źródło: {activeScreenMap.sourceRepo}</span>
          </div>
          <input
            type="text"
            value={activeScreenMap.name}
            aria-label="Nazwa projektu mapy ekranów"
            onChange={(e) =>
              setActiveScreenMap((prev) => ({ ...prev, name: e.target.value }))
            }
            className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-emerald-50 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-emerald-400/30 focus:border-indigo-500 focus:outline-none w-full"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAutoLayout}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/80 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white whitespace-nowrap shrink-0"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Auto-układ kolumn</span>
          </button>

          <button
            type="button"
            onClick={handleCopyMermaid}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/80 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white whitespace-nowrap shrink-0"
          >
            {copiedMermaid ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedMermaid ? 'Skopiowano Mermaid' : 'Kopiuj Mermaid'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadMermaidFile}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/80 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white whitespace-nowrap shrink-0"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Pobierz Mermaid (.mmd)</span>
          </button>

          <button
            type="button"
            onClick={handleExportMapJson}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/80 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white whitespace-nowrap shrink-0"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>Pobierz JSON (.json)</span>
          </button>

          <button
            type="button"
            onClick={handleSaveProject}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap shrink-0"
          >
            {savedToast ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{savedToast ? 'Zapisano mapę' : 'Zapisz mapę ekranów'}</span>
          </button>
        </div>
      </div>

      {/* Saved Screen Map Projects Bar + Zoom Control */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600 dark:text-emerald-200/80">
            Zapisane mapy ({savedScreenMaps.length}):
          </span>
          {savedScreenMaps.slice(0, 5).map((proj) => {
            const isCurrent = proj.id === activeScreenMap.id;
            const isDeletable = proj.id !== 'aether-studio-master-map';
            return (
              <div
                key={proj.id}
                className={`inline-flex items-center rounded-xl border text-xs transition-colors ${
                  isCurrent
                    ? isDark
                      ? 'bg-emerald-900/80 border-emerald-300/70 text-emerald-50'
                      : 'bg-white border-indigo-500 text-slate-900 shadow-sm'
                    : 'bg-white/55 dark:bg-emerald-950/45 border-slate-200/80 dark:border-emerald-400/20 text-slate-700 dark:text-emerald-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => loadScreenMapProject(proj)}
                  className="px-3 py-1.5 font-medium cursor-pointer truncate max-w-[210px]"
                >
                  {proj.name}
                </button>
                {isDeletable && (
                  <button
                    type="button"
                    aria-label={`Usuń mapę ${proj.name}`}
                    onClick={() => removeScreenMapProject(proj.id)}
                    className="pr-2.5 pl-1 py-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-emerald-950/80 text-xs font-mono tabular-nums">
          {[0.8, 1, 1.15].map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoomScale(z)}
              className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                zoomScale === z
                  ? isDark
                    ? 'bg-emerald-400 text-emerald-950 font-semibold'
                    : 'bg-white text-slate-900 font-semibold shadow-sm'
                  : 'text-slate-600 dark:text-emerald-200/75'
              }`}
            >
              {Math.round(z * 100)}%
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Draggable DAG Screen Flow Canvas */}
      <div className="rounded-2xl border border-slate-300/75 dark:border-emerald-400/25 bg-slate-100/90 dark:bg-[#051310] overflow-auto max-h-[580px] relative">
        <div
          style={{
            width: `${Math.round(canvasWidth * zoomScale)}px`,
            height: `${Math.round(canvasHeight * zoomScale)}px`,
          }}
          className="relative"
        >
          <div
            style={{
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
              transform: `scale(${zoomScale})`,
              transformOrigin: 'top left',
              backgroundImage: isDark
                ? 'radial-gradient(rgba(110, 231, 183, 0.16) 1px, transparent 1px)'
                : 'radial-gradient(rgba(100, 116, 139, 0.22) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
            className="relative select-none"
          >
            {/* SVG Directed Transition Edges */}
            <svg
              width={canvasWidth}
              height={canvasHeight}
              className="absolute inset-0 pointer-events-none"
            >
              <defs>
                <marker
                  id="screen-map-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path
                    d="M 0 1 L 9 5 L 0 9 z"
                    fill={isDark ? '#6ee7b7' : '#4f46e5'}
                  />
                </marker>
              </defs>

              {activeScreenMap.edges.map((edge) => {
                const from = activeScreenMap.nodes.find((n) => n.id === edge.fromScreenId);
                const to = activeScreenMap.nodes.find((n) => n.id === edge.toScreenId);
                if (!from || !to) return null;

                const startX = from.x + NODE_WIDTH;
                const startY = from.y + NODE_HEIGHT / 2;
                const endX = to.x;
                const endY = to.y + NODE_HEIGHT / 2;
                const deltaX = Math.max(70, Math.abs(endX - startX) * 0.5);

                const pathD = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${
                  endX - deltaX
                } ${endY}, ${endX} ${endY}`;

                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2;
                const isEdgeActive = selectedEdgeId === edge.id;
                const transSpec = SCREEN_TRANSITION_PRESETS.find(
                  (t) => t.id === edge.transitionId
                );

                return (
                  <g key={edge.id}>
                    <path
                      d={pathD}
                      fill="none"
                      stroke={
                        isEdgeActive
                          ? isDark
                            ? '#34d399'
                            : '#4f46e5'
                          : isDark
                            ? 'rgba(110, 231, 183, 0.48)'
                            : 'rgba(79, 70, 229, 0.42)'
                      }
                      strokeWidth={isEdgeActive ? 2.8 : 1.8}
                      markerEnd="url(#screen-map-arrow)"
                    />

                    {/* Clickable Edge Label */}
                    <foreignObject
                      x={midX - 88}
                      y={midY - 18}
                      width={176}
                      height={36}
                      className="pointer-events-auto"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEdgeId(edge.id);
                          setPreviewToggleTarget((p) => !p);
                          hapticAudio.triggerPress(synth, haptic, patterns);
                        }}
                        className={`w-full px-2 py-1 rounded-lg border text-[10px] font-mono truncate cursor-pointer shadow-xs transition-colors ${
                          isEdgeActive
                            ? isDark
                              ? 'bg-emerald-400 text-emerald-950 border-emerald-200 font-semibold'
                              : 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                            : 'bg-white/92 dark:bg-emerald-950/92 text-slate-700 dark:text-emerald-100 border-slate-200 dark:border-emerald-400/25'
                        }`}
                        title={`${edge.triggerLabel} (${transSpec?.name || edge.transitionId})`}
                      >
                        {edge.triggerLabel} ·{' '}
                        {transSpec?.name.replace(/^0\d\.\s*/, '').split(' ')[0] || 'Push'}
                      </button>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>

            {/* Draggable Screen Cards */}
            {activeScreenMap.nodes.map((node) => {
              const isSelected = node.id === selectedNodeId;
              const isDropHover = dragHoverNodeId === node.id;
              const nodePromptSpec = nodePromptSpecsById[node.id];
              const isPromptCopied = copiedPromptNodeId === node.id;
              return (
                <div
                  key={node.id}
                  style={{
                    width: `${NODE_WIDTH}px`,
                    height: `${NODE_HEIGHT}px`,
                    transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                  }}
                  onDragOver={(e) => {
                    if (!hasTactileCatalogDrag(e)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    if (dragHoverNodeId !== node.id) {
                      setDragHoverNodeId(node.id);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                      setDragHoverNodeId((prev) => (prev === node.id ? null : prev));
                    }
                  }}
                  onDrop={(e) => {
                    if (!hasTactileCatalogDrag(e)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setDragHoverNodeId(null);
                    const item = parseCatalogItemFromDrop(e);
                    setActiveDraggedCatalogItem(null);
                    if (!item) return;
                    setSelectedNodeId(node.id);
                    setActiveScreenMap((prev) => ({
                      ...prev,
                      nodes: prev.nodes.map((n) =>
                        n.id === node.id ? appendCatalogWidgetToNode(n, item) : n
                      ),
                    }));
                    hapticAudio.triggerPress(synth, haptic, patterns, {
                      material: item.recommendedMaterial,
                      pitchSemitones: 3,
                    });
                    pulseInteraction(1.0);
                  }}
                  onPointerDown={(e) => {
                    setSelectedNodeId(node.id);
                    draggingNodeRef.current = {
                      id: node.id,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      originX: node.x,
                      originY: node.y,
                    };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const drag = draggingNodeRef.current;
                    if (!drag || drag.id !== node.id) return;
                    const dx = (e.clientX - drag.startClientX) / zoomScale;
                    const dy = (e.clientY - drag.startClientY) / zoomScale;
                    const snappedX = Math.max(20, Math.round((drag.originX + dx) / 10) * 10);
                    const snappedY = Math.max(20, Math.round((drag.originY + dy) / 10) * 10);
                    setActiveScreenMap((prev) => ({
                      ...prev,
                      nodes: prev.nodes.map((item) =>
                        item.id === node.id ? { ...item, x: snappedX, y: snappedY } : item
                      ),
                    }));
                  }}
                  onPointerUp={(e) => {
                    if (!draggingNodeRef.current) return;
                    draggingNodeRef.current = null;
                    e.currentTarget.releasePointerCapture(e.pointerId);
                    hapticAudio.triggerSliderTick(haptic, 0.5);
                  }}
                  className={`absolute top-0 left-0 p-3.5 rounded-2xl border flex flex-col justify-between cursor-grab active:cursor-grabbing touch-none transition-shadow ${
                    isDropHover
                      ? isDark
                        ? 'bg-emerald-900 border-emerald-300 shadow-lg ring-2 ring-emerald-300/70'
                        : 'bg-indigo-50 border-indigo-600 shadow-lg ring-2 ring-indigo-500/50'
                      : isSelected
                        ? isDark
                          ? 'bg-emerald-900/95 border-emerald-300 shadow-lg ring-1 ring-emerald-300/60'
                          : 'bg-white border-indigo-600 shadow-lg ring-1 ring-indigo-500/40'
                        : 'bg-white/92 dark:bg-emerald-950/90 border-slate-200/90 dark:border-emerald-400/25 shadow-sm hover:border-indigo-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono tabular-nums text-slate-500 dark:text-emerald-300/80">
                      <span className="truncate">{node.route}</span>
                      <span className="shrink-0">
                        {ROLE_LABELS[node.role]} · {nodePromptSpec?.totalButtons ?? 0} przyc.
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-emerald-50 truncate mt-1">
                      {node.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-emerald-200/75 line-clamp-2 mt-0.5 leading-snug">
                      {node.summary}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono tabular-nums text-slate-600 dark:text-emerald-200/85 pt-1.5 border-t border-slate-200/70 dark:border-emerald-400/15">
                    <span className="truncate">
                      {node.components.slice(0, 2).join(', ')}
                    </span>
                    {nodePromptSpec && (
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNodeId(node.id);
                          void handleCopyNodeImagePrompt(node.id, nodePromptSpec.promptText);
                        }}
                        title="Kopiuj prompt do generatora obrazów z dokładną liczbą i rozmieszczeniem przycisków"
                        className={`px-2 py-0.5 rounded-md border inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                          isPromptCopied
                            ? isDark
                              ? 'bg-emerald-400 text-emerald-950 border-emerald-300 font-semibold'
                              : 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                            : 'bg-slate-100/90 dark:bg-emerald-900/70 border-slate-200 dark:border-emerald-400/25 text-slate-700 dark:text-emerald-100 hover:border-indigo-400'
                        }`}
                      >
                        {isPromptCopied ? (
                          <Check className="w-2.5 h-2.5" />
                        ) : (
                          <Copy className="w-2.5 h-2.5" />
                        )}
                        <span>{isPromptCopied ? 'Skopiowano' : 'Prompt'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Edge Transition Mini-Preview Bar */}
      {edgePreviewData && selectedEdge && (
        <div className="p-4 rounded-2xl bg-white/75 dark:bg-emerald-950/70 border border-indigo-200/80 dark:border-emerald-400/25 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="text-xs font-mono tabular-nums text-indigo-700 dark:text-emerald-300 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              <span>
                Wybrane połączenie: {edgePreviewData.fromNode.route} →{' '}
                {edgePreviewData.toNode.route}
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
              Wyzwalacz: „{selectedEdge.triggerLabel}” · Animacja:{' '}
              {edgePreviewData.spec.name.replace(/^0\d\.\s*/, '')}
            </div>
          </div>

          <div
            style={{ perspective: 900 }}
            className="h-16 w-full lg:w-72 rounded-xl bg-slate-100 dark:bg-[#061512] border border-slate-200 dark:border-emerald-400/20 overflow-hidden px-3 flex items-center justify-center shrink-0"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedEdge.id}-${previewToggleTarget ? 'to' : 'from'}`}
                initial={edgePreviewData.spec.enterInitial}
                animate={edgePreviewData.spec.enterAnimate}
                exit={edgePreviewData.spec.exitTarget}
                transition={{
                  type: 'spring',
                  stiffness: edgePreviewData.spec.spring.stiffness,
                  damping: edgePreviewData.spec.spring.damping,
                  mass: edgePreviewData.spec.spring.mass,
                }}
                className="w-full py-2 px-3 rounded-lg bg-white dark:bg-emerald-900/80 border border-slate-200 dark:border-emerald-400/25 text-xs font-mono text-slate-800 dark:text-emerald-100 flex items-center justify-between"
              >
                <span className="truncate font-sans font-semibold">
                  {previewToggleTarget
                    ? edgePreviewData.toNode.title
                    : edgePreviewData.fromNode.title}
                </span>
                <span className="text-[10px] opacity-75 shrink-0 ml-2">
                  {previewToggleTarget
                    ? edgePreviewData.toNode.route
                    : edgePreviewData.fromNode.route}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              aria-label="Zmień animację przejścia połączenia"
              value={selectedEdge.transitionId}
              onChange={(e) => {
                const nextId = e.target.value as ScreenTransitionPresetId;
                setActiveScreenMap((prev) => ({
                  ...prev,
                  edges: prev.edges.map((ed) =>
                    ed.id === selectedEdge.id ? { ...ed, transitionId: nextId } : ed
                  ),
                }));
                setPreviewToggleTarget((p) => !p);
                hapticAudio.triggerPress(synth, haptic, patterns);
              }}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs bg-white dark:bg-emerald-950 border border-slate-200 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100"
            >
              {SCREEN_TRANSITION_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setPreviewToggleTarget((p) => !p);
                hapticAudio.triggerPress(synth, haptic, patterns);
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3 h-3" />
              <span>Testuj skok</span>
            </button>

            <button
              type="button"
              onClick={() => handleDeleteEdge(selectedEdge.id)}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-emerald-950 border border-slate-200 dark:border-emerald-400/25 text-rose-600 dark:text-rose-300 text-xs inline-flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Usuń krawędź</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom 12-Col Builder Panel: Left (Selected Screen Inspector) | Right (Add New Screen + Add Edge Connection) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 6 Columns: Selected Screen Node Inspector */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-white/65 dark:bg-emerald-950/55 border border-slate-200/80 dark:border-emerald-400/20 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-emerald-50">
              Inspektor Wybranego Ekranu
            </h3>
            <div className="flex items-center gap-2">
              {selectedNode && onOpenScreenInPrototyper && (
                <button
                  type="button"
                  onClick={() => onOpenScreenInPrototyper(selectedNode.id)}
                  className="min-h-[36px] px-3 py-1 rounded-xl text-xs font-medium bg-indigo-50 dark:bg-emerald-900/70 text-indigo-800 dark:text-emerald-100 border border-indigo-200/80 dark:border-emerald-400/25 cursor-pointer whitespace-nowrap"
                >
                  Prototypuj Drag &amp; Drop
                </button>
              )}
              {selectedNode && activeScreenMap.nodes.length > 1 && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedNode}
                  className="min-h-[36px] px-3 py-1 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Usuń ekran</span>
                </button>
              )}
            </div>
          </div>

          {selectedNode ? (
            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-emerald-200/80 block">
                    Tytuł ekranu
                  </span>
                  <input
                    type="text"
                    value={selectedNode.title}
                    onChange={(e) => updateSelectedNode({ title: e.target.value })}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-emerald-200/80 block">
                    Ścieżka routingu (Route)
                  </span>
                  <input
                    type="text"
                    value={selectedNode.route}
                    onChange={(e) => updateSelectedNode({ route: e.target.value })}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl font-mono bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-emerald-200/80 block">
                    Rola w architekturze
                  </span>
                  <select
                    value={selectedNode.role}
                    onChange={(e) =>
                      updateSelectedNode({ role: e.target.value as ScreenRoleType })
                    }
                    className="w-full min-h-[40px] px-2.5 py-2 rounded-xl bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50"
                  >
                    <option value="entry">Wejściowy</option>
                    <option value="core">Główny</option>
                    <option value="detail">Szczegóły</option>
                    <option value="settings">Ustawienia</option>
                    <option value="modal">Modal / Arkusz</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-emerald-200/80 block">
                    Status projektu
                  </span>
                  <select
                    value={selectedNode.status}
                    onChange={(e) =>
                      updateSelectedNode({
                        status: e.target.value as ScreenDesignStatus,
                      })
                    }
                    className="w-full min-h-[40px] px-2.5 py-2 rounded-xl bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50"
                  >
                    <option value="designing">W projekcie</option>
                    <option value="review">Do przeglądu</option>
                    <option value="ready">Gotowy</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-emerald-200/80 block">
                    Materiał haptyczny
                  </span>
                  <select
                    value={selectedNode.hapticMaterial}
                    onChange={(e) =>
                      updateSelectedNode({
                        hapticMaterial: e.target.value as HapticMaterialType,
                      })
                    }
                    className="w-full min-h-[40px] px-2.5 py-2 rounded-xl bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50"
                  >
                    {(Object.keys(MATERIAL_PROFILES) as HapticMaterialType[]).map((m) => (
                      <option key={m} value={m}>
                        {MATERIAL_PROFILES[m].label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1 block">
                <span className="text-slate-600 dark:text-emerald-200/80 block">
                  Domyślna animacja wejścia na ekran
                </span>
                <select
                  value={selectedNode.preferredTransition}
                  onChange={(e) =>
                    updateSelectedNode({
                      preferredTransition: e.target.value as ScreenTransitionPresetId,
                    })
                  }
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50"
                >
                  {SCREEN_TRANSITION_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.durationMs} ms)
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-600 dark:text-emerald-200/80 block">
                  Komponenty na ekranie (oddzielone przecinkami)
                </span>
                <input
                  type="text"
                  value={selectedNode.components.join(', ')}
                  onChange={(e) =>
                    updateSelectedNode({
                      components: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl font-mono bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-600 dark:text-emerald-200/80 block">
                  Opis funkcjonalny ekranu
                </span>
                <textarea
                  rows={2}
                  value={selectedNode.summary}
                  onChange={(e) => updateSelectedNode({ summary: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50"
                />
              </label>

              {/* Direct Image Generator Prompt Subsection for Selected Screen */}
              {selectedNodePromptSpec && (
                <div className="pt-3.5 border-t border-slate-200/80 dark:border-emerald-400/20 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-emerald-50 block">
                        Prompt do Generatora Obrazów (Rozmieszczenie Przycisków)
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-emerald-300/80">
                        {selectedNodePromptSpec.summaryLinePl}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-emerald-900/60 font-mono tabular-nums text-[11px]">
                      {(
                        [
                          ['desktop-16-9', '16:9'],
                          ['mobile-9-16', '9:16'],
                          ['tablet-4-3', '4:3'],
                        ] as [ScreenImageViewportFormat, string][]
                      ).map(([fmt, lbl]) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setInspectorPromptFormat(fmt)}
                          className={`px-2 py-1 rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                            inspectorPromptFormat === fmt
                              ? isDark
                                ? 'bg-emerald-400 text-emerald-950 font-semibold'
                                : 'bg-white text-slate-900 font-semibold shadow-xs'
                              : 'text-slate-600 dark:text-emerald-200/80'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    readOnly
                    rows={5}
                    aria-label="Wygenerowany prompt do generatora obrazów dla wybranego ekranu"
                    value={selectedNodePromptSpec.promptText}
                    className="w-full px-3 py-2 rounded-xl font-mono text-[11px] leading-relaxed bg-slate-50 dark:bg-[#061512] border border-slate-200 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopyNodeImagePrompt(
                          selectedNode.id,
                          selectedNodePromptSpec.promptText
                        )
                      }
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap shrink-0"
                    >
                      {copiedPromptNodeId === selectedNode.id ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {copiedPromptNodeId === selectedNode.id
                          ? 'Skopiowano prompt obrazu'
                          : `Kopiuj prompt (${selectedNodePromptSpec.totalButtons} przyc.)`}
                      </span>
                    </button>

                    {onNavigateLiveTab && (
                      <button
                        type="button"
                        onClick={() => {
                          setPendingImageGeneratorDraft({
                            prompt: selectedNodePromptSpec.promptText,
                            aspectRatio: selectedNodePromptSpec.aspectRatio,
                            screenTitle: selectedNode.title,
                          });
                          hapticAudio.triggerPress(synth, haptic, patterns);
                          onNavigateLiveTab('gemini');
                        }}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        <span>Otwórz w Generatorze Obrazów</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Right 6 Columns: Add New Screen + Connect Screens */}
        <div className="lg:col-span-6 space-y-5">
          {/* Add Screen Form */}
          <form
            onSubmit={handleAddScreenNode}
            className="p-5 rounded-2xl bg-white/65 dark:bg-emerald-950/55 border border-slate-200/80 dark:border-emerald-400/20 space-y-3.5 text-xs"
          >
            <h3 className="text-base font-semibold text-slate-900 dark:text-emerald-50">
              Dodaj Nowy Projektowany Ekran do Mapy
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={newScreenTitle}
                onChange={(e) => setNewScreenTitle(e.target.value)}
                placeholder="Nazwa ekranu (np. Koszyk)"
                className="min-h-[40px] px-3 py-2 rounded-xl bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50"
              />
              <input
                type="text"
                value={newScreenRoute}
                onChange={(e) => setNewScreenRoute(e.target.value)}
                placeholder="Ścieżka (np. /checkout)"
                className="min-h-[40px] px-3 py-2 rounded-xl font-mono bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50"
              />
              <select
                value={newScreenRole}
                onChange={(e) => setNewScreenRole(e.target.value as ScreenRoleType)}
                className="min-h-[40px] px-2.5 py-2 rounded-xl bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50"
              >
                <option value="entry">Rola: Wejściowy</option>
                <option value="core">Rola: Główny</option>
                <option value="detail">Rola: Szczegóły</option>
                <option value="settings">Rola: Ustawienia</option>
                <option value="modal">Rola: Modal</option>
              </select>
            </div>

            <button
              type="submit"
              className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Dodaj ekran na płótno</span>
            </button>
          </form>

          {/* Add Edge Connection Form */}
          <form
            onSubmit={handleAddEdge}
            className="p-5 rounded-2xl bg-white/65 dark:bg-emerald-950/55 border border-slate-200/80 dark:border-emerald-400/20 space-y-3.5 text-xs"
          >
            <h3 className="text-base font-semibold text-slate-900 dark:text-emerald-50">
              Zbuduj Połączenie i Przypisz Animację Przejścia
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="space-y-1">
                <span className="text-slate-600 dark:text-emerald-200/80 block">
                  Z ekranu (źródło)
                </span>
                <select
                  value={edgeFromId}
                  onChange={(e) => setEdgeFromId(e.target.value)}
                  className="w-full min-h-[40px] px-2.5 py-2 rounded-xl bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50"
                >
                  {activeScreenMap.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.route} — {n.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-slate-600 dark:text-emerald-200/80 block">
                  Do ekranu (cel)
                </span>
                <select
                  value={edgeToId}
                  onChange={(e) => setEdgeToId(e.target.value)}
                  className="w-full min-h-[40px] px-2.5 py-2 rounded-xl bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50"
                >
                  {activeScreenMap.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.route} — {n.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="space-y-1">
                <span className="text-slate-600 dark:text-emerald-200/80 block">
                  Akcja wyzwalająca (Trigger)
                </span>
                <input
                  type="text"
                  value={edgeTrigger}
                  onChange={(e) => setEdgeTrigger(e.target.value)}
                  placeholder="np. Kliknięcie przycisku Dalej"
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50"
                />
              </label>

              <label className="space-y-1">
                <span className="text-slate-600 dark:text-emerald-200/80 block">
                  Animacja przejścia z biblioteki
                </span>
                <select
                  value={edgeTransition}
                  onChange={(e) =>
                    setEdgeTransition(e.target.value as ScreenTransitionPresetId)
                  }
                  className="w-full min-h-[40px] px-2.5 py-2 rounded-xl bg-white dark:bg-emerald-950/80 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50"
                >
                  {SCREEN_TRANSITION_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="submit"
              disabled={edgeFromId === edgeToId}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 disabled:opacity-50 whitespace-nowrap"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Połącz ekrany na mapie</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
