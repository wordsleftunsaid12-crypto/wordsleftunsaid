export interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  email: string | null;
  approved: boolean;
  created_at: string;
  like_count: number;
  seeded: boolean;
}

export interface CreateMessageInput {
  from: string;
  to: string;
  content: string;
  email?: string;
  seeded?: boolean;
}

export interface MessageFilters {
  approved?: boolean;
  limit?: number;
  offset?: number;
}
