import * as THREE from 'three';
import { EngravingSymbol, HapticMaterialType } from '../types/studio';

export interface MaterialTextureBundle {
  albedoMap: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
}

export type HapticMaterialTextureSet = Record<HapticMaterialType, MaterialTextureBundle>;

/**
 * Deterministic hash helper for procedural PBR grain synthesis (zero external assets).
 */
function hash2D(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

/**
 * Generates complete, non-null PBR texture sets (albedo in sRGB, normal & roughness in linear space)
 * for all 4 haptic materials so runtime switching between Glass, Frosted Glass, Brushed Metal,
 * and Suede occurs in 0 ms without triggering Three.js shader #define recompilation.
 */
export function createHapticMaterialTextureSet(maxAnisotropy: number): HapticMaterialTextureSet {
  const size = 256;

  const makeTex = (
    data: Uint8Array,
    isSRGB: boolean,
    repeatX: number,
    repeatY: number
  ): THREE.DataTexture => {
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = maxAnisotropy;
    if (isSRGB) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    tex.needsUpdate = true;
    return tex;
  };

  // 1. SHINY GLASS — Ultra-pure optical crystal with subtle prismatic facet micro-polishing
  const shinyAlbedo = new Uint8Array(size * size * 4);
  const shinyNormal = new Uint8Array(size * size * 4);
  const shinyRough = new Uint8Array(size * size * 4);

  // 2. FROSTED GLASS — Acid-etched silica micro-beads & satin light-diffusing cellular relief
  const frostedAlbedo = new Uint8Array(size * size * 4);
  const frostedNormal = new Uint8Array(size * size * 4);
  const frostedRough = new Uint8Array(size * size * 4);

  // 3. MATTE METAL — Precision CNC lathe-brushed anodized titanium/aluminum streaks
  const metalAlbedo = new Uint8Array(size * size * 4);
  const metalNormal = new Uint8Array(size * size * 4);
  const metalRough = new Uint8Array(size * size * 4);

  // 4. ABS PLASTIC — Fine isotropic EDM-sparked injection-molded satin polymer grain
  const plasticAlbedo = new Uint8Array(size * size * 4);
  const plasticNormal = new Uint8Array(size * size * 4);
  const plasticRough = new Uint8Array(size * size * 4);

  // 5. SUEDE — Soft directional micro-fiber velvet weave & warm acoustic nap
  const suedeAlbedo = new Uint8Array(size * size * 4);
  const suedeNormal = new Uint8Array(size * size * 4);
  const suedeRough = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowBand = hash2D(y, 13.7);
    const fineBand = Math.sin(v * Math.PI * 128 + rowBand * 4.2);

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = (y * size + x) * 4;
      const nCell = hash2D(x, y);
      const nSmooth =
        (hash2D(Math.floor(x / 2), Math.floor(y / 2)) +
          hash2D(Math.floor((x + 1) / 2), Math.floor(y / 2))) *
        0.5;

      // --- SHINY GLASS ---
      shinyAlbedo[idx] = 252;
      shinyAlbedo[idx + 1] = 254;
      shinyAlbedo[idx + 2] = 255;
      shinyAlbedo[idx + 3] = 255;

      const sgNx = Math.sin(u * Math.PI * 12) * 0.04;
      const sgNy = Math.cos(v * Math.PI * 12) * 0.04;
      shinyNormal[idx] = Math.round((sgNx * 0.5 + 0.5) * 255);
      shinyNormal[idx + 1] = Math.round((sgNy * 0.5 + 0.5) * 255);
      shinyNormal[idx + 2] = 254;
      shinyNormal[idx + 3] = 255;

      shinyRough[idx] = 18;
      shinyRough[idx + 1] = 18;
      shinyRough[idx + 2] = 18;
      shinyRough[idx + 3] = 255;

      // --- FROSTED GLASS ---
      const frostSpeck = Math.round(244 + nSmooth * 11);
      frostedAlbedo[idx] = frostSpeck;
      frostedAlbedo[idx + 1] = frostSpeck;
      frostedAlbedo[idx + 2] = 255;
      frostedAlbedo[idx + 3] = 255;

      const fgNx =
        (Math.sin(u * Math.PI * 56 + nCell * 3.1) * 0.45 + (nCell - 0.5) * 0.55) * 0.65;
      const fgNy =
        (Math.cos(v * Math.PI * 56 + nSmooth * 3.1) * 0.45 + (nSmooth - 0.5) * 0.55) * 0.65;
      const fgNz = Math.sqrt(Math.max(0.2, 1 - fgNx * fgNx - fgNy * fgNy));
      frostedNormal[idx] = Math.round((fgNx * 0.5 + 0.5) * 255);
      frostedNormal[idx + 1] = Math.round((fgNy * 0.5 + 0.5) * 255);
      frostedNormal[idx + 2] = Math.round((fgNz * 0.5 + 0.5) * 255);
      frostedNormal[idx + 3] = 255;

      const fgR = Math.round(170 + nSmooth * 65);
      frostedRough[idx] = fgR;
      frostedRough[idx + 1] = fgR;
      frostedRough[idx + 2] = fgR;
      frostedRough[idx + 3] = 255;

      // --- MATTE BRUSHED METAL ---
      // Longitudinal lathe brush lines along U with subtle micro-scratch variation
      const brushStreak =
        fineBand * 0.55 +
        Math.sin(v * Math.PI * 240 + Math.sin(u * Math.PI * 6) * 0.8) * 0.35 +
        (nCell - 0.5) * 0.2;
      const metalBase = Math.round(212 + brushStreak * 28);
      metalAlbedo[idx] = Math.max(165, Math.min(250, metalBase - 4));
      metalAlbedo[idx + 1] = Math.max(170, Math.min(252, metalBase));
      metalAlbedo[idx + 2] = Math.max(178, Math.min(255, metalBase + 6));
      metalAlbedo[idx + 3] = 255;

      const mtNx = (nCell - 0.5) * 0.16;
      const mtNy = Math.max(-0.92, Math.min(0.92, brushStreak * 0.82));
      const mtNz = Math.sqrt(Math.max(0.18, 1 - mtNx * mtNx - mtNy * mtNy));
      metalNormal[idx] = Math.round((mtNx * 0.5 + 0.5) * 255);
      metalNormal[idx + 1] = Math.round((mtNy * 0.5 + 0.5) * 255);
      metalNormal[idx + 2] = Math.round((mtNz * 0.5 + 0.5) * 255);
      metalNormal[idx + 3] = 255;

      const mtR = Math.round(115 + (0.5 - brushStreak * 0.4) * 95);
      metalRough[idx] = mtR;
      metalRough[idx + 1] = mtR;
      metalRough[idx + 2] = mtR;
      metalRough[idx + 3] = 255;

      // --- TACTILE ABS PLASTIC ---
      // Fine isotropic VDI-24 EDM-sparked injection-mold micro-stipple
      const edmGrain = (nCell - 0.5) * 0.6 + (nSmooth - 0.5) * 0.4;
      const absShade = Math.round(234 + edmGrain * 18);
      plasticAlbedo[idx] = Math.max(205, Math.min(252, absShade));
      plasticAlbedo[idx + 1] = Math.max(207, Math.min(253, absShade + 1));
      plasticAlbedo[idx + 2] = Math.max(210, Math.min(255, absShade + 3));
      plasticAlbedo[idx + 3] = 255;

      const plNx =
        (Math.sin(u * Math.PI * 96 + nCell * 4.7) * 0.3 + (nCell - 0.5) * 0.7) * 0.36;
      const plNy =
        (Math.cos(v * Math.PI * 96 + nSmooth * 4.7) * 0.3 + (nSmooth - 0.5) * 0.7) * 0.36;
      const plNz = Math.sqrt(Math.max(0.35, 1 - plNx * plNx - plNy * plNy));
      plasticNormal[idx] = Math.round((plNx * 0.5 + 0.5) * 255);
      plasticNormal[idx + 1] = Math.round((plNy * 0.5 + 0.5) * 255);
      plasticNormal[idx + 2] = Math.round((plNz * 0.5 + 0.5) * 255);
      plasticNormal[idx + 3] = 255;

      const plR = Math.round(132 + nSmooth * 36);
      plasticRough[idx] = plR;
      plasticRough[idx + 1] = plR;
      plasticRough[idx + 2] = plR;
      plasticRough[idx + 3] = 255;

      // --- TACTILE SUEDE ---
      // Crisscross micro-fiber weave + soft nap clusters
      const weaveA = Math.sin((u + v) * Math.PI * 64);
      const weaveB = Math.cos((u - v) * Math.PI * 64);
      const nap = weaveA * weaveB * 0.5 + (nSmooth - 0.5) * 0.65;
      const suedeShade = Math.round(216 + nap * 30);
      suedeAlbedo[idx] = Math.max(170, Math.min(250, suedeShade));
      suedeAlbedo[idx + 1] = Math.max(168, Math.min(248, suedeShade - 4));
      suedeAlbedo[idx + 2] = Math.max(176, Math.min(255, suedeShade + 5));
      suedeAlbedo[idx + 3] = 255;

      const sdNx = Math.max(-0.95, Math.min(0.95, (weaveA * 0.45 + (nCell - 0.5) * 0.75) * 0.85));
      const sdNy = Math.max(-0.95, Math.min(0.95, (weaveB * 0.45 + (nSmooth - 0.5) * 0.75) * 0.85));
      const sdNz = Math.sqrt(Math.max(0.15, 1 - sdNx * sdNx - sdNy * sdNy));
      suedeNormal[idx] = Math.round((sdNx * 0.5 + 0.5) * 255);
      suedeNormal[idx + 1] = Math.round((sdNy * 0.5 + 0.5) * 255);
      suedeNormal[idx + 2] = Math.round((sdNz * 0.5 + 0.5) * 255);
      suedeNormal[idx + 3] = 255;

      const sdR = Math.round(220 + nCell * 34);
      suedeRough[idx] = sdR;
      suedeRough[idx + 1] = sdR;
      suedeRough[idx + 2] = sdR;
      suedeRough[idx + 3] = 255;
    }
  }

  return {
    'shiny-glass': {
      albedoMap: makeTex(shinyAlbedo, true, 2, 2),
      normalMap: makeTex(shinyNormal, false, 2, 2),
      roughnessMap: makeTex(shinyRough, false, 2, 2),
    },
    'frosted-glass': {
      albedoMap: makeTex(frostedAlbedo, true, 5, 3),
      normalMap: makeTex(frostedNormal, false, 5, 3),
      roughnessMap: makeTex(frostedRough, false, 5, 3),
    },
    'matte-metal': {
      albedoMap: makeTex(metalAlbedo, true, 3, 2),
      normalMap: makeTex(metalNormal, false, 3, 2),
      roughnessMap: makeTex(metalRough, false, 3, 2),
    },
    'abs-plastic': {
      albedoMap: makeTex(plasticAlbedo, true, 5, 4),
      normalMap: makeTex(plasticNormal, false, 5, 4),
      roughnessMap: makeTex(plasticRough, false, 5, 4),
    },
    suede: {
      albedoMap: makeTex(suedeAlbedo, true, 6, 4),
      normalMap: makeTex(suedeNormal, false, 6, 4),
      roughnessMap: makeTex(suedeRough, false, 6, 4),
    },
  };
}

