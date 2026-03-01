import { syncComments, replyToUnrepliedComments, likeCommentsOnOwnPosts } from '../platforms/instagram/comments.js';
import { COMMENT_REPLY_SYSTEM_PROMPT, COMMENT_REPLY_USER_PROMPT } from '../captions/prompts.js';

/**
 * Full comment responder cycle:
 * 1. Sync new comments from Instagram (via Playwright)
 * 2. Generate replies for unreplied comments
 * 3. Post the replies (via Playwright)
 */
export async function runCommentResponder(
  options: {
    dryRun?: boolean;
    maxReplies?: number;
    generateReply?: (
      commentText: string,
      username: string,
      postCaption: string | null,
    ) => Promise<string>;
  } = {},
): Promise<{ synced: number; replied: number; commentLikes: number }> {
  const { dryRun = false, maxReplies = 30 } = options;

  // Step 1: Sync new comments
  console.log('[comment-responder] Syncing comments...');
  const synced = await syncComments();

  // Step 2: Like comments on our own posts
  console.log('[comment-responder] Liking comments on own posts...');
  let commentLikes = 0;
  if (!dryRun) {
    commentLikes = await likeCommentsOnOwnPosts({ maxPosts: 5, maxLikesPerPost: 5 });
  } else {
    console.log('[comment-responder] [DRY RUN] Would like comments on own posts');
  }

  // Step 3: Generate and post replies
  console.log('[comment-responder] Processing unreplied comments...');
  const replyGenerator = options.generateReply ?? createTemplateReplyGenerator();

  const replied = await replyToUnrepliedComments({
    generateReply: replyGenerator,
    maxReplies,
    dryRun,
  });

  return { synced, replied, commentLikes };
}

/**
 * Create a simple template-based reply generator for when no AI is available.
 * Returns warm, empathetic responses based on comment sentiment patterns.
 */
function createTemplateReplyGenerator(): (
  commentText: string,
  username: string,
  postCaption: string | null,
) => Promise<string> {
  const empathyReplies = [
    'Thank you for sharing this. Your words carry so much weight.',
    'This really resonates. Sometimes the things we leave unsaid say the most.',
    'We hear you. These feelings deserve to be expressed.',
    'Thank you for being here and for your honesty.',
    'Your vulnerability means more than you know.',
  ];

  const questionReplies = [
    'You can share your own message anonymously at wordsleftunsaid.netlify.app',
    'We\'d love to hear your story — you can submit yours at wordsleftunsaid.netlify.app',
  ];

  const tagReplies = [
    'So glad you\'re sharing this with someone who matters.',
    'Some messages are meant to be shared. Thank you for this.',
  ];

  return async (commentText: string, _username: string) => {
    const lower = commentText.toLowerCase();

    // If they ask a question
    if (lower.includes('?') || lower.includes('how') || lower.includes('where')) {
      return questionReplies[Math.floor(Math.random() * questionReplies.length)];
    }

    // If they tag someone
    if (commentText.includes('@')) {
      return tagReplies[Math.floor(Math.random() * tagReplies.length)];
    }

    // Default empathetic response
    return empathyReplies[Math.floor(Math.random() * empathyReplies.length)];
  };
}

/**
 * Get the system and user prompts for AI-powered reply generation.
 * Exported for use by the Claude Code agent when generating replies directly.
 */
export function getReplyPrompts(
  commentText: string,
  username: string,
  postCaption: string | null,
): { system: string; user: string } {
  return {
    system: COMMENT_REPLY_SYSTEM_PROMPT,
    user: COMMENT_REPLY_USER_PROMPT(commentText, username, postCaption),
  };
}
