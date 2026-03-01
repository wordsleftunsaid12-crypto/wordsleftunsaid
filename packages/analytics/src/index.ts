import 'dotenv/config';

const command = process.argv[2];

async function main(): Promise<void> {
  switch (command) {
    case 'collect': {
      const { collectInstagramMetrics } = await import('./collectors/instagram.js');
      await collectInstagramMetrics();
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

    default:
      console.log('Usage: tsx src/index.ts <command> [days]');
      console.log('\nCommands:');
      console.log('  collect           Collect metrics from Instagram');
      console.log('  report [days]     Generate engagement report (default: 30 days)');
      console.log('  strategy [days]   Generate strategy brief from performance data');
      console.log('  learn             Run full learn cycle (collect + analyze + strategy)');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
