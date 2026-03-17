export const BRAND = {
  colors: {
    primary: '#9c7a65',
    secondary: '#826659',
    dark: '#5e4e47',
    darkest: '#433e3c',
    text: '#3d3d3d',
    background: '#f8f5f2',
    headerBg: '#f0e6e0',
    highlight: '#e8c4c4',
  },
  fonts: {
    heading: 'Poppins',
    body: 'Lora',
  },
  fontWeights: {
    heading: 600,
    bodyRegular: 400,
    bodyMedium: 500,
  },
  domain: 'wordsleftunsent.com',
  name: 'Words Left Unsent',
  tagline: 'The messages we never sent.',
} as const;

/** Max message content length (chars) that fits on a CinematicVertical video frame.
 * Frame: 1080×1920, Georgia 68px, lineHeight 1.65, padding 250/120/400/70px.
 * ~9 lines available × ~18 chars/line = ~162. Use 160 for safe margin. */
export const MAX_VIDEO_CONTENT_LENGTH = 160;
