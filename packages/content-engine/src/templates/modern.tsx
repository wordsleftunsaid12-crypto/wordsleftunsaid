import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion';
import type { MessageProps } from '../compositions/Root';

export const ModernMessage: React.FC<MessageProps> = ({ from, to, content }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const isVertical = height > 1200;

  // --- Animation timing ---
  const toDelay = 15;
  const contentDelay = 40;
  const words = content.split(' ');
  const wordRevealDuration = words.length * 5;
  const fromDelay = contentDelay + wordRevealDuration + 10;
  const fadeOutStart = 210;

  // --- Background: slow breathing dark gradient ---
  const bgBrightness = interpolate(frame, [0, 120, 240], [8, 11, 8], {
    extrapolateRight: 'clamp',
  });

  // --- Ambient glow that pulses ---
  const glowOpacity = interpolate(
    frame,
    [0, 60, 120, 180, 240],
    [0.05, 0.15, 0.1, 0.15, 0.05],
    { extrapolateRight: 'clamp' },
  );
  const glowScale = interpolate(frame, [0, 240], [0.9, 1.15], {
    extrapolateRight: 'clamp',
  });
  const glow2X = interpolate(frame, [0, 240], [70, 60], {
    extrapolateRight: 'clamp',
  });

  // --- Accent line ---
  const lineWidth = interpolate(frame, [5, 40], [0, 200], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // --- "To" label ---
  const toOpacity = interpolate(frame, [toDelay, toDelay + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const toSlide = interpolate(frame, [toDelay, toDelay + 25], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // --- Word-by-word reveal with staggered scale ---
  const wordsRevealed = interpolate(
    frame,
    [contentDelay, contentDelay + wordRevealDuration],
    [0, words.length],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // --- "From" ---
  const fromOpacity = interpolate(frame, [fromDelay, fromDelay + 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fromSlide = interpolate(frame, [fromDelay, fromDelay + 30], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // --- Fade out ---
  const fadeOut = interpolate(frame, [fadeOutStart, 240], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Branding ---
  const brandOpacity = interpolate(frame, [80, 100, 210, 240], [0, 0.4, 0.4, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const contentFontSize = isVertical ? 54 : 44;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: `hsl(20, 8%, ${bgBrightness}%)`,
        opacity: fadeOut,
      }}
    >
      {/* Ambient warm glow - top */}
      <div
        style={{
          position: 'absolute',
          width: isVertical ? 700 : 500,
          height: isVertical ? 700 : 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(156,122,101,0.4) 0%, transparent 65%)',
          top: '20%',
          left: '30%',
          opacity: glowOpacity,
          filter: 'blur(80px)',
          transform: `scale(${glowScale})`,
        }}
      />
      {/* Secondary glow - bottom right */}
      <div
        style={{
          position: 'absolute',
          width: isVertical ? 500 : 400,
          height: isVertical ? 500 : 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(140,100,80,0.3) 0%, transparent 65%)',
          bottom: '15%',
          left: `${glow2X}%`,
          opacity: glowOpacity * 0.7,
          filter: 'blur(70px)',
        }}
      />

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      {/* Main content */}
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
        }}
      >
        {/* Accent line */}
        <div
          style={{
            width: lineWidth,
            height: 1,
            background: 'linear-gradient(90deg, transparent, #9c7a65, transparent)',
            marginBottom: isVertical ? 60 : 40,
          }}
        />

        {/* "To" label */}
        <div
          style={{
            opacity: toOpacity,
            transform: `translateY(${toSlide}px)`,
            fontFamily: 'Poppins, sans-serif',
            fontSize: isVertical ? 28 : 22,
            fontWeight: 300,
            color: '#9c7a65',
            letterSpacing: '8px',
            textTransform: 'uppercase',
            marginBottom: isVertical ? 55 : 40,
          }}
        >
          To {to}
        </div>

        {/* Message — word by word with glow effect */}
        <div
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: contentFontSize,
            lineHeight: 1.65,
            color: '#ece4db',
            textAlign: 'center',
            maxWidth: isVertical ? 860 : 800,
            fontWeight: 400,
          }}
        >
          {words.map((word, i) => {
            const wordProgress = interpolate(
              wordsRevealed,
              [i - 0.3, i + 0.7],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );
            const wordScale = interpolate(wordProgress, [0, 0.5, 1], [0.9, 1.05, 1]);
            const wordBlur = interpolate(wordProgress, [0, 0.5, 1], [4, 0, 0]);
            return (
              <span
                key={i}
                style={{
                  opacity: wordProgress,
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
            fontSize: isVertical ? 28 : 22,
            fontWeight: 300,
            color: '#9c7a65',
            marginTop: isVertical ? 60 : 45,
            letterSpacing: '5px',
            textTransform: 'uppercase',
          }}
        >
          &mdash; {from}
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            width: lineWidth,
            height: 1,
            background: 'linear-gradient(90deg, transparent, #9c7a65, transparent)',
            marginTop: isVertical ? 60 : 40,
            opacity: 0.6,
          }}
        />
      </div>

      {/* Branding */}
      <div
        style={{
          position: 'absolute',
          bottom: isVertical ? 420 : 50,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'Poppins, sans-serif',
          fontSize: isVertical ? 15 : 14,
          color: '#9c7a65',
          opacity: brandOpacity,
          letterSpacing: '5px',
          textTransform: 'uppercase',
        }}
      >
        words left unsent
      </div>
    </AbsoluteFill>
  );
};
