import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Check,
  Download,
  FileAudio,
  FileJson,
  Pause,
  Play,
  Radio,
  Repeat,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  hapticAudio,
  HapticOscilloscopeReadout,
  MATERIAL_ACOUSTIC_SIGNATURES,
} from '../lib/hapticAudioEngine';
import {
  exportHapticWaveformAndParams,
  HapticExportFormat,
  HapticExportRenderScope,
  HapticWaveformExportResult,
} from '../lib/hapticWaveformExporter';
import { HapticMaterialType, MATERIAL_PROFILES } from '../types/studio';

type TimebaseMsPerDiv = 2 | 5 | 10;
type VerticalGainScale = 1 | 2 | 4;

const SAMPLE_BUFFER_LEN = 1024;
const GRID_COLS = 10;
const GRID_ROWS = 6;

const QUICK_MATERIALS: Array<{
  id: HapticMaterialType;
  shortLabel: string;
  groupTag: string;
}> = [
  { id: 'shiny-glass', shortLabel: 'Szkło błyszczące', groupTag: 'Szkło' },
  { id: 'frosted-glass', shortLabel: 'Szkło matowe', groupTag: 'Szkło' },
  { id: 'matte-metal', shortLabel: 'Metal CNC', groupTag: 'Metal' },
  { id: 'abs-plastic', shortLabel: 'Plastik ABS', groupTag: 'Plastik' },
  { id: 'suede', shortLabel: 'Zamsz', groupTag: 'Zamsz' },
];

/**
 * Computes the analytical reference waveform (-1..+1) for the selected material,
 * synthesizer <160 Hz carrier, hardness, and intensity at elapsed time `tSec`.
 */
function evaluateMaterialModelSample(
  tSec: number,
  material: HapticMaterialType,
  baseLowHz: number,
  hardnessNorm: number,
  intensityNorm: number,
  waveformType: OscillatorType
): number {
  const sig = MATERIAL_ACOUSTIC_SIGNATURES[material];
  const f0 = Math.min(155, Math.max(34, baseLowHz * (0.88 + hardnessNorm * 0.1)));
  const decayBodySec = Math.max(0.028, sig.decayCharacterMs / 1000);
  const envBody = Math.min(1, tSec / 0.0025) * Math.exp(-tSec / decayBodySec);

  const phase0 = 2 * Math.PI * f0 * tSec;
  let carrier = Math.sin(phase0);
  if (waveformType === 'triangle') {
    carrier = (2 / Math.PI) * Math.asin(Math.sin(phase0));
  } else if (waveformType === 'square') {
    carrier = Math.tanh(2.8 * Math.sin(phase0));
  } else if (waveformType === 'sawtooth') {
    carrier = 2 * ((tSec * f0) - Math.floor(0.5 + tSec * f0));
  }

  // Material surface transient component
  const fSurf = sig.surfaceFormantHz * (0.92 + hardnessNorm * 0.16);
  let surfaceBurst = 0;

  if (material === 'shiny-glass') {
    surfaceBurst =
      (Math.sin(2 * Math.PI * fSurf * tSec) * 0.42 +
        Math.sin(2 * Math.PI * sig.secondaryFormantHz * tSec) * 0.22) *
      Math.exp(-tSec / 0.011);
  } else if (material === 'frosted-glass') {
    surfaceBurst =
      (Math.sin(2 * Math.PI * fSurf * tSec) * 0.3 +
        Math.sin(2 * Math.PI * sig.secondaryFormantHz * tSec) * 0.14) *
      Math.exp(-tSec / 0.015);
  } else if (material === 'matte-metal') {
    // Inharmonic aluminum plate ring + sharp initial detent spike
    surfaceBurst =
      (Math.sin(2 * Math.PI * fSurf * tSec) * 0.38 +
        Math.sin(2 * Math.PI * fSurf * 1.414 * tSec) * 0.28) *
        Math.exp(-tSec / 0.018) +
      (tSec < 0.0012 ? Math.cos(2 * Math.PI * 1800 * tSec) * 0.35 : 0);
  } else if (material === 'abs-plastic') {
    // Fast pitch-drop polymer dome snap + micro-bounce at 1.1 ms
    const chirpHz = 620 + (fSurf - 620) * Math.exp(-tSec / 0.008);
    const bounce =
      tSec >= 0.0011
        ? Math.sin(2 * Math.PI * 2400 * (tSec - 0.0011)) *
          Math.exp(-(tSec - 0.0011) / 0.0024) *
          0.34
        : 0;
    surfaceBurst =
      Math.sin(2 * Math.PI * chirpHz * tSec) * Math.exp(-tSec / 0.009) * 0.46 +
      bounce;
  } else {
    // Suede: soft low-frequency cushion without sharp transient spikes
    surfaceBurst =
      Math.sin(2 * Math.PI * 290 * tSec) * Math.exp(-tSec / 0.024) * 0.14;
  }

  const combined = (carrier * 0.56 * envBody + surfaceBurst) * Math.max(0.18, intensityNorm);
  return Math.max(-0.98, Math.min(0.98, combined));
}

