import { ElementShadeId, PrototypeDropZone } from '../types/studio';

export interface FrontendElementShadeSpec {
  id: ElementShadeId;
  labelPl: string;
  shortNamePl: string;
  hexLight: string;
  hexDark: string;
  /** Subtle tinted glass background for composed element in Light theme */
  surfaceBgLight: string;
  /** Subtle tinted glass background for composed element in Dark theme */
  surfaceBgDark: string;
  /** Hairline border color when idle */
  idleBorderLight: string;
  idleBorderDark: string;
  /** Synchronized highlight ring & glow when actively modified */
  activeBorderHex: string;
  activeGlowShadow: string;
  activeOverlayFill: string;
  badgeBgHex: string;
  badgeTextHex: string;
}

export const FRONTEND_ELEMENT_SHADE_ORDER: ElementShadeId[] = [
  'cobalt',
  'emerald',
  'amber',
  'violet',
  'rose',
  'cyan',
];

export const FRONTEND_ELEMENT_SHADES: Record<
  ElementShadeId,
  FrontendElementShadeSpec
> = {
  cobalt: {
    id: 'cobalt',
    labelPl: 'Chłodny Kobalt (Nawigacja / Akcje)',
    shortNamePl: 'Kobalt',
    hexLight: '#2563EB',
    hexDark: '#60A5FA',
    surfaceBgLight: 'rgba(226, 238, 255, 0.84)',
    surfaceBgDark: 'rgba(30, 58, 138, 0.44)',
    idleBorderLight: 'rgba(37, 99, 235, 0.34)',
    idleBorderDark: 'rgba(96, 165, 250, 0.40)',
    activeBorderHex: '#3B82F6',
    activeGlowShadow:
      '0 0 0 2px #3B82F6, 0 0 24px -2px rgba(59, 130, 246, 0.58), inset 0 1px 0 rgba(255, 255, 255, 0.72)',
    activeOverlayFill: 'rgba(59, 130, 246, 0.24)',
    badgeBgHex: '#2563EB',
    badgeTextHex: '#FFFFFF',
  },
  emerald: {
    id: 'emerald',
    labelPl: 'Szmaragdowa Mięta (Moduł Główny)',
    shortNamePl: 'Szmaragd',
    hexLight: '#059669',
    hexDark: '#34D399',
    surfaceBgLight: 'rgba(214, 251, 232, 0.84)',
    surfaceBgDark: 'rgba(6, 78, 59, 0.54)',
    idleBorderLight: 'rgba(5, 150, 105, 0.34)',
    idleBorderDark: 'rgba(52, 211, 153, 0.42)',
    activeBorderHex: '#10B981',
    activeGlowShadow:
      '0 0 0 2px #10B981, 0 0 26px -2px rgba(16, 185, 129, 0.62), inset 0 1px 0 rgba(255, 255, 255, 0.72)',
    activeOverlayFill: 'rgba(16, 185, 129, 0.25)',
    badgeBgHex: '#059669',
    badgeTextHex: '#FFFFFF',
  },
  amber: {
    id: 'amber',
    labelPl: 'Ciepły Bursztyn (Parametry i Suwaki)',
    shortNamePl: 'Bursztyn',
    hexLight: '#D97706',
    hexDark: '#FBBF24',
    surfaceBgLight: 'rgba(254, 244, 206, 0.86)',
    surfaceBgDark: 'rgba(120, 53, 15, 0.44)',
    idleBorderLight: 'rgba(217, 119, 6, 0.36)',
    idleBorderDark: 'rgba(251, 191, 36, 0.42)',
    activeBorderHex: '#F59E0B',
    activeGlowShadow:
      '0 0 0 2px #F59E0B, 0 0 24px -2px rgba(245, 158, 11, 0.60), inset 0 1px 0 rgba(255, 255, 255, 0.72)',
    activeOverlayFill: 'rgba(245, 158, 11, 0.25)',
    badgeBgHex: '#D97706',
    badgeTextHex: '#FFFFFF',
  },
  violet: {
    id: 'violet',
    labelPl: 'Ametystowy Fiolet (Komponenty AI)',
    shortNamePl: 'Fiolet',
    hexLight: '#7C3AED',
    hexDark: '#A78BFA',
    surfaceBgLight: 'rgba(239, 234, 255, 0.86)',
    surfaceBgDark: 'rgba(76, 29, 149, 0.45)',
    idleBorderLight: 'rgba(124, 58, 237, 0.34)',
    idleBorderDark: 'rgba(167, 139, 250, 0.42)',
    activeBorderHex: '#8B5CF6',
    activeGlowShadow:
      '0 0 0 2px #8B5CF6, 0 0 26px -2px rgba(139, 92, 246, 0.62), inset 0 1px 0 rgba(255, 255, 255, 0.72)',
    activeOverlayFill: 'rgba(139, 92, 246, 0.24)',
    badgeBgHex: '#7C3AED',
    badgeTextHex: '#FFFFFF',
  },
  rose: {
    id: 'rose',
    labelPl: 'Koralowy Róż (Akcenty i Przełączniki)',
    shortNamePl: 'Koral',
    hexLight: '#E11D48',
    hexDark: '#FB7185',
    surfaceBgLight: 'rgba(255, 231, 235, 0.84)',
    surfaceBgDark: 'rgba(136, 19, 55, 0.44)',
    idleBorderLight: 'rgba(225, 29, 72, 0.32)',
    idleBorderDark: 'rgba(251, 113, 133, 0.40)',
    activeBorderHex: '#F43F5E',
    activeGlowShadow:
      '0 0 0 2px #F43F5E, 0 0 24px -2px rgba(244, 63, 94, 0.58), inset 0 1px 0 rgba(255, 255, 255, 0.72)',
    activeOverlayFill: 'rgba(244, 63, 94, 0.23)',
    badgeBgHex: '#E11D48',
    badgeTextHex: '#FFFFFF',
  },
  cyan: {
    id: 'cyan',
    labelPl: 'Lodowy Cyjan (Stopka i Telemetria)',
    shortNamePl: 'Cyjan',
    hexLight: '#0891B2',
    hexDark: '#22D3EE',
    surfaceBgLight: 'rgba(210, 250, 254, 0.84)',
    surfaceBgDark: 'rgba(22, 78, 99, 0.48)',
    idleBorderLight: 'rgba(8, 145, 178, 0.34)',
    idleBorderDark: 'rgba(34, 211, 238, 0.42)',
    activeBorderHex: '#06B6D4',
    activeGlowShadow:
      '0 0 0 2px #06B6D4, 0 0 26px -2px rgba(6, 182, 212, 0.60), inset 0 1px 0 rgba(255, 255, 255, 0.72)',
    activeOverlayFill: 'rgba(6, 182, 212, 0.24)',
    badgeBgHex: '#0891B2',
    badgeTextHex: '#FFFFFF',
  },
};

