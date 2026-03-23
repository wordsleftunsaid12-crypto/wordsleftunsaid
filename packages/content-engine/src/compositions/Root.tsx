import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { CinematicMessage } from '../templates/cinematic';
import type { CinematicProps } from '../templates/cinematic';
import { TextOnGradientMessage } from '../templates/textongradient';
import type { TextOnGradientProps } from '../templates/textongradient';
import { DeletedTextMessage } from '../templates/deleted-text';
import { QuoteCardMessage } from '../templates/quote-card';
import type { QuoteCardProps } from '../templates/quote-card';
import { SplitScreenMessage } from '../templates/split-screen';
import type { SplitScreenProps } from '../templates/split-screen';
import { HandwritingSVGMessage } from '../templates/handwriting-svg';
import type { HandwritingSVGProps } from '../templates/handwriting-svg';
import { RawTextMessage } from '../templates/raw-text';
import type { RawTextProps } from '../templates/raw-text';
import { calculateDurationFrames } from '../templates/template-utils';

export type MessageProps = {
  from: string;
  to: string;
  content: string;
  musicFile?: string;
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

  const textOnGradientProps: TextOnGradientProps = {
    ...commonProps,
    mood: 'tender',
    backgroundVideo: undefined,
  };

  const calcDuration = async ({ props }: { props: Record<string, unknown> }) => ({
    durationInFrames: calculateDurationFrames((props as MessageProps).content),
  });

  // SplitScreen: word reveal + attribution + CTA with 3.5s visibility
  const calcSplitScreenDuration = async ({ props }: { props: Record<string, unknown> }) => {
    const content = (props as MessageProps).content;
    const words = content.split(/\s+/).filter(Boolean);
    const wordRevealStart = 60;
    const revealEnd = wordRevealStart + words.length / 0.25;
    const ctaStart = revealEnd + 15;
    const ctaFullyVisible = ctaStart + 20;
    const durationInFrames = ctaFullyVisible + 105; // 3.5s of CTA visibility
    return { durationInFrames };
  };

  // DeletedText needs extra time: typing + scaled hold + delete + replace + send + 2.5s CTA
  const calcDeletedTextDuration = async ({ props }: { props: Record<string, unknown> }) => {
    const content = (props as MessageProps).content;
    const typeEnd = Math.min(10 + Math.ceil(content.length / 1), 160);
    const holdFrames = Math.min(Math.max(75, Math.ceil(content.length * 0.8)), 135);
    const holdEnd = typeEnd + holdFrames;
    const deleteEnd = Math.min(holdEnd + Math.ceil(content.length / 5), holdEnd + 30);
    const replaceEnd = Math.min(deleteEnd + 10 + Math.ceil(19 / 1.5), deleteEnd + 10 + 35);
    const ctaStart = replaceEnd + 8; // sendMoment (CTA starts earlier)
    const ctaFullyVisible = ctaStart + 20; // fade-in duration
    const durationInFrames = ctaFullyVisible + 105; // 3.5s of CTA visibility
    return { durationInFrames };
  };

  return (
    <>
      {/* Vertical (Reels / TikTok) */}
      <Composition
        id="CinematicVertical"
        component={CinematicMessage}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={cinematicProps}
        calculateMetadata={calcDuration}
      />
      <Composition
        id="TextOnGradientVertical"
        component={TextOnGradientMessage}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={textOnGradientProps}
        calculateMetadata={calcDuration}
      />

      {/* Platform-optimized templates */}
      <Composition
        id="DeletedTextVertical"
        component={DeletedTextMessage}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={commonProps}
        calculateMetadata={calcDeletedTextDuration}
      />
      <Composition
        id="QuoteCardVertical"
        component={QuoteCardMessage}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1350}
        defaultProps={{
          ...commonProps,
          backgroundImage: undefined,
        } as QuoteCardProps}
      />
      <Composition
        id="SplitScreenVertical"
        component={SplitScreenMessage}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          ...commonProps,
          backgroundVideo: undefined,
        } as SplitScreenProps}
        calculateMetadata={calcSplitScreenDuration}
      />
      <Composition
        id="HandwritingSVGVertical"
        component={HandwritingSVGMessage}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          ...commonProps,
          backgroundVideo: undefined,
        } as HandwritingSVGProps}
        calculateMetadata={calcDuration}
      />
      <Composition
        id="RawTextVertical"
        component={RawTextMessage}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          ...commonProps,
          backgroundImage: undefined,
        } as RawTextProps}
      />

      {/* Square (Feed posts) */}
      <Composition
        id="CinematicSquare"
        component={CinematicMessage}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={cinematicProps}
        calculateMetadata={calcDuration}
      />
    </>
  );
};

registerRoot(RemotionRoot);
