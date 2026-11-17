import {
  AppScreenMapProject,
  DepthShadowSettings,
  EngravingBacklightSettings,
  ExternalAppPlugin,
  ExternalPluginDataScope,
  ExternalPluginIntegrationKind,
  GeneratedCompleteElement,
  GeneratedRepoFileEntry,
  GitHubRepoProfileMetadata,
  HapticSettings,
  MATERIAL_PROFILES,
  PaletteMode,
  SynthPatchSettings,
} from '../types/studio';
import {
  serializeScreenMapToMermaid,
  slugifyExportName,
} from './screenMapExport';

export const INTEGRATION_KIND_LABELS: Record<ExternalPluginIntegrationKind, string> = {
  'embed-sdk': 'SDK Widget JS / Iframe',
  'postmessage-bridge': 'Mostek postMessage (Cross-App)',
  'webhook-rest': 'Webhook REST API',
  'design-ide-manifest': 'Wtyczka IDE / Design (Manifest)',
  'engine-3d-osc': 'Mostek Silnika 3D (PBR + Audio)',
};

export const PLUGIN_SCOPE_LABELS: Record<ExternalPluginDataScope, string> = {
  'design-tokens': 'Tokeny szkła, głębi i palet',
  'haptics-audio': 'Haptyka i syntezator <160 Hz',
  'screen-map': 'Architektura i mapa ekranów DAG',
  'generated-tsx': 'Wygenerowane elementy React (.tsx)',
};

export const DEFAULT_GITHUB_REPO_PROFILE: GitHubRepoProfileMetadata = {
  shortAboutDescription:
    'Interaktywne studio projektowania frontendu dotykowego, optyki matowego szkła, syntezy akustycznej <160 Hz, map ekranów DAG oraz wtyczek integracyjnych (React 19, TypeScript, Three.js, Tailwind CSS, PWA Offline).',
  topics: [
    'react',
    'typescript',
    'tailwindcss',
    'threejs',
    'web-audio-api',
    'haptics',
    'ui-design-studio',
    'screen-architecture',
    'pwa-offline',
    'plugin-system',
  ],
  homepageUrl: '',
  licenseId: 'Apache-2.0',
  releaseTag: 'v1.0.0',
  readmeSubtitle:
    'Kompletne środowisko projektowania interfejsów dotykowych, wizualizacji 3D PBR, akustyki sub-basowej (<160 Hz), prototypowania Drag & Drop oraz eksportu wtyczek do zewnętrznych aplikacji.',
};

