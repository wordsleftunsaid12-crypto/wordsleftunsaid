import React from 'react';
import {
  AbsoluteFill,
  Video,
  staticFile,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
  spring,
} from 'remotion';
import type { MessageProps } from '../compositions/Root';
import { BackgroundMusic, useLoopFade } from './template-utils';

export interface SplitScreenProps extends MessageProps {
  backgroundVideo?: string;
}

/**
 * Derive a "safe" surface-level response from the raw content.
 * This is hardcoded logic — not AI-generated.
 */
function getSafeResponse(content: string): string {
  const lower = content.toLowerCase();
  const wordCount = content.split(/\s+/).length;

  // Short messages → "I'm fine"
  if (wordCount < 15) return "I'm fine";

  // Emotional keywords → dismissive response
  const emotionalWords = [
    'love',
    'miss',
    'hurt',
    'sorry',
    'hate',
    'feel',
    'heart',
    'cry',
    'alone',
    'scared',
    'afraid',
    'broken',
    'pain',
    'wish',
    'regret',
  ];
  if (emotionalWords.some((w) => lower.includes(w))) {
    return "It's nothing, don't worry about it";
  }

  // Mentions a person → polite deflection
  if (
    lower.includes('you ') ||
    lower.includes('your ') ||
    lower.includes('we ')
  ) {
    return 'We should catch up sometime';
  }

  return "Yeah, everything's good";
}

/**
 * SplitScreen — "What I said" vs "What I meant" split horizontally.
 *
 * Design: 35% top (light, safe response) / 65% bottom (dark, real message).
 * The smaller top half keeps the safe response compact while giving the
 * real message room to breathe alongside the CTA.
 */
export const SplitScreenMessage: React.FC<SplitScreenProps> = ({
  from,
  content,
  backgroundVideo,
  musicFile,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const loopFade = useLoopFade(15, 8);

  const safeText = getSafeResponse(content);

  // --- Animation timing ---
  // Top half label
  const topLabelOpacity = interpolate(frame, [5, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Safe response on top
  const safeOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const safeSlide = interpolate(frame, [15, 35], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Divider line grows from center
  const dividerWidth = spring({
    frame: frame - 35,
    fps,
    config: { damping: 12, stiffness: 40 },
    durationInFrames: 30,
  });

  // Bottom half label
  const bottomLabelOpacity = interpolate(frame, [45, 58], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Real message — word by word reveal on bottom
  const words = content.split(/\s+/);
  const wordRevealStart = 60;
  const wordsPerFrame = 0.25; // ~4 frames per word for snappier reveal
  const revealEnd = wordRevealStart + words.length / wordsPerFrame;
  const wordsVisible = Math.floor(
    interpolate(
      frame,
      [wordRevealStart, revealEnd],
      [0, words.length],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    ),
  );

  // From attribution
  const fromOpacity = interpolate(
    frame,
    [revealEnd + 8, revealEnd + 20],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // --- CTA timing — appears after attribution, stays visible to end ---
  const ctaStart = revealEnd + 15;
  const ctaOpacity = interpolate(
    frame,
    [ctaStart, ctaStart + 20],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        opacity: loopFade,
      }}
    >
      <BackgroundMusic musicFile={musicFile} />

      {/* ===== TOP — "What I said" (35%) ===== */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '35%',
          background:
            'linear-gradient(175deg, #F5F0EB 0%, #EDE6DD 50%, #E5DCD2 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '80px 80px 40px',
          overflow: 'hidden',
        }}
      >
        {/* Label */}
        <div
          style={{
            position: 'absolute',
            top: 80,
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: topLabelOpacity,
            fontFamily: 'Poppins, sans-serif',
            fontSize: 26,
            fontWeight: 600,
            color: '#8A7B6D',
            letterSpacing: '8px',
            textTransform: 'uppercase',
          }}
        >
          What I said
        </div>

        {/* Safe response */}
        <div
          style={{
            opacity: safeOpacity,
            transform: `translateY(${safeSlide}px)`,
            fontFamily: 'Poppins, sans-serif',
            fontSize: 52,
            fontWeight: 600,
            lineHeight: 1.4,
            color: '#2A1F18',
            textAlign: 'center',
            maxWidth: 850,
            marginTop: 30,
          }}
        >
          &ldquo;{safeText}&rdquo;
        </div>
      </div>

      {/* ===== DIVIDER ===== */}
      <div
        style={{
          position: 'absolute',
          top: '35%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${dividerWidth * 100}%`,
          height: 3,
          background:
            'linear-gradient(90deg, transparent, rgba(180, 160, 140, 0.6), transparent)',
          zIndex: 10,
        }}
      />

      {/* ===== BOTTOM — "What I meant" (65%) ===== */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '65%',
          overflow: 'hidden',
        }}
      >
        {/* Optional background video on bottom half */}
        {backgroundVideo && (
          <>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <Video
                src={staticFile(backgroundVideo)}
                style={{
                  width: '100%',
                  height: '200%',
                  objectFit: 'cover',
                  objectPosition: 'center bottom',
                }}
              />
            </div>
            {/* Dark overlay */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(
                  180deg,
                  rgba(10, 10, 20, 0.75) 0%,
                  rgba(10, 10, 20, 0.85) 50%,
                  rgba(10, 10, 20, 0.9) 100%
                )`,
              }}
            />
          </>
        )}

        {/* Dark gradient background when no video */}
        {!backgroundVideo && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                'linear-gradient(175deg, #1A1A2E 0%, #16162A 50%, #0F0F1F 100%)',
            }}
          />
        )}

        {/* Content — centered in safe area (above bottom 300px overlay) */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            padding: '60px 80px 480px',
          }}
        >
          {/* Label */}
          <div
            style={{
              position: 'absolute',
              top: 50,
              left: 0,
              right: 0,
              textAlign: 'center',
              opacity: bottomLabelOpacity,
              fontFamily: 'Poppins, sans-serif',
              fontSize: 26,
              fontWeight: 600,
              color: 'rgba(220, 190, 150, 0.8)',
              letterSpacing: '8px',
              textTransform: 'uppercase',
            }}
          >
            What I meant
          </div>

          {/* Real message — word by word */}
          <div
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 48,
              fontWeight: 500,
              lineHeight: 1.5,
              color: '#ffffff',
              textAlign: 'center',
              maxWidth: 880,
              marginTop: 20,
              textShadow:
                '0 2px 15px rgba(0, 0, 0, 0.5)',
            }}
          >
            {words.slice(0, wordsVisible).map((word, i) => {
              const wordFrame = wordRevealStart + i / wordsPerFrame;
              const wordOpacity = interpolate(
                frame,
                [wordFrame, wordFrame + 5],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
              return (
                <span key={i} style={{ opacity: wordOpacity }}>
                  {word}{' '}
                </span>
              );
            })}
          </div>

          {/* From attribution */}
          <div
            style={{
              opacity: fromOpacity,
              fontFamily: 'Poppins, sans-serif',
              fontSize: 26,
              fontWeight: 300,
              color: 'rgba(220, 190, 150, 0.7)',
              marginTop: 40,
              letterSpacing: '4px',
              textTransform: 'uppercase',
            }}
          >
            &mdash; {from}
          </div>
        </div>
      </div>

      {/* CTA — positioned above social media overlay zone */}
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
          zIndex: 5,
        }}
      >
        <div
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 34,
            fontWeight: 300,
            color: 'rgba(220, 190, 150, 0.8)',
            letterSpacing: '3px',
            textAlign: 'center',
          }}
        >
          Share your unsent message
        </div>
        <div
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 46,
            fontWeight: 600,
            color: '#ffffff',
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
