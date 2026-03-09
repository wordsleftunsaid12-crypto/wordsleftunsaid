import type { MessageMood } from '@wlu/shared';

/**
 * Keyword lists with weights for each mood.
 * Higher weight = stronger signal. Phrases checked before single words.
 */
const MOOD_KEYWORDS: Record<MessageMood, Array<[string, number]>> = {
  tender: [
    // Phrases (checked first, higher weight)
    ['i love you', 3],
    ['i miss you', 3],
    ['thank you', 2],
    ['proud of you', 3],
    ['take care', 2],
    ['meant to me', 3],
    ['hold you', 2],
    ['thinking of you', 2],
    ['grateful for', 2],
    ['safe place', 2],
    // Single words
    ['love', 2],
    ['miss', 2],
    ['care', 1],
    ['gentle', 2],
    ['heart', 1],
    ['warmth', 2],
    ['dear', 1],
    ['mother', 2],
    ['mom', 2],
    ['dad', 2],
    ['father', 2],
    ['grandpa', 2],
    ['grandma', 2],
    ['daughter', 2],
    ['son', 1],
    ['brother', 1],
    ['sister', 1],
    ['taught', 1],
    ['kind', 1],
    ['soft', 1],
    ['hug', 2],
    ['safe', 1],
    ['comfort', 1],
    ['beautiful', 1],
    ['cherish', 2],
    ['precious', 2],
    ['piano', 1],
    ['lullaby', 2],
    ['smile', 1],
  ],
  regretful: [
    // Phrases
    ['should have', 3],
    ['i\'m sorry', 3],
    ['too late', 3],
    ['if only', 3],
    ['i wish', 2],
    ['i never told', 3],
    ['i was wrong', 3],
    ['i wasn\'t there', 3],
    ['i didn\'t', 2],
    ['forgive me', 3],
    ['couldn\'t say', 2],
    ['never got to', 2],
    ['took for granted', 3],
    // Single words
    ['sorry', 2],
    ['regret', 3],
    ['forgive', 2],
    ['mistake', 2],
    ['guilt', 2],
    ['wrong', 1],
    ['fault', 2],
    ['failed', 2],
    ['apologize', 2],
    ['blame', 1],
    ['ashamed', 2],
    ['coward', 2],
    ['selfish', 2],
  ],
  hopeful: [
    // Phrases
    ['one day', 2],
    ['i believe', 3],
    ['keep going', 3],
    ['you survived', 3],
    ['you\'re strong', 3],
    ['get through', 2],
    ['proud of', 2],
    ['new beginning', 3],
    ['it gets better', 3],
    ['you\'ve got this', 3],
    ['looking forward', 2],
    ['brighter days', 3],
    ['you made it', 3],
    ['you will', 2],
    // Single words
    ['hope', 2],
    ['someday', 2],
    ['better', 1],
    ['believe', 2],
    ['future', 2],
    ['strong', 2],
    ['survive', 2],
    ['brave', 2],
    ['proud', 2],
    ['light', 1],
    ['grow', 1],
    ['dream', 2],
    ['heal', 2],
    ['rise', 2],
    ['overcome', 2],
    ['strength', 2],
    ['courage', 2],
    ['free', 1],
  ],
  bittersweet: [
    // Phrases
    ['used to', 2],
    ['remember when', 3],
    ['we used to', 3],
    ['i still', 2],
    ['grew apart', 3],
    ['things changed', 2],
    ['i remember', 2],
    ['back then', 2],
    ['those days', 2],
    ['we were', 1],
    ['time passes', 2],
    ['not the same', 2],
    ['still think about', 3],
    ['looking back', 2],
    ['once upon', 2],
    // Single words
    ['remember', 1],
    ['memory', 2],
    ['nostalgia', 3],
    ['years', 1],
    ['childhood', 2],
    ['seasons', 2],
    ['bittersweet', 3],
    ['faded', 2],
    ['distance', 1],
    ['time', 1],
    ['ago', 1],
    ['once', 1],
    ['playlist', 2],
    ['photograph', 2],
    ['letters', 2],
    ['coffee', 1],
  ],
  raw: [
    // Phrases
    ['i hate', 3],
    ['you left', 2],
    ['you lied', 3],
    ['how could you', 3],
    ['you broke', 3],
    ['tore me', 3],
    ['ripped apart', 3],
    ['i can\'t breathe', 3],
    ['left me', 2],
    ['walked away', 2],
    ['shut me out', 3],
    ['you destroyed', 3],
    ['never coming back', 3],
    ['you ghosted', 3],
    // Single words
    ['angry', 2],
    ['hurt', 2],
    ['broken', 2],
    ['alone', 2],
    ['scream', 3],
    ['truth', 1],
    ['abandoned', 3],
    ['ghost', 2],
    ['betray', 3],
    ['rage', 3],
    ['shatter', 2],
    ['hollow', 2],
    ['numb', 2],
    ['suffocate', 3],
    ['drown', 2],
    ['dark', 1],
    ['bleeding', 2],
    ['wreck', 2],
    ['toxic', 2],
    ['damage', 2],
  ],
};

/**
 * Detect the mood of a message based on keyword analysis.
 * Scores each mood by matching keywords/phrases against the message text.
 * Returns the highest-scoring mood, defaulting to 'bittersweet' on ties.
 */
export function detectMood(content: string, from: string, to: string): MessageMood {
  const text = `${from} ${to} ${content}`.toLowerCase();
  const scores: Record<MessageMood, number> = {
    tender: 0,
    regretful: 0,
    hopeful: 0,
    bittersweet: 0,
    raw: 0,
  };

  for (const mood of Object.keys(MOOD_KEYWORDS) as MessageMood[]) {
    for (const [keyword, weight] of MOOD_KEYWORDS[mood]) {
      if (text.includes(keyword)) {
        scores[mood] += weight;
      }
    }
  }

  // Find highest score
  let bestMood: MessageMood = 'bittersweet';
  let bestScore = 0;

  for (const mood of Object.keys(scores) as MessageMood[]) {
    if (scores[mood] > bestScore) {
      bestScore = scores[mood];
      bestMood = mood;
    }
  }

  console.log(`  Mood detection: ${bestMood} (scores: ${JSON.stringify(scores)})`);
  return bestMood;
}