export const DEFAULT_EXTERNAL_APP_PLUGINS: ExternalAppPlugin[] = [
  {
    id: 'plg-figma-bridge',
    slug: 'figma-aether-sync',
    targetAppName: 'Figma',
    pluginTitle: 'Figma Design Tokens & Screen Sync',
    description:
      'Generuje manifest wtyczki Figma (manifest.json + code.js) oraz plik tokenów optycznych szkła, cieni, palet i węzłów ekranów gotowy do zaimportowania w aplikacji Figma.',
    integrationKind: 'design-ide-manifest',
    enabled: true,
    isCustom: false,
    endpointOrUri: 'https://www.figma.com/plugin-docs/',
    scopes: ['design-tokens', 'screen-map'],
    version: '1.2.0',
    createdAt: 'Wbudowana',
  },
  {
    id: 'plg-vscode-cursor',
    slug: 'vscode-aether-extension',
    targetAppName: 'VS Code / Cursor',
    pluginTitle: 'Aether Tactile Snippets & Component Bridge',
    description:
      'Dostarcza paczkę rozszerzenia i snippety (.vscode/aether-tactile.code-snippets) dla edytorów VS Code i Cursor z gotowymi komponentami szkła oraz wyzwalaczami Web Audio <160 Hz.',
    integrationKind: 'design-ide-manifest',
    enabled: true,
    isCustom: false,
    endpointOrUri: 'vscode://extension/aether-tactile-studio',
    scopes: ['design-tokens', 'haptics-audio', 'generated-tsx'],
    version: '1.1.0',
    createdAt: 'Wbudowana',
  },
  {
    id: 'plg-universal-web-sdk',
    slug: 'universal-web-embed-sdk',
    targetAppName: 'WordPress / Webflow / Next.js / SaaS',
    pluginTitle: 'Uniwersalny Widget JS & Mostek postMessage',
    description:
      'Samodzielny skrypt osadzający (aether-embed-sdk.js) pozwalający wpiąć zaprojektowany model frontendu i komunikację haptyczną postMessage do dowolnej zewnętrznej strony lub aplikacji webowej.',
    integrationKind: 'postmessage-bridge',
    enabled: true,
    isCustom: false,
    endpointOrUri: '*',
    scopes: ['design-tokens', 'haptics-audio', 'screen-map', 'generated-tsx'],
    version: '1.0.0',
    createdAt: 'Wbudowana',
  },
  {
    id: 'plg-storybook-addon',
    slug: 'storybook-tactile-addon',
    targetAppName: 'Storybook 8',
    pluginTitle: 'Dekorator Materiałów i Haptyki Storybook',
    description:
      'Dodaje pasek narzędziowy Storybook umożliwiający testowanie komponentów w paletach Perłowa Flebologia, FinanceAI Błękit i Szmaragdowa Klinika z odsłuchem kliknięć <160 Hz.',
    integrationKind: 'embed-sdk',
    enabled: false,
    isCustom: false,
    endpointOrUri: 'http://localhost:6006',
    scopes: ['design-tokens', 'haptics-audio', 'generated-tsx'],
    version: '1.0.0',
    createdAt: 'Wbudowana',
  },
  {
    id: 'plg-webhook-automation',
    slug: 'webhook-automation-connector',
    targetAppName: 'Slack / Discord / Linear / Notion / Make',
    pluginTitle: 'Konektor Webhook REST Zdarzeń Projektowych',
    description:
      'Wysyła ustrukturyzowane pakiety JSON z tokenami projektu, mapą ekranów i nowo wygenerowanymi elementami UI na wskazany adres Webhook zewnętrznej aplikacji lub automatyzacji.',
    integrationKind: 'webhook-rest',
    enabled: false,
    isCustom: false,
    endpointOrUri: 'https://example.com/webhook/aether-studio',
    scopes: ['design-tokens', 'screen-map', 'generated-tsx'],
    version: '1.0.0',
    createdAt: 'Wbudowana',
  },
  {
    id: 'plg-3d-engine-bridge',
    slug: 'engine-3d-pbr-bridge',
    targetAppName: 'Blender / Unity / Unreal Engine',
    pluginTitle: 'Mostek PBR Optyki Szkła i Obwiedni <160 Hz',
    description:
      'Eksportuje współczynniki załamania światła (IOR), chropowatość powierzchni, twardość Shore oraz parametry impulsów akustycznych dla silników 3D i instalacji przestrzennych.',
    integrationKind: 'engine-3d-osc',
    enabled: false,
    isCustom: false,
    endpointOrUri: 'osc://127.0.0.1:9000/aether',
    scopes: ['design-tokens', 'haptics-audio'],
    version: '1.0.0',
    createdAt: 'Wbudowana',
  },
];

export interface StudioPluginExportContext {
  palette: PaletteMode;
  depth: DepthShadowSettings;
  engraving: EngravingBacklightSettings;
  synth: SynthPatchSettings;
  haptic: HapticSettings;
  screenMap: AppScreenMapProject;
  generatedElements: GeneratedCompleteElement[];
}

