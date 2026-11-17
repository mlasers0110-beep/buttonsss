import React from 'react';
import {
  DesignedScreenNode,
  HapticMaterialType,
  PrototypeDropZone,
  PrototypeScreenWidget,
  TactileWidgetCategory,
} from '../types/studio';

export const DRAG_TACTILE_UI_MIME = 'application/x-aether-tactile-ui';
export const DRAG_REORDER_WIDGET_MIME = 'application/x-aether-prototype-widget';

export interface TactileUiCatalogItem {
  id: string;
  componentName: string;
  labelPl: string;
  defaultWidgetLabel: string;
  category: TactileWidgetCategory;
  sourceModulePl: string;
  descriptionPl: string;
  defaultZone: PrototypeDropZone;
  defaultSpanCols: 1 | 2;
  isButtonLike: boolean;
  recommendedMaterial: HapticMaterialType;
  jsxSnippet: string;
}

export interface ReorderWidgetDragPayload {
  screenId: string;
  instanceId: string;
  fromZone: PrototypeDropZone;
}

export const TACTILE_UI_CATALOG: TactileUiCatalogItem[] = [
  // --- 1. Przyciski Haptyczne i Optyczne (ButtonAnimationsLibrary) ---
  {
    id: 'btn-primary-cta',
    componentName: 'TactilePrimaryCTA',
    labelPl: 'Przycisk Główny „Dalej” (CTA)',
    defaultWidgetLabel: 'Dalej',
    category: 'buttons',
    sourceModulePl: 'Animacje przycisków',
    descriptionPl:
      'Dominujący przycisk akcji z podświetleniem Fresnela, sprężyną 440 N/m i impulsem <160 Hz.',
    defaultZone: 'footer',
    defaultSpanCols: 1,
    isButtonLike: true,
    recommendedMaterial: 'frosted-glass',
    jsxSnippet: '<TactileButton variant="primary-cta" symbol="spark">Dalej</TactileButton>',
  },
  {
    id: 'btn-crystal-pill',
    componentName: 'CrystalPillButton',
    labelPl: 'Kapsuła Kryształowego Szkła',
    defaultWidgetLabel: 'Przejdź do modułu',
    category: 'buttons',
    sourceModulePl: 'Animacje przycisków',
    descriptionPl:
      'Półprzezroczysty przycisk nawigacyjny z ukośną refrakcją pryzmatyczną i strzałką kierunkową.',
    defaultZone: 'main',
    defaultSpanCols: 1,
    isButtonLike: true,
    recommendedMaterial: 'shiny-glass',
    jsxSnippet: '<TactileButton variant="crystal-pill" symbol="compass">Przejdź</TactileButton>',
  },
  {
    id: 'btn-glass-card',
    componentName: 'TactileGlassCard',
    labelPl: 'Kafel Diagnostyczny Szkła',
    defaultWidgetLabel: 'Analiza Optyczna',
    category: 'buttons',
    sourceModulePl: 'Animacje przycisków',
    descriptionPl:
      'Karta matrycowa z refleksyjnym podświetleniem kursora (Radial Spotlight) i stanem aktywnym.',
    defaultZone: 'main',
    defaultSpanCols: 1,
    isButtonLike: true,
    recommendedMaterial: 'frosted-glass',
    jsxSnippet: '<TactileButton variant="glass-card" symbol="prism" selected>Analiza</TactileButton>',
  },
  {
    id: 'btn-cnc-detent',
    componentName: 'CncMicroDetentButton',
    labelPl: 'Klawisz Mikro-Zapadka CNC',
    defaultWidgetLabel: 'Zapisz kalibrację',
    category: 'buttons',
    sourceModulePl: 'Animacje przycisków',
    descriptionPl:
      'Chirurgiczny skok 75 ms (680 N/m) aparatury pomiarowej z wiązką obwodową Conic Beam.',
    defaultZone: 'footer',
    defaultSpanCols: 1,
    isButtonLike: true,
    recommendedMaterial: 'matte-metal',
    jsxSnippet: '<TactileButton motionPresetOverride="cnc-micro-detent">Zapisz</TactileButton>',
  },
  {
    id: 'btn-header-nav',
    componentName: 'TopNavActionButton',
    labelPl: 'Przycisk Nawigacji Nagłówka',
    defaultWidgetLabel: '← Wróć',
    category: 'buttons',
    sourceModulePl: 'Animacje przycisków',
    descriptionPl:
      'Jednowierszowy przycisk powrotu lub akcji kontekstowej do górnego paska ekranu.',
    defaultZone: 'header',
    defaultSpanCols: 1,
    isButtonLike: true,
    recommendedMaterial: 'frosted-glass',
    jsxSnippet: '<TactileButton variant="crystal-pill">← Wróć</TactileButton>',
  },

  // --- 2. Suwaki Haptyczne (SwitchVariantsLibrary — Sliders) ---
  {
    id: 'slider-vernier',
    componentName: 'VernierDetentSlider',
    labelPl: 'Suwak Precyzyjny z Noniuszem',
    defaultWidgetLabel: 'Poziom Noniusza',
    category: 'sliders',
    sourceModulePl: 'Warianty przełączników',
    descriptionPl:
      '21 nacięć kalibracyjnych z optycznym celownikiem i zapadkowym sprzęgłem odwrotnym.',
    defaultZone: 'main',
    defaultSpanCols: 2,
    isButtonLike: false,
    recommendedMaterial: 'matte-metal',
    jsxSnippet: '<VernierDetentSlider min={0} max={100} detents={25} reverseClutch />',
  },
  {
    id: 'slider-fluid-capsule',
    componentName: 'FluidGlassCapsuleSlider',
    labelPl: 'Suwak Kapsułowy Płynnego Szkła',
    defaultWidgetLabel: 'Strumień Tafli',
    category: 'sliders',
    sourceModulePl: 'Warianty przełączników',
    descriptionPl:
      'Kapsuła świetlna 48 px wypełniana płynnie na GPU (scaleX) z odczytem lumenów.',
    defaultZone: 'main',
    defaultSpanCols: 2,
    isButtonLike: false,
    recommendedMaterial: 'shiny-glass',
    jsxSnippet: '<FluidGlassCapsuleSlider height="48px" transformOrigin="left" />',
  },
  {
    id: 'slider-dual-band',
    componentName: 'DualBandHapticSlider',
    labelPl: 'Suwak Dwukursorowy Pasma (<160 Hz)',
    defaultWidgetLabel: 'Pasmo 46–134 Hz',
    category: 'sliders',
    sourceModulePl: 'Warianty przełączników',
    descriptionPl:
      'Podwójny suwak przedziałowy filtrujący dolny i górny próg pasma dotykowego sub-160 Hz.',
    defaultZone: 'main',
    defaultSpanCols: 2,
    isButtonLike: false,
    recommendedMaterial: 'frosted-glass',
    jsxSnippet: '<DualBandHapticSlider low={46} high={134} maxHz={158} />',
  },
  {
    id: 'slider-magnetic-5',
    componentName: 'MagneticSteppedSlider',
    labelPl: 'Suwak Krokowy 5-Punktowy',
    defaultWidgetLabel: 'Stopień Impulsu',
    category: 'sliders',
    sourceModulePl: 'Warianty przełączników',
    descriptionPl:
      'Pięć dyskretnych gniazd magnetycznych (0 / 25 / 50 / 75 / 100%) ze sprężystym dociąganiem.',
    defaultZone: 'main',
    defaultSpanCols: 2,
    isButtonLike: false,
    recommendedMaterial: 'abs-plastic',
    jsxSnippet: '<MagneticSteppedSlider steps={[0, 25, 50, 75, 100]} />',
  },

  // --- 3. Przełączniki Dźwigniowe i Kołyskowe (SwitchVariantsLibrary — Levers) ---
  {
    id: 'lever-cnc-aircraft',
    componentName: 'MachinedLeverSwitch',
    labelPl: 'Przełącznik Dźwigniowy Lotniczy',
    defaultWidgetLabel: 'Tor Zasilania CNC',
    category: 'levers',
    sourceModulePl: 'Warianty przełączników',
    descriptionPl:
      'Toczony trzpień na przegubie kulowym (±14°) ze szczeliną świetlną i twardym klikiem metalu.',
    defaultZone: 'main',
    defaultSpanCols: 1,
    isButtonLike: true,
    recommendedMaterial: 'matte-metal',
    jsxSnippet: '<MachinedLeverSwitch checked={on} angleDeg={14} />',
  },
  {
    id: 'lever-safety-guard',
    componentName: 'GuardedSafetyLever',
    labelPl: 'Dźwignia z Osłoną Uchylną',
    defaultWidgetLabel: 'Uzbrojenie Toru',
    category: 'levers',
    sourceModulePl: 'Warianty przełączników',
    descriptionPl:
      'Dwustopniowa blokada bezpieczeństwa wymagająca otwarcia klosza przed załączeniem.',
    defaultZone: 'main',
    defaultSpanCols: 1,
    isButtonLike: true,
    recommendedMaterial: 'matte-metal',
    jsxSnippet: '<GuardedSafetyLever guardOpen={open} armed={armed} autoDisarm />',
  },
  {
    id: 'lever-split-rocker',
    componentName: 'SplitAxisRockerSwitch',
    labelPl: 'Przełącznik Kołyskowy (O / I)',
    defaultWidgetLabel: 'Tryb Pracy O/I',
    category: 'levers',
    sourceModulePl: 'Warianty przełączników',
    descriptionPl:
      'Szeroki klawisz kołyskowy 3D z przechyłem osiowym ±8° dla stanów Spoczynek / Aktywny.',
    defaultZone: 'main',
    defaultSpanCols: 1,
    isButtonLike: true,
    recommendedMaterial: 'abs-plastic',
    jsxSnippet: '<SplitAxisRockerSwitch state="I" perspective={620} />',
  },

  // --- 4. Dotyk Pojemnościowy i Pokrętło CNC (Touch & Rotary Calibration) ---
  {
    id: 'rotary-cnc-270',
    componentName: 'RotaryDriverCalibrationDial',
    labelPl: 'Pokrętło Sterownika CNC 270°',
    defaultWidgetLabel: 'Enkoder 120 Zapadek',
    category: 'touch-rotary',
    sourceModulePl: 'Kalibracja sterownika',
    descriptionPl:
      'Szczotkowane pokrętło obrotowe 270° ze skalą podziałek i kalibrowanym tonem <160 Hz.',
    defaultZone: 'main',
    defaultSpanCols: 1,
    isButtonLike: false,
    recommendedMaterial: 'matte-metal',
    jsxSnippet: '<RotaryDriverCalibrationService sweepAngleDeg={270} detentCount={120} />',
  },
  {
    id: 'touch-force-pad',
    componentName: 'CapacitiveForceHoldPad',
    labelPl: 'Pad Siły Nacisku (Force-Hold)',
    defaultWidgetLabel: 'Przytrzymaj Impuls',
    category: 'touch-rotary',
    sourceModulePl: 'Warianty przełączników',
    descriptionPl:
      'Pojemnościowy czujnik narastania nacisku z ciągłą rampą drgań i zatrzaskiem przy 100%.',
    defaultZone: 'main',
    defaultSpanCols: 1,
    isButtonLike: true,
    recommendedMaterial: 'suede',
    jsxSnippet: '<CapacitiveForceHoldPad rampMs={950} latchOnComplete />',
  },
  {
    id: 'touch-xy-vector',
    componentName: 'OpticalXYVectorPad',
    labelPl: 'Pad Wektorowy Optyczny X/Y',
    defaultWidgetLabel: 'Pole Wektorowe X/Y',
    category: 'touch-rotary',
    sourceModulePl: 'Warianty przełączników',
    descriptionPl:
      'Dwuwymiarowa tafla koordynatów X/Y ze śledzeniem kursora i siatką impulsów dotykowych.',
    defaultZone: 'main',
    defaultSpanCols: 1,
    isButtonLike: false,
    recommendedMaterial: 'shiny-glass',
    jsxSnippet: '<OpticalXYVectorPad x={62} y={38} gridTicks={10} />',
  },
  {
    id: 'touch-segmented-strip',
    componentName: 'SegmentedTouchStrip',
    labelPl: 'Listwa Dotykowa 4-Stopniowa',
    defaultWidgetLabel: 'Profil: Studyjny',
    category: 'touch-rotary',
    sourceModulePl: 'Warianty przełączników',
    descriptionPl:
      'Pojemnościowy pasek wyboru 4 poziomów (Cichy / Miękki / Studyjny / Szczytowy).',
    defaultZone: 'footer',
    defaultSpanCols: 2,
    isButtonLike: true,
    recommendedMaterial: 'frosted-glass',
    jsxSnippet: '<SegmentedTouchStrip levels={["Cichy","Miękki","Studyjny","Szczytowy"]} />',
  },

  // --- 5. Krótkie Niskie Minimalistyczne Kliknięcia (<160 Hz, 4–14 ms) ---
  {
    id: 'click-sub-carbon-6ms',
    componentName: 'MinimalCarbonClickButton',
    labelPl: 'Przycisk Minimal: Karbon 58 Hz (6 ms)',
    defaultWidgetLabel: 'Zatwierdź (58 Hz)',
    category: 'minimal-clicks',
    sourceModulePl: 'Minimalistyczne kliknięcia',
    descriptionPl:
      'Krótki, suchy mikro-styk 58 Hz wygaszany w 6 ms bez wysokich transjentów.',
    defaultZone: 'footer',
    defaultSpanCols: 1,
    isButtonLike: true,
    recommendedMaterial: 'matte-metal',
    jsxSnippet: '<MinimalClickButton clickVariant="sub-carbon-6ms">Zatwierdź</MinimalClickButton>',
  },
  {
    id: 'click-quartz-detent-8ms',
    componentName: 'MinimalQuartzDetentButton',
    labelPl: 'Przycisk Minimal: Kwarc 82 Hz (8 ms)',
    defaultWidgetLabel: 'Dalej (82 Hz)',
    category: 'minimal-clicks',
    sourceModulePl: 'Minimalistyczne kliknięcia',
    descriptionPl:
      'Punktowy impuls soczewki kwarcowej 82 Hz (8 ms) z czystym wygaszeniem w przejściu przez zero.',
    defaultZone: 'main',
    defaultSpanCols: 1,
    isButtonLike: true,
    recommendedMaterial: 'shiny-glass',
    jsxSnippet: '<MinimalClickButton clickVariant="quartz-detent-8ms">Dalej</MinimalClickButton>',
  },
  {
    id: 'click-monolith-thud-12ms',
    componentName: 'MinimalMonolithSubButton',
    labelPl: 'Przycisk Minimal: Monolit 46 Hz (12 ms)',
    defaultWidgetLabel: 'Aktywuj (46 Hz)',
    category: 'minimal-clicks',
    sourceModulePl: 'Minimalistyczne kliknięcia',
    descriptionPl:
      'Głęboki, aksamitny impuls sub-basowy 46 Hz (12 ms) o zerowym szumie mechanicznym.',
    defaultZone: 'main',
    defaultSpanCols: 1,
    isButtonLike: true,
    recommendedMaterial: 'suede',
    jsxSnippet: '<MinimalClickButton clickVariant="monolith-thud-12ms">Aktywuj</MinimalClickButton>',
  },
  {
    id: 'click-satin-tick-4ms',
    componentName: 'MinimalSatinTickNav',
    labelPl: 'Klawisz Minimal: Satyna 112 Hz (4 ms)',
    defaultWidgetLabel: 'Przełącz widok',
    category: 'minimal-clicks',
    sourceModulePl: 'Minimalistyczne kliknięcia',
    descriptionPl:
      'Ultrakrótki 4-milisekundowy mikro-tik 112 Hz do gęstej nawigacji i pasków narzędzi.',
    defaultZone: 'header',
    defaultSpanCols: 1,
    isButtonLike: true,
    recommendedMaterial: 'abs-plastic',
    jsxSnippet: '<MinimalClickButton clickVariant="satin-tick-4ms">Przełącz</MinimalClickButton>',
  },
];

