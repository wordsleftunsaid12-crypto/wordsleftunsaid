import {
  getContentQueue,
  updateContentQueueStatus,
  getLatestStrategyBrief,
  getMessageById,
} from '@wlu/shared';
import type { StrategyBrief, Platform, MessageMood } from '@wlu/shared';
import { CAPTION_SYSTEM_PROMPT, CAPTION_USER_PROMPT } from './prompts.js';
import { buildCaption } from './templates.js';

interface CaptionResult {
  caption: string;
  hashtags: string[];
}

/** Local Ollama endpoint — no external LLM dependency. */
const OLLAMA_HOST = process.env.WLU_OLLAMA_HOST ?? 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.WLU_OLLAMA_MODEL ?? 'llama3.2:1b';

/**
 * Generate a caption and hashtags for a single message.
 * Uses local Ollama for LLM-assisted generation; falls back to pre-written templates when Ollama isn't reachable.
 */
export async function generateCaption(
  message: { from: string; to: string; content: string },
  platform: Platform = 'instagram',
  mood?: string | null,
): Promise<CaptionResult> {
  // Cheap, reliable fallback — template-based captions. Used when Ollama
  // isn't reachable or returns unparseable JSON. Templates are tuned per
  // platform and mood so quality is acceptable without an LLM.
  const templatePlatform = (['instagram', 'tiktok', 'youtube'] as const).includes(
    platform as 'instagram' | 'tiktok' | 'youtube',
  )
    ? (platform as 'instagram' | 'tiktok' | 'youtube')
    : 'instagram';
  const moodValue: MessageMood = isValidMood(mood) ? mood : 'bittersweet';
  const templateCaption = buildCaption(moodValue, templatePlatform, message.to);

  // Pull in latest strategy guidelines if available
  let strategyGuidelines: string | undefined;
  try {
    const briefRecord = await getLatestStrategyBrief();
    if (briefRecord) {
      const brief = briefRecord.brief as unknown as StrategyBrief;
      if (brief.captionGuidelines) strategyGuidelines = brief.captionGuidelines;
    }
  } catch {
    // Strategy brief is optional — continue without it
  }

  let result: CaptionResult;
  try {
    const resp = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: 'json',
        options: { temperature: 0.7, num_predict: 300 },
        messages: [
          { role: 'system', content: CAPTION_SYSTEM_PROMPT },
          { role: 'user', content: CAPTION_USER_PROMPT(message, platform, strategyGuidelines) },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
    const data = (await resp.json()) as { message?: { content?: string } };
    const text = data.message?.content ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no JSON in Ollama response');
    const parsed = JSON.parse(match[0]) as CaptionResult;
    if (!parsed.caption || !Array.isArray(parsed.hashtags)) {
      throw new Error('incomplete caption JSON');
    }
    result = parsed;
  } catch (err) {
    console.warn(`[caption] Ollama failed (${err instanceof Error ? err.message.slice(0, 100) : err}); using template fallback`);
    return templateCaption;
  }

  // Apply hashtag performance weighting from strategy if available
  try {
    const briefRecord = await getLatestStrategyBrief();
    if (briefRecord) {
      const brief = briefRecord.brief as unknown as StrategyBrief;
      if (brief.hashtagPerformance && Object.keys(brief.hashtagPerformance).length > 0) {
        result.hashtags = weightHashtags(result.hashtags, brief.hashtagPerformance);
      }
    }
  } catch {
    // Continue with unweighted hashtags
  }

  return result;
}

const VALID_MOODS: MessageMood[] = ['tender', 'regretful', 'hopeful', 'bittersweet', 'raw'];

function isValidMood(mood: string | null | undefined): mood is MessageMood {
  return typeof mood === 'string' && VALID_MOODS.includes(mood as MessageMood);
}

/**
 * Process all pending items in the content queue — generate captions and update status.
 * Returns the number of items captioned.
 */
export async function captionPendingItems(
  options: { platform?: Platform; dryRun?: boolean } = {},
): Promise<number> {
  const { platform = 'instagram', dryRun = false } = options;

  const pendingItems = await getContentQueue({ status: 'qa_passed', platform });
  let captioned = 0;

  for (const item of pendingItems) {
    try {
      // Fetch actual message data from DB using the first messageId
      let message: { from: string; to: string; content: string };

      if (item.messageIds && item.messageIds.length > 0) {
        const dbMessage = await getMessageById(item.messageIds[0]);
        if (dbMessage) {
          message = { from: dbMessage.from, to: dbMessage.to, content: dbMessage.content };
        } else {
          message = { from: 'Someone', to: 'Someone else', content: 'An unsent message' };
        }
      } else {
        message = { from: 'Someone', to: 'Someone else', content: 'An unsent message' };
      }

      const { caption, hashtags } = await generateCaption(message, platform, item.mood);

      if (dryRun) {
        console.log(`[caption] [DRY RUN] ${item.id}: "${caption}" ${hashtags.join(' ')}`);
      } else {
        await updateContentQueueStatus(item.id, 'captioned', { caption, hashtags });
        console.log(`[caption] Captioned: ${item.id}`);
      }

      captioned++;
    } catch (err) {
      console.warn(`[caption] Failed to caption item ${item.id}:`, err);
      if (!dryRun) {
        await updateContentQueueStatus(item.id, 'failed', {
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  if (pendingItems.length > 0) {
    console.log(`[caption] Captioned ${captioned} of ${pendingItems.length} pending item(s)`);
  }
  return captioned;
}

/**
 * Reorder hashtags based on historical performance scores.
 * Top-performing hashtags come first. Unknown hashtags are kept at the end.
 */
function weightHashtags(
  hashtags: string[],
  performance: Record<string, number>,
): string[] {
  return [...hashtags].sort((a, b) => {
    const scoreA = performance[a] ?? performance[a.replace('#', '')] ?? 0;
    const scoreB = performance[b] ?? performance[b.replace('#', '')] ?? 0;
    return scoreB - scoreA;
  });
}
