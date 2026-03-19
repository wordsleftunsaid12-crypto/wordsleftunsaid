import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { ClassicMessage } from '../templates/classic';
import { ModernMessage } from '../templates/modern';
import { CinematicMessage } from '../templates/cinematic';
import type { CinematicProps } from '../templates/cinematic';
import { POVMessage } from '../templates/pov';
import { TextOnGradientMessage } from '../templates/textongradient';
import { TypewriterMessage } from '../templates/typewriter';
import { HandwrittenMessage } from '../templates/handwritten';
import { VoiceNarrationMessage } from '../templates/voicenarration';
import type { VoiceNarrationProps } from '../templates/voicenarration';

export type MessageProps = {
  from: string;
  to: string;
  content: string;
};

export const RemotionRoot: React.FC = () => {
  const commonProps: MessageProps = {
    from: 'Me',
    to: 'You',
    content: 'I never told you how much you meant to me. Every day I think about what I should have said.',
  };

  const cinematicProps: CinematicProps = {
    ...commonProps,
    backgroundVideo: 'bg-placeholder.mp4',
  };

  return (
    <>
      {/* Vertical (Reels / TikTok) */}
      <Composition
        id="ClassicVertical"
        component={ClassicMessage}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={commonProps}
      />
      <Composition
        id="ModernVertical"
        component={ModernMessage}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={commonProps}
      />
      <Composition
        id="CinematicVertical"
        component={CinematicMessage}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={cinematicProps}
      />
      <Composition
        id="POVVertical"
        component={POVMessage}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={commonProps}
      />
      <Composition
        id="TextOnGradientVertical"
        component={TextOnGradientMessage}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ ...commonProps, mood: 'tender' }}
      />
      <Composition
        id="TypewriterVertical"
        component={TypewriterMessage}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={commonProps}
      />
      <Composition
        id="HandwrittenVertical"
        component={HandwrittenMessage}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={commonProps}
      />

      {/* VoiceNarration — dynamic duration, passed via inputProps at render time */}
      <Composition
        id="VoiceNarrationVertical"
        component={VoiceNarrationMessage}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          ...commonProps,
          audioFile: undefined,
          wordTimings: undefined,
          audioDurationMs: 5000,
        } as VoiceNarrationProps}
        calculateMetadata={async ({ props }) => {
          // Dynamic duration: use audioDurationMs + 4s padding (2s intro + 2s outro)
          const audioDurationMs = (props as VoiceNarrationProps).audioDurationMs ?? 5000;
          const totalSec = audioDurationMs / 1000 + 4;
          return {
            durationInFrames: Math.ceil(totalSec * 30),
          };
        }}
      />

      {/* Square (Feed posts) */}
      <Composition
        id="ClassicSquare"
        component={ClassicMessage}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={commonProps}
      />
      <Composition
        id="ModernSquare"
        component={ModernMessage}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={commonProps}
      />
      <Composition
        id="CinematicSquare"
        component={CinematicMessage}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={cinematicProps}
      />
    </>
  );
};

registerRoot(RemotionRoot);
