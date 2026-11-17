import {
  AppScreenMapProject,
  DesignedScreenNode,
  MATERIAL_PROFILES,
  SCREEN_TRANSITION_PRESETS,
  ScreenMapEdge,
  ScreenRoleType,
} from '../types/studio';

export type MermaidDirection = 'LR' | 'TD';

export interface MermaidExportOptions {
  direction?: MermaidDirection;
  groupByRole?: boolean;
  includeMetadataComments?: boolean;
  wrapInMarkdown?: boolean;
}

export interface JsonExportOptions {
  includeTransitionSpecs?: boolean;
}

const ROLE_SUBGRAPH_LABELS: Record<ScreenRoleType, string> = {
  entry: 'Ekrany Wejsciowe',
  core: 'Ekrany Glowne',
  detail: 'Widoki Szczegolow',
  settings: 'Konfiguracja i Kalibracja',
  modal: 'Modale i Arkusze',
};

export function slugifyExportName(raw: string): string {
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'mapa-ekranow-aether';
}

function sanitizeMermaidId(id: string, fallbackIndex: number): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_]/g, '_');
  if (!cleaned) return `screen_${fallbackIndex}`;
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `s_${cleaned}`;
}

function escapeMermaidLabel(text: string): string {
  return text
    .replace(/"/g, "'")
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function formatNodeShape(
  nodeId: string,
  label: string,
  role: ScreenRoleType
): string {
  const safe = escapeMermaidLabel(label);
  switch (role) {
    case 'entry':
      return `${nodeId}(["${safe}"])`;
    case 'settings':
      return `${nodeId}[/"${safe}"/]`;
    case 'modal':
      return `${nodeId}{{"${safe}"}}`;
    default:
      return `${nodeId}["${safe}"]`;
  }
}

export function serializeScreenMapToMermaid(
  map: AppScreenMapProject,
  options: MermaidExportOptions = {}
): string {
  const {
    direction = 'LR',
    groupByRole = true,
    includeMetadataComments = true,
    wrapInMarkdown = false,
  } = options;

  const idLookup = new Map<string, string>();
  map.nodes.forEach((node, idx) => {
    idLookup.set(node.id, sanitizeMermaidId(node.id, idx));
  });

  const lines: string[] = [];

  if (includeMetadataComments) {
    lines.push(`%% Projekt: ${map.name}`);
    lines.push(`%% Zrodlo: ${map.sourceRepo}`);
    lines.push(
      `%% Ekrany: ${map.nodes.length} | Polaczenia: ${map.edges.length}`
    );
  }

  lines.push(`flowchart ${direction}`);

  const renderNodeLine = (node: DesignedScreenNode, indent: string) => {
    const mId = idLookup.get(node.id) || 'screen_node';
    const matLabel = MATERIAL_PROFILES[node.hapticMaterial]?.label || node.hapticMaterial;
    const label = `${node.title} — ${node.route} (${matLabel})`;
    return `${indent}${formatNodeShape(mId, label, node.role)}:::${node.role}`;
  };

  if (groupByRole) {
    const rolesOrder: ScreenRoleType[] = [
      'entry',
      'core',
      'detail',
      'settings',
      'modal',
    ];
    for (const role of rolesOrder) {
      const matching = map.nodes.filter((n) => n.role === role);
      if (matching.length === 0) continue;
      lines.push(
        `  subgraph role_${role}["${ROLE_SUBGRAPH_LABELS[role]}"]`
      );
      matching.forEach((node) => {
        lines.push(renderNodeLine(node, '    '));
      });
      lines.push('  end');
    }
  } else {
    map.nodes.forEach((node) => {
      lines.push(renderNodeLine(node, '  '));
    });
  }

  if (map.edges.length > 0) {
    lines.push('');
    map.edges.forEach((edge) => {
      const fromKey = idLookup.get(edge.fromScreenId);
      const toKey = idLookup.get(edge.toScreenId);
      if (!fromKey || !toKey) return;
      const preset = SCREEN_TRANSITION_PRESETS.find(
        (p) => p.id === edge.transitionId
      );
      const shortTransition = preset
        ? `${preset.name.replace(/^\d+\.\s*/, '')} (${preset.durationMs}ms)`
        : edge.transitionId;
      const edgeLabel = escapeMermaidLabel(
        `${edge.triggerLabel} · ${shortTransition}`
      );
      lines.push(`  ${fromKey} -->|"${edgeLabel}"| ${toKey}`);
    });
  }

  lines.push('');
  lines.push(
    '  classDef entry fill:#EEF2FF,stroke:#4F46E5,stroke-width:1.5px,color:#0F172A;'
  );
  lines.push(
    '  classDef core fill:#F8FAFC,stroke:#334155,stroke-width:1.5px,color:#0F172A;'
  );
  lines.push(
    '  classDef detail fill:#ECFEFF,stroke:#0891B2,stroke-width:1.5px,color:#0F172A;'
  );
  lines.push(
    '  classDef settings fill:#ECFDF5,stroke:#059669,stroke-width:1.5px,color:#0F172A;'
  );
  lines.push(
    '  classDef modal fill:#FAF5FF,stroke:#9333EA,stroke-width:1.5px,color:#0F172A;'
  );

  const rawDiagram = lines.join('\n');

  if (!wrapInMarkdown) {
    return rawDiagram;
  }

  const mdLines: string[] = [
    `# ${map.name}`,
    '',
    `> Źródło architektury: \`${map.sourceRepo}\` · Liczba ekranów: **${map.nodes.length}** · Liczba przejść: **${map.edges.length}**`,
    '',
    map.description ? `${map.description}\n` : '',
    '## Diagram przepływu ekranów (Mermaid.js)',
    '',
    '```mermaid',
    rawDiagram,
    '```',
    '',
    '## Wykaz projektowanych ekranów',
    '',
    '| Ścieżka | Ekran | Rola | Komponenty | Domyślne przejście |',
    '| :--- | :--- | :--- | :--- | :--- |',
    ...map.nodes.map((n) => {
      const preset = SCREEN_TRANSITION_PRESETS.find(
        (p) => p.id === n.preferredTransition
      );
      const transName = preset
        ? preset.name.replace(/^\d+\.\s*/, '')
        : n.preferredTransition;
      return `| \`${n.route}\` | **${n.title}** | ${n.role} | ${n.components.join(', ')} | ${transName} |`;
    }),
  ];

  return mdLines.filter((line, idx, arr) => !(line === '' && arr[idx - 1] === '')).join('\n');
}

export function serializeScreenMapToJson(
  map: AppScreenMapProject,
  options: JsonExportOptions = {}
): string {
  const { includeTransitionSpecs = true } = options;

  const usedTransitionIds = new Set<string>([
    map.defaultTransition,
    ...map.nodes.map((n) => n.preferredTransition),
    ...map.edges.map((e) => e.transitionId),
  ]);

  const payload = {
    schema: 'aether-screen-architecture/v1',
    exportedAt: new Date().toISOString(),
    project: {
      id: map.id,
      name: map.name,
      description: map.description,
      sourceRepo: map.sourceRepo,
      defaultTransition: map.defaultTransition,
      createdAt: map.createdAt,
      metrics: {
        screenCount: map.nodes.length,
        edgeCount: map.edges.length,
      },
      ...(map.githubMeta ? { githubMeta: map.githubMeta } : {}),
    },
    nodes: map.nodes,
    edges: map.edges,
    ...(includeTransitionSpecs
      ? {
          transitionPresets: SCREEN_TRANSITION_PRESETS.filter((preset) =>
            usedTransitionIds.has(preset.id)
          ).map((preset) => ({
            id: preset.id,
            name: preset.name,
            durationMs: preset.durationMs,
            physicsSummary: preset.physicsSummary,
            spring: preset.spring,
            enterInitial: preset.enterInitial,
            enterAnimate: preset.enterAnimate,
            exitTarget: preset.exitTarget,
          })),
        }
      : {}),
  };

  return JSON.stringify(payload, null, 2);
}

export function downloadLocalArchitectureFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseImportedScreenMapJson(rawText: string): AppScreenMapProject {
  const parsed = JSON.parse(rawText);
  const root = parsed?.project && Array.isArray(parsed?.nodes) ? parsed : null;

  const candidateNodes: DesignedScreenNode[] = Array.isArray(root?.nodes)
    ? root.nodes
    : Array.isArray(parsed?.nodes)
      ? parsed.nodes
      : [];

  const candidateEdges: ScreenMapEdge[] = Array.isArray(root?.edges)
    ? root.edges
    : Array.isArray(parsed?.edges)
      ? parsed.edges
      : [];

  if (candidateNodes.length === 0) {
    throw new Error(
      'Plik JSON nie zawiera prawidłowej tablicy ekranów (nodes).'
    );
  }

  const projectMeta = root?.project || parsed;

  return {
    id:
      typeof projectMeta.id === 'string' && projectMeta.id.trim()
        ? projectMeta.id
        : `imported-map-${Date.now()}`,
    name:
      typeof projectMeta.name === 'string' && projectMeta.name.trim()
        ? projectMeta.name
        : 'Zaimportowana Mapa Ekranów',
    description:
      typeof projectMeta.description === 'string'
        ? projectMeta.description
        : 'Architektura wczytana z lokalnego pliku JSON.',
    sourceRepo:
      typeof projectMeta.sourceRepo === 'string' && projectMeta.sourceRepo.trim()
        ? projectMeta.sourceRepo
        : 'local/json-import',
    defaultTransition:
      typeof projectMeta.defaultTransition === 'string'
        ? projectMeta.defaultTransition
        : 'spatial-glass-push',
    nodes: candidateNodes,
    edges: candidateEdges,
    githubMeta: projectMeta.githubMeta,
    createdAt:
      typeof projectMeta.createdAt === 'string'
        ? projectMeta.createdAt
        : new Date().toISOString(),
  };
}
