/**
 * @deprecated — Engagement metrics collection has moved to packages/social/src/collectors/engagement.ts
 * Run: npx tsx packages/social/src/index.ts collect-metrics
 * This file is kept to avoid import errors from any remaining references.
 */
export async function collectInstagramMetrics(): Promise<number> {
  console.warn(
    '[collect] Instagram-only collection is deprecated.\n' +
      'Use: npx tsx packages/social/src/index.ts collect-metrics\n' +
      'This collects metrics for ALL platforms.',
  );
  return 0;
}
