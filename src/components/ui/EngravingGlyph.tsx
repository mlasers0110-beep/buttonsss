import React from 'react';
import { EngravingSymbol } from '../../types/studio';

interface EngravingGlyphProps {
  symbol: EngravingSymbol;
  glowEnabled?: boolean;
  glowColor?: string;
  glowIntensity?: number;
  etchDepth?: number;
  size?: number;
  className?: string;
}

export const EngravingGlyph: React.FC<EngravingGlyphProps> = ({
  symbol,
  glowEnabled = true,
  glowColor = '#8B7CFF',
  glowIntensity = 75,
  etchDepth = 70,
  size = 22,
  className = '',
}) => {
  if (symbol === 'none') return null;

  const strokeWidth = 1.2 + (etchDepth / 100) * 0.85;
  const glowRadius = Math.round((glowIntensity / 100) * 12);
  const filterStyle = glowEnabled
    ? `drop-shadow(0 0 ${glowRadius}px ${glowColor}) drop-shadow(0 1px 0 rgba(255,255,255,0.45))`
    : 'drop-shadow(0 1px 0 rgba(255,255,255,0.5))';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      className={`shrink-0 transition-all duration-150 ${className}`}
      style={{ filter: filterStyle }}
      aria-hidden="true"
    >
      {symbol === 'vascular' && (
        <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 3v22" />
          <path d="M14 11L7 5" />
          <path d="M14 13l8-6" />
          <path d="M14 16l-8 5" />
          <path d="M14 17l7 6" />
          <path d="M10 8L6 9" />
          <path d="M18 10l5 1" />
        </g>
      )}
      {symbol === 'droplet' && (
        <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 4C14 4 6.5 12.6 6.5 17.8a7.5 7.5 0 0 0 15 0C21.5 12.6 14 4 14 4Z" />
          <path d="M11 18.5a3.5 3.5 0 0 0 3 2.8" />
        </g>
      )}
      {symbol === 'wave' && (
        <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round">
          <path d="M8 6c-2 3.5 2 7 0 10.5S6 21 8 23" />
          <path d="M14 5c-2 3.8 2 7.5 0 11.2S12 21 14 23" />
          <path d="M20 6c-2 3.5 2 7 0 10.5S18 21 20 23" />
        </g>
      )}
      {symbol === 'spark' && (
        <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15.5 3L7.5 15h6l-1 10 8-12h-6l1-10Z" />
        </g>
      )}
      {symbol === 'prism' && (
        <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="14,3.5 24,21.5 4,21.5" />
          <line x1="14" y1="3.5" x2="14" y2="21.5" />
          <line x1="8.5" y1="14" x2="19.5" y2="14" />
        </g>
      )}
      {symbol === 'ring' && (
        <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round">
          <circle cx="14" cy="14" r="8.5" />
          <path d="M17.5 10.2a5.2 5.2 0 0 1 1.3 4.3" />
          <circle cx="14" cy="14" r="2.2" />
        </g>
      )}
      {symbol === 'compass' && (
        <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="14" cy="14" r="9.5" />
          <polygon points="14,7.5 16.6,14 14,20.5 11.4,14" />
        </g>
      )}
    </svg>
  );
};
