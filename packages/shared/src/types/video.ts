export type AspectRatio = '9:16' | '1:1' | '16:9';

export type TemplateName =
  | 'cinematic'
  | 'textongradient'
  | 'deletedtext'
  | 'quotecard'
  | 'splitscreen'
  | 'handwritingsvg'
  | 'rawtext';

export type MessageMood = 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw';

export interface VideoConfig {
  template: TemplateName;
  aspectRatio: AspectRatio;
  durationPerMessageSec: number;
  width: number;
  height: number;
  fps: number;
}

export interface MessageVariation {
  originalId: string;
  variation: string;
  mood: MessageMood;
  videoReady: boolean;
}

export const VIDEO_PRESETS: Record<AspectRatio, Pick<VideoConfig, 'width' | 'height'>> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
};

/**
 * Max content length per template. Different templates have different font sizes,
 * padding, and layout constraints that affect how much text fits on screen.
 */
export const MAX_CONTENT_LENGTH: Record<string, number> = {
  CinematicVertical: 160,
  CinematicSquare: 160,
  TextOnGradientVertical: 120,
  // Platform-optimized templates
  DeletedTextVertical: 150,    // needs room for backspace + replacement
  QuoteCardVertical: 180,      // must be legible in static image
  SplitScreenVertical: 160,    // bottom half only
  HandwritingSVGVertical: 150, // handwriting takes space
  RawTextVertical: 500,        // text post can be longer
};
