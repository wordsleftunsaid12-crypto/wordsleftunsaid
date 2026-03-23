import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion';

// ─── Film Grain Overlay ──────────────────────────────────────────────────────
// SVG noise texture overlay for cinematic/analog feel.
// Use blendMode='overlay' on dark backgrounds, 'multiply' on light backgrounds.

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export const FilmGrain: React.FC<{
  opacity?: number;
  blendMode?: 'overlay' | 'multiply';
}> = ({ opacity = 0.04, blendMode = 'overlay' }) => (
  <AbsoluteFill
    style={{
      opacity,
      mixBlendMode: blendMode,
      backgroundImage: NOISE_SVG,
    }}
  />
);

// ─── Vignette ────────────────────────────────────────────────────────────────
// Radial gradient that darkens edges, focusing attention on center content.

export const Vignette: React.FC<{
  innerRadius?: string;
  outerOpacity?: number;
}> = ({ innerRadius = '35%', outerOpacity = 0.5 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at center, transparent ${innerRadius}, rgba(0, 0, 0, ${outerOpacity}) 100%)`,
    }}
  />
);

// ─── Accent Line ─────────────────────────────────────────────────────────────
// Animated horizontal line that grows from center. Used as visual separator.

export const AccentLine: React.FC<{
  width: number;
  color?: string;
  height?: number;
  opacity?: number;
  style?: React.CSSProperties;
}> = ({
  width,
  color = 'rgba(200, 168, 130, 0.6)',
  height = 1,
  opacity = 1,
  style,
}) => (
  <div
    style={{
      width,
      height,
      background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      opacity,
      ...style,
    }}
  />
);

// ─── CTA Section ─────────────────────────────────────────────────────────────
// "Share your unsent message" + "wordsleftunsent.com" positioned at bottom.

export const CTASection: React.FC<{
  opacity: number;
  slideY?: number;
  line1?: string;
  line2?: string;
  isVertical?: boolean;
  fontFamily?: string;
  color?: string;
}> = ({
  opacity,
  slideY = 0,
  line1 = 'Share your unsent message',
  line2 = 'wordsleftunsent.com',
  isVertical = true,
  fontFamily,
  color = 'rgba(220, 190, 150, 1)',
}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: isVertical ? 480 : 90,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      opacity,
      transform: `translateY(${slideY}px)`,
    }}
  >
    <div
      style={{
        fontFamily: fontFamily ?? 'Poppins, sans-serif',
        fontSize: isVertical ? 28 : 20,
        fontWeight: 300,
        color,
        letterSpacing: '3px',
        textAlign: 'center',
        textShadow: '0 2px 20px rgba(0, 0, 0, 0.8)',
      }}
    >
      {line1}
    </div>
    <div
      style={{
        fontFamily: fontFamily ?? 'Poppins, sans-serif',
        fontSize: isVertical ? 38 : 28,
        fontWeight: 600,
        color: '#ffffff',
        marginTop: isVertical ? 14 : 8,
        letterSpacing: '2px',
        textShadow: '0 2px 20px rgba(0, 0, 0, 0.8)',
      }}
    >
      {line2}
    </div>
  </div>
);

// ─── Attribution ─────────────────────────────────────────────────────────────
// "— [from]" signature line with fade-in and slide-up animation.

export const Attribution: React.FC<{
  from: string;
  opacity: number;
  slideY?: number;
  isVertical?: boolean;
  color?: string;
  prefix?: string;
}> = ({
  from,
  opacity,
  slideY = 0,
  isVertical = true,
  color = 'rgba(200, 168, 130, 0.8)',
  prefix = '\u2014',
}) => (
  <div
    style={{
      opacity,
      transform: `translateY(${slideY}px)`,
      fontFamily: 'Poppins, sans-serif',
      fontSize: isVertical ? 32 : 24,
      fontWeight: 300,
      color,
      marginTop: isVertical ? 50 : 35,
      letterSpacing: '5px',
      textTransform: 'uppercase',
      textShadow: '0 1px 8px rgba(0, 0, 0, 0.4)',
    }}
  >
    {prefix} {from}
  </div>
);

// ─── Ambient Glow ────────────────────────────────────────────────────────────
// Warm blurred circle that breathes slowly. Used behind text on dark backgrounds.

export const AmbientGlow: React.FC<{
  opacity: number;
  scale?: number;
  color?: string;
  size?: number;
  top?: string;
  isVertical?: boolean;
}> = ({
  opacity,
  scale = 1,
  color = 'rgba(180, 130, 90, 0.35)',
  size,
  top = '35%',
  isVertical = true,
}) => (
  <div
    style={{
      position: 'absolute',
      width: size ?? (isVertical ? 700 : 500),
      height: size ?? (isVertical ? 700 : 500),
      borderRadius: '50%',
      background: `radial-gradient(circle, ${color} 0%, transparent 60%)`,
      top,
      left: '50%',
      transform: `translate(-50%, -50%) scale(${scale})`,
      opacity,
      filter: 'blur(80px)',
    }}
  />
);

// ─── Responsive Sizes Hook ───────────────────────────────────────────────────
// Returns layout values based on vertical vs square format.

export interface ResponsiveSizes {
  isVertical: boolean;
  contentPadding: string;
  contentFontSize: number;
  labelFontSize: number;
  maxContentWidth: number;
  accentLineMaxWidth: number;
  ctaBottomOffset: number;
}

export function useResponsiveSizes(overrides?: Partial<ResponsiveSizes>): ResponsiveSizes {
  const { height } = useVideoConfig();
  const isVertical = height > 1200;

  const defaults: ResponsiveSizes = {
    isVertical,
    contentPadding: isVertical
      ? '250px 100px 400px 80px'
      : '100px 60px 180px 60px',
    contentFontSize: isVertical ? 64 : 48,
    labelFontSize: isVertical ? 30 : 22,
    maxContentWidth: isVertical ? 860 : 820,
    accentLineMaxWidth: isVertical ? 180 : 150,
    ctaBottomOffset: isVertical ? 260 : 90,
  };

  return { ...defaults, ...overrides };
}

// ─── Fade Animation Helpers ──────────────────────────────────────────────────

export function useFadeIn(startFrame: number, duration = 20): {
  opacity: number;
  slideY: number;
} {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const slideY = interpolate(frame, [startFrame, startFrame + duration + 3], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return { opacity, slideY };
}

export function useFadeOut(startFrame: number, duration = 18): number {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

// ─── Mood-Mapped Colors (TextOnGradient) ─────────────────────────────────────

export const MOOD_COLORS: Record<string, string> = {
  tender: '#e8b4b8',
  regretful: '#8ba4b8',
  hopeful: '#d4a574',
  bittersweet: '#b8a0c8',
  raw: '#c46060',
};

// ─── Background Music ───────────────────────────────────────────────────────
// Plays a music file from the bundle's public/ directory with volume fade-in/out.

export const BackgroundMusic: React.FC<{
  musicFile?: string;
  volume?: number;
  fadeDuration?: number;
}> = ({ musicFile, volume = 0.3, fadeDuration = 30 }) => {
  const { durationInFrames } = useVideoConfig();
  if (!musicFile) return null;

  return (
    <Audio
      src={staticFile(musicFile)}
      volume={(f: number) => {
        if (f < fadeDuration) return (f / fadeDuration) * volume;
        const fadeOutStart = durationInFrames - fadeDuration;
        if (f > fadeOutStart) return ((durationInFrames - f) / fadeDuration) * volume;
        return volume;
      }}
    />
  );
};

// ─── Loop Fade ──────────────────────────────────────────────────────────────
// Opacity multiplier that fades from black at start and to black at end,
// creating a seamless dark-to-dark loop point for autoplay replays.

export function useLoopFade(fadeInFrames = 15, fadeOutFrames = 18): number {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fadeInFrames], [0.85, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fadeOutFrames, durationInFrames],
    [1, 0.85],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return Math.min(fadeIn, fadeOut);
}

// ─── Content-Adaptive Duration ──────────────────────────────────────────────
// Calculates duration in frames based on word count.
// Short messages → shorter videos, long messages → longer (6–15 seconds).

export function calculateDurationFrames(content: string, fps = 30): number {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  // 5s base + 0.12s per word, capped at 8s. Short and punchy for social media.
  const durationSec = Math.min(Math.max(5, 5 + wordCount * 0.12), 8);
  return Math.ceil(durationSec * fps);
}
