/**
 * Automated message seeder — generates 1-2 realistic anonymous messages per day
 * to keep the website looking active and fresh for visitors from social media.
 *
 * Messages are pre-written templates inserted via createApprovedMessage()
 * (service client, bypasses RLS, auto-approved).
 */
import { createApprovedMessage, getApprovedMessages } from '@wlu/shared';

interface MessageTemplate {
  from: string;
  to: string;
  content: string;
}

/**
 * Pool of ~30 hand-written messages with varied emotional tones.
 * Covers: nostalgia, regret, gratitude, love, forgiveness, longing, growth.
 */
const MESSAGE_POOL: MessageTemplate[] = [
  // --- Nostalgia ---
  // NOTE: DB constraint: from/to max 25 chars, content max 500 chars
  {
    from: 'your old roommate',
    to: 'the popcorn burner',
    content: 'I found that photo of us on the fire escape at 3am. We thought we had all the time in the world. I miss being that careless.',
  },
  {
    from: 'someone who remembers',
    to: 'my childhood best friend',
    content: 'We used to talk about what our lives would look like at 25. I wonder if either of us got it right. I hope your version turned out beautiful.',
  },
  {
    from: 'a stranger on the train',
    to: 'the girl with Murakami',
    content: 'We rode the same train for two years. You never looked up from your book. I never worked up the nerve to say hello. I still think about what if.',
  },

  // --- Regret ---
  {
    from: 'the one who left',
    to: 'everyone I ghosted',
    content: 'I told myself it was easier this way. It wasn\'t. I just didn\'t know how to say "I\'m struggling" without feeling like a burden. I\'m sorry.',
  },
  {
    from: 'your brother',
    to: 'the sister I never call',
    content: 'I don\'t know when we became strangers living in the same family. I keep meaning to call but the silence has gotten so loud I don\'t know where to start.',
  },
  {
    from: 'someone trying harder',
    to: 'my ex',
    content: 'You deserved someone who could stay. I know that now. I hope you found them. I hope they hold you the way I should have.',
  },

  // --- Gratitude ---
  {
    from: 'your student',
    to: 'Mrs. Chen',
    content: 'You told me I had a voice worth hearing. I didn\'t believe you then. I just published my first book. Your name is in the dedication. I hope you see it.',
  },
  {
    from: 'someone who made it',
    to: 'the 2am friend',
    content: 'You didn\'t ask questions. You just said "I\'m on my way." That night could have ended differently. You saved my life and I never told you.',
  },
  {
    from: 'a grateful stranger',
    to: 'the barista',
    content: 'You wrote "you\'ve got this" on my cup during the hardest week of my life. Such a small thing. It meant everything.',
  },

  // --- Love (unspoken) ---
  {
    from: 'still yours',
    to: 'the one who doesn\'t know',
    content: 'Every love song is about you and you have no idea. I\'ve rewritten this message eleven times. None of them capture what you do to my heartbeat.',
  },
  {
    from: 'your coworker',
    to: 'two desks over',
    content: 'You laugh at your own jokes before you even finish telling them. It\'s the most honest thing I\'ve ever seen. I think I might be falling for you.',
  },
  {
    from: 'someone who waited',
    to: 'my best friend',
    content: 'I practiced telling you how I felt in the mirror for a week. Then you told me about her. I smiled and said I was happy for you. Half of that was true.',
  },

  // --- Forgiveness ---
  {
    from: 'your daughter',
    to: 'dad',
    content: 'I spent years being angry at you for leaving. Then I had a kid of my own and realized how terrifying it must have been. I\'m not ready to call yet. But I forgive you.',
  },
  {
    from: 'the friend you hurt',
    to: 'the one who said sorry',
    content: 'I read your apology letter four times. I couldn\'t respond because I was crying too hard. Not from the pain anymore — from the relief of being seen.',
  },
  {
    from: 'someone letting go',
    to: 'myself at 16',
    content: 'Stop carrying everyone else\'s weight. You\'re allowed to set things down. The people who love you will still be there when your arms are empty.',
  },

  // --- Longing ---
  {
    from: 'across the ocean',
    to: 'the one I left behind',
    content: 'There are 5,847 miles between us now. I counted. Some nights I swear I can still smell your shampoo on my pillow. Distance doesn\'t erase anything.',
  },
  {
    from: 'your old neighbor',
    to: 'the family that moved',
    content: 'Your porch light was always the first one on in the evening. This street feels darker without you. The new neighbors are nice. They\'re not you.',
  },
  {
    from: 'still waiting',
    to: 'the text that never came',
    content: 'You said "I\'ll call you tomorrow." That was 847 tomorrows ago. I know because some part of me is still counting.',
  },

  // --- Growth ---
  {
    from: 'a work in progress',
    to: 'my therapist',
    content: 'I sat in your parking lot for twenty minutes before that first appointment, ready to drive away. Thank you for what you\'ve helped me become.',
  },
  {
    from: 'someone who finally left',
    to: 'the city that raised me',
    content: 'I outgrew you and it broke my heart. Every skyline I see gets measured against yours. Nothing compares. But I needed room to breathe.',
  },
  {
    from: 'your future self',
    to: 'anyone at rock bottom',
    content: 'I know it doesn\'t feel like it right now, but this is the chapter that changes everything. Keep going. The plot twist is coming.',
  },

  // --- Miscellaneous emotional ---
  {
    from: 'an only child',
    to: 'the sibling I never had',
    content: 'I used to set an extra place at my pretend tea parties for you. I\'m 28 now and I still wonder who you would have been.',
  },
  {
    from: 'the quiet one',
    to: 'everyone who asked',
    content: 'I got so good at saying "I\'m okay" that even I started to believe it. The truth is I\'ve been drowning in shallow water for years.',
  },
  {
    from: 'someone with a full heart',
    to: 'my dog',
    content: 'You didn\'t care that I was messy or sad or lost. You just put your head on my lap and stayed. No human has ever loved me that simply.',
  },
  {
    from: 'your grandmother',
    to: 'the grandchild who visits',
    content: 'You think you come to keep me company. You don\'t know that your visits are the only reason I keep the house clean and the cookies baked. You are my reason.',
  },
  {
    from: 'the one in the photo',
    to: 'whoever finds this',
    content: 'We took this photo on the last good day before everything changed. I look so happy it almost hurts. I keep it in my wallet as proof that I once knew how.',
  },
  {
    from: 'a midnight thinker',
    to: 'me before grief',
    content: 'I don\'t remember what it felt like to fall asleep without replaying everything. If you\'re still in there somewhere, I\'m trying to find my way back to you.',
  },
  {
    from: 'your college friend',
    to: 'the one who drifted',
    content: 'We swore we\'d never be those people who drifted apart. I guess promises made at 22 don\'t always survive the real world. I still have our playlist saved.',
  },
  {
    from: 'someone who gets it now',
    to: 'mom',
    content: 'I used to think your rules were suffocating. Now I recognize them as the shape of your love when words weren\'t enough. I get it now. Thank you.',
  },
  {
    from: 'a late-night driver',
    to: 'that one song',
    content: 'Three notes in and I\'m 19 again, parked outside your apartment, deciding whether to knock. The song ends. I keep driving. Every single time.',
  },
  {
    from: 'the one who noticed',
    to: 'the door holder',
    content: 'You held the door and said "after you" like it was nothing. I was carrying groceries and a broken heart. Your kindness cracked me open in the best way.',
  },
];

