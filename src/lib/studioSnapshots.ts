import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  formatFirestoreQuotaOrErrorMessage,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  AppScreenMapProject,
  ButtonGroupId,
  DepthShadowSettings,
  DesignedScreenNode,
  EngravingBacklightSettings,
  GroupOverrideConfig,
  HapticMaterialType,
  HapticSettings,
  MATERIAL_PROFILES,
  OrganicAnimationConfig,
  PaletteMode,
  RotaryDriverCalibrationConfig,
  SCREEN_TRANSITION_PRESETS,
  ScreenMapEdge,
  ScreenTransitionPresetId,
  StudioSnapshotRecord,
  StudioSnapshotScreenMapState,
  StudioSnapshotState,
  StudioSnapshotSummary,
  SynthPatchSettings,
} from '../types/studio';

// Blueprint-synchronized validation constants (matching firebase-blueprint.json & firestore.rules verbatim)
export const SNAPSHOT_COLLECTION = 'studio_snapshots';
export const SNAPSHOT_LABEL_MAX_LENGTH = 160;
export const SNAPSHOT_NOTE_MAX_LENGTH = 600;
export const SNAPSHOT_VERSION_TAG_MAX_LENGTH = 32;
export const SNAPSHOT_VERSION_TAG_PATTERN = /^v[0-9]+[.][0-9]+([.][0-9]+)?$/;
export const SNAPSHOT_DOC_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const SNAPSHOT_MAX_NODES = 40;
export const SNAPSHOT_MAX_EDGES = 80;
export const SNAPSHOT_MAX_SELECTED_GROUPS = 6;

const VALID_PALETTES: readonly PaletteMode[] = [
  'pearl-flebologia',
  'finance-ice',
  'emerald-clinic',
];

const VALID_MATERIALS: readonly HapticMaterialType[] = [
  'shiny-glass',
  'frosted-glass',
  'matte-metal',
  'abs-plastic',
  'suede',
];

const VALID_BUTTON_GROUPS: readonly ButtonGroupId[] = [
  'group-primary',
  'group-diagnostic',
  'group-audio',
];

const PALETTE_LABELS: Record<PaletteMode, string> = {
  'pearl-flebologia': 'Perłowa Flebologia',
  'finance-ice': 'FinanceAI Błękit',
  'emerald-clinic': 'Szmaragdowa Klinika',
};

const utf8Encoder = new TextEncoder();

/**
 * Truncates a string by Unicode code points so its UTF-8 byte length (and therefore
 * also its UTF-16 code unit length and code point count) never exceeds `maxUtf8Bytes`.
 */
export function sliceUtf8Safe(input: unknown, maxUtf8Bytes: number): string {
  const str = String(input ?? '');
  if (!str || maxUtf8Bytes <= 0) return '';
  if (utf8Encoder.encode(str).byteLength <= maxUtf8Bytes) {
    return str;
  }
  let out = '';
  let usedBytes = 0;
  for (const ch of str) {
    const chBytes = utf8Encoder.encode(ch).byteLength;
    if (usedBytes + chBytes > maxUtf8Bytes) break;
    out += ch;
    usedBytes += chBytes;
  }
  return out;
}

function nonEmptyUtf8(
  input: unknown,
  fallback: string,
  maxUtf8Bytes: number
): string {
  const trimmed = sliceUtf8Safe(String(input ?? '').trim(), maxUtf8Bytes);
  return trimmed.length > 0 ? trimmed : sliceUtf8Safe(fallback, maxUtf8Bytes);
}

function safeGlowColor(input: unknown, fallback: string): string {
  const candidate = sliceUtf8Safe(String(input ?? '').trim(), 32);
  return candidate.length >= 3 ? candidate : fallback;
}

function sanitizePalette(input: unknown): PaletteMode {
  return VALID_PALETTES.includes(input as PaletteMode)
    ? (input as PaletteMode)
    : 'pearl-flebologia';
}

function sanitizeMaterial(input: unknown): HapticMaterialType {
  return VALID_MATERIALS.includes(input as HapticMaterialType)
    ? (input as HapticMaterialType)
    : 'frosted-glass';
}

