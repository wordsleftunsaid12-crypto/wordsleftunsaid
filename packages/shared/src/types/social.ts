export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'reddit' | 'pinterest' | 'twitter' | 'threads';
export type PostStatus = 'pending' | 'qa_passed' | 'captioned' | 'scheduled' | 'posted' | 'failed';
export type PostType = 'reel' | 'feed' | 'carousel' | 'story';
export type OutboundActionType = 'like' | 'follow' | 'comment';

export interface PostTarget {
  platform: Platform;
  videoPath: string;
  caption: string;
  hashtags: string[];
}

export interface Post {
  id: string;
  platform: Platform;
  platformPostId: string | null;
  platformMediaUrl: string | null;
  contentQueueId: string | null;
  messageIds: string[];
  caption: string | null;
  hashtags: string[];
  template: string | null;
  mood: string | null;
  postType: PostType;
  isExploration: boolean;
  postedAt: string;
  createdAt: string;
}

export interface ContentQueueItem {
  id: string;
  videoPath: string;
  coverImagePath: string | null;
  messageIds: string[];
  template: string;
  mood: string | null;
  status: PostStatus;
  caption: string | null;
  hashtags: string[];
  scheduledFor: string | null;
  platform: Platform;
  isExploration: boolean;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContentQueueInput {
  videoPath: string;
  coverImagePath?: string;
  messageIds: string[];
  template: string;
  mood?: string;
  platform: Platform;
  isExploration?: boolean;
}

export interface CommentTracking {
  id: string;
  postId: string;
  platformCommentId: string;
  username: string;
  commentText: string;
  replied: boolean;
  replyText: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export interface ScheduleConfig {
  id: string;
  platform: Platform;
  dayOfWeek: number | null;
  preferredHour: number | null;
  timezone: string;
  postsPerDay: number;
  active: boolean;
  createdAt: string;
}

export interface OutboundEngagement {
  id: string;
  platform: Platform;
  actionType: OutboundActionType;
  targetUsername: string;
  targetPostUrl: string | null;
  targetHashtag: string | null;
  commentText: string | null;
  resultedInFollowback: boolean;
  createdAt: string;
}
