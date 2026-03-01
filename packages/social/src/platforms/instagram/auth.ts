import { getEnv } from '@wlu/shared';
import type { TokenInfo } from './types.js';

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

/**
 * Exchange a short-lived token for a long-lived one (60-day expiry).
 * Run this once after generating a token in the Meta Developer Console.
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<TokenInfo> {
  const env = getEnv();
  if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) {
    throw new Error('FACEBOOK_APP_ID and FACEBOOK_APP_SECRET are required for token exchange');
  }

  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: env.FACEBOOK_APP_ID,
    client_secret: env.FACEBOOK_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${params}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${data.error?.message ?? JSON.stringify(data)}`);
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type ?? 'bearer',
  };
}

/**
 * Refresh a long-lived token before it expires.
 * Long-lived tokens can be refreshed once per day, as long as they haven't expired.
 */
export async function refreshLongLivedToken(
  currentToken: string,
): Promise<TokenInfo> {
  const env = getEnv();
  if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) {
    throw new Error('FACEBOOK_APP_ID and FACEBOOK_APP_SECRET are required for token refresh');
  }

  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: env.FACEBOOK_APP_ID,
    client_secret: env.FACEBOOK_APP_SECRET,
    fb_exchange_token: currentToken,
  });

  const response = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${params}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${data.error?.message ?? JSON.stringify(data)}`);
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type ?? 'bearer',
  };
}

/**
 * Check if a token is expiring within the given threshold.
 */
export function isTokenExpiringSoon(
  expiresAt: Date,
  thresholdDays: number = 7,
): boolean {
  const thresholdMs = thresholdDays * 86400000;
  return expiresAt.getTime() - Date.now() < thresholdMs;
}
