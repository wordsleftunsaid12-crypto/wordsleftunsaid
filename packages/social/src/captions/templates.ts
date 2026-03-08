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
    question: 'Tag someone who needs to see this.',
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
    question: 'Drop a \u2764\uFE0F if this hit you.',
    cta: `Read more \u2192 ${CTA_LINK}`,
    moods: ['bittersweet', 'tender', 'hopeful'],
  },
  {
    hook: 'If you could send one anonymous message to anyone, what would it say?',
    body: 'No names. No judgment. Just the truth you\u2019ve been carrying.',
    question: 'Tell us in the comments \u2193',
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
    question: 'Save this for when you need it.',
    cta: `Share anonymously \u2192 ${CTA_LINK}`,
    moods: ['hopeful', 'tender'],
  },
  {
    hook: 'I wonder how many of us are carrying the same unsent words.',
    body: 'There\u2019s something about reading someone else\u2019s truth that makes your own feel less alone.',
    question: 'Send this to someone who gets it.',
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
    question: 'Drop a \u2764\uFE0F if this got you.',
    cta: `More at ${CTA_LINK}`,
    moods: ['raw', 'bittersweet'],
  },
  {
    hook: 'The things we don\u2019t say out loud often say the most.',
    body: 'Words Left Unsent is a place for the feelings that deserve to be heard, even anonymously.',
    question: 'Tag someone who\u2019d relate.',
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

/** Platform-specific hashtag sets */
const HASHTAG_SETS: Record<'instagram' | 'tiktok' | 'youtube', string[]> = {
  instagram: [
    '#wordsleftunsent', '#unsentletters', '#unsentwords', '#anonymousmessage',
    '#thingsineversent', '#deepfeelings', '#emotionalhealing', '#vulnerability',
    '#selflove', '#mentalhealthawareness', '#relatablequotes', '#heartbreak',
    '#healing', '#lettertoself', '#writingcommunity',
  ],
  tiktok: [
    '#wordsleftunsent', '#fyp', '#relatable', '#emotional', '#unsentletters',
    '#deepquotes', '#mentalhealthawareness', '#heartbreak', '#healing',
    '#vulnerability', '#viral', '#foryou',
  ],
  youtube: [
    '#wordsleftunsent', '#shorts', '#unsentletters', '#emotional',
    '#relatable', '#deepquotes', '#anonymous', '#healing',
  ],
};

/**
 * Build a full caption with mood-matched template + platform hashtags.
 */
export function buildCaption(
  mood: MessageMood,
  platform: 'instagram' | 'tiktok' | 'youtube',
): { caption: string; hashtags: string[] } {
  const caption = pickCaptionTemplate(mood);
  const hashtags = HASHTAG_SETS[platform];
  return { caption, hashtags };
}