export const TACTILE_CATEGORY_LABELS: Record<'all' | TactileWidgetCategory, string> = {
  all: 'Wszystkie (20)',
  buttons: 'Przyciski (5)',
  'minimal-clicks': 'Niskie Kliknięcia (4)',
  sliders: 'Suwaki (4)',
  levers: 'Dźwignie (3)',
  'touch-rotary': 'Dotyk i CNC (4)',
};

export const PROTOTYPE_ZONE_LABELS: Record<PrototypeDropZone, string> = {
  header: 'Strefa Nagłówka (Nawigacja)',
  main: 'Sekcja Główna Ekranu (Moduły)',
  footer: 'Dolny Dok Akcji (CTA / Pasek)',
};

// Module-level active drag state so cross-panel and cross-tab drop targets highlight reliably
let activeDraggedCatalogItem: TactileUiCatalogItem | null = null;
const dragListeners = new Set<(item: TactileUiCatalogItem | null) => void>();

export function setActiveDraggedCatalogItem(item: TactileUiCatalogItem | null): void {
  activeDraggedCatalogItem = item;
  dragListeners.forEach((fn) => fn(activeDraggedCatalogItem));
}

export function getActiveDraggedCatalogItem(): TactileUiCatalogItem | null {
  return activeDraggedCatalogItem;
}

