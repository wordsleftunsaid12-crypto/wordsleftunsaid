# @wlu/social

Platform-specific social media posting automation.

## Supported Platforms

- Instagram (Reels + Feed posts via Graph API)
- TikTok (Video posts via TikTok API)

## Structure

- `src/platforms/<name>/` — Platform-specific client, publish, auth modules
- `src/scheduler/` — Posting queue and cron scheduling
- `src/captions/` — AI-generated captions and hashtag strategy

## Conventions

- Each platform module is self-contained with its own auth flow
- OAuth tokens stored securely via env vars
- Posting is idempotent: track posted content IDs to avoid duplicates
- Rate limiting: respect each platform's API limits
- Captions generated via Claude API with platform-specific tone
