import React, { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  aspectClass?: string;
}

declare global {
  interface Window {
    __AETHER_OFFLINE_ASSETS__?: Record<string, string>;
  }
}

export function resolveOfflineEmbeddedAsset(src: string): string {
  if (typeof window !== 'undefined' && window.__AETHER_OFFLINE_ASSETS__) {
    const embedded = window.__AETHER_OFFLINE_ASSETS__[src];
    if (embedded) return embedded;
  }
  return src;
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  className = '',
  aspectClass = 'aspect-video',
}) => {
  const resolvedSrc = useMemo(() => resolveOfflineEmbeddedAsset(src), [src]);
  const [loaded, setLoaded] = useState(() => resolvedSrc.startsWith('data:'));
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`relative overflow-hidden bg-slate-200/60 dark:bg-emerald-950/60 ${aspectClass} ${className}`}
    >
      {!loaded && !failed && (
        <div className="absolute inset-0 overflow-hidden bg-slate-200/70 dark:bg-emerald-900/40">
          <div className="w-full h-full bg-gradient-to-r from-transparent via-white/55 dark:via-emerald-300/15 to-transparent animate-shimmer" />
        </div>
      )}

      {!failed ? (
        <img
          src={resolvedSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center bg-gradient-to-br from-indigo-100 via-white to-violet-100 dark:from-emerald-950 dark:via-emerald-900/70 dark:to-teal-950">
          <Layers className="w-6 h-6 text-indigo-500 dark:text-emerald-300" />
          <span className="text-xs font-medium text-slate-700 dark:text-emerald-100 line-clamp-2">
            {alt}
          </span>
        </div>
      )}
    </div>
  );
};