function stripUndefinedDeep<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (input !== null && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      if (val !== undefined) {
        out[key] = stripUndefinedDeep(val);
      }
    }
    return out as T;
  }
  return input;
}

export function normalizeVersionTag(
  rawTag: string | undefined,
  existingCount: number
): string {
  const trimmed = sliceUtf8Safe(
    (rawTag || '').trim(),
    SNAPSHOT_VERSION_TAG_MAX_LENGTH
  );
  if (SNAPSHOT_VERSION_TAG_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return `v1.${Math.max(0, existingCount)}`;
}

export function sanitizeScreenMapForFirestore(
  map: AppScreenMapProject
): StudioSnapshotScreenMapState {
  const safeNodes: DesignedScreenNode[] = (Array.isArray(map?.nodes) ? map.nodes : [])
    .slice(0, SNAPSHOT_MAX_NODES)
    .map((n, idx) =>
      stripUndefinedDeep({
        id: nonEmptyUtf8(n?.id, `scr_${idx}`, 128),
        title: nonEmptyUtf8(n?.title, 'Ekran', 120),
        route: nonEmptyUtf8(n?.route, '/', 120),
        role: n?.role || 'core',
        status: n?.status || 'designing',
        summary: sliceUtf8Safe(n?.summary ?? '', 400),
        components: Array.isArray(n?.components)
          ? n.components
              .slice(0, 16)
              .map((c) => sliceUtf8Safe(c, 80))
              .filter((c) => c.length > 0)
          : [],
        ...(Array.isArray(n?.prototypeWidgets) && n.prototypeWidgets.length > 0
          ? {
              prototypeWidgets: n.prototypeWidgets.slice(0, 24).map((w, wIdx) => ({
                instanceId: nonEmptyUtf8(w?.instanceId, `w_${wIdx}`, 64),
                catalogId: nonEmptyUtf8(w?.catalogId, 'btn-glass-card', 64),
                componentName: nonEmptyUtf8(w?.componentName, 'TactileButton', 80),
                label: nonEmptyUtf8(w?.label, 'Element UI', 80),
                category:
                  w?.category === 'buttons' ||
                  w?.category === 'sliders' ||
                  w?.category === 'levers' ||
                  w?.category === 'touch-rotary'
                    ? w.category
                    : 'buttons',
                zone:
                  w?.zone === 'header' || w?.zone === 'main' || w?.zone === 'footer'
                    ? w.zone
                    : 'main',
                spanCols: w?.spanCols === 2 ? (2 as const) : (1 as const),
                isButtonLike: Boolean(w?.isButtonLike),
              })),
            }
          : {}),
        hapticMaterial: sanitizeMaterial(n?.hapticMaterial),
        preferredTransition: (nonEmptyUtf8(
          n?.preferredTransition,
          'spatial-glass-push',
          64
        ) as ScreenTransitionPresetId),
        ...(n?.studioTabLink ? { studioTabLink: n.studioTabLink } : {}),
        ...(n?.githubSourcePath
          ? { githubSourcePath: sliceUtf8Safe(n.githubSourcePath, 180) }
          : {}),
        x: Number.isFinite(n?.x) ? Math.round(n.x) : 80 + idx * 120,
        y: Number.isFinite(n?.y) ? Math.round(n.y) : 80,
      })
    );

  const fallbackNode: DesignedScreenNode = {
    id: 'scr-default',
    title: 'Pulpit Główny',
    route: '/',
    role: 'entry',
    status: 'ready',
    summary: 'Domyślny ekran wejściowy studia.',
    components: ['DashboardView'],
    hapticMaterial: 'frosted-glass',
    preferredTransition: 'spatial-glass-push',
    x: 80,
    y: 80,
  };

  const finalNodes = safeNodes.length > 0 ? safeNodes : [fallbackNode];

  const safeEdges: ScreenMapEdge[] = (Array.isArray(map?.edges) ? map.edges : [])
    .slice(0, SNAPSHOT_MAX_EDGES)
    .map((e, idx) => ({
      id: nonEmptyUtf8(e?.id, `edge_${idx}`, 128),
      fromScreenId: nonEmptyUtf8(e?.fromScreenId, finalNodes[0].id, 128),
      toScreenId: nonEmptyUtf8(e?.toScreenId, finalNodes[0].id, 128),
      triggerLabel: nonEmptyUtf8(e?.triggerLabel, 'Nawigacja', 120),
      transitionId: (nonEmptyUtf8(
        e?.transitionId,
        'spatial-glass-push',
        64
      ) as ScreenTransitionPresetId),
    }));

  const result: StudioSnapshotScreenMapState = {
    id: nonEmptyUtf8(map?.id, 'aether-studio-master-map', 128),
    name: nonEmptyUtf8(map?.name, 'Architektura Aether Studio', 240),
    description: sliceUtf8Safe(map?.description ?? '', 1600),
    sourceRepo: nonEmptyUtf8(map?.sourceRepo, 'aether/tactile-studio', 240),
    defaultTransition: (nonEmptyUtf8(
      map?.defaultTransition,
      'spatial-glass-push',
      64
    ) as ScreenTransitionPresetId),
    nodes: finalNodes,
    edges: safeEdges,
  };

  if (map?.githubMeta && typeof map.githubMeta === 'object') {
    result.githubMeta = stripUndefinedDeep({
      repoFullName: sliceUtf8Safe(map.githubMeta.repoFullName ?? '', 140),
      repoUrl: sliceUtf8Safe(map.githubMeta.repoUrl ?? '', 240),
      description: sliceUtf8Safe(map.githubMeta.description ?? '', 400),
      language: nonEmptyUtf8(map.githubMeta.language, 'TypeScript', 60),
      stars: finiteNum(map.githubMeta.stars, 0),
      defaultBranch: nonEmptyUtf8(map.githubMeta.defaultBranch, 'main', 60),
      detectedPackages: Array.isArray(map.githubMeta.detectedPackages)
        ? map.githubMeta.detectedPackages
            .slice(0, 20)
            .map((s) => sliceUtf8Safe(s, 80))
        : [],
      detectedModules: Array.isArray(map.githubMeta.detectedModules)
        ? map.githubMeta.detectedModules
            .slice(0, 20)
            .map((s) => sliceUtf8Safe(s, 120))
        : [],
      architectureSummary: sliceUtf8Safe(
        map.githubMeta.architectureSummary ?? '',
        500
      ),
      generatedByModel: nonEmptyUtf8(
        map.githubMeta.generatedByModel,
        'gemini',
        80
      ),
    });
  }

  return stripUndefinedDeep(result);
}

function finiteNum(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export function buildSanitizedStudioSnapshotState(raw: {
  palette: PaletteMode;
  activeScreenTransition: ScreenTransitionPresetId;
  selectedGroups: ButtonGroupId[];
  depth: DepthShadowSettings;
  synth: SynthPatchSettings;
  haptic: HapticSettings;
  engraving: EngravingBacklightSettings;
  animation: OrganicAnimationConfig;
  groupConfigs: Record<ButtonGroupId, GroupOverrideConfig>;
  driverCalibration: RotaryDriverCalibrationConfig;
  activeScreenMap: AppScreenMapProject;
}): { summary: StudioSnapshotSummary; state: StudioSnapshotState } {
  const safePalette = sanitizePalette(raw.palette);
  const safeMaterial = sanitizeMaterial(raw.haptic?.material);
  const safeTransition = nonEmptyUtf8(
    raw.activeScreenTransition,
    'spatial-glass-push',
    64
  ) as ScreenTransitionPresetId;

  const safeSelectedGroups: ButtonGroupId[] = (
    Array.isArray(raw.selectedGroups) ? raw.selectedGroups : []
  )
    .filter((gid): gid is ButtonGroupId => VALID_BUTTON_GROUPS.includes(gid))
    .slice(0, SNAPSHOT_MAX_SELECTED_GROUPS);

  const clampedBaseFreq = Math.max(
    36,
    Math.min(158, Math.round(finiteNum(raw.synth?.baseFrequency, 86)))
  );
  const clampedDriverLowHz = Math.max(
    36,
    Math.min(156, Math.round(finiteNum(raw.driverCalibration?.lowBodyFreqHz, 74)))
  );

  const sanitizedScreenMap = sanitizeScreenMapForFirestore(raw.activeScreenMap);

  const state: StudioSnapshotState = stripUndefinedDeep({
    palette: safePalette,
    activeScreenTransition: safeTransition,
    selectedGroups: safeSelectedGroups,
    depth: {
      elevation: finiteNum(raw.depth?.elevation, 20),
      blur: finiteNum(raw.depth?.blur, 42),
      glassBlur: finiteNum(raw.depth?.glassBlur, 22),
      glassOpacity: finiteNum(raw.depth?.glassOpacity, 0.72),
      borderRadius: finiteNum(raw.depth?.borderRadius, 28),
      specularRim: finiteNum(raw.depth?.specularRim, 82),
    },
    synth: {
      waveform: (nonEmptyUtf8(
        raw.synth?.waveform,
        'sine',
        24
      ) as SynthPatchSettings['waveform']),
      baseFrequency: clampedBaseFreq,
      harmonicRatio: finiteNum(raw.synth?.harmonicRatio, 1.5),
      filterCutoff: finiteNum(raw.synth?.filterCutoff, 2600),
      filterResonance: finiteNum(raw.synth?.filterResonance, 2.4),
      attackMs: finiteNum(raw.synth?.attackMs, 5),
      decayMs: finiteNum(raw.synth?.decayMs, 115),
      reverbMix: finiteNum(raw.synth?.reverbMix, 0.14),
      subBassLevel: finiteNum(raw.synth?.subBassLevel, 0.48),
    },
    haptic: {
      enabled: Boolean(raw.haptic?.enabled),
      material: safeMaterial,
      intensity: finiteNum(raw.haptic?.intensity, 76),
      durationMs: finiteNum(raw.haptic?.durationMs, 48),
      materialHardness: finiteNum(raw.haptic?.materialHardness, 74),
      reverseClutchForce: finiteNum(raw.haptic?.reverseClutchForce, 54),
      holdRampMultiplier: finiteNum(raw.haptic?.holdRampMultiplier, 1.65),
      activePatternId: nonEmptyUtf8(
        raw.haptic?.activePatternId,
        'crystal-ripple',
        128
      ),
    },
    engraving: {
      symbol: (nonEmptyUtf8(
        raw.engraving?.symbol,
        'vascular',
        40
      ) as EngravingBacklightSettings['symbol']),
      glowEnabled: Boolean(raw.engraving?.glowEnabled),
      glowColor: safeGlowColor(raw.engraving?.glowColor, '#8B7CFF'),
      glowIntensity: finiteNum(raw.engraving?.glowIntensity, 78),
      etchDepth: finiteNum(raw.engraving?.etchDepth, 72),
    },
    animation: {
      stiffness: finiteNum(raw.animation?.stiffness, 440),
      damping: finiteNum(raw.animation?.damping, 26),
      mass: finiteNum(raw.animation?.mass, 0.82),
      pressScale: finiteNum(raw.animation?.pressScale, 0.964),
      rippleDurationMs: finiteNum(raw.animation?.rippleDurationMs, 560),
      glowSpread: finiteNum(raw.animation?.glowSpread, 36),
      holdTremorHz: finiteNum(raw.animation?.holdTremorHz, 18),
      motionPreset: (nonEmptyUtf8(
        raw.animation?.motionPreset,
        'magnetic-levitation',
        64
      ) as OrganicAnimationConfig['motionPreset']),
      illuminationPreset: (nonEmptyUtf8(
        raw.animation?.illuminationPreset,
        'cursor-spotlight',
        64
      ) as OrganicAnimationConfig['illuminationPreset']),
      aiNote: sliceUtf8Safe(raw.animation?.aiNote ?? '', 1200),
    },
    groupConfigs: {
      'group-primary': {
        material: sanitizeMaterial(raw.groupConfigs?.['group-primary']?.material),
        pitchOffsetSemitones: finiteNum(
          raw.groupConfigs?.['group-primary']?.pitchOffsetSemitones,
          0
        ),
        glowColor: safeGlowColor(
          raw.groupConfigs?.['group-primary']?.glowColor,
          '#8B7CFF'
        ),
        symbol: (nonEmptyUtf8(
          raw.groupConfigs?.['group-primary']?.symbol,
          'prism',
          40
        ) as GroupOverrideConfig['symbol']),
      },
      'group-diagnostic': {
        material: sanitizeMaterial(
          raw.groupConfigs?.['group-diagnostic']?.material
        ),
        pitchOffsetSemitones: finiteNum(
          raw.groupConfigs?.['group-diagnostic']?.pitchOffsetSemitones,
          2
        ),
        glowColor: safeGlowColor(
          raw.groupConfigs?.['group-diagnostic']?.glowColor,
          '#68BBE3'
        ),
        symbol: (nonEmptyUtf8(
          raw.groupConfigs?.['group-diagnostic']?.symbol,
          'vascular',
          40
        ) as GroupOverrideConfig['symbol']),
      },
      'group-audio': {
        material: sanitizeMaterial(
          raw.groupConfigs?.['group-audio']?.material ?? 'matte-metal'
        ),
        pitchOffsetSemitones: finiteNum(
          raw.groupConfigs?.['group-audio']?.pitchOffsetSemitones,
          -3
        ),
        glowColor: safeGlowColor(
          raw.groupConfigs?.['group-audio']?.glowColor,
          '#74BFA1'
        ),
        symbol: (nonEmptyUtf8(
          raw.groupConfigs?.['group-audio']?.symbol,
          'wave',
          40
        ) as GroupOverrideConfig['symbol']),
      },
    },
    driverCalibration: {
      detentCount: finiteNum(raw.driverCalibration?.detentCount, 120),
      sweepAngleDeg: finiteNum(raw.driverCalibration?.sweepAngleDeg, 270),
      lowBodyFreqHz: clampedDriverLowHz,
      mouseSnapBlend: finiteNum(raw.driverCalibration?.mouseSnapBlend, 82),
      rotaryHapticStrength: finiteNum(
        raw.driverCalibration?.rotaryHapticStrength,
        84
      ),
      tickPulseMs: finiteNum(raw.driverCalibration?.tickPulseMs, 9),
      majorTickEvery: finiteNum(raw.driverCalibration?.majorTickEvery, 10),
      majorTickAccent: finiteNum(raw.driverCalibration?.majorTickAccent, 1.65),
      endStopResistance: finiteNum(raw.driverCalibration?.endStopResistance, 90),
      axialPushForce: finiteNum(raw.driverCalibration?.axialPushForce, 88),
      backlashClutch: finiteNum(raw.driverCalibration?.backlashClutch, 76),
    },
    screenMap: sanitizedScreenMap,
  });

  const summary: StudioSnapshotSummary = {
    palette: state.palette,
    material: state.haptic.material,
    baseFreqHz: state.synth.baseFrequency,
    screenCount: sanitizedScreenMap.nodes.length,
    edgeCount: sanitizedScreenMap.edges.length,
  };

  return { summary, state };
}

function parseTimestampMs(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (
    val &&
    typeof val === 'object' &&
    'seconds' in val &&
    typeof (val as { seconds: unknown }).seconds === 'number'
  ) {
    return (val as { seconds: number }).seconds * 1000;
  }
  return Date.now();
}

export function subscribeUserStudioSnapshots(
  ownerId: string,
  onNext: (items: StudioSnapshotRecord[]) => void,
  onUiError: (friendlyMessage: string) => void
): Unsubscribe {
  const snapshotsQuery = query(
    collection(db, SNAPSHOT_COLLECTION),
    where('ownerId', '==', ownerId)
  );

  return onSnapshot(
    snapshotsQuery,
    (querySnap) => {
      const records: StudioSnapshotRecord[] = [];
      querySnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data || !data.state || !data.summary) return;
        const createdAtMs = parseTimestampMs(data.createdAt);
        const updatedAtMs = parseTimestampMs(data.updatedAt);
        records.push({
          id: docSnap.id,
          ownerId: String(data.ownerId || ownerId),
          label: String(data.label || 'Migawka konfiguracji'),
          note: String(data.note || ''),
          versionTag: String(data.versionTag || 'v1.0'),
          isPinned: Boolean(data.isPinned),
          summary: data.summary as StudioSnapshotSummary,
          state: data.state as StudioSnapshotState,
          createdAtMs,
          updatedAtMs,
          createdAtFormatted: new Date(createdAtMs).toLocaleString('pl-PL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
      });

      records.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.createdAtMs - a.createdAtMs;
      });

      onNext(records);
    },
    (error) => {
      onUiError(formatFirestoreQuotaOrErrorMessage(error));
      try {
        handleFirestoreError(error, OperationType.LIST, SNAPSHOT_COLLECTION);
      } catch {
        // Error JSON logged to console by handleFirestoreError; keep React listener alive
      }
    }
  );
}