export function subscribeActiveDraggedCatalogItem(
  listener: (item: TactileUiCatalogItem | null) => void
): () => void {
  dragListeners.add(listener);
  return () => {
    dragListeners.delete(listener);
  };
}

export function attachCatalogDragData(
  e: React.DragEvent<HTMLElement>,
  item: TactileUiCatalogItem
): void {
  const serialized = JSON.stringify({ catalogId: item.id });
  try {
    e.dataTransfer.setData(DRAG_TACTILE_UI_MIME, serialized);
    e.dataTransfer.setData('text/plain', `aether-ui:${item.id}`);
    e.dataTransfer.effectAllowed = 'copyMove';
  } catch {
    // Ignore restricted dataTransfer environments; module state fallback remains active
  }
  setActiveDraggedCatalogItem(item);
}

export function parseCatalogItemFromDrop(
  e: React.DragEvent<HTMLElement>
): TactileUiCatalogItem | null {
  try {
    const rawCustom = e.dataTransfer.getData(DRAG_TACTILE_UI_MIME);
    if (rawCustom) {
      const parsed = JSON.parse(rawCustom) as { catalogId?: string };
      if (parsed?.catalogId) {
        const found = TACTILE_UI_CATALOG.find((c) => c.id === parsed.catalogId);
        if (found) return found;
      }
    }
    const rawText = e.dataTransfer.getData('text/plain');
    if (rawText && rawText.startsWith('aether-ui:')) {
      const id = rawText.slice('aether-ui:'.length).trim();
      const found = TACTILE_UI_CATALOG.find((c) => c.id === id);
      if (found) return found;
    }
  } catch {
    // Fall back to activeDraggedCatalogItem
  }
  return activeDraggedCatalogItem;
}

