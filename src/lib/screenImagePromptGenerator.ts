import {
  AppScreenMapProject,
  DepthShadowSettings,
  DesignedScreenNode,
  EngravingBacklightSettings,
  HapticMaterialType,
  PaletteMode,
  ScreenMapEdge,
  ScreenRoleType,
} from '../types/studio';

export type ScreenImageViewportFormat =
  | 'desktop-16-9'
  | 'mobile-9-16'
  | 'tablet-4-3';

export type ScreenImagePromptLanguage = 'en-with-pl-labels' | 'pl' | 'en';

export type ScreenImageVisualStyle =
  | 'tactile-glass'
  | 'clean-saas-2d'
  | 'isometric-showcase';

export type ScreenButtonZoneId = 'top-bar' | 'workspace' | 'bottom-bar';

export interface ScreenButtonSlot {
  index: number;
  zone: ScreenButtonZoneId;
  alignment: 'left' | 'center' | 'right' | 'grid-cell';
  positionLabelPl: string;
  positionLabelEn: string;
  label: string;
  kind:
    | 'nav'
    | 'back'
    | 'primary-cta'
    | 'secondary-action'
    | 'module-trigger';
  xPercent: number;
  yPercent: number;
  targetRoute?: string;
}

export interface ScreenButtonCountOverride {
  topBarCount?: number;
  workspaceCount?: number;
  bottomBarCount?: number;
}

export interface GeneratedScreenImagePrompt {
  screenId: string;
  screenTitle: string;
  route: string;
  aspectRatio: '16:9' | '9:16' | '4:3';
  resolutionHint: string;
  totalButtons: number;
  topBarButtons: ScreenButtonSlot[];
  workspaceButtons: ScreenButtonSlot[];
  bottomBarButtons: ScreenButtonSlot[];
  allButtons: ScreenButtonSlot[];
  promptText: string;
  summaryLinePl: string;
}

const PALETTE_PROMPT_DESC: Record<
  PaletteMode,
  { en: string; pl: string }
> = {
  'pearl-flebologia': {
    en: 'soft periwinkle-pearl light canvas (#EEF1FA to #FFFFFF), crisp slate-900 typography, refined indigo (#4F46E5) primary CTA accent (60-30-10 color balance)',
    pl: 'jasny perłowo-lawendowy kanwas (#EEF1FA do #FFFFFF), czytelna typografia grafitowa #0F172A oraz akcent indygo #4F46E5 na głównym przycisku akcji (proporcja 60-30-10)',
  },
  'finance-ice': {
    en: 'clean ice-blue fintech light canvas (#EEF4FF to #FFFFFF), deep navy-slate text, crisp royal-indigo (#4F46E5) primary button accent (60-30-10 color balance)',
    pl: 'chłodny lodowo-błękitny kanwas (#EEF4FF do #FFFFFF), głęboki granatowy tekst oraz wyrazisty akcent indygo #4F46E5 na głównym przycisku (proporcja 60-30-10)',
  },
  'emerald-clinic': {
    en: 'deep emerald-obsidian dark mode canvas (#061512 to #0B231E), high-contrast pale mint typography (#ECFDF5), luminous sage-emerald (#34D399) primary CTA button',
    pl: 'ciemny szmaragdowo-obsydianowy tryb nocny (#061512 do #0B231E), jasna kontrastowa typografia #ECFDF5 oraz główny przycisk akcji w odcieniu szmaragdu #34D399',
  },
};

const MATERIAL_PROMPT_DESC: Record<
  HapticMaterialType,
  { en: string; pl: string }
