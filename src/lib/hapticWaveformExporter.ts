import {
  CustomHapticPattern,
  EngravingBacklightSettings,
  HapticMaterialType,
  HapticSettings,
  MATERIAL_PROFILES,
  RotaryDriverCalibrationConfig,
  SynthPatchSettings,
} from '../types/studio';
import {
  hapticAudio,
  MATERIAL_ACOUSTIC_SIGNATURES,
} from './hapticAudioEngine';

export type HapticExportFormat = 'wav' | 'json';
export type HapticExportRenderScope = 'single-impulse' | 'pattern-sequence';

export interface HapticWaveformExportInput {
  synth: SynthPatchSettings;
  haptic: HapticSettings;
  patterns: CustomHapticPattern[];
  engraving?: EngravingBacklightSettings;
  driverCalibration?: RotaryDriverCalibrationConfig;
  scope?: HapticExportRenderScope;
  capturedOscilloscopeSamples?: Float32Array | null;
}

export interface HapticWaveformExportResult {
  format: HapticExportFormat;
  filename: string;
  sizeBytes: number;
  durationMs: number;
  sampleRate: number;
  peakAmplitude: number;
  rmsDbFs: number;
}

const EXPORT_SAMPLE_RATE = 48000;

function createDeterministicClickBuffer(
  ctx: BaseAudioContext,
  mode: 'press' | 'release'
): AudioBuffer {
  const rate = ctx.sampleRate;
  const durationSec = mode === 'press' ? 0.011 : 0.008;
  const length = Math.max(32, Math.floor(rate * durationSec));
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);

  let seed = mode === 'press' ? 0x9e3779b9 : 0x517cc1b7;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  for (let i = 0; i < length; i++) {
    const t = i / rate;
    const contactStrike =
      t < 0.00045
        ? Math.sin((t / 0.00045) * Math.PI * 2.0) * Math.exp(-t / 0.00022) * 1.15
        : 0;
    const bounceCenter = mode === 'press' ? 0.0011 : 0.00085;
    const dtBounce = t - bounceCenter;
    const leafBounce =
      dtBounce >= 0
        ? Math.sin(dtBounce * 21000) * Math.exp(-dtBounce / 0.00038) * 0.52
        : 0;
    const noiseBurst =
      nextRand() * Math.exp(-t / (mode === 'press' ? 0.00095 : 0.00075)) * 0.72;

    data[i] = Math.max(-1, Math.min(1, contactStrike + leafBounce + noiseBurst));
  }

  return buffer;
}

function createDeterministicImpulseReverb(
  ctx: BaseAudioContext,
  durationSec: number,
  decayPower: number
): ConvolverNode {
  const rate = ctx.sampleRate;
  const length = Math.max(64, Math.floor(rate * durationSec));
  const impulse = ctx.createBuffer(2, length, rate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let seed = ch === 0 ? 0x243f6a88 : 0x85a308d3;
    for (let i = 0; i < length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const white = (seed / 0xffffffff) * 2 - 1;
      data[i] = white * Math.pow(1 - i / length, decayPower);
    }
  }

  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  return convolver;
}

function scheduleMouseSnapOnGraph(
  ctx: BaseAudioContext,
  outNode: AudioNode,
  clickBuf: AudioBuffer,
  whenSec: number,
  gainScale: number,
  mode: 'press' | 'release'
): void {
  const src = ctx.createBufferSource();
  src.buffer = clickBuf;

  const snapBand = ctx.createBiquadFilter();
  snapBand.type = 'bandpass';
  snapBand.frequency.setValueAtTime(mode === 'press' ? 3450 : 2550, whenSec);
  snapBand.Q.setValueAtTime(2.35, whenSec);

  const snapGain = ctx.createGain();
  snapGain.gain.setValueAtTime((mode === 'press' ? 0.58 : 0.34) * gainScale, whenSec);

  const shellBand = ctx.createBiquadFilter();
  shellBand.type = 'bandpass';
  shellBand.frequency.setValueAtTime(mode === 'press' ? 1680 : 1340, whenSec);
  shellBand.Q.setValueAtTime(1.75, whenSec);

  const shellGain = ctx.createGain();
  shellGain.gain.setValueAtTime((mode === 'press' ? 0.44 : 0.26) * gainScale, whenSec);

  src.connect(snapBand);
  snapBand.connect(snapGain);
  snapGain.connect(outNode);

  src.connect(shellBand);
  shellBand.connect(shellGain);
  shellGain.connect(outNode);

  src.start(whenSec);
}

