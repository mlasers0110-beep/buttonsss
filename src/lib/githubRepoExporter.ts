import {
  AppScreenMapProject,
  DepthShadowSettings,
  EngravingBacklightSettings,
  ExternalAppPlugin,
  GeneratedCompleteElement,
  GeneratedRepoFileEntry,
  GitHubRepoExportResult,
  GitHubRepoProfileMetadata,
  HapticSettings,
  MATERIAL_PROFILES,
  PaletteMode,
  PromptReferenceGraphic,
  SynthPatchSettings,
  UploadedFileBuildPlan,
} from '../types/studio';
import { slugifyExportName } from './screenMapExport';
import { resolvePrototypeWidgetsForNode } from './tactileUiCatalog';
import { studioApiFetch } from './offlineStudioEngines';
import {
  buildComprehensiveGitHubReadme,
  DEFAULT_EXTERNAL_APP_PLUGINS,
  DEFAULT_GITHUB_REPO_PROFILE,
  generateRepositoryFilesForActivePlugins,
} from './externalAppPlugins';

export interface BuildFrontendRepositoryInput {
  repoName: string;
  repoDescription?: string;
  repoProfile?: GitHubRepoProfileMetadata;
  externalPlugins?: ExternalAppPlugin[];
  screenMap: AppScreenMapProject;
  generatedElements: GeneratedCompleteElement[];
  attachedGraphics: PromptReferenceGraphic[];
  masterPromptText: string;
  palette: PaletteMode;
  depth: DepthShadowSettings;
  engraving: EngravingBacklightSettings;
  synth: SynthPatchSettings;
  haptic: HapticSettings;
  activeBuildMatrix: UploadedFileBuildPlan | null;
}

function toPascalIdentifier(raw: string, fallback = 'GeneratedSection'): string {
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();
  if (!cleaned) return fallback;
  const joined = cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return /^[A-Za-z]/.test(joined) ? joined : `Ui${joined}`;
}

function sanitizeComponentFileName(rawFileName: string, fallbackName: string): string {
  const base = rawFileName.replace(/\.tsx$/i, '').replace(/[^a-zA-Z0-9_-]/g, '');
  const pascal = toPascalIdentifier(base || fallbackName, 'CompleteStudioElement');
  return `${pascal}.tsx`;
}

