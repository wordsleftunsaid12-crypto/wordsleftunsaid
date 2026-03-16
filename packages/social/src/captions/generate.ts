import Anthropic from '@anthropic-ai/sdk';
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

/** Check if the Anthropic API key looks valid (real keys are 100+ chars). */
function hasApiKey(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return typeof key === 'string' && key.startsWith('sk-ant-') && key.length > 40;
}

function getClient(): Anthropic {
  return new Anthropic();
}

/**
 * Generate a caption and hashtags for a single message.
 * Falls back to pre-written templates when no ANTHROPIC_API_KEY is configured.
 */
export async function generateCaption(
  message: { from: string; to: string; content: string },
  platform: Platform = 'instagram',
  mood?: string | null,
): Promise<CaptionResult> {
  // Fallback: use template-based captions when no API key
  if (!hasApiKey()) {
    const templatePlatform = (['instagram', 'tiktok', 'youtube'] as const).includes(
      platform as 'instagram' | 'tiktok' | 'youtube',
    )
      ? (platform as 'instagram' | 'tiktok' | 'youtube')
      : 'instagram';
    const moodValue: MessageMood = isValidMood(mood) ? mood : 'bittersweet';
    return buildCaption(moodValue, templatePlatform);
  }

  const client = getClient();

  // Pull in latest strategy guidelines if available
  let strategyGuidelines: string | undefined;
  try {
    const briefRecord = await getLatestStrategyBrief();
    if (briefRecord) {
      const brief = briefRecord.brief as unknown as StrategyBrief;
      if (brief.captionGuidelines) {
        strategyGuidelines = brief.captionGuidelines;
      }
    }
  } catch {
    // Strategy brief is optional — continue without it
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 512,
    system: CAPTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: CAPTION_USER_PROMPT(message, platform, strategyGuidelines),
      },
    ],
  });

  const text = response.content[0];
  if (text.type !== 'text') throw new Error('Unexpected response type from Claude');

  const result = JSON.parse(text.text) as CaptionResult;

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
