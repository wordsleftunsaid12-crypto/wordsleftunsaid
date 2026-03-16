import Anthropic from '@anthropic-ai/sdk';
import type { Message, MessageMood } from '@wlu/shared';
import {
  CURATE_SYSTEM_PROMPT,
  CURATE_USER_PROMPT,
} from './prompts.js';

interface CuratedMessage {
  id: string;
  mood: MessageMood;
  reason: string;
}

function getClient(): Anthropic {
  return new Anthropic();
}

export async function curateMessages(messages: Message[]): Promise<CuratedMessage[]> {
  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: CURATE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: CURATE_USER_PROMPT(messages),
      },
    ],
  });

  const text = response.content[0];
  if (text.type !== 'text') throw new Error('Unexpected response type');

  try {
    return JSON.parse(text.text) as CuratedMessage[];
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${text.text.slice(0, 200)}`);
  }
}
