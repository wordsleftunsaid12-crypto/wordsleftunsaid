import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion';
import type { MessageProps } from '../compositions/Root';
import { FilmGrain, Vignette, useFadeIn, useFadeOut, BackgroundMusic, useLoopFade } from './template-utils';

/**
 * Handwritten — personal, discovered-letter template.
 *
 * Design: Caveat handwriting font on parchment cream (#f5eede), ink brown (#3a2e24),
 * real letter format with "Dear [to]," opening and "Always, [from]" closing.
 * Left-aligned for authenticity. Faded coffee ring and subtle paper grain.
 *
 * 240 frames / 30fps = 8 seconds total.
 */
export const HandwrittenMessage: React.FC<MessageProps> = ({
  from,
  to,
  content,
  musicFile,
}) => {
  const frame = useCurrentFrame();
  const { height, durationInFrames } = useVideoConfig();
  const isVertical = height > 1200;
  const loopFade = useLoopFade();

  // --- Animation timing ---
  // "Dear [to]," visible on frame 0 — the hook
  const salutationOpacity = interpolate(frame, [0, 15], [0.6, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Content fades in (frames 25-55)
  const contentOpacity = interpolate(frame, [25, 55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const contentSlide = interpolate(frame, [25, 55], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Closing "Always, [from]" (frames 100-130)
  const closingAnim = useFadeIn(100, 25);

  // Watermark branding — subtle, bottom
  const brandOpacity = interpolate(frame, [130, 155, durationInFrames - 30, durationInFrames], [0, 0.3, 0.3, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Coffee ring stain decorative element — very subtle
  const stainOpacity = interpolate(frame, [0, 30], [0.03, 0.06], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const contentFontSize = isVertical ? 64 : 48;

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(175deg, #f5eede 0%, #efe5d4 50%, #e8dcc8 100%)',
        opacity: loopFade,
      }}
    >
      <BackgroundMusic musicFile={musicFile} />
      {/* Paper grain texture */}
      <FilmGrain opacity={0.06} blendMode="multiply" />

      {/* Soft vignette for aged-paper look */}
      <Vignette innerRadius="45%" outerOpacity={0.2} />

      {/* Decorative coffee ring stain — top right area */}
      <div
        style={{
          position: 'absolute',
          top: isVertical ? '12%' : '8%',
          right: isVertical ? '10%' : '8%',
          width: isVertical ? 180 : 130,
          height: isVertical ? 180 : 130,
          borderRadius: '50%',
          border: '3px solid rgba(139, 107, 72, 0.15)',
          opacity: stainOpacity,
          transform: 'rotate(-15deg)',
        }}
      />

      {/* Main content area — left-aligned for letter authenticity */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100%',
          padding: isVertical
            ? '300px 100px 400px 100px'
            : '120px 80px 180px 80px',
        }}
      >
        {/* "Dear [to]," — salutation */}
        <div
          style={{
            opacity: salutationOpacity,
            fontFamily: 'Caveat, "Dancing Script", cursive',
            fontSize: isVertical ? 52 : 40,
            fontWeight: 400,
            color: '#3a2e24',
            marginBottom: isVertical ? 35 : 25,
          }}
        >
          Dear {to},
        </div>

        {/* Message body — left-aligned, letter style */}
        <div
          style={{
            opacity: contentOpacity,
            transform: `translateY(${contentSlide}px)`,
            fontFamily: 'Caveat, "Dancing Script", cursive',
            fontSize: contentFontSize,
            lineHeight: 1.5,
            color: '#3a2e24',
            maxWidth: isVertical ? 880 : 820,
            fontWeight: 400,
          }}
        >
          {content}
        </div>

        {/* Closing — "Always, [from]" */}
        <div
          style={{
            opacity: closingAnim.opacity,
            transform: `translateY(${closingAnim.slideY}px)`,
            fontFamily: 'Caveat, "Dancing Script", cursive',
            fontSize: isVertical ? 48 : 36,
            fontStyle: 'italic',
            fontWeight: 400,
            color: 'rgba(58, 46, 36, 0.7)',
            marginTop: isVertical ? 50 : 35,
          }}
        >
          Always, {from}
        </div>
      </div>

      {/* Watermark branding — subtle, not a full CTA */}
      <div
        style={{
          position: 'absolute',
          bottom: isVertical ? 280 : 50,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'Caveat, "Dancing Script", cursive',
          fontSize: isVertical ? 24 : 18,
          color: 'rgba(58, 46, 36, 0.4)',
          opacity: brandOpacity,
          letterSpacing: '2px',
        }}
      >
        wordsleftunsent.com
      </div>
    </AbsoluteFill>
  );
};
