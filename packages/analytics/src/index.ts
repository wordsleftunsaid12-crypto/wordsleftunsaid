import 'dotenv/config';
import { pathWithHomebrew } from '@wlu/shared';

const command = process.argv[2];

async function main(): Promise<void> {
  switch (command) {
    case 'collect': {
      // Collect engagement metrics — delegates to social package CLI
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const exec = promisify(execFile);
      const platformArg = process.argv[3] ? `--platform=${process.argv[3]}` : '';
      const args = ['tsx', 'packages/social/src/index.ts', 'collect-metrics'];
      if (platformArg) args.push(platformArg);
      const result = await exec('npx', args, {
        cwd: process.cwd(),
        env: { ...process.env, PATH: pathWithHomebrew() },
        timeout: 10 * 60 * 1000,
      });
      if (result.stdout) console.log(result.stdout);
      if (result.stderr) console.error(result.stderr);
      break;
    }

    case 'engagement-report': {
      const { generateEngagementReport } = await import('./reports/engagement-report.js');
      const daysBack = Number(process.argv[3]) || 30;
      await generateEngagementReport(daysBack);
      break;
    }

    case 'report': {
      const { generateEngagementSummary } = await import('./analysis/engagement.js');
      const { getFollowerGrowth } = await import('./collectors/followers.js');
      const { analyzeTrends } = await import('./analysis/trends.js');

      const daysBack = Number(process.argv[3]) || 30;

      console.log(`\n--- Engagement Report (last ${daysBack} days) ---\n`);

      const summary = await generateEngagementSummary(daysBack);
      console.log(`Posts: ${summary.totalPosts}`);
      console.log(`Avg likes: ${summary.avgLikes.toFixed(1)}`);
      console.log(`Avg comments: ${summary.avgComments.toFixed(1)}`);
      console.log(`Avg views: ${summary.avgViews.toFixed(0)}`);
      console.log(`Avg saves: ${summary.avgSaves.toFixed(1)}`);
      console.log(`Engagement rate: ${(summary.engagementRate * 100).toFixed(2)}%`);
      console.log(`Best mood: ${summary.bestPerformingMood ?? 'N/A'}`);
      console.log(`Best template: ${summary.bestPerformingTemplate ?? 'N/A'}`);
      console.log(`Best hour: ${summary.bestPostingHour ?? 'N/A'}`);

      const growth = await getFollowerGrowth('instagram', daysBack);
      console.log(`\nFollower growth: ${growth.netGrowth} (${(growth.growthRate * 100).toFixed(1)}%)`);
      console.log(`Avg daily growth: ${growth.avgDailyGrowth.toFixed(1)}`);

      const trends = await analyzeTrends(daysBack);
      if (trends.byMood.length > 0) {
        console.log('\nTop moods:');
        for (const t of trends.byMood.slice(0, 3)) {
          console.log(`  ${t.value}: score ${t.avgScore.toFixed(4)} (${t.postCount} posts)`);
        }
      }
      break;
    }

    case 'strategy': {
      const { generateStrategyBrief } = await import('./feedback/strategy-brief.js');
      const daysBack = Number(process.argv[3]) || 30;
      await generateStrategyBrief(daysBack);
      break;
    }

    case 'learn': {
      const { generateStrategyBrief } = await import('./feedback/strategy-brief.js');
      console.log('\n--- Running Learn Cycle ---\n');
      console.log('Step 1: Generating strategy brief...');
      const brief = await generateStrategyBrief();
      console.log('\nStrategy brief generated:');
      console.log(JSON.stringify(brief, null, 2));
      break;
    }

    case 'daily-summary': {
      const { generateDailySummary } = await import('./reports/daily-summary.js');
      await generateDailySummary();
      break;
    }

    case 'learn-weights': {
      const { computeLearnedWeights } = await import('./feedback/compute-weights.js');
      const { saveLearnedWeights } = await import('./feedback/weights-store.js');

      // Inline copy of default weights — avoids cross-package import from content-engine
      const defaultWeights: Record<string, Array<[string, number]>> = {
        instagram: [['CinematicVertical', 0.27], ['DeletedTextVertical', 0.25], ['SplitScreenVertical', 0.19], ['HandwritingSVGVertical', 0.15], ['TextOnGradientVertical', 0.14]],
        tiktok: [['DeletedTextVertical', 0.33], ['CinematicVertical', 0.22], ['SplitScreenVertical', 0.19], ['TextOnGradientVertical', 0.13], ['HandwritingSVGVertical', 0.13]],
        youtube: [['CinematicVertical', 0.34], ['HandwritingSVGVertical', 0.27], ['SplitScreenVertical', 0.23], ['DeletedTextVertical', 0.16]],
        reddit: [['RawTextVertical', 0.58], ['SplitScreenVertical', 0.24], ['DeletedTextVertical', 0.18]],
        pinterest: [['QuoteCardVertical', 0.60], ['HandwritingSVGVertical', 0.25], ['CinematicVertical', 0.15]],
        twitter: [['RawTextVertical', 0.40], ['DeletedTextVertical', 0.27], ['SplitScreenVertical', 0.23], ['CinematicVertical', 0.10]],
      };

      console.log('\n--- Computing Template Weights from Engagement Data ---\n');
      const learned = await computeLearnedWeights(defaultWeights);
      saveLearnedWeights(learned);

      for (const [platform, weights] of Object.entries(learned.platforms)) {
        const samples = learned.sampleCounts[platform] ?? {};
        const totalSamples = Object.values(samples).reduce((a, b) => a + b, 0);
        const weightStr = weights
          .map(([t, w]: [string, number]) => `${t.replace('Vertical', '')}=${(w * 100).toFixed(0)}%`)
          .join(', ');
        console.log(`  ${platform}: ${weightStr} (${totalSamples} posts with metrics)`);
      }
      break;
    }

    default:
      console.log('Usage: tsx src/index.ts <command> [days]');
      console.log('\nCommands:');
      console.log('  collect [platform]    Collect engagement metrics from all (or one) platforms');
      console.log('  engagement-report     Full engagement breakdown (by platform, template, mood, time)');
      console.log('  report [days]         Quick engagement summary (default: 30 days)');
      console.log('  strategy [days]       Generate strategy brief from performance data');
      console.log('  learn                 Run full learn cycle (collect + analyze + strategy)');
      console.log('  learn-weights         Compute template weights from engagement data');
      console.log('  daily-summary         Generate daily summary with followers, posts, and trends');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