function scheduleMaterialResonatorOnGraph(
  ctx: BaseAudioContext,
  outNode: AudioNode,
  whenSec: number,
  mat: HapticMaterialType,
  intensityNorm: number,
  hardnessNorm: number
): void {
  const sig = MATERIAL_ACOUSTIC_SIGNATURES[mat];
  const f1 = sig.surfaceFormantHz * (0.92 + hardnessNorm * 0.16);
  const f2 = sig.secondaryFormantHz * (0.92 + hardnessNorm * 0.16);

  if (mat === 'shiny-glass' || mat === 'frosted-glass') {
    const glassDecay = mat === 'shiny-glass' ? 0.036 : 0.046;
    const mode1 = ctx.createOscillator();
    const mode2 = ctx.createOscillator();
    mode1.type = 'sine';
    mode2.type = 'sine';
    mode1.frequency.setValueAtTime(f1, whenSec);
    mode2.frequency.setValueAtTime(f2, whenSec);

    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    const amp = (mat === 'shiny-glass' ? 0.14 : 0.095) * intensityNorm;
    g1.gain.setValueAtTime(Math.max(0.0002, amp), whenSec);
    g1.gain.exponentialRampToValueAtTime(0.0001, whenSec + glassDecay);
    g2.gain.setValueAtTime(Math.max(0.0002, amp * 0.48), whenSec);
    g2.gain.exponentialRampToValueAtTime(0.0001, whenSec + glassDecay * 0.72);

    mode1.connect(g1);
    mode2.connect(g2);
    g1.connect(outNode);
    g2.connect(outNode);
    mode1.start(whenSec);
    mode2.start(whenSec);
    mode1.stop(whenSec + glassDecay + 0.006);
    mode2.stop(whenSec + glassDecay + 0.006);
  } else if (mat === 'matte-metal') {
    const metalDecay = 0.052;
    const m1 = ctx.createOscillator();
    const m2 = ctx.createOscillator();
    m1.type = 'triangle';
    m2.type = 'sine';
    m1.frequency.setValueAtTime(f1, whenSec);
    m2.frequency.setValueAtTime(f2, whenSec);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(f1, whenSec);
    bp.Q.setValueAtTime(sig.formantQ, whenSec);

    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, 0.16 * intensityNorm), whenSec);
    g.gain.exponentialRampToValueAtTime(0.0001, whenSec + metalDecay);

    m1.connect(bp);
    m2.connect(bp);
    bp.connect(g);
    g.connect(outNode);
    m1.start(whenSec);
    m2.start(whenSec);
    m1.stop(whenSec + metalDecay + 0.008);
    m2.stop(whenSec + metalDecay + 0.008);
  } else if (mat === 'abs-plastic') {
    const plasticDecay = 0.022;
    const popOsc = ctx.createOscillator();
    popOsc.type = 'triangle';
    popOsc.frequency.setValueAtTime(f1, whenSec);
    popOsc.frequency.exponentialRampToValueAtTime(620, whenSec + plasticDecay);

    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, 0.19 * intensityNorm), whenSec);
    g.gain.exponentialRampToValueAtTime(0.0001, whenSec + plasticDecay);

    popOsc.connect(g);
    g.connect(outNode);
    popOsc.start(whenSec);
    popOsc.stop(whenSec + plasticDecay + 0.005);
  } else {
    const suedeDecay = 0.058;
    const cushionOsc = ctx.createOscillator();
    cushionOsc.type = 'sine';
    cushionOsc.frequency.setValueAtTime(Math.min(380, f1 * 0.65), whenSec);
    cushionOsc.frequency.exponentialRampToValueAtTime(95, whenSec + suedeDecay);

    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, 0.11 * intensityNorm), whenSec);
    g.gain.exponentialRampToValueAtTime(0.0001, whenSec + suedeDecay);

    cushionOsc.connect(g);
    g.connect(outNode);
    cushionOsc.start(whenSec);
    cushionOsc.stop(whenSec + suedeDecay + 0.006);
  }
}

