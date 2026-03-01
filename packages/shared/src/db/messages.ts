import { getAnonClient, getServiceClient } from './client.js';
import type { Message, CreateMessageInput, MessageFilters } from '../types/message.js';

const DEFAULT_PAGE_SIZE = 20;

export async function getApprovedMessages(
  filters: Omit<MessageFilters, 'approved'> = {},
): Promise<Message[]> {
  const { limit = DEFAULT_PAGE_SIZE, offset = 0 } = filters;
  const client = getAnonClient();

  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('approved', true)
    .order('created_at', { ascending: false })
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
  const client = getAnonClient();

  const { data, error } = await client
    .from('messages')
    .insert({
      from: input.from,
      to: input.to,
      content: input.content,
      email: input.email || null,
      approved: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create message: ${error.message}`);
  return data as Message;
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

export async function getUnapprovedMessages(): Promise<Message[]> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('approved', false)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch unapproved messages: ${error.message}`);
  return data as Message[];
}
