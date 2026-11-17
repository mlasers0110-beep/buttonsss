import React, { useRef } from 'react';
import { useStudio } from '../../context/StudioContext';
import { hapticAudio } from '../../lib/hapticAudioEngine';

interface HapticSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  description?: string;
}

export const HapticSlider: React.FC<HapticSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  description,
}) => {
  const { haptic, palette, pulseInteraction } = useStudio();
  const lastStepBucketRef = useRef<number>(value);

  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  // Detent count scales with material hardness & reverse clutch
  const detentBuckets = Math.max(8, Math.round(12 + (haptic.materialHardness / 100) * 16));

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = Number(e.target.value);
    onChange(nextVal);

    const nextBucket = Math.round(((nextVal - min) / (max - min || 1)) * detentBuckets);
    const prevBucket = Math.round(
      ((lastStepBucketRef.current - min) / (max - min || 1)) * detentBuckets
    );

    if (nextBucket !== prevBucket) {
      lastStepBucketRef.current = nextVal;
      hapticAudio.triggerSliderTick(haptic, (nextVal - min) / (max - min || 1));
      pulseInteraction(0.25);
    }
  };

  const handleRelease = () => {
    hapticAudio.triggerReleaseReverseClutch(haptic);
  };

  const isDark = palette === 'emerald-clinic';

  const materialTrackClass =
    haptic.material === 'shiny-glass'
      ? isDark
        ? 'bg-emerald-950/70 border-emerald-300/30 shadow-inner'
        : 'bg-white/80 border-white shadow-inner'
      : haptic.material === 'matte-metal'
        ? isDark
          ? 'bg-neutral-900 border-neutral-700 shadow-inner'
          : 'bg-slate-200/90 border-slate-300 shadow-inner'
        : haptic.material === 'suede'
          ? isDark
            ? 'bg-emerald-950/90 border-emerald-800/50'
            : 'bg-indigo-100/80 border-indigo-200/60'
          : isDark
            ? 'bg-emerald-900/45 border-emerald-400/20'
            : 'bg-white/60 border-white/80';

  const fillColor = isDark
    ? 'from-emerald-400/80 to-teal-300/90'
    : palette === 'finance-ice'
      ? 'from-indigo-500/80 to-sky-400/90'
      : 'from-indigo-500/75 via-violet-400/80 to-fuchsia-300/85';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-medium text-slate-700 dark:text-emerald-100/90 truncate">
          {label}
        </label>
        <span className="text-xs font-mono tabular-nums font-medium text-slate-900 dark:text-emerald-200 shrink-0">
          {typeof step === 'number' && step < 1 ? value.toFixed(2) : Math.round(value)}
          {unit}
        </span>
      </div>

      <div className="relative flex items-center h-6">
        <div
          className={`w-full h-2.5 rounded-full border overflow-hidden transition-colors duration-150 ${materialTrackClass}`}
        >
          <div
            className={`h-full bg-gradient-to-r ${fillColor} transition-transform duration-75 origin-left`}
            style={{ transform: `scaleX(${normalized})` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleInput}
          onPointerUp={handleRelease}
          aria-label={label}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 -ml-2.5 w-5 h-5 rounded-full transition-transform duration-100 ${
            haptic.material === 'matte-metal'
              ? 'bg-gradient-to-b from-slate-100 to-slate-400 border border-slate-500 shadow-md'
              : haptic.material === 'suede'
                ? 'bg-indigo-900 dark:bg-emerald-300 border-2 border-white/70 shadow-sm'
                : 'bg-white/95 border border-white shadow-[0_3px_10px_rgba(79,70,229,0.28)]'
          }`}
          style={{ left: `calc(${normalized * 100}%)` }}
        />
      </div>

      {description && (
        <p className="text-[11px] leading-snug text-slate-500 dark:text-emerald-200/65">
          {description}
        </p>
      )}
    </div>
  );
};