function scheduleTactilePressOnGraph(
  ctx: BaseAudioContext,
  outNode: AudioNode,
  reverbNode: ConvolverNode | null,
  pressClickBuf: AudioBuffer,
  whenSec: number,
  synth: SynthPatchSettings,
  haptic: HapticSettings,
  intensityScale = 1
): void {
  const mat = haptic.material;
  const profile = MATERIAL_PROFILES[mat];
  const intensityNorm = Math.max(0.05, (haptic.intensity / 100) * intensityScale);
  const hardnessNorm = haptic.materialHardness / 100;

  // Strictly < 160 Hz tactile body carrier
  const baseLowHz =
    synth.baseFrequency >= 160 ? 86 : Math.max(34, Math.min(156, synth.baseFrequency));
  const freq = Math.min(155, Math.max(32, baseLowHz * (0.88 + hardnessNorm * 0.1)));

  const attack = Math.max(0.002, Math.min(0.035, synth.attackMs / 1000));
  const decay = Math.max(
    0.04,
    Math.min(0.28, (synth.decayMs / 1000) * (0.55 + (haptic.durationMs / 160) * 0.45))
  );

  const osc1 = ctx.createOscillator();
  osc1.type = synth.waveform;
  osc1.frequency.setValueAtTime(freq, whenSec);
  osc1.frequency.exponentialRampToValueAtTime(Math.max(28, freq * 0.68), whenSec + decay);

  const subOsc = ctx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(Math.max(28, freq * 0.55), whenSec);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const lowToneCutoff = Math.min(
    158,
    Math.max(65, 90 + (synth.filterCutoff / 8000) * 66 * profile.filterMultiplier * 0.7)
  );
  filter.frequency.setValueAtTime(lowToneCutoff, whenSec);
  filter.Q.setValueAtTime(Math.min(4.5, synth.filterResonance * 0.45), whenSec);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime((0.18 + synth.subBassLevel * 0.32) * intensityNorm, whenSec);

  const envGain = ctx.createGain();
  const peakGain = Math.max(0.0003, Math.min(0.42, 0.28 * intensityNorm));
  envGain.gain.setValueAtTime(0.0001, whenSec);
  envGain.gain.linearRampToValueAtTime(peakGain, whenSec + attack);
  envGain.gain.exponentialRampToValueAtTime(0.0001, whenSec + attack + decay);

  osc1.connect(filter);
  subOsc.connect(subGain);
  subGain.connect(filter);
  filter.connect(envGain);

  const dryGain = ctx.createGain();
  dryGain.gain.setValueAtTime(1 - synth.reverbMix * 0.35, whenSec);
  envGain.connect(dryGain);
  dryGain.connect(outNode);

  if (reverbNode && synth.reverbMix > 0.04) {
    envGain.connect(reverbNode);
  }

  const stopAt = whenSec + attack + decay + 0.04;
  osc1.start(whenSec);
  subOsc.start(whenSec);
  osc1.stop(stopAt);
  subOsc.stop(stopAt);

  scheduleMaterialResonatorOnGraph(ctx, outNode, whenSec, mat, intensityNorm, hardnessNorm);

  const mouseSnapScale =
    mat === 'suede'
      ? 0.22
      : mat === 'abs-plastic'
        ? 1.08
        : mat === 'matte-metal'
          ? 0.92
          : 0.72;
  scheduleMouseSnapOnGraph(
    ctx,
    outNode,
    pressClickBuf,
    whenSec,
    Math.min(1.3, (0.45 + intensityNorm * 0.65) * mouseSnapScale),
    'press'
  );
}

function scheduleReverseClutchOnGraph(
  ctx: BaseAudioContext,
  outNode: AudioNode,
  releaseClickBuf: AudioBuffer,
  whenSec: number,
  haptic: HapticSettings
): void {
  if (haptic.reverseClutchForce <= 4 || haptic.intensity <= 0) return;
  const clutchNorm = haptic.reverseClutchForce / 100;
  const intensityNorm = haptic.intensity / 100;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const lowDetentHz = Math.min(135, 54 + (haptic.materialHardness / 100) * 68);
  osc.frequency.setValueAtTime(lowDetentHz, whenSec);
  osc.frequency.exponentialRampToValueAtTime(42, whenSec + 0.026);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(0.0002, 0.09 * clutchNorm * intensityNorm), whenSec);
  gain.gain.exponentialRampToValueAtTime(0.0001, whenSec + 0.03);

  osc.connect(gain);
  gain.connect(outNode);
  osc.start(whenSec);
  osc.stop(whenSec + 0.035);

  scheduleMouseSnapOnGraph(
    ctx,
    outNode,
    releaseClickBuf,
    whenSec,
    clutchNorm * (0.35 + intensityNorm * 0.55),
    'release'
  );
}

/**
 * Renders the generated tactile sound wave offline via Web Audio `OfflineAudioContext`
 * at 48 kHz stereo so it can be exported as a bit-accurate PCM `.wav` or inspected in `.json`.
 */
