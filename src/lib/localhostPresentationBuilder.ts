import {
  AppScreenMapProject,
  DepthShadowSettings,
  EngravingBacklightSettings,
  GeneratedCompleteElement,
  GeneratedRepoFileEntry,
  HapticSettings,
  MATERIAL_PROFILES,
  MINIMALIST_LOW_CLICK_VARIANTS,
  PaletteMode,
  SynthPatchSettings,
  UploadedFileBuildPlan,
  WorkingFrontendImageState,
} from '../types/studio';
import {
  buildCompleteFrontendRepositoryFiles,
  buildZipArchiveBlob,
} from './githubRepoExporter';
import { writeArbitraryFilesToLocalDisk } from './localDiskWorkspace';
import { slugifyExportName } from './screenMapExport';
import { resolvePrototypeWidgetsForNode } from './tactileUiCatalog';

export interface LocalhostPresentationBuildInput {
  projectName: string;
  screenMap: AppScreenMapProject;
  generatedElements: GeneratedCompleteElement[];
  activeBuildMatrix: UploadedFileBuildPlan | null;
  workingImage: WorkingFrontendImageState | null;
  palette: PaletteMode;
  depth: DepthShadowSettings;
  engraving: EngravingBacklightSettings;
  synth: SynthPatchSettings;
  haptic: HapticSettings;
  defaultPort?: number;
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildInteractivePresentationHtml(
  input: LocalhostPresentationBuildInput,
  initialScreenId?: string
): string {
  const safeTitle = input.projectName || input.screenMap.name || 'Prezentacja Frontendu';
  const isDefaultDark = input.palette === 'emerald-clinic';
  const matProfile =
    MATERIAL_PROFILES[input.haptic.material] || MATERIAL_PROFILES['frosted-glass'];

  const activeClickSpec =
    (input.haptic.minimalistClickVariant &&
      input.haptic.minimalistClickVariant !== 'none' &&
      MINIMALIST_LOW_CLICK_VARIANTS.find(
        (v) => v.id === input.haptic.minimalistClickVariant
      )) ||
    MINIMALIST_LOW_CLICK_VARIANTS[0];

  const serializedScreens = input.screenMap.nodes.map((node) => {
    const widgets = resolvePrototypeWidgetsForNode(node);
    const elements = input.generatedElements
      .filter((el) => el.targetScreenId === node.id)
      .map((el) => ({
        id: el.id,
        name: el.name,
        targetZone: el.targetZone,
        categoryLabel: el.categoryLabel,
        headline: el.headline,
        subheadline: el.subheadline,
        summary: el.summary,
        accentHex: el.accentHex,
        controls: el.controls,
      }));
    return {
      id: node.id,
      title: node.title,
      route: node.route,
      role: node.role,
      summary: node.summary,
      widgets,
      elements,
    };
  });

  const payloadJson = JSON.stringify({
    projectName: safeTitle,
    description:
      input.activeBuildMatrix?.executiveSummary ||
      input.screenMap.description ||
      'Interaktywna makieta prezentacyjna wygenerowanego frontendu.',
    initialScreenId: initialScreenId || serializedScreens[0]?.id || '',
    defaultDark: isDefaultDark,
    borderRadius: Math.max(14, Math.min(28, input.depth.borderRadius)),
    glowColor: input.engraving.glowColor || '#6366F1',
    materialLabel: matProfile.label,
    clickFreqHz: Math.min(156, activeClickSpec.fundamentalHz || input.synth.baseFrequency || 68),
    clickDurationMs: activeClickSpec.durationMs || 8,
    clickPitchDrop: Number(
      (
        (activeClickSpec.pitchDropHz || 38) /
        Math.max(1, activeClickSpec.fundamentalHz || 68)
      ).toFixed(2)
    ),
    screens: serializedScreens,
    edges: input.screenMap.edges,
    websiteMatrix: input.activeBuildMatrix?.websiteMatrix || [],
    webAppMatrix: input.activeBuildMatrix?.webAppMatrix || [],
    referenceImageDataUrl: input.workingImage?.dataUrl || null,
    referenceImageName: input.workingImage?.fileName || null,
  }).replace(/<\//g, '<\\/');

  return `<!doctype html>
<html lang="pl" class="${isDefaultDark ? 'dark' : ''}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(safeTitle)} — Host Prezentacji Frontendu</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg-canvas: #F6F8FC;
      --bg-surface: rgba(255, 255, 255, 0.88);
      --bg-elevated: #FFFFFF;
      --bg-subtle: #EEF2F9;
      --text-primary: #0F172A;
      --text-secondary: #475569;
      --text-muted: #64748B;
      --border-hairline: rgba(15, 23, 42, 0.09);
      --accent: #4F46E5;
      --accent-fg: #FFFFFF;
      --glow-rgb: 99, 102, 241;
      --radius-card: ${Math.max(14, Math.min(26, input.depth.borderRadius))}px;
    }
    html.dark {
      --bg-canvas: #071613;
      --bg-surface: rgba(11, 33, 28, 0.86);
      --bg-elevated: #0E2B24;
      --bg-subtle: #0A201B;
      --text-primary: #ECFDF5;
      --text-secondary: #A7F3D0;
      --text-muted: #6EE7B7;
      --border-hairline: rgba(52, 211, 153, 0.18);
      --accent: #34D399;
      --accent-fg: #042F2E;
      --glow-rgb: 52, 211, 153;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-canvas);
      color: var(--text-primary);
      min-height: 100vh;
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
      transition: background-color 180ms ease, color 180ms ease;
    }
    .mono {
      font-family: 'JetBrains Mono', monospace;
      font-variant-numeric: tabular-nums;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 30;
      backdrop-filter: blur(18px);
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-hairline);
    }
    .topbar-inner {
      max-width: 1360px;
      margin: 0 auto;
      padding: 0 24px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }
    .brand {
      font-weight: 700;
      font-size: 17px;
      letter-spacing: -0.02em;
      white-space: nowrap;
      flex-shrink: 0;
      cursor: pointer;
      background: none;
      border: none;
      color: var(--text-primary);
      font-family: inherit;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 20px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .nav-links::-webkit-scrollbar { display: none; }
    .nav-btn {
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      padding: 6px 2px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      white-space: nowrap;
      cursor: pointer;
      transition: color 140ms ease, border-color 140ms ease;
    }
    .nav-btn:hover { color: var(--text-primary); }
    .nav-btn.active {
      color: var(--text-primary);
      border-bottom-color: var(--accent);
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .btn-ghost {
      min-height: 38px;
      padding: 0 12px;
      border-radius: 11px;
      border: 1px solid var(--border-hairline);
      background: var(--bg-elevated);
      color: var(--text-primary);
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      transition: transform 140ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 160ms ease;
    }
    .btn-ghost:active, .btn-primary:active { transform: scale(0.975); }
    .btn-primary {
      position: relative;
      overflow: hidden;
      min-height: 40px;
      padding: 0 18px;
      border-radius: 12px;
      border: 1px solid transparent;
      background: var(--accent);
      color: var(--accent-fg);
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      transition: transform 140ms cubic-bezier(0.16, 1, 0.3, 1), opacity 140ms ease, box-shadow 180ms ease;
      box-shadow: 0 10px 26px -10px rgba(var(--glow-rgb), 0.55);
    }
    .btn-primary:hover { opacity: 0.95; }
    .shell {
      max-width: 1360px;
      margin: 0 auto;
      padding: 32px 24px 64px;
      display: flex;
      flex-direction: column;
      gap: 28px;
    }
    .optical-card {
      --lx: 50%;
      --ly: 0%;
      position: relative;
      overflow: hidden;
      border-radius: var(--radius-card);
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      padding: 24px;
      backdrop-filter: blur(16px);
      transition: border-color 180ms ease, box-shadow 200ms ease, transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .optical-card::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0;
      transition: opacity 200ms ease;
      background:
        radial-gradient(240px circle at var(--lx) var(--ly), rgba(var(--glow-rgb), 0.16), transparent 72%),
        radial-gradient(120px 2px at var(--lx) 0%, rgba(255,255,255,0.85), transparent 100%);
    }
    .optical-card:hover::before { opacity: 1; }
    .optical-card:hover {
      border-color: rgba(var(--glow-rgb), 0.42);
      box-shadow: 0 18px 40px -22px rgba(var(--glow-rgb), 0.32);
    }
    .hero-split {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
      align-items: stretch;
    }
    @media (min-width: 960px) {
      .hero-split.has-media { grid-template-columns: 7fr 5fr; }
    }
    .kicker {
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    h1 {
      font-size: clamp(1.75rem, 3vw, 2.5rem);
      line-height: 1.15;
      letter-spacing: -0.025em;
      text-wrap: balance;
      margin-bottom: 12px;
    }
    .lead {
      font-size: 15px;
      color: var(--text-secondary);
      max-width: 66ch;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
      gap: 18px;
    }
    .grid-controls {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .control-box {
      padding: 12px 14px;
      border-radius: 14px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-hairline);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .control-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
      font-weight: 600;
    }
    input[type="range"] {
      width: 100%;
      accent-color: var(--accent);
      cursor: pointer;
    }
    .matrix-table-wrap {
      overflow-x: auto;
      border-radius: 16px;
      border: 1px solid var(--border-hairline);
      background: var(--bg-elevated);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }
    th, td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-hairline);
      vertical-align: top;
    }
    th {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      background: var(--bg-subtle);
      white-space: nowrap;
    }
    tr:last-child td { border-bottom: none; }
    .ref-preview {
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid var(--border-hairline);
      background: #0B1320;
      display: flex;
      align-items: center;
      justify-content: center;
      max-height: 320px;
    }
    .ref-preview img {
      width: 100%;
      height: 100%;
      max-height: 320px;
      object-fit: cover;
      display: block;
    }
    .flow-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      padding-top: 16px;
      border-top: 1px solid var(--border-hairline);
      margin-top: 18px;
    }
    footer {
      max-width: 1360px;
      margin: 0 auto;
      padding: 24px;
      border-top: 1px solid var(--border-hairline);
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 12px;
      font-size: 12px;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <button type="button" class="brand" id="brandHomeBtn"></button>
      <nav class="nav-links" id="screenNav"></nav>
      <div class="actions">
        <button type="button" class="btn-ghost mono" id="soundToggleBtn" title="Krótkie niskie kliknięcie akustyczne (<160 Hz)">Klik: Wł.</button>
        <button type="button" class="btn-ghost" id="themeToggleBtn">Motyw</button>
      </div>
    </div>
  </header>

  <main class="shell" id="appRoot"></main>

  <footer>
    <span id="footerTitle"></span>
    <span class="mono" id="footerMeta"></span>
  </footer>

  <script id="aether-presentation-data" type="application/json">${payloadJson}</script>
  <script>
    (function() {
      const dataEl = document.getElementById('aether-presentation-data');
      const STATE = JSON.parse(dataEl ? dataEl.textContent : '{}');
      let activeScreenId = STATE.initialScreenId || (STATE.screens[0] && STATE.screens[0].id) || '';
      let soundEnabled = true;
      let audioCtx = null;
      const widgetValues = {};
      const toggleValues = {};

      function playMinimalLowClick(scale) {
        if (!soundEnabled) return;
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          if (!audioCtx) audioCtx = new Ctx();
          if (audioCtx.state === 'suspended') audioCtx.resume();

          const now = audioCtx.currentTime;
          const durSec = Math.max(0.004, Math.min(0.018, (STATE.clickDurationMs || 8) / 1000));
          const freq = Math.max(38, Math.min(156, STATE.clickFreqHz || 68));
          const endFreq = Math.max(28, freq * (STATE.clickPitchDrop || 0.58));

          const lp = audioCtx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(152, now);
          lp.Q.setValueAtTime(0.7, now);
          lp.connect(audioCtx.destination);

          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.exponentialRampToValueAtTime(endFreq, now + durSec);

          const amp = 0.24 * (scale || 1);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(amp, now + 0.0012);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + durSec + 0.004);

          osc.connect(gain);
          gain.connect(lp);
          osc.start(now);
          osc.stop(now + durSec + 0.006);
        } catch (e) {}
      }

      function attachOpticalTracking(root) {
        const cards = root.querySelectorAll('.optical-card');
        cards.forEach(function(card) {
          card.addEventListener('pointermove', function(ev) {
            const rect = card.getBoundingClientRect();
            const x = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 100;
            const y = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * 100;
            card.style.setProperty('--lx', x.toFixed(1) + '%');
            card.style.setProperty('--ly', y.toFixed(1) + '%');
          });
        });
      }

      function esc(str) {
        return String(str || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      function renderElementCard(el) {
        const controlsHtml = (el.controls || []).map(function(ctrl) {
          if (ctrl.kind === 'primary-cta') {
            return '<button type="button" class="btn-primary js-tactile" style="grid-column: 1 / -1;">' +
              '<span>' + esc(ctrl.label) + '</span><span aria-hidden="true">&rarr;</span></button>';
          }
          if (ctrl.kind === 'slider') {
            const val = widgetValues[ctrl.id] != null ? widgetValues[ctrl.id] : 72;
            return '<div class="control-box">' +
              '<div class="control-row"><span>' + esc(ctrl.label) + '</span><span class="mono" id="lbl_' + esc(ctrl.id) + '">' + val + '%</span></div>' +
              '<input type="range" min="0" max="100" value="' + val + '" data-slider-id="' + esc(ctrl.id) + '" />' +
              '</div>';
          }
          if (ctrl.kind === 'toggle') {
            const on = toggleValues[ctrl.id] != null ? toggleValues[ctrl.id] : true;
            return '<button type="button" class="control-box js-toggle" data-toggle-id="' + esc(ctrl.id) + '" style="cursor:pointer;text-align:left;">' +
              '<div class="control-row"><span>' + esc(ctrl.label) + '</span>' +
              '<span class="mono">' + (on ? 'Wł.' : 'Wył.') + '</span></div></button>';
          }
          if (ctrl.kind === 'metric-tile') {
            return '<div class="control-box"><div class="control-row">' +
              '<span style="color:var(--text-muted);font-weight:500;">' + esc(ctrl.label) + '</span>' +
              '<span class="mono">' + esc(ctrl.valueText || '100%') + '</span></div></div>';
          }
          return '<button type="button" class="btn-ghost js-tactile">' + esc(ctrl.label) + '</button>';
        }).join('');

        return '<section class="optical-card">' +
          '<div class="kicker"><span>' + esc(el.categoryLabel || 'Moduł UI') + '</span><span>&middot;</span><span class="mono">' + esc(el.targetZone) + '</span></div>' +
          '<h2 style="font-size:20px;margin-bottom:6px;">' + esc(el.headline || el.name) + '</h2>' +
          (el.subheadline ? '<p class="lead" style="font-size:13.5px;">' + esc(el.subheadline) + '</p>' : '') +
          '<div class="grid-controls">' + controlsHtml + '</div>' +
          '</section>';
      }

      function renderWidgetItem(w) {
        if (w.category === 'sliders') {
          const v = widgetValues[w.instanceId] != null ? widgetValues[w.instanceId] : 64;
          return '<div class="control-box">' +
            '<div class="control-row"><span>' + esc(w.label) + '</span><span class="mono" id="lbl_' + esc(w.instanceId) + '">' + v + '%</span></div>' +
            '<input type="range" min="0" max="100" value="' + v + '" data-slider-id="' + esc(w.instanceId) + '" />' +
            '</div>';
        }
        if (w.category === 'levers') {
          const on = toggleValues[w.instanceId] != null ? toggleValues[w.instanceId] : true;
          return '<button type="button" class="control-box js-toggle" data-toggle-id="' + esc(w.instanceId) + '" style="cursor:pointer;text-align:left;">' +
            '<div class="control-row"><span>' + esc(w.label) + '</span><span class="mono">' + (on ? 'Aktywny' : 'Spoczynek') + '</span></div>' +
            '</button>';
        }
        if (w.catalogId === 'btn-primary-cta') {
          return '<button type="button" class="btn-primary js-tactile"><span>' + esc(w.label) + '</span><span aria-hidden="true">&rarr;</span></button>';
        }
        return '<button type="button" class="btn-ghost js-tactile" style="justify-content:space-between;display:inline-flex;align-items:center;width:100%;">' +
          '<span>' + esc(w.label) + '</span><span class="mono" style="font-size:11px;opacity:0.7;">&rarr;</span></button>';
      }

      function renderApp() {
        const brandBtn = document.getElementById('brandHomeBtn');
        if (brandBtn) brandBtn.textContent = STATE.projectName || 'Frontend Host';

        const navEl = document.getElementById('screenNav');
        if (navEl) {
          navEl.innerHTML = (STATE.screens || []).map(function(scr) {
            const cls = scr.id === activeScreenId ? 'nav-btn active' : 'nav-btn';
            return '<button type="button" class="' + cls + '" data-screen-id="' + esc(scr.id) + '">' + esc(scr.title) + '</button>';
          }).join('');
          navEl.querySelectorAll('[data-screen-id]').forEach(function(btn) {
            btn.addEventListener('click', function() {
              activeScreenId = btn.getAttribute('data-screen-id');
              playMinimalLowClick(1);
              renderApp();
            });
          });
        }

        const scr = (STATE.screens || []).find(function(s) { return s.id === activeScreenId; }) || STATE.screens[0];
        const root = document.getElementById('appRoot');
        if (!root || !scr) return;

        const outgoing = (STATE.edges || []).filter(function(e) { return e.from === scr.id; });
        const outgoingButtons = outgoing.map(function(edge) {
          const target = (STATE.screens || []).find(function(s) { return s.id === edge.to; });
          if (!target) return '';
          return '<button type="button" class="btn-ghost js-goto-screen" data-goto="' + esc(target.id) + '">' +
            esc(edge.triggerLabel || ('Przejdź: ' + target.title)) + ' &rarr;</button>';
        }).join('');

        const hasRefMedia = Boolean(STATE.referenceImageDataUrl);
        const heroHtml = '<section class="optical-card hero-split ' + (hasRefMedia ? 'has-media' : '') + '">' +
          '<div style="display:flex;flex-direction:column;justify-content:space-between;gap:18px;">' +
            '<div>' +
              '<div class="kicker"><span class="mono">' + esc(scr.route) + '</span><span>&middot;</span><span>Rola: ' + esc(scr.role) + '</span><span>&middot;</span><span class="mono">' + esc(STATE.materialLabel) + ' &middot; ' + STATE.clickFreqHz + ' Hz</span></div>' +
              '<h1>' + esc(scr.title) + '</h1>' +
              '<p class="lead">' + esc(scr.summary || STATE.description) + '</p>' +
            '</div>' +
            (outgoingButtons ? '<div class="flow-bar"><span style="font-size:12px;color:var(--text-muted);">Przepływy nawigacji:</span>' + outgoingButtons + '</div>' : '') +
          '</div>' +
          (hasRefMedia ? '<div class="ref-preview"><img src="' + STATE.referenceImageDataUrl + '" alt="' + esc(STATE.referenceImageName || 'Makieta frontendu') + '" /></div>' : '') +
          '</section>';

        const elementsHtml = (scr.elements || []).length > 0
          ? '<div class="grid-2">' + scr.elements.map(renderElementCard).join('') + '</div>'
          : '';

        const widgetsHtml = (scr.widgets || []).length > 0
          ? '<section class="optical-card">' +
              '<div class="kicker"><span>Interaktywne Komponenty Widoku</span><span>&middot;</span><span class="mono">' + scr.widgets.length + ' elementów</span></div>' +
              '<h2 style="font-size:18px;margin-bottom:4px;">Warstwa Sterowania i Akcji Użytkownika</h2>' +
              '<div class="grid-controls">' + scr.widgets.map(renderWidgetItem).join('') + '</div>' +
            '</section>'
          : '';

        let matrixHtml = '';
        if ((STATE.websiteMatrix || []).length > 0) {
          const rows = STATE.websiteMatrix.slice(0, 6).map(function(r) {
            return '<tr>' +
              '<td style="font-weight:600;">' + esc(r.sectionName) + '</td>' +
              '<td class="mono" style="font-size:12px;">' + esc(r.routeOrAnchor) + '</td>' +
              '<td>' + esc(r.gridLayout) + '</td>' +
              '<td>' + esc((r.keyComponents || []).join(', ')) + '</td>' +
              '<td>' + esc(r.conversionGoal) + '</td>' +
              '</tr>';
          }).join('');
          matrixHtml = '<section class="optical-card" style="padding:20px;">' +
            '<div class="kicker"><span>Specyfikacja Sekcji Projektu</span><span>&middot;</span><span class="mono">' + STATE.websiteMatrix.length + ' sekcji</span></div>' +
            '<h2 style="font-size:18px;margin-bottom:14px;">Struktura Funkcjonalna Frontendu</h2>' +
            '<div class="matrix-table-wrap"><table><thead><tr><th>Sekcja</th><th>Ścieżka</th><th>Układ Siatki</th><th>Komponenty</th><th>Cel Użytkowy</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '</section>';
        }

        root.innerHTML = heroHtml + elementsHtml + widgetsHtml + matrixHtml;

        root.querySelectorAll('.js-tactile').forEach(function(btn) {
          btn.addEventListener('click', function() { playMinimalLowClick(1); });
        });
        root.querySelectorAll('.js-goto-screen').forEach(function(btn) {
          btn.addEventListener('click', function() {
            const targetId = btn.getAttribute('data-goto');
            if (targetId) {
              activeScreenId = targetId;
              playMinimalLowClick(1.1);
              renderApp();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          });
        });
        root.querySelectorAll('[data-slider-id]').forEach(function(inp) {
          inp.addEventListener('input', function() {
            const id = inp.getAttribute('data-slider-id');
            widgetValues[id] = Number(inp.value);
            const lbl = document.getElementById('lbl_' + id);
            if (lbl) lbl.textContent = inp.value + '%';
            playMinimalLowClick(0.45);
          });
        });
        root.querySelectorAll('.js-toggle').forEach(function(btn) {
          btn.addEventListener('click', function() {
            const id = btn.getAttribute('data-toggle-id');
            const cur = toggleValues[id] != null ? toggleValues[id] : true;
            toggleValues[id] = !cur;
            playMinimalLowClick(0.9);
            renderApp();
          });
        });

        attachOpticalTracking(root);

        const footerTitle = document.getElementById('footerTitle');
        const footerMeta = document.getElementById('footerMeta');
        if (footerTitle) footerTitle.textContent = STATE.projectName + ' — Lokalna Prezentacja Frontendu';
        if (footerMeta) footerMeta.textContent = 'Ekran: ' + scr.route + ' · Widoków: ' + (STATE.screens || []).length + ' · Klik: ' + STATE.clickFreqHz + ' Hz / ' + STATE.clickDurationMs + ' ms';
      }

      document.getElementById('brandHomeBtn').addEventListener('click', function() {
        if (STATE.screens && STATE.screens[0]) {
          activeScreenId = STATE.screens[0].id;
          playMinimalLowClick(1);
          renderApp();
        }
      });

      document.getElementById('themeToggleBtn').addEventListener('click', function() {
        document.documentElement.classList.toggle('dark');
        playMinimalLowClick(0.95);
      });

      const soundBtn = document.getElementById('soundToggleBtn');
      soundBtn.addEventListener('click', function() {
        soundEnabled = !soundEnabled;
        soundBtn.textContent = soundEnabled ? 'Klik: Wł.' : 'Klik: Wył.';
        if (soundEnabled) playMinimalLowClick(1);
      });

      renderApp();
    })();
  </script>
</body>
</html>`;
}

export function buildZeroDepNodeServerScript(defaultPort = 4173, projectTitle = 'Aether Frontend Host'): string {
  return `#!/usr/bin/env node
/**
 * Zero-dependency Localhost Presentation Server (${projectTitle})
 * Uruchomienie bez instalacji pakietów:
 *   node start-localhost.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const BASE_PORT = Number(process.env.PORT) || ${defaultPort};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const reqUrl = (req.url || '/').split('?')[0];
  const safeRel = path.normalize(decodeURIComponent(reqUrl)).replace(/^(\\.\\.[/\\\\])+/, '');
  let targetPath = path.join(DIST_DIR, safeRel === '/' ? 'index.html' : safeRel);

  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
    targetPath = path.join(DIST_DIR, 'index.html');
  }

  try {
    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(targetPath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Błąd odczytu pliku prezentacji dist/index.html.');
  }
});

function listenWithFallback(port, maxAttempts = 12) {
  server.once('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && maxAttempts > 0) {
      listenWithFallback(port + 1, maxAttempts - 1);
    } else {
      console.error('Nie udało się uruchomić serwera localhost:', err);
      process.exit(1);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    const url = \`http://localhost:\${port}\`;
    console.log('');
    console.log('============================================================');
    console.log('  HOST PREZENTACJI FRONTENDÓW — GOTOWY NA LOCALHOST');
    console.log(\`  Projekt: \${${JSON.stringify(projectTitle)}}\`);
    console.log(\`  Adres lokalny: \${url}\`);
    console.log('  Tryb: Zero-Install (serwuje gotowy dist/index.html)');
    console.log('  Naciśnij Ctrl+C, aby zatrzymać serwer.');
    console.log('============================================================');
    console.log('');

    if (process.argv.includes('--open')) {
      const cmd =
        process.platform === 'win32'
          ? \`start "" "\${url}"\`
          : process.platform === 'darwin'
            ? \`open "\${url}"\`
            : \`xdg-open "\${url}"\`;
      exec(cmd, () => {});
    }
  });
}

listenWithFallback(BASE_PORT);
`;
}

export function buildLocalhostServerBundleFiles(
  input: LocalhostPresentationBuildInput
): GeneratedRepoFileEntry[] {
  const port = input.defaultPort || 4173;
  const projectTitle = input.projectName || input.screenMap.name || 'Aether Frontend App';
  const slug = slugifyExportName(projectTitle);

  const repoFiles = buildCompleteFrontendRepositoryFiles({
    repoName: slug,
    repoDescription:
      input.activeBuildMatrix?.executiveSummary || input.screenMap.description,
    screenMap: input.screenMap,
    generatedElements: input.generatedElements,
    attachedGraphics: [],
    masterPromptText: input.activeBuildMatrix?.masterBuildPrompt || '',
    palette: input.palette,
    depth: input.depth,
    engraving: input.engraving,
    synth: input.synth,
    haptic: input.haptic,
    activeBuildMatrix: input.activeBuildMatrix,
  });

  // Enhance package.json with zero-install "serve" script alongside Vite "dev"
  const patchedFiles = repoFiles.map((file) => {
    if (file.path !== 'package.json') return file;
    try {
      const pkg = JSON.parse(file.content) as Record<string, unknown>;
      const scripts = (pkg.scripts || {}) as Record<string, string>;
      pkg.scripts = {
        serve: 'node start-localhost.mjs --open',
        ...scripts,
      };
      return {
        ...file,
        content: JSON.stringify(pkg, null, 2),
      };
    } catch {
      return file;
    }
  });

  const standaloneHtml = buildInteractivePresentationHtml(input);
  const nodeServerScript = buildZeroDepNodeServerScript(port, projectTitle);

  const winBat = `@echo off
chcp 65001 >nul
echo Uruchamianie lokalnego hosta prezentacji frontendu (${projectTitle})...
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  node start-localhost.mjs --open
) else (
  echo Node.js nie zostal wykryty — otwieranie bezposrednio pliku dist\\index.html w przegladarce...
  start "" "%~dp0dist\\index.html"
)
pause
`;

  const unixSh = `#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
if command -v node >/dev/null 2>&1; then
  node start-localhost.mjs --open
else
  echo "Brak Node.js — otwieram dist/index.html bezpośrednio w przeglądarce..."
  open "dist/index.html" 2>/dev/null || xdg-open "dist/index.html" 2>/dev/null || true
fi
`;

  const localhostReadme = `# Lokalny Host Prezentacji Frontendu — ${projectTitle}

Ten pakiet zawiera **dwa niezależne tryby uruchomienia prezentacji frontendu** bez żadnych limitów zapytań API:

## Wariant A: Natychmiastowy Serwer Localhost (0 instalacji, działa w 1 sekundę)

Nie wymaga \`npm install\`. Wykorzystuje wbudowany moduł \`node:http\` i gotowy skompilowany interfejs \`dist/index.html\`:

\`\`\`bash
node start-localhost.mjs --open
\`\`\`

- **Windows:** kliknij dwukrotnie \`URUCHOM_LOCALHOST.bat\`
- **macOS / Linux:** uruchom \`sh uruchom-localhost.sh\`
- Prezentacja otworzy się pod adresem **http://localhost:${port}** (z automatycznym wyborem wolnego portu \`${port}..${port + 12}\`).
- Jeśli na komputerze nie ma nawet Node.js, plik \`dist/index.html\` możesz otworzyć bezpośrednio dwuklikiem w dowolnej przeglądarce.

## Wariant B: Pełne Środowisko Deweloperskie Vite + React 19 + TypeScript

Jeśli chcesz rozwijać kod źródłowy komponentów \`.tsx\` w katalogu \`src/\`:

\`\`\`bash
npm install
npm run dev
\`\`\`

## Zawartość Pakietu
- \`dist/index.html\` — kompletna wieloekranowa prezentacja z przełączaniem motywów Jasny/Ciemny, podświetleniem optycznym kursora i niskim kliknięciem akustycznym (\`<160 Hz\`).
- \`start-localhost.mjs\` — lekki serwer HTTP na \`http://localhost:${port}\` bez zewnętrznych zależności.
- \`URUCHOM_LOCALHOST.bat\` / \`uruchom-localhost.sh\` — startery jednoklikowe.
- \`src/\` — pełne drzewo komponentów React 19 + Tailwind CSS wygenerowane w Aether Tactile Studio.
`;

  return [
    { path: 'dist/index.html', content: standaloneHtml },
    { path: 'start-localhost.mjs', content: nodeServerScript },
    { path: 'URUCHOM_LOCALHOST.bat', content: winBat },
    { path: 'uruchom-localhost.sh', content: unixSh },
    { path: 'README-LOCALHOST.md', content: localhostReadme },
    ...patchedFiles,
  ];
}

export function downloadLocalhostServerZip(
  input: LocalhostPresentationBuildInput
): { fileName: string; filesCount: number; sizeKb: number } {
  const files = buildLocalhostServerBundleFiles(input);
  const zipBlob = buildZipArchiveBlob(files);
  const slug = slugifyExportName(
    input.projectName || input.screenMap.name || 'aether-frontend'
  );
  const fileName = `${slug}-localhost-4173.zip`;

  const url = URL.createObjectURL(zipBlob);
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
    sizeKb: Math.max(1, Math.round(zipBlob.size / 1024)),
  };
}

export function downloadStandalonePresentationHtml(
  input: LocalhostPresentationBuildInput,
  initialScreenId?: string
): { fileName: string; sizeKb: number } {
  const html = buildInteractivePresentationHtml(input, initialScreenId);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const slug = slugifyExportName(
    input.projectName || input.screenMap.name || 'prezentacja-frontendu'
  );
  const fileName = `prezentacja-${slug}.html`;

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
    sizeKb: Math.max(1, Math.round(blob.size / 1024)),
  };
}

export async function saveLocalhostServerToLocalDisk(
  subFolderName: string,
  input: LocalhostPresentationBuildInput
): Promise<{ ok: boolean; filesWritten: number; message: string }> {
  const files = buildLocalhostServerBundleFiles(input);
  const slug = slugifyExportName(
    subFolderName || input.projectName || input.screenMap.name || 'localhost-prezentacja'
  );
  const res = await writeArbitraryFilesToLocalDisk({
    subFolderName: `${slug}-localhost`,
    files: files.map((f) => ({
      path: f.path,
      content: f.content,
      encoding: f.encoding,
    })),
  });
  return {
    ok: res.ok,
    filesWritten: res.filesWritten,
    message: res.ok
      ? `Zapisano kompletny serwer Localhost (${res.filesWritten} plików) w katalogu „${res.targetDirectoryLabel}”. Uruchom: node start-localhost.mjs`
      : res.errorMessage || 'Nie udało się zapisać plików serwera na dysku.',
  };
}
