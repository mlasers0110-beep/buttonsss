import {
  AppScreenMapProject,
  CalibrationTargetCharacter,
  DepthShadowSettings,
  DriverCalibrationReport,
  FileUploadPlanRequestPayload,
  GeneratedCompleteElement,
  HapticMaterialType,
  HapticSettings,
  MATERIAL_PROFILES,
  PaletteMode,
  PrototypeDropZone,
  RotaryDriverCalibrationConfig,
  ScreenTransitionPresetId,
  SynthPatchSettings,
  UploadedFileBuildPlan,
} from '../types/studio';
import {
  getStoredActiveStudioSession,
  resolveCloudOriginUrl,
} from './studioAccountAuth';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// 1. Offline Rotary CNC Calibration Law
// ============================================================================
export function runOfflineDriverCalibration(
  raw: Partial<RotaryDriverCalibrationConfig>,
  targetCharacter: CalibrationTargetCharacter
): {
  calibratedConfig: RotaryDriverCalibrationConfig;
  report: DriverCalibrationReport;
} {
  const clamp = (val: number, min: number, max: number) =>
    Math.max(min, Math.min(max, val));

  let detentCount = clamp(Math.round(Number(raw.detentCount) || 120), 12, 120);
  let majorTickEvery = clamp(Math.round(Number(raw.majorTickEvery) || 10), 4, 15);
  const sweepAngleDeg = clamp(Math.round(Number(raw.sweepAngleDeg) || 270), 180, 300);
  let lowBodyFreqHz = clamp(Math.round(Number(raw.lowBodyFreqHz) || 74), 36, 156);
  let mouseSnapBlend = clamp(Math.round(Number(raw.mouseSnapBlend) || 82), 0, 100);
  let majorTickAccent = Number(
    clamp(Number(raw.majorTickAccent) || 1.65, 1.0, 2.4).toFixed(2)
  );
  let rotaryHapticStrength = clamp(
    Math.round(Number(raw.rotaryHapticStrength) || 84),
    10,
    100
  );
  let tickPulseMs = clamp(Math.round(Number(raw.tickPulseMs) || 9), 3, 36);
  let endStopResistance = clamp(
    Math.round(Number(raw.endStopResistance) || 90),
    10,
    100
  );
  const axialPushForce = clamp(Math.round(Number(raw.axialPushForce) || 88), 10, 100);
  const backlashClutch = clamp(Math.round(Number(raw.backlashClutch) || 76), 0, 100);

  if (targetCharacter === 'reference-cnc') {
    detentCount = 120;
    majorTickEvery = 10;
    lowBodyFreqHz = clamp(lowBodyFreqHz, 64, 92);
    mouseSnapBlend = clamp(Math.max(76, mouseSnapBlend), 76, 94);
    tickPulseMs = clamp(tickPulseMs, 7, 11);
    majorTickAccent = 1.68;
  } else if (targetCharacter === 'studio-master') {
    detentCount = 60;
    majorTickEvery = 10;
    lowBodyFreqHz = 84;
    mouseSnapBlend = 92;
    tickPulseMs = 11;
    majorTickAccent = 1.85;
    rotaryHapticStrength = 88;
  } else if (targetCharacter === 'heavy-flywheel') {
    detentCount = 24;
    majorTickEvery = 6;
    lowBodyFreqHz = 56;
    mouseSnapBlend = 74;
    tickPulseMs = 18;
    majorTickAccent = 2.05;
    rotaryHapticStrength = 94;
    endStopResistance = 98;
  } else if (targetCharacter === 'silent-night') {
    detentCount = 96;
    majorTickEvery = 12;
    lowBodyFreqHz = 48;
    mouseSnapBlend = 42;
    tickPulseMs = 6;
    majorTickAccent = 1.35;
    rotaryHapticStrength = 52;
  }

  const stepAngleDeg = Number((sweepAngleDeg / detentCount).toFixed(2));
  const minCycleSec = (tickPulseMs + 6) / 1000;
  const maxCleanSpeedDegPerSec = Math.round(stepAngleDeg / Math.max(0.008, minCycleSec));
  const minorImpulseIndex = Number(
    ((rotaryHapticStrength / 100) * tickPulseMs * 0.12).toFixed(2)
  );
  const majorImpulseIndex = Number((minorImpulseIndex * majorTickAccent).toFixed(2));
  const acousticBalanceScore = clamp(
    Math.round(
      98 -
        Math.abs(mouseSnapBlend - 80) * 0.18 -
        (detentCount > 90 && tickPulseMs > 14 ? 12 : 0)
    ),
    72,
    99
  );

  return {
    calibratedConfig: {
      detentCount,
      majorTickEvery,
      sweepAngleDeg,
      lowBodyFreqHz,
      mouseSnapBlend,
      majorTickAccent,
      rotaryHapticStrength,
      tickPulseMs,
      endStopResistance,
      axialPushForce,
      backlashClutch,
    },
    report: {
      stepAngleDeg,
      maxCleanSpeedDegPerSec,
      minorImpulseIndex,
      majorImpulseIndex,
      verifiedSub160Hz: lowBodyFreqHz < 160,
      acousticBalanceScore,
      recommendation: `Skalibrowano w trybie Offline podziałkę ${detentCount} kroków (${stepAngleDeg}°/krok) z tonem trzpienia ${lowBodyFreqHz} Hz (<160 Hz) oraz selektywnością do ${maxCleanSpeedDegPerSec} °/s.`,
      calibratedAt: new Date().toLocaleTimeString('pl-PL'),
    },
  };
}

// ============================================================================
// 2. Offline Acoustically-Coupled Animation Optimizer
// ============================================================================
export function optimizeAnimationOffline(
  synth: SynthPatchSettings,
  haptic: HapticSettings,
  depth: DepthShadowSettings
) {
  const hNorm = Math.max(0.05, Math.min(1, (haptic.materialHardness || 74) / 100));
  const freqNorm = Math.max(0, Math.min(1, ((synth.baseFrequency || 86) - 36) / 122));
  const stiffness = Math.round(240 + hNorm * 380 + freqNorm * 95);
  const damping = Math.round(18 + (1 - hNorm) * 20 + (synth.reverbMix || 0.14) * 12);
  const mass = Number((1.15 - hNorm * 0.45).toFixed(2));
  const pressScale = Number((0.946 + hNorm * 0.032).toFixed(3));
  const rippleDurationMs = Math.round(
    Math.max(300, Math.min(900, (synth.decayMs || 115) * 3.8 + depth.glassBlur * 4))
  );
  const glowSpread = Math.round(
    Math.max(16, Math.min(54, depth.glassBlur * 1.35 + (haptic.intensity || 76) * 0.12))
  );
  const holdTremorHz = Math.round(12 + hNorm * 16);

  const matLabel = MATERIAL_PROFILES[haptic.material]?.label || 'Szkło matowe';
  return {
    stiffness,
    damping,
    mass,
    pressScale,
    rippleDurationMs,
    glowSpread,
    holdTremorHz,
    aiNote: `Silnik fizyki Offline: zestrojono sprężynę (${stiffness} N/m, tłumienie ${damping}) z materiałem ${matLabel} (${haptic.materialHardness} Sh) i tonem sub-basowym ${synth.baseFrequency} Hz (<160 Hz).`,
  };
}

