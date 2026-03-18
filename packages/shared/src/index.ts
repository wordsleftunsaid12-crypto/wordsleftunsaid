// Types
export type { Message, CreateMessageInput, MessageFilters } from './types/message.js';
export type {
  AspectRatio,
  TemplateName,
  MessageMood,
  VideoConfig,
  MessageVariation,
} from './types/video.js';
export { VIDEO_PRESETS } from './types/video.js';
export type {
  Platform,
  PostTarget,
  Post,
  PostStatus,
  PostType,
  ContentQueueItem,
  CreateContentQueueInput,
  CommentTracking,
  ScheduleConfig,
  OutboundEngagement,
  OutboundActionType,
} from './types/social.js';
export type {
  EngagementMetric,
  EngagementSummary,
  ContentPerformance,
  StrategyBrief,
  FollowerSnapshot,
} from './types/analytics.js';

// Database — Messages
export { getAnonClient, getServiceClient } from './db/client.js';
export {
  getApprovedMessages,
  getMessageById,
  createMessage,
  createApprovedMessage,
  findRecentDuplicate,
  approveMessage,
  getUnapprovedMessages,
  searchMessages,
  likeMessage,
  unlikeMessage,
  markFirstLikeNotified,
} from './db/messages.js';

// Database — Content Queue
export {
  getContentQueue,
  createContentQueueItem,
  updateContentQueueStatus,
  getNextScheduledItem,
  getContentQueueItemByVideoPath,
  getUsedMessageIds,
  getOverdueItems,
} from './db/content-queue.js';

// Database — Posts, Engagement, Comments, Strategy
export {
  createPost,
  deletePost,
  getPostsByPlatform,
  getRecentPosts,
  getPostCountToday,
  getTotalPostCount,
  saveEngagementMetrics,
  getLatestMetrics,
  getAllMetricsForPost,
  getUnrepliedComments,
  recordComment,
  markCommentReplied,
  recordOutboundEngagement,
  getOutboundEngagementCountToday,
  getRecentlyFollowedUsernames,
  saveStrategyBrief,
  getLatestStrategyBrief,
  saveFollowerSnapshot,
  getFollowerHistory,
  getScheduleConfig,
  hasPostForMessages,
  hasQueueItemForMessages,
  getTodayPosts,
  getUnverifiedPosts,
  updatePostVerification,
} from './db/posts.js';

// Utils
export { BRAND, MAX_VIDEO_CONTENT_LENGTH } from './utils/brand.js';
export { withRetry } from './utils/retry.js';
export { sanitizeText, sanitizeMessageInput } from './utils/sanitize.js';
export { moderateContent } from './utils/moderate.js';
export type { ModerationResult } from './utils/moderate.js';
export { notifyMessageApproved, notifyFirstLike, notifyMessageBecameVideo } from './utils/notify.js';

// Config
export { getEnv, getEnvSafe } from './config/env.js';
export type { Env } from './config/env.js';
