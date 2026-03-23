import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import type { MessageProps } from '../compositions/Root';

export interface QuoteCardProps extends MessageProps {
  backgroundImage?: string;
}

/**
 * QuoteCard — Pinterest-optimized static image (not video).
 *
 * Design: Warm editorial aesthetic, 1080x1350 (4:5 ratio). Optional blurred
 * background image with parchment overlay, large decorative quote mark,
 * centered serif text, "to:" and "from:" attribution, proper CTA.
 *
 * Rendered as a single frame via renderStill → PNG output.
 */
export const QuoteCardMessage: React.FC<QuoteCardProps> = ({
  from,
  to,
  content,
  backgroundImage,
}) => {
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(165deg,
          #F5F0EB 0%,
          #EDE6DD 30%,
          #E8DFD4 60%,
          #E2D8CC 100%)`,
      }}
    >
      {/* Background image (blurred, dimmed) */}
      {backgroundImage && (
        <>
          <AbsoluteFill>
            <Img
              src={staticFile(backgroundImage)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(20px) saturate(0.6)',
                transform: 'scale(1.1)',
              }}
            />
          </AbsoluteFill>
          {/* Warm parchment overlay on top of image */}
          <AbsoluteFill
            style={{
              background: `linear-gradient(165deg,
                rgba(245, 240, 235, 0.75) 0%,
                rgba(237, 230, 221, 0.8) 30%,
                rgba(232, 223, 212, 0.82) 60%,
                rgba(226, 216, 204, 0.85) 100%)`,
            }}
          />
        </>
      )}

      {/* Paper grain texture */}
      <AbsoluteFill
        style={{
          opacity: 0.04,
          mixBlendMode: 'multiply',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Soft vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 50%, rgba(120, 90, 60, 0.12) 100%)',
        }}
      />

      {/* Large decorative opening quote mark */}
      <div
        style={{
          position: 'absolute',
          top: '12%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 400,
          color: '#C4B5A4',
          opacity: 0.15,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        &ldquo;
      </div>

      {/* "To:" label at top */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'Poppins, sans-serif',
          fontSize: 26,
          fontWeight: 400,
          color: '#8A7B6D',
          letterSpacing: '6px',
          textTransform: 'uppercase',
        }}
      >
        To: {to}
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
          padding: '200px 100px 280px',
        }}
      >
        {/* Message content */}
        <div
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 52,
            lineHeight: 1.6,
            color: '#2A1F18',
            textAlign: 'center',
            maxWidth: 880,
            fontWeight: 400,
          }}
        >
          {content}
        </div>

        {/* Thin accent line */}
        <div
          style={{
            width: 80,
            height: 1.5,
            backgroundColor: '#B5A594',
            marginTop: 50,
            marginBottom: 30,
          }}
        />

        {/* Attribution */}
        <div
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 26,
            fontWeight: 400,
            color: '#7A6B5D',
            letterSpacing: '4px',
            textTransform: 'uppercase',
          }}
        >
          &mdash; {from}
        </div>
      </div>

      {/* Bottom decorative closing quote mark */}
      <div
        style={{
          position: 'absolute',
          bottom: '18%',
          right: '12%',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 280,
          color: '#C4B5A4',
          opacity: 0.08,
          lineHeight: 1,
          userSelect: 'none',
          transform: 'rotate(180deg)',
        }}
      >
        &ldquo;
      </div>

      {/* CTA */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
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
            fontSize: 24,
            fontWeight: 300,
            color: '#8A7B6D',
            letterSpacing: '3px',
            textAlign: 'center',
          }}
        >
          Share your unsent message
        </div>
        <div
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 34,
            fontWeight: 600,
            color: '#3A2E24',
            marginTop: 10,
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