export function hasTactileCatalogDrag(e: React.DragEvent<HTMLElement>): boolean {
  if (activeDraggedCatalogItem) return true;
  const types = Array.from(e.dataTransfer?.types || []);
  return types.includes(DRAG_TACTILE_UI_MIME) || types.includes('text/plain');
}

export function findCatalogItemById(id: string): TactileUiCatalogItem | undefined {
  return TACTILE_UI_CATALOG.find((item) => item.id === id);
}

export function findCatalogItemForMotionPreset(
  presetId: string,
  presetName: string
): TactileUiCatalogItem {
  if (presetId === 'cnc-micro-detent') {
    return findCatalogItemById('btn-cnc-detent')!;
  }
  const base = findCatalogItemById('btn-crystal-pill')!;
  return {
    ...base,
    defaultWidgetLabel: presetName.split(' ').slice(0, 2).join(' '),
  };
}

export function findCatalogItemForIlluminationPreset(
  illumName: string
): TactileUiCatalogItem {
  const base = findCatalogItemById('btn-glass-card')!;
  return {
    ...base,
    defaultWidgetLabel: illumName.split(' (')[0],
  };
}

export function findCatalogItemForMinimalistClick(
  variantId: string,
  shortLabelPl: string
): TactileUiCatalogItem {
  if (variantId === 'sub-carbon-6ms') return findCatalogItemById('click-sub-carbon-6ms')!;
  if (variantId === 'quartz-detent-8ms') return findCatalogItemById('click-quartz-detent-8ms')!;
  if (variantId === 'monolith-thud-12ms') return findCatalogItemById('click-monolith-thud-12ms')!;
  if (variantId === 'satin-tick-4ms') return findCatalogItemById('click-satin-tick-4ms')!;
  const base = findCatalogItemById('click-sub-carbon-6ms')!;
  return {
    ...base,
    defaultWidgetLabel: shortLabelPl,
  };
}

