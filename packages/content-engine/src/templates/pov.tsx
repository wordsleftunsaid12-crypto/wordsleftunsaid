import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion';

export interface POVProps {
  from: string;
  to: string;
  content: string;
  ctaLine1?: string;
  ctaLine2?: string;
}

/**
 * POV-style template optimized for TikTok and Instagram Reels.
 *
 * Design: bold sans-serif on dark background, fast full-message reveal,
 * "POV: you never sent this message" hook visible on frame 0 for thumbnails.
 *
 * 240 frames / 30fps = 8 seconds total.
 */
export const POVMessage: React.FC<POVProps> = ({
  from,
  content,
  ctaLine1,
  ctaLine2,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const isVertical = height > 1200;

  // --- Animation timing (240 frames = 8 seconds) ---
  // Hook: visible on frame 0, fades out by frame 60
  const hookOpacity = interpolate(frame, [0, 40, 50, 60], [1, 1, 0.5, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Message: scales in from 0.92→1.0 with fade
  const messageOpacity = interpolate(frame, [55, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const messageScale = interpolate(frame, [55, 80], [0.92, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // "From" attribution
  const fromOpacity = interpolate(frame, [110, 135], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fromSlide = interpolate(frame, [110, 135], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // CTA
  const ctaOpacity = interpolate(frame, [165, 190], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ctaSlide = interpolate(frame, [165, 188], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Ambient glow animation
  const glowOpacity = interpolate(
    frame,
    [0, 80, 160, 240],
    [0.08, 0.18, 0.12, 0.08],
    { extrapolateRight: 'clamp' },
  );
  const glowScale = interpolate(frame, [0, 240], [0.9, 1.1], {
    extrapolateRight: 'clamp',
  });

  // Accent line
  const lineWidth = interpolate(frame, [47, 70], [0, isVertical ? 200 : 150], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const contentFontSize = isVertical ? 72 : 54;

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(170deg, #0a0908 0%, #1a1412 50%, #0d0b0a 100%)',
      }}
    >
      {/* Ambient warm glow behind text */}
      <div
        style={{
          position: 'absolute',
          width: isVertical ? 700 : 500,
          height: isVertical ? 700 : 500,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(180,130,90,0.35) 0%, transparent 60%)',
          top: '35%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${glowScale})`,
          opacity: glowOpacity,
          filter: 'blur(80px)',
        }}
      />

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, 0.6) 100%)',
        }}
      />

      {/* Film grain */}
      <AbsoluteFill
        style={{
          opacity: 0.035,
          mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Hook text — "POV: you never sent this message" */}
      {hookOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            top: isVertical ? 280 : 120,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            opacity: hookOpacity,
          }}
        >
          <div
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: isVertical ? 44 : 34,
              fontWeight: 700,
              color: 'rgba(220, 190, 150, 0.95)',
              letterSpacing: '1px',
              textAlign: 'center',
              textShadow:
                '0 2px 20px rgba(0, 0, 0, 0.8), 0 4px 40px rgba(0, 0, 0, 0.5)',
              padding: '0 60px',
            }}
          >
            POV: you never sent this message
          </div>
        </div>
      )}

      {/* Main content area */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          padding: isVertical
            ? '300px 80px 350px 80px'
            : '100px 60px 180px 60px',
        }}
      >
        {/* Accent line */}
        <div
          style={{
            width: lineWidth,
            height: 2,
            background:
              'linear-gradient(90deg, transparent, rgba(220, 190, 150, 0.7), transparent)',
            marginBottom: isVertical ? 50 : 35,
          }}
        />

        {/* Message — full reveal with scale animation */}
        <div
          style={{
            opacity: messageOpacity,
            transform: `scale(${messageScale})`,
            fontFamily: 'Poppins, sans-serif',
            fontSize: contentFontSize,
            fontWeight: 700,
            lineHeight: 1.45,
            color: '#ffffff',
            textAlign: 'center',
            maxWidth: isVertical ? 900 : 820,
            textShadow:
              '0 2px 15px rgba(0, 0, 0, 0.7), 0 4px 40px rgba(0, 0, 0, 0.4)',
          }}
        >
          {content}
        </div>

        {/* "From" attribution */}
        <div
          style={{
            opacity: fromOpacity,
            transform: `translateY(${fromSlide}px)`,
            fontFamily: 'Poppins, sans-serif',
            fontSize: isVertical ? 30 : 24,
            fontWeight: 300,
            color: 'rgba(220, 190, 150, 0.85)',
            marginTop: isVertical ? 50 : 35,
            letterSpacing: '5px',
            textTransform: 'uppercase',
            textShadow: '0 1px 8px rgba(0, 0, 0, 0.5)',
          }}
        >
          &mdash; {from}
        </div>
      </div>

      {/* CTA */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: isVertical ? 250 : 80,
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
            fontSize: isVertical ? 28 : 20,
            fontWeight: 300,
            color: 'rgba(220, 190, 150, 1)',
            letterSpacing: '3px',
            textAlign: 'center',
            textShadow: '0 2px 20px rgba(0, 0, 0, 0.8)',
          }}
        >
          {ctaLine1 ?? 'Share your unsent message'}
        </div>
        <div
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: isVertical ? 38 : 28,
            fontWeight: 600,
            color: '#ffffff',
            marginTop: isVertical ? 14 : 8,
            letterSpacing: '2px',
            textShadow: '0 2px 20px rgba(0, 0, 0, 0.8)',
          }}
        >
          {ctaLine2 ?? 'wordsleftunsent.com'}
        </div>
      </div>
    </AbsoluteFill>
  );
};