> = {
  'shiny-glass': {
    en: 'polished optical crystal glass surfaces with crisp specular Fresnel top rims and subtle refraction',
    pl: 'błyszczące szkło optyczne z wyraźnym odbiciem krawędziowym Fresnela i czystą refrakcją',
  },
  'frosted-glass': {
    en: 'translucent frosted matte glass panels with silky subsurface diffusion and 1px hairline borders',
    pl: 'półprzezroczyste matowe szkło z jedwabistym rozproszeniem światła i cienkim obrysem 1px',
  },
  'matte-metal': {
    en: 'precision CNC-anodized brushed aluminum tactile surfaces with micro-chamfered edges',
    pl: 'precyzyjny szczotkowany i anodowany metal CNC z mikro-fazowanymi krawędziami przycisków',
  },
  'abs-plastic': {
    en: 'precision-molded satin ABS polycarbonate tactile keycap surfaces with crisp micro-beveled edges',
    pl: 'formowane satynowe tworzywo ABS / poliwęglan z wyraźnym skokiem i czystymi fazowanymi krawędziami',
  },
  suede: {
    en: 'warm acoustic matte micro-suede tactile containers with soft diffused shadows and zero harsh glare',
    pl: 'ciepła, matowa powierzchnia zamszu akustycznego z miękkim cieniem bez ostrych odblasków',
  },
};

const ROLE_LAYOUT_DESC: Record<
  ScreenRoleType,
  { en: string; pl: string }
> = {
  entry: {
    en: 'entry / hero landing workspace with clear primary focal anchor and structured overview cards',
    pl: 'ekran wejściowy z wyraźną sekcją główną, punktem skupienia wzroku i kartami przeglądu',
  },
  core: {
    en: 'primary operational dashboard workspace with structured multi-column module grid and clear action hierarchy',
    pl: 'główny ekran roboczy aplikacji z wielokolumnową siatką modułów i czytelną hierarchią akcji',
  },
  detail: {
    en: 'focused detail inspection view with header back-navigation, structured parameters panel, and contextual action bar',
    pl: 'widok szczegółowy z nawigacją powrotną w nagłówku, sekcją parametrów i dolnym paskiem akcji',
  },
  settings: {
    en: 'clean configuration & calibration panel with grouped control rows, tabular readouts, and explicit save action',
    pl: 'panel ustawień i kalibracji z uporządkowanymi wierszami parametrów, wartościami liczbowymi i akcją zapisu',
  },
  modal: {
    en: 'centered elevated dialog sheet over subtly dimmed backdrop with top-right close button and bottom confirm/cancel pair',
    pl: 'centralny arkusz modalny na lekko przyciemnionym tle z przyciskiem zamknięcia u góry i parą przycisków akcji na dole',
  },
};

