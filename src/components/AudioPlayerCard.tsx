import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { hapticAudio } from '../lib/hapticAudioEngine';
import { TactileButton } from './ui/TactileButton';

interface AmbientTrack {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  rootFreq: number;
}

const AMBIENT_TRACKS: AmbientTrack[] = [
  {
    id: 'track-1',
    title: 'Perłowa Harmonia Naczyń',
    artist: 'Aether Acoustic Lab',
    durationSec: 164,
    rootFreq: 220,
  },
  {
    id: 'track-2',
    title: 'Iryzacja Szkła Optycznego',
    artist: 'Studio Resonance',
    durationSec: 198,
    rootFreq: 261.63,
  },
  {
    id: 'track-3',
    title: 'Szmaragdowy Impuls Nocny',
    artist: 'BM Sonic Suite',
    durationSec: 142,
    rootFreq: 196,
  },
];

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const AudioPlayerCard: React.FC = () => {
  const { haptic, driverCalibration, depth, palette, pulseInteraction } = useStudio();
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressSec, setProgressSec] = useState(38);
  const [knobValue, setKnobValue] = useState(0.68); // 0..1 rotary encoder
  const knobRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const lastDetentRef = useRef(Math.round(0.68 * driverCalibration.detentCount));
  const endStopLatchRef = useRef<'min' | 'max' | null>(null);

  const currentTrack = AMBIENT_TRACKS[trackIndex];
  const displayTitle = currentTrack.title;
  const activeFreq = currentTrack.rootFreq;

  useEffect(() => {
    if (!isPlaying) {
      hapticAudio.stopAmbientTrack();
      return;
    }
    hapticAudio.startAmbientTrack(activeFreq, knobValue);
    const timer = window.setInterval(() => {
      setProgressSec((prev) => {
        if (prev + 1 >= currentTrack.durationSec) {
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => {
      window.clearInterval(timer);
      hapticAudio.stopAmbientTrack();
    };
  }, [isPlaying, activeFreq, currentTrack.durationSec]);

  useEffect(() => {
    hapticAudio.setAmbientVolume(knobValue);
  }, [knobValue]);

  // Cleanup ambient sound on unmount
  useEffect(() => {
    return () => hapticAudio.stopAmbientTrack();
  }, []);

  const updateKnobFromPointer = (clientX: number, clientY: number) => {
    if (!knobRef.current) return;
    const rect = knobRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angleRad = Math.atan2(clientY - cy, clientX - cx);
    let deg = (angleRad * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;

    // Map 225deg..360deg..135deg sweep (270 degrees total)
    let normalized = 0;
    if (deg >= 225) {
      normalized = (deg - 225) / 270;
    } else if (deg <= 135) {
      normalized = (deg + 135) / 270;
    } else {
      normalized = deg > 180 ? 0 : 1;
    }

    const clamped = Math.max(0, Math.min(1, normalized));
    setKnobValue(clamped);

    if (clamped <= 0.002 && endStopLatchRef.current !== 'min') {
      endStopLatchRef.current = 'min';
      lastDetentRef.current = 0;
      hapticAudio.triggerCalibratedRotaryEndStop(driverCalibration, 'min');
      pulseInteraction(0.6);
      return;
    }
    if (clamped >= 0.998 && endStopLatchRef.current !== 'max') {
      endStopLatchRef.current = 'max';
      lastDetentRef.current = driverCalibration.detentCount;
      hapticAudio.triggerCalibratedRotaryEndStop(driverCalibration, 'max');
      pulseInteraction(0.6);
      return;
    }
    if (clamped > 0.02 && clamped < 0.98) {
      endStopLatchRef.current = null;
    }

    const detentCount = Math.max(12, driverCalibration.detentCount);
    const bucket = Math.round(clamped * detentCount);
    if (bucket !== lastDetentRef.current) {
      lastDetentRef.current = bucket;
      const isMajor = bucket % Math.max(1, driverCalibration.majorTickEvery) === 0;
      hapticAudio.triggerCalibratedRotaryDetent(driverCalibration, clamped, isMajor, 0.35);
      pulseInteraction(isMajor ? 0.45 : 0.25);
    }
  };

  const handleKnobPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateKnobFromPointer(e.clientX, e.clientY);
  };

  const handleKnobPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateKnobFromPointer(e.clientX, e.clientY);
  };

  const handleKnobPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    hapticAudio.triggerCalibratedRotaryAxialPush(driverCalibration, 'release');
  };

  const knobAngleDeg = -135 + knobValue * 270;
  const progressPct = (progressSec / currentTrack.durationSec) * 100;
  const isDark = palette === 'emerald-clinic';

  return (
    <div
      style={{
        borderRadius: `${depth.borderRadius}px`,
        backdropFilter: `blur(${depth.glassBlur}px)`,
        backgroundColor: isDark
          ? `rgba(11, 34, 29, ${depth.glassOpacity})`
          : `rgba(255, 255, 255, ${depth.glassOpacity})`,
        boxShadow: isDark
          ? `0 ${depth.elevation}px ${depth.blur}px rgba(0,0,0,0.45)`
          : `0 ${depth.elevation}px ${depth.blur}px rgba(88, 76, 148, 0.14)`,
      }}
      className="p-6 border border-white/80 dark:border-emerald-400/20 flex flex-col justify-between gap-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-slate-500 dark:text-emerald-300/75 flex items-center gap-1.5">
            <span>Odtwarzacz Aether</span>
            <span aria-hidden="true">·</span>
            <span>Synteza Ambient</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-emerald-50 mt-1 truncate">
            {displayTitle}
          </h3>
          <p className="text-xs text-slate-500 dark:text-emerald-200/70 truncate">
            {currentTrack.artist} · {Math.round(activeFreq)} Hz
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-600 dark:text-emerald-200 shrink-0">
          <Volume2 className="w-3.5 h-3.5" />
          <span>{Math.round(knobValue * 100)}%</span>
        </div>
      </div>

      {/* Tactile Rotary Knob Dial (Okrągłe pokrętło z zapadkami sprzęgła odwrotnego) */}
      <div className="flex items-center justify-center py-2">
        <div
          ref={knobRef}
          role="slider"
          tabIndex={0}
          aria-label="Pokrętło głośności i barwy filtra"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(knobValue * 100)}
          onPointerDown={handleKnobPointerDown}
          onPointerMove={handleKnobPointerMove}
          onPointerUp={handleKnobPointerUp}
          onKeyDown={(e) => {
            const step = 1 / Math.max(12, driverCalibration.detentCount);
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              const next = Math.min(1, knobValue + step);
              setKnobValue(next);
              const bucket = Math.round(next * driverCalibration.detentCount);
              hapticAudio.triggerCalibratedRotaryDetent(
                driverCalibration,
                next,
                bucket % Math.max(1, driverCalibration.majorTickEvery) === 0,
                0.25
              );
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              const next = Math.max(0, knobValue - step);
              setKnobValue(next);
              const bucket = Math.round(next * driverCalibration.detentCount);
              hapticAudio.triggerCalibratedRotaryDetent(
                driverCalibration,
                next,
                bucket % Math.max(1, driverCalibration.majorTickEvery) === 0,
                0.25
              );
            }
          }}
          className="relative w-32 h-32 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          style={{
            background: isDark
              ? 'radial-gradient(circle at 32% 28%, #1a3f37, #091915)'
              : 'radial-gradient(circle at 30% 25%, #ffffff, #dfe5f5)',
            boxShadow: isDark
              ? '10px 12px 24px rgba(0,0,0,0.55), -6px -6px 16px rgba(116,191,161,0.08), inset 0 1px 2px rgba(255,255,255,0.18)'
              : '10px 12px 26px rgba(99, 102, 241, 0.16), -8px -8px 20px rgba(255, 255, 255, 0.92), inset 0 1px 2px rgba(255,255,255,0.95)',
          }}
        >
          {/* SVG Progress Ring around Rotary Knob */}
          <svg
            className="pointer-events-none absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 128 128"
          >
            <circle
              cx="64"
              cy="64"
              r="57"
              fill="none"
              stroke={isDark ? 'rgba(116,191,161,0.14)' : 'rgba(99,102,241,0.14)'}
              strokeWidth="4"
            />
            <circle
              cx="64"
              cy="64"
              r="57"
              fill="none"
              stroke={isDark ? '#6ee7b7' : '#6366f1'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${knobValue * 358} 358`}
            />
          </svg>

          {/* Inner Machined Cap */}
          <div
            style={{ transform: `rotate(${knobAngleDeg}deg)` }}
            className="w-20 h-20 rounded-full border border-white/80 dark:border-emerald-300/25 flex flex-col items-center justify-start pt-2.5 transition-transform duration-75 bg-gradient-to-b from-white/95 to-indigo-50/85 dark:from-emerald-900/90 dark:to-emerald-950"
          >
            <span className="w-1.5 h-4 rounded-full bg-indigo-600 dark:bg-emerald-300 shadow-sm" />
          </div>

          <span className="pointer-events-none absolute text-[11px] font-mono tabular-nums font-semibold text-slate-700 dark:text-emerald-100">
            {isPlaying ? 'AKTYWNY' : 'GOTOWY'}
          </span>
        </div>
      </div>

      {/* Interactive Progress Track (Ścieżka postępu) */}
      <div className="space-y-1.5">
        <div className="relative h-2.5 rounded-full bg-slate-200/80 dark:bg-emerald-950/80 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-400 dark:from-emerald-400 dark:to-teal-300 transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
          <input
            type="range"
            min={0}
            max={currentTrack.durationSec}
            value={progressSec}
            aria-label="Postęp utworu"
            onChange={(e) => {
              const v = Number(e.target.value);
              setProgressSec(v);
              hapticAudio.triggerSliderTick(haptic, v / currentTrack.durationSec);
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-emerald-200/70">
          <span>{formatTime(progressSec)}</span>
          <span>{formatTime(currentTrack.durationSec)}</span>
        </div>
      </div>

      {/* Neumorphic Playback Transport Controls (Grupa C) */}
      <div className="flex items-center justify-center gap-4 pt-1">
        <TactileButton
          groupId="group-audio"
          variant="neumorphic-icon"
          pitchSemitones={-2}
          ariaLabel="Poprzednia ścieżka"
          onClick={() => {
            setTrackIndex((i) => (i - 1 + AMBIENT_TRACKS.length) % AMBIENT_TRACKS.length);
            setProgressSec(0);
          }}
          className="w-11 h-11 flex items-center justify-center"
        >
          <SkipBack className="w-4 h-4 mx-auto" />
        </TactileButton>

        <TactileButton
          groupId="group-audio"
          variant="primary-cta"
          pitchSemitones={2}
          ariaLabel={isPlaying ? 'Wstrzymaj odtwarzanie' : 'Odtwórz dźwięk'}
          onClick={() => setIsPlaying((p) => !p)}
          className="w-14 h-14 !rounded-full flex items-center justify-center"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 mx-auto" />
          ) : (
            <Play className="w-5 h-5 mx-auto translate-x-0.5" />
          )}
        </TactileButton>

        <TactileButton
          groupId="group-audio"
          variant="neumorphic-icon"
          pitchSemitones={4}
          ariaLabel="Następna ścieżka"
          onClick={() => {
            setTrackIndex((i) => (i + 1) % AMBIENT_TRACKS.length);
            setProgressSec(0);
          }}
          className="w-11 h-11 flex items-center justify-center"
        >
          <SkipForward className="w-4 h-4 mx-auto" />
        </TactileButton>
      </div>
    </div>
  );
};