function mapComponentStringToCatalogItem(compName: string, idx: number): TactileUiCatalogItem {
  const lower = compName.toLowerCase();
  if (lower.includes('rotary') || lower.includes('calibration') || lower.includes('graduation')) {
    return findCatalogItemById('rotary-cnc-270')!;
  }
  if (lower.includes('slider') || lower.includes('waveform')) {
    return findCatalogItemById('slider-vernier')!;
  }
  if (lower.includes('switch') || lower.includes('lever')) {
    return findCatalogItemById('lever-cnc-aircraft')!;
  }
  if (lower.includes('header') || lower.includes('nav')) {
    return findCatalogItemById('btn-header-nav')!;
  }
  if (lower.includes('cta') || lower.includes('button') || lower.includes('action')) {
    return findCatalogItemById('btn-primary-cta')!;
  }
  if (lower.includes('audio') || lower.includes('strip')) {
    return findCatalogItemById('touch-segmented-strip')!;
  }
  if (idx === 0) {
    return findCatalogItemById('btn-glass-card')!;
  }
  return findCatalogItemById('btn-crystal-pill')!;
}

/**
 * Returns the screen's explicit `prototypeWidgets` if present, or deterministically
 * derives an initial interactive layout from `node.components` & `node.role`.
 */
export function resolvePrototypeWidgetsForNode(
  node: DesignedScreenNode
): PrototypeScreenWidget[] {
  if (Array.isArray(node.prototypeWidgets) && node.prototypeWidgets.length > 0) {
    return node.prototypeWidgets;
  }

  const seeded: PrototypeScreenWidget[] = [];

  // Header navigation widget for detail/settings/modal screens
  if (node.role === 'detail' || node.role === 'settings' || node.role === 'modal') {
    const navItem = findCatalogItemById('btn-header-nav')!;
    seeded.push({
      instanceId: `seed-${node.id}-hdr`,
      catalogId: navItem.id,
      componentName: navItem.componentName,
      label: node.role === 'modal' ? 'Zamknij' : '← Wstecz',
      category: navItem.category,
      zone: 'header',
      spanCols: 1,
      isButtonLike: true,
    });
  }

  // Main workspace widgets derived from existing `node.components`
  node.components.slice(0, 6).forEach((comp, idx) => {
    const cat = mapComponentStringToCatalogItem(comp, idx);
    seeded.push({
      instanceId: `seed-${node.id}-${idx}`,
      catalogId: cat.id,
      componentName: comp,
      label: comp.replace(/([A-Z])/g, ' $1').trim().slice(0, 28) || cat.defaultWidgetLabel,
      category: cat.category,
      zone: 'main',
      spanCols: cat.defaultSpanCols,
      isButtonLike: cat.isButtonLike,
    });
  });

  // Footer primary CTA widget
  const cta = findCatalogItemById('btn-primary-cta')!;
  seeded.push({
    instanceId: `seed-${node.id}-cta`,
    catalogId: cta.id,
    componentName: cta.componentName,
    label:
      node.role === 'settings'
        ? 'Zastosuj kalibrację'
        : node.role === 'modal'
          ? 'Potwierdź'
          : 'Dalej',
    category: cta.category,
    zone: 'footer',
    spanCols: 1,
    isButtonLike: true,
  });

  return seeded;
}

