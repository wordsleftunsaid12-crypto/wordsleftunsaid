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

  // --- Animation timing (compressed for faster hook) ---
  const toDelay = 5;
  const contentDelay = 15;
  const words = content.split(' ');

  // Hook text: first ~5 words + "..." (visible on frame 0 for thumbnail)
  const hookWordCount = Math.min(5, Math.ceil(words.length / 3));
  const hookText =
    words.length <= hookWordCount
      ? content
      : words.slice(0, hookWordCount).join(' ') + '...';

  // Fixed overhead frames
  const FROM_GAP = 10;
  const FROM_FADE_IN = 15;
  const FADE_OUT = 18;
  const CTA_RESERVE = 30;
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

  // --- Hook text (visible immediately, fully gone before word reveal starts) ---
  const hookOpacity = interpolate(frame, [0, 5, 8, contentDelay - 1], [1, 1, 0.8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Dark overlay (faster fade-in — 8 frames instead of 20) ---
  const overlayOpacity = interpolate(frame, [0, 8], [0.5, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Accent line ---
  const lineWidth = interpolate(frame, [3, 25], [0, isVertical ? 180 : 150], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // --- "To" label (faster — starts at frame 5) ---
  const toOpacity = interpolate(frame, [toDelay, toDelay + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const toSlide = interpolate(frame, [toDelay, toDelay + 12], [20, 0], {
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
  const fromSlide = interpolate(frame, [fromDelay, fromDelay + 18], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // --- CTA overlay (fades in during "From" hold phase) ---
  const ctaOverlayStart = fromFullyVisible + 10;
  const ctaOverlayOpacity = interpolate(
    frame,
    [ctaOverlayStart, ctaOverlayStart + 15],
    [0, 0.85],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // --- Content fade out (message, labels, lines — but CTA stays) ---
  const contentFadeOut = interpolate(frame, [contentFadeOutStart, contentFadeOutEnd], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- CTA (full opacity after message fades, holds to end) ---
  const ctaFullOpacity = interpolate(
    frame,
    [ctaStart, ctaStart + 10],
    [ctaOverlayOpacity, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const ctaOpacity = frame >= ctaStart ? ctaFullOpacity : ctaOverlayOpacity;
  const ctaSlide = interpolate(
    frame,
    [ctaOverlayStart, ctaOverlayStart + 18],
    [20, 0],
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

      {/* Dark gradient overlay */}
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

      {/* Hook text — visible on frame 0 for thumbnail, fades as reveal starts */}
      {hookOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: isVertical ? '0 90px' : '0 60px',
            opacity: hookOpacity,
          }}
        >
          <div
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: isVertical ? 58 : 44,
              lineHeight: 1.5,
              color: '#f0e8e0',
              textAlign: 'center',
              fontWeight: 400,
              fontStyle: 'italic',
              textShadow: '0 2px 12px rgba(0, 0, 0, 0.8), 0 4px 30px rgba(0, 0, 0, 0.5)',
            }}
          >
            {hookText}
          </div>
        </div>
      )}

      {/* Main content — fades out independently before CTA stays */}
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
                  opacity: frame >= contentDelay ? wordProgress : 0,
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

      {/* CTA — overlays during "From" hold, then stays after message fades */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: isVertical ? 350 : 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: ctaOpacity,
          transform: `translateY(${ctaSlide}px)`,
        }}
      >
        <div
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: isVertical ? 26 : 20,
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
            fontSize: isVertical ? 36 : 28,
            fontWeight: 400,
            color: '#f0e8e0',
            marginTop: isVertical ? 16 : 10,
            letterSpacing: '2px',
            textShadow: '0 2px 15px rgba(0, 0, 0, 0.6)',
          }}
        >
          wordsleftunsaid.netlify.app
        </div>
      </div>
    </AbsoluteFill>
  );
};
