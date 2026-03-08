import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
  Easing,
} from 'remotion';
import type { MessageProps } from '../compositions/Root';

export const ClassicMessage: React.FC<MessageProps> = ({ from, to, content }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const isVertical = height > 1200;

  // --- Timing ---
  const toDelay = 20;
  const contentDelay = 55;
  const totalRevealFrames = Math.max(content.length * 0.9, 45);
  const fromDelay = contentDelay + totalRevealFrames + 20;
  const fadeOutStart = 210;

  // --- Background: deep warm gradient that slowly shifts ---
  const gradAngle = interpolate(frame, [0, 240], [150, 175], { extrapolateRight: 'clamp' });

  // --- Large decorative quote mark that fades in behind text ---
  const quoteOpacity = interpolate(frame, [10, 50], [0, 0.06], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const quoteScale = interpolate(frame, [10, 60], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // --- Warm light bloom behind text area ---
  const bloomOpacity = interpolate(frame, [30, 70, 200, 240], [0, 0.25, 0.25, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bloomY = interpolate(frame, [0, 240], [45, 40], { extrapolateRight: 'clamp' });

  // --- Decorative side lines ---
  const lineLength = spring({ frame: frame - 15, fps, config: { damping: 12, stiffness: 25 } });

  // --- "To" label ---
  const toOpacity = interpolate(frame, [toDelay, toDelay + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const toSlide = interpolate(frame, [toDelay, toDelay + 25], [25, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // --- Content: character reveal ---
  const charsRevealed = interpolate(
    frame,
    [contentDelay, contentDelay + totalRevealFrames],
    [0, content.length],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const visibleContent = content.slice(0, Math.floor(charsRevealed));
  const typing = frame >= contentDelay && frame < contentDelay + totalRevealFrames + 12;
  const showCursor = typing && Math.floor(frame / 7) % 2 === 0;

  // --- "From" ---
  const fromOpacity = interpolate(frame, [fromDelay, fromDelay + 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fromSlide = interpolate(frame, [fromDelay, fromDelay + 28], [18, 0], {
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
  const brandOpacity = interpolate(frame, [90, 110, 210, 240], [0, 0.45, 0.45, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const contentFontSize = isVertical ? 62 : 48;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${gradAngle}deg,
          #d4c4b0 0%,
          #c9b59e 35%,
          #bda78e 65%,
          #a8907a 100%)`,
        opacity: fadeOut,
      }}
    >
      {/* Warm light bloom behind text */}
      <div
        style={{
          position: 'absolute',
          width: isVertical ? 800 : 600,
          height: isVertical ? 800 : 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,240,220,0.8) 0%, transparent 55%)',
          top: `${bloomY}%`,
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: bloomOpacity,
          filter: 'blur(60px)',
        }}
      />

      {/* Large decorative quotation mark */}
      <div
        style={{
          position: 'absolute',
          top: isVertical ? '32%' : '25%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${quoteScale})`,
          fontFamily: 'Georgia, serif',
          fontSize: isVertical ? 600 : 400,
          color: '#8a7060',
          opacity: quoteOpacity * 0.7,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        &ldquo;
      </div>

      {/* Paper grain texture */}
      <AbsoluteFill
        style={{
          opacity: 0.06,
          mixBlendMode: 'multiply',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Subtle vignette for depth */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(80,50,30,0.15) 100%)',
        }}
      />

      {/* Main content area */}
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
        {/* Left + right decorative lines flanking "To" */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginBottom: isVertical ? 45 : 30,
            opacity: toOpacity,
          }}
        >
          <div
            style={{
              width: lineLength * 60,
              height: 1,
              backgroundColor: '#7a6050',
              opacity: 0.5,
            }}
          />
          <div
            style={{
              transform: `translateY(${toSlide}px)`,
              fontFamily: 'Poppins, sans-serif',
              fontSize: isVertical ? 28 : 22,
              fontWeight: 500,
              color: '#6b5545',
              letterSpacing: '6px',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            To {to}
          </div>
          <div
            style={{
              width: lineLength * 60,
              height: 1,
              backgroundColor: '#7a6050',
              opacity: 0.5,
            }}
          />
        </div>

        {/* Message content — large, dominant */}
        <div
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: contentFontSize,
            lineHeight: 1.55,
            color: '#2a1f18',
            textAlign: 'center',
            maxWidth: isVertical ? 860 : 820,
            fontWeight: 400,
            padding: '0 10px',
          }}
        >
          {visibleContent}
          {showCursor && (
            <span style={{ color: '#8a6e5a', opacity: 0.8 }}>|</span>
          )}
        </div>

        {/* "From" signature with line */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 15,
            opacity: fromOpacity,
            transform: `translateY(${fromSlide}px)`,
            marginTop: isVertical ? 55 : 40,
          }}
        >
          <div
            style={{
              width: 30,
              height: 1,
              backgroundColor: '#7a6050',
              opacity: 0.6,
            }}
          />
          <div
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: isVertical ? 28 : 22,
              fontWeight: 400,
              color: '#5e4a3a',
              letterSpacing: '4px',
              textTransform: 'uppercase',
            }}
          >
            {from}
          </div>
        </div>
      </div>

      {/* Branding */}
      <div
        style={{
          position: 'absolute',
          bottom: isVertical ? 420 : 45,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'Poppins, sans-serif',
          fontSize: isVertical ? 15 : 13,
          color: '#6b5545',
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
