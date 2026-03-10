/**
 * UTM URL builder for social media posts.
 * Adds UTM parameters to links so GA4 can attribute traffic to specific platforms and posts.
 */

/**
 * Build a URL with UTM tracking parameters.
 * @param baseUrl - The destination URL (e.g., https://wordsleftunsent.com/messages/abc123)
 * @param platform - The social platform name (utm_source)
 * @param contentId - The content queue or message ID (utm_content, first 8 chars)
 */
export function buildUtmUrl(baseUrl: string, platform: string, contentId: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('utm_source', platform);
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', 'wlu_organic');
  url.searchParams.set('utm_content', contentId.slice(0, 8));
  return url.toString();
}
