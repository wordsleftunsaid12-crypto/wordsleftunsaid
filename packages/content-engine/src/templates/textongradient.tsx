import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion';
import type { MessageProps } from '../compositions/Root';
import { FilmGrain, Vignette, CTASection, MOOD_COLORS, BackgroundMusic, useLoopFade } from './template-utils';

export interface TextOnGradientProps extends MessageProps {
  mood?: string;
}

/**
 * TextOnGradient — clean, viral template.
 *
 * Design: solid mood-mapped color background, bold Poppins text, dark text (#1a1a1a).
 * No word-by-word animation — the full message is the hook. Static simplicity.
 * Meant for quick-hit scroll-stopping content.
 *
 * 240 frames / 30fps = 8 seconds total.
 */
export const TextOnGradientMessage: React.FC<TextOnGradientProps> = ({
  from,
  content,
  mood = 'tender',
  musicFile,
}) => {
  const frame = useCurrentFrame();
  const { height, durationInFrames } = useVideoConfig();
  const isVertical = height > 1200;
  const loopFade = useLoopFade();

  const bgColor = MOOD_COLORS[mood] ?? MOOD_COLORS.tender;

  // --- Animation timing ---
  // Content fades in quickly (frames 5-25)
  const contentOpacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const contentSlide = interpolate(frame, [5, 28], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // "From" attribution (frames 60-85)
  const fromOpacity = interpolate(frame, [60, 85], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fromSlide = interpolate(frame, [60, 85], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // CTA — relative to end
  const ctaStart = Math.max(100, durationInFrames - 100);
  const ctaOpacity = interpolate(frame, [ctaStart, ctaStart + 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ctaSlide = interpolate(frame, [ctaStart, ctaStart + 23], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const contentFontSize = isVertical ? 72 : 54;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        opacity: loopFade,
      }}
    >
      <BackgroundMusic musicFile={musicFile} />
      {/* Subtle grain for texture */}
      <FilmGrain opacity={0.04} blendMode="multiply" />

      {/* Soft vignette */}
      <Vignette innerRadius="50%" outerOpacity={0.15} />

      {/* Main content — centered, dominant */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          padding: isVertical
            ? '200px 90px 400px 90px'
            : '100px 60px 180px 60px',
        }}
      >
        {/* Message — full text, bold, dark */}
        <div
          style={{
            opacity: contentOpacity,
            transform: `translateY(${contentSlide}px)`,
            fontFamily: 'Poppins, sans-serif',
            fontSize: contentFontSize,
            fontWeight: 600,
            lineHeight: 1.4,
            color: '#1a1a1a',
            textAlign: 'center',
            maxWidth: isVertical ? 880 : 820,
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
            fontSize: isVertical ? 30 : 22,
            fontWeight: 400,
            color: 'rgba(26, 26, 26, 0.6)',
            marginTop: isVertical ? 50 : 35,
            letterSpacing: '4px',
            textTransform: 'uppercase',
          }}
        >
          &mdash; {from}
        </div>
      </div>

      {/* CTA — dark text version */}
      <CTASection
        opacity={ctaOpacity}
        slideY={ctaSlide}
        isVertical={isVertical}
        color="rgba(26, 26, 26, 0.5)"
      />
    </AbsoluteFill>
  );
};
