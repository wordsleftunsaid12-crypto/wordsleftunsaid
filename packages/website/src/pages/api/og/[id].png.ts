import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { getMessageById } from '@wlu/shared';
import { buildOgSvg } from '../../../lib/og-svg.js';

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) {
    return new Response('Not found', { status: 404 });
  }

  const message = await getMessageById(id);
  if (!message || !message.approved) {
    return new Response('Not found', { status: 404 });
  }

  const svg = buildOgSvg(message.to, message.from, message.content);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(png, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    },
  });
};
