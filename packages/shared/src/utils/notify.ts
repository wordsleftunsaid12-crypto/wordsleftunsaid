/** Email notification for approved messages via Resend. */

import { getEnvSafe } from '../config/env.js';

interface NotifyApprovedInput {
  messageId: string;
  email: string;
  to: string;
  siteUrl: string;
}

export async function notifyMessageApproved(input: NotifyApprovedInput): Promise<boolean> {
  const env = getEnvSafe();
  const apiKey = env?.RESEND_API_KEY;

  if (!apiKey) {
    return false;
  }

  const messageUrl = `${input.siteUrl}/messages/${input.messageId}`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Words Left Unsaid <noreply@wordsleftunsaid.com>',
      to: input.email,
      subject: 'Your words are live now.',
      html: `
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
            &mdash; Words Left Unsaid
          </p>
        </div>
      `,
    }),
  });

  return response.ok;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