export async function renderOfflineHapticAudioBuffer(
  input: HapticWaveformExportInput
): Promise<{
  buffer: AudioBuffer;
  effectivePulses: number[];
  peakAmplitude: number;
  rmsAmplitude: number;
  rmsDbFs: number;
}> {
  const scope = input.scope || 'single-impulse';
  const effectivePulses = hapticAudio.computeEffectivePulses(
    { ...input.haptic, enabled: true, intensity: Math.max(10, input.haptic.intensity) },
    input.patterns
  );

  const reverbTailSec = input.synth.reverbMix > 0.04 ? 0.36 : 0.14;
  const patternTotalSec =
    scope === 'pattern-sequence' && effectivePulses.length > 0
      ? effectivePulses.reduce((acc, v) => acc + v, 0) / 1000
      : Math.max(0.06, input.haptic.durationMs / 1000);

  const totalDurationSec = Math.min(
    4.0,
    Math.max(0.32, 0.012 + patternTotalSec + 0.18 + reverbTailSec)
  );
  const totalFrames = Math.ceil(totalDurationSec * EXPORT_SAMPLE_RATE);

  const offlineCtx = new OfflineAudioContext(2, totalFrames, EXPORT_SAMPLE_RATE);
  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(0.95, 0);
  masterGain.connect(offlineCtx.destination);

  const reverbNode =
    input.synth.reverbMix > 0.04
      ? createDeterministicImpulseReverb(offlineCtx, 0.9, 2.8)
      : null;
  if (reverbNode) {
    const reverbOutGain = offlineCtx.createGain();
    reverbOutGain.gain.setValueAtTime(input.synth.reverbMix * 0.25, 0);
    reverbNode.connect(reverbOutGain);
    reverbOutGain.connect(masterGain);
  }

  const pressClickBuf = createDeterministicClickBuffer(offlineCtx, 'press');
  const releaseClickBuf = createDeterministicClickBuffer(offlineCtx, 'release');

  const leadInSec = 0.008;
  if (scope === 'pattern-sequence' && effectivePulses.length > 1) {
    let cursorMs = 0;
    effectivePulses.forEach((segMs, idx) => {
      if (idx % 2 === 0) {
        const scale = idx === 0 ? 1.0 : Math.max(0.55, 0.92 - idx * 0.06);
        scheduleTactilePressOnGraph(
          offlineCtx,
          masterGain,
          reverbNode,
          pressClickBuf,
          leadInSec + cursorMs / 1000,
          input.synth,
          input.haptic,
          scale
        );
      }
      cursorMs += segMs;
    });
    scheduleReverseClutchOnGraph(
      offlineCtx,
      masterGain,
      releaseClickBuf,
      leadInSec + cursorMs / 1000 + 0.012,
      input.haptic
    );
  } else {
    scheduleTactilePressOnGraph(
      offlineCtx,
      masterGain,
      reverbNode,
      pressClickBuf,
      leadInSec,
      input.synth,
      input.haptic,
      1.0
    );
    const releaseOffsetSec = Math.max(0.055, Math.min(0.26, input.haptic.durationMs / 1000));
    scheduleReverseClutchOnGraph(
      offlineCtx,
      masterGain,
      releaseClickBuf,
      leadInSec + releaseOffsetSec,
      input.haptic
    );
  }

  const rendered = await offlineCtx.startRendering();

  // Compute peak & RMS and prevent digital clipping > 0.98
  const ch0 = rendered.getChannelData(0);
  const ch1 = rendered.getChannelData(1);
  let peak = 0;
  let sqSum = 0;
  for (let i = 0; i < rendered.length; i++) {
    const mono = 0.5 * (ch0[i] + ch1[i]);
    const absL = Math.abs(ch0[i]);
    const absR = Math.abs(ch1[i]);
    if (absL > peak) peak = absL;
    if (absR > peak) peak = absR;
    sqSum += mono * mono;
  }

  if (peak > 0.98) {
    const normFactor = 0.96 / peak;
    for (let i = 0; i < rendered.length; i++) {
      ch0[i] *= normFactor;
      ch1[i] *= normFactor;
    }
    peak = 0.96;
  }

  const rms = Math.sqrt(sqSum / Math.max(1, rendered.length));
  const rmsDbFs =
    rms > 0.00001 ? Math.round(Math.max(-60, Math.min(0, 20 * Math.log10(rms))) * 10) / 10 : -60;

  return {
    buffer: rendered,
    effectivePulses,
    peakAmplitude: Math.round(peak * 10000) / 10000,
    rmsAmplitude: Math.round(rms * 10000) / 10000,
    rmsDbFs,
  };
}