export async function createStudioSnapshotInFirestore(params: {
  ownerId: string;
  label: string;
  note: string;
  versionTag: string;
  isPinned: boolean;
  summary: StudioSnapshotSummary;
  state: StudioSnapshotState;
}): Promise<string> {
  const randomSuffix = Math.random()
    .toString(36)
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 7) || 's1';
  const docId = `snap_${Date.now()}_${randomSuffix}`;
  if (!SNAPSHOT_DOC_ID_PATTERN.test(docId)) {
    throw new Error('Nieprawidłowy identyfikator dokumentu migawki.');
  }

  const resolvedOwnerId = nonEmptyUtf8(
    auth.currentUser?.uid || params.ownerId,
    params.ownerId,
    128
  );
  const cleanLabel = nonEmptyUtf8(
    params.label,
    'Migawka Aether Studio',
    SNAPSHOT_LABEL_MAX_LENGTH
  );
  const cleanNote = sliceUtf8Safe(
    params.note.trim(),
    SNAPSHOT_NOTE_MAX_LENGTH
  );
  const candidateTag = sliceUtf8Safe(
    params.versionTag.trim(),
    SNAPSHOT_VERSION_TAG_MAX_LENGTH
  );
  const cleanVersionTag = SNAPSHOT_VERSION_TAG_PATTERN.test(candidateTag)
    ? candidateTag
    : 'v1.0';

  const cleanSummary = stripUndefinedDeep(params.summary);
  const cleanState = stripUndefinedDeep(params.state);

  const path = `${SNAPSHOT_COLLECTION}/${docId}`;
  try {
    await setDoc(doc(db, SNAPSHOT_COLLECTION, docId), {
      ownerId: resolvedOwnerId,
      label: cleanLabel,
      note: cleanNote,
      versionTag: cleanVersionTag,
      isPinned: Boolean(params.isPinned),
      summary: cleanSummary,
      state: cleanState,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateStudioSnapshotMetadataInFirestore(
  snapshotId: string,
  label: string,
  note: string
): Promise<void> {
  const cleanLabel = nonEmptyUtf8(
    label,
    'Migawka Aether Studio',
    SNAPSHOT_LABEL_MAX_LENGTH
  );
  const cleanNote = sliceUtf8Safe(note.trim(), SNAPSHOT_NOTE_MAX_LENGTH);
  const path = `${SNAPSHOT_COLLECTION}/${snapshotId}`;
  try {
    await updateDoc(doc(db, SNAPSHOT_COLLECTION, snapshotId), {
      label: cleanLabel,
      note: cleanNote,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleStudioSnapshotPinInFirestore(
  snapshotId: string,
  nextPinned: boolean
): Promise<void> {
  const path = `${SNAPSHOT_COLLECTION}/${snapshotId}`;
  try {
    await updateDoc(doc(db, SNAPSHOT_COLLECTION, snapshotId), {
      isPinned: Boolean(nextPinned),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteStudioSnapshotFromFirestore(
  snapshotId: string
): Promise<void> {
  const path = `${SNAPSHOT_COLLECTION}/${snapshotId}`;
  try {
    await deleteDoc(doc(db, SNAPSHOT_COLLECTION, snapshotId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface SnapshotDiffEntry {
  parameter: string;
  inSnapshot: string;
  inCurrentStudio: string;
  changed: boolean;
}

export function computeSnapshotDiffEntries(
  snap: StudioSnapshotState,
  current: StudioSnapshotState
): SnapshotDiffEntry[] {
  const snapTransition =
    SCREEN_TRANSITION_PRESETS.find((t) => t.id === snap.activeScreenTransition)
      ?.name.replace(/^\d+\.\s*/, '') || snap.activeScreenTransition;
  const currTransition =
    SCREEN_TRANSITION_PRESETS.find(
      (t) => t.id === current.activeScreenTransition
    )?.name.replace(/^\d+\.\s*/, '') || current.activeScreenTransition;

  return [
    {
      parameter: 'Paleta kolorystyczna',
      inSnapshot: PALETTE_LABELS[snap.palette] || snap.palette,
      inCurrentStudio: PALETTE_LABELS[current.palette] || current.palette,
      changed: snap.palette !== current.palette,
    },
    {
      parameter: 'Materiał i twardość haptyki',
      inSnapshot: `${MATERIAL_PROFILES[snap.haptic.material]?.label || snap.haptic.material} · ${snap.haptic.materialHardness} Sh · ${snap.haptic.intensity}%`,
      inCurrentStudio: `${MATERIAL_PROFILES[current.haptic.material]?.label || current.haptic.material} · ${current.haptic.materialHardness} Sh · ${current.haptic.intensity}%`,
      changed:
        snap.haptic.material !== current.haptic.material ||
        snap.haptic.materialHardness !== current.haptic.materialHardness ||
        snap.haptic.intensity !== current.haptic.intensity,
    },
    {
      parameter: 'Syntezator i niski ton kliku (<160 Hz)',
      inSnapshot: `${snap.synth.waveform} · ${snap.synth.baseFrequency} Hz · filtr ${snap.synth.filterCutoff} Hz`,
      inCurrentStudio: `${current.synth.waveform} · ${current.synth.baseFrequency} Hz · filtr ${current.synth.filterCutoff} Hz`,
      changed:
        snap.synth.waveform !== current.synth.waveform ||
        snap.synth.baseFrequency !== current.synth.baseFrequency ||
        snap.synth.filterCutoff !== current.synth.filterCutoff,
    },
    {
      parameter: 'Cienie i głębia szkła',
      inSnapshot: `Cień ${snap.depth.elevation} px · Rozmycie ${snap.depth.glassBlur} px · Zaokr. ${snap.depth.borderRadius} px`,
      inCurrentStudio: `Cień ${current.depth.elevation} px · Rozmycie ${current.depth.glassBlur} px · Zaokr. ${current.depth.borderRadius} px`,
      changed:
        snap.depth.elevation !== current.depth.elevation ||
        snap.depth.glassBlur !== current.depth.glassBlur ||
        snap.depth.borderRadius !== current.depth.borderRadius ||
        Math.round(snap.depth.glassOpacity * 100) !==
          Math.round(current.depth.glassOpacity * 100),
    },
    {
      parameter: 'Kalibracja pokrętła CNC 270°',
      inSnapshot: `${snap.driverCalibration.detentCount} zapadek · ${snap.driverCalibration.lowBodyFreqHz} Hz · siła ${snap.driverCalibration.rotaryHapticStrength}%`,
      inCurrentStudio: `${current.driverCalibration.detentCount} zapadek · ${current.driverCalibration.lowBodyFreqHz} Hz · siła ${current.driverCalibration.rotaryHapticStrength}%`,
      changed:
        snap.driverCalibration.detentCount !==
          current.driverCalibration.detentCount ||
        snap.driverCalibration.lowBodyFreqHz !==
          current.driverCalibration.lowBodyFreqHz ||
        snap.driverCalibration.rotaryHapticStrength !==
          current.driverCalibration.rotaryHapticStrength,
    },
    {
      parameter: 'Mapa ekranów i animacja przejść',
      inSnapshot: `${snap.screenMap.name} (${snap.screenMap.nodes.length} ekr. / ${snap.screenMap.edges.length} poł.) · ${snapTransition}`,
      inCurrentStudio: `${current.screenMap.name} (${current.screenMap.nodes.length} ekr. / ${current.screenMap.edges.length} poł.) · ${currTransition}`,
      changed:
        snap.activeScreenTransition !== current.activeScreenTransition ||
        snap.screenMap.name !== current.screenMap.name ||
        snap.screenMap.nodes.length !== current.screenMap.nodes.length ||
        snap.screenMap.edges.length !== current.screenMap.edges.length,
    },
  ];
}
