import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion';
import type { MessageProps } from '../compositions/Root';
import { FilmGrain, CTASection, useFadeIn, BackgroundMusic, useLoopFade } from './template-utils';

/**
 * Typewriter — raw, confessional template.
 *
 * Design: JetBrains Mono on pure black, green-tinted white text (#d4e8d4),
 * character-by-character reveal with block cursor. Terminal/Notes aesthetic.
 * No decorative elements — the rawness IS the design.
 *
 * 240 frames / 30fps = 8 seconds total.
 */
export const TypewriterMessage: React.FC<MessageProps> = ({
  from,
  to,
  content,
  musicFile,
}) => {
  const frame = useCurrentFrame();
  const { height, durationInFrames } = useVideoConfig();
  const isVertical = height > 1200;
  const loopFade = useLoopFade();

  // --- Animation timing (fast for social media) ---
  // Blinking cursor on empty screen (frames 0-10) — the hook
  const cursorOnly = frame < 10;

  // Content reveal: char-by-char (frames 10 → 10 + content.length * 0.4)
  const contentDelay = 10;
  const totalRevealFrames = Math.max(content.length * 0.4, 30);
  const charsRevealed = interpolate(
    frame,
    [contentDelay, contentDelay + totalRevealFrames],
    [0, content.length],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const visibleContent = content.slice(0, Math.floor(charsRevealed));
  const isTyping = frame >= contentDelay && frame < contentDelay + totalRevealFrames + 15;

  // Block cursor blink (visible every other 8-frame cycle)
  const showCursor = (cursorOnly || isTyping) && Math.floor(frame / 8) % 2 === 0;

  // "To" label (frames 5-25)
  const toOpacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // "From" attribution
  const fromDelay = contentDelay + totalRevealFrames + 15;
  const fromAnim = useFadeIn(fromDelay, 20);

  // CTA
  const ctaDelay = fromDelay + 30;
  const ctaAnim = useFadeIn(ctaDelay, 20);

  const contentFontSize = isVertical ? 56 : 42;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        opacity: loopFade,
      }}
    >
      <BackgroundMusic musicFile={musicFile} />
      {/* Subtle scanline/grain effect */}
      <FilmGrain opacity={0.03} blendMode="overlay" />

      {/* Main content area — left-aligned for terminal feel */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100%',
          padding: isVertical
            ? '250px 80px 400px 80px'
            : '100px 60px 180px 60px',
        }}
      >
        {/* "To" label — monospace, understated */}
        <div
          style={{
            opacity: toOpacity,
            fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
            fontSize: isVertical ? 24 : 18,
            fontWeight: 400,
            color: 'rgba(212, 232, 212, 0.4)',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            marginBottom: isVertical ? 40 : 25,
          }}
        >
          to: {to}
        </div>

        {/* Message — character reveal with block cursor */}
        <div
          style={{
            fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
            fontSize: contentFontSize,
            lineHeight: 1.6,
            color: '#d4e8d4',
            maxWidth: isVertical ? 900 : 820,
            fontWeight: 400,
            minHeight: isVertical ? 300 : 200,
          }}
        >
          {visibleContent}
          {showCursor && (
            <span
              style={{
                display: 'inline-block',
                width: contentFontSize * 0.6,
                height: contentFontSize * 1.15,
                backgroundColor: '#d4e8d4',
                verticalAlign: 'text-bottom',
                marginLeft: 2,
              }}
            />
          )}
        </div>

        {/* "From" signature — minimal */}
        <div
          style={{
            opacity: fromAnim.opacity,
            transform: `translateY(${fromAnim.slideY}px)`,
            fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
            fontSize: isVertical ? 24 : 18,
            fontWeight: 400,
            color: 'rgba(212, 232, 212, 0.5)',
            marginTop: isVertical ? 50 : 35,
            letterSpacing: '3px',
          }}
        >
          — {from}
        </div>
      </div>

      {/* CTA — muted terminal style */}
      <CTASection
        opacity={ctaAnim.opacity}
        slideY={ctaAnim.slideY}
        isVertical={isVertical}
        fontFamily='"JetBrains Mono", "Fira Code", "Courier New", monospace'
        color="rgba(212, 232, 212, 0.4)"
      />
    </AbsoluteFill>
  );
};
