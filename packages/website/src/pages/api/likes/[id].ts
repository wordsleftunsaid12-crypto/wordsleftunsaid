import type { APIRoute } from 'astro';
import { getMessageById, likeMessage, unlikeMessage, notifyFirstLike, markFirstLikeNotified } from '@wlu/shared';

export const POST: APIRoute = async ({ params, request }) => {
  const messageId = params.id;
  if (!messageId) {
    return new Response(JSON.stringify({ error: 'Missing message ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { visitor_id?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const visitorId = body.visitor_id;
  const action = body.action ?? 'like';

  if (!visitorId || typeof visitorId !== 'string' || visitorId.length > 50) {
    return new Response(JSON.stringify({ error: 'Invalid visitor_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const message = await getMessageById(messageId);
    if (!message || !message.approved) {
      return new Response(JSON.stringify({ error: 'Message not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'unlike') {
      await unlikeMessage(messageId, visitorId);
    } else {
      await likeMessage(messageId, visitorId);
    }

    // Re-fetch to get trigger-updated like_count
    const updated = await getMessageById(messageId);
    const likeCount = updated?.like_count ?? message.like_count;

    // Notify submitter on first like (UGC messages only)
    if (action !== 'unlike' && updated && updated.like_count === 1
      && updated.email && !updated.seeded && !updated.first_like_notified) {
      const siteUrl = import.meta.env.SITE || 'https://wordsleftunsent.com';
      notifyFirstLike({ messageId, email: updated.email, to: updated.to, siteUrl })
        .then(() => markFirstLikeNotified(messageId))
        .catch(() => {}); // fire-and-forget
    }

    return new Response(
      JSON.stringify({ success: true, like_count: likeCount, liked: action !== 'unlike' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