export function buildPluginPayloadSnapshot(
  plugin: ExternalAppPlugin,
  ctx: StudioPluginExportContext
): Record<string, unknown> {
  const matProfile =
    MATERIAL_PROFILES[ctx.haptic.material] || MATERIAL_PROFILES['frosted-glass'];
  const payload: Record<string, unknown> = {
    pluginId: plugin.id,
    pluginSlug: plugin.slug,
    targetApplication: plugin.targetAppName,
    integrationKind: plugin.integrationKind,
    version: plugin.version,
    exportedAt: new Date().toISOString(),
  };

  if (plugin.scopes.includes('design-tokens')) {
    payload.designTokens = {
      palette: ctx.palette,
      borderRadiusPx: ctx.depth.borderRadius,
      glassBlurPx: ctx.depth.glassBlur,
      glassOpacity: ctx.depth.glassOpacity,
      elevationPx: ctx.depth.elevation,
      shadowBlurPx: ctx.depth.blur,
      glowEnabled: ctx.engraving.glowEnabled,
      glowColor: ctx.engraving.glowColor,
      glowIntensity: ctx.engraving.glowIntensity,
    };
  }

  if (plugin.scopes.includes('haptics-audio')) {
    payload.hapticsAndAudio = {
      material: ctx.haptic.material,
      materialLabel: matProfile.label,
      hardnessShore: ctx.haptic.materialHardness,
      reverseClutchForce: ctx.haptic.reverseClutchForce,
      baseFrequencyHz: Math.min(158, ctx.synth.baseFrequency),
      waveform: ctx.synth.waveform,
      attackMs: ctx.synth.attackMs,
      decayMs: ctx.synth.decayMs,
    };
  }

  if (plugin.scopes.includes('screen-map')) {
    payload.screenArchitecture = {
      name: ctx.screenMap.name,
      defaultTransition: ctx.screenMap.defaultTransition,
      screensCount: ctx.screenMap.nodes.length,
      screens: ctx.screenMap.nodes.map((n) => ({
        id: n.id,
        title: n.title,
        route: n.route,
        role: n.role,
        components: n.components,
      })),
      edges: ctx.screenMap.edges,
    };
  }

  if (plugin.scopes.includes('generated-tsx')) {
    payload.generatedComponents = ctx.generatedElements.map((el) => ({
      name: el.name,
      fileName: el.fileName,
      targetScreenId: el.targetScreenId,
      targetZone: el.targetZone,
      headline: el.headline,
    }));
  }

  return payload;
}

export function buildHostIntegrationSnippet(
  plugin: ExternalAppPlugin,
  ctx: StudioPluginExportContext
): { language: string; fileName: string; code: string } {
  const safeSlug = slugifyExportName(plugin.slug || plugin.targetAppName || 'aether-plugin');
  const snapshotJson = JSON.stringify(buildPluginPayloadSnapshot(plugin, ctx), null, 2);

  if (plugin.slug === 'figma-aether-sync') {
    return {
      language: 'javascript',
      fileName: `figma-${safeSlug}-code.js`,
      code: `// Wtyczka Figma: ${plugin.pluginTitle}
const AETHER_PAYL0AD = ${snapshotJson};

figma.showUI(__html__, { width: 420, height: 520 });
figma.notify('Załadowano tokeny Aether Tactile Studio (' + AETHER_PAYL0AD.targetApplication + ')');

if (AETHER_PAYL0AD.screenArchitecture && Array.isArray(AETHER_PAYL0AD.screenArchitecture.screens)) {
  let offsetX = 0;
  for (const scr of AETHER_PAYL0AD.screenArchitecture.screens) {
    const frame = figma.createFrame();
    frame.name = scr.title + ' (' + scr.route + ')';
    frame.resize(1280, 800);
    frame.x = offsetX;
    frame.cornerRadius = AETHER_PAYL0AD.designTokens?.borderRadiusPx || 24;
    offsetX += 1360;
  }
}
`,
    };
  }

  if (plugin.integrationKind === 'postmessage-bridge' || plugin.integrationKind === 'embed-sdk') {
    return {
      language: 'html',
      fileName: `${safeSlug}-embed.html`,
      code: `<!-- Wklej w aplikacji docelowej (${plugin.targetAppName}) -->
<div id="aether-plugin-mount-${safeSlug}"></div>
<script src="/plugins/${safeSlug}-sdk.js"></script>
<script>
  window.AetherExternalPlugin_${safeSlug.replace(/-/g, '_')}.mount('#aether-plugin-mount-${safeSlug}', {
    targetOrigin: ${JSON.stringify(plugin.endpointOrUri || '*')},
    onTactileEvent: function (event) {
      console.log('[${plugin.targetAppName} <- Aether Studio]', event);
    }
  });
</script>`,
    };
  }

  if (plugin.integrationKind === 'webhook-rest') {
    return {
      language: 'typescript',
      fileName: `${safeSlug}-webhook.ts`,
      code: `// Integracja Webhook dla aplikacji: ${plugin.targetAppName}
export async function syncAetherToExternalApp() {
  const response = await fetch(${JSON.stringify(plugin.endpointOrUri || 'https://example.com/webhook')}, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(${snapshotJson}),
  });
  return response.ok;
}
`,
    };
  }

  if (plugin.integrationKind === 'engine-3d-osc') {
    return {
      language: 'json',
      fileName: `${safeSlug}-pbr-profile.json`,
      code: snapshotJson,
    };
  }

  return {
    language: 'json',
    fileName: `${safeSlug}-manifest.json`,
    code: snapshotJson,
  };
}

