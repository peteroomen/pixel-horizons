import type { BallGlyph } from '@/game/ship-view';

interface BallGlyphIconProps {
  glyph: BallGlyph;
  /** px — the icon scales uniformly to this size. Default 14. */
  size?: number;
  className?: string;
}

/**
 * Trajectory glyph for a ball type (§6.4 UI law): straight = pierce/drill,
 * arc = bouncy, curve = homing/ghost. Rendered as a crisp inline SVG — no
 * external assets, scales cleanly at any pixel size.
 */
export default function BallGlyphIcon({ glyph, size = 14, className }: BallGlyphIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={className}
    >
      {glyph === 'straight' && (
        <>
          <line x1="1" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="1.5" />
          <polyline points="8,4 13,7 8,10" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </>
      )}
      {glyph === 'arc' && (
        <path d="M 1 12 Q 3 2 7 2 Q 11 2 13 12" stroke="currentColor" strokeWidth="1.5" />
      )}
      {glyph === 'curve' && (
        <path d="M 1 2 C 4 2 4 7 7 7 C 10 7 10 12 13 12" stroke="currentColor" strokeWidth="1.5" />
      )}
    </svg>
  );
}