export function buildCompleteFrontendRepositoryFiles(
  input: BuildFrontendRepositoryInput
): GeneratedRepoFileEntry[] {
  const slug = slugifyExportName(input.repoName || input.screenMap.name || 'aether-frontend-app');
  const matProfile = MATERIAL_PROFILES[input.haptic.material] || MATERIAL_PROFILES['frosted-glass'];
  const files: GeneratedRepoFileEntry[] = [];

  // 1. package.json
  files.push({
    path: 'package.json',
    content: JSON.stringify(
      {
        name: slug,
        private: true,
        version: '1.0.0',
        type: 'module',
        description:
          input.repoDescription ||
          input.screenMap.description ||
          'Frontend wygenerowany w Aether Tactile Studio',
        scripts: {
          dev: 'vite',
          build: 'tsc -b && vite build',
          preview: 'vite preview',
        },
        dependencies: {
          'lucide-react': '^0.546.0',
          react: '^19.0.0',
          'react-dom': '^19.0.0',
        },
        devDependencies: {
          '@tailwindcss/vite': '^4.1.0',
          '@types/react': '^19.0.0',
          '@types/react-dom': '^19.0.0',
          tailwindcss: '^4.1.0',
          typescript: '^5.7.2',
          vite: '^6.2.0',
          '@vitejs/plugin-react': '^4.3.4',
        },
      },
      null,
      2
    ),
  });

  // 2. index.html
  files.push({
    path: 'index.html',
    content: `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${input.screenMap.name || 'Aether Frontend Model'}</title>
  </head>
  <body class="antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  });

  // 3. vite.config.ts & tsconfig.json
  files.push({
    path: 'vite.config.ts',
    content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`,
  });

  files.push({
    path: 'tsconfig.json',
    content: JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
        },
        include: ['src'],
      },
      null,
      2
    ),
  });

  // 4. src/index.css
  files.push({
    path: 'src/index.css',
    content: `@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
`,
  });

  // 5. src/styles/tokens.ts
  files.push({
    path: 'src/styles/tokens.ts',
    content: `export const STUDIO_DESIGN_TOKENS = ${JSON.stringify(
      {
        palette: input.palette,
        material: input.haptic.material,
        materialLabel: matProfile.label,
        hardnessShore: input.haptic.materialHardness,
        baseFrequencyHz: Math.min(158, input.synth.baseFrequency),
        borderRadiusPx: input.depth.borderRadius,
        glassBlurPx: input.depth.glassBlur,
        glassOpacity: input.depth.glassOpacity,
        elevationPx: input.depth.elevation,
        glowColor: input.engraving.glowColor,
        glowIntensity: input.engraving.glowIntensity,
        etchDepth: input.engraving.etchDepth,
      },
      null,
      2
    )} as const;
`,
  });

  // 6. src/lib/tactileHaptics.ts (<160 Hz Web Audio tactile synthesizer)
  files.push({
    path: 'src/lib/tactileHaptics.ts',
    content: `import { STUDIO_DESIGN_TOKENS } from '../styles/tokens';

let sharedCtx: AudioContext | null = null;

export function triggerTactileClick(pitchOffsetHz = 0): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!sharedCtx) sharedCtx = new AudioCtx();
    if (sharedCtx.state === 'suspended') sharedCtx.resume();

    const now = sharedCtx.currentTime;
    const osc = sharedCtx.createOscillator();
    const gain = sharedCtx.createGain();
    const freq = Math.max(36, Math.min(158, STUDIO_DESIGN_TOKENS.baseFrequencyHz + pitchOffsetHz));

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.35, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.045);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.095);

    osc.connect(gain);
    gain.connect(sharedCtx.destination);
    osc.start(now);
    osc.stop(now + 0.1);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(14);
    }
  } catch {
    // Ignore audio context autoplay restrictions
  }
}
`,
  });

  // 7. Generated Complete Elements -> src/components/generated/<FileName>.tsx
  const exportedElementRecords: Array<{
    id: string;
    componentName: string;
    importPath: string;
    targetScreenId: string;
    targetZone: string;
    headline: string;
    subheadline: string;
    summary: string;
  }> = [];

  const usedFileNames = new Set<string>();
  for (const el of input.generatedElements) {
    let cleanFile = sanitizeComponentFileName(el.fileName, el.name);
    if (usedFileNames.has(cleanFile)) {
      cleanFile = cleanFile.replace(/\.tsx$/, `_${usedFileNames.size + 1}.tsx`);
    }
    usedFileNames.add(cleanFile);
    const componentName = cleanFile.replace(/\.tsx$/, '');

    const codeBody =
      el.reactTailwindCode && el.reactTailwindCode.includes('export ')
        ? el.reactTailwindCode
        : `import React from 'react';
import { triggerTactileClick } from '../../lib/tactileHaptics';

export const ${componentName}: React.FC = () => {
  return (
    <section className="p-6 rounded-2xl border border-slate-200/80 dark:border-emerald-400/20 bg-white/80 dark:bg-emerald-950/65 space-y-4">
      <div className="space-y-1">
        <div className="text-xs text-slate-500 dark:text-emerald-300/80">${el.categoryLabel}</div>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-emerald-50">${el.headline}</h3>
        <p className="text-sm text-slate-600 dark:text-emerald-100/80">${el.subheadline}</p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        ${el.controls
          .map(
            (ctrl) =>
              `<button type="button" onClick={() => triggerTactileClick(6)} className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 cursor-pointer">${ctrl.label}</button>`
          )
          .join('\n        ')}
      </div>
    </section>
  );
};