export function disposeHapticMaterialTextureSet(set: HapticMaterialTextureSet): void {
  (Object.keys(set) as HapticMaterialType[]).forEach((k) => {
    set[k].albedoMap.dispose();
    set[k].normalMap.dispose();
    set[k].roughnessMap.dispose();
  });
}

function drawGlyphAt(
  ctx: CanvasRenderingContext2D,
  symbol: EngravingSymbol,
  cx: number,
  cy: number,
  r: number
): void {
  ctx.beginPath();
  switch (symbol) {
    case 'vascular':
      ctx.moveTo(cx, cy + r * 0.85);
      ctx.quadraticCurveTo(cx - r * 0.12, cy, cx, cy - r * 0.85);
      ctx.moveTo(cx - r * 0.04, cy + r * 0.15);
      ctx.quadraticCurveTo(cx - r * 0.55, cy - r * 0.15, cx - r * 0.72, cy - r * 0.65);
      ctx.moveTo(cx + r * 0.04, cy - r * 0.05);
      ctx.quadraticCurveTo(cx + r * 0.55, cy - r * 0.35, cx + r * 0.74, cy - r * 0.72);
      ctx.moveTo(cx - r * 0.03, cy + r * 0.45);
      ctx.quadraticCurveTo(cx + r * 0.48, cy + r * 0.25, cx + r * 0.65, cy - r * 0.05);
      break;
    case 'droplet':
      ctx.moveTo(cx, cy - r * 0.82);
      ctx.bezierCurveTo(
        cx + r * 0.68,
        cy - r * 0.05,
        cx + r * 0.62,
        cy + r * 0.78,
        cx,
        cy + r * 0.78
      );
      ctx.bezierCurveTo(
        cx - r * 0.62,
        cy + r * 0.78,
        cx - r * 0.68,
        cy - r * 0.05,
        cx,
        cy - r * 0.82
      );
      break;
    case 'wave':
      for (let row = -1; row <= 1; row++) {
        const yOff = cy + row * r * 0.36;
        ctx.moveTo(cx - r * 0.78, yOff);
        ctx.bezierCurveTo(
          cx - r * 0.28,
          yOff - r * 0.34,
          cx + r * 0.28,
          yOff + r * 0.34,
          cx + r * 0.78,
          yOff
        );
      }
      break;
    case 'spark':
      ctx.moveTo(cx + r * 0.12, cy - r * 0.85);
      ctx.lineTo(cx - r * 0.48, cy + r * 0.06);
      ctx.lineTo(cx + r * 0.06, cy + r * 0.06);
      ctx.lineTo(cx - r * 0.14, cy + r * 0.85);
      ctx.lineTo(cx + r * 0.5, cy - r * 0.08);
      ctx.lineTo(cx - r * 0.04, cy - r * 0.08);
      ctx.closePath();
      break;
    case 'prism':
      ctx.moveTo(cx, cy - r * 0.82);
      ctx.lineTo(cx + r * 0.76, cy + r * 0.58);
      ctx.lineTo(cx - r * 0.76, cy + r * 0.58);
      ctx.closePath();
      ctx.moveTo(cx, cy - r * 0.82);
      ctx.lineTo(cx, cy + r * 0.58);
      break;
    case 'ring':
      ctx.arc(cx, cy, r * 0.68, 0, Math.PI * 2);
      ctx.moveTo(cx + r * 0.34, cy);
      ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2);
      break;
    case 'compass':
      ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
      ctx.moveTo(cx, cy - r * 0.52);
      ctx.lineTo(cx + r * 0.22, cy);
      ctx.lineTo(cx, cy + r * 0.52);
      ctx.lineTo(cx - r * 0.22, cy);
      ctx.closePath();
      break;
    case 'none':
    default:
      break;
  }
  ctx.stroke();
}

