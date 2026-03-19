# TODOS

## P2: CTA Conversion Tracking
**What:** Add a 'source' field to message submissions that captures where the submitter came from (UTM params from social links or a dropdown). Add 'Submissions by Source' section to daily summary.
**Why:** Closes the feedback loop between content performance and community growth. Without this, you can't tell which platform/format drives actual submissions.
**Effort:** S (human: ~1 day / CC: ~30 min)
**Depends on:** Content Format Lab shipping and generating audience growth. Not useful until submissions exceed ~5/week.
**Files:** `packages/website/src/pages/submit.astro`, `packages/shared/src/db/messages.ts`, `packages/analytics/src/reports/daily-summary.ts`
**Added:** 2026-03-19 (CEO Review — deferred from cherry-pick ceremony)

## P1: Intelligence & Automation (Phase 3)
**What:** Build competitive research scraper with self-healing selectors, auto-weight adjustment system (shifts template distribution toward winners after 2 weeks of data, 10% minimum floor per template), and configure Brevo email notifications (API key + sender email — code already exists).
**Why:** Scraper provides data-driven competitive intelligence. Auto-weight makes the system self-optimizing — true passive operation. Email notifications retain message submitters by notifying them when their message goes live or gets its first like.
**Effort:** M (human: ~1 week / CC: ~2 hours)
**Depends on:** Content Format Lab Phase 1+2 shipping and 2+ weeks of template performance data (auto-weight needs engagement signal to optimize against).
**Files:** New scraper module, `packages/content-engine/src/config/template-weights.ts` (auto-weight reads/writes), `packages/shared/src/config/env.ts` (Brevo env vars), `packages/analytics/src/reports/daily-summary.ts` (scraper insights section)
**Added:** 2026-03-19 (Eng Review — deferred from Phase 1+2 scope)