export function buildComponentsArrayFromWidgets(
  widgets: PrototypeScreenWidget[],
  fallbackComponents: string[]
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const w of widgets) {
    const clean = (w.componentName || w.label || '').trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      ordered.push(clean);
    }
    if (ordered.length >= 16) break;
  }
  return ordered.length > 0 ? ordered : fallbackComponents.slice(0, 16);
}

export function createWidgetFromCatalogItem(
  item: TactileUiCatalogItem,
  targetZone?: PrototypeDropZone
): PrototypeScreenWidget {
  const zone = targetZone || item.defaultZone;
  const suffix = Math.random().toString(36).slice(2, 7);
  return {
    instanceId: `w_${Date.now()}_${suffix}`,
    catalogId: item.id,
    componentName: item.componentName,
    label: item.defaultWidgetLabel,
    category: item.category,
    zone,
    spanCols: zone === 'header' ? 1 : item.defaultSpanCols,
    isButtonLike: item.isButtonLike,
  };
}

export function appendCatalogWidgetToNode(
  node: DesignedScreenNode,
  item: TactileUiCatalogItem,
  targetZone?: PrototypeDropZone
): DesignedScreenNode {
  const currentWidgets = resolvePrototypeWidgetsForNode(node);
  const created = createWidgetFromCatalogItem(item, targetZone);
  const nextWidgets = [...currentWidgets, created].slice(0, 24);
  return {
    ...node,
    prototypeWidgets: nextWidgets,
    components: buildComponentsArrayFromWidgets(nextWidgets, node.components),
  };
}
