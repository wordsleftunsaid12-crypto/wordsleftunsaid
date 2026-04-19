/**
 * Pre-written caption templates for social media posts.
 * Used when no ANTHROPIC_API_KEY is available (manual captioning by Claude Code agent).
 *
 * Each template has:
 * - hook: First line that stops the scroll (shows in preview)
 * - body: 1-2 sentences connecting to the message content
 * - question: Comment-driving question to boost engagement
 * - cta: Call-to-action driving traffic to the website
 */

import type { MessageMood } from '@wlu/shared';

interface CaptionTemplate {
  hook: string;
  body: string;
  question: string;
  cta: string;
  moods: MessageMood[];
}

const CTA_LINK = 'wordsleftunsent.com';

const TEMPLATES: CaptionTemplate[] = [
  {
    hook: 'What would you say if no one would ever know it was you?',
    body: 'Some words are too heavy to carry alone. This is a safe space to finally let them out.',
    question: 'What\u2019s the message you\u2019ve been holding back?',
    cta: `Say it anonymously \u2192 ${CTA_LINK}`,
    moods: ['bittersweet', 'raw', 'regretful'],
  },
  {
    hook: 'The hardest conversations are the ones we never had.',
    body: "Someone wrote this because they couldn't say it out loud. Maybe you have words like these too.",
    question: 'Would you send this if you could?',
    cta: `Share yours \u2192 ${CTA_LINK}`,
    moods: ['bittersweet', 'regretful'],
  },
  {
    hook: 'Not every goodbye gets said out loud.',
    body: 'Some of the most powerful words are the ones that stayed inside. This one finally made it out.',
    question: 'What goodbye did you never get to say?',
    cta: `Write your unsent message \u2192 ${CTA_LINK}`,
    moods: ['bittersweet', 'raw'],
  },
  {
    hook: 'Some feelings don\u2019t have an audience. Until now.',
    body: 'An anonymous space for the words you\u2019ve been holding onto. No judgment. No names.',
    question: 'Who would you write your unsent message to?',
    cta: `Let it out \u2192 ${CTA_LINK}`,
    moods: ['raw', 'regretful', 'tender'],
  },
  {
    hook: 'You don\u2019t have to say it to their face. Just say it.',
    body: 'Writing it down is the first step. Someone needed to hear this \u2014 even if they never will.',
    question: 'What would yours say?',
    cta: `Post anonymously \u2192 ${CTA_LINK}`,
    moods: ['raw', 'regretful'],
  },
  {
    hook: 'This stopped me mid-scroll.',
    body: 'Real words from a real person who couldn\u2019t say them out loud. The courage in vulnerability is everything.',
    question: 'What\u2019s the one thing you never got to tell them?',
    cta: `Read more \u2192 ${CTA_LINK}`,
    moods: ['bittersweet', 'tender', 'hopeful'],
  },
  {
    hook: 'If you could send one anonymous message to anyone, what would it say?',
    body: 'No names. No judgment. Just the truth you\u2019ve been carrying.',
    question: 'What would YOUR unsent message say? Tell us below \u2193',
    cta: `Share it here \u2192 ${CTA_LINK}`,
    moods: ['bittersweet', 'raw', 'regretful', 'tender', 'hopeful'],
  },
  {
    hook: 'They\u2019ll never read this. But it still needed to be said.',
    body: 'Sometimes writing it out is enough. Sometimes it\u2019s everything.',
    question: 'Ever felt this way?',
    cta: `Your turn \u2192 ${CTA_LINK}`,
    moods: ['bittersweet', 'regretful'],
  },
  {
    hook: 'The words you never sent still matter.',
    body: 'An anonymous letter from someone who finally found the courage to write it down.',
    question: 'What would you write if you knew they\u2019d never see it?',
    cta: `Write yours \u2192 ${CTA_LINK}`,
    moods: ['bittersweet', 'tender', 'hopeful'],
  },
  {
    hook: 'Healing starts with honesty \u2014 even the silent kind.',
    body: 'This message was written anonymously by someone who needed to let go. What are you holding onto?',
    question: 'What are you holding onto that you need to let go of?',
    cta: `Share anonymously \u2192 ${CTA_LINK}`,
    moods: ['hopeful', 'tender'],
  },
  {
    hook: 'I wonder how many of us are carrying the same unsent words.',
    body: 'There\u2019s something about reading someone else\u2019s truth that makes your own feel less alone.',
    question: 'What words are you still carrying?',
    cta: `Read or write \u2192 ${CTA_LINK}`,
    moods: ['bittersweet', 'tender'],
  },
  {
    hook: 'The bravest thing you can do is be honest with yourself.',
    body: 'Even if no one else ever reads it. Even if you never hit send. The words still count.',
    question: 'What\u2019s the bravest thing you never said?',
    cta: `Say what you never could \u2192 ${CTA_LINK}`,
    moods: ['hopeful', 'raw'],
  },
  {
    hook: 'Some letters are better left unsent. But they still deserve to exist.',
    body: 'A safe, anonymous space for the feelings that don\u2019t fit anywhere else.',
    question: 'Would you send yours?',
    cta: `${CTA_LINK}`,
    moods: ['bittersweet', 'regretful', 'tender'],
  },
  {
    hook: 'POV: you finally write the message you\u2019ve been composing in your head for years.',
    body: 'No send button. No read receipts. Just the relief of putting it into words.',
    question: 'How long have you been writing yours in your head?',
    cta: `Try it \u2192 ${CTA_LINK}`,
    moods: ['bittersweet', 'raw', 'regretful'],
  },
  {
    hook: 'This hit different.',
    body: 'An anonymous message from someone brave enough to say what most of us only think.',
    question: 'What\u2019s the hardest thing you never said out loud?',
    cta: `More at ${CTA_LINK}`,
    moods: ['raw', 'bittersweet'],
  },
  {
    hook: 'The things we don\u2019t say out loud often say the most.',
    body: 'Words Left Unsent is a place for the feelings that deserve to be heard, even anonymously.',
    question: 'Who came to mind when you read this?',
    cta: `Share yours \u2192 ${CTA_LINK}`,
    moods: ['tender', 'hopeful', 'bittersweet'],
  },
  {
    hook: 'What if you could tell someone the truth without them ever knowing it was you?',
    body: 'That\u2019s exactly what this person did. And it\u2019s exactly what you can do too.',
    question: 'Who would you write to?',
    cta: `Post anonymously \u2192 ${CTA_LINK}`,
    moods: ['raw', 'regretful', 'bittersweet'],
  },
  {
    hook: 'Not everything needs closure. Sometimes it just needs to be said.',
    body: 'An anonymous message that reminds us: the words we hold back are often the ones that matter most.',
    question: 'What do you wish you\u2019d said?',
    cta: `Say it here \u2192 ${CTA_LINK}`,
    moods: ['bittersweet', 'regretful'],
  },
  {
    hook: 'This is your sign to write that message.',
    body: 'To the person you lost. The friend who drifted. The version of yourself that needed to hear it.',
    question: 'Who came to mind just now?',
    cta: `Do it anonymously \u2192 ${CTA_LINK}`,
    moods: ['hopeful', 'tender', 'bittersweet'],
  },
  {
    hook: 'Imagine a world where everyone said what they actually meant.',
    body: 'Until then, there\u2019s this. A space for the words that got stuck.',
    question: 'What would you finally say?',
    cta: `${CTA_LINK}`,
    moods: ['hopeful', 'tender'],
  },
];