export default ${componentName};
`;

    files.push({
      path: `src/components/generated/${cleanFile}`,
      content: codeBody,
    });

    exportedElementRecords.push({
      id: el.id,
      componentName,
      importPath: `./components/generated/${componentName}`,
      targetScreenId: el.targetScreenId,
      targetZone: el.targetZone,
      headline: el.headline,
      subheadline: el.subheadline,
      summary: el.summary,
    });
  }

  // 8. Screen Model Blueprint JSON -> src/data/frontendModel.ts
  const serializedScreens = input.screenMap.nodes.map((node) => ({
    id: node.id,
    title: node.title,
    route: node.route,
    role: node.role,
    summary: node.summary,
    hapticMaterial: node.hapticMaterial,
    preferredTransition: node.preferredTransition,
    widgets: resolvePrototypeWidgetsForNode(node),
  }));

  files.push({
    path: 'src/data/frontendModel.ts',
    content: `export const DESIGNED_SCREENS = ${JSON.stringify(serializedScreens, null, 2)} as const;
export const SCREEN_EDGES = ${JSON.stringify(input.screenMap.edges, null, 2)} as const;
export const GENERATED_ELEMENT_MANIFEST = ${JSON.stringify(exportedElementRecords, null, 2)} as const;
`,
  });

  // 9. Interactive Multi-Screen App.tsx
  files.push({
    path: 'src/App.tsx',
    content: `import React, { useState } from 'react';
import { DESIGNED_SCREENS, GENERATED_ELEMENT_MANIFEST } from './data/frontendModel';
import { STUDIO_DESIGN_TOKENS } from './styles/tokens';
import { triggerTactileClick } from './lib/tactileHaptics';

