export interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  email: string | null;
  approved: boolean;
  created_at: string;
  like_count: number;
}

export interface CreateMessageInput {
  from: string;
  to: string;
  content: string;
  email?: string;
}

export interface MessageFilters {
  approved?: boolean;
  limit?: number;
  offset?: number;
}
