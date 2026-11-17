import {
  getPortableAccountsVaultForBundle,
  PortableAccountsVault,
  resolveCloudOriginUrl,
  StudioAccountProfile,
} from './studioAccountAuth';
import {
  AppScreenMapProject,
  ButtonGroupId,
  CreativeWorkbenchLayoutMode,
  CustomHapticPattern,
  DepthShadowSettings,
  ElementShadeId,
  EngravingBacklightSettings,
  ExternalAppPlugin,
  GeneratedCompleteElement,
  GitHubRepoProfileMetadata,
  GroupOverrideConfig,
  HapticSettings,
  LocalDiskWorkspaceConfig,
  OrganicAnimationConfig,
  PaletteMode,
  PromptReferenceGraphic,
  RotaryDriverCalibrationConfig,
  SavedDriverCalibrationProfile,
  ScreenTransitionPresetId,
  SourcePromptItem,
  StudioMediaItem,
  StudioSnapshotRecord,
  SynthPatchSettings,
  UploadedFileBuildPlan,
  WorkingFrontendImageState,
} from '../types/studio';
import type { SavedSynthPreset } from '../context/StudioContext';

export interface StandaloneStudioStateBundle {
  version: 'aether-offline-v1';
  exportedAt: string;
  requireAuthOnBoot?: boolean;
  includeAccountsVault?: boolean;
  accountsVault?: PortableAccountsVault;
  activeStudioProfile?: StudioAccountProfile | null;
  preferences: {
    palette: PaletteMode;
    depth: DepthShadowSettings;
    synth: SynthPatchSettings;
    haptic: HapticSettings;
    engraving: EngravingBacklightSettings;
    animation: OrganicAnimationConfig;
    selectedGroups: ButtonGroupId[];
    groupConfigs: Record<ButtonGroupId, GroupOverrideConfig>;
    driverCalibration: RotaryDriverCalibrationConfig;
    activeScreenTransition: ScreenTransitionPresetId;
    activeScreenMap: AppScreenMapProject;
    customScreenMaps: AppScreenMapProject[];
    activeBuildMatrix: UploadedFileBuildPlan | null;
    savedBuildMatrices: UploadedFileBuildPlan[];
    customPatterns: CustomHapticPattern[];
    savedPresets: SavedSynthPreset[];
    customCalibrations: SavedDriverCalibrationProfile[];
    sourcePrompts: SourcePromptItem[];
    customMediaItems: StudioMediaItem[];
    workbenchLayoutMode?: CreativeWorkbenchLayoutMode;
    activePreviewScreenId?: string | null;
    masterPromptDraft?: string;
    attachedPromptGraphics?: PromptReferenceGraphic[];
    generatedElements?: GeneratedCompleteElement[];
    externalPlugins?: ExternalAppPlugin[];
    gitHubRepoProfile?: GitHubRepoProfileMetadata;
    workingFrontendImage?: WorkingFrontendImageState | null;
    localDiskConfig?: LocalDiskWorkspaceConfig;
    composedElementShades?: Record<string, ElementShadeId>;
  };
  snapshots: StudioSnapshotRecord[];
}

