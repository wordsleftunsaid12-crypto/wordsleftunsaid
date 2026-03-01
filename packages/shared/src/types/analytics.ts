export interface EngagementMetric {
  id: string;
  postId: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  saves: number;
  reach: number;
  impressions: number;
  measuredAt: string;
}

export interface EngagementSummary {
  totalPosts: number;
  avgLikes: number;
  avgComments: number;
  avgViews: number;
  avgSaves: number;
  engagementRate: number;
  bestPerformingMood: string | null;
  bestPerformingTemplate: string | null;
  bestPostingHour: number | null;
}

export interface ContentPerformance {
  postId: string;
  messageIds: string[];
  template: string | null;
  mood: string | null;
  engagementScore: number;
  postedAt: string;
}

export interface StrategyBrief {
  preferredMoods: string[];
  preferredTemplates: string[];
  bestPostingHours: number[];
  captionGuidelines: string;
  hashtagPerformance: Record<string, number>;
  engagementInsights: string;
}

export interface FollowerSnapshot {
  id: string;
  platform: string;
  followerCount: number;
  followingCount: number;
  measuredAt: string;
}
