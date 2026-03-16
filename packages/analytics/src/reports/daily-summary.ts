/**
 * Daily summary report — aggregates followers, engagement, posts, and verification
 * into a formatted console report with trend analysis.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getFollowerHistory,
  getTodayPosts,
  getRecentPosts,
  getOutboundEngagementCountToday,
  getContentQueue,
} from '@wlu/shared';
import type { Platform } from '@wlu/shared';
import { getWebsiteMetrics, getYesterdayMetrics } from './ga4.js';

const ALL_PLATFORMS: Platform[] = [
  'instagram', 'tiktok', 'youtube',
  'reddit', 'pinterest', 'twitter', 'threads',
];

const SUMMARY_DIR = resolve(process.env.HOME ?? '.', '.wlu-daily-summaries');

interface PlatformFollowers {
  platform: Platform;
  current: number;
  changeToday: number;
  changeWeek: number;
}

interface DailySummaryData {
  date: string;
  followers: PlatformFollowers[];
  totalFollowers: number;
  followerChangeToday: number;
  followerChangeWeek: number;
  postsToday: number;
  postsByPlatform: Record<string, number>;
  verification: {
    verified: number;
    failed: number;
    unchecked: number;
    failedPlatforms: string[];
  };
}

/**
 * Load a previous day's summary for trend comparison.
 */
function loadSummary(date: string): DailySummaryData | null {
  const path = resolve(SUMMARY_DIR, `${date}.json`);
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as DailySummaryData;
  } catch {
    return null;
  }
}

/**
 * Save today's summary for future trend comparison.
 */
