import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
  staticFile,
} from 'remotion';
import type { MessageProps } from '../compositions/Root';
import {
  FilmGrain,
  Vignette,
  AmbientGlow,
  CTASection,
  Attribution,
  useFadeIn,
  useLoopFade,
} from './template-utils';

export interface VoiceNarrationProps extends MessageProps {
  /** Path to TTS audio file (relative to public/) */
  audioFile?: string;
  /** Word-level timing data from TTS pipeline: [{word, startMs, endMs}] */
  wordTimings?: Array<{ word: string; startMs: number; endMs: number }>;
  /** Audio duration in ms (used for animation timing) */
  audioDurationMs?: number;
}

/**
 * VoiceNarration — intimate, confessional template.
 *
 * Design: Poppins 400, 62px on dark gradient with warm glow.
 * Words appear synced to TTS audio. Duration adapts to content length.
 * Audio plays via Remotion's <Audio> component.
 *
 * Dynamic duration — determined by TTS audio length + padding.
 */
export const VoiceNarrationMessage: React.FC<VoiceNarrationProps> = ({
  from,
  content,
  audioFile,
  wordTimings,
  audioDurationMs = 5000,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, height } = useVideoConfig();
  const isVertical = height > 1200;
  const loopFade = useLoopFade();

  const currentTimeMs = (frame / fps) * 1000;

  // --- Timing ---
  // 1s intro before audio starts
  const audioStartFrame = 30;
  const audioStartMs = (audioStartFrame / fps) * 1000;

  // Words from content (fallback if no timings provided)
  const words = content.split(/\s+/);

  // Determine word visibility based on TTS timings or fallback
  const getWordProgress = (wordIndex: number): number => {
    if (wordTimings && wordTimings[wordIndex]) {
      const timing = wordTimings[wordIndex];
      const wordStartMs = timing.startMs + audioStartMs;
      const wordEndMs = timing.endMs + audioStartMs;
      const revealDuration = Math.max(wordEndMs - wordStartMs, 150);

      return interpolate(
        currentTimeMs,
        [wordStartMs - 50, wordStartMs + revealDuration * 0.3],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );
    }

    // Fallback: evenly distribute words across audio duration
    const wordDuration = audioDurationMs / words.length;
    const wordStartMs = wordIndex * wordDuration + audioStartMs;
    return interpolate(
      currentTimeMs,
      [wordStartMs, wordStartMs + 200],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
  };

  // Attribution appears after all words
  const lastWordEndMs = wordTimings && wordTimings.length > 0
    ? wordTimings[wordTimings.length - 1].endMs + audioStartMs
    : audioDurationMs + audioStartMs;
  const fromDelay = Math.ceil((lastWordEndMs / 1000 + 0.5) * fps);
  const fromAnim = useFadeIn(fromDelay, 20);

  // CTA appears after attribution
  const ctaDelay = fromDelay + 25;
  const ctaAnim = useFadeIn(ctaDelay, 20);

  // Ambient glow breathing
  const glowOpacity = interpolate(
    frame,
    [0, durationInFrames * 0.3, durationInFrames * 0.6, durationInFrames],
    [0.08, 0.18, 0.12, 0.08],
    { extrapolateRight: 'clamp' },
  );
  const glowScale = interpolate(frame, [0, durationInFrames], [0.9, 1.15], {
    extrapolateRight: 'clamp',
  });

  // Adaptive font sizing — scale down for longer messages, floor at 42px (still very readable)
  const charCount = content.length;
  const contentFontSize = isVertical
    ? Math.max(42, Math.round(interpolate(charCount, [0, 150, 400], [62, 62, 42], { extrapolateRight: 'clamp' })))
    : Math.max(36, Math.round(interpolate(charCount, [0, 150, 400], [48, 48, 36], { extrapolateRight: 'clamp' })));
  // Tighter line-height for smaller fonts to use space efficiently
  const contentLineHeight = contentFontSize >= 56 ? 1.6 : 1.5;

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(170deg, #0a0908 0%, #141210 40%, #0d0b0a 100%)',
        opacity: loopFade,
      }}
    >
      {/* Audio playback — delayed to match word reveal offset */}
      {audioFile && (
        <Sequence from={audioStartFrame}>
          <Audio
            src={staticFile(audioFile)}
            volume={1}
          />
        </Sequence>
      )}

      {/* Ambient warm glow */}
      <AmbientGlow
        opacity={glowOpacity}
        scale={glowScale}
        isVertical={isVertical}
      />

      {/* Vignette */}
      <Vignette innerRadius="35%" outerOpacity={0.5} />

      {/* Film grain */}
      <FilmGrain opacity={0.035} />

      {/* Main content — word-synced reveal */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          padding: isVertical
            ? `${charCount > 250 ? 200 : 250}px 90px ${charCount > 250 ? 320 : 400}px 90px`
            : '100px 60px 180px 60px',
        }}
      >
        {/* Message — word by word synced to audio */}
        <div
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: contentFontSize,
            fontWeight: 400,
            lineHeight: contentLineHeight,
            color: '#f0e8e0',
            textAlign: 'center',
            maxWidth: isVertical ? 860 : 800,
          }}
        >
          {words.map((word, i) => {
            const progress = getWordProgress(i);
            return (
              <span
                key={i}
                style={{
                  opacity: frame >= audioStartFrame ? progress : 0,
                  display: 'inline-block',
                  filter: `blur(${interpolate(progress, [0, 1], [3, 0])}px)`,
                  marginRight: '0.3em',
                  transition: 'none',
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* Attribution */}
        <Attribution
          from={from}
          opacity={fromAnim.opacity}
          slideY={fromAnim.slideY}
          isVertical={isVertical}
        />
      </div>

      {/* CTA */}
      <CTASection
        opacity={ctaAnim.opacity}
        slideY={ctaAnim.slideY}
        isVertical={isVertical}
      />
    </AbsoluteFill>
  );
};