interface SeedOptions {
  count?: number;
  dryRun?: boolean;
}

interface SeedResult {
  seeded: number;
  skipped: number;
}

/**
 * Seed the website with new anonymous messages.
 * Picks random unused templates and inserts them as approved messages.
 */
export async function seedDailyMessages(
  options: SeedOptions = {},
): Promise<SeedResult> {
  const { count = 2, dryRun = false } = options;

  // Get existing messages to avoid duplicates
  const existing = await getApprovedMessages({ limit: 200 });
  const existingContents = new Set(
    existing.map((m) => m.content.toLowerCase().trim()),
  );

  // Check how many were seeded today (avoid double-seeding)
  const today = new Date().toISOString().split('T')[0];
  const seededToday = existing.filter((m) => m.created_at.startsWith(today)).length;

  if (seededToday >= count) {
    console.log(`[seed-messages] Already ${seededToday} messages today (target: ${count}). Skipping.`);
    return { seeded: 0, skipped: count };
  }

  const toSeed = count - seededToday;
  console.log(`[seed-messages] Seeding ${toSeed} new messages (${seededToday} already today)...`);

  // Filter to unused templates
  const available = MESSAGE_POOL.filter(
    (t) => !existingContents.has(t.content.toLowerCase().trim()),
  );

  if (available.length === 0) {
    console.log('[seed-messages] All templates have been used! Pool exhausted.');
    return { seeded: 0, skipped: toSeed };
  }

  console.log(`[seed-messages] ${available.length} unused templates available`);

  // Shuffle and pick
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, toSeed);

  let seeded = 0;
  for (const template of picks) {
    if (dryRun) {
      console.log(`[seed-messages] [DRY RUN] Would seed: "${template.content.slice(0, 60)}..."`);
      seeded++;
      continue;
    }

    try {
      const msg = await createApprovedMessage({
        from: template.from,
        to: template.to,
        content: template.content,
      });
      seeded++;
      console.log(`[seed-messages] Seeded message ${msg.id}: "${template.content.slice(0, 50)}..."`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[seed-messages] Failed to seed: ${errMsg.slice(0, 100)}`);
    }
  }

  console.log(`[seed-messages] Done — seeded ${seeded}/${toSeed}`);
  return { seeded, skipped: toSeed - seeded };
}