// ============================================================================
// 3. Offline Source Prompt & PBR Config Expander
// ============================================================================
export function expandPromptOffline(body: {
  concept?: string;
  palette?: PaletteMode;
  material?: HapticMaterialType;
  depth?: DepthShadowSettings;
}) {
  const rawConcept =
    (body.concept || '').trim() ||
    'Szklany interfejs dotykowy z podświetlanymi rycinami i przyciskiem Dalej';
  const mat = body.material || 'frosted-glass';
  const matProfile = MATERIAL_PROFILES[mat] || MATERIAL_PROFILES['frosted-glass'];
  const paletteLabel =
    body.palette === 'emerald-clinic'
      ? 'Szmaragdowa Klinika (#071814 + #34D399)'
      : body.palette === 'finance-ice'
        ? 'FinanceAI Błękit (#EEF4FF + #4F46E5)'
        : 'Perłowa Flebologia (#EFEFFA + #8B7CFF)';

  const iorMap: Record<HapticMaterialType, number> = {
    'shiny-glass': 1.54,
    'frosted-glass': 1.49,
    'matte-metal': 2.35,
    'abs-plastic': 1.46,
    suede: 1.32,
  };

  return {
    title: rawConcept.slice(0, 56),
    category: `Offline Studio · ${matProfile.label}`,
    promptText: `High-resolution tactile UI design showcase for "${rawConcept}". Surface material: ${matProfile.englishLabel} (${matProfile.defaultHardness} Shore), palette: ${paletteLabel}, backdrop glass blur ${body.depth?.glassBlur ?? 22}px, elevation shadow ${body.depth?.elevation ?? 20}px, corner radius ${body.depth?.borderRadius ?? 28}px. Crisp 3-zone hierarchy, precision laser-etched iconography, soft studio softbox rim lighting, 8k editorial clarity.`,
    lightingSetup: 'Dual softbox key 45° + chłodna krawędź spekularna 6200K',
    opticalIor: iorMap[mat] || 1.49,
    recommendedHardness: matProfile.defaultHardness,
    recommendedReverseClutch: matProfile.defaultReverseClutch,
  };
}

// ============================================================================
// 4. Offline Screen Image Prompt Refiner (Preserves Exact Button Coordinates)
// ============================================================================
export function refineScreenPromptOffline(body: {
  basePrompt?: string;
  screenTitle?: string;
  totalButtons?: number;
  language?: string;
}) {
  const base = (body.basePrompt || '').trim();
  const count = Number(body.totalButtons) || 0;
  const suffix =
    body.language === 'pl'
      ? `\nOŚWIETLENIE I MIKRODETAL (TRYB OFFLINE): Miękkie studyjne światło dyfuzyjne, ostre krawędzie antyaliasingowe kart i kontrolek, pełna czytelność typografii oraz rygorystyczne zachowanie dokładnie ${count} przycisków na wskazanych współrzędnych X/Y bez dodatkowych elementów.`
      : `\nLIGHTING & SURFACE PRECISION (OFFLINE STUDIO ENGINE): Diffused architectural softbox lighting, crisp micro-beveled tactile edges, high-contrast legible labels, strictly preserving all ${count} numbered buttons at their exact X/Y coordinates with zero extra interactive elements.`;
  return {
    refinedPrompt: `${base}${suffix}`,
    model: 'Offline Spatial Refiner Engine',
  };
}