/** Track used templates to avoid repeats */
const usedIndices: number[] = [];

/**
 * Pick a caption template matching the given mood.
 * Returns the full formatted caption (hook + body + question + CTA).
 */
export function pickCaptionTemplate(mood: MessageMood): string {
  const matching = TEMPLATES
    .map((t, i) => ({ template: t, index: i }))
    .filter(({ template, index }) => template.moods.includes(mood) && !usedIndices.includes(index));

  // If all mood-matching templates used, reset and allow any
  const pool = matching.length > 0
    ? matching
    : TEMPLATES.map((t, i) => ({ template: t, index: i })).filter(({ template }) => template.moods.includes(mood));

  const finalPool = pool.length > 0 ? pool : TEMPLATES.map((t, i) => ({ template: t, index: i }));
  const picked = finalPool[Math.floor(Math.random() * finalPool.length)];
  usedIndices.push(picked.index);

  const { hook, body, question, cta } = picked.template;
  return `${hook}\n\n${body}\n\n${question}\n\n${cta}`;
}

/**
 * Platform-specific hashtag POOLS.
 *
 * Every post picks a random subset of 8-12 tags from the pool instead of
 * reusing the exact same set every time. Identical hashtag strings across
 * posts are a primary bot-detection signal.
 *
 * The "anchor" tags (first element) are always included so the brand
 * still ties content together across posts — the rest rotate.
 */
const HASHTAG_POOLS: Record<'instagram' | 'tiktok' | 'youtube', {
  anchor: string;
  pool: string[];
}> = {
  instagram: {
    anchor: '#wordsleftunsent',
    pool: [
      '#unsentletters', '#unsentwords', '#anonymousmessage', '#thingsineversent',
      '#deepfeelings', '#emotionalhealing', '#vulnerability', '#selflove',
      '#mentalhealthawareness', '#relatablequotes', '#heartbreak', '#healing',
      '#lettertoself', '#writingcommunity', '#poetrycommunity', '#writersofig',
      '#spilledink', '#lateletters', '#emotionaldamage', '#softgirlera',
      '#silentthoughts', '#quotestagram', '#relatablepoetry', '#grief',
    ],
  },
  tiktok: {
    anchor: '#wordsleftunsent',
    pool: [
      '#fyp', '#foryou', '#foryoupage', '#relatable', '#emotional',
      '#unsentletters', '#deepquotes', '#mentalhealthawareness', '#heartbreak',
      '#healing', '#vulnerability', '#breakuptok', '#situationship',
      '#softgirlera', '#sadtok', '#grief', '#emotionaldamage',
      '#latenightthoughts', '#writertok', '#xyzbca',
    ],
  },
  youtube: {
    anchor: '#wordsleftunsent',
    pool: [
      '#shorts', '#unsentletters', '#emotional', '#relatable', '#deepquotes',
      '#anonymous', '#healing', '#heartbreak', '#poetry', '#grief',
      '#shortsvideo', '#ytshorts', '#writingprompts', '#softquotes',
    ],
  },
};