/**
 * Updates a reusable 512x256 equirectangular emissive & laser-etch CanvasTexture
 * reflecting the engraving symbol, glowColor, and etchDepth from HapticSettingsPanel.
 */
export function updateSphereEngravingTexture(
  canvas: HTMLCanvasElement,
  tex: THREE.CanvasTexture,
  symbol: EngravingSymbol,
  glowColor: string,
  etchDepth: number
): void {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  const etchNorm = Math.max(0.1, Math.min(1, etchDepth / 100));

  // Subtle precision equatorial metrology lines
  ctx.strokeStyle = glowColor;
  ctx.globalAlpha = 0.22 + etchNorm * 0.35;
  ctx.lineWidth = 1 + etchNorm * 1.6;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.5 - 38);
  ctx.lineTo(w, h * 0.5 - 38);
  ctx.moveTo(0, h * 0.5 + 38);
  ctx.lineTo(w, h * 0.5 + 38);
  ctx.stroke();

  if (symbol !== 'none') {
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = glowColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 6 + etchNorm * 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.6 + etchNorm * 3.4;

    // Repeat 4 times around the sphere's equator so it is visible from every camera angle
    for (let i = 0; i < 4; i++) {
      const cx = ((i + 0.5) / 4) * w;
      const cy = h * 0.5;
      drawGlyphAt(ctx, symbol, cx, cy, 28);
    }
    ctx.shadowBlur = 0;
  }

  ctx.globalAlpha = 1.0;
  tex.needsUpdate = true;
}
