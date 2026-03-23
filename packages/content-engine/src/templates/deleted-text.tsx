import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { MessageProps } from '../compositions/Root';

/**
 * DeletedText — Message typed then backspace-deleted, replaced with something safe.
 *
 * Design: iMessage-style dark input field centered on screen. The real message types
 * in character by character, then gets rapidly backspace-deleted. A safe replacement
 * types in slowly. The emotional hit comes from seeing what someone almost said vs
 * what they actually sent.
 */

const REPLACEMENT_TEXTS = [
  'yeah I\'m fine',
  'I\'m good, you?',
  'haha I miss you too',
  'I\'m okay',
  'yeah, same',
];

/**
 * Deterministic replacement text selection based on content length.
 * This ensures the same message always gets the same replacement.
 */
function getReplacementText(content: string): string {
  const index = content.length % REPLACEMENT_TEXTS.length;
  return REPLACEMENT_TEXTS[index];
}

export const DeletedTextMessage: React.FC<MessageProps> = ({
  from,
  to,
  content,
  musicFile,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const replacement = getReplacementText(content);

  // --- Timing (scaled for readability — longer messages get more reading time) ---
  const typeCharsPerFrame = 1; // Slower typing so viewers can read along
  const deleteCharsPerFrame = 5;

  const typeStart = 10;
  const typeEnd = Math.min(
    typeStart + Math.ceil(content.length / typeCharsPerFrame),
    160, // Cap typing phase at ~5.3s
  );
  // Hold time scales with content length: min 2.5s, max 4.5s
  const holdFrames = Math.min(Math.max(75, Math.ceil(content.length * 0.8)), 135);
  const holdEnd = typeEnd + holdFrames;
  const deleteStart = holdEnd;
  const deleteEnd = Math.min(
    deleteStart + Math.ceil(content.length / deleteCharsPerFrame),
    deleteStart + 30,
  );
  const pauseEnd = deleteEnd + 10; // Brief pause on empty
  const replaceStart = pauseEnd;
  const replaceEnd = Math.min(
    replaceStart + Math.ceil(replacement.length / 1.5),
    replaceStart + 35,
  );
  const sendMoment = replaceEnd + 8; // Brief pause, then "send"
  const deliveredStart = sendMoment + 6;

  // --- CTA timing — starts fading in at send moment for longer visibility ---
  const ctaStart = sendMoment;
  const ctaOpacity = interpolate(
    frame,
    [ctaStart, ctaStart + 20],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // --- Type in real message ---
  const typeChars = Math.floor(
    interpolate(frame, [typeStart, typeEnd], [0, content.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );

  // --- Delete real message ---
  const deleteChars = Math.floor(
    interpolate(frame, [deleteStart, deleteEnd], [0, content.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );

  // --- Type replacement ---
  const replaceChars = Math.floor(
    interpolate(
      frame,
      [replaceStart, replaceEnd],
      [0, replacement.length],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      },
    ),
  );

  // --- Sent state ---
  const isSent = frame >= sendMoment;

  // Determine visible text in the input field
  let visibleText = '';
  let showRedHighlight = false;
  if (frame < typeStart) {
    visibleText = '';
  } else if (frame < holdEnd) {
    // Typing real message
    visibleText = content.slice(0, typeChars);
  } else if (frame < deleteEnd) {
    // Deleting real message — characters removed from end
    const remaining = content.length - deleteChars;
    visibleText = content.slice(0, Math.max(0, remaining));
    showRedHighlight = remaining > 0;
  } else if (frame < replaceStart) {
    // Empty pause
    visibleText = '';
  } else if (!isSent) {
    // Typing replacement (still in input field)
    visibleText = replacement.slice(0, replaceChars);
  } else {
    // After send — input field is empty
    visibleText = '';
  }

  // --- Cursor blink ---
  const cursorVisible = Math.sin(frame * 0.35) > 0;
  const showCursor = frame >= typeStart && !isSent;

  // --- Sent bubble opacity ---
  const bubbleOpacity = interpolate(
    frame,
    [sendMoment, sendMoment + 6],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // --- "Delivered" text ---
  const deliveredOpacity = interpolate(
    frame,
    [deliveredStart, deliveredStart + 12],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // --- Send button blue when replacement is typed but not yet sent ---
  const sendActive = frame >= replaceEnd && !isSent;

  // --- Fade in/out ---
  const fadeIn = interpolate(frame, [0, 8], [0.85, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Contact initial
  const initial = to.charAt(0).toUpperCase();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        opacity: Math.min(fadeIn, fadeOut),
      }}
    >
      {/* Background music */}
      {musicFile && (
        <Audio
          src={staticFile(musicFile)}
          volume={0.3}
          startFrom={0}
        />
      )}

      {/* Status bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '60px 50px 12px',
          fontFamily: 'SF Pro Display, -apple-system, sans-serif',
          fontSize: 34,
          fontWeight: 600,
          color: '#ffffff',
        }}
      >
        <span>11:42</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <svg width="40" height="24" viewBox="0 0 40 24">
            <rect x="0" y="16" width="6" height="8" fill="#fff" rx="1" />
            <rect x="9" y="11" width="6" height="13" fill="#fff" rx="1" />
            <rect x="18" y="6" width="6" height="18" fill="#fff" rx="1" />
            <rect
              x="27"
              y="0"
              width="6"
              height="24"
              fill="#fff"
              rx="1"
            />
          </svg>
          <svg width="52" height="24" viewBox="0 0 52 24">
            <rect
              x="0"
              y="2"
              width="44"
              height="20"
              rx="4"
              stroke="#fff"
              strokeWidth="2"
              fill="none"
            />
            <rect x="4" y="6" width="36" height="12" rx="2" fill="#fff" />
            <rect
              x="46"
              y="8"
              width="4"
              height="8"
              rx="1"
              fill="#fff"
              opacity="0.4"
            />
          </svg>
        </div>
      </div>

      {/* iMessage header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '30px 0 25px',
          borderBottom: '1px solid #333',
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background:
              'linear-gradient(135deg, #8E8E93 0%, #636366 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'SF Pro Display, -apple-system, sans-serif',
            fontSize: 48,
            fontWeight: 500,
            color: '#ffffff',
            marginBottom: 12,
          }}
        >
          {initial}
        </div>
        <div
          style={{
            fontFamily: 'SF Pro Display, -apple-system, sans-serif',
            fontSize: 40,
            fontWeight: 600,
            color: '#ffffff',
          }}
        >
          {to}
        </div>
        <div
          style={{
            fontFamily: 'SF Pro Text, -apple-system, sans-serif',
            fontSize: 26,
            color: '#8E8E93',
            marginTop: 4,
          }}
        >
          iMessage
        </div>
      </div>

      {/* Chat area — all content in the safe zone (above bottom 300px overlay) */}
      <div
        style={{
          position: 'absolute',
          left: 30,
          right: 30,
          top: 470,
          bottom: 580,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Previous conversation — received messages (gray bubbles) */}
        <div
          style={{
            alignSelf: 'flex-start',
            marginBottom: 8,
            marginLeft: 12,
          }}
        >
          <div
            style={{
              backgroundColor: '#3A3A3C',
              borderRadius: 34,
              borderBottomLeftRadius: 6,
              padding: '18px 28px',
            }}
          >
            <div
              style={{
                fontFamily: 'SF Pro Text, -apple-system, sans-serif',
                fontSize: 42,
                color: '#ffffff',
                lineHeight: 1.4,
              }}
            >
              hey, how are you?
            </div>
          </div>
        </div>
        <div
          style={{
            alignSelf: 'flex-start',
            marginBottom: 30,
            marginLeft: 12,
          }}
        >
          <div
            style={{
              backgroundColor: '#3A3A3C',
              borderRadius: 34,
              borderBottomLeftRadius: 6,
              padding: '18px 28px',
            }}
          >
            <div
              style={{
                fontFamily: 'SF Pro Text, -apple-system, sans-serif',
                fontSize: 42,
                color: '#ffffff',
                lineHeight: 1.4,
              }}
            >
              I miss you
            </div>
          </div>
        </div>

        {/* Sent message bubble — appears after send */}
        {isSent && (
          <div
            style={{
              alignSelf: 'flex-end',
              opacity: bubbleOpacity,
              marginBottom: 8,
              marginRight: 12,
            }}
          >
            <div
              style={{
                backgroundColor: '#007AFF',
                borderRadius: 34,
                borderBottomRightRadius: 6,
                padding: '18px 28px',
                maxWidth: 700,
              }}
            >
              <div
                style={{
                  fontFamily: 'SF Pro Text, -apple-system, sans-serif',
                  fontSize: 42,
                  color: '#ffffff',
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                }}
              >
                {replacement}
              </div>
            </div>
          </div>
        )}

        {/* "Delivered" text — below the sent bubble */}
        {frame >= deliveredStart && (
          <div
            style={{
              alignSelf: 'flex-end',
              opacity: deliveredOpacity,
              fontFamily: 'SF Pro Text, -apple-system, sans-serif',
              fontSize: 28,
              color: '#8E8E93',
              marginRight: 16,
            }}
          >
            Delivered
          </div>
        )}

        {/* Spacer pushes input to bottom of safe zone */}
        <div style={{ flex: 1 }} />

        {/* Input field row — at bottom of safe zone, above social media overlays */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
          }}
        >
          {/* Plus button */}
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              backgroundColor: '#2C2C2E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5v14M5 12h14"
                stroke="#8E8E93"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Text input */}
          <div
            style={{
              flex: 1,
              minHeight: 68,
              backgroundColor: '#1C1C1E',
              borderRadius: 34,
              border: '1px solid #3A3A3C',
              padding: '18px 28px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'SF Pro Text, -apple-system, sans-serif',
                fontSize: 42,
                color: showRedHighlight
                  ? 'rgba(255, 69, 58, 0.9)'
                  : '#ffffff',
                lineHeight: 1.4,
                flex: 1,
                minHeight: 28,
                wordBreak: 'break-word',
              }}
            >
              {visibleText || (
                <span style={{ color: '#8E8E93' }}>iMessage</span>
              )}
              {showCursor && visibleText.length > 0 && (
                <span
                  style={{
                    opacity: cursorVisible ? 1 : 0,
                    color: '#007AFF',
                    marginLeft: 2,
                  }}
                >
                  |
                </span>
              )}
            </div>
          </div>

          {/* Send button */}
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              backgroundColor: sendActive ? '#007AFF' : '#2C2C2E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 19V5M12 5l-5 5M12 5l5 5"
                stroke={sendActive ? '#ffffff' : '#8E8E93'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

      </div>

      {/* CTA — centered in the space between messages and input */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '55%',
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
            color: 'rgba(142, 142, 147, 0.9)',
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