export const HapticOscilloscopePanel: React.FC = () => {
  const {
    palette,
    depth,
    synth,
    haptic,
    patterns,
    engraving,
    driverCalibration,
    selectMaterialProfile,
    pulseInteraction,
  } = useStudio();

  const [timebaseMsPerDiv, setTimebaseMsPerDiv] = useState<TimebaseMsPerDiv>(5);
  const [verticalGain, setVerticalGain] = useState<VerticalGainScale>(2);
  const [isFrozen, setIsFrozen] = useState(false);
  const [autoPulseEnabled, setAutoPulseEnabled] = useState(false);
  const [continuousWaveEnabled, setContinuousWaveEnabled] = useState(false);
  const [showReferenceEnvelope, setShowReferenceEnvelope] = useState(true);

  const [exportFormat, setExportFormat] = useState<HapticExportFormat>('wav');
  const [exportScope, setExportScope] = useState<HapticExportRenderScope>('single-impulse');
  const [isExporting, setIsExporting] = useState(false);
  const [lastExportResult, setLastExportResult] = useState<HapticWaveformExportResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [hoverProbe, setHoverProbe] = useState<{
    normX: number;
    normY: number;
    timeMs: number;
    sampleVal: number;
  } | null>(null);

  const [telemetry, setTelemetry] = useState<{
    fundamentalHz: number;
    surfaceFormantHz: number;
    peakPercent: number;
    heldPeakPercent: number;
    amplitudeDb: number;
    isLiveSignal: boolean;
    sampleRate: number;
    patternGate: number;
  }>({
    fundamentalHz: Math.min(156, synth.baseFrequency),
    surfaceFormantHz: MATERIAL_ACOUSTIC_SIGNATURES[haptic.material].surfaceFormantHz,
    peakPercent: 0,
    heldPeakPercent: 0,
    amplitudeDb: -60,
    isLiveSignal: false,
    sampleRate: 48000,
    patternGate: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveSamplesRef = useRef<Float32Array>(new Float32Array(SAMPLE_BUFFER_LEN));
  const capturedSamplesRef = useRef<Float32Array>(new Float32Array(SAMPLE_BUFFER_LEN));
  const capturedAgeSecRef = useRef<number>(999);
  const heldPeakRef = useRef<number>(0);
  const lastUiSyncMsRef = useRef<number>(0);

  // Keep latest studio config in ref for 60 FPS canvas loop without recreating rAF
  const studioStateRef = useRef({
    palette,
    synth,
    haptic,
    patterns,
    timebaseMsPerDiv,
    verticalGain,
    isFrozen,
    showReferenceEnvelope,
    hoverProbe,
  });
  studioStateRef.current = {
    palette,
    synth,
    haptic,
    patterns,
    timebaseMsPerDiv,
    verticalGain,
    isFrozen,
    showReferenceEnvelope,
    hoverProbe,
  };

  const isDark = palette === 'emerald-clinic';
  const activeSig = MATERIAL_ACOUSTIC_SIGNATURES[haptic.material];
  const activeProfile = MATERIAL_PROFILES[haptic.material];
  const effectivePulses = useMemo(
    () => hapticAudio.computeEffectivePulses(haptic, patterns),
    [haptic, patterns]
  );
  const totalWindowMs = timebaseMsPerDiv * GRID_COLS;

  // Sync continuous carrier wave with Web Audio engine
  useEffect(() => {
    if (continuousWaveEnabled && !isFrozen) {
      hapticAudio.setContinuousMaterialCarrier(true, synth, haptic);
    } else {
      hapticAudio.stopContinuousMaterialCarrier();
    }
    return () => {
      hapticAudio.stopContinuousMaterialCarrier();
    };
  }, [continuousWaveEnabled, isFrozen, synth, haptic]);

  // Optional cyclic impulse generator (fires real material click every 680 ms)
  useEffect(() => {
    if (!autoPulseEnabled || isFrozen) return;
    hapticAudio.triggerPress(
      studioStateRef.current.synth,
      studioStateRef.current.haptic,
      studioStateRef.current.patterns
    );
    const id = window.setInterval(() => {
      hapticAudio.triggerPress(
        studioStateRef.current.synth,
        studioStateRef.current.haptic,
        studioStateRef.current.patterns
      );
    }, 680);
    return () => window.clearInterval(id);
  }, [autoPulseEnabled, isFrozen]);

  const handleFireImpulse = useCallback(() => {
    if (isFrozen) {
      setIsFrozen(false);
    }
    hapticAudio.triggerPress(synth, haptic, patterns);
    pulseInteraction(1.0);
  }, [isFrozen, synth, haptic, patterns, pulseInteraction]);

  const handleSelectMaterial = (mat: HapticMaterialType) => {
    if (isFrozen) {
      setIsFrozen(false);
    }
    heldPeakRef.current = 0;
    selectMaterialProfile(mat);
  };

  const handleResetPeakAndCapture = () => {
    heldPeakRef.current = 0;
    capturedSamplesRef.current.fill(0);
    capturedAgeSecRef.current = 999;
    setIsFrozen(false);
    setTelemetry((prev) => ({
      ...prev,
      peakPercent: 0,
      heldPeakPercent: 0,
      amplitudeDb: -60,
    }));
  };

  const handleExportWaveform = useCallback(
    async (overrideFormat?: HapticExportFormat) => {
      const targetFormat = overrideFormat || exportFormat;
      setIsExporting(true);
      setExportError(null);
      try {
        const activeCapture =
          capturedAgeSecRef.current < 30 ? capturedSamplesRef.current : liveSamplesRef.current;
        const result = await exportHapticWaveformAndParams(targetFormat, {
          synth,
          haptic,
          patterns,
          engraving,
          driverCalibration,
          scope: exportScope,
          capturedOscilloscopeSamples: activeCapture,
        });
        setLastExportResult(result);
      } catch (err) {
        setExportError(
          err instanceof Error
            ? err.message
            : 'Nie udało się wyrenderować pliku eksportu fali.'
        );
      } finally {
        setIsExporting(false);
      }
    },
    [exportFormat, exportScope, synth, haptic, patterns, engraving, driverCalibration]
  );

  // Real-time 60 FPS Web Audio Oscilloscope Canvas Renderer
  useEffect(() => {
    let rafId = 0;
    let prevFrameMs = performance.now();

    const renderLoop = (nowMs: number) => {
      const dt = Math.min(0.1, Math.max(0.001, (nowMs - prevFrameMs) / 1000));
      prevFrameMs = nowMs;

      const cfg = studioStateRef.current;
      const darkTheme = cfg.palette === 'emerald-clinic';
      const matSig = MATERIAL_ACOUSTIC_SIGNATURES[cfg.haptic.material];

      let readout: HapticOscilloscopeReadout | null = null;
      if (!cfg.isFrozen) {
        readout = hapticAudio.sampleOscilloscopeFrame(
          liveSamplesRef.current,
          cfg.haptic.material,
          cfg.synth.baseFrequency
        );

        // Capture crisp impulse peak frames into phosphor memory so fast clicks stay inspectable
        if (readout.peakAmplitude > 0.018) {
          if (
            readout.peakAmplitude >= heldPeakRef.current * 0.62 ||
            capturedAgeSecRef.current > 0.22
          ) {
            capturedSamplesRef.current.set(liveSamplesRef.current);
            capturedAgeSecRef.current = 0;
          }
          if (readout.peakAmplitude > heldPeakRef.current) {
            heldPeakRef.current = readout.peakAmplitude;
          }
        } else {
          capturedAgeSecRef.current += dt;
          heldPeakRef.current = Math.max(0, heldPeakRef.current * Math.exp(-0.35 * dt));
        }

        // Throttle React numeric state updates to ~16 Hz so tabular readouts stay crisp without churn
        if (nowMs - lastUiSyncMsRef.current > 60) {
          lastUiSyncMsRef.current = nowMs;
          setTelemetry({
            fundamentalHz: readout.isAudioActive
              ? readout.measuredFundamentalHz
              : readout.configuredSub160Hz,
            surfaceFormantHz: readout.isAudioActive
              ? readout.spectralCentroidHz
              : matSig.surfaceFormantHz,
            peakPercent: Math.min(100, Math.round(readout.peakAmplitude * 1000) / 10),
            heldPeakPercent: Math.min(100, Math.round(heldPeakRef.current * 1000) / 10),
            amplitudeDb: readout.amplitudeDb,
            isLiveSignal: readout.isAudioActive,
            sampleRate: readout.sampleRate,
            patternGate: readout.patternGate,
          });
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const cssW = canvas.clientWidth || 800;
        const cssH = canvas.clientHeight || 300;
        const targetW = Math.round(cssW * dpr);
        const targetH = Math.round(cssH * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const ctx2d = canvas.getContext('2d');
        if (ctx2d) {
          ctx2d.save();
          ctx2d.scale(dpr, dpr);

          // 1. Instrument Screen Background
          ctx2d.fillStyle = darkTheme ? '#05120F' : '#F8FAFC';
          ctx2d.fillRect(0, 0, cssW, cssH);

          const padLeft = 46;
          const padRight = 16;
          const padTop = 18;
          const padBottom = 42; // Reserve bottom lane for mechanical haptic pulse gate
          const plotW = Math.max(120, cssW - padLeft - padRight);
          const plotH = Math.max(100, cssH - padTop - padBottom);
          const midY = padTop + plotH / 2;

          // 2. Calibrated Oscilloscope Graticule (10 x 6 divisions)
          ctx2d.strokeStyle = darkTheme
            ? 'rgba(110, 231, 183, 0.11)'
            : 'rgba(100, 116, 139, 0.16)';
          ctx2d.lineWidth = 1;

          for (let c = 0; c <= GRID_COLS; c++) {
            const x = padLeft + (plotW * c) / GRID_COLS;
            ctx2d.beginPath();
            ctx2d.moveTo(x, padTop);
            ctx2d.lineTo(x, padTop + plotH);
            ctx2d.stroke();
          }

          for (let r = 0; r <= GRID_ROWS; r++) {
            const y = padTop + (plotH * r) / GRID_ROWS;
            ctx2d.beginPath();
            ctx2d.moveTo(padLeft, y);
            ctx2d.lineTo(padLeft + plotW, y);
            ctx2d.stroke();
          }

          // Zero-volt center axis with fine subdivision ticks
          ctx2d.strokeStyle = darkTheme
            ? 'rgba(110, 231, 183, 0.28)'
            : 'rgba(71, 85, 105, 0.32)';
          ctx2d.beginPath();
          ctx2d.moveTo(padLeft, midY);
          ctx2d.lineTo(padLeft + plotW, midY);
          ctx2d.stroke();

          for (let sub = 0; sub <= GRID_COLS * 5; sub++) {
            const sx = padLeft + (plotW * sub) / (GRID_COLS * 5);
            ctx2d.beginPath();
            ctx2d.moveTo(sx, midY - 3);
            ctx2d.lineTo(sx, midY + 3);
            ctx2d.stroke();
          }

          // Axis Scale Labels (Amplitude Y + Time ms X)
          ctx2d.font = '10px "JetBrains Mono", ui-monospace, monospace';
          ctx2d.fillStyle = darkTheme
            ? 'rgba(167, 243, 208, 0.68)'
            : 'rgba(71, 85, 105, 0.82)';
          ctx2d.textAlign = 'right';
          ctx2d.textBaseline = 'middle';

          const yLabels = [
            { r: 0, text: `+${(1 / cfg.verticalGain).toFixed(2)}` },
            { r: GRID_ROWS / 2, text: '0.00' },
            { r: GRID_ROWS, text: `-${(1 / cfg.verticalGain).toFixed(2)}` },
          ];
          yLabels.forEach(({ r, text }) => {
            const y = padTop + (plotH * r) / GRID_ROWS;
            ctx2d.fillText(text, padLeft - 6, y);
          });

          const windowMs = cfg.timebaseMsPerDiv * GRID_COLS;
          ctx2d.textAlign = 'center';
          ctx2d.textBaseline = 'top';
          for (let c = 0; c <= GRID_COLS; c += 2) {
            const x = padLeft + (plotW * c) / GRID_COLS;
            const msVal = c * cfg.timebaseMsPerDiv;
            ctx2d.fillText(`${msVal} ms`, x, padTop + plotH + 5);
          }

          // 3. CH2 Reference Material Acoustic Model Curve (dashed analytical profile)
          const hardnessNorm = cfg.haptic.materialHardness / 100;
          const intensityNorm = cfg.haptic.intensity / 100;
          const baseLowHz =
            cfg.synth.baseFrequency >= 160 ? 86 : cfg.synth.baseFrequency;

          if (cfg.showReferenceEnvelope) {
            ctx2d.save();
            ctx2d.setLineDash([4, 4]);
            ctx2d.lineWidth = 1.35;
            ctx2d.strokeStyle = darkTheme
              ? 'rgba(167, 243, 208, 0.34)'
              : 'rgba(99, 102, 241, 0.36)';
            ctx2d.beginPath();
            const steps = 320;
            for (let i = 0; i <= steps; i++) {
              const frac = i / steps;
              const tSec = (frac * windowMs) / 1000;
              const modelVal = evaluateMaterialModelSample(
                tSec,
                cfg.haptic.material,
                baseLowHz,
                hardnessNorm,
                intensityNorm,
                cfg.synth.waveform
              );
              const clampedY = Math.max(-1, Math.min(1, modelVal * cfg.verticalGain * 0.82));
              const x = padLeft + frac * plotW;
              const y = midY - clampedY * (plotH * 0.44);
              if (i === 0) ctx2d.moveTo(x, y);
              else ctx2d.lineTo(x, y);
            }
            ctx2d.stroke();
            ctx2d.restore();
          }

          // 4. CH1 Live / Captured Web Audio Waveform Trace
          const sampleRate = readout?.sampleRate || 48000;
          const samplesToPlot = Math.max(
            48,
            Math.min(
              SAMPLE_BUFFER_LEN,
              Math.round((windowMs / 1000) * sampleRate)
            )
          );

          const hasActiveLive =
            !cfg.isFrozen && readout ? readout.isAudioActive : false;
          const useCapturedMemory =
            cfg.isFrozen || (!hasActiveLive && capturedAgeSecRef.current < 12);

          const sourceBuffer = hasActiveLive
            ? liveSamplesRef.current
            : useCapturedMemory
              ? capturedSamplesRef.current
              : null;

          const primaryColor = darkTheme
            ? matSig.traceHexDark
            : matSig.traceHexLight;

          if (sourceBuffer) {
            const fadeAlpha = cfg.isFrozen
              ? 0.96
              : hasActiveLive
                ? 1.0
                : Math.max(0.32, 0.88 - capturedAgeSecRef.current * 0.05);

            ctx2d.save();
            ctx2d.globalAlpha = fadeAlpha;
            ctx2d.strokeStyle = primaryColor;
            ctx2d.lineWidth = hasActiveLive ? 2.25 : 1.85;
            ctx2d.lineJoin = 'round';
            ctx2d.beginPath();

            for (let px = 0; px <= plotW; px += 1.5) {
              const frac = px / plotW;
              const exactIdx = frac * (samplesToPlot - 1);
              const idx0 = Math.floor(exactIdx);
              const idx1 = Math.min(SAMPLE_BUFFER_LEN - 1, idx0 + 1);
              const tFrac = exactIdx - idx0;
              const sVal =
                sourceBuffer[idx0] * (1 - tFrac) + sourceBuffer[idx1] * tFrac;
              const scaled = Math.max(-1, Math.min(1, sVal * cfg.verticalGain));
              const x = padLeft + px;
              const y = midY - scaled * (plotH * 0.45);
              if (px === 0) ctx2d.moveTo(x, y);
              else ctx2d.lineTo(x, y);
            }
            ctx2d.stroke();
            ctx2d.restore();
          } else {
            // Flat 0V baseline when idle before any trigger
            ctx2d.strokeStyle = primaryColor;
            ctx2d.lineWidth = 1.6;
            ctx2d.beginPath();
            ctx2d.moveTo(padLeft, midY);
            ctx2d.lineTo(padLeft + plotW, midY);
            ctx2d.stroke();
          }

          // 5. Bottom Mechanical Haptic Pulse Sequence Lane (CH-HAP)
          const gateTopY = padTop + plotH + 21;
          const gateH = 14;
          const pulses = hapticAudio.computeEffectivePulses(
            cfg.haptic,
            cfg.patterns
          );
          ctx2d.font = '9px "JetBrains Mono", ui-monospace, monospace';
          ctx2d.textAlign = 'right';
          ctx2d.textBaseline = 'middle';
          ctx2d.fillStyle = darkTheme
            ? 'rgba(167, 243, 208, 0.65)'
            : 'rgba(71, 85, 105, 0.78)';
          ctx2d.fillText('HAP', padLeft - 6, gateTopY + gateH / 2);

          let cursorMs = 0;
          const gateSpanMs = Math.max(windowMs, pulses.reduce((a, b) => a + b, 0) || 60);
          ctx2d.strokeStyle = darkTheme ? '#34d399' : '#4f46e5';
          ctx2d.lineWidth = 1.4;
          ctx2d.beginPath();
          ctx2d.moveTo(padLeft, gateTopY + gateH);

          pulses.forEach((segMs, idx) => {
            const isOn = idx % 2 === 0;
            const xStart = padLeft + Math.min(1, cursorMs / gateSpanMs) * plotW;
            const xEnd =
              padLeft + Math.min(1, (cursorMs + segMs) / gateSpanMs) * plotW;
            const yLevel = isOn ? gateTopY + 2 : gateTopY + gateH;
            ctx2d.lineTo(xStart, yLevel);
            ctx2d.lineTo(xEnd, yLevel);
            if (isOn) {
              ctx2d.fillStyle = darkTheme
                ? 'rgba(52, 211, 153, 0.20)'
                : 'rgba(79, 70, 229, 0.14)';
              ctx2d.fillRect(xStart, gateTopY + 2, Math.max(1, xEnd - xStart), gateH - 2);
            }
            cursorMs += segMs;
          });
          ctx2d.lineTo(padLeft + plotW, gateTopY + gateH);
          ctx2d.stroke();

          // 6. Interactive Crosshair Cursor Measurement HUD
          if (cfg.hoverProbe) {
            const probeX =
              padLeft +
              Math.max(0, Math.min(1, (cfg.hoverProbe.normX * cssW - padLeft) / plotW)) *
                plotW;
            const probeFrac = Math.max(0, Math.min(1, (probeX - padLeft) / plotW));
            const probeTimeMs = probeFrac * windowMs;

            let probeAmp = 0;
            if (sourceBuffer) {
              const sIdx = Math.min(
                SAMPLE_BUFFER_LEN - 1,
                Math.round(probeFrac * (samplesToPlot - 1))
              );
              probeAmp = sourceBuffer[sIdx] || 0;
            } else {
              probeAmp = evaluateMaterialModelSample(
                probeTimeMs / 1000,
                cfg.haptic.material,
                baseLowHz,
                hardnessNorm,
                intensityNorm,
                cfg.synth.waveform
              );
            }

            const clampedProbeY = Math.max(
              -1,
              Math.min(1, probeAmp * cfg.verticalGain)
            );
            const snapY = midY - clampedProbeY * (plotH * 0.45);

            ctx2d.save();
            ctx2d.setLineDash([3, 3]);
            ctx2d.strokeStyle = darkTheme
              ? 'rgba(236, 253, 245, 0.55)'
              : 'rgba(15, 23, 42, 0.45)';
            ctx2d.lineWidth = 1;
            ctx2d.beginPath();
            ctx2d.moveTo(probeX, padTop);
            ctx2d.lineTo(probeX, padTop + plotH);
            ctx2d.moveTo(padLeft, snapY);
            ctx2d.lineTo(padLeft + plotW, snapY);
            ctx2d.stroke();
            ctx2d.restore();

            ctx2d.fillStyle = primaryColor;
            ctx2d.beginPath();
            ctx2d.arc(probeX, snapY, 4, 0, Math.PI * 2);
            ctx2d.fill();

            const hudText = `t=${probeTimeMs.toFixed(1)} ms · A=${(
              probeAmp * 100
            ).toFixed(1)}% · f₀=${
              cfg.synth.baseFrequency >= 160 ? 86 : cfg.synth.baseFrequency
            } Hz`;
            ctx2d.font = '11px "JetBrains Mono", ui-monospace, monospace';
            const textW = ctx2d.measureText(hudText).width + 16;
            const boxX = Math.min(cssW - padRight - textW, Math.max(padLeft + 6, probeX + 10));
            const boxY = padTop + 8;

            ctx2d.fillStyle = darkTheme
              ? 'rgba(6, 24, 20, 0.92)'
              : 'rgba(255, 255, 255, 0.94)';
            ctx2d.strokeStyle = darkTheme
              ? 'rgba(110, 231, 183, 0.35)'
              : 'rgba(148, 163, 184, 0.55)';
            ctx2d.lineWidth = 1;
            ctx2d.beginPath();
            ctx2d.roundRect(boxX, boxY, textW, 24, 6);
            ctx2d.fill();
            ctx2d.stroke();

            ctx2d.fillStyle = darkTheme ? '#ECFDF5' : '#0F172A';
            ctx2d.textAlign = 'left';
            ctx2d.textBaseline = 'middle';
            ctx2d.fillText(hudText, boxX + 8, boxY + 12);
          }

          ctx2d.restore();
        }
      }

      rafId = window.requestAnimationFrame(renderLoop);
    };

    rafId = window.requestAnimationFrame(renderLoop);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const cardSurfaceStyle: React.CSSProperties = {
    borderRadius: `${depth.borderRadius}px`,
    backdropFilter: `blur(${depth.glassBlur}px)`,
    backgroundColor: isDark
      ? `rgba(11, 34, 29, ${depth.glassOpacity})`
      : `rgba(255, 255, 255, ${depth.glassOpacity})`,
    boxShadow: isDark
      ? `0 ${depth.elevation}px ${depth.blur}px rgba(0,0,0,0.45)`
      : `0 ${depth.elevation}px ${depth.blur}px rgba(88, 76, 148, 0.12)`,
  };

  return (
    <section
      style={cardSurfaceStyle}
      className="p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-6"
    >
      {/* Top Header + Quick Material Switcher (Szkło, Metal, Plastik, Zamsz) */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
            <span>Analizator Czasowo-Częstotliwościowy Web Audio</span>
            <span aria-hidden="true">·</span>
            <span>Szkło · Metal · Plastik · Zamsz</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {Math.round(telemetry.sampleRate / 1000)} kHz / 2048 próbek
            </span>
          </div>
          <h2
            style={{ textWrap: 'balance' }}
            className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-emerald-50"
          >
            Oscyloskop Haptyczny
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-emerald-100/80 leading-relaxed">
            Rysuje w czasie rzeczywistym przebieg fali dźwiękowej (częstotliwość i amplitudę) oraz
            bramkę impulsów wibracji generowaną dla wybranego materiału powierzchniowego.
          </p>
        </div>

        {/* Material Selector Strip: Szkło / Metal / Plastik / Zamsz */}
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-200/75 dark:bg-emerald-950/85 border border-slate-300/60 dark:border-emerald-400/20">
          {QUICK_MATERIALS.map((item) => {
            const isSelected = haptic.material === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectMaterial(item.id)}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isSelected
                    ? isDark
                      ? 'bg-emerald-400 text-emerald-950 font-semibold shadow-sm'
                      : 'bg-slate-900 text-white font-semibold shadow-sm'
                    : 'text-slate-700 dark:text-emerald-200/80 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {item.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4-Column Scientific Telemetry Strip (Tabular Numerals + Unit Hierarchy) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white/75 dark:bg-emerald-950/65 border border-slate-200/85 dark:border-emerald-400/20">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80">
            Częstotliwość podstawowa f₀
          </div>
          <div className="mt-1 flex items-baseline">
            <span className="text-2xl font-mono font-semibold tabular-nums text-slate-900 dark:text-emerald-50">
              {telemetry.fundamentalHz.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-emerald-300/80 ml-1.5">
              Hz
            </span>
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-emerald-200/70 mt-1">
            Ton nośny korpusu: &lt;160 Hz ({synth.waveform})
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/75 dark:bg-emerald-950/65 border border-slate-200/85 dark:border-emerald-400/20">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80">
            Rezonans powierzchni ({activeSig.familyPl})
          </div>
          <div className="mt-1 flex items-baseline">
            <span className="text-2xl font-mono font-semibold tabular-nums text-slate-900 dark:text-emerald-50">
              {telemetry.surfaceFormantHz}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-emerald-300/80 ml-1.5">
              Hz
            </span>
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-emerald-200/70 mt-1 truncate">
            Dobroć Q={activeSig.formantQ.toFixed(1)} · Wygaszanie ~{activeSig.decayCharacterMs} ms
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/75 dark:bg-emerald-950/65 border border-slate-200/85 dark:border-emerald-400/20">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80">
            Amplituda chwilowa / Peak
          </div>
          <div className="mt-1 flex items-baseline">
            <span className="text-2xl font-mono font-semibold tabular-nums text-slate-900 dark:text-emerald-50">
              {Math.max(telemetry.peakPercent, telemetry.heldPeakPercent).toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-emerald-300/80 ml-1.5">
              %
            </span>
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-emerald-200/70 mt-1">
            Poziom RMS: {telemetry.amplitudeDb.toFixed(1)} dBFS · Siła {haptic.intensity}%
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/75 dark:bg-emerald-950/65 border border-slate-200/85 dark:border-emerald-400/20">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80">
            Stan toru i twardość materiału
          </div>
          <div className="mt-1 flex items-baseline">
            <span className="text-2xl font-mono font-semibold tabular-nums text-slate-900 dark:text-emerald-50">
              {haptic.materialHardness}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-emerald-300/80 ml-1.5">
              Shore
            </span>
          </div>
          <div
            className={`text-[11px] font-mono tabular-nums mt-1 ${
              isFrozen
                ? 'text-amber-600 dark:text-amber-300'
                : telemetry.isLiveSignal || continuousWaveEnabled || autoPulseEnabled
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-500 dark:text-emerald-200/70'
            }`}
          >
            {isFrozen
              ? '▲ Przebieg zamrożony (Hold)'
              : telemetry.isLiveSignal || continuousWaveEnabled
                ? '● Aktywny sygnał Web Audio'
                : '● Gotowy — wyzwól klik materiału'}
          </div>
        </div>
      </div>

      {/* Oscilloscope Viewport Canvas */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-emerald-200/85">
          <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
            <span>
              CH1: Przebieg akustyczny ({activeProfile.label})
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Okno: {totalWindowMs} ms ({timebaseMsPerDiv} ms/dz)
            </span>
            <span aria-hidden="true">·</span>
            <span>Wzmocnienie: {verticalGain}.0×</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-emerald-300/75">
            {activeSig.harmonicCharacterPl}
          </span>
        </div>

        <div className="rounded-2xl overflow-hidden border border-slate-300/85 dark:border-emerald-400/25 relative">
          <canvas
            ref={canvasRef}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              if (rect.width <= 0 || rect.height <= 0) return;
              const normX = (e.clientX - rect.left) / rect.width;
              const normY = (e.clientY - rect.top) / rect.height;
              setHoverProbe({
                normX,
                normY,
                timeMs: normX * totalWindowMs,
                sampleVal: 0,
              });
            }}
            onPointerLeave={() => setHoverProbe(null)}
            onClick={handleFireImpulse}
            title="Najedź kursorem, aby zmierzyć punkt przebiegu, lub kliknij ekran oscyloskopu, aby wyzwolić impuls materiału"
            className="w-full h-[290px] sm:h-[330px] block cursor-crosshair touch-none"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-500 dark:text-emerald-300/75">
          <span>
            Sekwencja bramki haptycznej HAP: [{effectivePulses.join(', ')}] ms
          </span>
          <span>
            Kliknij wykres lub przycisk poniżej, aby wzbudzić falę wybranego materiału
          </span>
        </div>
      </div>

      {/* Instrument Controls Bar */}
      <div className="pt-4 border-t border-slate-200/75 dark:border-emerald-400/15 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleFireImpulse}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap shrink-0"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Wyzwól impuls ({activeSig.familyPl})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAutoPulseEnabled((v) => !v);
              if (isFrozen) setIsFrozen(false);
            }}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              autoPulseEnabled
                ? isDark
                  ? 'bg-emerald-800 border-emerald-300 text-emerald-50 font-semibold'
                  : 'bg-indigo-600 border-indigo-600 text-white font-semibold'
                : 'bg-white/80 dark:bg-emerald-950/75 border-slate-200/80 dark:border-emerald-400/25 text-slate-700 dark:text-emerald-100'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>{autoPulseEnabled ? 'Auto-impuls: WŁ.' : 'Auto-impuls cykliczny'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setContinuousWaveEnabled((v) => !v);
              if (isFrozen) setIsFrozen(false);
            }}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              continuousWaveEnabled
                ? isDark
                  ? 'bg-emerald-800 border-emerald-300 text-emerald-50 font-semibold'
                  : 'bg-indigo-600 border-indigo-600 text-white font-semibold'
                : 'bg-white/80 dark:bg-emerald-950/75 border-slate-200/80 dark:border-emerald-400/25 text-slate-700 dark:text-emerald-100'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{continuousWaveEnabled ? 'Fala ciągła CW: WŁ.' : 'Fala ciągła CW'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFrozen((f) => !f)}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              isFrozen
                ? 'bg-amber-500 border-amber-500 text-slate-950 font-semibold'
                : 'bg-white/80 dark:bg-emerald-950/75 border-slate-200/80 dark:border-emerald-400/25 text-slate-700 dark:text-emerald-100'
            }`}
          >
            {isFrozen ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isFrozen ? 'Wznów pomiar' : 'Zamroź przebieg'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetPeakAndCapture}
            aria-label="Wyczyść pamięć oscyloskopu"
            className="min-h-[42px] px-3 py-2 rounded-xl bg-white/80 dark:bg-emerald-950/75 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Timebase, Vertical Gain & Model Curve Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/75 dark:bg-emerald-950/85 text-xs font-mono tabular-nums">
            {([2, 5, 10] as TimebaseMsPerDiv[]).map((tb) => (
              <button
                key={tb}
                type="button"
                onClick={() => setTimebaseMsPerDiv(tb)}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap shrink-0 ${
                  timebaseMsPerDiv === tb
                    ? isDark
                      ? 'bg-emerald-400 text-emerald-950 font-semibold'
                      : 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-emerald-200/75'
                }`}
              >
                {tb} ms/dz
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/75 dark:bg-emerald-950/85 text-xs font-mono tabular-nums">
            {([1, 2, 4] as VerticalGainScale[]).map((gain) => (
              <button
                key={gain}
                type="button"
                onClick={() => setVerticalGain(gain)}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap shrink-0 ${
                  verticalGain === gain
                    ? isDark
                      ? 'bg-emerald-400 text-emerald-950 font-semibold'
                      : 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-emerald-200/75'
                }`}
              >
                {gain}×
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowReferenceEnvelope((s) => !s)}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              showReferenceEnvelope
                ? isDark
                  ? 'bg-emerald-900/70 border-emerald-400/40 text-emerald-100'
                  : 'bg-indigo-50 border-indigo-300 text-indigo-900'
                : 'bg-white/65 dark:bg-emerald-950/60 border-slate-200 dark:border-emerald-400/20 text-slate-600 dark:text-emerald-200/75'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Obwiednia CH2</span>
          </button>
        </div>
      </div>

      {/* Waveform & Haptic Parameters Export Strip (WAV 48 kHz PCM or JSON Telemetry) */}
      <div className="pt-4 border-t border-slate-200/75 dark:border-emerald-400/15 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="text-xs font-semibold text-slate-800 dark:text-emerald-100">
            Eksport wygenerowanej fali dźwiękowej i parametrów haptycznych
          </div>
          <div className="text-[11px] text-slate-500 dark:text-emerald-300/75 flex flex-wrap items-center gap-1.5 font-mono tabular-nums">
            <span>WAV: 48 kHz · 16-bit Stereo PCM</span>
            <span aria-hidden="true">·</span>
            <span>JSON: 512 próbek fali + profil {activeProfile.label}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Selector: Single Click vs Full Pattern */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/75 dark:bg-emerald-950/85 text-xs">
            <button
              type="button"
              onClick={() => setExportScope('single-impulse')}
              className={`min-h-[34px] px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                exportScope === 'single-impulse'
                  ? isDark
                    ? 'bg-emerald-400 text-emerald-950 font-semibold'
                    : 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-emerald-200/75'
              }`}
            >
              Pojedynczy impuls
            </button>
            <button
              type="button"
              onClick={() => setExportScope('pattern-sequence')}
              className={`min-h-[34px] px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                exportScope === 'pattern-sequence'
                  ? isDark
                    ? 'bg-emerald-400 text-emerald-950 font-semibold'
                    : 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-emerald-200/75'
              }`}
            >
              Sekwencja wzorca
            </button>
          </div>

          {/* Format Selector: WAV vs JSON */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/75 dark:bg-emerald-950/85 text-xs font-mono">
            <button
              type="button"
              onClick={() => setExportFormat('wav')}
              className={`min-h-[34px] px-3 py-1 rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                exportFormat === 'wav'
                  ? isDark
                    ? 'bg-emerald-400 text-emerald-950 font-semibold'
                    : 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-emerald-200/75'
              }`}
            >
              <FileAudio className="w-3.5 h-3.5" />
              <span>WAV</span>
            </button>
            <button
              type="button"
              onClick={() => setExportFormat('json')}
              className={`min-h-[34px] px-3 py-1 rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                exportFormat === 'json'
                  ? isDark
                    ? 'bg-emerald-400 text-emerald-950 font-semibold'
                    : 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-emerald-200/75'
              }`}
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
          </div>

          {/* Primary Export Action Button */}
          <button
            type="button"
            disabled={isExporting}
            onClick={() => handleExportWaveform()}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer hover:opacity-95 disabled:opacity-60 whitespace-nowrap shrink-0 transition-opacity"
          >
            <Download className="w-4 h-4" />
            <span>
              {isExporting
                ? 'Renderowanie pliku...'
                : exportFormat === 'wav'
                  ? 'Eksportuj falę (.WAV)'
                  : 'Eksportuj falę i haptykę (.JSON)'}
            </span>
          </button>
        </div>
      </div>

      {exportError && (
        <div className="text-xs text-rose-600 dark:text-rose-300 font-medium">
          {exportError}
        </div>
      )}

      {lastExportResult && !exportError && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
          <span className="inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>Zapisano: {lastExportResult.filename}</span>
          </span>
          <span className="text-slate-500 dark:text-emerald-200/80">
            {(lastExportResult.sizeBytes / 1024).toFixed(1)} KB · {lastExportResult.durationMs} ms ·{' '}
            {Math.round(lastExportResult.sampleRate / 1000)} kHz · Peak{' '}
            {(lastExportResult.peakAmplitude * 100).toFixed(1)}%
          </span>
        </div>
      )}
    </section>
  );
};
