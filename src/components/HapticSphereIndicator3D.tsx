import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Power, RotateCcw, SlidersHorizontal, Vibrate } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { HapticMaterialType, MATERIAL_PROFILES } from '../types/studio';
import { hapticAudio, RealtimeAudioHapticTelemetry } from '../lib/hapticAudioEngine';
import {
  createHapticMaterialTextureSet,
  disposeHapticMaterialTextureSet,
  updateSphereEngravingTexture,
} from '../lib/hapticSphereTextures';
import { HapticSlider } from './ui/HapticSlider';

// Pre-allocated module-scope math helpers (zero GC inside animation tick)
const _dummy = new THREE.Object3D();
const _pinColor = new THREE.Color();
const _bgTarget = new THREE.Color();
const _sphereTint = new THREE.Color();
const _attenuationTint = new THREE.Color();
const _sheenTint = new THREE.Color();
const _coilEmissive = new THREE.Color();
const _pointerNdc = new THREE.Vector2();
const _camDefaultPos = new THREE.Vector3(0, 0.52, 3.62);
const _camDefaultTarget = new THREE.Vector3(0, 0.04, 0);

const _hapticTelemetry: RealtimeAudioHapticTelemetry = {
  rms: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  pressImpulse: 0,
  clutchImpulse: 0,
  patternGate: 0,
  activePulseIndex: -1,
  bins: new Float32Array(32),
};

function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