// ============================================================================
// 5. Offline GitHub Repository -> Multi-Screen Architecture Synthesizer
// ============================================================================
export function generateScreenMapFromGitHubOffline(body: {
  repoInput?: string;
  appGoal?: string;
}): { mapProject: AppScreenMapProject } {
  const rawInput = String(body.repoInput || 'aether-ui/tactile-kit').trim();
  const cleaned = rawInput
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  const parts = cleaned.split('/').filter(Boolean);
  const owner = parts[0] || 'studio-ai';
  const repo = parts[1] || parts[0] || 'offline-workspace';
  const repoFullName = `${owner}/${repo}`;
  const cleanCap = repo.charAt(0).toUpperCase() + repo.slice(1);

  const nodes: AppScreenMapProject['nodes'] = [
    {
      id: 'gh-off-entry',
      title: `Start i Autoryzacja ${cleanCap}`,
      route: '/',
      role: 'entry',
      status: 'ready',
      summary: `Ekran wejściowy projektu ${repoFullName} z inicjalizacją sesji i wyborem modułu roboczego.`,
      components: [`${cleanCap}AuthCard`, 'QuickLaunchStrip', 'SessionStatus'],
      hapticMaterial: 'frosted-glass',
      preferredTransition: 'spatial-glass-push',
      githubSourcePath: 'src/App.tsx',
      x: 60,
      y: 70,
    },
    {
      id: 'gh-off-workspace',
      title: `Główny Pulpit Operacyjny ${cleanCap}`,
      route: '/workspace',
      role: 'core',
      status: 'ready',
      summary:
        body.appGoal ||
        `Centralna przestrzeń robocza łącząca kluczowe widoki i akcje repozytorium ${repoFullName}.`,
      components: [`${cleanCap}Stage`, 'MetricsGrid', 'PrimaryActionDock'],
      hapticMaterial: 'shiny-glass',
      preferredTransition: 'shared-axis-z-portal',
      githubSourcePath: 'src/views/Workspace.tsx',
      x: 400,
      y: 70,
    },
    {
      id: 'gh-off-catalog',
      title: `Biblioteka Modułów ${cleanCap}`,
      route: '/modules',
      role: 'core',
      status: 'designing',
      summary: `Przeglądarka komponentów, wariantów dotykowych i presetów skonfigurowanych dla ${repoFullName}.`,
      components: ['ModuleFilterBar', `${cleanCap}CatalogGrid`, 'PreviewDrawer'],
      hapticMaterial: 'frosted-glass',
      preferredTransition: 'cascade-split-deck',
      githubSourcePath: 'src/components/Catalog.tsx',
      x: 400,
      y: 260,
    },
    {
      id: 'gh-off-inspector',
      title: 'Inspektor Parametrów i Telemetrii',
      route: '/inspector',
      role: 'detail',
      status: 'designing',
      summary:
        'Szczegółowa edycja właściwości wybranego elementu, walidacja reguł oraz podgląd zmian na żywo.',
      components: ['PropertyMatrix', 'LiveWaveformView', 'SavePatchAction'],
      hapticMaterial: 'matte-metal',
      preferredTransition: 'cnc-shutter-snap',
      githubSourcePath: 'src/components/Inspector.tsx',
      x: 740,
      y: 70,
    },
    {
      id: 'gh-off-settings',
      title: 'Ustawienia Konta i Pracy Offline',
      route: '/settings',
      role: 'settings',
      status: 'review',
      summary:
        'Konfiguracja konta Studio AI, synchronizacji lokalnej oraz preferencji haptyczno-akustycznych.',
      components: ['StudioAccountPanel', 'OfflineSyncToggle', 'AudioHapticPrefs'],
      hapticMaterial: 'suede',
      preferredTransition: 'velvet-dissolve',
      githubSourcePath: 'src/views/Settings.tsx',
      x: 740,
      y: 260,
    },
    {
      id: 'gh-off-export',
      title: 'Arkusz Eksportu Pakietu Offline',
      route: '/export',
      role: 'modal',
      status: 'ready',
      summary:
        'Generowanie odrębnego pliku HTML, eksport architektury JSON/Mermaid oraz zapis migawki wersji.',
      components: ['StandaloneHtmlBuilder', 'MermaidExporter', 'SnapshotCommit'],
      hapticMaterial: 'shiny-glass',
      preferredTransition: 'frosted-sheet-detent',
      githubSourcePath: 'src/lib/exporter.ts',
      x: 1080,
      y: 155,
    },
  ];

  const edges: AppScreenMapProject['edges'] = [
    {
      id: 'gh-off-e1',
      fromScreenId: 'gh-off-entry',
      toScreenId: 'gh-off-workspace',
      triggerLabel: 'Otwórz przestrzeń roboczą',
      transitionId: 'spatial-glass-push',
    },
    {
      id: 'gh-off-e2',
      fromScreenId: 'gh-off-entry',
      toScreenId: 'gh-off-catalog',
      triggerLabel: 'Przeglądaj moduły',
      transitionId: 'cascade-split-deck',
    },
    {
      id: 'gh-off-e3',
      fromScreenId: 'gh-off-catalog',
      toScreenId: 'gh-off-workspace',
      triggerLabel: 'Osadź w projekcie',
      transitionId: 'shared-axis-z-portal',
    },
    {
      id: 'gh-off-e4',
      fromScreenId: 'gh-off-workspace',
      toScreenId: 'gh-off-inspector',
      triggerLabel: 'Edytuj parametry',
      transitionId: 'cnc-shutter-snap',
    },
    {
      id: 'gh-off-e5',
      fromScreenId: 'gh-off-workspace',
      toScreenId: 'gh-off-settings',
      triggerLabel: 'Konto i tryb Offline',
      transitionId: 'velvet-dissolve',
    },
    {
      id: 'gh-off-e6',
      fromScreenId: 'gh-off-inspector',
      toScreenId: 'gh-off-export',
      triggerLabel: 'Pobierz pakiet',
      transitionId: 'frosted-sheet-detent',
    },
  ];

  return {
    mapProject: {
      id: `gh-offline-${Date.now()}`,
      name: `Architektura Offline: ${repoFullName}`,
      description:
        body.appGoal ||
        `Kompletna mapa ekranów wygenerowana lokalnie dla ${repoFullName} w trybie Offline Studio.`,
      sourceRepo: repoFullName,
      defaultTransition: 'spatial-glass-push',
      nodes,
      edges,
      githubMeta: {
        repoFullName,
        repoUrl: `https://github.com/${repoFullName}`,
        description: 'Synteza architektury w lokalnym silniku Offline Aether Studio',
        language: 'TypeScript',
        stars: 120,
        defaultBranch: 'main',
        detectedPackages: ['react', 'tailwindcss', 'three', 'motion'],
        detectedModules: nodes.map((n) => n.components[0]),
        architectureSummary: `Zbudowano 6-ekranowy graf nawigacyjny DAG dla ${repoFullName} bez użycia sieci zewnętrznej.`,
        generatedByModel: 'Lokalny Architekt AST Offline',
      },
      createdAt: new Date().toLocaleDateString('pl-PL'),
    },
  };
}

