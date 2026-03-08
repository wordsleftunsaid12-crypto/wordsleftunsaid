/**
 * Build an SVG string for Open Graph images (1200x630).
 * Converted to PNG via Sharp in the API route.
 */

const WIDTH = 1200;
const HEIGHT = 630;
const BG = '#0c0b0a';
const ACCENT = '#c8a882';
const TEXT_PRIMARY = '#f0ece6';
const TEXT_SECONDARY = '#c4b8ac';
const TEXT_MUTED = '#8a7c70';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Wrap text into lines that fit within a given character width.
 * Approximation — SVG has no native word-wrap.
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current.length + word.length + 1 > maxCharsPerLine) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);

  return lines;
}

export function buildOgSvg(to: string, from: string, content: string): string {
  // Truncate content for the card
  const maxContentLen = 200;
  const truncated =
    content.length > maxContentLen
      ? content.slice(0, maxContentLen).trimEnd() + '...'
      : content;

  const contentLines = wrapText(truncated, 45);
  // Limit to 5 lines max
  const displayLines = contentLines.slice(0, 5);
  if (contentLines.length > 5) {
    displayLines[4] = displayLines[4].replace(/\.{0,3}$/, '...');
  }

  const lineHeight = 38;
  const contentStartY = 220;
  const contentBlockHeight = displayLines.length * lineHeight;

  const contentTspans = displayLines
    .map(
      (line, i) =>
        `<tspan x="100" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join('\n      ');

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}" />

  <!-- Accent line at top -->
  <rect x="0" y="0" width="${WIDTH}" height="4" fill="${ACCENT}" opacity="0.7" />

  <!-- Decorative quote mark -->
  <text x="80" y="180" font-family="Georgia, 'Times New Roman', serif" font-size="120" fill="${ACCENT}" opacity="0.15">\u201C</text>

  <!-- "To" label -->
  <text x="100" y="140" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="${TEXT_MUTED}" letter-spacing="3" text-transform="uppercase">TO</text>

  <!-- Recipient name -->
  <text x="140" y="140" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="${ACCENT}" letter-spacing="1" font-weight="500">${escapeXml(to)}</text>

  <!-- Message content -->
  <text y="${contentStartY}" font-family="Georgia, 'Times New Roman', serif" font-size="28" fill="${TEXT_PRIMARY}" line-height="1.5">
      ${contentTspans}
  </text>

  <!-- From -->
  <text x="100" y="${contentStartY + contentBlockHeight + 50}" font-family="Georgia, 'Times New Roman', serif" font-size="18" fill="${TEXT_SECONDARY}" font-style="italic">\u2014 ${escapeXml(from)}</text>

  <!-- Bottom bar -->
  <rect x="0" y="${HEIGHT - 60}" width="${WIDTH}" height="60" fill="${BG}" opacity="0.9" />
  <rect x="0" y="${HEIGHT - 60}" width="${WIDTH}" height="1" fill="${ACCENT}" opacity="0.2" />

  <!-- Site name -->
  <text x="100" y="${HEIGHT - 25}" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="${TEXT_MUTED}" letter-spacing="2">WORDS LEFT UNSENT</text>

  <!-- URL -->
  <text x="${WIDTH - 100}" y="${HEIGHT - 25}" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="${TEXT_MUTED}" text-anchor="end" opacity="0.6">wordsleftunsent.com</text>
</svg>`;
}

export function buildDefaultOgSvg(): string {
  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}" />

  <!-- Accent line at top -->
  <rect x="0" y="0" width="${WIDTH}" height="4" fill="${ACCENT}" opacity="0.7" />

  <!-- Decorative quote marks -->
  <text x="80" y="250" font-family="Georgia, 'Times New Roman', serif" font-size="160" fill="${ACCENT}" opacity="0.1">\u201C</text>

  <!-- Main tagline -->
  <text x="${WIDTH / 2}" y="260" font-family="Georgia, 'Times New Roman', serif" font-size="36" fill="${TEXT_PRIMARY}" text-anchor="middle" letter-spacing="0.5">The words we never sent</text>
  <text x="${WIDTH / 2}" y="310" font-family="Georgia, 'Times New Roman', serif" font-size="36" fill="${TEXT_PRIMARY}" text-anchor="middle" letter-spacing="0.5">still deserve to be heard.</text>

  <!-- Subtitle -->
  <text x="${WIDTH / 2}" y="370" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="${TEXT_SECONDARY}" text-anchor="middle">Share the messages you never sent. Be heard anonymously.</text>

  <!-- Accent diamond divider -->
  <line x1="${WIDTH / 2 - 40}" y1="420" x2="${WIDTH / 2 - 8}" y2="420" stroke="${ACCENT}" stroke-width="1" opacity="0.4" />
  <rect x="${WIDTH / 2 - 4}" y="416" width="8" height="8" fill="${ACCENT}" opacity="0.4" transform="rotate(45 ${WIDTH / 2} 420)" />
  <line x1="${WIDTH / 2 + 8}" y1="420" x2="${WIDTH / 2 + 40}" y2="420" stroke="${ACCENT}" stroke-width="1" opacity="0.4" />

  <!-- Bottom bar -->
  <rect x="0" y="${HEIGHT - 60}" width="${WIDTH}" height="60" fill="${BG}" opacity="0.9" />
  <rect x="0" y="${HEIGHT - 60}" width="${WIDTH}" height="1" fill="${ACCENT}" opacity="0.2" />

  <!-- Site name -->
  <text x="${WIDTH / 2}" y="${HEIGHT - 25}" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="${TEXT_MUTED}" text-anchor="middle" letter-spacing="2">WORDS LEFT UNSENT</text>
</svg>`;
}
