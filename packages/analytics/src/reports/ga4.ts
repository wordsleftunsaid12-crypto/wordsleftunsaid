/**
 * GA4 Data API integration for pulling website analytics into daily summaries.
 *
 * Setup (one-time, free):
 * 1. Go to https://console.cloud.google.com → Create project (or use existing)
 * 2. Enable "Google Analytics Data API"
 * 3. Create a Service Account → download JSON key
 * 4. In GA4 Admin → Property Access → add the service account email as "Viewer"
 * 5. Save the JSON key to ~/.wlu-ga4-credentials.json
 * 6. Set GA4_PROPERTY_ID in .env (numeric ID from GA4 Admin → Property Settings)
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

const CREDENTIALS_PATH = resolve(process.env.HOME ?? '.', '.wlu-ga4-credentials.json');
const PROPERTY_ID = process.env.GA4_PROPERTY_ID ?? '';

export interface WebsiteMetrics {
  visitors: number;
  sessions: number;
  pageviews: number;
  topSources: { source: string; count: number }[];
  topPages: { path: string; count: number }[];
}

function isConfigured(): boolean {
  return PROPERTY_ID !== '' && existsSync(CREDENTIALS_PATH);
}

function createClient(): BetaAnalyticsDataClient {
  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  return new BetaAnalyticsDataClient({ credentials });
}

/**
 * Fetch website metrics for a given date range.
 * Returns null if GA4 is not configured.
 */
export async function getWebsiteMetrics(
  startDate: string = 'today',
  endDate: string = 'today',
): Promise<WebsiteMetrics | null> {
  if (!isConfigured()) return null;

  const client = createClient();
  const propertyId = `properties/${PROPERTY_ID}`;

  // Main metrics
  const [metricsResponse] = await client.runReport({
    property: propertyId,
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
    ],
  });

  const row = metricsResponse.rows?.[0];
  const visitors = Number(row?.metricValues?.[0]?.value ?? '0');
  const sessions = Number(row?.metricValues?.[1]?.value ?? '0');
  const pageviews = Number(row?.metricValues?.[2]?.value ?? '0');

  // Top traffic sources
  const [sourcesResponse] = await client.runReport({
    property: propertyId,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionSource' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 5,
  });

  const topSources = (sourcesResponse.rows ?? []).map((r) => ({
    source: r.dimensionValues?.[0]?.value ?? '(unknown)',
    count: Number(r.metricValues?.[0]?.value ?? '0'),
  }));

  // Top pages
  const [pagesResponse] = await client.runReport({
    property: propertyId,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 5,
  });

  const topPages = (pagesResponse.rows ?? []).map((r) => ({
    path: r.dimensionValues?.[0]?.value ?? '/',
    count: Number(r.metricValues?.[0]?.value ?? '0'),
  }));

  return { visitors, sessions, pageviews, topSources, topPages };
}

/**
 * Fetch yesterday's metrics for comparison.
 */
export async function getYesterdayMetrics(): Promise<WebsiteMetrics | null> {
  return getWebsiteMetrics('yesterday', 'yesterday');
}

/**
 * Fetch last 7 days' average for comparison.
 */
export async function getWeekMetrics(): Promise<WebsiteMetrics | null> {
  return getWebsiteMetrics('7daysAgo', 'today');
}