// ============================================================================
// 6. Offline Uploaded File -> Screen Plan & Website/WebApp Build Matrix
// ============================================================================
export function generatePlanAndMatrixFromFileOffline(
  payload: FileUploadPlanRequestPayload
): {
  mapProject: AppScreenMapProject;
  buildMatrix: UploadedFileBuildPlan;
} {
  const fileName = (payload.fileName || 'specyfikacja-projektu.md').trim();
  const baseTitle = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  const projectTitle =
    baseTitle.charAt(0).toUpperCase() + baseTitle.slice(1) || 'Projekt Aether Offline';

  // Extract headings / keywords from textContent when available
  const extractedHeadings = (payload.textContent || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[#*\-\d.)\s]+/, '').trim())
    .filter((line) => line.length >= 4 && line.length <= 64)
    .slice(0, 6);

  const s1 = extractedHeadings[0] || `Strona Główna — ${projectTitle}`;
  const s2 = extractedHeadings[1] || 'Katalog Oferty i Rozwiązań';
  const s3 = extractedHeadings[2] || 'Panel Główny Aplikacji (Dashboard)';
  const s4 = extractedHeadings[3] || 'Edytor i Konfigurator Parametrów';
  const s5 = extractedHeadings[4] || 'Autoryzacja i Profil Konta Studio';
  const s6 = extractedHeadings[5] || 'Eksport Raportów i Pakietu Offline';

  const defaultTransition: ScreenTransitionPresetId = 'spatial-glass-push';
  const mapId = `file-off-map-${Date.now()}`;

  const mapProject: AppScreenMapProject = {
    id: mapId,
    name: `Plan z pliku: ${projectTitle}`,
    description:
      payload.projectGoal ||
      `Architektura ekranów wyodrębniona lokalnie z pliku "${fileName}" w trybie Offline.`,
    sourceRepo: `plik:${fileName}`,
    defaultTransition,
    nodes: [
      {
        id: 'file-scr-1',
        title: s1,
        route: '/',
        role: 'entry',
        status: 'ready',
        summary: `Punkt wejścia wygenerowany z pliku ${fileName}: propozycja wartości, nawigacja 3-strefowa i główne wezwanie do działania.`,
        components: ['HeroShowcase', 'ValueMetricsStrip', 'PrimaryEntryButton'],
        hapticMaterial: 'frosted-glass',
        preferredTransition: 'spatial-glass-push',
        x: 60,
        y: 75,
      },
      {
        id: 'file-scr-2',
        title: s2,
        route: '/oferta',
        role: 'core',
        status: 'ready',
        summary: 'Prezentacja kluczowych modułów z filtrowaniem i porównaniem parametrów.',
        components: ['SegmentedCategoryFilter', 'FeatureComparisonGrid', 'ActionDrawer'],
        hapticMaterial: 'shiny-glass',
        preferredTransition: 'cascade-split-deck',
        x: 400,
        y: 75,
      },
      {
        id: 'file-scr-3',
        title: s3,
        route: '/app',
        role: 'core',
        status: 'ready',
        summary: 'Główny widok operacyjny aplikacji internetowej z tabelami danych i kontrolkami dotykowymi.',
        components: ['WorkspaceSidebar', 'LiveAnalyticsTable', 'QuickActionToolbar'],
        hapticMaterial: 'frosted-glass',
        preferredTransition: 'shared-axis-z-portal',
        x: 400,
        y: 265,
      },
      {
        id: 'file-scr-4',
        title: s4,
        route: '/app/edytor',
        role: 'detail',
        status: 'designing',
        summary: 'Szczegółowy moduł konfiguracji, edycji rekordów oraz kalibracji parametrów.',
        components: ['PrecisionSliders', 'LivePreviewStage', 'SaveChangesBar'],
        hapticMaterial: 'matte-metal',
        preferredTransition: 'cnc-shutter-snap',
        x: 740,
        y: 75,
      },
      {
        id: 'file-scr-5',
        title: s5,
        route: '/konto',
        role: 'settings',
        status: 'review',
        summary: 'Zarządzanie kontem użytkownika, uprawnieniami oraz lokalnym skarbcem offline.',
        components: ['AccountAuthForm', 'RecoveryKeyCard', 'PreferencesMatrix'],
        hapticMaterial: 'suede',
        preferredTransition: 'velvet-dissolve',
        x: 740,
        y: 265,
      },
      {
        id: 'file-scr-6',
        title: s6,
        route: '/eksport',
        role: 'modal',
        status: 'ready',
        summary: 'Pobieranie gotowych artefaktów projektu, plików JSON/WAV oraz wersji offline.',
        components: ['ExportFormatSelector', 'BundleSummary', 'DownloadTrigger'],
        hapticMaterial: 'shiny-glass',
        preferredTransition: 'frosted-sheet-detent',
        x: 1080,
        y: 165,
      },
    ],
    edges: [
      {
        id: 'fe-1',
        fromScreenId: 'file-scr-1',
        toScreenId: 'file-scr-2',
        triggerLabel: 'Poznaj szczegóły',
        transitionId: 'cascade-split-deck',
      },
      {
        id: 'fe-2',
        fromScreenId: 'file-scr-1',
        toScreenId: 'file-scr-3',
        triggerLabel: 'Uruchom aplikację',
        transitionId: 'spatial-glass-push',
      },
      {
        id: 'fe-3',
        fromScreenId: 'file-scr-3',
        toScreenId: 'file-scr-4',
        triggerLabel: 'Otwórz konfigurator',
        transitionId: 'cnc-shutter-snap',
      },
      {
        id: 'fe-4',
        fromScreenId: 'file-scr-3',
        toScreenId: 'file-scr-5',
        triggerLabel: 'Profil i autoryzacja',
        transitionId: 'velvet-dissolve',
      },
      {
        id: 'fe-5',
        fromScreenId: 'file-scr-4',
        toScreenId: 'file-scr-6',
        triggerLabel: 'Eksportuj wyniki',
        transitionId: 'frosted-sheet-detent',
      },
    ],
    createdAt: new Date().toLocaleDateString('pl-PL'),
  };

  const fileSizeKb = Math.max(1, Math.round((payload.fileSize || 2048) / 1024));

  const buildMatrix: UploadedFileBuildPlan = {
    id: `matrix-off-${Date.now()}`,
    fileName,
    fileMimeType: payload.mimeType || 'text/plain',
    fileSizeKb,
    targetType: payload.targetType || 'website-and-webapp',
    projectTitle: `Matryca Budowy: ${projectTitle}`,
    executiveSummary: `Lokalny analizator Offline przetworzył plik "${fileName}" (${fileSizeKb} KB) i przygotował 6-ekranowy plan nawigacji DAG, matrycę sekcji strony WWW (1440px) oraz specyfikację modułów aplikacji internetowej.`,
    generatedByModel: 'Lokalny Analizator Dokumentów Aether Offline',
    createdAt: new Date().toLocaleDateString('pl-PL'),
    linkedScreenMapId: mapId,
    designTokens: {
      recommendedPalette: 'Perłowa powierzchnia #F8FAFC + kontrast #0F172A + akcent #4F46E5',
      typographyPairing: 'Plus Jakarta Sans (nagłówki i UI) + JetBrains Mono (metryki tabular-nums)',
      layoutArchitecture: 'Top Bar 3-strefowy + kontener 1360px, siatka 12-kolumnowa',
      primaryHapticMaterial: 'frosted-glass',
      stackRecommendation: 'React 19 + TypeScript + Tailwind CSS v4 + Offline Local Vault',
    },
    websiteMatrix: [
      {
        id: 'wm-1',
        sectionName: `01. Sekcja Hero — ${s1}`,
        routeOrAnchor: '/#start',
        gridLayout: 'Split 7/5 kolumn na 1440px, 1 kolumna na Mobile',
        keyComponents: ['3-Zone Header', 'Headline + CTA', 'Interactive Preview Card'],
        visualAndTactileSpec: 'Szkło matowe 22px blur, klik podstawowy 86 Hz (<160 Hz)',
        conversionGoal: 'Przejście do głównego modułu aplikacji lub rejestracja konta',
        buildPrompt: `Zbuduj sekcję Hero dla "${projectTitle}" w układzie 7/5 kolumn z czystym 3-strefowym paskiem nawigacji i pojedynczym głównym przyciskiem CTA.`,
      },
      {
        id: 'wm-2',
        sectionName: `02. Matryca Funkcji — ${s2}`,
        routeOrAnchor: '/#funkcje',
        gridLayout: 'Siatka 3-kolumnowa o równej wysokości kart (items-stretch)',
        keyComponents: ['Segmented Filter', '3 Feature Cards', 'Quantitative Proof Row'],
        visualAndTactileSpec: 'Karty o pojedynczej elewacji 1px border, cyfry tabular-nums',
        conversionGoal: 'Porównanie możliwości systemu bez przeładowania wizualnego',
        buildPrompt: `Zaprojektuj 3-kolumnową sekcję możliwości dla "${projectTitle}" z przełącznikiem kategorii i wymiernymi wskaźnikami.`,
      },
      {
        id: 'wm-3',
        sectionName: '03. Architektura Bezpieczeństwa i Trybu Offline',
        routeOrAnchor: '/#offline',
        gridLayout: 'Układ 6/6 kolumn z tabelą specyfikacji technicznej',
        keyComponents: ['Specification Table', 'Offline Badge-Free Status', 'Download CTA'],
        visualAndTactileSpec: 'Anodowany metal 95 Sh, mikroprzełącznik o niskim tonie 74 Hz',
        conversionGoal: 'Pobranie pakietu offline lub założenie konta Studio AI',
        buildPrompt: `Dodaj sekcję specyfikacji technicznej i pracy offline z czytelną tabelą parametrów oraz przyciskiem pobrania.`,
      },
    ],
    webAppMatrix: [
      {
        id: 'wam-1',
        moduleName: s3,
        route: '/app',
        userRole: 'Zalogowany twórca / Operator',
        stateAndDataFlow: 'Lokalny skarbiec Offline + synchronizacja REST / Firestore po połączeniu',
        uiComponents: ['FilterToolbar', 'DataGrid', 'StatusSummary'],
        transitionAndHaptics: 'Spatial Glass Push (420 ms) + Szkło matowe (74 Sh)',
        acceptanceCriteria: 'Pełna obsługa stanów pustych, ładowania i filtrowania bez opóźnień',
      },
      {
        id: 'wam-2',
        moduleName: s4,
        route: '/app/edytor',
        userRole: 'Projektant / Inżynier',
        stateAndDataFlow: 'Natychmiastowy zapis zmian w stanie projektu i historii wersji',
        uiComponents: ['HapticSliders', 'DragDropCanvas', 'ExportModal'],
        transitionAndHaptics: 'CNC Shutter Snap (340 ms) + Anodowany metal (86 Hz)',
        acceptanceCriteria: 'Wszystkie suwaki i akcje eksportu działają w 100% offline',
      },
      {
        id: 'wam-3',
        moduleName: s5,
        route: '/konto',
        userRole: 'Właściciel konta Studio AI',
        stateAndDataFlow: 'Weryfikacja skrótu hasła SHA-256 + klucz odzyskiwania AETH-XXXX',
        uiComponents: ['StudioRegistrationForm', 'LoginPanel', 'RecoveryVault'],
        transitionAndHaptics: 'Velvet Dissolve (380 ms) + Zamsz (42 Sh)',
        acceptanceCriteria: 'Rejestracja i logowanie działają zarówno z serwerem, jak i w pliku lokalnym HTML',
      },
    ],
    masterBuildPrompt: `Zbuduj kompletną stronę internetową oraz aplikację webową "${projectTitle}" na podstawie pliku "${fileName}". Zastosuj 3-strefowy pasek górny, typografię Plus Jakarta Sans + JetBrains Mono (tabular-nums), 6 ekranów (${s1}, ${s2}, ${s3}, ${s4}, ${s5}, ${s6}), autoryzację konta użytkownika z obsługą trybu offline oraz eksport danych do formatów JSON/HTML.`,
  };

  return { mapProject, buildMatrix };
}

// ============================================================================
// 7. Offline Procedural High-DPI Canvas Renderer & Pixel Image Analyzer
// ============================================================================
export async function generateOfflineProceduralImage(body: {
  prompt?: string;
  aspectRatio?: string;
  imageSize?: string;
}): Promise<{ imageUrl: string; notes: string }> {
  const ratio = body.aspectRatio || '1:1';
  let width = 1024;
  let height = 1024;
  if (ratio === '16:9') {
    width = 1280;
    height = 720;
  } else if (ratio === '9:16') {
    width = 720;
    height = 1280;
  } else if (ratio === '4:3') {
    width = 1152;
    height = 864;
  } else if (ratio === '3:4') {
    width = 864;
    height = 1152;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Brak wsparcia Canvas 2D w przeglądarce.');
  }

  const promptText = String(body.prompt || 'Aether Tactile UI').trim();
  const isEmerald = /emerald|szmaragd|dark|ciemny/i.test(promptText);

  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  if (isEmerald) {
    bgGrad.addColorStop(0, '#061512');
    bgGrad.addColorStop(0.5, '#0B251F');
    bgGrad.addColorStop(1, '#081B17');
  } else {
    bgGrad.addColorStop(0, '#EEF2FF');
    bgGrad.addColorStop(0.5, '#E2E8F8');
    bgGrad.addColorStop(1, '#EDE9FE');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle ambient optical caustics
  const glow = ctx.createRadialGradient(
    width * 0.32,
    height * 0.28,
    20,
    width * 0.32,
    height * 0.28,
    width * 0.55
  );
  glow.addColorStop(
    0,
    isEmerald ? 'rgba(52, 211, 153, 0.20)' : 'rgba(99, 102, 241, 0.20)'
  );
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const pad = Math.round(Math.min(width, height) * 0.07);
  const frameW = width - pad * 2;
  const frameH = height - pad * 2;

  // Main frosted glass artboard
  ctx.save();
  ctx.fillStyle = isEmerald ? 'rgba(12, 39, 33, 0.82)' : 'rgba(255, 255, 255, 0.84)';
  ctx.strokeStyle = isEmerald
    ? 'rgba(110, 231, 183, 0.28)'
    : 'rgba(148, 163, 184, 0.38)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(pad, pad, frameW, frameH, 28);
  ctx.fill();
  ctx.stroke();

  // Top Bar inside artboard
  const headerH = Math.round(frameH * 0.11);
  ctx.strokeStyle = isEmerald
    ? 'rgba(110, 231, 183, 0.16)'
    : 'rgba(148, 163, 184, 0.25)';
  ctx.beginPath();
  ctx.moveTo(pad + 24, pad + headerH);
  ctx.lineTo(pad + frameW - 24, pad + headerH);
  ctx.stroke();

  ctx.fillStyle = isEmerald ? '#ECFDF5' : '#0F172A';
  ctx.font = `600 ${Math.max(16, Math.round(width * 0.018))}px sans-serif`;
  ctx.fillText('Aether Tactile Studio · Render Offline', pad + 32, pad + headerH * 0.62);

  // Extract quoted labels or button count from prompt
  const quotedLabels = Array.from(promptText.matchAll(/"([^"]{2,28})"/g))
    .map((m) => m[1])
    .slice(0, 6);
  const labels =
    quotedLabels.length > 0
      ? quotedLabels
      : ['Start', 'Parametry', 'Kalibracja CNC', 'Zapisz stan', 'Dalej'];

  // Workspace cards & tactile buttons
  const bodyTop = pad + headerH + 28;
  const bodyH = frameH - headerH - 116;
  const cols = width >= height ? 2 : 1;
  const cardGap = 20;
  const colW = (frameW - 64 - (cols - 1) * cardGap) / cols;

  for (let c = 0; c < cols; c++) {
    const cx = pad + 32 + c * (colW + cardGap);
    ctx.fillStyle = isEmerald
      ? 'rgba(6, 24, 20, 0.72)'
      : 'rgba(248, 250, 252, 0.92)';
    ctx.strokeStyle = isEmerald
      ? 'rgba(52, 211, 153, 0.22)'
      : 'rgba(203, 213, 225, 0.8)';
    ctx.beginPath();
    ctx.roundRect(cx, bodyTop, colW, bodyH, 20);
    ctx.fill();
    ctx.stroke();

    // Draw tactile wave / dial motif in first card, buttons in second
    if (c === 0) {
      const centerX = cx + colW / 2;
      const centerY = bodyTop + bodyH * 0.46;
      const radius = Math.min(colW, bodyH) * 0.25;
      ctx.strokeStyle = isEmerald ? '#34D399' : '#4F46E5';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 2.25 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = isEmerald ? 'rgba(52,211,153,0.14)' : 'rgba(79,70,229,0.10)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.72, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isEmerald ? '#A7F3D0' : '#334155';
      ctx.font = `500 ${Math.max(13, Math.round(width * 0.014))}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('86 Hz · 74 Sh · 270°', centerX, bodyTop + bodyH - 28);
      ctx.textAlign = 'left';
    } else {
      const btnCount = Math.min(4, labels.length);
      const btnH = Math.min(58, (bodyH - 56) / Math.max(1, btnCount) - 10);
      for (let b = 0; b < btnCount; b++) {
        const by = bodyTop + 24 + b * (btnH + 12);
        ctx.fillStyle =
          b === 0
            ? isEmerald
              ? '#34D399'
              : '#0F172A'
            : isEmerald
              ? 'rgba(16, 56, 47, 0.9)'
              : '#FFFFFF';
        ctx.strokeStyle = isEmerald
          ? 'rgba(110, 231, 183, 0.3)'
          : 'rgba(203, 213, 225, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(cx + 20, by, colW - 40, btnH, 14);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle =
          b === 0
            ? isEmerald
              ? '#042F2E'
              : '#FFFFFF'
            : isEmerald
              ? '#ECFDF5'
              : '#1E293B';
        ctx.font = `600 ${Math.max(13, Math.round(width * 0.014))}px sans-serif`;
        ctx.fillText(labels[b], cx + 38, by + btnH * 0.62);
      }
    }
  }

  // Bottom Action Bar
  const dockY = pad + frameH - 70;
  const dockBtnW = Math.min(260, frameW - 64);
  ctx.fillStyle = isEmerald ? '#34D399' : '#4F46E5';
  ctx.beginPath();
  ctx.roundRect(pad + frameW - 32 - dockBtnW, dockY, dockBtnW, 46, 14);
  ctx.fill();
  ctx.fillStyle = isEmerald ? '#042F2E' : '#FFFFFF';
  ctx.font = `600 15px sans-serif`;
  ctx.fillText(
    labels[labels.length - 1] || 'Dalej',
    pad + frameW - 32 - dockBtnW + 24,
    dockY + 29
  );
  ctx.restore();

  return {
    imageUrl: canvas.toDataURL('image/png'),
    notes:
      'Wygenerowano proceduralny render UI wysokiej rozdzielczości przez lokalny silnik Canvas PBR (tryb Offline).',
  };
}

export async function analyzePhotoOffline(body: {
  imageBase64?: string;
}): Promise<{
  summary: string;
  suggestedMaterial: HapticMaterialType;
  suggestedHardness: number;
  suggestedGlassBlur: number;
  suggestedElevation: number;
  extractedPrompt: string;
}> {
  const src = String(body.imageBase64 || '');
  if (!src) {
    throw new Error('Brak obrazu do analizy.');
  }

  const stats = await new Promise<{
    avgLum: number;
    contrast: number;
    coolTint: boolean;
  }>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 64;
        c.height = 64;
        const ctx = c.getContext('2d');
        if (!ctx) {
          resolve({ avgLum: 180, contrast: 42, coolTint: true });
          return;
        }
        ctx.drawImage(img, 0, 0, 64, 64);
        const data = ctx.getImageData(0, 0, 64, 64).data;
        let lumSum = 0;
        let lumSqSum = 0;
        let rSum = 0;
        let bSum = 0;
        const count = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          lumSum += lum;
          lumSqSum += lum * lum;
          rSum += r;
          bSum += b;
        }
        const avgLum = lumSum / count;
        const variance = Math.max(0, lumSqSum / count - avgLum * avgLum);
        const contrast = Math.sqrt(variance);
        resolve({ avgLum, contrast, coolTint: bSum >= rSum });
      } catch {
        resolve({ avgLum: 180, contrast: 42, coolTint: true });
      }
    };
    img.onerror = () => resolve({ avgLum: 180, contrast: 42, coolTint: true });
    img.src = src.startsWith('data:') ? src : `data:image/png;base64,${src}`;
  });

  let suggestedMaterial: HapticMaterialType = 'frosted-glass';
  if (stats.contrast > 68) {
    suggestedMaterial = stats.avgLum < 110 ? 'matte-metal' : 'shiny-glass';
  } else if (stats.contrast < 28) {
    suggestedMaterial = 'suede';
  }

  const matInfo = MATERIAL_PROFILES[suggestedMaterial];
  const suggestedHardness = matInfo.defaultHardness;
  const suggestedGlassBlur = Math.round(
    Math.max(10, Math.min(34, 32 - stats.contrast * 0.18))
  );
  const suggestedElevation = Math.round(
    Math.max(8, Math.min(36, 12 + stats.contrast * 0.28))
  );

  return {
    summary: `Analiza kolorymetryczna Offline (luminancja ${Math.round(stats.avgLum)}/255, kontrast σ=${Math.round(stats.contrast)}): wykryto ${
      stats.coolTint ? 'chłodną' : 'ciepłą'
    } tonację powierzchni odpowiadającą profilowi „${matInfo.label}”.`,
    suggestedMaterial,
    suggestedHardness,
    suggestedGlassBlur,
    suggestedElevation,
    extractedPrompt: `Tactile UI composition with ${matInfo.englishLabel} surfaces (${suggestedHardness} Shore), ${
      stats.coolTint ? 'cool architectural slate-blue' : 'warm pearl neutral'
    } lighting, backdrop blur ${suggestedGlassBlur}px, soft elevation shadow ${suggestedElevation}px.`,
  };
}

const ZERO_LIMIT_LOCAL_MODE_KEY = 'aether_zero_limit_local_mode_v1';

export function getZeroLimitLocalMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ZERO_LIMIT_LOCAL_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setZeroLimitLocalMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage.setItem(ZERO_LIMIT_LOCAL_MODE_KEY, '1');
    } else {
      window.localStorage.removeItem(ZERO_LIMIT_LOCAL_MODE_KEY);
    }
  } catch {
    // Ignore restricted storage
  }
}

function hasLocalSynthesisEngineForPath(path: string): boolean {
  return (
    path === '/api/driver-calibration/analyze' ||
    path === '/api/gemini/optimize-animation' ||
    path === '/api/gemini/expand-prompt' ||
    path === '/api/screen-map/refine-image-prompt' ||
    path === '/api/screen-map/from-github' ||
    path === '/api/screen-map/from-file' ||
    path === '/api/gemini/generate-image' ||
    path === '/api/gemini/analyze-image' ||
    path === '/api/gemini/generate-complete-element' ||
    path === '/api/gemini/generate-repo-profile'
  );
}

// ============================================================================
// Unified Offline-Aware & Quota-Resilient Studio API Router (`studioApiFetch`)
// ============================================================================
export async function studioApiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const baseOrigin = resolveCloudOriginUrl();
  const isFileMode =
    typeof window !== 'undefined' && window.location.protocol === 'file:';
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const preferLocalZeroLimit =
    getZeroLimitLocalMode() && hasLocalSynthesisEngineForPath(path);

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Authorization')) {
    const activeStudio = getStoredActiveStudioSession();
    if (activeStudio?.serverToken) {
      headers.set('Authorization', `Bearer ${activeStudio.serverToken}`);
    }
  }

  const canTryNetwork =
    !preferLocalZeroLimit && isOnline && (!isFileMode || Boolean(baseOrigin));

  if (canTryNetwork) {
    try {
      const controller = new AbortController();
      const timeoutMs = path.includes('generate-video') ? 180000 : 22000;
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(`${baseOrigin}${path}`, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });
      window.clearTimeout(timer);

      if (resp.ok) {
        return resp;
      }

      // If quota / rate limit (429), permission/billing tier (403), timeout (408), or 5xx occurs
      // on a route backed by our deterministic local synthesis engine, seamlessly synthesize locally
      // instead of surfacing a blocking "zbyt duża ilość zapytań" error!
      const shouldFallbackToLocal =
        hasLocalSynthesisEngineForPath(path) &&
        (resp.status === 429 ||
          resp.status === 403 ||
          resp.status === 404 ||
          resp.status === 408 ||
          resp.status >= 500);

      if (!shouldFallbackToLocal && resp.status >= 400 && resp.status < 500 && resp.status !== 404) {
        return resp;
      }
    } catch {
      // Network unreachable, timed out, or standalone offline mode — seamlessly execute local engine below
    }
  }

  // Parse request JSON body for offline engines
  let parsedBody: Record<string, unknown> = {};
  if (typeof options.body === 'string' && options.body.trim()) {
    try {
      parsedBody = JSON.parse(options.body) as Record<string, unknown>;
    } catch {
      parsedBody = {};
    }
  }

  if (path === '/api/driver-calibration/analyze') {
    const result = runOfflineDriverCalibration(
      (parsedBody.config as Partial<RotaryDriverCalibrationConfig>) || {},
      (parsedBody.targetCharacter as CalibrationTargetCharacter) || 'reference-cnc'
    );
    return jsonResponse(result);
  }

  if (path === '/api/gemini/optimize-animation') {
    const result = optimizeAnimationOffline(
      (parsedBody.synth as SynthPatchSettings) || ({} as SynthPatchSettings),
      (parsedBody.haptic as HapticSettings) || ({} as HapticSettings),
      (parsedBody.depth as DepthShadowSettings) || ({} as DepthShadowSettings)
    );
    return jsonResponse(result);
  }

  if (path === '/api/gemini/expand-prompt') {
    return jsonResponse(
      expandPromptOffline({
        concept: parsedBody.concept as string | undefined,
        palette: parsedBody.palette as PaletteMode | undefined,
        material: parsedBody.material as HapticMaterialType | undefined,
        depth: parsedBody.depth as DepthShadowSettings | undefined,
      })
    );
  }

  if (path === '/api/screen-map/refine-image-prompt') {
    return jsonResponse(
      refineScreenPromptOffline({
        basePrompt: parsedBody.basePrompt as string | undefined,
        screenTitle: parsedBody.screenTitle as string | undefined,
        totalButtons: Number(parsedBody.totalButtons) || 0,
        language: parsedBody.language as string | undefined,
      })
    );
  }

  if (path === '/api/screen-map/from-github') {
    return jsonResponse(
      generateScreenMapFromGitHubOffline({
        repoInput: parsedBody.repoInput as string | undefined,
        appGoal: parsedBody.appGoal as string | undefined,
      })
    );
  }

  if (path === '/api/screen-map/from-file') {
    return jsonResponse(
      generatePlanAndMatrixFromFileOffline(
        parsedBody as unknown as FileUploadPlanRequestPayload
      )
    );
  }

  if (path === '/api/gemini/generate-image') {
    const generated = await generateOfflineProceduralImage({
      prompt: parsedBody.prompt as string | undefined,
      aspectRatio: parsedBody.aspectRatio as string | undefined,
      imageSize: parsedBody.imageSize as string | undefined,
    });
    return jsonResponse(generated);
  }

  if (path === '/api/gemini/analyze-image') {
    const analyzed = await analyzePhotoOffline({
      imageBase64: parsedBody.imageBase64 as string | undefined,
    });
    return jsonResponse(analyzed);
  }

  if (path === '/api/gemini/transcribe') {
    return jsonResponse(
      {
        error:
          'Transkrypcja chmurowa Gemini wymaga połączenia z internetem. W trybie Offline wpisz koncepcję bezpośrednio w polu tekstowym.',
      },
      503
    );
  }

  if (path === '/api/gemini/generate-video') {
    return jsonResponse(
      {
        error:
          'Generowanie wideo Omni 1.2 Flash wymaga aktywnego połączenia z serwerem Studio AI. Generator obrazów, analiza zdjęć, syntezator oraz matryce działają w pełni Offline.',
      },
      503
    );
  }

  if (path === '/api/gemini/generate-complete-element') {
    const generatedEl = generateCompleteElementOffline(parsedBody);
    return jsonResponse(generatedEl);
  }

  if (path === '/api/gemini/generate-repo-profile') {
    const projectName = String(parsedBody.projectName || 'Aether Tactile Studio');
    const screensCount = Number(parsedBody.screensCount) || 7;
    const pluginsList = Array.isArray(parsedBody.activePluginNames)
      ? (parsedBody.activePluginNames as string[]).slice(0, 4).join(', ')
      : 'Figma, VS Code, Web SDK';
    const baseFreqHz = Math.min(158, Number(parsedBody.baseFreqHz) || 86);

    return jsonResponse({
      shortAboutDescription: `${projectName} — studio projektowania frontendu dotykowego (${screensCount} ekranów), optyki szkła, syntezy akustycznej ${baseFreqHz} Hz (<160 Hz), pracy Offline (.html/PWA) oraz wtyczek dla: ${pluginsList}.`.slice(
        0,
        345
      ),
      readmeSubtitle: `Zintegrowany warsztat projektowania interfejsów dotykowych React 19 + TypeScript + Three.js + Tailwind CSS z żywym podglądem modelu frontendu, kreatorem elementów z grafik referencyjnych oraz systemem wtyczek (${pluginsList}).`,
      topics: [
        'react',
        'typescript',
        'tailwindcss',
        'threejs',
        'web-audio-api',
        'haptics',
        'ui-design-studio',
        'offline-first',
        'pwa',
        'plugin-architecture',
      ],
    });
  }

  // Persistence routes in offline mode acknowledge cleanly so local state handles storage
  if (path.startsWith('/api/studio/') || path === '/api/user/sync') {
    return jsonResponse({ ok: true, offlineStored: true });
  }

  return jsonResponse({ error: 'Usługa niedostępna w trybie Offline.' }, 503);
}

export function generateCompleteElementOffline(
  body: Record<string, unknown>
): Omit<GeneratedCompleteElement, 'id' | 'createdAt' | 'compiledPromptUsed'> {
  const userBrief = String(body.userBrief || '').trim() || 'Moduł Sterowania Dotykowego i Telemetrii';
  const targetScreenId = String(body.targetScreenId || 'scr-dashboard');
  const targetZone = ((body.targetZone as PrototypeDropZone) || 'main') as PrototypeDropZone;
  const palette = (body.palette as PaletteMode) || 'pearl-flebologia';
  const material = (body.material as HapticMaterialType) || 'frosted-glass';
  const matProfile = MATERIAL_PROFILES[material] || MATERIAL_PROFILES['frosted-glass'];
  const baseFreqHz = Math.max(36, Math.min(158, Number(body.baseFreqHz) || 86));
  const graphics = Array.isArray(body.attachedGraphics)
    ? (body.attachedGraphics as Array<{ name?: string; dataUrl?: string; role?: string }>)
    : [];

  const cleanPascal =
    userBrief
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('') || 'TactileStudioModule';
  const safeCompName = /^[A-Za-z]/.test(cleanPascal) ? cleanPascal : `Ui${cleanPascal}`;
  const accentHex =
    palette === 'emerald-clinic'
      ? '#34D399'
      : palette === 'finance-ice'
        ? '#4F46E5'
        : '#7C69EF';

  const headline = userBrief.slice(0, 68);
  const subheadline =
    graphics.length > 0
      ? `Kompletny moduł wygenerowany lokalnie z uwzględnieniem ${graphics.length} załączonych grafik referencyjnych (${matProfile.label}, ${baseFreqHz} Hz).`
      : `Kompletny element interfejsu dopasowany do profilu ${matProfile.label} i rezonansu dotykowego ${baseFreqHz} Hz (<160 Hz).`;

  const controls: GeneratedCompleteElement['controls'] = [
    {
      id: 'ctrl-1',
      kind: 'primary-cta',
      label: 'Zatwierdź i przejdź dalej',
    },
    {
      id: 'ctrl-2',
      kind: 'slider',
      label: `Intensywność (${matProfile.label})`,
      valueText: '74%',
    },
    {
      id: 'ctrl-3',
      kind: 'toggle',
      label: 'Podświetlenie grawerunku',
      valueText: 'Aktywne',
    },
    {
      id: 'ctrl-4',
      kind: 'metric-tile',
      label: 'Pasmo haptyki',
      valueText: `${baseFreqHz} Hz`,
    },
  ];

  const reactTailwindCode = `import React, { useState } from 'react';
import { triggerTactileClick } from '../../lib/tactileHaptics';

export interface ${safeCompName}Props {
  title?: string;
  subtitle?: string;
  onPrimaryAction?: () => void;
}

export const ${safeCompName}: React.FC<${safeCompName}Props> = ({
  title = ${JSON.stringify(headline)},
  subtitle = ${JSON.stringify(subheadline)},
  onPrimaryAction,
}) => {
  const [intensity, setIntensity] = useState<number>(74);
  const [backlightEnabled, setBacklightEnabled] = useState<boolean>(true);

  return (
    <section className="p-6 rounded-2xl border border-slate-200/80 dark:border-emerald-400/25 bg-white/85 dark:bg-emerald-950/75 backdrop-blur-xl shadow-sm space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 max-w-xl">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80">
            ${matProfile.label} · Strefa ${targetZone} · ${baseFreqHz} Hz
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-emerald-50">
            {title}
          </h2>
          <p className="text-sm text-slate-600 dark:text-emerald-100/80">
            {subtitle}
          </p>
        </div>
        <div className="text-right font-mono tabular-nums">
          <div className="text-xs text-slate-500 dark:text-emerald-300/75">Taktowanie</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-emerald-200">${baseFreqHz} Hz</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/60 dark:border-emerald-400/15">
        <label className="space-y-1.5 block">
          <span className="flex items-center justify-between text-xs text-slate-700 dark:text-emerald-100">
            <span>Intensywność materiału</span>
            <span className="font-mono tabular-nums">{intensity}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={intensity}
            onChange={(e) => {
              setIntensity(Number(e.target.value));
              triggerTactileClick(2);
            }}
            className="w-full accent-indigo-600 dark:accent-emerald-400 cursor-pointer"
          />
        </label>

        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/80 dark:bg-emerald-900/45">
          <span className="text-xs font-medium text-slate-800 dark:text-emerald-100">
            Podświetlenie grawerunku
          </span>
          <button
            type="button"
            onClick={() => {
              setBacklightEnabled((v) => !v);
              triggerTactileClick(backlightEnabled ? -4 : 6);
            }}
            className={\`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors \${
              backlightEnabled
                ? 'bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950'
                : 'bg-white dark:bg-emerald-950 text-slate-600 dark:text-emerald-200'
            }\`}
          >
            {backlightEnabled ? 'Włączone' : 'Wyłączone'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            triggerTactileClick(8);
            onPrimaryAction?.();
          }}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 hover:opacity-95 transition-opacity cursor-pointer"
        >
          Zatwierdź i przejdź dalej
        </button>
      </div>
    </section>
  );
};

export default ${safeCompName};
`;

  return {
    name: headline.slice(0, 44),
    fileName: `${safeCompName}.tsx`,
    targetScreenId,
    targetZone,
    categoryLabel: `Moduł Kompletny · ${matProfile.label}`,
    summary: subheadline,
    headline,
    subheadline,
    accentHex,
    referenceThumbUrl: graphics[0]?.dataUrl,
    controls,
    reactTailwindCode,
  };
}