function materialToModeIndex(mat: HapticMaterialType): number {
  switch (mat) {
    case 'shiny-glass':
      return 0;
    case 'frosted-glass':
      return 1;
    case 'matte-metal':
      return 2;
    case 'abs-plastic':
      return 1;
    case 'suede':
      return 3;
  }
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 118);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.52)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.17)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createForceGaugeDialTexture(maxAniso: number, darkTheme: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 512);
  const cx = 256;
  const cy = 256;

  ctx.strokeStyle = darkTheme ? 'rgba(110, 231, 183, 0.48)' : 'rgba(79, 70, 229, 0.42)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 228, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 182, 0, Math.PI * 2);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * Math.PI * 2;
    const major = i % 7 === 0;
    const r0 = major ? 194 : 208;
    const r1 = 226;
    ctx.lineWidth = major ? 2.5 : 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export const HapticSphereIndicator3D: React.FC<{
  onOpenHapticSettings?: () => void;
}> = ({ onOpenHapticSettings }) => {
  const {
    palette,
    depth,
    haptic,
    updateHaptic,
    engraving,
    updateEngraving,
    synth,
    patterns,
    selectMaterialProfile,
    activeHoldLevel,
    setActiveHoldLevel,
    pulseInteraction,
  } = useStudio();

  const [webglReady, setWebglReady] = useState(true);
  const [livePulseSegment, setLivePulseSegment] = useState<number>(-1);
  const [holdingSphere, setHoldingSphere] = useState(false);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const resetCamRequestedRef = useRef(false);

  const stateRef = useRef({
    palette,
    haptic,
    engraving,
    synth,
    patterns,
    hold: activeHoldLevel,
  });

  const callbacksRef = useRef({
    setActiveHoldLevel,
    pulseInteraction,
    setLivePulseSegment,
    setHoldingSphere,
  });

  useEffect(() => {
    callbacksRef.current = {
      setActiveHoldLevel,
      pulseInteraction,
      setLivePulseSegment,
      setHoldingSphere,
    };
  }, [setActiveHoldLevel, pulseInteraction]);

  useEffect(() => {
    stateRef.current = {
      palette,
      haptic,
      engraving,
      synth,
      patterns,
      hold: activeHoldLevel,
    };
  }, [palette, haptic, engraving, synth, patterns, activeHoldLevel]);

  const effectivePulses = useMemo(
    () => hapticAudio.computeEffectivePulses(haptic, patterns),
    [haptic, patterns]
  );

  const activePatternObj = useMemo(
    () => patterns.find((p) => p.id === haptic.activePatternId) || patterns[0],
    [patterns, haptic.activePatternId]
  );

  // Derived real-time optical & surface telemetry displayed in UI to mirror the 3D PBR shader
  const liveMaterialStats = useMemo(() => {
    const hardnessNorm = haptic.materialHardness / 100;
    const intensityNorm = haptic.enabled ? haptic.intensity / 100 : 0;
    const clutchNorm = haptic.reverseClutchForce / 100;
    const durationNorm = (haptic.durationMs - 8) / 252;
    const rampNorm = (haptic.holdRampMultiplier - 1) / 2;

    let baseRough = 0.05;
    let baseMetal = 0.05;
    if (haptic.material === 'shiny-glass') {
      baseRough = 0.02 + (1 - hardnessNorm) * 0.18;
      baseMetal = 0.04 + clutchNorm * 0.16;
    } else if (haptic.material === 'frosted-glass') {
      baseRough = 0.22 + (1 - hardnessNorm) * 0.36;
      baseMetal = 0.03 + clutchNorm * 0.12;
    } else if (haptic.material === 'matte-metal') {
      baseRough = 0.11 + (1 - hardnessNorm) * 0.44;
      baseMetal = 0.78 + hardnessNorm * 0.12 + clutchNorm * 0.1;
    } else {
      baseRough = 0.74 + (1 - hardnessNorm) * 0.22;
      baseMetal = 0.02 + clutchNorm * 0.08;
    }

    const reflectivityPct = Math.round(
      Math.min(100, Math.max(4, (1 - baseRough * 0.82) * 72 + intensityNorm * 20 + hardnessNorm * 8))
    );
    const thicknessMm = (0.4 + durationNorm * 2.45).toFixed(2);
    const iridescencePct = Math.round((0.12 + rampNorm * 0.88) * 100);

    return {
      reflectivityPct,
      roughnessRa: baseRough.toFixed(2),
      metalnessPct: Math.round(Math.min(1, baseMetal) * 100),
      thicknessMm,
      iridescencePct,
    };
  }, [haptic]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglReady(false);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initW = Math.max(220, container.clientWidth);
    const initH = Math.max(220, container.clientHeight);
    renderer.setSize(initW, initH);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglReady(false);
    };
    const onContextRestored = () => {
      setWebglReady(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    const initDark = stateRef.current.palette === 'emerald-clinic';
    const initialBg = new THREE.Color(
      initDark
        ? '#071713'
        : stateRef.current.palette === 'finance-ice'
          ? '#E9F0FF'
          : '#ECEEFA'
    );
    scene.background = initialBg;
    scene.fog = new THREE.FogExp2(initialBg.getHex(), 0.052);

    // Studio reflection environment map for accurate light reflection & optical glass refraction
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.035);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(36, initW / initH, 0.1, 40);
    camera.position.copy(_camDefaultPos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 2.45;
    controls.maxDistance = 5.4;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.target.copy(_camDefaultTarget);

    // 3-Point Warm/Cool Studio Lighting Rig (responsive to intensity & hardness)
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e1b4b, 0.94);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e8, 2.15);
    keyLight.position.set(3.4, 4.8, 3.6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(512, 512);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 14;
    keyLight.shadow.camera.left = -2.4;
    keyLight.shadow.camera.right = 2.4;
    keyLight.shadow.camera.top = 2.4;
    keyLight.shadow.camera.bottom = -2.4;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 1.65);
    rimLight.position.set(-3.6, 2.2, -3.2);
    scene.add(rimLight);

    // Root composite group (grounded at bottom-center)
    const indicatorRoot = new THREE.Group();
    scene.add(indicatorRoot);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // Procedural PBR textures for Glass, Frosted Glass, Brushed Metal, and Suede
    const matTextureSet = createHapticMaterialTextureSet(maxAniso);

    // Procedural dynamic laser-engraving canvas & texture synced with HapticSettingsPanel engraving sliders
    const engravingCanvas = document.createElement('canvas');
    engravingCanvas.width = 512;
    engravingCanvas.height = 256;
    const engravingTex = new THREE.CanvasTexture(engravingCanvas);
    engravingTex.colorSpace = THREE.SRGBColorSpace;
    engravingTex.wrapS = THREE.RepeatWrapping;
    engravingTex.wrapT = THREE.ClampToEdgeWrapping;
    engravingTex.anisotropy = maxAniso;
    updateSphereEngravingTexture(
      engravingCanvas,
      engravingTex,
      stateRef.current.engraving.symbol,
      stateRef.current.engraving.glowColor,
      stateRef.current.engraving.etchDepth
    );

    const shadowTex = createContactShadowTexture();
    const dialTex = createForceGaugeDialTexture(maxAniso, initDark);

    // 1. Grounded Contact Shadow Plane
    const shadowGeo = new THREE.PlaneGeometry(3.3, 3.3);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.48,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -1.28;
    indicatorRoot.add(shadowMesh);

    // 2. Stepped CNC Metrology Pedestal Base (LatheGeometry)
    const pedestalPts = [
      new THREE.Vector2(0.0, -1.26),
      new THREE.Vector2(1.08, -1.26),
      new THREE.Vector2(1.14, -1.2),
      new THREE.Vector2(0.98, -1.13),
      new THREE.Vector2(0.68, -1.13),
      new THREE.Vector2(0.58, -1.2),
      new THREE.Vector2(0.0, -1.2),
    ];
    const pedestalGeo = new THREE.LatheGeometry(pedestalPts, 64);
    pedestalGeo.computeTangents();
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: initDark ? 0x112b24 : 0xdde3f4,
      metalness: 0.72,
      roughness: 0.36,
    });
    const pedestalMesh = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestalMesh.receiveShadow = !isSoftwareGl;
    indicatorRoot.add(pedestalMesh);

    // Graduated Force Scale Chapter Ring on Pedestal
    const dialGeo = new THREE.RingGeometry(0.66, 1.04, 64);
    const dialMat = new THREE.MeshBasicMaterial({
      map: dialTex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const dialMesh = new THREE.Mesh(dialGeo, dialMat);
    dialMesh.rotation.x = -Math.PI / 2;
    dialMesh.position.y = -1.11;
    indicatorRoot.add(dialMesh);

    // Vibrating Sphere + Internal LRA Assembly Group
    const sphereAssembly = new THREE.Group();
    sphereAssembly.position.y = 0.06;
    indicatorRoot.add(sphereAssembly);

    // 3. Interior Piezo-Linear Actuator Seismic Mass (visible through glass modes)
    const corePts = [
      new THREE.Vector2(0.0, -0.44),
      new THREE.Vector2(0.22, -0.34),
      new THREE.Vector2(0.34, -0.1),
      new THREE.Vector2(0.34, 0.1),
      new THREE.Vector2(0.22, 0.34),
      new THREE.Vector2(0.0, 0.44),
    ];
    const seismicGeo = new THREE.LatheGeometry(corePts, 48);
    const seismicMat = new THREE.MeshPhysicalMaterial({
      color: 0x312e81,
      metalness: 0.94,
      roughness: 0.18,
      anisotropy: 0.75,
      clearcoat: 0.6,
    });
    const seismicCore = new THREE.Mesh(seismicGeo, seismicMat);
    seismicCore.renderOrder = 1;
    sphereAssembly.add(seismicCore);

    // 4. Luminous Inductive Actuator Coil Ring around Seismic Core
    const coilGeo = new THREE.TorusGeometry(0.42, 0.042, 20, 64);
    const coilMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      emissive: 0x4f46e5,
      emissiveIntensity: 0.55,
      metalness: 0.65,
      roughness: 0.25,
    });
    const coilMesh = new THREE.Mesh(coilGeo, coilMat);
    coilMesh.rotation.x = Math.PI / 2;
    coilMesh.renderOrder = 1;
    seismicCore.add(coilMesh);

    // 5. Primary Silhouette — Real-Time PBR Multi-Material Sphere
    const sphereGeo = new THREE.SphereGeometry(0.95, 80, 64);
    sphereGeo.computeTangents();

    const initMatType = stateRef.current.haptic.material;
    const initTexBundle = matTextureSet[initMatType];

    const sphereShaderUniforms = {
      uTime: { value: 0 },
      uVibAmp: { value: 0 },
      uModeType: { value: materialToModeIndex(initMatType) },
      uHardness: { value: stateRef.current.haptic.materialHardness / 100 },
    };

    const sphereMat = new THREE.MeshPhysicalMaterial({
      color: 0xeef4ff,
      map: initTexBundle.albedoMap,
      normalMap: initTexBundle.normalMap,
      roughnessMap: initTexBundle.roughnessMap,
      bumpMap: engravingTex,
      bumpScale: 0.018,
      emissive: new THREE.Color('#ffffff'),
      emissiveMap: engravingTex,
      emissiveIntensity: stateRef.current.engraving.glowEnabled
        ? (stateRef.current.engraving.glowIntensity / 100) * 0.95
        : 0,
      roughness: 0.24,
      metalness: 0.08,
      envMapIntensity: 1.25,
      specularIntensity: 0.9,
      transmission: isSoftwareGl ? 0 : 0.74,
      transparent: isSoftwareGl,
      opacity: isSoftwareGl ? 0.56 : 1.0,
      ior: 1.52,
      thickness: 1.5,
      attenuationColor: new THREE.Color('#c7d2fe'),
      attenuationDistance: 1.8,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      iridescence: 0.52,
      iridescenceIOR: 1.34,
      iridescenceThicknessRange: [140, 460],
      normalScale: new THREE.Vector2(0.24, 0.24),
    });

    sphereMat.customProgramCacheKey = () => 'aether-haptic-indicator-sphere-v2';
    sphereMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = sphereShaderUniforms.uTime;
      shader.uniforms.uVibAmp = sphereShaderUniforms.uVibAmp;
      shader.uniforms.uModeType = sphereShaderUniforms.uModeType;
      shader.uniforms.uHardness = sphereShaderUniforms.uHardness;

      const helperGlsl = `
        uniform float uTime;
        uniform float uVibAmp;
        uniform float uModeType;
        uniform float uHardness;

        float evalHapticWave(vec3 dir) {
          float theta = atan(dir.z, dir.x);
          float phi = acos(clamp(dir.y, -1.0, 1.0));
          float sharp = mix(4.0, 11.0, uHardness);

          // Mode 0: Shiny Glass — crisp crystalline high-harmonic standing waves
          float wShiny = sin(phi * sharp - uTime * 15.0) * cos(theta * 6.0 + uTime * 9.0);

          // Mode 1: Frosted Glass — silky helical subsurface ripples
          float wFrosted = sin(phi * 6.0 + theta * 3.0 - uTime * 11.0) * 0.85
                         + cos(phi * 4.0 - uTime * 8.0) * 0.35;

          // Mode 2: Matte Metal — rigid quantized CNC detent micro-tremors
          float rawMetal = cos(theta * 12.0) * sin(phi * 8.0 - uTime * 22.0);
          float wMetal = mix(rawMetal, sign(rawMetal) * pow(abs(rawMetal), 0.55), 0.7);

          // Mode 3: Suede — warm cushioned low-order volumetric breathing lobes
          float wSuede = sin(phi * 3.0 - uTime * 6.5) * cos(theta * 2.0 + uTime * 4.5);

          float m01 = mix(wShiny, wFrosted, clamp(uModeType, 0.0, 1.0));
          float m12 = mix(m01, wMetal, clamp(uModeType - 1.0, 0.0, 1.0));
          float m23 = mix(m12, wSuede, clamp(uModeType - 2.0, 0.0, 1.0));
          return m23 * uVibAmp;
        }
      `;

      shader.vertexShader = helperGlsl + '\n' + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <beginnormal_vertex>',
        `
        #include <beginnormal_vertex>
        vec3 nDir = normalize(position);
        float dCenter = evalHapticWave(nDir);
        vec3 tang = normalize(abs(nDir.y) > 0.92 ? cross(nDir, vec3(1.0, 0.0, 0.0)) : cross(nDir, vec3(0.0, 1.0, 0.0)));
        vec3 bitang = normalize(cross(nDir, tang));
        float dTang = evalHapticWave(normalize(nDir + tang * 0.035));
        float dBitang = evalHapticWave(normalize(nDir + bitang * 0.035));
        objectNormal = normalize(objectNormal - tang * ((dTang - dCenter) * 6.5) - bitang * ((dBitang - dCenter) * 6.5));
        `
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        transformed += normalize(position) * evalHapticWave(normalize(position));
        `
      );
    };

    const vibratingSphere = new THREE.Mesh(sphereGeo, sphereMat);
    vibratingSphere.castShadow = !isSoftwareGl;
    vibratingSphere.renderOrder = 3;
    vibratingSphere.layers.enable(1);
    sphereAssembly.add(vibratingSphere);

    // 6. Chamfered Equatorial Force-Sensing Gimbal Collar (LatheGeometry)
    const collarPts = [
      new THREE.Vector2(1.13, -0.055),
      new THREE.Vector2(1.22, -0.035),
      new THREE.Vector2(1.24, 0.0),
      new THREE.Vector2(1.22, 0.035),
      new THREE.Vector2(1.13, 0.055),
      new THREE.Vector2(1.11, 0.0),
      new THREE.Vector2(1.13, -0.055),
    ];
    const collarGeo = new THREE.LatheGeometry(collarPts, 72);
    collarGeo.computeTangents();
    const collarMat = new THREE.MeshPhysicalMaterial({
      color: initDark ? 0x6ee7b7 : 0x334155,
      metalness: 0.9,
      roughness: 0.42,
      anisotropy: 0.7,
    });
    const gimbalCollar = new THREE.Mesh(collarGeo, collarMat);
    gimbalCollar.rotation.z = 0.16;
    gimbalCollar.rotation.x = 0.22;
    sphereAssembly.add(gimbalCollar);

    // 7. 28 Radial Force-Amplitude Micro-Needles (InstancedMesh)
    const NEEDLE_COUNT = 28;
    const needleGeo = new THREE.CylinderGeometry(0.018, 0.026, 0.22, 10);
    needleGeo.rotateZ(Math.PI / 2);
    const needleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.55,
      roughness: 0.3,
    });
    const forceNeedles = new THREE.InstancedMesh(needleGeo, needleMat, NEEDLE_COUNT);
    forceNeedles.frustumCulled = false;
    for (let i = 0; i < NEEDLE_COUNT; i++) {
      const ang = (i / NEEDLE_COUNT) * Math.PI * 2;
      _dummy.position.set(Math.cos(ang) * 1.34, 0, Math.sin(ang) * 1.34);
      _dummy.rotation.set(0, -ang, 0);
      _dummy.scale.set(0.6, 1, 1);
      _dummy.updateMatrix();
      forceNeedles.setMatrixAt(i, _dummy.matrix);
      forceNeedles.setColorAt(i, _pinColor.setHex(0x6366f1));
    }
    forceNeedles.instanceMatrix.needsUpdate = true;
    if (forceNeedles.instanceColor) forceNeedles.instanceColor.needsUpdate = true;
    forceNeedles.computeBoundingSphere();
    gimbalCollar.add(forceNeedles);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting for direct press-and-hold interaction on the 3D sphere
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    let pointerHolding3D = false;

    const handlePointerDown = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObject(vibratingSphere, false);
      if (hits.length > 0) {
        pointerHolding3D = true;
        callbacksRef.current.setHoldingSphere(true);
        const st = stateRef.current;
        hapticAudio.triggerPress(st.synth, st.haptic, st.patterns, { intensityScale: 1.15 });
        callbacksRef.current.pulseInteraction(1.1);
        hapticAudio.startHoldRamp(
          st.synth,
          st.haptic,
          (lvl) => callbacksRef.current.setActiveHoldLevel(lvl),
          st.haptic.material
        );
      }
    };

    const handlePointerUp = () => {
      if (!pointerHolding3D) return;
      pointerHolding3D = false;
      callbacksRef.current.setHoldingSphere(false);
      hapticAudio.stopHoldRamp();
      callbacksRef.current.setActiveHoldLevel(0);
      hapticAudio.triggerReleaseReverseClutch(stateRef.current.haptic);
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    let frameId = 0;
    let unmounted = false;
    let prevTime = performance.now();
    let phaseTime = 0;
    let smoothedAmp = 0;
    let smoothedMode = materialToModeIndex(initMatType);
    let coreSpringY = 0;
    let coreVelY = 0;
    let lastReportedSeg = -1;

    let appliedMatType: HapticMaterialType = initMatType;
    let prevWasGlass = initMatType === 'shiny-glass' || initMatType === 'frosted-glass';
    let prevDarkTheme = initDark;
    let prevEngravingKey = `${stateRef.current.engraving.symbol}|${stateRef.current.engraving.glowColor}|${stateRef.current.engraving.etchDepth}`;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (unmounted) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (unmounted) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
      prevTime = now;

      const st = stateRef.current;
      const hap = st.haptic;
      const eng = st.engraving;
      const isDarkNow = st.palette === 'emerald-clinic';

      // Sample real-time haptic & audio telemetry
      hapticAudio.sampleRealtimeTelemetry(dt, _hapticTelemetry);
      if (_hapticTelemetry.activePulseIndex !== lastReportedSeg) {
        lastReportedSeg = _hapticTelemetry.activePulseIndex;
        callbacksRef.current.setLivePulseSegment(lastReportedSeg);
      }

      // Update palette & dial
      _bgTarget.set(
        isDarkNow
          ? '#071713'
          : st.palette === 'finance-ice'
            ? '#E9F0FF'
            : '#ECEEFA'
      );
      (scene.background as THREE.Color).lerp(_bgTarget, 1 - Math.exp(-6 * dt));
      (scene.fog as THREE.FogExp2).color.copy(scene.background as THREE.Color);

      if (isDarkNow !== prevDarkTheme) {
        prevDarkTheme = isDarkNow;
        pedestalMat.color.setHex(isDarkNow ? 0x112b24 : 0xdde3f4);
        const nextDial = createForceGaugeDialTexture(maxAniso, isDarkNow);
        dialMat.map?.dispose();
        dialMat.map = nextDial;
        dialMat.needsUpdate = true;
      }

      // Redraw procedural laser-engraved symbol map whenever HapticSettingsPanel engraving changes
      const engKey = `${eng.symbol}|${eng.glowColor}|${eng.etchDepth}`;
      if (engKey !== prevEngravingKey) {
        prevEngravingKey = engKey;
        updateSphereEngravingTexture(
          engravingCanvas,
          engravingTex,
          eng.symbol,
          eng.glowColor,
          eng.etchDepth
        );
      }

      // Swap non-null PBR texture set immediately when Glass vs Frosted vs Metal vs Suede changes
      if (hap.material !== appliedMatType) {
        appliedMatType = hap.material;
        const bundle = matTextureSet[hap.material];
        sphereMat.map = bundle.albedoMap;
        sphereMat.normalMap = bundle.normalMap;
        sphereMat.roughnessMap = bundle.roughnessMap;
      }

      // =========================================================================
      // Real-Time Coupling of ALL HapticSettingsPanel Sliders -> 3D Sphere Material
      // =========================================================================
      const enabledFactor = hap.enabled ? 1 : 0;
      const strengthNorm = enabledFactor * (hap.intensity / 100);
      const hardnessNorm = hap.materialHardness / 100; // 0..1 Shore -> Light reflection & polish
      const durationNorm = Math.min(1, Math.max(0, (hap.durationMs - 8) / 252)); // 0..1 -> Optical depth / grain density
      const clutchNorm = hap.reverseClutchForce / 100; // 0..1 -> Metallic PVD coat & directional anisotropy
      const rampNorm = Math.min(1, Math.max(0, (hap.holdRampMultiplier - 1) / 2)); // 0..1 -> Thin-film iridescence
      const etchNorm = Math.min(1, Math.max(0.1, eng.etchDepth / 100)); // 0.1..1 -> Surface texture & etch relief depth
      const glowNorm = eng.glowEnabled ? eng.glowIntensity / 100 : 0; // 0..1 -> Subsurface engraving luminescence

      // Dynamically adjust UV tiling density of brushed metal / frosted silica / suede weave via duration & hardness
      const activeBundle = matTextureSet[hap.material];
      const grainScale =
        hap.material === 'matte-metal'
          ? 2.2 + (1 - durationNorm) * 2.4
          : hap.material === 'frosted-glass'
            ? 3.5 + hardnessNorm * 3.5
            : hap.material === 'suede'
              ? 4.5 + (1 - durationNorm) * 3.0
              : 2.0;
      activeBundle.albedoMap.repeat.set(grainScale, Math.max(1.5, grainScale * 0.68));
      activeBundle.normalMap.repeat.copy(activeBundle.albedoMap.repeat);
      activeBundle.roughnessMap.repeat.copy(activeBundle.albedoMap.repeat);

      // Update key light specular punch & environment reflection intensity from Hardness + Intensity
      const targetEnvIntensity = 0.52 + hardnessNorm * 1.15 + strengthNorm * 0.58;
      sphereMat.envMapIntensity = THREE.MathUtils.damp(
        sphereMat.envMapIntensity,
        targetEnvIntensity,
        9,
        dt
      );
      sphereMat.specularIntensity = THREE.MathUtils.damp(
        sphereMat.specularIntensity,
        0.25 + strengthNorm * 0.85 + hardnessNorm * 0.35,
        9,
        dt
      );
      keyLight.intensity = 1.65 + hardnessNorm * 0.65 + strengthNorm * 0.45;
      rimLight.intensity = 1.2 + rampNorm * 0.75 + clutchNorm * 0.45;

      // Iridescence film driven by Hold Ramp Multiplier slider (1.0x - 3.0x)
      const targetIrid =
        hap.material === 'suede'
          ? rampNorm * 0.22
          : 0.1 + rampNorm * 0.9;
      sphereMat.iridescence = THREE.MathUtils.damp(sphereMat.iridescence, targetIrid, 8, dt);
      sphereMat.iridescenceThicknessRange = [120, 240 + rampNorm * 460];

      // Laser-engraved groove depth & subsurface glow from HapticSettingsPanel engraving sliders
      sphereMat.bumpScale = 0.004 + etchNorm * 0.044;
      sphereMat.emissiveIntensity = THREE.MathUtils.damp(
        sphereMat.emissiveIntensity,
        glowNorm * (0.65 + strengthNorm * 0.75 + _hapticTelemetry.patternGate * 0.45),
        10,
        dt
      );

      // Glass vs Opaque depthWrite sorting
      const isGlass = hap.material === 'shiny-glass' || hap.material === 'frosted-glass';
      if (isGlass !== prevWasGlass) {
        prevWasGlass = isGlass;
        sphereMat.depthWrite = !isGlass;
        const nextTransparent = isGlass && isSoftwareGl;
        if (sphereMat.transparent !== nextTransparent) {
          sphereMat.transparent = nextTransparent;
          sphereMat.needsUpdate = true;
        }
      }

      const normalReliefFactor = 0.45 + etchNorm * 1.15;

      if (hap.material === 'shiny-glass') {
        _sphereTint.set(isDarkNow ? '#bbf7d0' : '#e8eeff');
        _attenuationTint.set(isDarkNow ? '#34d399' : '#818cf8');
        sphereMat.color.lerp(_sphereTint, 1 - Math.exp(-8 * dt));
        sphereMat.attenuationColor.lerp(_attenuationTint, 1 - Math.exp(-8 * dt));
        sphereMat.metalness = THREE.MathUtils.damp(
          sphereMat.metalness,
          0.03 + clutchNorm * 0.18, // PVD mirror tint increases with reverse clutch
          8,
          dt
        );
        sphereMat.roughness = THREE.MathUtils.damp(
          sphereMat.roughness,
          0.02 + (1 - hardnessNorm) * 0.2,
          8,
          dt
        );
        sphereMat.transmission = THREE.MathUtils.damp(
          sphereMat.transmission,
          isSoftwareGl ? 0 : 0.96 - clutchNorm * 0.14,
          8,
          dt
        );
        sphereMat.opacity = isSoftwareGl ? 0.42 : 1.0;
        sphereMat.ior = THREE.MathUtils.damp(
          sphereMat.ior,
          1.48 + hardnessNorm * 0.34,
          8,
          dt
        );
        sphereMat.thickness = THREE.MathUtils.damp(
          sphereMat.thickness,
          0.4 + durationNorm * 2.45,
          8,
          dt
        );
        sphereMat.attenuationDistance = 2.6 - durationNorm * 1.85;
        sphereMat.clearcoat = THREE.MathUtils.damp(
          sphereMat.clearcoat,
          0.55 + hardnessNorm * 0.45,
          8,
          dt
        );
        sphereMat.clearcoatRoughness = 0.02 + (1 - hardnessNorm) * 0.22;
        sphereMat.anisotropy = THREE.MathUtils.damp(sphereMat.anisotropy, clutchNorm * 0.45, 8, dt);
        sphereMat.anisotropyRotation = clutchNorm * Math.PI;
        sphereMat.sheen = THREE.MathUtils.damp(sphereMat.sheen, 0.0, 8, dt);
        const ns = 0.05 * normalReliefFactor;
        sphereMat.normalScale.set(ns, ns);
      } else if (hap.material === 'frosted-glass') {
        _sphereTint.set(isDarkNow ? '#6ee7b7' : '#eef2ff');
        _attenuationTint.set(isDarkNow ? '#10b981' : '#a5b4fc');
        sphereMat.color.lerp(_sphereTint, 1 - Math.exp(-8 * dt));
        sphereMat.attenuationColor.lerp(_attenuationTint, 1 - Math.exp(-8 * dt));
        sphereMat.metalness = THREE.MathUtils.damp(
          sphereMat.metalness,
          0.03 + clutchNorm * 0.14,
          8,
          dt
        );
        sphereMat.roughness = THREE.MathUtils.damp(
          sphereMat.roughness,
          0.22 + (1 - hardnessNorm) * 0.38,
          8,
          dt
        );
        sphereMat.transmission = THREE.MathUtils.damp(
          sphereMat.transmission,
          isSoftwareGl ? 0 : 0.8 - durationNorm * 0.16,
          8,
          dt
        );
        sphereMat.opacity = isSoftwareGl ? 0.64 : 1.0;
        sphereMat.ior = THREE.MathUtils.damp(
          sphereMat.ior,
          1.45 + hardnessNorm * 0.22,
          8,
          dt
        );
        sphereMat.thickness = THREE.MathUtils.damp(
          sphereMat.thickness,
          0.65 + durationNorm * 2.2,
          8,
          dt
        );
        sphereMat.attenuationDistance = 2.1 - durationNorm * 1.45;
        sphereMat.clearcoat = THREE.MathUtils.damp(
          sphereMat.clearcoat,
          0.2 + hardnessNorm * 0.55,
          8,
          dt
        );
        sphereMat.clearcoatRoughness = 0.12 + (1 - hardnessNorm) * 0.35;
        sphereMat.anisotropy = THREE.MathUtils.damp(sphereMat.anisotropy, clutchNorm * 0.35, 8, dt);
        sphereMat.anisotropyRotation = clutchNorm * Math.PI;
        sphereMat.sheen = THREE.MathUtils.damp(sphereMat.sheen, 0.18, 8, dt);
        const ns = (0.22 + (1 - hardnessNorm) * 0.2) * normalReliefFactor;
        sphereMat.normalScale.set(ns, ns);
      } else if (hap.material === 'matte-metal') {
        _sphereTint.set(isDarkNow ? '#94b8ad' : '#cbd5e1');
        sphereMat.color.lerp(_sphereTint, 1 - Math.exp(-8 * dt));
        sphereMat.metalness = THREE.MathUtils.damp(
          sphereMat.metalness,
          0.78 + hardnessNorm * 0.12 + clutchNorm * 0.1,
          8,
          dt
        );
        sphereMat.roughness = THREE.MathUtils.damp(
          sphereMat.roughness,
          0.11 + (1 - hardnessNorm) * 0.44,
          8,
          dt
        );
        sphereMat.transmission = THREE.MathUtils.damp(sphereMat.transmission, 0.0, 10, dt);
        sphereMat.opacity = 1.0;
        sphereMat.clearcoat = THREE.MathUtils.damp(
          sphereMat.clearcoat,
          0.1 + hardnessNorm * 0.48,
          8,
          dt
        );
        sphereMat.clearcoatRoughness = 0.06 + (1 - hardnessNorm) * 0.32;
        sphereMat.anisotropy = THREE.MathUtils.damp(
          sphereMat.anisotropy,
          0.35 + clutchNorm * 0.65,
          8,
          dt
        );
        sphereMat.anisotropyRotation = clutchNorm * Math.PI;
        sphereMat.sheen = THREE.MathUtils.damp(sphereMat.sheen, 0.0, 8, dt);
        const ns = (0.34 + (1 - hardnessNorm) * 0.22) * normalReliefFactor;
        sphereMat.normalScale.set(ns, ns);
      } else if (hap.material === 'abs-plastic') {
        _sphereTint.set(isDarkNow ? '#1d4d42' : '#e2e8f0');
        sphereMat.color.lerp(_sphereTint, 1 - Math.exp(-8 * dt));
        sphereMat.metalness = THREE.MathUtils.damp(sphereMat.metalness, 0.04, 8, dt);
        sphereMat.roughness = THREE.MathUtils.damp(
          sphereMat.roughness,
          0.22 + (1 - hardnessNorm) * 0.25,
          8,
          dt
        );
        sphereMat.transmission = THREE.MathUtils.damp(sphereMat.transmission, 0.08, 10, dt);
        sphereMat.opacity = 1.0;
        sphereMat.clearcoat = THREE.MathUtils.damp(
          sphereMat.clearcoat,
          0.42 + hardnessNorm * 0.32,
          8,
          dt
        );
        sphereMat.clearcoatRoughness = 0.16;
        sphereMat.anisotropy = THREE.MathUtils.damp(sphereMat.anisotropy, 0.08, 8, dt);
        sphereMat.sheen = THREE.MathUtils.damp(sphereMat.sheen, 0.06, 8, dt);
        const ns = 0.2 * normalReliefFactor;
        sphereMat.normalScale.set(ns, ns);
      } else {
        // 'suede' — tactile micro-fiber acoustic suede
        _sphereTint.set(isDarkNow ? '#2c5e4f' : '#585076');
        _sheenTint.set(isDarkNow ? '#a7f3d0' : '#e0e7ff');
        sphereMat.color.lerp(_sphereTint, 1 - Math.exp(-8 * dt));
        sphereMat.sheenColor.lerp(_sheenTint, 1 - Math.exp(-8 * dt));
        sphereMat.metalness = THREE.MathUtils.damp(
          sphereMat.metalness,
          0.02 + clutchNorm * 0.1,
          8,
          dt
        );
        sphereMat.roughness = THREE.MathUtils.damp(
          sphereMat.roughness,
          0.72 + (1 - hardnessNorm) * 0.24,
          8,
          dt
        );
        sphereMat.transmission = THREE.MathUtils.damp(sphereMat.transmission, 0.0, 10, dt);
        sphereMat.opacity = 1.0;
        sphereMat.clearcoat = THREE.MathUtils.damp(
          sphereMat.clearcoat,
          hardnessNorm * 0.18,
          8,
          dt
        );
        sphereMat.anisotropy = THREE.MathUtils.damp(sphereMat.anisotropy, clutchNorm * 0.25, 8, dt);
        sphereMat.anisotropyRotation = clutchNorm * Math.PI * 0.5;
        sphereMat.sheen = THREE.MathUtils.damp(
          sphereMat.sheen,
          0.65 + (1 - hardnessNorm) * 0.35,
          8,
          dt
        );
        sphereMat.sheenRoughness = 0.38 + (1 - hardnessNorm) * 0.45;
        const ns = (0.48 + durationNorm * 0.22) * normalReliefFactor;
        sphereMat.normalScale.set(ns, ns);
      }

      // Ensure contrasting roughness (>= 0.25 delta) on gimbal collar vs sphere
      const targetCollarRough = sphereMat.roughness < 0.4 ? 0.58 : 0.15;
      collarMat.roughness = THREE.MathUtils.damp(collarMat.roughness, targetCollarRough, 8, dt);

      // Kinetic excitation combining baseline strength, pulse pattern gate, click & hold * holdRampMultiplier
      const holdBoost = st.hold * (0.85 + rampNorm * 0.75);
      const liveBurst =
        _hapticTelemetry.patternGate * 0.95 +
        _hapticTelemetry.pressImpulse * 0.72 +
        holdBoost;
      const targetVibAmp =
        strengthNorm * (0.015 + Math.min(1.6, liveBurst) * 0.086) +
        _hapticTelemetry.clutchImpulse * 0.05 * enabledFactor;

      smoothedAmp = THREE.MathUtils.damp(smoothedAmp, targetVibAmp, 16, dt);

      const targetMode = materialToModeIndex(hap.material);
      smoothedMode = THREE.MathUtils.damp(smoothedMode, targetMode, 9, dt);

      const speedHz = 0.85 + hardnessNorm * 1.15 + Math.min(1.5, liveBurst) * 2.1 * strengthNorm;
      phaseTime += dt * speedHz;

      sphereShaderUniforms.uTime.value = phaseTime;
      sphereShaderUniforms.uVibAmp.value = smoothedAmp;
      sphereShaderUniforms.uModeType.value = smoothedMode;
      sphereShaderUniforms.uHardness.value = hardnessNorm;

      // Physical 3D micro-vibration jitter + second-order spring LRA core bounce
      const tremorMag =
        strengthNorm *
        (0.0035 +
          (_hapticTelemetry.patternGate * 0.026 +
            holdBoost * 0.03 +
            _hapticTelemetry.pressImpulse * 0.02));
      const tremorFreq = 38 + hardnessNorm * 52;
      const jitterX = Math.sin(now * 0.001 * tremorFreq * 6.28) * tremorMag;
      const jitterY = Math.cos(now * 0.001 * (tremorFreq * 1.17) * 6.28) * tremorMag * 0.85;

      const springForce =
        (_hapticTelemetry.pressImpulse * 0.22 -
          _hapticTelemetry.clutchImpulse * 0.28 * clutchNorm -
          coreSpringY) *
        (95 + hardnessNorm * 110);
      coreVelY = (coreVelY + springForce * dt) * Math.exp(-(7.5 - clutchNorm * 3.0) * dt);
      coreSpringY += coreVelY * dt;

      sphereAssembly.position.set(jitterX, 0.06 + jitterY + coreSpringY * 0.35, 0);
      seismicCore.position.y = coreSpringY * 0.65 + jitterY * 1.6;
      seismicCore.rotation.y += dt * (0.5 + strengthNorm * 1.8);

      _coilEmissive.set(eng.glowEnabled ? eng.glowColor : isDarkNow ? '#10b981' : '#4f46e5');
      coilMat.emissive.copy(_coilEmissive);
      coilMat.emissiveIntensity = 0.3 + strengthNorm * 0.95 + Math.min(1.3, liveBurst) * 1.25;

      // Gyroscopic gimbal collar & slow sphere rotation
      vibratingSphere.rotation.y += dt * (0.22 + strengthNorm * 0.42);
      gimbalCollar.rotation.y -= dt * (0.3 + strengthNorm * 0.6);
      gimbalCollar.rotation.x =
        0.22 + Math.sin(phaseTime * 1.4) * (0.04 + strengthNorm * 0.12) + coreSpringY * 0.45;
      dialMesh.rotation.z += dt * 0.08;

      // Update 28 Radial Force-Amplitude Micro-Needles
      const activeLitCount = Math.round(strengthNorm * NEEDLE_COUNT);
      for (let i = 0; i < NEEDLE_COUNT; i++) {
        const ang = (i / NEEDLE_COUNT) * Math.PI * 2;
        const isWithinStrength = i < activeLitCount;
        const harmonicWave =
          Math.abs(Math.sin(ang * (2 + Math.round(smoothedMode)) - phaseTime * 5.0)) *
          Math.min(1.2, liveBurst) *
          strengthNorm;
        const radialOffset =
          1.31 + (isWithinStrength ? 0.04 + strengthNorm * 0.09 : 0) + harmonicWave * 0.14;
        const lengthScale =
          (isWithinStrength ? 0.72 + strengthNorm * 0.75 : 0.36) + harmonicWave * 0.85;

        _dummy.position.set(Math.cos(ang) * radialOffset, 0, Math.sin(ang) * radialOffset);
        _dummy.rotation.set(0, -ang, 0);
        _dummy.scale.set(lengthScale, 1, 1);
        _dummy.updateMatrix();
        forceNeedles.setMatrixAt(i, _dummy.matrix);

        if (isWithinStrength) {
          const heat = Math.min(1, strengthNorm * 0.65 + harmonicWave * 0.6);
          if (isDarkNow) {
            _pinColor.setRGB(0.18 + heat * 0.35, 0.78 + heat * 0.2, 0.62 + heat * 0.25);
          } else {
            _pinColor.setRGB(0.31 + heat * 0.42, 0.32 + (1 - heat) * 0.22, 0.92);
          }
        } else {
          _pinColor.setHex(isDarkNow ? 0x16382f : 0xcbd5e1);
        }
        forceNeedles.setColorAt(i, _pinColor);
      }
      forceNeedles.instanceMatrix.needsUpdate = true;
      if (forceNeedles.instanceColor) forceNeedles.instanceColor.needsUpdate = true;

      if (resetCamRequestedRef.current) {
        camera.position.lerp(_camDefaultPos, 1 - Math.exp(-8 * dt));
        controls.target.lerp(_camDefaultTarget, 1 - Math.exp(-8 * dt));
        if (camera.position.distanceTo(_camDefaultPos) < 0.03) {
          resetCamRequestedRef.current = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(200, Math.floor(entry.contentRect.width));
        const h = Math.max(200, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    return () => {
      unmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      disposeHapticMaterialTextureSet(matTextureSet);
      engravingTex.dispose();
      shadowTex.dispose();
      dialMat.map?.dispose();
      envRT.dispose();
      renderer.dispose();
    };
  }, []);

  const isDark = palette === 'emerald-clinic';
  const currentProfile = MATERIAL_PROFILES[haptic.material];

  const cardSurfaceStyle: React.CSSProperties = {
    borderRadius: `${depth.borderRadius}px`,
    backgroundColor: isDark
      ? `rgba(11, 34, 29, ${Math.min(0.95, depth.glassOpacity + 0.14)})`
      : `rgba(255, 255, 255, ${Math.min(0.96, depth.glassOpacity + 0.16)})`,
    boxShadow: isDark
      ? `0 ${depth.elevation}px ${depth.blur}px rgba(0,0,0,0.46)`
      : `0 ${depth.elevation}px ${depth.blur}px rgba(88, 76, 148, 0.13)`,
  };

  return (
    <section
      style={cardSurfaceStyle}
      className="p-6 border border-white/80 dark:border-emerald-400/20"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 5 Cols: Real-Time Three.js Multi-Material 3D Haptic Sphere */}
        <div className="lg:col-span-5 relative min-h-[310px] sm:min-h-[340px] rounded-2xl overflow-hidden border border-white/75 dark:border-emerald-400/20">
          {/* Isolated WebGL Mount Container */}
          <div ref={canvasMountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {!webglReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center bg-gradient-to-br from-indigo-100 via-white to-violet-100 dark:from-emerald-950 dark:to-teal-950">
              <p className="text-sm font-semibold text-slate-800 dark:text-emerald-100">
                Wskaźnik Materiałowy 3D
              </p>
              <p className="text-xs text-slate-500 dark:text-emerald-200/75 mt-1">
                Odbicie: {liveMaterialStats.reflectivityPct}% · {currentProfile.label}
              </p>
            </div>
          )}

          {/* Top-Left Compact Surface & Optical Readout Badge */}
          <div
            style={{
              backgroundColor: isDark ? 'rgba(7, 24, 20, 0.9)' : 'rgba(255, 255, 255, 0.92)',
            }}
            className="pointer-events-none absolute top-3 left-3 z-10 rounded-xl px-3 py-1.5 border border-slate-200/75 dark:border-emerald-400/25 shadow-sm"
          >
            <div className="text-[11px] font-medium text-slate-500 dark:text-emerald-300/85">
              {currentProfile.label} · Odbicie {liveMaterialStats.reflectivityPct}% · Ra{' '}
              {liveMaterialStats.roughnessRa}
            </div>
            <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-emerald-50">
              {haptic.enabled ? `Siła ${haptic.intensity}%` : 'Haptyka wył.'}
              {activeHoldLevel > 0
                ? ` · +${Math.round(activeHoldLevel * 100)}%`
                : holdingSphere
                  ? ' · Aktywna'
                  : ''}
            </div>
          </div>

          {/* Bottom-Center Minimal Reset & Hint Bar */}
          <div
            style={{
              backgroundColor: isDark ? 'rgba(7, 24, 20, 0.9)' : 'rgba(255, 255, 255, 0.92)',
            }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 rounded-xl px-3 py-1 border border-slate-200/75 dark:border-emerald-400/25 flex items-center gap-2.5 text-[11px] text-slate-600 dark:text-emerald-200 whitespace-nowrap"
          >
            <span>Obracaj i przytrzymaj kulę 3D, aby zbadać teksturę</span>
            <button
              type="button"
              aria-label="Resetuj kamerę wskaźnika 3D"
              onClick={() => {
                resetCamRequestedRef.current = true;
              }}
              className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:text-emerald-300 dark:hover:text-white cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right 7 Cols: Live PBR Material & HapticSettingsPanel Synchronized Sliders */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex items-center gap-1.5">
                <span>Kula Materiałowa 3D (Three.js PBR)</span>
                <span aria-hidden="true">·</span>
                <span>Synchronizacja Live z Ustawieniami Haptyki</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-emerald-50 mt-0.5">
                {currentProfile.label} — Odbicie i Tekstura Live
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono tabular-nums text-slate-600 dark:text-emerald-200/85">
                <span>Odbicie światła: {liveMaterialStats.reflectivityPct}%</span>
                <span aria-hidden="true">·</span>
                <span>Metaliczność: {liveMaterialStats.metalnessPct}%</span>
                <span aria-hidden="true">·</span>
                <span>Głębia powłoki: {liveMaterialStats.thicknessMm} mm</span>
                <span aria-hidden="true">·</span>
                <span>Iryzacja: {liveMaterialStats.iridescencePct}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onOpenHapticSettings && (
                <button
                  type="button"
                  onClick={onOpenHapticSettings}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-white/80 dark:bg-emerald-950/75 text-slate-700 dark:text-emerald-100 border border-slate-200/80 dark:border-emerald-400/25 inline-flex items-center gap-1.5 hover:opacity-90 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Pełny panel haptyki</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const nextEnabled = !haptic.enabled;
                  updateHaptic({ enabled: nextEnabled });
                  if (nextEnabled) {
                    hapticAudio.triggerPress(synth, { ...haptic, enabled: true }, patterns);
                    pulseInteraction(0.9);
                  }
                }}
                className={`px-3 py-2 rounded-xl text-xs font-medium border inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  haptic.enabled
                    ? isDark
                      ? 'bg-emerald-900/75 text-emerald-100 border-emerald-400/35'
                      : 'bg-white/85 text-slate-800 border-slate-200'
                    : 'bg-slate-200/70 dark:bg-emerald-950/50 text-slate-500 dark:text-emerald-300/60 border-transparent'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{haptic.enabled ? 'Aktywna' : 'Wyciszona'}</span>
              </button>

              <button
                type="button"
                onPointerDown={() => {
                  hapticAudio.triggerPress(synth, haptic, patterns, { intensityScale: 1.2 });
                  pulseInteraction(1.15);
                  hapticAudio.startHoldRamp(
                    synth,
                    haptic,
                    (lvl) => setActiveHoldLevel(lvl),
                    haptic.material
                  );
                }}
                onPointerUp={() => {
                  hapticAudio.stopHoldRamp();
                  setActiveHoldLevel(0);
                  hapticAudio.triggerReleaseReverseClutch(haptic);
                }}
                onPointerLeave={() => {
                  if (activeHoldLevel > 0) {
                    hapticAudio.stopHoldRamp();
                    setActiveHoldLevel(0);
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 inline-flex items-center gap-1.5 hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
              >
                <Vibrate className="w-3.5 h-3.5" />
                <span>Testuj wibrację</span>
              </button>
            </div>
          </div>

          {/* 4 Material Texture Profiles (Optical Glass / Frosted Silica / CNC Metal / Suede) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(MATERIAL_PROFILES) as HapticMaterialType[]).map((matKey) => {
              const prof = MATERIAL_PROFILES[matKey];
              const selected = haptic.material === matKey;
              return (
                <button
                  key={matKey}
                  type="button"
                  onClick={() => selectMaterialProfile(matKey)}
                  className={`px-3 py-2 rounded-xl text-left border transition-colors cursor-pointer ${
                    selected
                      ? isDark
                        ? 'bg-emerald-400 text-emerald-950 border-emerald-300 shadow-sm'
                        : 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white/60 dark:bg-emerald-950/50 border-slate-200/80 dark:border-emerald-400/20 text-slate-700 dark:text-emerald-100 hover:bg-white/90 dark:hover:bg-emerald-900/55'
                  }`}
                >
                  <div className="text-xs font-semibold truncate">{prof.label}</div>
                  <div
                    className={`text-[10px] font-mono tabular-nums mt-0.5 ${
                      selected
                        ? isDark
                          ? 'text-emerald-950/80'
                          : 'text-slate-300'
                        : 'text-slate-500 dark:text-emerald-300/75'
                    }`}
                  >
                    {prof.defaultHardness} Sh · Sprzęgło {prof.defaultReverseClutch}%
                  </div>
                </button>
              );
            })}
          </div>

          {/* Synchronized Sliders Mirrors of HapticSettingsPanel Driving Real-Time 3D Material Optics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3 pt-1">
            <HapticSlider
              label="Twardość (Odbicie światła)"
              value={haptic.materialHardness}
              min={0}
              max={100}
              step={1}
              unit=" Sh"
              onChange={(v) => updateHaptic({ materialHardness: v })}
            />
            <HapticSlider
              label="Intensywność (Połysk i drgania)"
              value={haptic.intensity}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(v) => updateHaptic({ intensity: v })}
            />
            <HapticSlider
              label="Czas impulsu (Głębia szkła/ziarna)"
              value={haptic.durationMs}
              min={8}
              max={260}
              step={2}
              unit=" ms"
              onChange={(v) => updateHaptic({ durationMs: v })}
            />
            <HapticSlider
              label="Sprzęgło zwrotne (Anizotropia metalu)"
              value={haptic.reverseClutchForce}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(v) => updateHaptic({ reverseClutchForce: v })}
            />
            <HapticSlider
              label="Trzymanie (Iryzacja powłoki)"
              value={haptic.holdRampMultiplier}
              min={1}
              max={3}
              step={0.05}
              unit="×"
              onChange={(v) => updateHaptic({ holdRampMultiplier: v })}
            />
            <HapticSlider
              label="Grawerunek i mikro-tekstura"
              value={engraving.etchDepth}
              min={10}
              max={100}
              step={1}
              unit="%"
              onChange={(v) => updateEngraving({ etchDepth: v })}
            />
          </div>

          {/* Real-Time Haptic Pulse Cadence Visualizer + Subsurface Engraving Glow Status */}
          <div className="pt-3 border-t border-slate-200/70 dark:border-emerald-400/15 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-emerald-200/85 flex flex-wrap items-center gap-1.5">
              <span>Wzorzec:</span>
              <span className="font-semibold text-slate-900 dark:text-emerald-50">
                {activePatternObj?.name || 'Domyślny'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-emerald-300/80">
                {effectivePulses.length > 0
                  ? `[${effectivePulses.join(' · ')} ms]`
                  : 'Brak aktywnych impulsów'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-emerald-300/80">
                Luminancja ryciny: {engraving.glowEnabled ? `${engraving.glowIntensity}%` : '0%'}
              </span>
            </div>

            <div className="flex items-end gap-1 h-5" aria-label="Przebieg impulsów haptycznych">
              {(effectivePulses.length > 0 ? effectivePulses : [0, 0, 0]).map((ms, idx) => {
                const isVibrateSeg = idx % 2 === 0;
                const isFiringNow = livePulseSegment === idx;
                const normH = isVibrateSeg
                  ? Math.max(0.32, Math.min(1, (ms / 120) * (haptic.intensity / 100 + 0.25)))
                  : 0.2;
                return (
                  <div
                    key={`${idx}-${ms}`}
                    style={{
                      width: `${Math.max(8, Math.min(28, Math.round(ms * 0.45)))}px`,
                      transform: `scaleY(${isFiringNow ? Math.min(1.2, normH + 0.25) : normH})`,
                    }}
                    className={`h-full origin-bottom rounded-sm transition-transform duration-75 ${
                      isVibrateSeg
                        ? isFiringNow
                          ? isDark
                            ? 'bg-emerald-300'
                            : 'bg-indigo-600'
                          : isDark
                            ? 'bg-emerald-500/70'
                            : 'bg-indigo-400/80'
                        : 'bg-slate-300/55 dark:bg-emerald-900/55'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