export default function App() {
  const [activeScreenId, setActiveScreenId] = useState<string>(
    DESIGNED_SCREENS[0]?.id || ''
  );

  const currentScreen =
    DESIGNED_SCREENS.find((s) => s.id === activeScreenId) || DESIGNED_SCREENS[0];
  const isDark = STUDIO_DESIGN_TOKENS.palette === 'emerald-clinic';

  const screenElements = GENERATED_ELEMENT_MANIFEST.filter(
    (el) => el.targetScreenId === currentScreen?.id
  );

  return (
    <div className={\`min-h-screen \${isDark ? 'dark bg-[#071814] text-emerald-50' : 'bg-[#EEF2FB] text-slate-900'}\`}>
      <header className="border-b border-slate-200/70 dark:border-emerald-400/20 bg-white/70 dark:bg-emerald-950/75 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <span className="font-bold tracking-tight text-base whitespace-nowrap">
            ${(input.screenMap.name || 'Aether Frontend').replace(/'/g, "\\'")}
          </span>
          <nav className="flex items-center gap-4 overflow-x-auto text-sm">
            {DESIGNED_SCREENS.map((scr) => (
              <button
                key={scr.id}
                type="button"
                onClick={() => {
                  setActiveScreenId(scr.id);
                  triggerTactileClick(4);
                }}
                className={\`py-1 border-b-2 whitespace-nowrap cursor-pointer transition-colors \${
                  scr.id === currentScreen?.id
                    ? 'border-indigo-600 dark:border-emerald-300 font-semibold'
                    : 'border-transparent opacity-75 hover:opacity-100'
                }\`}
              >
                {scr.title}
              </button>
            ))}
          </nav>
          <span className="text-xs font-mono tabular-nums opacity-75 whitespace-nowrap">
            {currentScreen?.route}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {currentScreen && (
          <section
            style={{
              borderRadius: \`\${STUDIO_DESIGN_TOKENS.borderRadiusPx}px\`,
              backdropFilter: \`blur(\${STUDIO_DESIGN_TOKENS.glassBlurPx}px)\`,
            }}
            className="p-8 border border-white/80 dark:border-emerald-400/20 bg-white/80 dark:bg-emerald-950/65 shadow-lg space-y-6"
          >
            <div className="space-y-2">
              <div className="text-xs opacity-70">
                {currentScreen.role} · { STUDIO_DESIGN_TOKENS.materialLabel } · { STUDIO_DESIGN_TOKENS.baseFrequencyHz } Hz
              </div>
              <h1 className="text-3xl font-semibold">{currentScreen.title}</h1>
              <p className="text-sm opacity-85 max-w-2xl">{currentScreen.summary}</p>
            </div>

            {screenElements.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {screenElements.map((gen) => (
                  <div
                    key={gen.id}
                    className="p-5 rounded-2xl border border-indigo-500/25 dark:border-emerald-400/30 bg-indigo-50/40 dark:bg-emerald-900/35 space-y-2"
                  >
                    <div className="text-xs opacity-70">
                      Wygenerowany Element · Strefa: {gen.targetZone} · Plik: {gen.componentName}.tsx
                    </div>
                    <h2 className="text-lg font-semibold">{gen.headline}</h2>
                    <p className="text-xs opacity-85">{gen.subheadline}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              {currentScreen.widgets.map((w) => (
                <button
                  key={w.instanceId}
                  type="button"
                  onClick={() => triggerTactileClick()}
                  className={\`p-4 rounded-xl border border-slate-200/80 dark:border-emerald-400/20 bg-white/90 dark:bg-emerald-900/50 text-left flex items-center justify-between gap-3 hover:opacity-95 transition-opacity cursor-pointer \${
                    w.spanCols === 2 ? 'sm:col-span-2' : ''
                  }\`}
                >
                  <div>
                    <div className="text-[11px] opacity-60">{w.zone} · {w.category}</div>
                    <div className="text-sm font-medium mt-0.5">{w.label}</div>
                  </div>
                  <span className="text-xs font-mono opacity-70">Aktywuj</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
`,
  });

  // 10. src/main.tsx
  files.push({
    path: 'src/main.tsx',
    content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
  });

  // 11. Attached Reference Graphics -> public/references/
  input.attachedGraphics.forEach((gfx, idx) => {
    const match = gfx.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const ext = match[1].includes('png')
        ? 'png'
        : match[1].includes('webp')
          ? 'webp'
          : match[1].includes('svg')
            ? 'svg'
            : 'jpg';
      const safeGfxName = slugifyExportName(gfx.name.replace(/\.[^.]+$/, '') || `ref-${idx + 1}`);
      files.push({
        path: `public/references/${safeGfxName}-${idx + 1}.${ext}`,
        content: match[2],
        encoding: 'base64',
      });
    }
  });

  // 12. External Application Plugins -> src/plugins/ & plugins/<slug>/
  const activePluginsList = input.externalPlugins || DEFAULT_EXTERNAL_APP_PLUGINS;
  const pluginExportCtx = {
    palette: input.palette,
    depth: input.depth,
    engraving: input.engraving,
    synth: input.synth,
    haptic: input.haptic,
    screenMap: input.screenMap,
    generatedElements: input.generatedElements,
  };
  const pluginRepoFiles = generateRepositoryFilesForActivePlugins(
    activePluginsList,
    pluginExportCtx
  );
  files.push(...pluginRepoFiles);

  // 13. Master Prompt & Comprehensive GitHub Repository README.md
  const effectiveProfile: GitHubRepoProfileMetadata = {
    ...(input.repoProfile || DEFAULT_GITHUB_REPO_PROFILE),
    shortAboutDescription:
      input.repoDescription?.trim() ||
      input.repoProfile?.shortAboutDescription ||
      DEFAULT_GITHUB_REPO_PROFILE.shortAboutDescription,
  };

  files.push({
    path: 'MASTER_PROMPT.md',
    content: `# Kompletny Prompt Projektowy — ${input.screenMap.name}\n\n${input.masterPromptText}\n`,
  });

  files.push({
    path: 'GITHUB_REPO_DESCRIPTION.json',
    content: JSON.stringify(
      {
        repositoryName: slug,
        shortAboutDescription: effectiveProfile.shortAboutDescription,
        topics: effectiveProfile.topics,
        license: effectiveProfile.licenseId,
        releaseTag: effectiveProfile.releaseTag,
        activePlugins: activePluginsList
          .filter((p) => p.enabled)
          .map((p) => ({
            title: p.pluginTitle,
            targetApp: p.targetAppName,
            kind: p.integrationKind,
          })),
      },
      null,
      2
    ),
  });

  files.push({
    path: 'init-github-repo.sh',
    content: `#!/usr/bin/env bash
set -e
git init
git checkout -B main
git add .
git commit -m "feat: initial frontend model, tactile elements & app plugins from Aether Tactile Studio"
echo "Repozytorium Git zainicjalizowane lokalnie. Aby utworzyć i wypchnąć na GitHub:"
echo "  gh repo create ${slug} --public --description ${JSON.stringify(effectiveProfile.shortAboutDescription.slice(0, 340))} --source=. --remote=origin --push"
`,
  });

  files.push({
    path: 'README.md',
    content: buildComprehensiveGitHubReadme({
      repoSlug: slug,
      profile: effectiveProfile,
      ctx: pluginExportCtx,
      plugins: activePluginsList,
    }),
  });

  if (input.activeBuildMatrix) {
    files.push({
      path: 'BUILD_MATRIX.json',
      content: JSON.stringify(input.activeBuildMatrix, null, 2),
    });
  }

  return files;
}

