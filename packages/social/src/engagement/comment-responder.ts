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
  // Replies that acknowledge + ask a follow-up + subtly invite submission
  const emotionalReplies = [
    'That must weigh heavy. Have you ever written your own unsent message? There\'s something powerful about letting those words out.',
    'I felt that. What\'s the message you\'ve been holding back? Sometimes writing it changes everything.',
    'This resonates deeply. What would you say if no one would ever know it was you?',
    'Your words carry so much weight. Have you ever let yourself write out what you\'re carrying?',
    'I hear you. What\'s the one thing you wish you could say without consequences?',
  ];

  const shortCommentReplies = [
    'What would yours say?',
    'Have you ever held back words you wish you\'d said?',
    'What\'s the message you\'ll never send?',
  ];

  const questionReplies = [
    'Great question! There\'s a space in our bio where you can write yours anonymously.',
    'So glad you asked. Check the link in our bio \u2014 it\'s a safe space to write what you can\'t say out loud.',
  ];

  const tagReplies = [
    'Love that you\'re sharing this. What would you say to them if they\'d never know?',
    'The fact that you thought of someone says everything. What would your unsent message say?',
  ];

  const agreementReplies = [
    'Right? Some words are heavier when they stay inside. What\'s yours?',
    'Exactly. The unsent ones hit different. What message are you still carrying?',
  ];

  return async (commentText: string, _username: string) => {
    const lower = commentText.toLowerCase();
    const wordCount = commentText.split(/\s+/).length;

    // Very short comments (emoji reactions, single words)
    if (wordCount <= 3) {
      return shortCommentReplies[Math.floor(Math.random() * shortCommentReplies.length)];
    }

    // Questions from the commenter
    if (lower.includes('?') || lower.includes('how do') || lower.includes('where can')) {
      return questionReplies[Math.floor(Math.random() * questionReplies.length)];
    }

    // Tagged someone
    if (commentText.includes('@')) {
      return tagReplies[Math.floor(Math.random() * tagReplies.length)];
    }

    // Agreement/affirmation comments
    if (/\b(so true|this|fr|facts|felt that|real|same|mood|literally)\b/.test(lower)) {
      return agreementReplies[Math.floor(Math.random() * agreementReplies.length)];
    }

    // Default: emotional acknowledgment + follow-up question
    return emotionalReplies[Math.floor(Math.random() * emotionalReplies.length)];
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
