import { getAnonClient, getServiceClient } from './client.js';
import type { Message, CreateMessageInput, MessageFilters } from '../types/message.js';
import { moderateContent } from '../utils/moderate.js';

const DEFAULT_PAGE_SIZE = 20;

export async function getApprovedMessages(
  filters: Omit<MessageFilters, 'approved'> & { sort?: 'recent' | 'loved' } = {},
): Promise<Message[]> {
  const { limit = DEFAULT_PAGE_SIZE, offset = 0, sort = 'recent' } = filters;
  const client = getAnonClient();

  const orderColumn = sort === 'loved' ? 'like_count' : 'created_at';

  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('approved', true)
    .order(orderColumn, { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
  return data as Message[];
}

export async function getMessageById(id: string): Promise<Message | null> {
  const client = getAnonClient();

  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch message: ${error.message}`);
  }
  return data as Message;
}

export async function createMessage(input: CreateMessageInput): Promise<Message> {
  // Auto-moderate: approve clean submissions, reject flagged ones
  const moderation = moderateContent(input.content, input.from, input.to);
  const autoApproved = moderation.passed;

  if (autoApproved) {
    // Use service client so we can read back the inserted row (bypasses RLS)
    const client = getServiceClient();
    const { data, error } = await client
      .from('messages')
      .insert({
        from: input.from,
        to: input.to,
        content: input.content,
        email: input.email || null,
        approved: true,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create message: ${error.message}`);
    return data as Message;
  }

  // Flagged content: insert as unapproved via anon client
  const client = getAnonClient();
  const { error } = await client
    .from('messages')
    .insert({
      from: input.from,
      to: input.to,
      content: input.content,
      email: input.email || null,
      approved: false,
    });

  if (error) throw new Error(`Failed to create message: ${error.message}`);

  return {
    id: crypto.randomUUID(),
    from: input.from,
    to: input.to,
    content: input.content,
    email: input.email || null,
    approved: false,
    created_at: new Date().toISOString(),
    like_count: 0,
    seeded: false,
    first_like_notified: false,
  };
}

export async function approveMessage(id: string): Promise<Message> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('messages')
    .update({ approved: true })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to approve message: ${error.message}`);
  return data as Message;
}

export async function searchMessages(
  query: string,
  filters: Omit<MessageFilters, 'approved'> = {},
): Promise<Message[]> {
  const { limit = DEFAULT_PAGE_SIZE, offset = 0 } = filters;
  const client = getAnonClient();
  const pattern = `%${query}%`;

  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('approved', true)
    .or(`content.ilike.${pattern},to.ilike.${pattern},from.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to search messages: ${error.message}`);
  return data as Message[];
}

export async function findRecentDuplicate(input: CreateMessageInput, windowMinutes = 5): Promise<boolean> {
  const client = getServiceClient();
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { data, error } = await client
    .from('messages')
    .select('id')
    .eq('from', input.from)
    .eq('to', input.to)
    .eq('content', input.content)
    .gte('created_at', since)
    .limit(1);

  if (error) throw new Error(`Failed to check for duplicate: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export async function createApprovedMessage(input: CreateMessageInput): Promise<Message> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('messages')
    .insert({
      from: input.from,
      to: input.to,
      content: input.content,
      email: input.email || null,
      approved: true,
      seeded: input.seeded ?? false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create approved message: ${error.message}`);
  return data as Message;
}

// --- Message Likes ---

export async function likeMessage(messageId: string, visitorId: string): Promise<boolean> {
  const client = getAnonClient();

  const { error } = await client
    .from('message_likes')
    .insert({ message_id: messageId, visitor_id: visitorId });

  if (error) {
    if (error.code === '23505') return false; // Already liked (unique constraint)
    throw new Error(`Failed to like message: ${error.message}`);
  }
  return true;
}

export async function unlikeMessage(messageId: string, visitorId: string): Promise<boolean> {
  const client = getAnonClient();

  const { error, count } = await client
    .from('message_likes')
    .delete({ count: 'exact' })
    .eq('message_id', messageId)
    .eq('visitor_id', visitorId);

  if (error) throw new Error(`Failed to unlike message: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function markFirstLikeNotified(messageId: string): Promise<void> {
  const client = getServiceClient();

  const { error } = await client
    .from('messages')
    .update({ first_like_notified: true })
    .eq('id', messageId);

  if (error) throw new Error(`Failed to mark first_like_notified: ${error.message}`);
}

export async function getUnapprovedMessages(
  filters: { limit?: number; offset?: number } = {},
): Promise<Message[]> {
  const { limit = DEFAULT_PAGE_SIZE, offset = 0 } = filters;
  const client = getServiceClient();

  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('approved', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to fetch unapproved messages: ${error.message}`);
  return data as Message[];
}
