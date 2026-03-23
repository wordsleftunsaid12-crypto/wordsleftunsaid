import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import type { MessageProps } from '../compositions/Root';

export interface RawTextProps extends MessageProps {
  backgroundImage?: string;
}

/**
 * RawText — Cover image for text-first platforms (Reddit, Twitter, Threads).
 *
 * Design: Bold text on dark textured background, 1080x1080 (1:1 square).
 * Optional background image (blurred, heavily darkened). "To:" header,
 * message content, attribution, and CTA.
 *
 * Rendered as a single frame via renderStill → PNG output.
 */
export const RawTextMessage: React.FC<RawTextProps> = ({
  from,
  to,
  content,
  backgroundImage,
}) => {
  // Truncate long content for the cover image
  const maxChars = 200;
  const displayContent =
    content.length > maxChars
      ? content.slice(0, maxChars).trim() + '...'
      : content;

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(175deg, #0F0F0F 0%, #1A1A1A 50%, #0F0F0F 100%)',
      }}
    >
      {/* Background image (blurred, heavily darkened) */}
      {backgroundImage && (
        <>
          <AbsoluteFill>
            <Img
              src={staticFile(backgroundImage)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(15px) saturate(0.5) brightness(0.35)',
                transform: 'scale(1.1)',
              }}
            />
          </AbsoluteFill>
          {/* Dark overlay to ensure text readability */}
          <AbsoluteFill
            style={{
              background: `linear-gradient(175deg,
                rgba(15, 15, 15, 0.5) 0%,
                rgba(26, 26, 26, 0.55) 50%,
                rgba(15, 15, 15, 0.6) 100%)`,
            }}
          />
        </>
      )}

      {/* Film grain overlay */}
      <AbsoluteFill
        style={{
          opacity: 0.03,
          mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Subtle vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.4) 100%)',
        }}
      />

      {/* Decorative accent line at top */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 60,
          height: 2,
          backgroundColor: 'rgba(220, 190, 150, 0.4)',
        }}
      />

      {/* "To:" label */}
      <div
        style={{
          position: 'absolute',
          top: 110,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'Poppins, sans-serif',
          fontSize: 24,
          fontWeight: 400,
          color: 'rgba(220, 190, 150, 0.7)',
          letterSpacing: '6px',
          textTransform: 'uppercase',
        }}
      >
        To: {to}
      </div>

      {/* Large decorative quote mark */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '8%',
          fontFamily: 'Georgia, serif',
          fontSize: 280,
          color: '#ffffff',
          opacity: 0.04,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        &ldquo;
      </div>

      {/* Main content area */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          padding: '180px 90px 200px',
        }}
      >
        {/* Message content */}
        <div
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 44,
            fontWeight: 500,
            lineHeight: 1.5,
            color: '#ffffff',
            textAlign: 'center',
            maxWidth: 860,
          }}
        >
          {displayContent}
        </div>

        {/* Thin accent line */}
        <div
          style={{
            width: 60,
            height: 1.5,
            backgroundColor: 'rgba(220, 190, 150, 0.4)',
            marginTop: 40,
            marginBottom: 25,
          }}
        />

        {/* Attribution */}
        <div
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 22,
            fontWeight: 300,
            color: 'rgba(220, 190, 150, 0.6)',
            letterSpacing: '5px',
            textTransform: 'uppercase',
          }}
        >
          &mdash; {from}
        </div>
      </div>

      {/* CTA */}
      <div
        style={{
          position: 'absolute',
          bottom: 55,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 20,
            fontWeight: 300,
            color: 'rgba(255, 255, 255, 0.4)',
            letterSpacing: '3px',
            textAlign: 'center',
          }}
        >
          Share your unsent message
        </div>
        <div
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 28,
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.7)',
            marginTop: 8,
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