export function generateRepositoryFilesForActivePlugins(
  plugins: ExternalAppPlugin[],
  ctx: StudioPluginExportContext
): GeneratedRepoFileEntry[] {
  const active = plugins.filter((p) => p.enabled);
  if (active.length === 0) return [];

  const entries: GeneratedRepoFileEntry[] = [];

  // Central plugin registry inside src/plugins/pluginRegistry.ts
  entries.push({
    path: 'src/plugins/pluginRegistry.ts',
    content: `export interface RegisteredExternalPlugin {
  id: string;
  slug: string;
  targetAppName: string;
  pluginTitle: string;
  integrationKind: string;
  endpointOrUri: string;
  version: string;
}

export const ACTIVE_EXTERNAL_PLUGINS: RegisteredExternalPlugin[] = ${JSON.stringify(
      active.map((p) => ({
        id: p.id,
        slug: p.slug,
        targetAppName: p.targetAppName,
        pluginTitle: p.pluginTitle,
        integrationKind: p.integrationKind,
        endpointOrUri: p.endpointOrUri,
        version: p.version,
      })),
      null,
      2
    )};
`,
  });

  for (const plugin of active) {
    const safeSlug = slugifyExportName(plugin.slug || plugin.targetAppName || 'plugin');
    const payloadObj = buildPluginPayloadSnapshot(plugin, ctx);
    const snippet = buildHostIntegrationSnippet(plugin, ctx);

    entries.push({
      path: `plugins/${safeSlug}/aether-plugin-config.json`,
      content: JSON.stringify(payloadObj, null, 2),
    });

    if (plugin.slug === 'figma-aether-sync') {
      entries.push({
        path: `plugins/${safeSlug}/manifest.json`,
        content: JSON.stringify(
          {
            name: `Aether Tactile Studio — ${plugin.pluginTitle}`,
            id: 'aether-tactile-figma-sync',
            api: '1.0.0',
            main: 'code.js',
            editorType: ['figma'],
          },
          null,
          2
        ),
      });
      entries.push({
        path: `plugins/${safeSlug}/code.js`,
        content: snippet.code,
      });
    } else if (plugin.slug === 'vscode-aether-extension') {
      entries.push({
        path: '.vscode/aether-tactile.code-snippets',
        content: JSON.stringify(
          {
            'Aether Glass Section': {
              prefix: 'aether-section',
              body: [
                '<section style={{ borderRadius: "${1:28}px", backdropFilter: "blur(${2:22}px)" }} className="p-6 border border-white/80 dark:border-emerald-400/20 bg-white/80 dark:bg-emerald-950/70">',
                '  <h2 className="text-xl font-semibold">${3:Nagłówek modułu}</h2>',
                '</section>',
              ],
              description: 'Wstawia sekcję szkła matowego z tokenami Aether Tactile Studio',
            },
            'Aether Sub-160Hz Click': {
              prefix: 'aether-click',
              body: ['triggerTactileClick(${1:4});'],
              description: 'Wyzwala impuls akustyczno-haptyczny <160 Hz',
            },
          },
          null,
          2
        ),
      });
    } else if (
      plugin.integrationKind === 'postmessage-bridge' ||
      plugin.integrationKind === 'embed-sdk'
    ) {
      const globalKey = `AetherExternalPlugin_${safeSlug.replace(/-/g, '_')}`;
      entries.push({
        path: `public/plugins/${safeSlug}-sdk.js`,
        content: `(function (window) {
  const SNAPSHOT = ${JSON.stringify(payloadObj, null, 2)};
  window.${globalKey} = {
    version: ${JSON.stringify(plugin.version)},
    targetApp: ${JSON.stringify(plugin.targetAppName)},
    getTokens: function () { return SNAPSHOT.designTokens || {}; },
    mount: function (selector, options) {
      const opts = options || {};
      const host = typeof selector === 'string' ? document.querySelector(selector) : selector;
      if (!host) return;
      host.innerHTML = '<div style="padding:16px;border-radius:' + ((SNAPSHOT.designTokens && SNAPSHOT.designTokens.borderRadiusPx) || 20) + 'px;border:1px solid rgba(148,163,184,0.35);font-family:system-ui,sans-serif;">' +
        '<strong>' + SNAPSHOT.targetApplication + ' · ' + ${JSON.stringify(plugin.pluginTitle)} + '</strong>' +
        '<p style="margin:6px 0 0;font-size:12px;opacity:0.8;">Połączono z modelem Aether Tactile Studio.</p></div>';
      window.postMessage({ type: 'AETHER_PLUGIN_MOUNTED', plugin: SNAPSHOT.pluginSlug, payload: SNAPSHOT }, opts.targetOrigin || '*');
      if (typeof opts.onTactileEvent === 'function') {
        opts.onTactileEvent({ type: 'READY', snapshot: SNAPSHOT });
      }
    }
  };
})(window);
`,
      });
      entries.push({
        path: `plugins/${safeSlug}/INTEGRATION.html`,
        content: snippet.code,
      });
    } else {
      entries.push({
        path: `plugins/${safeSlug}/${snippet.fileName}`,
        content: snippet.code,
      });
    }
  }

  return entries;
}