function writeAsciiString(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/**
 * Encodes a Web Audio `AudioBuffer` into a standard 16-bit PCM RIFF WAVE `.wav` Blob.
 */
export function encodeAudioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, Math.max(1, audioBuffer.numberOfChannels));
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;
  const bytesPerSample = 2; // 16-bit signed PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataByteLength = numFrames * blockAlign;
  const totalBufferLength = 44 + dataByteLength;

  const arrayBuffer = new ArrayBuffer(totalBufferLength);
  const view = new DataView(arrayBuffer);

  // RIFF chunk descriptor
  writeAsciiString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeAsciiString(view, 8, 'WAVE');

  // "fmt " sub-chunk (16 bytes for PCM)
  writeAsciiString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat = 1 (Linear PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample = 16

  // "data" sub-chunk
  writeAsciiString(view, 36, 'data');
  view.setUint32(40, dataByteLength, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  let byteOffset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      const int16 = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
      view.setInt16(byteOffset, int16, true);
      byteOffset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function buildSafeSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'haptic'
  );
}

/**
 * Renders and downloads either a 48 kHz 16-bit PCM `.wav` file or a rich `.json`
 * specification containing both haptic parameters and the generated acoustic waveform.
 */
export async function exportHapticWaveformAndParams(
  format: HapticExportFormat,
  input: HapticWaveformExportInput
): Promise<HapticWaveformExportResult> {
  const scope = input.scope || 'single-impulse';
  const rendered = await renderOfflineHapticAudioBuffer(input);
  const durationMs = Math.round((rendered.buffer.length / rendered.buffer.sampleRate) * 1000);

  const activePattern =
    input.patterns.find((p) => p.id === input.haptic.activePatternId) || input.patterns[0];
  const matProfile = MATERIAL_PROFILES[input.haptic.material];
  const matSig = MATERIAL_ACOUSTIC_SIGNATURES[input.haptic.material];
  const baseSlug = `aether-${buildSafeSlug(input.haptic.material)}-${buildSafeSlug(
    activePattern?.id || 'impuls'
  )}`;

  if (format === 'wav') {
    const wavBlob = encodeAudioBufferToWavBlob(rendered.buffer);
    const filename = `${baseSlug}-${scope === 'pattern-sequence' ? 'sekwencja' : 'fala'}.wav`;
    triggerFileDownload(wavBlob, filename);
    return {
      format: 'wav',
      filename,
      sizeBytes: wavBlob.size,
      durationMs,
      sampleRate: rendered.buffer.sampleRate,
      peakAmplitude: rendered.peakAmplitude,
      rmsDbFs: rendered.rmsDbFs,
    };
  }

  // Extract 512 time-domain waveform samples (first 40 ms impulse window) + 64-point RMS envelope
  const chL = rendered.buffer.getChannelData(0);
  const chR = rendered.buffer.getChannelData(1);
  const impulseWindowSamples = Math.min(
    rendered.buffer.length,
    Math.floor(0.045 * rendered.buffer.sampleRate)
  );
  const exportedWaveSamples: number[] = [];
  const sampleCount = 512;

  // Prefer live/frozen oscilloscope capture if non-zero, otherwise sample the rendered offline buffer
  let hasLiveCapture = false;
  if (input.capturedOscilloscopeSamples && input.capturedOscilloscopeSamples.length > 0) {
    for (let i = 0; i < input.capturedOscilloscopeSamples.length; i++) {
      if (Math.abs(input.capturedOscilloscopeSamples[i]) > 0.005) {
        hasLiveCapture = true;
        break;
      }
    }
  }

  if (hasLiveCapture && input.capturedOscilloscopeSamples) {
    const src = input.capturedOscilloscopeSamples;
    for (let i = 0; i < sampleCount; i++) {
      const idx = Math.min(src.length - 1, Math.floor((i / sampleCount) * src.length));
      exportedWaveSamples.push(Math.round(src[idx] * 100000) / 100000);
    }
  } else {
    const startFrame = Math.floor(0.008 * rendered.buffer.sampleRate);
    const span = Math.max(sampleCount, impulseWindowSamples - startFrame);
    for (let i = 0; i < sampleCount; i++) {
      const frameIdx = Math.min(
        rendered.buffer.length - 1,
        startFrame + Math.floor((i / sampleCount) * span)
      );
      const mono = 0.5 * (chL[frameIdx] + chR[frameIdx]);
      exportedWaveSamples.push(Math.round(mono * 100000) / 100000);
    }
  }

  const envelopeBuckets = 64;
  const bucketSize = Math.max(1, Math.floor(rendered.buffer.length / envelopeBuckets));
  const rmsEnvelope64: number[] = [];
  for (let b = 0; b < envelopeBuckets; b++) {
    const start = b * bucketSize;
    const end = Math.min(rendered.buffer.length, start + bucketSize);
    let sq = 0;
    for (let k = start; k < end; k++) {
      const m = 0.5 * (chL[k] + chR[k]);
      sq += m * m;
    }
    const bucketRms = Math.sqrt(sq / Math.max(1, end - start));
    rmsEnvelope64.push(Math.round(bucketRms * 10000) / 10000);
  }

  const configuredBodyHz =
    input.synth.baseFrequency >= 160
      ? 86
      : Math.max(34, Math.min(156, input.synth.baseFrequency));

  const jsonObject = {
    schema: 'aether-tactile-studio/haptic-waveform-export-v1',
    exportedAt: new Date().toISOString(),
    renderScope: scope,
    materialProfile: {
      id: input.haptic.material,
      labelPl: matProfile.label,
      labelEn: matProfile.englishLabel,
      familyPl: matSig.familyPl,
      defaultHardnessShore: matProfile.defaultHardness,
      defaultReverseClutchPercent: matProfile.defaultReverseClutch,
      pbrRoughness: matProfile.roughness3D,
      pbrMetalness: matProfile.metalness3D,
      pbrTransmission: matProfile.transmission3D,
    },
    hapticParameters: {
      enabled: input.haptic.enabled,
      intensityPercent: input.haptic.intensity,
      durationMs: input.haptic.durationMs,
      materialHardnessShore: input.haptic.materialHardness,
      reverseClutchForcePercent: input.haptic.reverseClutchForce,
      holdRampMultiplier: input.haptic.holdRampMultiplier,
      activePatternId: activePattern?.id || input.haptic.activePatternId,
      activePatternName: activePattern?.name || 'Domyślny',
      basePatternPulsesMs: activePattern?.pulses || matProfile.basePulses,
      effectivePulsesMs: rendered.effectivePulses,
      webVibrationApiCall: `navigator.vibrate([${rendered.effectivePulses.join(', ')}]);`,
    },
    acousticSynthParameters: {
      waveform: input.synth.waveform,
      bodyCarrierFrequencyHz: configuredBodyHz,
      verifiedSub160Hz: configuredBodyHz < 160,
      surfaceFormantHz: matSig.surfaceFormantHz,
      secondaryFormantHz: matSig.secondaryFormantHz,
      formantQ: matSig.formantQ,
      decayCharacterMs: matSig.decayCharacterMs,
      harmonicCharacterPl: matSig.harmonicCharacterPl,
      filterCutoffHz: input.synth.filterCutoff,
      filterResonance: input.synth.filterResonance,
      attackMs: input.synth.attackMs,
      decayMs: input.synth.decayMs,
      reverbMix: input.synth.reverbMix,
      subBassLevel: input.synth.subBassLevel,
    },
    ...(input.engraving ? { engravingSettings: input.engraving } : {}),
    ...(input.driverCalibration ? { rotaryDriverCalibration: input.driverCalibration } : {}),
    generatedWaveform: {
      sampleRateHz: rendered.buffer.sampleRate,
      channels: rendered.buffer.numberOfChannels,
      durationMs,
      peakAmplitude: rendered.peakAmplitude,
      rmsAmplitude: rendered.rmsAmplitude,
      rmsDbFs: rendered.rmsDbFs,
      sampleSource: hasLiveCapture ? 'live-oscilloscope-capture' : 'offline-web-audio-render',
      oscilloscopeSamples512: exportedWaveSamples,
      rmsEnvelope64,
    },
  };

  const jsonPayload = JSON.stringify(jsonObject, null, 2);
  const jsonBlob = new Blob([jsonPayload], { type: 'application/json;charset=utf-8' });
  const filename = `${baseSlug}-fala-i-haptyka.json`;
  triggerFileDownload(jsonBlob, filename);

  return {
    format: 'json',
    filename,
    sizeBytes: jsonBlob.size,
    durationMs,
    sampleRate: rendered.buffer.sampleRate,
    peakAmplitude: rendered.peakAmplitude,
    rmsDbFs: rendered.rmsDbFs,
  };
}
