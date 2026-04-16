/**
 * CAPTCHA detection utilities for browser automation.
 * When a CAPTCHA is detected, the browser is left open for the user to solve manually.
 */
import type { Page } from 'playwright';

export class CaptchaDetectedError extends Error {
  constructor(public readonly platform: string) {
    super(
      `CAPTCHA detected on ${platform} — browser left open for manual resolution. ` +
        `Solve it manually, then restart the scheduler.`,
    );
    this.name = 'CaptchaDetectedError';
  }
}

/** Platform-specific CAPTCHA indicators */
const CAPTCHA_PATTERNS: Record<string, { urlPatterns: RegExp[]; textPatterns: RegExp[] }> = {
  instagram: {
    urlPatterns: [/challenge/i, /\/accounts\/login/],
    textPatterns: [/verify your identity/i, /suspicious login/i, /confirm your account/i],
  },
  tiktok: {
    urlPatterns: [/verify/i, /captcha/i],
    textPatterns: [/drag the slider/i, /fit the puzzle/i, /verify to continue/i, /verification/i],
  },
  youtube: {
    urlPatterns: [/accounts\.google\.com.*challenge/i, /consent\.google/i],
    textPatterns: [/verify it.*you/i, /confirm your identity/i, /unusual activity/i],
  },
  reddit: {
    urlPatterns: [/login/i],
    textPatterns: [/verify your email/i, /human verification/i],
  },
  twitter: {
    urlPatterns: [/\/i\/flow\/login/i, /\/account\/access/i],
    textPatterns: [/verify your identity/i, /confirm your phone/i, /suspicious activity/i],
  },
  threads: {
    urlPatterns: [/challenge/i, /\/accounts\/login/],
    textPatterns: [/verify your identity/i, /confirm your account/i],
  },
  pinterest: {
    urlPatterns: [/\/login/i],
    textPatterns: [/verify/i, /confirm your identity/i],
  },
};

/**
 * Check if the current page shows a CAPTCHA or verification challenge.
 * Returns true if CAPTCHA is detected.
 */
export async function detectCaptcha(page: Page, platform: string): Promise<boolean> {
  const patterns = CAPTCHA_PATTERNS[platform];
  if (!patterns) return false;

  // Check URL patterns
  const currentUrl = page.url();
  for (const urlPattern of patterns.urlPatterns) {
    if (urlPattern.test(currentUrl)) return true;
  }

  // Check page text patterns
  try {
    const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    for (const textPattern of patterns.textPatterns) {
      if (textPattern.test(bodyText)) return true;
    }
  } catch {
    // Page might not be loaded yet
  }

  return false;
}

/**
 * Check for CAPTCHA and throw if detected.
 * Takes a screenshot and leaves the browser open.
 */
export async function assertNoCaptcha(page: Page, platform: string): Promise<void> {
  const hasCaptcha = await detectCaptcha(page, platform);
  if (hasCaptcha) {
    const screenshotPath = `/tmp/captcha-${platform}-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath }).catch(() => {});
    console.error(
      `[${platform}] CAPTCHA/verification detected! Screenshot: ${screenshotPath}\n` +
        `Browser left open — solve it manually, then restart the scheduler.`,
    );
    throw new CaptchaDetectedError(platform);
  }
}
