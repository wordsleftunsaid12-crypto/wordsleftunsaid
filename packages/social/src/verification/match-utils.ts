/**
 * Shared utilities for post verification text matching.
 */

/**
 * Extract a matchable snippet from a caption.
 * Takes the first non-empty line (before URLs/hashtags) and returns
 * a short substring that's likely to appear on the platform as rendered text.
 */
export function extractSnippet(caption: string | null | undefined, maxLen = 25): string {
  if (!caption) return '';

  // Split into lines and take the first non-empty, non-URL line
  const lines = caption.split('\n').map((l) => l.trim()).filter(Boolean);
  const contentLine = lines.find((l) => !l.startsWith('http') && !l.startsWith('#') && l.length > 5);

  if (!contentLine) return '';

  // Take just the first N chars of the content line — avoids URL/emoji mismatches
  return contentLine.slice(0, maxLen);
}

/**
 * Check if a page's text content contains the caption snippet.
 * Normalizes whitespace for comparison.
 */
export function textContains(pageText: string, snippet: string): boolean {
  if (!snippet) return false;
  // Normalize both sides: collapse whitespace, trim
  const normalizedPage = pageText.replace(/\s+/g, ' ').trim();
  const normalizedSnippet = snippet.replace(/\s+/g, ' ').trim();
  return normalizedPage.includes(normalizedSnippet);
}
