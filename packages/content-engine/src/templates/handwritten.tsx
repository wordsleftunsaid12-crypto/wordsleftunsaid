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
import { FilmGrain, Vignette, useFadeIn, BackgroundMusic } from './template-utils';

export interface HandwrittenProps extends MessageProps {
  backgroundVideo?: string;
}

/**
 * Handwritten — personal, discovered-letter template.
 *
 * Design: Caveat handwriting font on parchment cream (or background video with parchment overlay),
 * ink brown text, real letter format with "Dear [to]," opening and "Always, [from]" closing.
 * Left-aligned for authenticity. Faded coffee ring and subtle paper grain.
 */
export const HandwrittenMessage: React.FC<HandwrittenProps> = ({
  from,
  to,
  content,
  musicFile,
  backgroundVideo,
}) => {
  const frame = useCurrentFrame();
  const { height, durationInFrames } = useVideoConfig();
  const isVertical = height > 1200;
  const hasVideo = !!backgroundVideo;

  // Fade-in only — no fade-out so "Dear [to]," never disappears
  const fadeIn = interpolate(frame, [0, 15], [0.85, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Animation timing (fast for social media) ---
  // "Dear [to]," visible on frame 0 — the hook
  const salutationOpacity = interpolate(frame, [0, 10], [0.6, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Content fades in quickly (frames 15-35)
  const contentOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const contentSlide = interpolate(frame, [15, 35], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Closing "Always, [from]" (frames 55-75)
  const closingAnim = useFadeIn(55, 18);

  // Watermark branding — subtle, bottom
  const brandOpacity = interpolate(frame, [75, 95, durationInFrames - 25, durationInFrames], [0, 0.3, 0.3, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Coffee ring stain decorative element — very subtle
  const stainOpacity = interpolate(frame, [0, 30], [0.03, 0.06], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const contentFontSize = isVertical ? 64 : 48;

  // Text colors — always dark brown since cream overlay creates a light background
  const textColor = '#3a2e24';
  const closingColor = 'rgba(58, 46, 36, 0.7)';
  const brandColor = 'rgba(58, 46, 36, 0.4)';
  const stainBorderColor = 'rgba(139, 107, 72, 0.15)';
  const textShadow = 'none';

  return (
    <AbsoluteFill
      style={{
        background: hasVideo
          ? '#0a0908'
          : 'linear-gradient(175deg, #f5eede 0%, #efe5d4 50%, #e8dcc8 100%)',
        opacity: fadeIn,
      }}
    >
      <BackgroundMusic musicFile={musicFile} />

      {/* Optional background video with parchment overlay */}
      {backgroundVideo && (
        <>
          <AbsoluteFill>
            <Video
              src={staticFile(backgroundVideo)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </AbsoluteFill>
          {/* Cream/parchment overlay */}
          <AbsoluteFill
            style={{
              background: `linear-gradient(
                175deg,
                rgba(245, 238, 222, 0.65) 0%,
                rgba(239, 229, 212, 0.7) 50%,
                rgba(232, 220, 200, 0.75) 100%
              )`,
            }}
          />
        </>
      )}

      {/* Paper grain texture */}
      <FilmGrain opacity={hasVideo ? 0.04 : 0.06} blendMode={hasVideo ? 'overlay' : 'multiply'} />

      {/* Soft vignette for aged-paper look */}
      <Vignette innerRadius={hasVideo ? '35%' : '45%'} outerOpacity={hasVideo ? 0.4 : 0.2} />

      {/* Decorative coffee ring stain — top right area */}
      <div
        style={{
          position: 'absolute',
          top: isVertical ? '12%' : '8%',
          right: isVertical ? '10%' : '8%',
          width: isVertical ? 180 : 130,
          height: isVertical ? 180 : 130,
          borderRadius: '50%',
          border: `3px solid ${stainBorderColor}`,
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
            color: textColor,
            marginBottom: isVertical ? 35 : 25,
            textShadow,
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
            color: textColor,
            maxWidth: isVertical ? 880 : 820,
            fontWeight: 400,
            textShadow,
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
            color: closingColor,
            marginTop: isVertical ? 50 : 35,
            textShadow,
          }}
        >
          Always, {from}
        </div>
      </div>

      {/* Watermark branding — subtle, not a full CTA */}
      <div
        style={{
          position: 'absolute',
          bottom: isVertical ? 340 : 50,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'Caveat, "Dancing Script", cursive',
          fontSize: isVertical ? 24 : 18,
          color: brandColor,
          opacity: brandOpacity,
          letterSpacing: '2px',
          textShadow,
        }}
      >
        wordsleftunsent.com
      </div>
    </AbsoluteFill>
  );
};