// ============================================================================
// Pure TypeScript PKZIP Builder (Works 100% Offline & Online without external libs)
// ============================================================================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32Bytes(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function buildZipArchiveBlob(files: GeneratedRepoFileEntry[]): Blob {
  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const dataBytes =
      file.encoding === 'base64'
        ? base64ToUint8Array(file.content)
        : encoder.encode(file.content);
    const crc = crc32Bytes(dataBytes);
    const size = dataBytes.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, 0, true); // Store (0)
    lv.setUint16(10, 0, true); // Mod time
    lv.setUint16(12, 0x5821, true); // Mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localChunks.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central file header signature
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); // UTF-8
    cv.setUint16(10, 0, true); // Store
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5821, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralChunks.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  let centralSize = 0;
  for (const c of centralChunks) centralSize += c.length;

  const endRecord = new Uint8Array(22);
  const ev = new DataView(endRecord.buffer);
  ev.setUint32(0, 0x06054b50, true); // End of central directory signature
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalBytes = offset + centralSize + endRecord.byteLength;
  const archiveBuffer = new ArrayBuffer(totalBytes);
  const archiveView = new Uint8Array(archiveBuffer);
  let cursor = 0;
  for (const chunk of localChunks) {
    archiveView.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  for (const chunk of centralChunks) {
    archiveView.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  archiveView.set(endRecord, cursor);

  return new Blob([archiveBuffer], {
    type: 'application/zip',
  });
}

export function downloadRepositoryZipBundle(
  input: BuildFrontendRepositoryInput
): { fileName: string; filesCount: number; sizeBytes: number } {
  const files = buildCompleteFrontendRepositoryFiles(input);
  const blob = buildZipArchiveBlob(files);
  const slug = slugifyExportName(input.repoName || input.screenMap.name || 'aether-frontend-repo');
  const fileName = `${slug}-github-repo.zip`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);

  return {
    fileName,
    filesCount: files.length,
    sizeBytes: blob.size,
  };
}

// ============================================================================
// Direct GitHub API Push (via Server Proxy or Direct GitHub REST API fallback)
// ============================================================================

