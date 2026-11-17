import React, { useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  PlugZap,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  buildHostIntegrationSnippet,
  dispatchLivePluginTestSignal,
  INTEGRATION_KIND_LABELS,
  PLUGIN_SCOPE_LABELS,
  StudioPluginExportContext,
} from '../lib/externalAppPlugins';
import { copyTextToClipboard } from '../lib/screenImagePromptGenerator';
import {
  ExternalAppPlugin,
  ExternalPluginDataScope,
  ExternalPluginIntegrationKind,
} from '../types/studio';

const ALL_SCOPES: ExternalPluginDataScope[] = [
  'design-tokens',
  'haptics-audio',
  'screen-map',
  'generated-tsx',
];

const ALL_KINDS: ExternalPluginIntegrationKind[] = [
  'postmessage-bridge',
  'embed-sdk',
  'webhook-rest',
  'design-ide-manifest',
  'engine-3d-osc',
];

const ExternalPluginsContent: React.FC = () => {
  const {
    palette,
    depth,
    engraving,
    synth,
    haptic,
    activeScreenMap,
    generatedElements,
    externalPlugins,
    toggleExternalPlugin,
    addCustomExternalPlugin,
    updateExternalPluginEndpoint,
    removeExternalPlugin,
  } = useStudio();

  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'custom'>('all');
  const [showCreator, setShowCreator] = useState<boolean>(false);
  const [targetAppName, setTargetAppName] = useState<string>('');
  const [pluginTitle, setPluginTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [integrationKind, setIntegrationKind] =
    useState<ExternalPluginIntegrationKind>('postmessage-bridge');
  const [endpointOrUri, setEndpointOrUri] = useState<string>('https://');
  const [scopes, setScopes] = useState<ExternalPluginDataScope[]>([
    'design-tokens',
    'screen-map',
    'generated-tsx',
  ]);

  const [expandedCodePluginId, setExpandedCodePluginId] = useState<string | null>(
    null
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testMessages, setTestMessages] = useState<Record<string, string>>({});

  const isDark = palette === 'emerald-clinic';

  const pluginExportCtx: StudioPluginExportContext = useMemo(
    () => ({
      palette,
      depth,
      engraving,
      synth,
      haptic,
      screenMap: activeScreenMap,
      generatedElements,
    }),
    [
      palette,
      depth,
      engraving,
      synth,
      haptic,
      activeScreenMap,
      generatedElements,
    ]
  );

  const visiblePlugins = useMemo(() => {
    return externalPlugins.filter((p) => {
      if (filterMode === 'active') return p.enabled;
      if (filterMode === 'custom') return p.isCustom;
      return true;
    });
  }, [externalPlugins, filterMode]);

  const handleToggleScope = (sc: ExternalPluginDataScope) => {
    setScopes((prev) =>
      prev.includes(sc) ? prev.filter((x) => x !== sc) : [...prev, sc]
    );
  };

  const handleCreateCustomPlugin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAppName.trim()) return;
    addCustomExternalPlugin({
      targetAppName,
      pluginTitle:
        pluginTitle.trim() || `Mostek Aether dla ${targetAppName.trim()}`,
      description,
      integrationKind,
      endpointOrUri,
      scopes,
    });
    setTargetAppName('');
    setPluginTitle('');
    setDescription('');
    setEndpointOrUri('https://');
    setShowCreator(false);
  };

  const handleDownloadPluginFile = (plugin: ExternalAppPlugin) => {
    const snippet = buildHostIntegrationSnippet(plugin, pluginExportCtx);
    const blob = new Blob([snippet.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = snippet.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTestSignal = async (plugin: ExternalAppPlugin) => {
    const res = await dispatchLivePluginTestSignal(plugin, pluginExportCtx);
    setTestMessages((prev) => ({ ...prev, [plugin.id]: res.message }));
  };

  return (
    <div className="space-y-5">
      {/* Filter + Add Plugin Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-emerald-950/80">
          {(
            [
              ['all', `Wszystkie (${externalPlugins.length})`],
              [
                'active',
                `Aktywne (${externalPlugins.filter((p) => p.enabled).length})`,
              ],
              [
                'custom',
                `Własne (${externalPlugins.filter((p) => p.isCustom).length})`,
              ],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterMode(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
                filterMode === key
                  ? isDark
                    ? 'bg-emerald-400 text-emerald-950 font-semibold'
                    : 'bg-white text-slate-900 font-semibold shadow-sm'
                  : 'text-slate-600 dark:text-emerald-200/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowCreator((v) => !v)}
          className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 hover:opacity-95 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>
            {showCreator
              ? 'Ukryj formularz wtyczki'
              : 'Dodaj wtyczkę do innej aplikacji'}
          </span>
        </button>
      </div>

      {/* Custom External Application Plugin Creator */}
      {showCreator && (
        <form
          onSubmit={handleCreateCustomPlugin}
          className="p-5 rounded-2xl bg-white/85 dark:bg-emerald-950/80 border border-indigo-200/90 dark:border-emerald-400/30 space-y-4"
        >
          <div className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
            Nowa wtyczka integracyjna dla zewnętrznej aplikacji
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <span className="text-xs font-medium text-slate-700 dark:text-emerald-100">
                Docelowa aplikacja (np. Notion, Jira, Shopify, Obsidian, Webflow)
              </span>
              <input
                type="text"
                required
                value={targetAppName}
                onChange={(e) => setTargetAppName(e.target.value)}
                placeholder="np. Notion / Shopify / Własny CRM"
                className="w-full h-10 px-3 rounded-xl text-xs bg-white dark:bg-emerald-950 border border-slate-200 dark:border-emerald-400/25"
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-xs font-medium text-slate-700 dark:text-emerald-100">
                Tytuł wtyczki
              </span>
              <input
                type="text"
                value={pluginTitle}
                onChange={(e) => setPluginTitle(e.target.value)}
                placeholder="np. Synchronizacja komponentów i palet"
                className="w-full h-10 px-3 rounded-xl text-xs bg-white dark:bg-emerald-950 border border-slate-200 dark:border-emerald-400/25"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <span className="text-xs font-medium text-slate-700 dark:text-emerald-100">
                Mechanizm integracji
              </span>
              <select
                value={integrationKind}
                onChange={(e) =>
                  setIntegrationKind(
                    e.target.value as ExternalPluginIntegrationKind
                  )
                }
                className="w-full h-10 px-3 rounded-xl text-xs bg-white dark:bg-emerald-950 border border-slate-200 dark:border-emerald-400/25"
              >
                {ALL_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {INTEGRATION_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 block">
              <span className="text-xs font-medium text-slate-700 dark:text-emerald-100">
                Adres Endpoint / Origin URI aplikacji docelowej
              </span>
              <input
                type="text"
                value={endpointOrUri}
                onChange={(e) => setEndpointOrUri(e.target.value)}
                placeholder="https://twoja-aplikacja.pl/webhook lub *"
                className="w-full h-10 px-3 rounded-xl text-xs font-mono bg-white dark:bg-emerald-950 border border-slate-200 dark:border-emerald-400/25"
              />
            </label>
          </div>

          <label className="space-y-1 block">
            <span className="text-xs font-medium text-slate-700 dark:text-emerald-100">
              Opis działania wtyczki
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Krótki opis danych przekazywanych do zewnętrznej aplikacji..."
              className="w-full h-10 px-3 rounded-xl text-xs bg-white dark:bg-emerald-950 border border-slate-200 dark:border-emerald-400/25"
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-700 dark:text-emerald-100 block">
              Zakres eksportowanych danych projektu:
            </span>
            <div className="flex flex-wrap gap-2">
              {ALL_SCOPES.map((sc) => {
                const checked = scopes.includes(sc);
                return (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => handleToggleScope(sc)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
                      checked
                        ? isDark
                          ? 'bg-emerald-400 text-emerald-950 font-semibold'
                          : 'bg-slate-900 text-white font-semibold'
                        : 'bg-slate-100 dark:bg-emerald-900/60 text-slate-600 dark:text-emerald-200'
                    }`}
                  >
                    {PLUGIN_SCOPE_LABELS[sc]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowCreator(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-emerald-200 cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="submit"
              className="min-h-[40px] px-5 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 cursor-pointer whitespace-nowrap"
            >
              Utwórz i aktywuj wtyczkę
            </button>
          </div>
        </form>
      )}

      {/* Plugins Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visiblePlugins.map((plugin) => {
          const snippet = buildHostIntegrationSnippet(plugin, pluginExportCtx);
          const isCodeOpen = expandedCodePluginId === plugin.id;

          return (
            <div
              key={plugin.id}
              className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                plugin.enabled
                  ? 'bg-white/85 dark:bg-emerald-950/75 border-indigo-300/85 dark:border-emerald-400/40'
                  : 'bg-white/55 dark:bg-emerald-950/40 border-slate-200/80 dark:border-emerald-400/15'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-indigo-700 dark:text-emerald-300">
                      {plugin.targetAppName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{INTEGRATION_KIND_LABELS[plugin.integrationKind]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">v{plugin.version}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                    {plugin.pluginTitle}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-emerald-100/75 mt-1 leading-relaxed">
                    {plugin.description}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleExternalPlugin(plugin.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      plugin.enabled
                        ? isDark
                          ? 'bg-emerald-400 text-emerald-950'
                          : 'bg-slate-900 text-white'
                        : 'bg-slate-200/80 dark:bg-emerald-900/70 text-slate-700 dark:text-emerald-100'
                    }`}
                  >
                    {plugin.enabled ? 'Aktywna' : 'Wyłączona'}
                  </button>
                  {plugin.isCustom && (
                    <button
                      type="button"
                      onClick={() => removeExternalPlugin(plugin.id)}
                      aria-label={`Usuń wtyczkę ${plugin.pluginTitle}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={plugin.endpointOrUri}
                  aria-label={`Endpoint wtyczki ${plugin.pluginTitle}`}
                  onChange={(e) =>
                    updateExternalPluginEndpoint(plugin.id, e.target.value)
                  }
                  className="flex-1 h-8 px-2.5 rounded-lg text-[11px] font-mono bg-slate-100/90 dark:bg-emerald-900/55 border border-slate-200/80 dark:border-emerald-400/20 text-slate-800 dark:text-emerald-100"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedCodePluginId(isCodeOpen ? null : plugin.id)
                  }
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-emerald-900/70 text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{isCodeOpen ? 'Ukryj kod' : 'Kod integracyjny'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadPluginFile(plugin)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-emerald-900/70 text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pobierz wtyczkę</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTestSignal(plugin)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-emerald-800/75 text-indigo-800 dark:text-emerald-100 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Wyślij sygnał testowy</span>
                </button>
              </div>

              {testMessages[plugin.id] && (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-400/25 text-[11px] text-emerald-900 dark:text-emerald-100">
                  {testMessages[plugin.id]}
                </div>
              )}

              {isCodeOpen && (
                <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 text-slate-100">
                  <div className="px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>{snippet.fileName}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await copyTextToClipboard(snippet.code);
                        if (ok) {
                          setCopiedId(plugin.id);
                          window.setTimeout(() => setCopiedId(null), 1800);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-emerald-300 cursor-pointer"
                    >
                      {copiedId === plugin.id ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedId === plugin.id ? 'Skopiowano' : 'Kopiuj'}</span>
                    </button>
                  </div>
                  <pre className="p-3 text-[11px] font-mono overflow-x-auto max-h-48 leading-relaxed">
                    <code>{snippet.code}</code>
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ExternalPluginsSection: React.FC = () => {
  const { palette, depth, externalPlugins } = useStudio();
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

  const activeCount = externalPlugins.filter((p) => p.enabled).length;

  return (
    <section
      style={cardSurfaceStyle}
      className="p-6 border border-white/80 dark:border-emerald-400/20 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
            <span>Integracje Międzyaplikacyjne</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Aktywne wtyczki w repozytorium: {activeCount} z {externalPlugins.length}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-emerald-50 mt-1 flex items-center gap-2">
            <PlugZap className="w-5 h-5 text-indigo-600 dark:text-emerald-300 shrink-0" />
            <span>Wtyczki do Innych Aplikacji (SDK, Figma, IDE, Webhook, 3D)</span>
          </h2>
        </div>
      </div>

      <ExternalPluginsContent />
    </section>
  );
};

export const ExternalPluginsModal: React.FC = () => {
  const { pluginsModalOpen, setPluginsModalOpen, palette } = useStudio();
  if (!pluginsModalOpen) return null;

  const isDark = palette === 'emerald-clinic';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Wtyczki do innych aplikacji"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md"
    >
      <div
        className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border p-6 sm:p-8 shadow-2xl space-y-5 ${
          isDark
            ? 'bg-[#081C17] border-emerald-400/25 text-emerald-50'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-emerald-300/80">
              System Wtyczek Zewnętrznych · Eksport do katalogu plugins/ na GitHub
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold mt-0.5">
              Zarządzaj Wtyczkami do Innych Aplikacji
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setPluginsModalOpen(false)}
            aria-label="Zamknij okno wtyczek"
            className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-emerald-900/70 text-slate-600 dark:text-emerald-100 inline-flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ExternalPluginsContent />
      </div>
    </div>
  );
};
