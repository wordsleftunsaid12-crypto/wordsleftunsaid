export type AspectRatio = '9:16' | '1:1' | '16:9';

export type TemplateName = 'classic' | 'modern' | 'cinematic';

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