export const DEFAULT_ZONE_SHADES: Record<PrototypeDropZone, ElementShadeId> = {
  header: 'cobalt',
  main: 'emerald',
  footer: 'cyan',
};

export function hashStringToShadeId(key: string, fallbackIndex = 0): ElementShadeId {
  if (!key) {
    return FRONTEND_ELEMENT_SHADE_ORDER[
      Math.abs(fallbackIndex) % FRONTEND_ELEMENT_SHADE_ORDER.length
    ];
  }
  let hash = fallbackIndex * 17;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return FRONTEND_ELEMENT_SHADE_ORDER[hash % FRONTEND_ELEMENT_SHADE_ORDER.length];
}

export function resolveElementShadeSpec(
  elementId: string,
  customShades: Record<string, ElementShadeId>,
  fallbackIndex = 0
): FrontendElementShadeSpec {
  const explicit = customShades[elementId];
  if (explicit && FRONTEND_ELEMENT_SHADES[explicit]) {
    return FRONTEND_ELEMENT_SHADES[explicit];
  }
  const computedId = hashStringToShadeId(elementId, fallbackIndex);
  return FRONTEND_ELEMENT_SHADES[computedId];
}

export function getNextElementShadeId(current: ElementShadeId): ElementShadeId {
  const idx = FRONTEND_ELEMENT_SHADE_ORDER.indexOf(current);
  if (idx === -1) return 'cobalt';
  return FRONTEND_ELEMENT_SHADE_ORDER[(idx + 1) % FRONTEND_ELEMENT_SHADE_ORDER.length];
}