async function pushFilesDirectlyViaGitHubApi(params: {
  githubToken: string;
  repoName: string;
  repoDescription: string;
  topics?: string[];
  isPrivate: boolean;
  branch: string;
  commitMessage: string;
  files: GeneratedRepoFileEntry[];
}): Promise<GitHubRepoExportResult> {
  const ghHeaders = {
    Authorization: `Bearer ${params.githubToken.trim()}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // 1. Verify authenticated GitHub user
  const userResp = await fetch('https://api.github.com/user', {
    headers: ghHeaders,
  });
  if (!userResp.ok) {
    throw new Error(
      'Nieprawidłowy lub wygasły token autoryzacji GitHub. Zaloguj się przez GitHub lub podaj token z uprawnieniem repo / Contents: Read & Write.'
    );
  }
  const ghUser = (await userResp.json()) as { login: string };

  const rawRepo = params.repoName.trim();
  const [explicitOwner, explicitName] = rawRepo.includes('/')
    ? rawRepo.split('/', 2)
    : [ghUser.login, slugifyExportName(rawRepo || 'aether-tactile-frontend')];
  const owner = explicitOwner || ghUser.login;
  const cleanRepoName = explicitName || 'aether-tactile-frontend';

  // 2. Check if repository exists; if not, create with auto_init: true
  let createdNewRepo = false;
  let repoData: { full_name: string; html_url: string; default_branch: string };

  const checkResp = await fetch(
    `https://api.github.com/repos/${owner}/${cleanRepoName}`,
    { headers: ghHeaders }
  );

  if (checkResp.status === 404) {
    const createResp = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({
        name: cleanRepoName,
        description:
          params.repoDescription ||
          'Projekt frontendowy wygenerowany w Aether Tactile Studio',
        private: params.isPrivate,
        auto_init: true,
      }),
    });
    if (!createResp.ok) {
      const errJson = await createResp.json().catch(() => ({}));
      throw new Error(
        (errJson as { message?: string }).message ||
          'Nie udało się utworzyć nowego repozytorium na koncie GitHub.'
      );
    }
    repoData = await createResp.json();
    createdNewRepo = true;
    // Brief pause so GitHub finishes initializing initial main commit
    await new Promise((r) => setTimeout(r, 900));
  } else if (!checkResp.ok) {
    throw new Error('Brak uprawnień do odczytu wskazanego repozytorium GitHub.');
  } else {
    repoData = await checkResp.json();
  }

  const targetBranch = params.branch.trim() || repoData.default_branch || 'main';

  // 3. Resolve latest commit SHA on targetBranch (or default_branch)
  let baseCommitSha: string | null = null;
  let baseTreeSha: string | null = null;

  const refResp = await fetch(
    `https://api.github.com/repos/${repoData.full_name}/git/ref/heads/${targetBranch}`,
    { headers: ghHeaders }
  );
  if (refResp.ok) {
    const refData = await refResp.json();
    baseCommitSha = refData?.object?.sha || null;
  } else {
    const fallbackRef = await fetch(
      `https://api.github.com/repos/${repoData.full_name}/git/ref/heads/${repoData.default_branch || 'main'}`,
      { headers: ghHeaders }
    );
    if (fallbackRef.ok) {
      const refData = await fallbackRef.json();
      baseCommitSha = refData?.object?.sha || null;
    }
  }

  if (baseCommitSha) {
    const commitResp = await fetch(
      `https://api.github.com/repos/${repoData.full_name}/git/commits/${baseCommitSha}`,
      { headers: ghHeaders }
    );
    if (commitResp.ok) {
      const commitData = await commitResp.json();
      baseTreeSha = commitData?.tree?.sha || null;
    }
  }

  // 4. Create blobs for all repository files
  const treeItems: Array<{
    path: string;
    mode: '100644' | '100755';
    type: 'blob';
    sha: string;
  }> = [];

  for (const file of params.files) {
    const blobResp = await fetch(
      `https://api.github.com/repos/${repoData.full_name}/git/blobs`,
      {
        method: 'POST',
        headers: ghHeaders,
        body: JSON.stringify({
          content: file.content,
          encoding: file.encoding === 'base64' ? 'base64' : 'utf-8',
        }),
      }
    );
    if (!blobResp.ok) {
      throw new Error(`Błąd zapisu pliku ${file.path} w drzewie Git.`);
    }
    const blobJson = (await blobResp.json()) as { sha: string };
    treeItems.push({
      path: file.path,
      mode: file.path.endsWith('.sh') ? '100755' : '100644',
      type: 'blob',
      sha: blobJson.sha,
    });
  }

  // 5. Create Git tree
  const treeResp = await fetch(
    `https://api.github.com/repos/${repoData.full_name}/git/trees`,
    {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({
        ...(baseTreeSha ? { base_tree: baseTreeSha } : {}),
        tree: treeItems,
      }),
    }
  );
  if (!treeResp.ok) {
    throw new Error('Nie udało się zbudować drzewa plików Git na GitHub.');
  }
  const treeJson = (await treeResp.json()) as { sha: string };

  // 6. Create Git commit
  const newCommitResp = await fetch(
    `https://api.github.com/repos/${repoData.full_name}/git/commits`,
    {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({
        message:
          params.commitMessage.trim() ||
          'feat: export frontend model & tactile UI elements from Aether Tactile Studio',
        tree: treeJson.sha,
        parents: baseCommitSha ? [baseCommitSha] : [],
      }),
    }
  );
  if (!newCommitResp.ok) {
    throw new Error('Nie udało się utworzyć commita w repozytorium GitHub.');
  }
  const newCommitJson = (await newCommitResp.json()) as { sha: string };

  // 7. Update or create branch reference
  const updateRefResp = await fetch(
    `https://api.github.com/repos/${repoData.full_name}/git/refs/heads/${targetBranch}`,
    {
      method: 'PATCH',
      headers: ghHeaders,
      body: JSON.stringify({
        sha: newCommitJson.sha,
        force: true,
      }),
    }
  );

  if (!updateRefResp.ok) {
    const createRefResp = await fetch(
      `https://api.github.com/repos/${repoData.full_name}/git/refs`,
      {
        method: 'POST',
        headers: ghHeaders,
        body: JSON.stringify({
          ref: `refs/heads/${targetBranch}`,
          sha: newCommitJson.sha,
        }),
      }
    );
    if (!createRefResp.ok) {
      throw new Error('Nie udało się zaktualizować gałęzi docelowej na GitHub.');
    }
  }

  // 8. Best-effort sync repository About description & Topics on GitHub
  const cleanTopics = (params.topics || [])
    .map((t) =>
      t
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50)
    )
    .filter(Boolean)
    .slice(0, 20);

  if (cleanTopics.length > 0) {
    try {
      await fetch(`https://api.github.com/repos/${repoData.full_name}/topics`, {
        method: 'PUT',
        headers: ghHeaders,
        body: JSON.stringify({ names: cleanTopics }),
      });
    } catch {
      // Non-fatal if token lacks administration/metadata permission
    }
  }

  return {
    repoFullName: repoData.full_name,
    repoHtmlUrl: repoData.html_url,
    branch: targetBranch,
    commitSha: newCommitJson.sha,
    filesCount: params.files.length,
    createdNewRepo,
    appliedTopics: cleanTopics,
  };
}

