import React from 'react';
import {
  AbsoluteFill,
  Video,
  staticFile,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
  Easing,
} from 'remotion';
import type { MessageProps } from '../compositions/Root';
import { BackgroundMusic, useLoopFade, useFadeIn } from './template-utils';

export interface ClassicProps extends MessageProps {
  backgroundVideo?: string;
}

export const ClassicMessage: React.FC<ClassicProps> = ({ from, to, content, musicFile, backgroundVideo }) => {
  const frame = useCurrentFrame();
  const { fps, height, durationInFrames } = useVideoConfig();
  const isVertical = height > 1200;
  const loopFade = useLoopFade(15, 8);

  // --- Fast timing for social media ---
  const toDelay = 5;

  // Content: full message reveal (not word-by-word — dark text on parchment needs full contrast)
  const contentAnim = useFadeIn(12, 18);

  // "From" after content is visible
  const fromDelay = 50;

  // --- Background: deep warm gradient that slowly shifts ---
  const gradAngle = interpolate(frame, [0, durationInFrames], [150, 175], { extrapolateRight: 'clamp' });

  // --- Large decorative quote mark that fades in behind text ---
  const quoteOpacity = interpolate(frame, [5, 30], [0, 0.06], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const quoteScale = interpolate(frame, [5, 35], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // --- Warm light bloom behind text area ---
  const bloomOpacity = interpolate(frame, [15, 40, durationInFrames - 30, durationInFrames], [0, 0.25, 0.25, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bloomY = interpolate(frame, [0, durationInFrames], [45, 40], { extrapolateRight: 'clamp' });

  // --- Decorative side lines ---
  const lineLength = spring({ frame: frame - 5, fps, config: { damping: 12, stiffness: 25 } });

  // --- "To" label ---
  const toOpacity = interpolate(frame, [toDelay, toDelay + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const toSlide = interpolate(frame, [toDelay, toDelay + 15], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // --- "From" ---
  const fromOpacity = interpolate(frame, [fromDelay, fromDelay + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fromSlide = interpolate(frame, [fromDelay, fromDelay + 18], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // --- Branding ---
  const brandStart = fromDelay;
  const brandOpacity = interpolate(frame, [brandStart, brandStart + 15], [0, 0.7], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const contentFontSize = isVertical ? 68 : 52;

  // Text colors — always dark since overlay creates a warm light background
  const hasVideo = !!backgroundVideo;
  const textColor = '#2a1f18';
  const accentColor = '#6b5545';
  const lineColor = '#7a6050';
  const quoteColor = '#8a7060';
  const textShadow = 'none';

  return (
    <AbsoluteFill
      style={{
        background: hasVideo ? '#d4c4b0' : `linear-gradient(${gradAngle}deg,
          #d4c4b0 0%,
          #c9b59e 35%,
          #bda78e 65%,
          #a8907a 100%)`,
        opacity: loopFade,
      }}
    >
      <BackgroundMusic musicFile={musicFile} />

      {/* Optional background video */}
      {backgroundVideo && (
        <>
          <AbsoluteFill>
            <Video
              src={staticFile(backgroundVideo)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </AbsoluteFill>
          {/* Warm parchment overlay — lets video texture through with dark text */}
          <AbsoluteFill
            style={{
              background: `linear-gradient(
                175deg,
                rgba(212, 196, 176, 0.72) 0%,
                rgba(201, 181, 158, 0.76) 35%,
                rgba(189, 167, 142, 0.78) 65%,
                rgba(168, 144, 122, 0.8) 100%
              )`,
            }}
          />
        </>
      )}

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
          color: quoteColor,
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

      {/* Vignette */}
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
              backgroundColor: lineColor,
              opacity: 0.5,
            }}
          />
          <div
            style={{
              transform: `translateY(${toSlide}px)`,
              fontFamily: 'Poppins, sans-serif',
              fontSize: isVertical ? 28 : 22,
              fontWeight: 500,
              color: accentColor,
              letterSpacing: '6px',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              textShadow,
            }}
          >
            To {to}
          </div>
          <div
            style={{
              width: lineLength * 60,
              height: 1,
              backgroundColor: lineColor,
              opacity: 0.5,
            }}
          />
        </div>

        {/* Message content — full reveal */}
        <div
          style={{
            opacity: contentAnim.opacity,
            transform: `translateY(${contentAnim.slideY}px)`,
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: contentFontSize,
            lineHeight: 1.55,
            color: textColor,
            textAlign: 'center',
            maxWidth: isVertical ? 860 : 820,
            fontWeight: 500,
            padding: '0 10px',
            textShadow,
          }}
        >
          {content}
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
              backgroundColor: lineColor,
              opacity: 0.6,
            }}
          />
          <div
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: isVertical ? 28 : 22,
              fontWeight: 400,
              color: accentColor,
              letterSpacing: '4px',
              textTransform: 'uppercase',
              textShadow,
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
          fontSize: isVertical ? 20 : 15,
          color: accentColor,
          opacity: brandOpacity,
          letterSpacing: '5px',
          textTransform: 'uppercase',
          textShadow,
        }}
      >
        words left unsent
      </div>
    </AbsoluteFill>
  );
};
