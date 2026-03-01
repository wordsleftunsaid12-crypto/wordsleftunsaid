// Instagram Graph API response types

export interface IGContainerStatusResponse {
  id: string;
  status_code: 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED';
  status?: string;
}

export interface IGPublishResponse {
  id: string;
}

export interface IGMediaResponse {
  id: string;
  media_url?: string;
  permalink?: string;
  timestamp?: string;
  caption?: string;
  media_type?: string;
}

export interface IGCommentResponse {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  replies?: { data: IGCommentResponse[] };
}

export interface IGCommentsListResponse {
  data: IGCommentResponse[];
  paging?: {
    cursors: { before: string; after: string };
    next?: string;
  };
}

export interface IGInsightsMetric {
  name: string;
  period: string;
  values: Array<{ value: number }>;
  title: string;
  description: string;
  id: string;
}

export interface IGMediaInsightsResponse {
  data: IGInsightsMetric[];
}

export interface IGAccountInsightsResponse {
  data: IGInsightsMetric[];
}

export interface IGProfileResponse {
  id: string;
  username: string;
  name: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
}

export interface IGError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

export interface TokenInfo {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}
