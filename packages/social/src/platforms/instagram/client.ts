import { getEnv } from '@wlu/shared';
import type {
  IGContainerStatusResponse,
  IGPublishResponse,
  IGCommentsListResponse,
  IGMediaInsightsResponse,
  IGProfileResponse,
  IGError,
} from './types.js';

const GRAPH_API_BASE = 'https://graph.instagram.com/v21.0';
const MAX_CALLS_PER_HOUR = 150;
const HOUR_MS = 3600000;

export class InstagramClient {
  private accessToken: string;
  private businessAccountId: string;
  private callTimestamps: number[] = [];

  constructor(config?: { accessToken?: string; businessAccountId?: string }) {
    const env = getEnv();
    this.accessToken = config?.accessToken ?? env.INSTAGRAM_ACCESS_TOKEN ?? '';
    this.businessAccountId = config?.businessAccountId ?? env.INSTAGRAM_BUSINESS_ACCOUNT_ID ?? '';

    if (!this.accessToken || !this.businessAccountId) {
      throw new Error(
        'INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID are required',
      );
    }
  }

  // --- Publishing ---

  async createReelContainer(videoUrl: string, caption: string): Promise<string> {
    const response = await this.apiCall<IGPublishResponse>(
      `/${this.businessAccountId}/media`,
      {
        method: 'POST',
        body: new URLSearchParams({
          media_type: 'REELS',
          video_url: videoUrl,
          caption,
          access_token: this.accessToken,
        }),
      },
    );
    return response.id;
  }

  async createImageContainer(imageUrl: string, caption: string): Promise<string> {
    const response = await this.apiCall<IGPublishResponse>(
      `/${this.businessAccountId}/media`,
      {
        method: 'POST',
        body: new URLSearchParams({
          image_url: imageUrl,
          caption,
          access_token: this.accessToken,
        }),
      },
    );
    return response.id;
  }

  async checkContainerStatus(containerId: string): Promise<IGContainerStatusResponse> {
    return this.apiCall<IGContainerStatusResponse>(
      `/${containerId}?fields=status_code,status&access_token=${this.accessToken}`,
    );
  }

  async publishContainer(containerId: string): Promise<string> {
    const response = await this.apiCall<IGPublishResponse>(
      `/${this.businessAccountId}/media_publish`,
      {
        method: 'POST',
        body: new URLSearchParams({
          creation_id: containerId,
          access_token: this.accessToken,
        }),
      },
    );
    return response.id;
  }

  // --- Comments ---

  async getMediaComments(
    mediaId: string,
    limit: number = 50,
  ): Promise<IGCommentsListResponse> {
    return this.apiCall<IGCommentsListResponse>(
      `/${mediaId}/comments?fields=id,text,username,timestamp,replies{id,text,username,timestamp}&limit=${limit}&access_token=${this.accessToken}`,
    );
  }

  async replyToComment(commentId: string, message: string): Promise<string> {
    const response = await this.apiCall<IGPublishResponse>(
      `/${commentId}/replies`,
      {
        method: 'POST',
        body: new URLSearchParams({
          message,
          access_token: this.accessToken,
        }),
      },
    );
    return response.id;
  }

  // --- Insights ---

  async getMediaInsights(
    mediaId: string,
    metrics: string[] = ['likes', 'comments', 'shares', 'saved', 'plays', 'reach', 'total_interactions'],
  ): Promise<IGMediaInsightsResponse> {
    return this.apiCall<IGMediaInsightsResponse>(
      `/${mediaId}/insights?metric=${metrics.join(',')}&access_token=${this.accessToken}`,
    );
  }

  async getAccountProfile(): Promise<IGProfileResponse> {
    return this.apiCall<IGProfileResponse>(
      `/${this.businessAccountId}?fields=id,username,name,followers_count,follows_count,media_count&access_token=${this.accessToken}`,
    );
  }

  // --- Rate limiting & HTTP ---

  private async rateLimitGuard(): Promise<void> {
    const now = Date.now();
    this.callTimestamps = this.callTimestamps.filter((t) => now - t < HOUR_MS);

    if (this.callTimestamps.length >= MAX_CALLS_PER_HOUR) {
      const oldestInWindow = this.callTimestamps[0];
      const waitMs = HOUR_MS - (now - oldestInWindow) + 1000;
      console.log(`[instagram] Rate limit approaching, waiting ${Math.round(waitMs / 1000)}s`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.callTimestamps.push(Date.now());
  }

  private async apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
    await this.rateLimitGuard();

    const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_API_BASE}${endpoint}`;
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      const igError = data as IGError;
      throw new Error(
        `Instagram API error ${response.status}: ${igError.error?.message ?? JSON.stringify(data)}`,
      );
    }

    return data as T;
  }
}