export async function dispatchLivePluginTestSignal(
  plugin: ExternalAppPlugin,
  ctx: StudioPluginExportContext
): Promise<{ ok: boolean; message: string }> {
  const payload = buildPluginPayloadSnapshot(plugin, ctx);

  // Always emit local postMessage & BroadcastChannel so co-hosted apps/iframes can listen immediately
  if (typeof window !== 'undefined') {
    try {
      window.postMessage(
        {
          type: 'AETHER_STUDIO_PLUGIN_SYNC',
          pluginSlug: plugin.slug,
          targetApp: plugin.targetAppName,
          payload,
        },
        '*'
      );
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('aether_tactile_plugins');
        bc.postMessage({
          type: 'AETHER_STUDIO_PLUGIN_SYNC',
          pluginSlug: plugin.slug,
          targetApp: plugin.targetAppName,
          payload,
        });
        bc.close();
      }
    } catch {
      // Ignore cross-origin frame restrictions
    }
  }

  if (
    plugin.integrationKind === 'webhook-rest' &&
    plugin.endpointOrUri.startsWith('http') &&
    !plugin.endpointOrUri.includes('example.com')
  ) {
    try {
      let extraHeaders: Record<string, string> = {};
      if (plugin.customHeadersJson?.trim()) {
        extraHeaders = JSON.parse(plugin.customHeadersJson) as Record<string, string>;
      }
      const resp = await fetch(plugin.endpointOrUri, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...extraHeaders,
        },
        body: JSON.stringify(payload),
      });
      return {
        ok: resp.ok,
        message: resp.ok
          ? `Wysłano pakiet JSON do ${plugin.targetAppName} (HTTP ${resp.status}).`
          : `Endpoint ${plugin.targetAppName} odpowiedział kodem HTTP ${resp.status}.`,
      };
    } catch {
      return {
        ok: true,
        message: `Wyemitowano zdarzenie lokalne BroadcastChannel/postMessage dla ${plugin.targetAppName} (zewnętrzny endpoint zablokowany przez CORS lub tryb Offline).`,
      };
    }
  }

  return {
    ok: true,
    message: `Wysłano sygnał synchronizacji wtyczki „${plugin.pluginTitle}” dla aplikacji ${plugin.targetAppName} (kanał postMessage + BroadcastChannel aktywny).`,
  };
}

export function buildComprehensiveGitHubReadme(params: {
  repoSlug: string;
  profile: GitHubRepoProfileMetadata;
  ctx: StudioPluginExportContext;
  plugins: ExternalAppPlugin[];
}): string {
  const { repoSlug, profile, ctx, plugins } = params;
  const matProfile =
    MATERIAL_PROFILES[ctx.haptic.material] || MATERIAL_PROFILES['frosted-glass'];
  const activePlugins = plugins.filter((p) => p.enabled);

  const mermaidDiagram = serializeScreenMapToMermaid(ctx.screenMap, {
    direction: 'LR',
    groupByRole: true,
    includeMetadataComments: false,
    wrapInMarkdown: true,
  });

  const pluginsTable =
    activePlugins.length > 0
      ? `| Wtyczka | Aplikacja docelowa | Typ integracji | Ścieżka w repozytorium |\n| :--- | :--- | :--- | :--- |\n${activePlugins
          .map((p) => {
            const s = slugifyExportName(p.slug || p.targetAppName);
            return `| **${p.pluginTitle}** | ${p.targetAppName} | ${INTEGRATION_KIND_LABELS[p.integrationKind]} | \`plugins/${s}/\` |`;
          })
          .join('\n')}`
      : '_Brak aktywnych wtyczek zewnętrznych w bieżącej konfiguracji._';

  return `# ${ctx.screenMap.name || 'Aether Tactile Studio'}

