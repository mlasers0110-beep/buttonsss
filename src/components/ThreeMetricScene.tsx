import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, Maximize2, Minimize2, RotateCcw, Volume2 } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { HapticMaterialType, MATERIAL_PROFILES } from '../types/studio';
import { hapticAudio, RealtimeAudioHapticTelemetry } from '../lib/hapticAudioEngine';
import {
  createHapticMaterialTextureSet,
  disposeHapticMaterialTextureSet,
  updateSphereEngravingTexture,
} from '../lib/hapticSphereTextures';

// Pre-allocated scratch helpers outside render loop (zero GC in tick)
const _targetCamPos = new THREE.Vector3();
const _dummyObj = new THREE.Object3D();
const _tempColor = new THREE.Color();
const _emissiveColor = new THREE.Color();
const _pointerNdc = new THREE.Vector2();
const _telemetry: RealtimeAudioHapticTelemetry = {
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

function waveformToIndex(wf: OscillatorType): number {
  switch (wf) {
    case 'triangle':
      return 1;
    case 'sawtooth':
      return 2;
    case 'square':
      return 3;
    default:
      return 0;
  }
}

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

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
  grad.addColorStop(0, 'rgba(18, 16, 42, 0.52)');
  grad.addColorStop(0.5, 'rgba(18, 16, 42, 0.18)');
  grad.addColorStop(1, 'rgba(18, 16, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createChapterDialTexture(maxAnisotropy: number, darkTheme: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 512);
  const cx = 256;
  const cy = 256;

  ctx.strokeStyle = darkTheme ? 'rgba(116, 191, 161, 0.44)' : 'rgba(99, 102, 241, 0.38)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 224, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 168, 0, Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.stroke();

  for (let i = 0; i < 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    const inner = i % 4 === 0 ? 198 : 210;
    const outer = 222;
    ctx.lineWidth = i % 4 === 0 ? 2.4 : 1.1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

interface ThreeMetricSceneProps {
  metricMode: 'flebologia' | 'finance';
  onToggleMetricMode: () => void;
}

export const ThreeMetricScene: React.FC<ThreeMetricSceneProps> = ({
  metricMode,
  onToggleMetricMode,
}) => {
  const {
    palette,
    haptic,
    engraving,
    synth,
    patterns,
    selectMaterialProfile,
    interactionEnergy,
    activeHoldLevel,
    setActiveHoldLevel,
    pulseInteraction,
  } = useStudio();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [explodedAmount, setExplodedAmount] = useState(0.18);
  const [cameraPreset, setCameraPreset] = useState<'studio' | 'top' | 'macro'>('studio');
  const [webglReady, setWebglReady] = useState(true);
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Mutable refs read inside animation loop & pointer handlers so React state updates never rebuild WebGL
  const stateRef = useRef({
    palette,
    haptic,
    engraving,
    synth,
    patterns,
    energy: interactionEnergy,
    hold: activeHoldLevel,
    exploded: explodedAmount,
    cameraPreset,
    presetTransitioning: false,
  });

  const callbacksRef = useRef({
    setActiveHoldLevel,
    pulseInteraction,
  });

  useEffect(() => {
    callbacksRef.current = {
      setActiveHoldLevel,
      pulseInteraction,
    };
  }, [setActiveHoldLevel, pulseInteraction]);

  useEffect(() => {
    const prevPreset = stateRef.current.cameraPreset;
    stateRef.current = {
      palette,
      haptic,
      engraving,
      synth,
      patterns,
      energy: interactionEnergy,
      hold: activeHoldLevel,
      exploded: explodedAmount,
      cameraPreset,
      presetTransitioning:
        prevPreset !== cameraPreset ? true : stateRef.current.presetTransitioning,
    };
  }, [
    palette,
    haptic,
    engraving,
    synth,
    patterns,
    interactionEnergy,
    activeHoldLevel,
    explodedAmount,
    cameraPreset,
  ]);

  // Keyboard shortcut 'H' to toggle HUD dock in fullscreen 3D mode
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

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
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initW = Math.max(240, container.clientWidth);
    const initH = Math.max(220, container.clientHeight);
    renderer.setSize(initW, initH);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglReady(false);
    };
    const handleContextRestored = () => {
      setWebglReady(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    const initialBg = new THREE.Color(
      stateRef.current.palette === 'emerald-clinic'
        ? '#081915'
        : stateRef.current.palette === 'finance-ice'
          ? '#EAF1FF'
          : '#ECEFFA'
    );
    scene.background = initialBg;
    scene.fog = new THREE.FogExp2(initialBg.getHex(), 0.045);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(40, initW / initH, 0.1, 80);
    camera.position.set(0, 2.25, 5.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.5;
    controls.maxDistance = 10.5;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 1.18, 0);

    controls.addEventListener('start', () => {
      stateRef.current.presetTransitioning = false;
    });

    // Studio 3-Point Warm/Cool Rig
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x312e81, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.1);
    keyLight.position.set(4.2, 6.5, 4.0);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 18;
    keyLight.shadow.camera.left = -3.5;
    keyLight.shadow.camera.right = 3.5;
    keyLight.shadow.camera.top = 3.5;
    keyLight.shadow.camera.bottom = -3.5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xa5b4fc, 1.45);
    rimLight.position.set(-4.5, 3.2, -3.8);
    scene.add(rimLight);

    // Ground Floor + Contact Shadow + Precision Chapter Ring (offset on Y to prevent Z-fighting)
    const floorGeo = new THREE.CircleGeometry(14, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: initialBg,
      roughness: 0.88,
      metalness: 0.05,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(3.9, 3.9);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.012;
    scene.add(shadowPlane);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const dialTex = createChapterDialTexture(
      maxAniso,
      stateRef.current.palette === 'emerald-clinic'
    );
    const dialGeo = new THREE.PlaneGeometry(3.4, 3.4);
    const dialMat = new THREE.MeshBasicMaterial({
      map: dialTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const dialMesh = new THREE.Mesh(dialGeo, dialMat);
    dialMesh.rotation.x = -Math.PI / 2;
    dialMesh.position.y = 0.024;
    scene.add(dialMesh);

    // =========================================================================
    // Composite 9-Part Procedural Hero Sculpture Group (Pivoted at y = 0)
    // =========================================================================
    const heroGroup = new THREE.Group();
    heroGroup.position.set(0, 0, 0);
    scene.add(heroGroup);

    // Part 1: Stepped Beveled Pedestal Plinth (LatheGeometry, flush at y = 0)
    const plinthPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(1.22, 0),
      new THREE.Vector2(1.17, 0.11),
      new THREE.Vector2(0.98, 0.17),
      new THREE.Vector2(0.93, 0.27),
      new THREE.Vector2(0.62, 0.34),
      new THREE.Vector2(0, 0.34),
    ];
    const plinthGeo = new THREE.LatheGeometry(plinthPoints, 64);
    plinthGeo.computeTangents();
    const plinthMat = new THREE.MeshPhysicalMaterial({
      color: 0xdbe2f4,
      metalness: 0.78,
      roughness: 0.24,
      clearcoat: 0.6,
      anisotropy: 0.65,
    });
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
    plinthMesh.castShadow = true;
    plinthMesh.receiveShadow = true;
    heroGroup.add(plinthMesh);

    // Part 2: Fluted Tactile-Acoustic Core Shell (LatheGeometry + Live GLSL Uniforms)
    const shellProfile: THREE.Vector2[] = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const angle = t * Math.PI;
      const r = Math.sin(angle) * 0.85;
      const y = -Math.cos(angle) * 0.85;
      shellProfile.push(new THREE.Vector2(Math.max(0.001, r), y));
    }
    const shellGeo = new THREE.LatheGeometry(shellProfile, 112);
    shellGeo.computeTangents();

    const shellUniforms = {
      uTime: { value: 0 },
      uRibCount: { value: 18.0 },
      uWaveAmp: { value: 0.036 },
      uWaveformShape: { value: 0.0 },
      uTremor: { value: 0.0 },
    };

    const matTextureSet = createHapticMaterialTextureSet(maxAniso);
    let activeTexMaterial: HapticMaterialType = stateRef.current.haptic.material;
    const initialTexBundle = matTextureSet[activeTexMaterial];

    const engravingCanvas = document.createElement('canvas');
    engravingCanvas.width = 512;
    engravingCanvas.height = 256;
    const engravingTex = new THREE.CanvasTexture(engravingCanvas);
    engravingTex.wrapS = THREE.RepeatWrapping;
    engravingTex.wrapT = THREE.ClampToEdgeWrapping;
    engravingTex.colorSpace = THREE.SRGBColorSpace;
    engravingTex.anisotropy = maxAniso;
    let lastEngravingSig = '';
    updateSphereEngravingTexture(
      engravingCanvas,
      engravingTex,
      stateRef.current.engraving.symbol,
      stateRef.current.engraving.glowColor,
      stateRef.current.engraving.etchDepth
    );
    lastEngravingSig = `${stateRef.current.engraving.symbol}|${stateRef.current.engraving.glowColor}|${stateRef.current.engraving.etchDepth}`;

    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0xeef2ff,
      map: initialTexBundle.albedoMap,
      normalMap: initialTexBundle.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: initialTexBundle.roughnessMap,
      bumpMap: engravingTex,
      bumpScale: 0.018,
      emissive: new THREE.Color(stateRef.current.engraving.glowColor),
      emissiveMap: engravingTex,
      emissiveIntensity: stateRef.current.engraving.glowEnabled ? 0.32 : 0.0,
      metalness: 0.06,
      roughness: 0.14,
      envMapIntensity: 1.5,
      specularIntensity: 1.0,
      transmission: isSoftwareGl ? 0 : 0.82,
      transparent: true,
      opacity: isSoftwareGl ? 0.75 : 1.0,
      ior: 1.56,
      thickness: 1.4,
      attenuationDistance: 1.8,
      iridescence: 1.0,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [140, 480],
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      sheen: 0.0,
      sheenRoughness: 0.65,
      sheenColor: new THREE.Color(0xc4b5fd),
      anisotropy: 0.2,
      depthWrite:
        isSoftwareGl ||
        (activeTexMaterial !== 'shiny-glass' && activeTexMaterial !== 'frosted-glass'),
    });

    shellMat.customProgramCacheKey = () => 'aether-reactive-shell-v3';
    shellMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = shellUniforms.uTime;
      shader.uniforms.uRibCount = shellUniforms.uRibCount;
      shader.uniforms.uWaveAmp = shellUniforms.uWaveAmp;
      shader.uniforms.uWaveformShape = shellUniforms.uWaveformShape;
      shader.uniforms.uTremor = shellUniforms.uTremor;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        uniform float uTime;
        uniform float uRibCount;
        uniform float uWaveAmp;
        uniform float uWaveformShape;
        uniform float uTremor;

        float evalSynthWave(float phase, float mode) {
          float s = sin(phase);
          if (mode < 0.5) {
            return s;
          } else if (mode < 1.5) {
            // Triangle wave
            return (2.0 / 3.14159265) * asin(s);
          } else if (mode < 2.5) {
            // Smoothed sawtooth ridge
            return 2.0 * fract(phase / 6.2831853) - 1.0;
          } else {
            // Softened architectural square flute
            return clamp(s * 3.4, -1.0, 1.0);
          }
        }
        `
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float azimuth = atan(transformed.z, transformed.x);
        float phase = azimuth * uRibCount + transformed.y * 5.2 - uTime * 2.4;
        float ribWave = evalSynthWave(phase, uWaveformShape) * uWaveAmp;
        float holdMicro = sin(transformed.y * 22.0 + uTime * 28.0) * uTremor;
        transformed += normal * (ribWave + holdMicro);
        `
      );
    };

    const shellMesh = new THREE.Mesh(shellGeo, shellMat);
    shellMesh.position.y = 1.32;
    shellMesh.renderOrder = 4;
    shellMesh.castShadow = true;
    shellMesh.layers.enable(1);
    shellMesh.userData = {
      partLabel: 'Powłoka Rezonansowa (Szkło / Metal / Zamsz)',
      pitchSemitones: 0,
    };
    heroGroup.add(shellMesh);

    // Part 3: Inner Sub-Bass Faceted Nucleus (contrasting roughness >= 0.45)
    const nucleusGeo = new THREE.IcosahedronGeometry(0.42, 1);
    const nucleusMat = new THREE.MeshStandardMaterial({
      color: 0x818cf8,
      emissive: 0x6366f1,
      emissiveIntensity: 0.58,
      roughness: 0.54,
      metalness: 0.35,
    });
    const nucleusMesh = new THREE.Mesh(nucleusGeo, nucleusMat);
    nucleusMesh.position.y = 1.32;
    nucleusMesh.layers.enable(1);
    nucleusMesh.userData = {
      partLabel: 'Rdzeń Sub-Basowy Aether',
      pitchSemitones: -5,
    };
    heroGroup.add(nucleusMesh);

    // Part 4: Precision Anodized Reverse-Clutch Gimbal Ring
    const gimbalGeo = new THREE.TorusGeometry(1.13, 0.042, 24, 96);
    const gimbalMat = new THREE.MeshPhysicalMaterial({
      color: 0xc7d2fe,
      metalness: 0.94,
      roughness: 0.16,
      anisotropy: 0.85,
      clearcoat: 0.55,
    });
    const gimbalMesh = new THREE.Mesh(gimbalGeo, gimbalMat);
    gimbalMesh.position.y = 1.32;
    gimbalMesh.rotation.x = Math.PI * 0.38;
    gimbalMesh.castShadow = true;
    gimbalMesh.layers.enable(1);
    gimbalMesh.userData = {
      partLabel: 'Pierścień Sprzęgła Odwrotnego',
      pitchSemitones: 4,
    };
    heroGroup.add(gimbalMesh);

    // Part 5: Sculpted Acoustic Filter Meridian Arc (TubeGeometry)
    const arcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.28, 0.64, 0),
      new THREE.Vector3(-0.96, 2.06, 0.46),
      new THREE.Vector3(0, 2.44, 0),
      new THREE.Vector3(0.96, 2.06, -0.46),
      new THREE.Vector3(1.28, 0.64, 0),
    ]);
    const arcGeo = new THREE.TubeGeometry(arcCurve, 72, 0.028, 16, false);
    const arcMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.28,
      roughness: 0.08,
      clearcoat: 1.0,
      iridescence: 0.9,
    });
    const arcMesh = new THREE.Mesh(arcGeo, arcMat);
    arcMesh.castShadow = true;
    heroGroup.add(arcMesh);

    // Parts 6, 7, 8: Three Orbiting Harmonic Satellites (varied roughness & scale)
    const satellitesGroup = new THREE.Group();
    satellitesGroup.position.y = 1.32;
    heroGroup.add(satellitesGroup);

    const satGeo1 = new THREE.SphereGeometry(0.155, 32, 32);
    const satMat1 = new THREE.MeshPhysicalMaterial({
      color: 0xa5b4fc,
      metalness: 0.88,
      roughness: 0.14,
      iridescence: 0.9,
    });
    const sat1 = new THREE.Mesh(satGeo1, satMat1);
    sat1.position.set(1.42, 0.24, 0.2);
    sat1.castShadow = true;
    sat1.layers.enable(1);
    sat1.userData = {
      partLabel: 'Satelita Harmoniczny I (+7 półtonów)',
      pitchSemitones: 7,
    };
    satellitesGroup.add(sat1);

    const satGeo2 = new THREE.OctahedronGeometry(0.14, 2);
    const satMat2 = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      metalness: 0.15,
      roughness: 0.68,
    });
    const sat2 = new THREE.Mesh(satGeo2, satMat2);
    sat2.position.set(-1.34, -0.18, 0.55);
    sat2.castShadow = true;
    sat2.layers.enable(1);
    sat2.userData = {
      partLabel: 'Satelita Tłumienia Zamszowego (+9 półtonów)',
      pitchSemitones: 9,
    };
    satellitesGroup.add(sat2);

    const satGeo3 = new THREE.SphereGeometry(0.115, 28, 28);
    const satMat3 = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.55,
      roughness: 0.38,
      clearcoat: 1.0,
    });
    const sat3 = new THREE.Mesh(satGeo3, satMat3);
    sat3.position.set(0.35, 0.95, -1.25);
    sat3.castShadow = true;
    sat3.layers.enable(1);
    sat3.userData = {
      partLabel: 'Satelita Pogłosu Przestrzennego (+12 półtonów)',
      pitchSemitones: 12,
    };
    satellitesGroup.add(sat3);

    // 32 Real-Time Spectrum & Haptic Pattern Resonators via InstancedMesh
    const studCount = 32;
    const studGeo = new THREE.CylinderGeometry(0.022, 0.028, 0.12, 12);
    // Shift cylinder origin to bottom so vertical scaling grows upward cleanly from plinth
    studGeo.translate(0, 0.06, 0);
    const studMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.78,
      roughness: 0.24,
    });
    const studInstanced = new THREE.InstancedMesh(studGeo, studMat, studCount);
    studInstanced.frustumCulled = false;

    for (let i = 0; i < studCount; i++) {
      const a = (i / studCount) * Math.PI * 2;
      _dummyObj.position.set(Math.cos(a) * 1.06, 0.16, Math.sin(a) * 1.06);
      _dummyObj.rotation.set(0, -a, 0);
      _dummyObj.scale.set(1, 0.85, 1);
      _dummyObj.updateMatrix();
      studInstanced.setMatrixAt(i, _dummyObj.matrix);
      _tempColor.setHSL(0.62 + (i / studCount) * 0.18, 0.65, 0.72);
      studInstanced.setColorAt(i, _tempColor);
    }
    studInstanced.instanceMatrix.needsUpdate = true;
    if (studInstanced.instanceColor) studInstanced.instanceColor.needsUpdate = true;
    studInstanced.computeBoundingSphere();
    heroGroup.add(studInstanced);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // =========================================================================
    // Layer-1 Raycasting (Throttled Hover + Direct Press/Hold on 3D Parts)
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    let lastHoverRaycastMs = 0;
    let pointerDownPos = { x: 0, y: 0 };
    let holding3DPart = false;

    const updatePointerNdc = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      _pointerNdc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    };

    const onPointerMove = (e: PointerEvent) => {
      const nowMs = performance.now();
      if (nowMs - lastHoverRaycastMs < 48) return;
      lastHoverRaycastMs = nowMs;
      updatePointerNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(heroGroup.children, true);
      if (hits.length > 0) {
        const label = (hits[0].object.userData?.partLabel as string) || null;
        setHoveredPart((prev) => (prev === label ? prev : label));
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredPart((prev) => (prev === null ? prev : null));
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      updatePointerNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(heroGroup.children, true);
      if (hits.length > 0) {
        const hitObj = hits[0].object;
        const semitones = Number(hitObj.userData?.pitchSemitones ?? 0);
        const st = stateRef.current;
        holding3DPart = true;
        hapticAudio.triggerPress(st.synth, st.haptic, st.patterns, {
          pitchSemitones: semitones,
          intensityScale: 1.15,
        });
        callbacksRef.current.pulseInteraction(1.1);
        hapticAudio.startHoldRamp(
          st.synth,
          st.haptic,
          (lvl) => callbacksRef.current.setActiveHoldLevel(lvl),
          st.haptic.material
        );
      }
    };

    const stop3DHold = (e?: PointerEvent) => {
      if (!holding3DPart) return;
      holding3DPart = false;
      hapticAudio.stopHoldRamp();
      callbacksRef.current.setActiveHoldLevel(0);
      if (e) {
        const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
        if (dist < 10) {
          hapticAudio.triggerReleaseReverseClutch(stateRef.current.haptic);
        }
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', stop3DHold);
    renderer.domElement.addEventListener('pointerleave', () => {
      setHoveredPart(null);
    });

    // =========================================================================
    // Animation Loop (Zero-GC, Damped Kinematics & Software-WebGL Fence Pacing)
    // =========================================================================
    const clock = new THREE.Clock();
    let frameId = 0;
    let unmounted = false;
    let smoothedExplode = stateRef.current.exploded;
    let smoothedPulse = 0;
    let smoothedRibs = 18;
    let smoothedWaveShape = waveformToIndex(stateRef.current.synth.waveform);
    let smoothedClutchTwist = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (unmounted) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
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
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.getElapsedTime();
      const st = stateRef.current;
      const hap = st.haptic;
      const syn = st.synth;

      // Sample real-time Web Audio FFT + haptic impulses with zero allocations
      hapticAudio.sampleRealtimeTelemetry(dt, _telemetry);

      // Update palette colors smoothly
      const targetHex =
        st.palette === 'emerald-clinic'
          ? 0x071814
          : st.palette === 'finance-ice'
            ? 0xeaf2ff
            : 0xedeffa;
      _tempColor.setHex(targetHex);
      (scene.background as THREE.Color).lerp(_tempColor, 1 - Math.exp(-5 * dt));
      floorMat.color.copy(scene.background as THREE.Color);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(scene.background as THREE.Color);
      }

      // 1. Real-time Material + All 7 HapticSettingsPanel Sliders PBR Coupling
      const eng = st.engraving;
      const matSpec = MATERIAL_PROFILES[hap.material];
      const hardnessNorm = hap.materialHardness / 100;
      const intensityNorm = hap.enabled ? hap.intensity / 100 : 0;
      const durationNorm = THREE.MathUtils.clamp((hap.durationMs - 8) / (260 - 8), 0, 1);
      const clutchNorm = hap.reverseClutchForce / 100;
      const holdRampNorm = THREE.MathUtils.clamp((hap.holdRampMultiplier - 1.0) / 2.0, 0, 1);
      const etchNorm = THREE.MathUtils.clamp(eng.etchDepth / 100, 0.1, 1);
      const glowNorm = eng.glowEnabled ? eng.glowIntensity / 100 : 0;
      const cutoffNorm = Math.min(1, Math.max(0, (syn.filterCutoff - 250) / 7750));
      const freqNorm = Math.min(1, Math.max(0, (syn.baseFrequency - 36) / 122));

      // Zero-recompilation procedural PBR texture swap (glass vs frosted vs metal vs suede)
      if (activeTexMaterial !== hap.material) {
        activeTexMaterial = hap.material;
        const nextBundle = matTextureSet[activeTexMaterial];
        shellMat.map = nextBundle.albedoMap;
        shellMat.normalMap = nextBundle.normalMap;
        shellMat.roughnessMap = nextBundle.roughnessMap;
        shellMat.depthWrite =
          isSoftwareGl ||
          (activeTexMaterial !== 'shiny-glass' && activeTexMaterial !== 'frosted-glass');
      }

      // Duration slider scales micro-grain UV repeat density on the sphere
      const activeBundle = matTextureSet[activeTexMaterial];
      const baseRepX =
        activeTexMaterial === 'shiny-glass'
          ? 2
          : activeTexMaterial === 'matte-metal'
            ? 3
            : activeTexMaterial === 'frosted-glass'
              ? 5
              : 6;
      const baseRepY =
        activeTexMaterial === 'shiny-glass' || activeTexMaterial === 'matte-metal'
          ? 2
          : activeTexMaterial === 'frosted-glass'
            ? 3
            : 4;
      const grainScale = 0.8 + durationNorm * 0.65;
      activeBundle.albedoMap.repeat.set(baseRepX * grainScale, baseRepY * grainScale);
      activeBundle.normalMap.repeat.set(baseRepX * grainScale, baseRepY * grainScale);
      activeBundle.roughnessMap.repeat.set(baseRepX * grainScale, baseRepY * grainScale);

      // Update laser engraving bump/emissive texture when HapticSettingsPanel engraving changes
      const engSig = `${eng.symbol}|${eng.glowColor}|${eng.etchDepth}`;
      if (engSig !== lastEngravingSig) {
        lastEngravingSig = engSig;
        updateSphereEngravingTexture(
          engravingCanvas,
          engravingTex,
          eng.symbol,
          eng.glowColor,
          eng.etchDepth
        );
      }

      // Hardness + Intensity sliders govern light reflection, specular polish & IOR
      const isGlassMat =
        hap.material === 'shiny-glass' || hap.material === 'frosted-glass';
      const targetRoughness = THREE.MathUtils.clamp(
        matSpec.roughness3D * (1.32 - hardnessNorm * 0.56),
        0.025,
        0.96
      );
      const targetMetalness = THREE.MathUtils.clamp(
        matSpec.metalness3D + (hap.material === 'matte-metal' ? 0.08 : clutchNorm * 0.22),
        0.0,
        1.0
      );
      const targetEnvReflectivity =
        (hap.material === 'shiny-glass' || hap.material === 'matte-metal' ? 1.15 : 0.68) +
        hardnessNorm * 1.18 +
        intensityNorm * 0.48 +
        clutchNorm * 0.24;
      const targetClearcoat =
        hap.material === 'suede'
          ? hardnessNorm * 0.24
          : THREE.MathUtils.clamp(0.32 + hardnessNorm * 0.68, 0.12, 1.0);
      const targetClearcoatRoughness = THREE.MathUtils.clamp(
        (1 - hardnessNorm) * (hap.material === 'frosted-glass' ? 0.52 : 0.34),
        0.02,
        0.72
      );

      shellMat.roughness = THREE.MathUtils.damp(shellMat.roughness, targetRoughness, 8, dt);
      shellMat.metalness = THREE.MathUtils.damp(shellMat.metalness, targetMetalness, 8, dt);
      shellMat.envMapIntensity = THREE.MathUtils.damp(
        shellMat.envMapIntensity,
        targetEnvReflectivity,
        8,
        dt
      );
      shellMat.specularIntensity = THREE.MathUtils.damp(
        shellMat.specularIntensity,
        0.48 + hardnessNorm * 0.52 + intensityNorm * 0.36,
        8,
        dt
      );
      shellMat.clearcoat = THREE.MathUtils.damp(shellMat.clearcoat, targetClearcoat, 8, dt);
      shellMat.clearcoatRoughness = THREE.MathUtils.damp(
        shellMat.clearcoatRoughness,
        targetClearcoatRoughness,
        8,
        dt
      );
      shellMat.ior = THREE.MathUtils.damp(
        shellMat.ior,
        1.38 + hardnessNorm * 0.38 + (hap.material === 'shiny-glass' ? 0.08 : 0),
        7,
        dt
      );
      shellMat.thickness = THREE.MathUtils.damp(
        shellMat.thickness,
        isGlassMat ? 0.55 + durationNorm * 2.15 : 0.3 + durationNorm * 0.5,
        7,
        dt
      );
      shellMat.attenuationDistance = THREE.MathUtils.damp(
        shellMat.attenuationDistance,
        2.6 - durationNorm * 1.45,
        7,
        dt
      );
      shellMat.sheen = THREE.MathUtils.damp(
        shellMat.sheen,
        hap.material === 'suede' ? 0.65 + (1 - hardnessNorm) * 0.35 : 0.04,
        7,
        dt
      );
      shellMat.anisotropy = THREE.MathUtils.damp(
        shellMat.anisotropy,
        hap.material === 'matte-metal'
          ? THREE.MathUtils.clamp(0.45 + clutchNorm * 0.55, 0, 1)
          : clutchNorm * 0.58,
        7,
        dt
      );
      shellMat.anisotropyRotation = clutchNorm * Math.PI * 0.85;
      shellMat.iridescence = THREE.MathUtils.damp(
        shellMat.iridescence,
        THREE.MathUtils.clamp(
          (hap.material === 'suede' ? 0.08 : 0.25) +
            cutoffNorm * 0.38 +
            holdRampNorm * 0.45,
          0,
          1
        ),
        7,
        dt
      );

      // Etch depth & glow intensity sliders drive surface relief and subsurface laser glow
      const normalStrength =
        (hap.material === 'shiny-glass'
          ? 0.14
          : hap.material === 'matte-metal'
            ? 0.52
            : hap.material === 'frosted-glass'
              ? 0.68
              : 0.82) *
        (0.45 + etchNorm * 0.95);
      shellMat.normalScale.set(normalStrength, normalStrength);
      shellMat.bumpScale = 0.006 + etchNorm * 0.036;
      _emissiveColor.set(eng.glowColor);
      shellMat.emissive.lerp(_emissiveColor, 1 - Math.exp(-8 * dt));
      shellMat.emissiveIntensity = THREE.MathUtils.damp(
        shellMat.emissiveIntensity,
        glowNorm * (0.42 + intensityNorm * 0.55 + st.hold * 0.45),
        8,
        dt
      );
      keyLight.intensity = 1.85 + hardnessNorm * 0.45 + intensityNorm * 0.35;

      if (!isSoftwareGl) {
        const targetTrans = isGlassMat
          ? THREE.MathUtils.clamp(matSpec.transmission3D * (1 - clutchNorm * 0.32), 0.18, 0.96)
          : 0.0;
        shellMat.transmission = THREE.MathUtils.damp(shellMat.transmission, targetTrans, 7, dt);
      }

      // 2. Real-time GLSL Shader Uniforms (Waveform, Base Frequency, Harmonic Ratio, Intensity)
      const targetRibs = Math.round(8 + freqNorm * 16 + (syn.harmonicRatio - 1) * 4);
      smoothedRibs = THREE.MathUtils.damp(smoothedRibs, targetRibs, 7, dt);
      smoothedWaveShape = THREE.MathUtils.damp(
        smoothedWaveShape,
        waveformToIndex(syn.waveform),
        9,
        dt
      );

      const compliance = 1.28 - hardnessNorm * 0.55; // softer materials flex deeper
      const liveAcousticDrive =
        _telemetry.rms * 0.65 +
        _telemetry.bass * 0.45 +
        _telemetry.pressImpulse * 0.5 +
        st.hold * 0.9;

      shellUniforms.uTime.value = elapsed * (0.7 + freqNorm * 1.15);
      shellUniforms.uRibCount.value = smoothedRibs;
      shellUniforms.uWaveformShape.value = smoothedWaveShape;
      shellUniforms.uWaveAmp.value =
        (0.014 + intensityNorm * 0.028 + liveAcousticDrive * 0.046) * compliance;
      shellUniforms.uTremor.value =
        (st.hold * 0.022 + _telemetry.treble * 0.012) * Math.max(0.25, intensityNorm);

      // 3. Nucleus Sub-Bass & Filter Resonance Response
      const nucleusHex =
        st.palette === 'emerald-clinic'
          ? 0x34d399
          : st.palette === 'finance-ice'
            ? 0x3b82f6
            : 0x8b5cf6;
      _tempColor.setHex(nucleusHex);
      nucleusMat.color.lerp(_tempColor, 1 - Math.exp(-6 * dt));
      nucleusMat.emissive.lerp(_tempColor, 1 - Math.exp(-6 * dt));

      smoothedExplode = THREE.MathUtils.damp(smoothedExplode, st.exploded, 6, dt);
      smoothedPulse = THREE.MathUtils.damp(
        smoothedPulse,
        st.energy * 0.32 + liveAcousticDrive * 0.78,
        9,
        dt
      );

      const floatY = Math.sin(elapsed * (1.2 + freqNorm * 1.1)) * 0.042;
      shellMesh.position.y = 1.32 + smoothedExplode * 0.55 + floatY;
      const scaleBreath = 1 + smoothedPulse * 0.11 * compliance;
      shellMesh.scale.setScalar(scaleBreath);
      shellMesh.rotation.y += dt * (0.24 + freqNorm * 0.35 + smoothedPulse * 0.85);

      const subBassScale =
        1 + syn.subBassLevel * 0.32 + _telemetry.bass * 0.38 + st.hold * 0.25;
      nucleusMesh.position.y = 1.32 + smoothedExplode * 0.25 + floatY;
      nucleusMesh.scale.setScalar(subBassScale);
      nucleusMesh.rotation.x += dt * (0.55 + syn.harmonicRatio * 0.25);
      nucleusMesh.rotation.y -= dt * (0.45 + _telemetry.mid * 1.4);
      nucleusMat.emissiveIntensity =
        0.42 + syn.subBassLevel * 0.7 + smoothedPulse * 1.55 + (syn.filterResonance / 14) * 0.45;

      // 4. Reverse-Clutch Gimbal Torsion & Snapback
      smoothedClutchTwist = THREE.MathUtils.damp(
        smoothedClutchTwist,
        _telemetry.clutchImpulse * (0.4 + clutchNorm * 0.9),
        12,
        dt
      );
      gimbalMesh.position.y = 1.32 + smoothedExplode * 0.35 + floatY;
      gimbalMesh.rotation.x =
        Math.PI * (0.28 + clutchNorm * 0.22) - smoothedClutchTwist * 0.48;
      gimbalMesh.rotation.z = elapsed * 0.32 - smoothedClutchTwist * 0.85;
      gimbalMesh.scale.setScalar(1 + smoothedExplode * 0.22 + clutchNorm * 0.06);

      // 5. Meridian Tube Filter & Reverb Halo
      arcMesh.position.y = smoothedExplode * 0.72;
      arcMesh.rotation.y = Math.sin(elapsed * 0.45) * (0.18 + syn.reverbMix * 0.35);
      arcMesh.scale.setScalar(1 + syn.reverbMix * 0.14 + _telemetry.treble * 0.08);
      rimLight.intensity = 1.2 + cutoffNorm * 0.8 + _telemetry.rms * 0.9;

      // 6. Harmonic Satellites (Reverb spatial spread + Harmonic ratio speed)
      const reverbOrbitScale = 1 + syn.reverbMix * 0.28 + smoothedExplode * 0.32;
      satellitesGroup.position.y = 1.32 + smoothedExplode * 0.45;
      satellitesGroup.rotation.y +=
        dt * (0.32 * syn.harmonicRatio + smoothedPulse * 0.75);
      satellitesGroup.scale.setScalar(reverbOrbitScale);

      // 7. 32-Resonator Perimeter Ring (Active Haptic Pattern Pulses + Live 32-Bin FFT)
      const activePat =
        st.patterns.find((p) => p.id === hap.activePatternId) || st.patterns[0];
      const pulses = activePat?.pulses?.length ? activePat.pulses : [16, 18, 28];

      for (let i = 0; i < studCount; i++) {
        const a = (i / studCount) * Math.PI * 2;
        const patMs = pulses[i % pulses.length];
        const isVibSegment = (i % pulses.length) % 2 === 0;
        const patNorm = isVibSegment
          ? Math.min(1, patMs / 90) * intensityNorm
          : 0.12 * intensityNorm;

        const fftBin = _telemetry.bins[i] || 0;
        const waveTrav =
          Math.sin(a * 4 - elapsed * (2.2 + freqNorm * 3.5)) * 0.5 + 0.5;
        const barHeight =
          0.45 +
          patNorm * 1.35 +
          fftBin * 2.4 +
          waveTrav * 0.25 * cutoffNorm +
          st.hold * 0.9;

        const radiusOffset = 1.06 + fftBin * 0.08 + smoothedExplode * 0.08;
        _dummyObj.position.set(
          Math.cos(a) * radiusOffset,
          0.16,
          Math.sin(a) * radiusOffset
        );
        _dummyObj.rotation.set(0, -a, 0);
        _dummyObj.scale.set(1, barHeight, 1);
        _dummyObj.updateMatrix();
        studInstanced.setMatrixAt(i, _dummyObj.matrix);

        const hue =
          st.palette === 'emerald-clinic'
            ? 0.43 + fftBin * 0.08
            : 0.62 + (i / studCount) * 0.16 - fftBin * 0.12;
        const light = 0.56 + Math.min(0.34, fftBin * 0.35 + patNorm * 0.18);
        _tempColor.setHSL(hue, 0.72, light);
        studInstanced.setColorAt(i, _tempColor);
      }
      studInstanced.instanceMatrix.needsUpdate = true;
      if (studInstanced.instanceColor) studInstanced.instanceColor.needsUpdate = true;

      // Camera preset smooth exponential damping
      if (st.presetTransitioning) {
        if (st.cameraPreset === 'top') {
          _targetCamPos.set(0, 5.8, 1.4);
        } else if (st.cameraPreset === 'macro') {
          _targetCamPos.set(1.42, 1.62, 2.72);
        } else {
          _targetCamPos.set(0, 2.25, 5.4);
        }
        camera.position.lerp(_targetCamPos, 1 - Math.exp(-5 * dt));
        if (camera.position.distanceTo(_targetCamPos) < 0.04) {
          st.presetTransitioning = false;
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

    const resizeObserver = new ResizeObserver(() => {
      if (!container || unmounted) return;
      const w = Math.max(200, container.clientWidth);
      const h = Math.max(200, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      unmounted = true;
      hapticAudio.stopHoldRamp();
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', stop3DHold);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
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
      dialTex.dispose();
      envRT.dispose();
      renderer.dispose();
    };
  }, [isFullscreen]);

  const isDark = palette === 'emerald-clinic';
  const waveformLabel: Record<OscillatorType, string> = {
    sine: 'Sinus',
    triangle: 'Trójkąt',
    sawtooth: 'Piła',
    square: 'Kwadrat',
    custom: 'Własna',
  };

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen overflow-hidden'
          : 'relative w-full h-[400px] sm:h-[430px] rounded-3xl overflow-hidden border border-white/75 dark:border-emerald-400/20'
      }
    >
      {/* Isolated WebGL Mount Container (never apply backdrop-filter over WebGL!) */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {!webglReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-indigo-100 via-white to-violet-100 dark:from-emerald-950 dark:to-teal-950">
          <p className="text-sm font-semibold text-slate-800 dark:text-emerald-100">
            Podgląd 3D Aether Studio
          </p>
          <p className="text-xs text-slate-500 dark:text-emerald-200/70 mt-1">
            Kontekst WebGL jest chwilowo wstrzymany — metryki pozostają aktywne.
          </p>
        </div>
      )}

      {/* Top-Left Semantic Metric & Live Acoustic/Haptic Spec Overlay (Unobstructed Center) */}
      <div className="pointer-events-none absolute top-4 left-4 right-4 flex items-start justify-between gap-3 z-10">
        <div
          style={{
            backgroundColor: isDark ? 'rgba(7, 24, 20, 0.88)' : 'rgba(255, 255, 255, 0.9)',
          }}
          className="pointer-events-auto rounded-2xl px-4 py-2.5 border border-slate-200/70 dark:border-emerald-400/20 shadow-sm max-w-[72%]"
        >
          <button
            type="button"
            onClick={() => {
              hapticAudio.triggerPress(synth, haptic, patterns);
              onToggleMetricMode();
            }}
            className="text-left group cursor-pointer"
          >
            <div className="text-[11px] font-medium text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
              <span>
                {metricMode === 'finance'
                  ? 'Kapitał & Planowanie'
                  : 'Indeks Lekkości Flebologii'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="underline decoration-dotted">Przełącz widok</span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-2.5">
              <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight text-slate-900 dark:text-emerald-50">
                {metricMode === 'finance' ? '$12,752' : '98.4%'}
              </span>
              <span className="text-xs font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-300">
                {metricMode === 'finance' ? '+7.5%' : '+4.2 pkt'}
              </span>
            </div>
          </button>

          <div className="mt-1 pt-1 border-t border-slate-200/70 dark:border-emerald-400/15 text-[11px] font-mono tabular-nums text-slate-600 dark:text-emerald-200/85 truncate">
            {hoveredPart
              ? `Dotknij 3D: ${hoveredPart}`
              : `${waveformLabel[synth.waveform]} ${synth.baseFrequency} Hz · Filtr ${synth.filterCutoff} Hz · ${haptic.intensity}% (${haptic.materialHardness} Sh)`}
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            title="Wyzwól impuls testowy 3D"
            onPointerDown={() => {
              hapticAudio.triggerPress(synth, haptic, patterns, { intensityScale: 1.15 });
              pulseInteraction(1.1);
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
            style={{
              backgroundColor: isDark ? 'rgba(7, 24, 20, 0.9)' : 'rgba(255, 255, 255, 0.92)',
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-indigo-700 dark:text-emerald-200 border border-slate-200/80 dark:border-emerald-400/25 shadow-sm hover:opacity-95 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Impuls 3D</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticAudio.triggerPress(synth, haptic, patterns);
              pulseInteraction(0.8);
              setIsFullscreen((prev) => !prev);
            }}
            style={{
              backgroundColor: isDark ? 'rgba(7, 24, 20, 0.9)' : 'rgba(255, 255, 255, 0.92)',
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-800 dark:text-emerald-100 border border-slate-200/80 dark:border-emerald-400/25 shadow-sm hover:opacity-95 cursor-pointer whitespace-nowrap shrink-0"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Zamknij</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>100vh</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Unified Collapsible Bottom Control Dock (<= 15% viewport footprint, solid rgba surface, NO backdrop-filter over WebGL) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-3 z-10 w-[94%] max-w-[820px] transition-transform duration-200"
        style={{
          transform: dockCollapsed
            ? 'translate(-50%, calc(100% - 30px))'
            : 'translate(-50%, 0)',
        }}
      >
        <div className="flex justify-center mb-1">
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            style={{
              backgroundColor: isDark ? 'rgba(10, 31, 26, 0.92)' : 'rgba(255, 255, 255, 0.92)',
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium text-slate-700 dark:text-emerald-100 border border-slate-200/80 dark:border-emerald-400/25 cursor-pointer whitespace-nowrap"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3 h-3" />
                <span>Pokaż panel 3D</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                <span>Ukryj panel 3D</span>
              </>
            )}
          </button>
        </div>

        <div
          style={{
            backgroundColor: isDark ? 'rgba(8, 25, 21, 0.94)' : 'rgba(255, 255, 255, 0.94)',
          }}
          className="rounded-2xl px-4 py-2.5 border border-slate-200/80 dark:border-emerald-400/25 shadow-lg flex flex-wrap items-center justify-between gap-3"
        >
          {/* Exploded View Control */}
          <div className="flex items-center gap-2.5 min-w-[155px] flex-1">
            <span className="text-[11px] font-medium text-slate-600 dark:text-emerald-200 whitespace-nowrap">
              Rozstrzelenie
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={explodedAmount}
              aria-label="Rozstrzelenie warstw 3D"
              onChange={(e) => {
                const v = Number(e.target.value);
                setExplodedAmount(v);
                hapticAudio.triggerSliderTick(haptic, v);
              }}
              className="w-full accent-indigo-600 dark:accent-emerald-400 cursor-pointer"
            />
          </div>

          {/* Material Swatches */}
          <div className="flex items-center gap-1">
            {(
              [
                ['shiny-glass', 'Błysk'],
                ['frosted-glass', 'Mat'],
                ['matte-metal', 'Metal'],
                ['suede', 'Zamsz'],
              ] as [HapticMaterialType, string][]
            ).map(([matKey, shortLabel]) => (
              <button
                key={matKey}
                type="button"
                onClick={() => selectMaterialProfile(matKey)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  haptic.material === matKey
                    ? isDark
                      ? 'bg-emerald-400 text-emerald-950'
                      : 'bg-slate-900 text-white'
                    : 'text-slate-600 dark:text-emerald-200/80 hover:bg-slate-100 dark:hover:bg-emerald-900/50'
                }`}
              >
                {shortLabel}
              </button>
            ))}
          </div>

          {/* Camera Presets */}
          <div className="flex items-center gap-1">
            {(
              [
                ['studio', 'Studio'],
                ['macro', 'Makro'],
                ['top', 'Zenit'],
              ] as const
            ).map(([camId, label]) => (
              <button
                key={camId}
                type="button"
                onClick={() => {
                  setCameraPreset(camId);
                  stateRef.current.presetTransitioning = true;
                  hapticAudio.triggerPress(synth, haptic, patterns);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  cameraPreset === camId
                    ? 'bg-indigo-100 text-indigo-900 dark:bg-emerald-800/80 dark:text-emerald-100'
                    : 'text-slate-600 dark:text-emerald-200/75 hover:bg-slate-100 dark:hover:bg-emerald-900/40'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              aria-label="Resetuj widok 3D"
              onClick={() => {
                setExplodedAmount(0.18);
                setCameraPreset('studio');
                stateRef.current.presetTransitioning = true;
                hapticAudio.triggerReleaseReverseClutch(haptic);
              }}
              className="p-1.5 rounded-lg text-slate-500 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/50 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