function clampInt(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function getViewportSpec(format: ScreenImageViewportFormat): {
  aspectRatio: '16:9' | '9:16' | '4:3';
  resolutionHint: string;
  enFrame: string;
  plFrame: string;
  columns: number;
} {
  if (format === 'mobile-9-16') {
    return {
      aspectRatio: '9:16',
      resolutionHint: '390×844 px (Mobile Portrait 9:16)',
      enFrame:
        'Vertical mobile app screen UI canvas (9:16 aspect ratio, 390x844px logical grid, single-column layout with 16px outer padding and >=44px touch targets)',
      plFrame:
        'Pionowy ekran aplikacji mobilnej (proporcje 9:16, siatka 390×844 px, układ 1-kolumnowy z marginesem 16 px i wysokością przycisków >=44 px)',
      columns: 1,
    };
  }
  if (format === 'tablet-4-3') {
    return {
      aspectRatio: '4:3',
      resolutionHint: '1024×768 px (Tablet Landscape 4:3)',
      enFrame:
        'Tablet landscape UI screen canvas (4:3 aspect ratio, 1024x768px logical grid, balanced 2-column workspace with 24px outer padding)',
      plFrame:
        'Poziomy ekran tabletu (proporcje 4:3, siatka 1024×768 px, zbalansowany układ 2-kolumnowy z marginesem 24 px)',
      columns: 2,
    };
  }
  return {
    aspectRatio: '16:9',
    resolutionHint: '1440×900 px (Desktop Widescreen 16:9)',
    enFrame:
      'Desktop widescreen web application UI canvas (16:9 aspect ratio, 1440x900px logical 12-column grid, generous 32px outer margins, crisp single-elevation containers)',
    plFrame:
      'Szerokoekranowy interfejs aplikacji webowej Desktop (proporcje 16:9, 12-kolumnowa siatka 1440×900 px, marginesy zewnętrzne 32 px, pojedynczy poziom elewacji kart)',
    columns: 3,
  };
}

/**
 * Computes the default button counts per zone directly from the Screen Map's
 * node role, components, incoming edges, and outgoing edges.
 */
export function getDefaultZoneCountsForNode(
  node: DesignedScreenNode,
  outgoingEdges: ScreenMapEdge[],
  incomingEdges: ScreenMapEdge[],
  format: ScreenImageViewportFormat
): Required<ScreenButtonCountOverride> {
  if (Array.isArray(node.prototypeWidgets) && node.prototypeWidgets.length > 0) {
    const hdrBtns = node.prototypeWidgets.filter(
      (w) => w.zone === 'header' && w.isButtonLike
    ).length;
    const mainBtns = node.prototypeWidgets.filter(
      (w) => w.zone === 'main' && w.isButtonLike
    ).length;
    const ftrBtns = node.prototypeWidgets.filter(
      (w) => w.zone === 'footer' && w.isButtonLike
    ).length;
    return {
      topBarCount: clampInt(hdrBtns, 0, 6),
      workspaceCount: clampInt(mainBtns, 0, 8),
      bottomBarCount: clampInt(ftrBtns, 0, 4),
    };
  }

  const isMobile = format === 'mobile-9-16';

  let topBarCount = 2;
  if (node.role === 'modal') {
    topBarCount = 1; // Top-right Close button
  } else if (node.role === 'detail' || node.role === 'settings') {
    topBarCount = incomingEdges.length > 0 ? 2 : 1; // Left Back + Right Save/Action
  } else {
    topBarCount = isMobile ? 2 : 4; // Desktop: 3 nav buttons + 1 primary account/action button; Mobile: left menu + right profile
  }

  // Primary outgoing edge goes to Bottom/Primary CTA; remaining outgoing edges or module triggers sit in Workspace cards
  const extraOutgoing = Math.max(0, outgoingEdges.length - 1);
  const inferredModuleActions =
    extraOutgoing > 0
      ? extraOutgoing
      : node.role === 'modal'
        ? 0
        : Math.min(3, Math.max(1, Math.floor(node.components.length / 2)));
  const workspaceCount = clampInt(inferredModuleActions, 0, 6);

  let bottomBarCount = 1;
  if (node.role === 'modal') {
    bottomBarCount = 2; // Cancel + Confirm
  } else if (outgoingEdges.length >= 2) {
    bottomBarCount = 2; // Secondary action + Primary CTA
  } else {
    bottomBarCount = 1; // Single dominant focal CTA
  }

  return {
    topBarCount,
    workspaceCount,
    bottomBarCount,
  };
}

export function generateScreenImagePrompt(params: {
  node: DesignedScreenNode;
  mapProject: AppScreenMapProject;
  palette: PaletteMode;
  depth: DepthShadowSettings;
  engraving: EngravingBacklightSettings;
  format: ScreenImageViewportFormat;
  language: ScreenImagePromptLanguage;
  visualStyle: ScreenImageVisualStyle;
  override?: ScreenButtonCountOverride;
}): GeneratedScreenImagePrompt {
  const {
    node,
    mapProject,
    palette,
    depth,
    engraving,
    format,
    language,
    visualStyle,
    override,
  } = params;

  const outgoingEdges = mapProject.edges.filter((e) => e.fromScreenId === node.id);
  const incomingEdges = mapProject.edges.filter((e) => e.toScreenId === node.id);
  const viewport = getViewportSpec(format);

  const defaults = getDefaultZoneCountsForNode(
    node,
    outgoingEdges,
    incomingEdges,
    format
  );

  const topCount = clampInt(
    override?.topBarCount ?? defaults.topBarCount,
    0,
    6
  );
  const workspaceCount = clampInt(
    override?.workspaceCount ?? defaults.workspaceCount,
    0,
    8
  );
  const bottomCount = clampInt(
    override?.bottomBarCount ?? defaults.bottomBarCount,
    0,
    4
  );

  let runningIndex = 1;

  // 1. Build Top Bar Buttons (y ~ 9%)
  const topBarButtons: ScreenButtonSlot[] = [];
  const incomingSource = incomingEdges[0]
    ? mapProject.nodes.find((n) => n.id === incomingEdges[0].fromScreenId)
    : undefined;

  for (let i = 0; i < topCount; i++) {
    let alignment: ScreenButtonSlot['alignment'] = 'center';
    let xPercent = 50;
    let label = `Sekcja ${i + 1}`;
    let kind: ScreenButtonSlot['kind'] = 'nav';
    let posPl = 'środek górnego paska';
    let posEn = 'top header center';

    if (node.role === 'modal' && topCount === 1) {
      alignment = 'right';
      xPercent = 88;
      label = 'Zamknij';
      kind = 'back';
      posPl = 'prawy górny narożnik okna modalnego';
      posEn = 'top-right corner of modal header';
    } else if (i === 0 && (node.role === 'detail' || node.role === 'settings')) {
      alignment = 'left';
      xPercent = 12;
      label = incomingSource ? `← ${incomingSource.title.split(' ')[0]}` : '← Wstecz';
      kind = 'back';
      posPl = 'lewa strona górnego paska';
      posEn = 'top-left header back position';
    } else if (i === topCount - 1) {
      alignment = 'right';
      xPercent = 88;
      label =
        node.role === 'settings'
          ? 'Zapisz zmiany'
          : node.role === 'detail'
            ? 'Eksportuj'
            : 'Konto';
      kind = 'secondary-action';
      posPl = 'prawa strona górnego paska';
      posEn = 'top-right header action slot';
    } else if (i === 0 && format === 'mobile-9-16') {
      alignment = 'left';
      xPercent = 14;
      label = 'Menu';
      kind = 'nav';
      posPl = 'lewy górny róg paska mobilnego';
      posEn = 'top-left mobile header slot';
    } else {
      const middleTotal = Math.max(1, topCount - 1);
      const step = 46 / (middleTotal + 1);
      xPercent = Math.round(24 + step * (i + 1));
      const siblingScreen = mapProject.nodes[i % mapProject.nodes.length];
      label = siblingScreen
        ? siblingScreen.title.split(' ').slice(0, 2).join(' ')
        : `Widok ${i + 1}`;
      kind = 'nav';
      posPl = `środkowa strefa nawigacji (pozycja ${i + 1})`;
      posEn = `center navigation bar item #${i + 1}`;
    }

    topBarButtons.push({
      index: runningIndex++,
      zone: 'top-bar',
      alignment,
      positionLabelPl: posPl,
      positionLabelEn: posEn,
      label,
      kind,
      xPercent,
      yPercent: 9,
      targetRoute: incomingSource?.route,
    });
  }

  // 2. Build Workspace Buttons (y ~ 42%..66%, distributed on screen's column grid)
  const workspaceButtons: ScreenButtonSlot[] = [];
  const secondaryEdges = outgoingEdges.slice(bottomCount > 0 ? 1 : 0);

  for (let i = 0; i < workspaceCount; i++) {
    const cols = viewport.columns;
    const colIdx = i % cols;
    const rowIdx = Math.floor(i / cols);
    const totalRows = Math.max(1, Math.ceil(workspaceCount / cols));

    const xPercent =
      cols === 1
        ? 50
        : cols === 2
          ? colIdx === 0
            ? 30
            : 70
          : colIdx === 0
            ? 22
            : colIdx === 1
              ? 50
              : 78;

    const yPercent =
      totalRows === 1
        ? 52
        : Math.round(38 + (rowIdx / Math.max(1, totalRows - 1)) * 28);

    const linkedEdge = secondaryEdges[i];
    const targetNode = linkedEdge
      ? mapProject.nodes.find((n) => n.id === linkedEdge.toScreenId)
      : undefined;
    const compName = node.components[i % Math.max(1, node.components.length)];

    const label = linkedEdge
      ? linkedEdge.triggerLabel
      : compName
        ? `Otwórz ${compName.replace(/([A-Z])/g, ' $1').trim().split(' ')[0]}`
        : `Akcja modułu ${i + 1}`;

    const colHumanPl =
      cols === 1
        ? `karta #${rowIdx + 1} w kolumnie centralnej`
        : `wiersz ${rowIdx + 1}, kolumna ${colIdx + 1} z ${cols}`;
    const colHumanEn =
      cols === 1
        ? `stacked card #${rowIdx + 1} (full-width center column)`
        : `grid row ${rowIdx + 1}, column ${colIdx + 1} of ${cols}`;

    workspaceButtons.push({
      index: runningIndex++,
      zone: 'workspace',
      alignment: 'grid-cell',
      positionLabelPl: colHumanPl,
      positionLabelEn: colHumanEn,
      label,
      kind: 'module-trigger',
      xPercent,
      yPercent,
      targetRoute: targetNode?.route,
    });
  }

  // 3. Build Bottom / Primary Action Bar Buttons (y ~ 88%)
  const bottomBarButtons: ScreenButtonSlot[] = [];
  const primaryEdge = outgoingEdges[0];
  const secondBottomEdge = outgoingEdges[1];

  for (let i = 0; i < bottomCount; i++) {
    const isLastPrimary = i === bottomCount - 1;
    let xPercent = 50;
    let alignment: ScreenButtonSlot['alignment'] = 'center';
    let posPl = 'dolna strefa centralna (główny przycisk CTA)';
    let posEn = 'bottom-center primary CTA position';

    if (bottomCount === 1) {
      if (format === 'desktop-16-9' && node.role !== 'modal') {
        alignment = 'right';
        xPercent = 82;
        posPl = 'prawy dolny narożnik paska akcji (główny przycisk CTA)';
        posEn = 'bottom-right primary action bar slot (dominant focal CTA)';
      } else {
        alignment = 'center';
        xPercent = 50;
      }
    } else if (bottomCount === 2) {
      alignment = i === 0 ? 'left' : 'right';
      xPercent = i === 0 ? 36 : 68;
      posPl =
        i === 0
          ? 'dolny pasek po lewej od CTA (przycisk pomocniczy)'
          : 'dolny pasek po prawej (główny przycisk CTA o wysokim kontraście)';
      posEn =
        i === 0
          ? 'bottom action bar left-of-primary (secondary outline/glass button)'
          : 'bottom action bar right slot (high-contrast primary CTA button)';
    } else {
      const step = 76 / Math.max(1, bottomCount - 1);
      xPercent = Math.round(12 + step * i);
      posPl = `dolny pasek nawigacji/akcji, pozycja ${i + 1} z ${bottomCount}`;
      posEn = `bottom bar slot ${i + 1} of ${bottomCount} (even horizontal spacing)`;
    }

    let label = 'Dalej';
    if (isLastPrimary) {
      label = primaryEdge
        ? primaryEdge.triggerLabel
        : node.role === 'modal'
          ? 'Potwierdź'
          : node.role === 'settings'
            ? 'Zastosuj kalibrację'
            : 'Dalej';
    } else if (i === 0 && node.role === 'modal') {
      label = 'Anuluj';
    } else if (i === 0 && secondBottomEdge) {
      label = secondBottomEdge.triggerLabel;
    } else {
      label = `Opcja ${i + 1}`;
    }

    bottomBarButtons.push({
      index: runningIndex++,
      zone: 'bottom-bar',
      alignment,
      positionLabelPl: posPl,
      positionLabelEn: posEn,
      label,
      kind: isLastPrimary ? 'primary-cta' : 'secondary-action',
      xPercent,
      yPercent: 88,
      targetRoute: isLastPrimary
        ? mapProject.nodes.find((n) => n.id === primaryEdge?.toScreenId)?.route
        : undefined,
    });
  }

  const allButtons = [
    ...topBarButtons,
    ...workspaceButtons,
    ...bottomBarButtons,
  ];
  const totalButtons = allButtons.length;

  const matInfo = MATERIAL_PROMPT_DESC[node.hapticMaterial] || MATERIAL_PROMPT_DESC['frosted-glass'];
  const palInfo = PALETTE_PROMPT_DESC[palette] || PALETTE_PROMPT_DESC['pearl-flebologia'];
  const roleInfo = ROLE_LAYOUT_DESC[node.role] || ROLE_LAYOUT_DESC.core;

  const styleEn =
    visualStyle === 'clean-saas-2d'
      ? 'Crisp flat orthographic 2D product UI mockup, ultra-sharp vector typography, subtle 1px borders, Dribbble/Linear production software quality, zero device bezel.'
      : visualStyle === 'isometric-showcase'
        ? 'Clean architectural 15-degree angled studio UI presentation board with subtle depth elevation, tactile layered glass planes, soft diffused studio lighting.'
        : `Orthographic front-facing high-fidelity tactile UI screen design (no laptop or phone frame), ${matInfo.en}, border-radius ${depth.borderRadius}px, backdrop blur ${depth.glassBlur}px${
            engraving.glowEnabled
              ? `, subtle ${engraving.glowColor} optical rim accent on the primary CTA only`
              : ''
          }.`;

  const stylePl =
    visualStyle === 'clean-saas-2d'
      ? 'Płaska, ortograficzna makieta UI 2D klasy produkcyjnej SaaS (bez ramek laptopa/telefonu), ostra typografia wektorowa, subtelne linie podziału 1 px.'
      : visualStyle === 'isometric-showcase'
        ? 'Studyjna prezentacja ekranu UI pod delikatnym kątem 15° z warstwową głębią elewacji i miękkim oświetleniem studyjnym.'
        : `Ortograficzny, frontalny projekt ekranu UI wysokiej rozdzielczości (bez obudowy urządzenia), powierzchnia: ${matInfo.pl}, zaokrąglenie narożników ${depth.borderRadius} px, rozmycie szkła ${depth.glassBlur} px${
            engraving.glowEnabled
              ? `, subtelna poświata ${engraving.glowColor} wyłącznie na głównym przycisku CTA`
              : ''
          }.`;

  const componentsList =
    node.components.length > 0
      ? node.components.join(', ')
      : 'HeaderBar, ContentGrid, PrimaryActionCard';

  let promptText = '';

  if (language === 'pl') {
    const buttonLinesPl =
      totalButtons === 0
        ? '- Brak widocznych przycisków akcji (ekran czysto informacyjny / prezentacyjny).'
        : allButtons
            .map((b) => {
              const styleTag =
                b.kind === 'primary-cta'
                  ? 'GŁÓWNY PRZYCISK CTA (wypełniony, najwyższy kontrast)'
                  : b.kind === 'back'
                    ? 'przycisk nawigacji powrotnej / zamknięcia (lekki obrys)'
                    : b.kind === 'nav'
                      ? 'przycisk nawigacyjny w jednej linii'
                      : 'przycisk drugorzędny / modułowy (półprzezroczyste szkło z obrysem 1 px)';
              const labelPart = `etykieta: „${b.label}”`;
              return `  #${b.index}. [${b.positionLabelPl} — X:${b.xPercent}%, Y:${b.yPercent}%] -> ${styleTag}, ${labelPart}`;
            })
            .join('\n');

    promptText = [
      `Projekt graficzny interfejsu ekranu „${node.title}” (ścieżka: ${node.route}) z projektu „${mapProject.name}”.`,
      `KADR I SIATKA: ${viewport.plFrame}. Typ widoku: ${roleInfo.pl}.`,
      `STYL I KOLORYSTYKA: ${stylePl} Paleta: ${palInfo.pl}.`,
      `MODUŁY WIDOCZNE NA EKRANIE: ${componentsList}. Kontekst ekranu: ${node.summary}`,
      `ŚCISŁA DYSCYPLINA LICZBY PRZYCISKÓW: Wygeneruj DOKŁADNIE ${totalButtons} przycisków interaktywnych na całym ekranie (Strefa górna: ${topCount}, Strefa środkowa modułów: ${workspaceCount}, Strefa dolna akcji: ${bottomCount}). Nie dodawaj żadnych losowych ikon, duplikatów CTA ani pływających pigułek.`,
      `DOKŁADNE ROZMIESZCZENIE PRZYCISKÓW (WSPÓŁRZĘDNE EKRANU):`,
      buttonLinesPl,
      `WYMAGANIA KOMPOZYCYJNE: Równe odstępy między sekcjami (>=16 px), jednolita wysokość przycisków (>=42 px), wyrównana siatka kolumnowa, czytelne napisy bez artefaktów tekstowych.`,
    ].join('\n');
  } else {
    const usePlLabels = language === 'en-with-pl-labels';
    const buttonLinesEn =
      totalButtons === 0
        ? '- Zero interactive buttons (purely informational display screen).'
        : allButtons
            .map((b) => {
              const roleDesc =
                b.kind === 'primary-cta'
                  ? 'PRIMARY SOLID HIGH-CONTRAST CTA BUTTON'
                  : b.kind === 'back'
                    ? 'subtle ghost/outline back or close button'
                    : b.kind === 'nav'
                      ? 'clean single-line top navigation button'
                      : 'secondary translucent glass/outline button (1px hairline border)';
              const textSpec = usePlLabels
                ? `Polish label "${b.label}"`
                : `clean UI label "${b.label}"`;
              return `  #${b.index} [${b.positionLabelEn} — at X:${b.xPercent}%, Y:${b.yPercent}%]: ${roleDesc} with ${textSpec}`;
            })
            .join('\n');

    promptText = [
      `High-precision UI screen design graphic for "${node.title}" (route: ${node.route}, project: "${mapProject.name}").`,
      `CANVAS & GRID GEOMETRY: ${viewport.enFrame}. Screen archetype: ${roleInfo.en}.`,
      `SURFACE & COLOR SYSTEM: ${styleEn} Color palette: ${palInfo.en}.`,
      `CONTENT MODULES IN GRID: ${componentsList}. Functional purpose: ${node.summary}`,
      `CRITICAL BUTTON COUNT CONSTRAINT: Render EXACTLY ${totalButtons} interactive buttons in total across the entire screen (Top Header Zone: ${topCount}, Main Workspace Grid Zone: ${workspaceCount}, Bottom Action Zone: ${bottomCount}). Strictly NO extra floating buttons, NO duplicate CTAs, NO unrequested icon badges.`,
      `EXACT SPATIAL BUTTON PLACEMENT (TOP-TO-BOTTOM COORDINATE MAP):`,
      buttonLinesEn,
      `ALIGNMENT & TYPOGRAPHY RULES: Clean geometric sans-serif UI typography, tabular numerals for metrics, consistent >=42px button height with 2:1 horizontal-to-vertical padding, crisp grid alignment, zero distorted text.`,
    ].join('\n');
  }

  return {
    screenId: node.id,
    screenTitle: node.title,
    route: node.route,
    aspectRatio: viewport.aspectRatio,
    resolutionHint: viewport.resolutionHint,
    totalButtons,
    topBarButtons,
    workspaceButtons,
    bottomBarButtons,
    allButtons,
    promptText,
    summaryLinePl: `Łącznie ${totalButtons} przyc.: Góra ${topCount} · Moduły ${workspaceCount} · Dół ${bottomCount}`,
  };
}

/**
 * Clipboard helper safe for both top-level browser tabs and sandboxed iframes.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback for restricted iframe permissions
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