> ${profile.shortAboutDescription}

${profile.readmeSubtitle}

---

## Kluczowe możliwości aplikacji

1. **Żywy Podgląd Modelu Frontendu w każdym pulpicie kreacyjnym** — natychmiastowa wizualizacja projektowanych ekranów (Desktop / Tablet / Mobile oraz podgląd kodu \`.tsx\`) sprzężona z regulacją cieni, rozmycia szkła, palet kolorystycznych i podświetlenia grawerunków.
2. **Stałe Okno Kompletnego Promptu z Załączonymi Grafikami** — multimodalny kreator kompletnych elementów React + TypeScript + Tailwind CSS łączący obrazy referencyjne (\`Ctrl+V\`, Drag & Drop) z tokenami projektu.
3. **Silnik Haptyczno-Akustyczny (\`<160 Hz\`) i Oscyloskop Czasu Rzeczywistego** — proceduralna synteza Web Audio API modelująca fizykę materiałów (*${matProfile.label}*, twardość \`${ctx.haptic.materialHardness} Shore\`, częstotliwość bazowa \`${Math.min(158, ctx.synth.baseFrequency)} Hz\`) z eksportem fal **WAV** i **JSON**.
4. **Wizualizacje 3D PBR (Three.js) oraz Kalibracja Kontrolera Obrotowego CNC (270°)** — interaktywne sceny przestrzenne reagujące na dotyk i obwiednię dźwięku.
5. **Planer Architektury Ekranów (DAG) i Prototypowanie Drag & Drop** — budowa mapy ekranów z plików AI, repozytoriów GitHub oraz przeciągania widżetów bezpośrednio na makiety ekranów.
6. **Praca w 100% Offline (\`.html\` + PWA) oraz Konto Studio AI** — możliwość pobrania całej aplikacji w formie pojedynczego, samodzielnego pliku \`.html\` z wbudowanym kryptograficznym skarbcem autoryzacji Konta Studio AI.
7. **System Wtyczek do Innych Aplikacji** — gotowe mostki integracyjne (\`plugins/\`) dla narzędzi projektowych, edytorów kodu, systemów CMS/SaaS, Webhooków oraz silników 3D.

---

## Parametry bieżącego projektu

- **Identyfikator repozytorium**: \`${repoSlug}\` (\`${profile.releaseTag}\`, licencja \`${profile.licenseId}\`)
- **Paleta i optyka szkła**: \`${ctx.palette}\` · promień \`${ctx.depth.borderRadius}px\` · rozmycie szkła \`${ctx.depth.glassBlur}px\` · elewacja \`${ctx.depth.elevation}px\`
- **Profil dotykowy**: \`${matProfile.label}\` (\`${ctx.haptic.materialHardness} Sh\`) · ton bazowy \`${Math.min(158, ctx.synth.baseFrequency)} Hz\`
- **Zaprojektowane ekrany**: \`${ctx.screenMap.nodes.length}\` widoków · \`${ctx.screenMap.edges.length}\` połączeń nawigacyjnych
- **Wygenerowane moduły kompletne (\`src/components/generated/\`)**: \`${ctx.generatedElements.length}\`
- **Aktywne wtyczki zewnętrzne (\`plugins/\`)**: \`${activePlugins.length}\`

---

## Wtyczki do innych aplikacji (\`plugins/\`)

${pluginsTable}

---

## Architektura Ekranów (Mermaid)

${mermaidDiagram}

---

## Szybki start (Uruchomienie lokalne)

\`\`\`bash
# 1. Instalacja zależności
npm install

# 2. Uruchomienie serwera deweloperskiego (port 3000 / 5173)
npm run dev

# 3. Budowa produkcyjna
npm run build
\`\`\`

---

## Tematy repozytorium GitHub (Topics)

\`${profile.topics.join('` · `')}\`
`;
}
