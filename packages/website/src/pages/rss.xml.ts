import type { APIRoute } from 'astro';
import { getApprovedMessages } from '@wlu/shared';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = site?.toString() ?? 'https://wordsleftunsent.com';
  const messages = await getApprovedMessages({ limit: 50 });

  const items = messages
    .map((msg) => {
      const truncated =
        msg.content.length > 200
          ? msg.content.slice(0, 200).trimEnd() + '...'
          : msg.content;
      const link = `${siteUrl}messages/${msg.id}`;
      const pubDate = new Date(msg.created_at).toUTCString();

      return `    <item>
      <title>${escapeXml(`To ${msg.to}`)}</title>
      <description>${escapeXml(truncated)}</description>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>${escapeXml(msg.from)}</author>
    </item>`;
    })
    .join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Words Left Unsent</title>
    <description>The words we never sent still deserve to be heard. Anonymous messages shared by real people.</description>
    <link>${escapeXml(siteUrl)}</link>
    <atom:link href="${escapeXml(siteUrl)}rss.xml" rel="self" type="application/rss+xml" />
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=7200',
    },
  });
};
