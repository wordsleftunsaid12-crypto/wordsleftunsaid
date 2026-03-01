/** Content moderation scoring for submitted messages. */

export interface ModerationResult {
  passed: boolean;
  score: number;
  reasons: string[];
}

// --- Blocklists ---

const HARD_BLOCK_WORDS = [
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'kike', 'spic', 'chink',
  'wetback', 'tranny', 'cunt',
];

const SEXUAL_WORDS = [
  'porn', 'xxx', 'dick', 'cock', 'pussy', 'tits', 'boobs', 'nude', 'nudes',
  'naked', 'blowjob', 'handjob', 'anal', 'orgasm', 'masturbat', 'cum',
  'horny', 'suck my', 'fuck me', 'sex chat', 'onlyfans', 'fansly',
  'sexting', 'hookup', 'milf', 'dildo', 'vibrator',
];

const VIOLENCE_WORDS = [
  'kill yourself', 'kys', 'kill you', 'murder you', 'slit your',
  'hang yourself', 'shoot up', 'bomb threat', 'rape',
];

const SPAM_DOMAINS = [
  'bit.ly', 'tinyurl', 'goo.gl', 't.co', 'shorturl', 'rebrand.ly',
  'cutt.ly', 'is.gd', 'v.gd', 'shorte.st',
];

// --- Normalizers ---

/** Normalize leetspeak and common obfuscation to plain text */
function normalizeLeet(text: string): string {
  return text
    .replace(/@/g, 'a')
    .replace(/4/g, 'a')
    .replace(/3/g, 'e')
    .replace(/1/g, 'i')
    .replace(/!/g, 'i')
    .replace(/0/g, 'o')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/\+/g, 't');
}

/** Collapse repeated characters: "fuuuuck" → "fuck" */
function collapseRepeats(text: string): string {
  return text.replace(/(.)\1{2,}/g, '$1$1');
}

/** Strip separators between characters: "f.u.c.k" → "fuck" */
function stripSeparators(text: string): string {
  return text.replace(/(?<=\w)[.\-_\s*]+(?=\w)/g, '');
}

function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  normalized = normalizeLeet(normalized);
  normalized = collapseRepeats(normalized);
  return normalized;
}

// --- Checkers ---

function checkBlocklist(
  text: string,
  words: string[],
  label: string,
): { score: number; reasons: string[] } {
  const normalized = normalizeText(text);
  const stripped = stripSeparators(normalized);
  let score = 0;
  const reasons: string[] = [];

  for (const word of words) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(normalized) || regex.test(stripped)) {
      score += label === 'slur' ? 100 : label === 'violence' ? 80 : 50;
      reasons.push(`${label}: "${word}"`);
    }
  }
  return { score, reasons };
}

function checkUrls(text: string): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Check for URLs
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const urls = text.match(urlPattern) || [];

  if (urls.length > 0) {
    score += 30;
    reasons.push(`contains ${urls.length} URL(s)`);

    // Extra penalty for spam/shortener domains
    for (const url of urls) {
      for (const domain of SPAM_DOMAINS) {
        if (url.toLowerCase().includes(domain)) {
          score += 40;
          reasons.push(`spam domain: ${domain}`);
        }
      }
    }
  }

  // Check for www. links without protocol
  if (/\bwww\.[^\s]+/i.test(text)) {
    score += 30;
    reasons.push('contains www link');
  }

  return { score, reasons };
}

function checkSpamPatterns(text: string): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Phone numbers
  if (/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text)) {
    score += 20;
    reasons.push('contains phone number');
  }

  // ALL CAPS check (only for messages > 20 chars)
  if (text.length > 20) {
    const alphaChars = text.replace(/[^a-zA-Z]/g, '');
    const upperCount = alphaChars.replace(/[^A-Z]/g, '').length;
    if (alphaChars.length > 10 && upperCount / alphaChars.length > 0.7) {
      score += 15;
      reasons.push('excessive caps');
    }
  }

  // Repeated characters (5+ of the same)
  if (/(.)\1{4,}/.test(text)) {
    score += 10;
    reasons.push('repeated characters');
  }

  // Email harvesting in content
  if (/[\w.-]+@[\w.-]+\.\w{2,}/.test(text)) {
    score += 15;
    reasons.push('contains email address in content');
  }

  return { score, reasons };
}

// --- Main ---

const REJECT_THRESHOLD = 40;

export function moderateContent(content: string, from: string, to: string): ModerationResult {
  const fullText = `${from} ${to} ${content}`;
  let totalScore = 0;
  const allReasons: string[] = [];

  const checks = [
    checkBlocklist(fullText, HARD_BLOCK_WORDS, 'slur'),
    checkBlocklist(fullText, SEXUAL_WORDS, 'sexual'),
    checkBlocklist(fullText, VIOLENCE_WORDS, 'violence'),
    checkUrls(content),
    checkSpamPatterns(content),
  ];

  for (const check of checks) {
    totalScore += check.score;
    allReasons.push(...check.reasons);
  }

  return {
    passed: totalScore < REJECT_THRESHOLD,
    score: totalScore,
    reasons: allReasons,
  };
}
