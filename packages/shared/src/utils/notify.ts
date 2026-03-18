/** Email notification for approved messages via Brevo (free: 300 emails/day). */

import { getEnvSafe } from '../config/env.js';

interface NotifyApprovedInput {
  messageId: string;
  email: string;
  to: string;
  siteUrl: string;
}

export async function notifyMessageApproved(input: NotifyApprovedInput): Promise<boolean> {
  const env = getEnvSafe();
  const apiKey = env?.BREVO_API_KEY;
  const senderEmail = env?.BREVO_SENDER_EMAIL;

  if (!apiKey || !senderEmail) {
    return false;
  }

  const messageUrl = `${input.siteUrl}/messages/${input.messageId}`;

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Words Left Unsent', email: senderEmail },
      to: [{ email: input.email }],
      subject: 'Your words are live now.',
      htmlContent: `
        <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; color: #2c2c2c;">
          <p style="font-size: 18px; line-height: 1.7; margin-bottom: 24px;">
            Your message to <strong>${escapeHtml(input.to)}</strong> has been approved and is now live.
          </p>
          <p style="margin-bottom: 32px;">
            <a href="${messageUrl}" style="display: inline-block; padding: 12px 28px; background: #c8a882; color: #0c0b0a; text-decoration: none; border-radius: 4px; font-size: 15px;">
              View your message
            </a>
          </p>
          <p style="font-size: 13px; color: #888; line-height: 1.6;">
            Thank you for sharing your words with the world.<br>
            &mdash; Words Left Unsent
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[notify] Brevo error ${response.status}: ${body}`);
  }

  return response.ok;
}

interface NotifyFirstLikeInput {
  messageId: string;
  email: string;
  to: string;
  siteUrl: string;
}

/**
 * Notify a submitter when their message receives its first like.
 * Creates a retention loop: submit → get notified → return → submit again.
 */
export async function notifyFirstLike(input: NotifyFirstLikeInput): Promise<boolean> {
  const env = getEnvSafe();
  const apiKey = env?.BREVO_API_KEY;
  const senderEmail = env?.BREVO_SENDER_EMAIL;

  if (!apiKey || !senderEmail) {
    return false;
  }

  const messageUrl = `${input.siteUrl}/messages/${input.messageId}`;

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Words Left Unsent', email: senderEmail },
      to: [{ email: input.email }],
      subject: 'Someone felt your words.',
      htmlContent: `
        <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; color: #2c2c2c;">
          <p style="font-size: 18px; line-height: 1.7; margin-bottom: 24px;">
            Someone just liked your message to <strong>${escapeHtml(input.to)}</strong>.
          </p>
          <p style="font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
            Your words reached someone. That matters.
          </p>
          <p style="margin-bottom: 32px;">
            <a href="${messageUrl}" style="display: inline-block; padding: 12px 28px; background: #c8a882; color: #0c0b0a; text-decoration: none; border-radius: 4px; font-size: 15px;">
              View your message
            </a>
          </p>
          <p style="font-size: 13px; color: #888; line-height: 1.6;">
            Have more to say? <a href="${input.siteUrl}/submit" style="color: #c8a882;">Write another message</a><br>
            &mdash; Words Left Unsent
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[notify] Brevo first-like error ${response.status}: ${body}`);
  }

  return response.ok;
}

interface NotifyVideoCreatedInput {
  messageId: string;
  email: string;
  to: string;
  siteUrl: string;
}

/**
 * Notify a submitter when their message is turned into a video.
 * The submitter becomes a free marketer — they'll share the video.
 */
export async function notifyMessageBecameVideo(input: NotifyVideoCreatedInput): Promise<boolean> {
  const env = getEnvSafe();
  const apiKey = env?.BREVO_API_KEY;
  const senderEmail = env?.BREVO_SENDER_EMAIL;

  if (!apiKey || !senderEmail) {
    return false;
  }

  const messageUrl = `${input.siteUrl}/messages/${input.messageId}`;

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Words Left Unsent', email: senderEmail },
      to: [{ email: input.email }],
      subject: 'Your words just became a video.',
      htmlContent: `
        <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; color: #2c2c2c;">
          <p style="font-size: 18px; line-height: 1.7; margin-bottom: 24px;">
            Your message to <strong>${escapeHtml(input.to)}</strong> inspired a video that's now reaching people across social media.
          </p>
          <p style="font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
            Your words are touching hearts. Thank you for being brave enough to share them.
          </p>
          <p style="margin-bottom: 32px;">
            <a href="${messageUrl}" style="display: inline-block; padding: 12px 28px; background: #c8a882; color: #0c0b0a; text-decoration: none; border-radius: 4px; font-size: 15px;">
              See your message
            </a>
          </p>
          <p style="font-size: 13px; color: #888; line-height: 1.6;">
            Have more words to share? <a href="${input.siteUrl}/submit" style="color: #c8a882;">Write another message</a><br>
            &mdash; Words Left Unsent
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[notify] Brevo video notification error ${response.status}: ${body}`);
  }

  return response.ok;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
