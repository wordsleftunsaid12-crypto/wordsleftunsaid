import React from 'react';
import {
  AbsoluteFill,
  Video,
  staticFile,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion';

export interface CinematicProps {
  from: string;
  to: string;
  content: string;
  backgroundVideo: string;
}

export const CinematicMessage: React.FC<CinematicProps> = ({
  from,
  to,
  content,
  backgroundVideo,
}) => {
  const frame = useCurrentFrame();
  const { height, durationInFrames } = useVideoConfig();
  const isVertical = height > 1200;

  // --- Animation timing (adaptive to composition duration) ---
  const toDelay = 15;
  const contentDelay = 35;
  const words = content.split(' ');

  // Fixed overhead frames: gap before "from" + from fade-in + fade-out + CTA
  const FROM_GAP = 15;
  const FROM_FADE_IN = 22;
  const FADE_OUT = 25;
  const CTA_RESERVE = 45; // CTA needs 1.5s to fade in and be visible
  const fixedOverhead = FROM_GAP + FROM_FADE_IN + FADE_OUT + CTA_RESERVE;

  // Budget for word reveal + from-visible pause
  const budget = durationInFrames - contentDelay - fixedOverhead;
  const idealWordReveal = Math.max(words.length * 5, 50);
  const idealFromVisible = 50;
  const idealTotal = idealWordReveal + idealFromVisible;

  // Compress proportionally if the ideal timing exceeds the budget
  let wordRevealDuration: number;
  let fromVisibleDuration: number;
  if (idealTotal > budget) {
    const ratio = budget / idealTotal;
    wordRevealDuration = Math.max(Math.floor(idealWordReveal * ratio), 40);
    fromVisibleDuration = Math.max(Math.floor(idealFromVisible * ratio), 20);
  } else {
    wordRevealDuration = idealWordReveal;
    fromVisibleDuration = idealFromVisible;
  }

  const fromDelay = contentDelay + wordRevealDuration + FROM_GAP;
  const fromFullyVisible = fromDelay + FROM_FADE_IN;
  const contentFadeOutStart = fromFullyVisible + fromVisibleDuration;
  const contentFadeOutEnd = contentFadeOutStart + FADE_OUT;
  const ctaStart = contentFadeOutEnd;

  // --- Dark overlay fade in (let video breathe initially) ---
  const overlayOpacity = interpolate(frame, [0, 20], [0.3, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Accent line ---
  const lineWidth = interpolate(frame, [8, 45], [0, isVertical ? 180 : 150], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // --- "To" label ---
  const toOpacity = interpolate(frame, [toDelay, toDelay + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const toSlide = interpolate(frame, [toDelay, toDelay + 22], [25, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // --- Word-by-word reveal ---
  const wordsRevealed = interpolate(
    frame,
    [contentDelay, contentDelay + wordRevealDuration],
    [0, words.length],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // --- "From" ---
  const fromOpacity = interpolate(frame, [fromDelay, fromDelay + FROM_FADE_IN], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fromSlide = interpolate(frame, [fromDelay, fromDelay + 26], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // --- Content fade out (message, labels, lines) ---
  const contentFadeOut = interpolate(frame, [contentFadeOutStart, contentFadeOutEnd], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Branding ---
  const brandOpacity = interpolate(
    frame,
    [80, 100, contentFadeOutStart - 5, contentFadeOutStart + 15],
    [0, 0.5, 0.5, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // --- CTA (fades in after message is gone, then stays) ---
  const ctaOpacity = interpolate(
    frame,
    [ctaStart, ctaStart + 15],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const ctaSlide = interpolate(
    frame,
    [ctaStart, ctaStart + 18],
    [25, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
  );

  const contentFontSize = isVertical ? 68 : 52;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0908' }}>
      {/* Background video */}
      <AbsoluteFill>
        <Video
          src={staticFile(backgroundVideo)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </AbsoluteFill>

      {/* Dark gradient overlay — strong enough for crisp text readability on mobile */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.35) 0%,
            rgba(0, 0, 0, 0.55) 20%,
            rgba(0, 0, 0, 0.7) 45%,
            rgba(0, 0, 0, 0.75) 65%,
            rgba(0, 0, 0, 0.85) 100%
          )`,
          opacity: overlayOpacity,
        }}
      />

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 35%, rgba(0, 0, 0, 0.5) 100%)',
        }}
      />

      {/* Film grain texture */}
      <AbsoluteFill
        style={{
          opacity: 0.04,
          mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Main content — fades out independently before CTA appears */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          padding: isVertical
            ? '250px 120px 400px 70px'
            : '100px 60px 180px 60px',
          opacity: contentFadeOut,
        }}
      >
        {/* Top accent line */}
        <div
          style={{
            width: lineWidth,
            height: 1,
            background:
              'linear-gradient(90deg, transparent, rgba(200, 168, 130, 0.6), transparent)',
            marginBottom: isVertical ? 50 : 35,
          }}
        />

        {/* "To" label */}
        <div
          style={{
            opacity: toOpacity,
            transform: `translateY(${toSlide}px)`,
            fontFamily: 'Poppins, sans-serif',
            fontSize: isVertical ? 34 : 26,
            fontWeight: 300,
            color: 'rgba(200, 168, 130, 0.9)',
            letterSpacing: '8px',
            textTransform: 'uppercase',
            marginBottom: isVertical ? 50 : 35,
            textShadow: '0 1px 8px rgba(0, 0, 0, 0.4)',
          }}
        >
          To {to}
        </div>

        {/* Message — word by word with blur-to-sharp reveal */}
        <div
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: contentFontSize,
            lineHeight: 1.65,
            color: '#f0e8e0',
            textAlign: 'center',
            maxWidth: isVertical ? 860 : 820,
            fontWeight: 400,
            textShadow: '0 2px 12px rgba(0, 0, 0, 0.8), 0 4px 30px rgba(0, 0, 0, 0.5)',
          }}
        >
          {words.map((word, i) => {
            const wordProgress = interpolate(
              wordsRevealed,
              [i - 0.3, i + 0.7],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );
            const wordScale = interpolate(
              wordProgress,
              [0, 0.5, 1],
              [0.92, 1.04, 1],
            );
            const wordBlur = interpolate(
              wordProgress,
              [0, 0.5, 1],
              [6, 0, 0],
            );
            return (
              <span
                key={i}
                style={{
                  opacity: wordProgress,
                  display: 'inline-block',
                  transform: `scale(${wordScale})`,
                  filter: `blur(${wordBlur}px)`,
                  marginRight: '0.3em',
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* "From" signature */}
        <div
          style={{
            opacity: fromOpacity,
            transform: `translateY(${fromSlide}px)`,
            fontFamily: 'Poppins, sans-serif',
            fontSize: isVertical ? 34 : 26,
            fontWeight: 300,
            color: 'rgba(200, 168, 130, 0.8)',
            marginTop: isVertical ? 55 : 40,
            letterSpacing: '5px',
            textTransform: 'uppercase',
            textShadow: '0 1px 8px rgba(0, 0, 0, 0.4)',
          }}
        >
          &mdash; {from}
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            width: lineWidth,
            height: 1,
            background:
              'linear-gradient(90deg, transparent, rgba(200, 168, 130, 0.4), transparent)',
            marginTop: isVertical ? 50 : 35,
            opacity: 0.6,
          }}
        />
      </div>

      {/* Branding — positioned above platform UI overlays */}
      <div
        style={{
          position: 'absolute',
          bottom: isVertical ? 420 : 50,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'Poppins, sans-serif',
          fontSize: isVertical ? 16 : 14,
          color: 'rgba(200, 168, 130, 0.7)',
          opacity: brandOpacity,
          letterSpacing: '5px',
          textTransform: 'uppercase',
        }}
      >
        words left unsaid
      </div>

      {/* CTA — appears cleanly after message is gone */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: ctaOpacity,
          transform: `translateY(${ctaSlide}px)`,
        }}
      >
        <div
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: isVertical ? 30 : 24,
            fontWeight: 300,
            color: 'rgba(200, 168, 130, 0.9)',
            letterSpacing: '3px',
            textAlign: 'center',
            textShadow: '0 2px 15px rgba(0, 0, 0, 0.6)',
          }}
        >
          Share your unsent message
        </div>
        <div
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: isVertical ? 42 : 34,
            fontWeight: 400,
            color: '#f0e8e0',
            marginTop: isVertical ? 20 : 14,
            letterSpacing: '2px',
            textShadow: '0 2px 15px rgba(0, 0, 0, 0.6)',
          }}
        >
          wordsleftunsaid.com
        </div>
      </div>
    </AbsoluteFill>
  );
};