function saveSummary(data: DailySummaryData): void {
  if (!existsSync(SUMMARY_DIR)) {
    mkdirSync(SUMMARY_DIR, { recursive: true });
  }
  const path = resolve(SUMMARY_DIR, `${data.date}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Get the most recent follower count for a platform.
 */
async function getLatestFollowerCount(platform: Platform): Promise<number> {
  const history = await getFollowerHistory(platform, 1);
  if (history.length === 0) return 0;
  return history[history.length - 1].followerCount;
}

/**
 * Get follower count from N days ago.
 */
async function getFollowerCountDaysAgo(platform: Platform, days: number): Promise<number> {
  const history = await getFollowerHistory(platform, days + 1);
  if (history.length === 0) return 0;
  // Find the snapshot closest to N days ago
  const targetTime = Date.now() - days * 86400000;
  let closest = history[0];
  for (const snap of history) {
    if (Math.abs(new Date(snap.measuredAt).getTime() - targetTime) <
        Math.abs(new Date(closest.measuredAt).getTime() - targetTime)) {
      closest = snap;
    }
  }
  return closest.followerCount;
}

function arrow(change: number): string {
  if (change > 0) return '\u25B2'; // ▲
  if (change < 0) return '\u25BC'; // ▼
  return '\u2014'; // —
}

function changeStr(change: number): string {
  if (change === 0) return '+0';
  return change > 0 ? `+${change}` : `${change}`;
}

/**
 * Generate and print the daily summary report.
 */
export async function generateDailySummary(): Promise<void> {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const displayDate = today.toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  console.log('');
  console.log('\u2550'.repeat(50));
  console.log(`  DAILY SUMMARY \u2014 ${displayDate}`);
  console.log('\u2550'.repeat(50));

  // --- Followers ---
  const followerData: PlatformFollowers[] = [];
  let totalFollowers = 0;
  let totalChangeToday = 0;
  let totalChangeWeek = 0;

  for (const platform of ALL_PLATFORMS) {
    const current = await getLatestFollowerCount(platform);
    const yesterday = await getFollowerCountDaysAgo(platform, 1);
    const weekAgo = await getFollowerCountDaysAgo(platform, 7);

    const changeToday = current - yesterday;
    const changeWeek = current - weekAgo;

    followerData.push({ platform, current, changeToday, changeWeek });
    totalFollowers += current;
    totalChangeToday += changeToday;
    totalChangeWeek += changeWeek;
  }

  console.log('');
  console.log(`  FOLLOWERS (total: ${totalFollowers}, ${changeStr(totalChangeToday)} today)`);
  console.log('  ' + '\u2500'.repeat(40));

  for (const f of followerData) {
    const name = f.platform.padEnd(12);
    const count = String(f.current).padStart(6);
    const change = `(${changeStr(f.changeToday)})`.padStart(7);
    const trend = arrow(f.changeToday);
    console.log(`  ${name} ${count}  ${change}    ${trend}`);
  }

  // --- Posts Today ---
  const todayPosts = await getTodayPosts();
  const postsByPlatform: Record<string, number> = {};
  for (const post of todayPosts) {
    postsByPlatform[post.platform] = (postsByPlatform[post.platform] ?? 0) + 1;
  }

  console.log('');
  console.log('  POSTS TODAY');
  console.log('  ' + '\u2500'.repeat(40));
  console.log(`  Total:    ${todayPosts.length}`);
  for (const [platform, count] of Object.entries(postsByPlatform).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${platform.padEnd(12)} ${count}`);
  }

  // --- Verification ---
  const recentPosts = await getRecentPosts(1, { limit: 100 });
  let verified = 0;
  let verifiedFalse = 0;
  let unchecked = 0;
  const failedPlatforms: string[] = [];

  for (const post of recentPosts) {
    if (post.verified === true) verified++;
    else if (post.verified === false) {
      verifiedFalse++;
      if (!failedPlatforms.includes(post.platform)) {
        failedPlatforms.push(post.platform);
      }
    }
    else unchecked++;
  }

  console.log('');
  console.log('  VERIFICATION');
  console.log('  ' + '\u2500'.repeat(40));
  console.log(`  Verified: ${verified}/${recentPosts.length}    Failed: ${verifiedFalse}${failedPlatforms.length > 0 ? ` (${failedPlatforms.join(', ')})` : ''}    Pending: ${unchecked}`);

  // --- Outbound Engagement ---
  const likes = await getOutboundEngagementCountToday('like');
  const follows = await getOutboundEngagementCountToday('follow');
  const comments = await getOutboundEngagementCountToday('comment');

  console.log('');
  console.log('  OUTBOUND ENGAGEMENT');
  console.log('  ' + '\u2500'.repeat(40));
  console.log(`  Likes:      ${likes}`);
  console.log(`  Follows:    ${follows}`);
  console.log(`  Comments:   ${comments}`);

  // --- Content Queue ---
  const scheduled = await getContentQueue({ status: 'scheduled', limit: 100 });
  const captioned = await getContentQueue({ status: 'captioned', limit: 100 });
  const pending = await getContentQueue({ status: 'pending', limit: 100 });
  const qaPassed = await getContentQueue({ status: 'qa_passed', limit: 100 });

  console.log('');
  console.log('  CONTENT QUEUE');
  console.log('  ' + '\u2500'.repeat(40));
  console.log(`  Scheduled:  ${scheduled.length}`);
  console.log(`  Captioned:  ${captioned.length}`);
  console.log(`  QA passed:  ${qaPassed.length}`);
  console.log(`  Pending:    ${pending.length}`);

  // --- Trends ---
  console.log('');
  console.log('  TRENDS');
  console.log('  ' + '\u2500'.repeat(40));
  console.log(`  Followers vs yesterday:  ${arrow(totalChangeToday)} ${changeStr(totalChangeToday)}`);
  console.log(`  Followers vs last week:  ${arrow(totalChangeWeek)} ${changeStr(totalChangeWeek)}`);

  // Website analytics
  console.log('');
  console.log('  WEBSITE (wordsleftunsent.com)');
  console.log('  ' + '\u2500'.repeat(40));

  const todayWeb = await getWebsiteMetrics('today', 'today');
  const yesterdayWeb = await getYesterdayMetrics();

  if (todayWeb) {
    const visitorChange = yesterdayWeb ? todayWeb.visitors - yesterdayWeb.visitors : 0;
    const pvChange = yesterdayWeb ? todayWeb.pageviews - yesterdayWeb.pageviews : 0;

    console.log(`  Visitors:    ${String(todayWeb.visitors).padStart(4)}  ${yesterdayWeb ? `(${changeStr(visitorChange)} vs yesterday)` : ''}`);
    console.log(`  Pageviews:   ${String(todayWeb.pageviews).padStart(4)}  ${yesterdayWeb ? `(${changeStr(pvChange)} vs yesterday)` : ''}`);

    if (todayWeb.topSources.length > 0) {
      const srcStr = todayWeb.topSources
        .map((s) => `${s.source} (${s.count})`)
        .join(', ');
      console.log(`  Top sources: ${srcStr}`);
    }

    if (todayWeb.topPages.length > 0) {
      const pageStr = todayWeb.topPages
        .map((p) => `${p.path} (${p.count})`)
        .join(', ');
      console.log(`  Top pages:   ${pageStr}`);
    }
  } else {
    console.log('  GA4 not configured \u2014 set GA4_PROPERTY_ID in .env');
    console.log('  and save service account key to ~/.wlu-ga4-credentials.json');
  }

  console.log('');
  console.log('\u2550'.repeat(50));

  // Save summary data for trend comparison
  const summaryData: DailySummaryData = {
    date: dateStr,
    followers: followerData,
    totalFollowers,
    followerChangeToday: totalChangeToday,
    followerChangeWeek: totalChangeWeek,
    postsToday: todayPosts.length,
    postsByPlatform,
    verification: {
      verified,
      failed: verifiedFalse,
      unchecked,
      failedPlatforms,
    },
  };

  saveSummary(summaryData);
  console.log(`\n  Summary saved to ${SUMMARY_DIR}/${dateStr}.json`);
}