export async function exportRepositoryToGitHub(params: {
  githubToken: string;
  repoName: string;
  repoDescription: string;
  topics?: string[];
  isPrivate: boolean;
  branch?: string;
  commitMessage?: string;
  bundleInput: BuildFrontendRepositoryInput;
}): Promise<GitHubRepoExportResult> {
  const files = buildCompleteFrontendRepositoryFiles(params.bundleInput);
  const branch = params.branch || 'main';
  const commitMessage =
    params.commitMessage ||
    'feat: export designed frontend model, UI elements & app plugins from Aether Tactile Studio';
  const topics =
    params.topics || params.bundleInput.repoProfile?.topics || [];

  // Try server-side proxy first when online on HTTP/HTTPS, otherwise direct GitHub API
  const isStandaloneOrFile =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' || Boolean(window.__AETHER_STANDALONE_OFFLINE__));

  if (!isStandaloneOrFile) {
    try {
      const resp = await studioApiFetch('/api/github/export-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubToken: params.githubToken,
          repoName: params.repoName,
          repoDescription: params.repoDescription,
          topics,
          isPrivate: params.isPrivate,
          branch,
          commitMessage,
          files,
        }),
      });
      if (resp.ok) {
        return (await resp.json()) as GitHubRepoExportResult;
      }
      const errData = await resp.json().catch(() => ({}));
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 404) {
        throw new Error(
          (errData as { error?: string }).error || 'Błąd eksportu repozytorium na GitHub.'
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('token')) {
        throw err;
      }
      // Fall through to direct browser -> api.github.com CORS call
    }
  }

  return pushFilesDirectlyViaGitHubApi({
    githubToken: params.githubToken,
    repoName: params.repoName,
    repoDescription: params.repoDescription,
    topics,
    isPrivate: params.isPrivate,
    branch,
    commitMessage,
    files,
  });
}
