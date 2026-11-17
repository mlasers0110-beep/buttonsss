import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileUp,
  Layers,
  LayoutGrid,
  Save,
  Search,
  Server,
  Trash2,
  Upload,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { hapticAudio } from '../lib/hapticAudioEngine';
import { compressImageDataUrlForApi } from '../lib/localDiskWorkspace';
import {
  downloadLocalArchitectureFile,
  serializeScreenMapToMermaid,
  slugifyExportName,
} from '../lib/screenMapExport';
import {
  AppScreenMapProject,
  FileBuildTargetType,
  MATERIAL_PROFILES,
  SCREEN_TRANSITION_PRESETS,
  UploadedFileBuildPlan,
} from '../types/studio';

interface SampleStarterFile {
  id: string;
  label: string;
  fileName: string;
  mimeType: string;
  targetType: FileBuildTargetType;
  goalHint: string;
  content: string;
}

const STARTER_SAMPLE_FILES: SampleStarterFile[] = [
  {
    id: 'sample-clinic',
    label: 'Specyfikacja Kliniki (.md)',
    fileName: 'specyfikacja-kliniki-flebologii.md',
    mimeType: 'text/markdown',
    targetType: 'website-and-webapp',
    goalHint:
      'Nowoczesna strona kliniki flebologii + aplikacja portalu pacjenta z rezerwacją USG Doppler i wynikami.',
    content: `# Specyfikacja Projektu: Klinika Flebologii i Diagnostyki Naczyniowej AetherMed

## 1. Cel Biznesowy i Warstwa Strony Internetowej (Marketing & Konwersja)
- Prezentacja małoinwazyjnych zabiegów laserowych EVLT, skleroterapii oraz diagnostyki USG Doppler.
- Sekcja Hero z interaktywnym kwalifikatorem objawów (obrzęki, widoczne naczynka, skurcze nocne) i bezpośrednim przejściem do rezerwacji terminu.
- Zespół lekarzy specjalistów z certyfikatami PTChN, cennik procedur w układzie tabelarycznym oraz udokumentowane wskaźniki skuteczności (98.4% zabiegów bez hospitalizacji).

## 2. Warstwa Aplikacji Internetowej (Portal Pacjenta i Konsola Lekarza)
- **/logowanie**: Bezpieczne logowanie pacjenta i personelu medycznego.
- **/portal/wizyty**: Kalendarz wolnych slotów USG Doppler, wybór specjalisty, płatność zadatku i pobieranie przygotowania do badania PDF.
- **/portal/dokumentacja**: Chroniona karta pacjenta, historia badań obrazowych, zalecenia pozabiegowe i przypomnienia o kontroli.
- **/konsola/grafik**: Panel lekarza z listą dziennych przyjęć, szybkim podglądem wywiadu medycznego i generatorem wypisu.
- **/ustawienia**: Zarządzanie zgodami RODO, powiadomieniami SMS oraz danymi rozliczeniowymi.`,
  },
  {
    id: 'sample-fintech',
    label: 'Brief SaaS FinTech (.json)',
    fileName: 'architektura-fintech-skarbiec.json',
    mimeType: 'application/json',
    targetType: 'website-and-webapp',
    goalHint:
      'Strona produktowa B2B + aplikacja webowa zarządzania płynnością finansową i prognozowaniem przepływów.',
    content: JSON.stringify(
      {
        project: 'Vanguard Treasury OS',
        segment: 'B2B CFO & Działy Finansowe MŚP / Enterprise',
        websiteSections: [
          'Hero z kalkulatorem oszczędności płynności i podglądem kokpitu CFO',
          'Integracje bankowe PSD2 i ERP (SAP, NetSuite, Comarch)',
          'Bezpieczeństwo SOC2 / szyfrowanie kluczy i audyt operacji',
          'Plany abonamentowe: Growth, Scale, Enterprise Treasury',
        ],
        webAppModules: [
          {
            route: '/app/przeplywy',
            role: 'Analityk Finansowy / CFO',
            features: [
              'Skonsolidowane salda wielowalutowe PLN/EUR/USD na żywo',
              'Prognoza płynności 13-tygodniowej z analizą odchyleń',
            ],
          },
          {
            route: '/app/zlecenia',
            role: 'Skarbnik / Dyrektor Finansowy',
            features: [
              'Wielopoziomowa akceptacja paczek przelewów i wymiany walut FX',
              'Limity autoryzacji i rejestr audytowy operacji',
            ],
          },
          {
            route: '/app/integracje',
            role: 'Administrator Systemu',
            features: ['Konektory API banków, webhooki księgowe, klucze dostępu'],
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'sample-hardware',
    label: 'Brief E-Commerce + Kalibrator (.txt)',
    fileName: 'brief-audio-cnc-ecommerce.txt',
    mimeType: 'text/plain',
    targetType: 'website-and-webapp',
    goalHint:
      'Sklep flagowy ze sterownikami studyjnymi CNC + webowa aplikacja konfiguracji profili haptycznych i firmware.',
    content: `PROJEKT: MONOLITH ROTARY STUDIO — Strona Produktowa E-Commerce + Aplikacja WebUSB Konfiguratora

CZĘŚĆ I — STRONA INTERNETOWA:
1. Ekspozycja kontrolera CNC 270° ze szczotkowanego aluminium lotniczego, makro-fotografia detali skali 120 zapadek.
2. Porównanie 3 wariantów sprzętowych (Studio Edition, Mastering Pro, Broadcast Rack) z pełną tabelą parametrów mechanicznych.
3. Koszyk i szybkie zamówienie z konfiguracją graweru laserowego i wyboru sprężyny oporowej.

CZĘŚĆ II — APLIKACJA INTERNETOWA (STUDIO KONFIGURATORA):
1. Dashboard urządzenia (/studio/urzadzenie): Odczyt podłączonego kontrolera, wersja firmware, temperatura i stan baterii.
2. Edytor mapowania skrótów i makr (/studio/mapowanie): Przypisanie akcji dla DaVinci Resolve, Ableton Live, Figma i Lightroom.
3. Kalibracja akustyczno-haptyczna (/studio/haptyka): Regulacja siły zapadki, częstotliwości korpusu <160 Hz i zapis presetów w chmurze.`,
  },
];

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

const BINARY_INLINE_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

function inferMimeTypeFromName(fileName: string, browserMime: string): string {
  if (browserMime && browserMime !== 'application/octet-stream') {
    return browserMime.toLowerCase();
  }
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'md':
    case 'markdown':
      return 'text/markdown';
    case 'json':
      return 'application/json';
    case 'csv':
      return 'text/csv';
    case 'html':
    case 'htm':
      return 'text/html';
    case 'yaml':
    case 'yml':
      return 'text/yaml';
    default:
      return 'text/plain';
  }
}

function serializeBuildPlanToMarkdown(
  matrix: UploadedFileBuildPlan,
  screenMap: AppScreenMapProject
): string {
  const esc = (val: string) => val.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const lines: string[] = [
    `# ${matrix.projectTitle}`,
    '',
    `> ${matrix.executiveSummary}`,
    '',
    `- **Plik źródłowy:** \`${matrix.fileName}\` (${matrix.fileMimeType}, ${matrix.fileSizeKb} KB)`,
    `- **Wygenerowano przez:** ${matrix.generatedByModel} · ${matrix.createdAt}`,
    `- **Paleta i kontrast:** ${matrix.designTokens.recommendedPalette}`,
    `- **Typografia:** ${matrix.designTokens.typographyPairing}`,
    `- **Architektura układu:** ${matrix.designTokens.layoutArchitecture}`,
    `- **Materiał haptyczny Aether:** ${MATERIAL_PROFILES[matrix.designTokens.primaryHapticMaterial]?.label || matrix.designTokens.primaryHapticMaterial}`,
    `- **Rekomendowany stos technologiczny:** ${matrix.designTokens.stackRecommendation}`,
    '',
    '---',
    '',
    '## 1. Gotowa Matryca Budowy Strony Internetowej (Website Matrix)',
    '',
    '| Sekcja | Trasa / Kotwica | Siatka i Układ (1440px / Mobile) | Komponenty Kluczowe | Specyfikacja Wizualna i Dotykowa | Cel Konwersji |',
    '| :--- | :--- | :--- | :--- | :--- | :--- |',
  ];

  for (const row of matrix.websiteMatrix) {
    lines.push(
      `| ${esc(row.sectionName)} | \`${esc(row.routeOrAnchor)}\` | ${esc(row.gridLayout)} | ${esc(row.keyComponents.join(', '))} | ${esc(row.visualAndTactileSpec)} | ${esc(row.conversionGoal)} |`
    );
  }

  lines.push(
    '',
    '### Gotowe Prompty Wdrożeniowe Sekcji Strony WWW',
    ''
  );
  for (const row of matrix.websiteMatrix) {
    if (row.buildPrompt) {
      lines.push(`- **${row.sectionName}:** ${row.buildPrompt}`);
    }
  }

  lines.push(
    '',
    '---',
    '',
    '## 2. Gotowa Matryca Projektu Aplikacji Internetowej (Web App Matrix)',
    '',
    '| Moduł Aplikacji | Trasa | Rola Użytkownika | Stan Danych i API / Baza | Komponenty UI | Przejście i Haptyka | Kryteria Odbioru |',
    '| :--- | :--- | :--- | :--- | :--- | :--- | :--- |'
  );

  for (const row of matrix.webAppMatrix) {
    lines.push(
      `| ${esc(row.moduleName)} | \`${esc(row.route)}\` | ${esc(row.userRole)} | ${esc(row.stateAndDataFlow)} | ${esc(row.uiComponents.join(', '))} | ${esc(row.transitionAndHaptics)} | ${esc(row.acceptanceCriteria)} |`
    );
  }

  lines.push(
    '',
    '---',
    '',
    `## 3. Plan Ekranów (${screenMap.nodes.length} widoków · ${screenMap.edges.length} przejść)`,
    '',
    '| ID | Ekran | Ścieżka | Rola | Komponenty | Przejście |',
    '| :--- | :--- | :--- | :--- | :--- | :--- |'
  );

  for (const node of screenMap.nodes) {
    lines.push(
      `| \`${esc(node.id)}\` | ${esc(node.title)} | \`${esc(node.route)}\` | ${esc(node.role)} | ${esc(node.components.join(', '))} | \`${esc(node.preferredTransition)}\` |`
    );
  }

  lines.push(
    '',
    '### Diagram Przepływu Nawigacji (Mermaid.js)',
    '',
    serializeScreenMapToMermaid(screenMap, {
      direction: 'LR',
      groupByRole: true,
      includeMetadataComments: false,
      wrapInMarkdown: true,
    }),
    '',
    '---',
    '',
    '## 4. Master-Prompt Budowy Strony i Aplikacji Internetowej',
    '',
    '```text',
    matrix.masterBuildPrompt,
    '```',
    ''
  );

  return lines.join('\n');
}

type MatrixTabId = 'website' | 'webapp' | 'screens' | 'master-prompt';

interface LoadedClientFileState {
  fileName: string;
  mimeType: string;
  fileSize: number;
  compressedKb?: number;
  rawFile?: File;
  base64Data?: string;
  textContent?: string;
  previewDataUrl?: string;
}

export const FileUploadBuildMatrixService: React.FC<{
  onOpenPlanner?: () => void;
  onOpenAllScreens?: () => void;
  onSelectScreenInPlanner?: (screenId: string) => void;
}> = ({ onOpenPlanner, onOpenAllScreens, onSelectScreenInPlanner }) => {
  const {
    palette,
    depth,
    synth,
    haptic,
    patterns,
    activeScreenMap,
    saveActiveScreenMap,
    activeBuildMatrix,
    savedBuildMatrices,
    generatePlanAndMatrixFromFile,
    generateFullFrontendFromUploadedFile,
    setLocalhostModalOpen,
    zeroLimitLocalMode,
    setZeroLimitLocalMode,
    selectSavedBuildMatrix,
    removeSavedBuildMatrix,
    pulseInteraction,
  } = useStudio();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loadedFile, setLoadedFile] = useState<LoadedClientFileState | null>(
    null
  );
  const [targetType, setTargetType] =
    useState<FileBuildTargetType>('website-and-webapp');
  const [projectGoal, setProjectGoal] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [savingMap, setSavingMap] = useState<boolean>(false);
  const [savedBanner, setSavedBanner] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeMatrixTab, setActiveMatrixTab] =
    useState<MatrixTabId>('website');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showTextExcerpt, setShowTextExcerpt] = useState<boolean>(false);

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

  const ingestBrowserFile = async (file: File) => {
    setErrorMsg(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setErrorMsg(
        `Plik "${file.name}" przekracza maksymalny rozmiar 15 MB. Wgraj mniejszy dokument PDF, obraz makiety lub plik tekstowy.`
      );
      return;
    }

    const mimeType = inferMimeTypeFromName(file.name, file.type);

    if (BINARY_INLINE_MIMES.has(mimeType)) {
      const rawDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () =>
          reject(new Error('Nie udało się odczytać pliku binarnego z dysku.'));
        reader.readAsDataURL(file);
      });

      let finalDataUrl = rawDataUrl;
      let finalMime = mimeType;
      let compressedKb: number | undefined;

      if (mimeType.startsWith('image/')) {
        try {
          const compressed = await compressImageDataUrlForApi(rawDataUrl, 1280, 0.82);
          finalDataUrl = compressed.dataUrl;
          finalMime = compressed.mimeType;
          compressedKb = compressed.compressedSizeKb;
        } catch {
          // Keep original dataUrl if canvas compression fails
        }
      }

      const base64Part = finalDataUrl.includes(',')
        ? finalDataUrl.split(',')[1] || ''
        : finalDataUrl;

      setLoadedFile({
        fileName: file.name,
        mimeType: finalMime,
        fileSize: file.size,
        compressedKb,
        rawFile: file,
        base64Data: base64Part,
        previewDataUrl: finalMime.startsWith('image/') ? finalDataUrl : undefined,
      });
    } else {
      const text = await file.text();
      if (!text.trim()) {
        setErrorMsg(
          `Plik "${file.name}" nie zawiera tekstu możliwego do odczytania.`
        );
        return;
      }
      setLoadedFile({
        fileName: file.name,
        mimeType,
        fileSize: file.size,
        rawFile: file,
        textContent: text,
      });
    }

    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.85);
  };

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const picked = e.target.files?.[0];
    if (picked) {
      await ingestBrowserFile(picked);
    }
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      await ingestBrowserFile(dropped);
    }
  };

  const handleLoadSampleStarter = (sample: SampleStarterFile) => {
    setErrorMsg(null);
    const sampleFile = new File([sample.content], sample.fileName, {
      type: sample.mimeType,
    });
    setLoadedFile({
      fileName: sample.fileName,
      mimeType: sample.mimeType,
      fileSize: sampleFile.size,
      rawFile: sampleFile,
      textContent: sample.content,
    });
    setTargetType(sample.targetType);
    setProjectGoal(sample.goalHint);
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.85);
  };

  const handleGenerateFromLoadedFile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loadedFile) {
      setErrorMsg(
        'Najpierw wybierz plik z dysku (PDF, PNG/JPG, Markdown, TXT, JSON, CSV, HTML) lub załaduj gotowy plik przykładowy poniżej.'
      );
      return;
    }

    setGenerating(true);
    setErrorMsg(null);
    setSavedBanner(false);

    try {
      const { buildMatrix } = loadedFile.rawFile
        ? await generateFullFrontendFromUploadedFile(loadedFile.rawFile, {
            projectGoal: projectGoal.trim() || undefined,
            targetType,
          })
        : await generatePlanAndMatrixFromFile({
            fileName: loadedFile.fileName,
            mimeType: loadedFile.mimeType,
            fileSize: loadedFile.fileSize,
            base64Data: loadedFile.base64Data,
            textContent: loadedFile.textContent,
            projectGoal: projectGoal.trim() || undefined,
            targetType,
          });

      if (
        buildMatrix.targetType === 'webapp-only' &&
        buildMatrix.webAppMatrix.length > 0
      ) {
        setActiveMatrixTab('webapp');
      } else {
        setActiveMatrixTab('website');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Wystąpił błąd podczas analizy pliku.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      hapticAudio.triggerPress(synth, haptic, patterns);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleExportMarkdownBundle = () => {
    if (!activeBuildMatrix) return;
    const slug = slugifyExportName(activeBuildMatrix.projectTitle);
    const md = serializeBuildPlanToMarkdown(activeBuildMatrix, activeScreenMap);
    downloadLocalArchitectureFile(
      md,
      `matryca-budowy-${slug}.md`,
      'text/markdown'
    );
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.95);
  };

  const handleExportJsonBundle = () => {
    if (!activeBuildMatrix) return;
    const slug = slugifyExportName(activeBuildMatrix.projectTitle);
    const jsonStr = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        buildMatrix: activeBuildMatrix,
        screenMap: activeScreenMap,
      },
      null,
      2
    );
    downloadLocalArchitectureFile(
      jsonStr,
      `matryca-i-ekrany-${slug}.json`,
      'application/json'
    );
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(0.95);
  };

  const handleSaveGeneratedMapToDb = async () => {
    setSavingMap(true);
    try {
      await saveActiveScreenMap(activeScreenMap.name);
      setSavedBanner(true);
      window.setTimeout(() => setSavedBanner(false), 2200);
    } finally {
      setSavingMap(false);
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredWebsiteRows = useMemo(() => {
    if (!activeBuildMatrix) return [];
    if (!normalizedQuery) return activeBuildMatrix.websiteMatrix;
    return activeBuildMatrix.websiteMatrix.filter((row) =>
      [
        row.sectionName,
        row.routeOrAnchor,
        row.gridLayout,
        row.keyComponents.join(' '),
        row.visualAndTactileSpec,
        row.conversionGoal,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [activeBuildMatrix, normalizedQuery]);

  const filteredWebAppRows = useMemo(() => {
    if (!activeBuildMatrix) return [];
    if (!normalizedQuery) return activeBuildMatrix.webAppMatrix;
    return activeBuildMatrix.webAppMatrix.filter((row) =>
      [
        row.moduleName,
        row.route,
        row.userRole,
        row.stateAndDataFlow,
        row.uiComponents.join(' '),
        row.transitionAndHaptics,
        row.acceptanceCriteria,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [activeBuildMatrix, normalizedQuery]);

  const filteredScreenNodes = useMemo(() => {
    if (!normalizedQuery) return activeScreenMap.nodes;
    return activeScreenMap.nodes.filter((n) =>
      [
        n.title,
        n.route,
        n.role,
        n.summary,
        n.components.join(' '),
        n.preferredTransition,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [activeScreenMap.nodes, normalizedQuery]);

  return (
    <section
      style={cardSurfaceStyle}
      className="p-6 border border-white/80 dark:border-emerald-400/20 space-y-6"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
            <span>Usługa Analizy Plików AI (Gemini 4 Hydrogen)</span>
            <span aria-hidden="true">·</span>
            <span>PDF · PNG/JPG/WebP · Markdown · TXT · JSON · CSV · HTML</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-emerald-50 mt-1">
            Wgraj Plik → Plan Ekranów i Gotowa Matryca Strony oraz Aplikacji Web
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-emerald-100/80 mt-1 max-w-3xl">
            Prześlij brief PDF, zrzut makiety UI, specyfikację Markdown, plik JSON lub arkusz CSV.
            Narzędzie AI automatycznie rozpisze kompletny graf ekranów DAG oraz tabelaryczną matrycę
            budowy strony internetowej i projektu aplikacji internetowej.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium bg-white/85 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 inline-flex items-center gap-2 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={zeroLimitLocalMode}
              onChange={(e) => {
                setZeroLimitLocalMode(e.target.checked);
                hapticAudio.triggerPress(synth, haptic, patterns);
              }}
              className="rounded accent-indigo-600 dark:accent-emerald-400"
            />
            <span>Zero-Limit (0 błędów 429)</span>
          </label>

          <button
            type="button"
            onClick={() => setLocalhostModalOpen(true)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 hover:opacity-95 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Server className="w-3.5 h-3.5" />
            <span>Host Localhost</span>
          </button>

          {savedBuildMatrices.length > 0 && (
            <>
              <select
                id="saved-file-matrices-select"
                aria-label="Wcześniejsze pliki"
                value={activeBuildMatrix?.id || ''}
                onChange={(e) => {
                  const chosen = savedBuildMatrices.find(
                    (m) => m.id === e.target.value
                  );
                  if (chosen) selectSavedBuildMatrix(chosen);
                }}
                className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs bg-white/85 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                {savedBuildMatrices.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fileName} — {m.projectTitle.slice(0, 34)}
                  </option>
                ))}
              </select>
              {activeBuildMatrix && (
                <button
                  type="button"
                  onClick={() => removeSavedBuildMatrix(activeBuildMatrix.id)}
                  title="Usuń wybraną matrycę z historii lokalnej"
                  className="min-h-[40px] px-2.5 py-2 rounded-xl text-xs bg-white/80 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/25 text-slate-600 dark:text-emerald-200 hover:text-rose-600 dark:hover:text-rose-300 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Upload & Configuration Split */}
      <form
        onSubmit={handleGenerateFromLoadedFile}
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch"
      >
        {/* Left 6 Cols: Drag & Drop File Zone */}
        <div className="lg:col-span-6 flex flex-col justify-between gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.md,.markdown,.txt,.json,.csv,.html,.htm,.tsx,.ts,.jsx,.yaml,.yml"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!dragActive) setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
            }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`flex-1 min-h-[188px] p-5 rounded-2xl border-2 border-dashed transition-colors flex flex-col items-center justify-center text-center gap-3 cursor-pointer ${
              dragActive
                ? 'border-indigo-500 bg-indigo-500/10 dark:border-emerald-300 dark:bg-emerald-900/40'
                : 'border-slate-300/90 dark:border-emerald-400/30 bg-white/65 dark:bg-emerald-950/50 hover:bg-white/90 dark:hover:bg-emerald-950/70'
            }`}
          >
            {loadedFile ? (
              <div className="w-full flex flex-col items-center gap-2.5">
                {loadedFile.previewDataUrl ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="w-28 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-emerald-400/25 bg-slate-100 dark:bg-emerald-950 flex items-center justify-center"
                  >
                    <img
                      src={loadedFile.previewDataUrl}
                      alt={`Podgląd wgranego pliku ${loadedFile.fileName}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-slate-900/5 dark:bg-emerald-400/10 flex items-center justify-center text-slate-700 dark:text-emerald-200">
                    <FileText className="w-5 h-5" />
                  </div>
                )}

                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-emerald-50 break-all">
                    {loadedFile.fileName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-emerald-300/80 font-mono tabular-nums mt-0.5">
                    {loadedFile.mimeType} ·{' '}
                    {Math.max(1, Math.round(loadedFile.fileSize / 1024))} KB
                    {loadedFile.compressedKb
                      ? ` → skompresowano do ${loadedFile.compressedKb} KB`
                      : ''}{' '}
                    · Gotowy do budowy frontendu
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                  <span className="text-xs underline text-indigo-600 dark:text-emerald-300">
                    Kliknij, aby podmienić plik
                  </span>
                  {loadedFile.textContent && (
                    <>
                      <span aria-hidden="true" className="text-xs text-slate-400">
                        ·
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTextExcerpt((prev) => !prev);
                        }}
                        className="text-xs underline text-slate-600 dark:text-emerald-200 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                      >
                        {showTextExcerpt ? 'Ukryj podgląd treści' : 'Podgląd treści pliku'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="w-11 h-11 rounded-xl bg-slate-900/5 dark:bg-emerald-400/10 flex items-center justify-center text-slate-700 dark:text-emerald-200">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
                    Upuść plik tutaj lub kliknij, aby wybrać z dysku
                  </div>
                  <p className="text-xs text-slate-500 dark:text-emerald-300/75 max-w-md">
                    Obsługiwane: dokumenty PDF, makiety i szkice UI (PNG, JPG, WebP) oraz
                    specyfikacje tekstowe (.md, .txt, .json, .csv, .html, .yaml — do 15 MB).
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Starter sample briefs for instant 1-click testing */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-emerald-300/80 mr-1">
              Szybki test na przykładzie:
            </span>
            {STARTER_SAMPLE_FILES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleLoadSampleStarter(sample)}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white/75 dark:bg-emerald-950/70 border border-slate-200/80 dark:border-emerald-400/20 text-slate-700 dark:text-emerald-100 hover:bg-white dark:hover:bg-emerald-900/70 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right 6 Cols: Scope, Instructions & Generate Trigger */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-white/60 dark:bg-emerald-950/45 border border-slate-200/80 dark:border-emerald-400/20 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-emerald-200">
                Zakres architektury i matrycy budowania
              </label>
              <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-emerald-950/85">
                {(
                  [
                    ['website-and-webapp', 'Strona WWW + Aplikacja'],
                    ['website-only', 'Głównie Strona WWW'],
                    ['webapp-only', 'Głównie Aplikacja Web'],
                  ] as [FileBuildTargetType, string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setTargetType(val);
                      hapticAudio.triggerPress(synth, haptic, patterns);
                    }}
                    className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      targetType === val
                        ? isDark
                          ? 'bg-emerald-400 text-emerald-950 shadow-sm'
                          : 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 dark:text-emerald-200/75 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="file-ai-project-goal"
                className="block text-xs font-medium text-slate-700 dark:text-emerald-200"
              >
                Dodatkowe wytyczne do planu i matrycy (opcjonalnie)
              </label>
              <textarea
                id="file-ai-project-goal"
                rows={3}
                value={projectGoal}
                onChange={(e) => setProjectGoal(e.target.value)}
                placeholder="Np. Uwzględnij rezerwację online, panel klienta z historią zamówień, eksport raportów oraz ciemny motyw..."
                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white/90 dark:bg-emerald-950/80 border border-slate-200/90 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 placeholder:text-slate-400 dark:placeholder:text-emerald-300/45 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70 dark:border-emerald-400/15">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-medium bg-white/85 dark:bg-emerald-950/80 border border-slate-200/80 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 hover:bg-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>Wybierz plik z dysku</span>
            </button>

            <button
              type="submit"
              disabled={generating}
              className="min-h-[42px] px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 hover:opacity-95 disabled:opacity-55 transition-opacity inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>
                {generating
                  ? 'Analizowanie pliku i budowanie matrycy AI...'
                  : 'Generuj plan ekranów i matrycę AI'}
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* Optional Loaded File Text Preview */}
      {showTextExcerpt && loadedFile?.textContent && (
        <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto max-h-48">
          <div className="text-[11px] text-slate-400 mb-1.5">
            Podgląd odczytanej treści z pliku {loadedFile.fileName} (pierwsze 1500 znaków):
          </div>
          <pre className="whitespace-pre-wrap break-words">
            {loadedFile.textContent.slice(0, 1500)}
            {loadedFile.textContent.length > 1500 ? '\n…' : ''}
          </pre>
        </div>
      )}

      {/* Error State */}
      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50/90 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-400/30 text-xs text-rose-800 dark:text-rose-200 flex flex-wrap items-center justify-between gap-3"
        >
          <span>{errorMsg}</span>
          {loadedFile && (
            <button
              type="button"
              onClick={() => handleGenerateFromLoadedFile()}
              className="min-h-[36px] px-3 py-1.5 rounded-lg font-medium bg-rose-700 text-white hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
            >
              Ponów analizę pliku
            </button>
          )}
        </div>
      )}

      {/* Loading Skeleton State */}
      {generating && (
        <div className="space-y-3 pt-2">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 font-mono">
            Trwa ekstrakcja struktury z pliku i synteza planu ekranów oraz matrycy budowy...
          </div>
          {[1, 2, 3, 4].map((row) => (
            <div
              key={row}
              className="h-11 rounded-xl bg-slate-200/70 dark:bg-emerald-900/40 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty State when no matrix generated yet */}
      {!generating && !activeBuildMatrix && (
        <div className="p-6 rounded-2xl bg-white/50 dark:bg-emerald-950/35 border border-slate-200/75 dark:border-emerald-400/15 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
              Brak wygenerowanej matrycy budowy z pliku
            </div>
            <p className="text-xs text-slate-600 dark:text-emerald-200/75">
              Wgraj własny plik dokumentacji lub makiety powyżej albo załaduj przykładową
              specyfikację jednym kliknięciem, aby otrzymać gotowy plan ekranów DAG, matrycę sekcji
              strony internetowej, matrycę modułów aplikacji oraz Master-Prompt wdrożeniowy.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleLoadSampleStarter(STARTER_SAMPLE_FILES[0])}
            className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
          >
            Załaduj przykładową specyfikację
          </button>
        </div>
      )}

      {/* Populated Result: Executive Summary, Quick Links, Matrix Tabs & Tables */}
      {!generating && activeBuildMatrix && (
        <div className="space-y-5 pt-3 border-t border-slate-200/75 dark:border-emerald-400/15">
          {/* Project Summary Header & Action Bar */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1 max-w-3xl">
              <div className="text-xs text-slate-500 dark:text-emerald-300/85 flex flex-wrap items-center gap-1.5 font-mono tabular-nums">
                <span>Plik: {activeBuildMatrix.fileName}</span>
                <span aria-hidden="true">·</span>
                <span>{activeBuildMatrix.fileSizeKb} KB</span>
                <span aria-hidden="true">·</span>
                <span>{activeBuildMatrix.websiteMatrix.length} sekcji WWW</span>
                <span aria-hidden="true">·</span>
                <span>{activeBuildMatrix.webAppMatrix.length} modułów aplikacji</span>
                <span aria-hidden="true">·</span>
                <span>{activeScreenMap.nodes.length} ekranów DAG</span>
                <span aria-hidden="true">·</span>
                <span>{activeBuildMatrix.generatedByModel}</span>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-emerald-50">
                {activeBuildMatrix.projectTitle}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-emerald-100/80">
                {activeBuildMatrix.executiveSummary}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setLocalhostModalOpen(true)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 dark:bg-emerald-500 text-white dark:text-emerald-950 hover:opacity-95 inline-flex items-center gap-1.5 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
              >
                <Server className="w-3.5 h-3.5" />
                <span>Prezentuj na Localhost:4173</span>
              </button>

              <button
                type="button"
                onClick={handleExportMarkdownBundle}
                className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 hover:opacity-95 inline-flex items-center gap-1.5 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Pobierz matrycę (.md)</span>
              </button>

              <button
                type="button"
                onClick={handleExportJsonBundle}
                className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium bg-white/85 dark:bg-emerald-950/80 border border-slate-200/80 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 hover:bg-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Pobierz pakiet (.json)</span>
              </button>

              <button
                type="button"
                onClick={handleSaveGeneratedMapToDb}
                disabled={savingMap}
                className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium bg-white/85 dark:bg-emerald-950/80 border border-slate-200/80 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 hover:bg-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {savedBanner ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                    <span>Zapisano plan</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingMap ? 'Zapisywanie...' : 'Zapisz plan ekranów'}</span>
                  </>
                )}
              </button>

              {onOpenPlanner && (
                <button
                  type="button"
                  onClick={onOpenPlanner}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium bg-white/85 dark:bg-emerald-950/80 border border-slate-200/80 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 hover:bg-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Otwórz na płótnie DAG</span>
                </button>
              )}

              {onOpenAllScreens && (
                <button
                  type="button"
                  onClick={onOpenAllScreens}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium bg-white/85 dark:bg-emerald-950/80 border border-slate-200/80 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 hover:bg-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Wyświetl wszystkie ekrany</span>
                </button>
              )}
            </div>
          </div>

          {/* Design Tokens Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 py-3 border-y border-slate-200/70 dark:border-emerald-400/15 text-xs">
            <div>
              <div className="text-slate-500 dark:text-emerald-300/75">
                Rekomendowana paleta (60-30-10)
              </div>
              <div className="font-medium text-slate-900 dark:text-emerald-50 mt-0.5">
                {activeBuildMatrix.designTokens.recommendedPalette}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-emerald-300/75">
                Hierarchia typografii
              </div>
              <div className="font-medium text-slate-900 dark:text-emerald-50 mt-0.5">
                {activeBuildMatrix.designTokens.typographyPairing}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-emerald-300/75">
                Architektura siatki i układu
              </div>
              <div className="font-medium text-slate-900 dark:text-emerald-50 mt-0.5">
                {activeBuildMatrix.designTokens.layoutArchitecture}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-emerald-300/75">
                Stos technologiczny i materiał
              </div>
              <div className="font-medium text-slate-900 dark:text-emerald-50 mt-0.5">
                {activeBuildMatrix.designTokens.stackRecommendation} ·{' '}
                {MATERIAL_PROFILES[activeBuildMatrix.designTokens.primaryHapticMaterial]
                  ?.label || activeBuildMatrix.designTokens.primaryHapticMaterial}
              </div>
            </div>
          </div>

          {/* Matrix Sub-Tabs + Search Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-emerald-950/85">
              {(
                [
                  [
                    'website',
                    `Matryca Strony WWW (${activeBuildMatrix.websiteMatrix.length})`,
                  ],
                  [
                    'webapp',
                    `Matryca Aplikacji Web (${activeBuildMatrix.webAppMatrix.length})`,
                  ],
                  [
                    'screens',
                    `Plan Ekranów (${activeScreenMap.nodes.length})`,
                  ],
                  ['master-prompt', 'Master-Prompt Budowy'],
                ] as [MatrixTabId, string][]
              ).map(([tabId, label]) => (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => {
                    setActiveMatrixTab(tabId);
                    hapticAudio.triggerPress(synth, haptic, patterns);
                  }}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeMatrixTab === tabId
                      ? isDark
                        ? 'bg-emerald-400 text-emerald-950 shadow-sm'
                        : 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-emerald-200/75 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeMatrixTab !== 'master-prompt' && (
              <div className="relative min-w-[240px] sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-emerald-300/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtruj sekcje, moduły, trasy..."
                  className="w-full min-h-[38px] pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white/85 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 placeholder:text-slate-400 dark:placeholder:text-emerald-300/45 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            )}
          </div>

          {/* TAB 1: Website Build Matrix */}
          {activeMatrixTab === 'website' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-emerald-400/20 bg-white/75 dark:bg-emerald-950/45">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-emerald-400/20 text-slate-500 dark:text-emerald-300/80 bg-slate-100/70 dark:bg-emerald-950/70">
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">
                      Sekcja Strony WWW
                    </th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">
                      Siatka i Układ (1440px)
                    </th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">
                      Komponenty Kluczowe
                    </th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">
                      Specyfikacja Wizualna i Dotykowa
                    </th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">
                      Cel Konwersji
                    </th>
                    <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">
                      Prompt Sekcji
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/65 dark:divide-emerald-400/15">
                  {filteredWebsiteRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 px-4 text-center text-slate-500 dark:text-emerald-200/70"
                      >
                        Brak sekcji strony pasujących do zapytania „{searchQuery}”.
                      </td>
                    </tr>
                  ) : (
                    filteredWebsiteRows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-white/90 dark:hover:bg-emerald-900/35 transition-colors align-top"
                      >
                        <td className="py-3 px-4 min-w-[190px]">
                          <div className="font-semibold text-slate-900 dark:text-emerald-50">
                            {row.sectionName}
                          </div>
                          <div className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-emerald-300/75 mt-0.5">
                            {row.routeOrAnchor}
                          </div>
                        </td>
                        <td className="py-3 px-4 min-w-[190px] text-slate-700 dark:text-emerald-100/90">
                          {row.gridLayout}
                        </td>
                        <td className="py-3 px-4 min-w-[200px] text-slate-700 dark:text-emerald-100/90">
                          {row.keyComponents.join(' · ')}
                        </td>
                        <td className="py-3 px-4 min-w-[210px] text-slate-600 dark:text-emerald-200/80">
                          {row.visualAndTactileSpec}
                        </td>
                        <td className="py-3 px-4 min-w-[190px] text-slate-600 dark:text-emerald-200/80">
                          {row.conversionGoal}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                row.id,
                                row.buildPrompt ||
                                  `${row.sectionName} (${row.routeOrAnchor}): ${row.gridLayout}. Komponenty: ${row.keyComponents.join(', ')}. Cel: ${row.conversionGoal}`
                              )
                            }
                            className="min-h-[34px] px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900/5 dark:bg-emerald-400/10 hover:bg-slate-900/10 dark:hover:bg-emerald-400/20 text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            {copiedId === row.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                                <span>Skopiowano</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Kopiuj prompt</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: Web Application Build Matrix */}
          {activeMatrixTab === 'webapp' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-emerald-400/20 bg-white/75 dark:bg-emerald-950/45">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-emerald-400/20 text-slate-500 dark:text-emerald-300/80 bg-slate-100/70 dark:bg-emerald-950/70">
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">
                      Moduł Aplikacji i Trasa
                    </th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">
                      Rola Użytkownika
                    </th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">
                      Stan Danych i API / Baza
                    </th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">
                      Komponenty UI
                    </th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">
                      Przejście i Haptyka
                    </th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">
                      Kryteria Gotowości Produkcyjnej
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/65 dark:divide-emerald-400/15">
                  {filteredWebAppRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 px-4 text-center text-slate-500 dark:text-emerald-200/70"
                      >
                        Brak modułów aplikacji pasujących do zapytania „{searchQuery}”.
                      </td>
                    </tr>
                  ) : (
                    filteredWebAppRows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-white/90 dark:hover:bg-emerald-900/35 transition-colors align-top"
                      >
                        <td className="py-3 px-4 min-w-[190px]">
                          <div className="font-semibold text-slate-900 dark:text-emerald-50">
                            {row.moduleName}
                          </div>
                          <div className="font-mono tabular-nums text-[11px] text-indigo-600 dark:text-emerald-300 mt-0.5">
                            {row.route}
                          </div>
                        </td>
                        <td className="py-3 px-4 min-w-[140px] text-slate-700 dark:text-emerald-100/90">
                          {row.userRole}
                        </td>
                        <td className="py-3 px-4 min-w-[220px] text-slate-700 dark:text-emerald-100/90">
                          {row.stateAndDataFlow}
                        </td>
                        <td className="py-3 px-4 min-w-[190px] text-slate-600 dark:text-emerald-200/85">
                          {row.uiComponents.join(' · ')}
                        </td>
                        <td className="py-3 px-4 min-w-[170px] font-mono text-[11px] text-slate-600 dark:text-emerald-200/80">
                          {row.transitionAndHaptics}
                        </td>
                        <td className="py-3 px-4 min-w-[210px] text-slate-600 dark:text-emerald-200/80">
                          {row.acceptanceCriteria}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: Synchronized Screen Plan Table */}
          {activeMatrixTab === 'screens' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-emerald-400/20 bg-white/75 dark:bg-emerald-950/45">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-emerald-400/20 text-slate-500 dark:text-emerald-300/80 bg-slate-100/70 dark:bg-emerald-950/70">
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">
                       # · Ekran i Ścieżka
                    </th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">
                      Rola · Status
                    </th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">
                      Zakres funkcjonalny ekranu
                    </th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">
                      Komponenty i Materiał
                    </th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">
                      Animacja przejścia
                    </th>
                    {onSelectScreenInPlanner && (
                      <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">
                        Planer DAG
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/65 dark:divide-emerald-400/15">
                  {filteredScreenNodes.map((node, index) => {
                    const transName = (
                      SCREEN_TRANSITION_PRESETS.find(
                        (t) => t.id === node.preferredTransition
                      )?.name || node.preferredTransition
                    ).replace(/^\d+\.\s*/, '');
                    return (
                      <tr
                        key={node.id}
                        className="hover:bg-white/90 dark:hover:bg-emerald-900/35 transition-colors align-top"
                      >
                        <td className="py-3 px-4 min-w-[190px]">
                          <div className="font-semibold text-slate-900 dark:text-emerald-50">
                            <span className="font-mono tabular-nums text-slate-400 dark:text-emerald-300/60 mr-1.5">
                              {String(index + 1).padStart(2, '0')}.
                            </span>
                            {node.title}
                          </div>
                          <div className="font-mono tabular-nums text-[11px] text-indigo-600 dark:text-emerald-300 mt-0.5">
                            {node.route}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-emerald-200/85 font-mono">
                          {node.role} · {node.status}
                        </td>
                        <td className="py-3 px-4 min-w-[230px] text-slate-700 dark:text-emerald-100/90">
                          {node.summary}
                        </td>
                        <td className="py-3 px-4 min-w-[200px] text-slate-600 dark:text-emerald-200/80">
                          <div>{node.components.join(' · ')}</div>
                          <div className="text-[11px] text-slate-400 dark:text-emerald-300/60 mt-0.5">
                            Materiał:{' '}
                            {MATERIAL_PROFILES[node.hapticMaterial]?.label ||
                              node.hapticMaterial}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-emerald-100/90">
                          {transName}
                        </td>
                        {onSelectScreenInPlanner && (
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onSelectScreenInPlanner(node.id)}
                              className="min-h-[34px] px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900/5 dark:bg-emerald-400/10 hover:bg-slate-900/10 dark:hover:bg-emerald-400/20 text-slate-800 dark:text-emerald-100 inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <span>Wskaż węzeł</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: Master Build Prompt */}
          {activeMatrixTab === 'master-prompt' && (
            <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-emerald-400/20 bg-white/80 dark:bg-emerald-950/55 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
                    Gotowy Master-Prompt do budowy strony internetowej i aplikacji internetowej
                  </div>
                  <div className="text-xs text-slate-500 dark:text-emerald-300/75">
                    Skopiuj poniższą specyfikację architektoniczną, aby natychmiast rozpocząć implementację pełnego stosu.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(
                      'master-build-prompt',
                      activeBuildMatrix.masterBuildPrompt
                    )
                  }
                  className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 hover:opacity-95 inline-flex items-center gap-1.5 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedId === 'master-build-prompt' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Skopiowano Master-Prompt</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Kopiuj Master-Prompt</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed max-h-80 overflow-y-auto">
                {activeBuildMatrix.masterBuildPrompt}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
