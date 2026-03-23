import type { APIRoute } from 'astro';
import { getApprovedMessages, searchMessages } from '@wlu/shared';

export const GET: APIRoute = async ({ url }) => {
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);
  const limit = Math.min(40, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
  const sort = url.searchParams.get('sort') === 'loved' ? 'loved' as const : 'recent' as const;
  const q = url.searchParams.get('q')?.trim() || '';

  try {
    const messages = q
      ? await searchMessages(q, { limit, offset })
      : await getApprovedMessages({ limit, offset, sort });

    const hasMore = messages.length === limit;

    return new Response(
      JSON.stringify({ messages, hasMore }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg, messages: [], hasMore: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
