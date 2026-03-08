import 'dotenv/config';
import { browserPublishTikTok } from './src/platforms/tiktok/browser-publish.js';

const posts = [
  {
    videoPath: '/Users/ncebron/Coding/wordsleftunsaid copy/packages/content-engine/output/CinematicVertical-1772387785093.mp4',
    messageIds: ['77cf87e5-bd8d-4d81-a2c6-bc7d288bebbf'],
    caption: `You never know who you're saving just by being yourself.

Sometimes the most meaningful thing you can do is simply show up — no performance, no pretending.

Share yours at wordsleftunsaid.netlify.app

#wordsleftunsaid #unsentletters #thingsineversaid #unsaidwords #deepquotes #feelings #relatable #poetrycommunity #vulnerability #fyp #foryou`,
    mood: 'tender' as const,
  },
  {
    videoPath: '/Users/ncebron/Coding/wordsleftunsaid copy/packages/content-engine/output/CinematicVertical-1772342294643.mp4',
    messageIds: ['00ab7f6b-6476-4760-a58b-c9d33dc0608c'],
    caption: `Some things are easier to write than to say out loud.

The words we never share are often the ones that matter most. This is your space to finally let them out.

Share yours at wordsleftunsaid.netlify.app

#wordsleftunsaid #unsentletters #thingsineversaid #unsaidwords #anonymousmessages #heartfelt #feelings #relatable #fyp #foryou`,
    mood: 'raw' as const,
  },
];

async function main() {
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    console.log(`\n[batch] Posting ${i + 1}/${posts.length}: ${p.caption.slice(0, 60)}...`);
    try {
      const result = await browserPublishTikTok({
        videoPath: p.videoPath,
        caption: p.caption,
        messageIds: p.messageIds,
        template: 'CinematicVertical',
        mood: p.mood,
      });
      console.log(`[batch] Posted! Post ID: ${result.postId}`);
    } catch (err) {
      console.error(`[batch] Failed to post ${i + 1}:`, err instanceof Error ? err.message : err);
    }

    // Wait between posts
    if (i < posts.length - 1) {
      console.log('[batch] Waiting 30s before next post...');
      await new Promise(r => setTimeout(r, 30000));
    }
  }
  console.log('\n[batch] Done!');
}
main().catch(console.error);
