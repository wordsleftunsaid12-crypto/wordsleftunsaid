---
name: analytics-report
description: Generate an engagement analytics report
---

## Steps

1. Collect latest engagement data:
   ```bash
   npx tsx packages/analytics/src/index.ts collect
   ```

2. Generate the engagement report (default: last 30 days):
   ```bash
   npx tsx packages/analytics/src/index.ts report 30
   ```

3. For deeper analysis, run the strategy generation:
   ```bash
   npx tsx packages/analytics/src/index.ts strategy
   ```

4. For the full learn cycle (analyze + generate strategy brief):
   ```bash
   npx tsx packages/analytics/src/index.ts learn
   ```

5. Summarize key findings from the output.

## Key Files
- Engagement scoring: `packages/analytics/src/analysis/engagement.ts`
- Trend analysis: `packages/analytics/src/analysis/trends.ts`
- Strategy brief: `packages/analytics/src/feedback/strategy-brief.ts`