export function safeSerializeForScriptTag(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function triggerBrowserDownload(
  content: string,
  mimeType: string,
  fileName: string
): number {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return blob.size;
}

function buildSelfContainedHtmlFromDom(
  stateBundle: StandaloneStudioStateBundle,
  cloudOrigin: string
): string | null {
  if (typeof document === 'undefined') return null;
  const cssEl = document.getElementById('aether-bundle-css');
  const jsEl = document.getElementById('aether-bundle-js');
  if (!jsEl || !jsEl.textContent) return null;

  const cssContent = (cssEl?.textContent || '').replace(/<\/style/gi, '<\\/style');
  const jsContent = jsEl.textContent.replace(/<\/script/gi, '<\\/script');
  const offlineAssetsObj =
    typeof window !== 'undefined' && window.__AETHER_OFFLINE_ASSETS__
      ? window.__AETHER_OFFLINE_ASSETS__
      : {};

  return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aether Tactile Studio — Aplikacja Offline</title>
    <meta name="description" content="Samodzielna aplikacja Offline Aether Tactile Studio ze wszystkimi zachowanymi funkcjami i autoryzacją Konta Studio AI." />
    <style id="aether-bundle-css">${cssContent}</style>
    <script id="aether-offline-flags">
      window.__AETHER_STANDALONE_OFFLINE__ = true;
      window.__AETHER_CLOUD_ORIGIN__ = ${safeSerializeForScriptTag(cloudOrigin)};
    </script>
    <script id="aether-offline-assets">
      window.__AETHER_OFFLINE_ASSETS__ = ${safeSerializeForScriptTag(offlineAssetsObj)};
    </script>
    <script id="aether-initial-state">
      window.__AETHER_INITIAL_STATE__ = ${safeSerializeForScriptTag(stateBundle)};
    </script>
  </head>
  <body class="antialiased selection:bg-indigo-500/20">
    <div id="root"></div>
    <script id="aether-bundle-js" type="module">${jsContent}</script>
  </body>
</html>`;
}

export async function generateAndDownloadStandaloneOfflineHtml(params: {
  preferences: StandaloneStudioStateBundle['preferences'];
  snapshots: StudioSnapshotRecord[];
  activeStudioProfile: StudioAccountProfile | null;
  includeAccountsVault: boolean;
  keepSessionSignedIn: boolean;
  requireAuthOnBoot: boolean;
  customFileName?: string;
}): Promise<{
  fileName: string;
  sizeBytes: number;
  builtVia: 'server-compiler' | 'local-repack';
}> {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const rawName = (
    params.customFileName || `aether-tactile-studio-offline-${dateStamp}.html`
  ).trim();
  const fileName = rawName.endsWith('.html') ? rawName : `${rawName}.html`;

  const stateBundle: StandaloneStudioStateBundle = {
    version: 'aether-offline-v1',
    exportedAt: new Date().toISOString(),
    requireAuthOnBoot: params.requireAuthOnBoot,
    includeAccountsVault: params.includeAccountsVault,
    accountsVault: params.includeAccountsVault
      ? getPortableAccountsVaultForBundle()
      : { accounts: {} },
    activeStudioProfile:
      params.keepSessionSignedIn && !params.requireAuthOnBoot
        ? params.activeStudioProfile
        : null,
    preferences: params.preferences,
    snapshots: params.snapshots.slice(0, 30),
  };

  const cloudOrigin =
    resolveCloudOriginUrl() ||
    (typeof window !== 'undefined' && window.location.protocol.startsWith('http')
      ? window.location.origin
      : '');

  // 1. If already running inside a standalone single-file HTML bundle, repack instantaneously in-browser!
  const domRepacked = buildSelfContainedHtmlFromDom(stateBundle, cloudOrigin);
  if (domRepacked) {
    const sizeBytes = triggerBrowserDownload(
      domRepacked,
      'text/html;charset=utf-8',
      fileName
    );
    return {
      fileName,
      sizeBytes,
      builtVia: 'local-repack',
    };
  }

  // 2. Compile full single-file standalone HTML application via server compiler endpoint
  const resp = await fetch(`${cloudOrigin}/api/offline-bundle/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initialState: stateBundle,
      cloudOrigin,
    }),
  });

  const data = await resp.json();
  if (!resp.ok || typeof data?.htmlContent !== 'string') {
    throw new Error(
      data?.error ||
        'Nie udało się skompilować odrębnego pliku HTML aplikacji Offline.'
    );
  }

  const sizeBytes = triggerBrowserDownload(
    data.htmlContent,
    'text/html;charset=utf-8',
    fileName
  );

  return {
    fileName,
    sizeBytes,
    builtVia: 'server-compiler',
  };
}

export function downloadWorkspaceJsonArchive(params: {
  preferences: StandaloneStudioStateBundle['preferences'];
  snapshots: StudioSnapshotRecord[];
  activeStudioProfile: StudioAccountProfile | null;
}): { fileName: string; sizeBytes: number } {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `aether-studio-projekt-${dateStamp}.aether.json`;
  const bundle: StandaloneStudioStateBundle = {
    version: 'aether-offline-v1',
    exportedAt: new Date().toISOString(),
    includeAccountsVault: false,
    activeStudioProfile: params.activeStudioProfile
      ? { ...params.activeStudioProfile, serverToken: undefined }
      : null,
    preferences: params.preferences,
    snapshots: params.snapshots.slice(0, 30),
  };
  const jsonText = JSON.stringify(bundle, null, 2);
  const sizeBytes = triggerBrowserDownload(
    jsonText,
    'application/json;charset=utf-8',
    fileName
  );
  return { fileName, sizeBytes };
}

export function parseWorkspaceJsonArchive(
  rawJson: string
): StandaloneStudioStateBundle {
  const parsed = JSON.parse(rawJson) as StandaloneStudioStateBundle;
  if (
    !parsed ||
    parsed.version !== 'aether-offline-v1' ||
    !parsed.preferences ||
    !parsed.preferences.activeScreenMap
  ) {
    throw new Error(
      'Wybrany plik nie jest prawidłowym archiwum projektu Aether Tactile Studio (.aether.json).'
    );
  }
  return parsed;
}