/**
 * Pick a random subset of n items from an array using Fisher-Yates.
 */
function pickRandomSubset<T>(items: readonly T[], n: number): T[] {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone.slice(0, n);
}

/**
 * Build a rotated hashtag list for a platform. Always includes the brand
 * anchor; the rest are drawn randomly from the pool so each post has a
 * slightly different tag mix.
 */
function buildHashtags(platform: 'instagram' | 'tiktok' | 'youtube'): string[] {
  const { anchor, pool } = HASHTAG_POOLS[platform];
  // IG allows up to 30 but 8-12 is optimal; TikTok 5-8; YouTube 5-10.
  const counts: Record<typeof platform, [number, number]> = {
    instagram: [8, 12],
    tiktok: [5, 8],
    youtube: [5, 8],
  };
  const [minCount, maxCount] = counts[platform];
  const target = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
  const picked = pickRandomSubset(pool, target - 1); // -1 for anchor
  return [anchor, ...picked];
}

/** TikTok-specific trending hooks to prepend to captions */
const TIKTOK_HOOKS = [
  'POV: you finally write the message you\u2019ve been composing in your head',
  'Things I never said:',
  'POV: the words you never sent finally get heard',
  'The message I\u2019ll never send:',
  'Words I\u2019m still carrying:',
];

/**
 * Build a full caption with mood-matched template + platform hashtags.
 *
 * If `recipient` is a real first-name style value (e.g. "Kat", "mom"),
 * caption uses the "search your name" viral hook pointing at
 * wordsleftunsent.com/to/<name> — the #1 growth lever in this niche per
 * 2026-04-19 research (see reports/best-practices-2026-04-19.md). Falls
 * back to the generic mood template for abstract/role recipients.
 */
export function buildCaption(
  mood: MessageMood,
  platform: 'instagram' | 'tiktok' | 'youtube',
  recipient?: string,
): { caption: string; hashtags: string[] } {
  let caption: string;
  const nameHook = buildNameSearchHook(recipient, platform);
  if (nameHook) {
    caption = nameHook;
  } else {
    caption = pickCaptionTemplate(mood);
    if (platform === 'tiktok') {
      const hook = TIKTOK_HOOKS[Math.floor(Math.random() * TIKTOK_HOOKS.length)];
      caption = `${hook}\n\n${caption}`;
    }
  }

  const hashtags = buildHashtags(platform);
  return { caption, hashtags };
}

/**
 * If the recipient looks like a real first name, produce a "search your name"
 * caption pointing at /to/<name>. Returns null for abstract recipients
 * ("my pillow", "anyone"), role labels that aren't a specific person, or
 * empty strings — caller falls back to the generic mood template.
 *
 * Keep captions short: research says 138-150 chars is the engagement sweet
 * spot, first 125 chars must hook.
 */
function buildNameSearchHook(
  recipient: string | undefined,
  platform: 'instagram' | 'tiktok' | 'youtube',
): string | null {
  if (!recipient) return null;
  const name = recipient.trim();
  if (!name) return null;

  // Reject abstract / literary recipients — same filter used in the render pipeline
  const ABSTRACT =
    /^(3am|day \d+|nobody|anyone|everyone|someone|the (old me|new me|younger me|future me|past me|new day|empty chair|last conversation|person reading this|barista|uber driver|vet|bus \d+|stranger|commuter)|my (pillow|reflection|anxiety|job|worst enemy|journal|diary|closet)|anyone struggling|this website|words left unsaid|your voicemail)$/i;
  if (ABSTRACT.test(name)) return null;

  // Accept first-names / initials / clear relationships
  // (1-2 word names, short enough for display, no punctuation-heavy strings)
  if (name.length > 25 || /[\\/<>]/.test(name)) return null;

  // URL-safe slug: lowercase, underscores for spaces
  const slug = encodeURIComponent(name.toLowerCase().replace(/\s+/g, ' '));
  const url = `${CTA_LINK}/to/${slug}`;
  // Display name: preserve original casing, but limit length
  const display = name.slice(0, 24);

  // Platform-specific tone delta (research: don't reuse identical captions)
  if (platform === 'tiktok') {
    return `someone wrote this to a ${display}. search your name \u2192 ${url}`;
  }
  if (platform === 'youtube') {
    return `An anonymous unsent letter to ${display}. Search your own name at ${url} to see letters written to you.`;
  }
  // Instagram: aim for ~140 chars, hook-first
  return `To ${display} \u2014 someone needed to say this. Search your name \u2192 ${url}`;
}
