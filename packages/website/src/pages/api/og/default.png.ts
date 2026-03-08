import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { buildDefaultOgSvg } from '../../../lib/og-svg.js';

export const GET: APIRoute = async () => {
  const svg = buildDefaultOgSvg();
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(png, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    },
  });
};
