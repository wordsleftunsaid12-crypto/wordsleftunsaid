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
import { FilmGrain, Vignette, BackgroundMusic } from './template-utils';

export interface HandwritingSVGProps extends MessageProps {
  backgroundVideo?: string;
}

/**
 * HandwritingSVG — SVG-based handwriting reveal on paper.
 *
 * Design: The message appears as if being handwritten in real time using
 * a clip-path sweep animation. Each line of text is revealed left-to-right
 * with a slight delay between lines, creating a natural writing effect.
 *
 * Background: ambient video with parchment overlay (like Handwritten template).
 * Uses Caveat font for authentic handwriting look.
 */
export const HandwritingSVGMessage: React.FC<HandwritingSVGProps> = ({
  from,
  to,
  content,
  musicFile,
  backgroundVideo,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const hasVideo = !!backgroundVideo;

  // Fade in — no fade out to keep writing visible
  const fadeIn = interpolate(frame, [0, 15], [0.85, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Break content into balanced lines for staggered left-to-right reveal ---
  const maxCharsPerLine = 28;
  const contentLines: string[] = (() => {
    const words = content.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];
    // Target equal-length lines to avoid orphan words
    const numLines = Math.max(1, Math.ceil(content.length / maxCharsPerLine));
    const targetLen = Math.ceil(content.length / numLines);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (test.length > targetLen && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  })();

  // --- Timing ---
  const writeStart = 15;
  const framesPerLine = 18;
  const totalWriteFrames = contentLines.length * framesPerLine;
  const writeEnd = writeStart + totalWriteFrames;

  // "Dear [to]," salutation — visible early
  const salutationReveal = interpolate(frame, [5, 20], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // "Always, [from]" closing
  const closingStart = writeEnd + 10;
  const closingReveal = interpolate(frame, [closingStart, closingStart + 20], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // --- CTA timing — appears after closing, stays visible to end ---
  const ctaStart = closingStart + 20;
  const ctaOpacity = interpolate(
    frame,
    [ctaStart, ctaStart + 20],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Coffee ring stain (decorative)
  const stainOpacity = interpolate(frame, [0, 30], [0.03, 0.06], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Pen wobble — very subtle y-offset on the writing
  const penWobble = Math.sin(frame * 0.3) * 0.5;

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
          <AbsoluteFill
            style={{
              background: `linear-gradient(
                175deg,
                rgba(245, 238, 222, 0.6) 0%,
                rgba(239, 229, 212, 0.65) 50%,
                rgba(232, 220, 200, 0.7) 100%
              )`,
            }}
          />
        </>
      )}

      <FilmGrain opacity={hasVideo ? 0.04 : 0.06} blendMode={hasVideo ? 'overlay' : 'multiply'} />
      <Vignette innerRadius={hasVideo ? '35%' : '45%'} outerOpacity={hasVideo ? 0.35 : 0.18} />

      {/* Coffee ring stain — top right */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          right: '8%',
          width: 160,
          height: 160,
          borderRadius: '50%',
          border: '3px solid rgba(139, 107, 72, 0.15)',
          opacity: stainOpacity,
          transform: 'rotate(-15deg)',
        }}
      />

      {/* Main writing area */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100%',
          padding: '300px 100px 540px 100px',
          transform: `translateY(${penWobble}px)`,
        }}
      >
        {/* "Dear [to]," — salutation with clip reveal */}
        <div
          style={{
            clipPath: `inset(0 ${100 - salutationReveal}% 0 0)`,
            fontFamily: 'Caveat, "Dancing Script", cursive',
            fontSize: 52,
            fontWeight: 400,
            color: '#3a2e24',
            marginBottom: 35,
          }}
        >
          Dear {to},
        </div>

        {/* Content lines — staggered left-to-right clip reveal (like handwriting) */}
        {contentLines.map((line, i) => {
          const lineStart = writeStart + i * framesPerLine;
          const lineReveal = interpolate(
            frame,
            [lineStart, lineStart + framesPerLine],
            [0, 100],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            },
          );

          return (
            <div
              key={i}
              style={{
                clipPath: `inset(0 ${100 - lineReveal}% 0 0)`,
                fontFamily: 'Caveat, "Dancing Script", cursive',
                fontSize: 64,
                fontWeight: 400,
                color: '#3a2e24',
                lineHeight: 1.5,
                maxWidth: 880,
              }}
            >
              {line}
            </div>
          );
        })}

        {/* "Always, [from]" — closing with clip reveal */}
        <div
          style={{
            clipPath: `inset(0 ${100 - closingReveal}% 0 0)`,
            fontFamily: 'Caveat, "Dancing Script", cursive',
            fontSize: 48,
            fontStyle: 'italic',
            fontWeight: 400,
            color: 'rgba(58, 46, 36, 0.7)',
            marginTop: 50,
          }}
        >
          Always, {from}
        </div>
      </div>

      {/* CTA — positioned above IG/TikTok overlay zone */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 480,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: ctaOpacity,
        }}
      >
        <div
          style={{
            fontFamily: 'SF Pro Text, -apple-system, sans-serif',
            fontSize: 34,
            fontWeight: 300,
            color: 'rgba(58, 46, 36, 0.7)',
            letterSpacing: '3px',
            textAlign: 'center',
          }}
        >
          Share your unsent message
        </div>
        <div
          style={{
            fontFamily: 'SF Pro Display, -apple-system, sans-serif',
            fontSize: 46,
            fontWeight: 600,
            color: '#3a2e24',
            marginTop: 16,
            letterSpacing: '2px',
            textAlign: 'center',
          }}
        >
          wordsleftunsent.com
        </div>
      </div>
    </AbsoluteFill>
  );
};
