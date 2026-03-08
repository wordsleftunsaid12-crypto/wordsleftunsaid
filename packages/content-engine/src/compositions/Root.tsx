import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { ClassicMessage } from '../templates/classic';
import { ModernMessage } from '../templates/modern';
import { CinematicMessage } from '../templates/cinematic';
import type { CinematicProps } from '../templates/cinematic';

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
