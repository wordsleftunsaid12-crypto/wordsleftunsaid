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

## P2: Homepage Pagination / Infinite Scroll
**What:** Replace the 31-message full render with "Load more" or infinite scroll. Currently all messages render at once, creating a 6443px page on desktop (13340px on mobile).
**Why:** Reduces initial payload and improves perceived performance. Also reduces layout shift from IntersectionObserver fade-in on 31 cards.
**Effort:** S (human: ~4 hours / CC: ~20 min)
**Depends on:** Nothing — standalone improvement.
**Files:** `packages/website/src/pages/index.astro`, possibly new `packages/website/src/components/LoadMore.astro`
**Added:** 2026-03-19 (Design Review — DEFERRED-001)

## P3: Above-fold Cards Visible on Load
**What:** Add `.visible` class server-side to the first 3-4 message cards so they don't start at `opacity: 0` waiting for IntersectionObserver. Above-fold content should be immediately visible.
**Why:** First impression suffers when the top cards fade in with a delay — users see a blank messages section for ~200ms.
**Effort:** S (human: ~1 hour / CC: ~10 min)
**Depends on:** Nothing — standalone improvement.
**Files:** `packages/website/src/pages/index.astro` (add `.visible` class to first N `.fade-in` children)
**Added:** 2026-03-19 (Design Review — DEFERRED-003)
