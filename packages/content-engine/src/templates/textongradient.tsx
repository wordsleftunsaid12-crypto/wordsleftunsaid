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
import type { MessageProps } from '../compositions/Root';
import { FilmGrain, Vignette, CTASection, MOOD_COLORS, BackgroundMusic, useLoopFade } from './template-utils';

export interface TextOnGradientProps extends MessageProps {
  mood?: string;
  backgroundVideo?: string;
}

/**
 * TextOnGradient — clean, viral template.
 *
 * Design: solid mood-mapped color background (or background video with mood overlay),
 * bold Poppins text, quick full-message reveal.
 * Meant for quick-hit scroll-stopping content.
 */
export const TextOnGradientMessage: React.FC<TextOnGradientProps> = ({
  from,
  to,
  content,
  mood = 'tender',
  musicFile,
  backgroundVideo,
}) => {
  const frame = useCurrentFrame();
  const { height, durationInFrames } = useVideoConfig();
  const isVertical = height > 1200;
  const loopFade = useLoopFade();

  const bgColor = MOOD_COLORS[mood] ?? MOOD_COLORS.tender;
  const hasVideo = !!backgroundVideo;

  // Parse hex to RGB for overlay rgba values
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
  };
  const bgRgb = hexToRgb(bgColor);

  // --- Animation timing ---
  // "To" label (frames 3-15)
  const toOpacity = interpolate(frame, [3, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const toSlide = interpolate(frame, [3, 15], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Content fades in quickly (frames 5-20)
  const contentOpacity = interpolate(frame, [5, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const contentSlide = interpolate(frame, [5, 22], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // "From" attribution (frames 40-60)
  const fromOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fromSlide = interpolate(frame, [40, 60], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // CTA — relative to end
  const ctaStart = Math.max(80, durationInFrames - 80);
  const ctaOpacity = interpolate(frame, [ctaStart, ctaStart + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ctaSlide = interpolate(frame, [ctaStart, ctaStart + 18], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const contentFontSize = isVertical ? 72 : 54;

  // Adapt colors based on background type
  const textColor = hasVideo ? '#f0e8e0' : '#1a1a1a';
  const toColor = hasVideo ? 'rgba(220, 190, 150, 0.8)' : 'rgba(26, 26, 26, 0.5)';
  const fromColor = hasVideo ? 'rgba(220, 190, 150, 0.85)' : 'rgba(26, 26, 26, 0.6)';
  const ctaColor = hasVideo ? 'rgba(220, 190, 150, 1)' : 'rgba(26, 26, 26, 0.5)';
  const textShadow = hasVideo ? '0 2px 12px rgba(0, 0, 0, 0.8), 0 4px 30px rgba(0, 0, 0, 0.5)' : 'none';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        opacity: loopFade,
      }}
    >
      <BackgroundMusic musicFile={musicFile} />

      {/* Optional background video with mood-colored overlay */}
      {backgroundVideo && (
        <>
          <AbsoluteFill>
            <Video
              src={staticFile(backgroundVideo)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </AbsoluteFill>
          {/* Mood-colored gradient overlay */}
          <AbsoluteFill
            style={{
              background: `linear-gradient(
                180deg,
                rgba(${bgRgb}, 0.55) 0%,
                rgba(${bgRgb}, 0.65) 40%,
                rgba(${bgRgb}, 0.72) 70%,
                rgba(${bgRgb}, 0.80) 100%
              )`,
            }}
          />
        </>
      )}

      {/* Subtle grain for texture */}
      <FilmGrain opacity={hasVideo ? 0.04 : 0.04} blendMode={hasVideo ? 'overlay' : 'multiply'} />

      {/* Soft vignette */}
      <Vignette innerRadius={hasVideo ? '35%' : '50%'} outerOpacity={hasVideo ? 0.5 : 0.15} />

      {/* Main content — centered, dominant */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          padding: isVertical
            ? '200px 90px 540px 90px'
            : '100px 60px 180px 60px',
        }}
      >
        {/* "To" label */}
        <div
          style={{
            opacity: toOpacity,
            transform: `translateY(${toSlide}px)`,
            fontFamily: 'Poppins, sans-serif',
            fontSize: isVertical ? 26 : 20,
            fontWeight: 400,
            color: toColor,
            letterSpacing: '5px',
            textTransform: 'uppercase',
            marginBottom: isVertical ? 30 : 20,
            textShadow,
          }}
        >
          To {to}
        </div>

        {/* Message — full text, bold */}
        <div
          style={{
            opacity: contentOpacity,
            transform: `translateY(${contentSlide}px)`,
            fontFamily: 'Poppins, sans-serif',
            fontSize: contentFontSize,
            fontWeight: 600,
            lineHeight: 1.4,
            color: textColor,
            textAlign: 'center',
            maxWidth: isVertical ? 880 : 820,
            textShadow,
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
            color: fromColor,
            marginTop: isVertical ? 50 : 35,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            textShadow,
          }}
        >
          &mdash; {from}
        </div>
      </div>

      {/* CTA */}
      <CTASection
        opacity={ctaOpacity}
        slideY={ctaSlide}
        isVertical={isVertical}
        color={ctaColor}
      />
    </AbsoluteFill>
  );
};
