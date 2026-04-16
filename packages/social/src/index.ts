import 'dotenv/config';
import type { Platform } from '@wlu/shared';

const command = process.argv[2];
const flags = process.argv.slice(3);
const dryRun = flags.includes('--dry-run');
const platformFlag = flags.find((f) => f.startsWith('--platform='))?.split('=')[1] as Platform | undefined;
const platform: Platform = platformFlag ?? 'instagram';

async function main(): Promise<void> {
  switch (command) {
    case 'post': {
      const { publishNextScheduled } = await import('./scheduler/publish-job.js');
      await publishNextScheduled({ platform, dryRun });
      break;
    }

    case 'schedule': {
      const { startScheduler } = await import('./scheduler/scheduler.js');
      // When no --platform flag given, run across all platforms
      if (platformFlag === 'threads') {
        console.error('Threads is disabled.');
        process.exit(1);
      }
      await startScheduler({ platform: platformFlag, dryRun });
      break;
    }

    case 'ingest': {
      const { ingestNewVideos } = await import('./ingest.js');
      await ingestNewVideos({ platform, dryRun });
      break;
    }

    case 'caption': {
      const { captionPendingItems } = await import('./captions/generate.js');
      await captionPendingItems({ platform, dryRun });
      break;
    }

    case 'engage': {
      const { runCommentResponder } = await import('./engagement/comment-responder.js');
      await runCommentResponder({ dryRun });
      break;
    }

    case 'outbound': {
      if (platform === 'tiktok') {
        const { runTikTokOutboundSession } = await import('./engagement/outbound-tiktok.js');
        await runTikTokOutboundSession({ dryRun });
      } else if (platform === 'youtube') {
        const { runYouTubeOutboundSession } = await import('./engagement/outbound-youtube.js');
        await runYouTubeOutboundSession({ dryRun });
      } else if (platform === 'reddit') {
        const { runRedditOutboundSession } = await import('./engagement/outbound-reddit.js');
        await runRedditOutboundSession({ dryRun });
      } else if (platform === 'twitter') {
        const { runTwitterOutboundSession } = await import('./engagement/outbound-twitter.js');
        await runTwitterOutboundSession({ dryRun });
      } else {
        const { runOutboundSession } = await import('./engagement/outbound.js');
        await runOutboundSession({ dryRun });
      }
      break;
    }

    case 'unfollow': {
      const maxUnfollows = parseInt(flags.find((f) => f.startsWith('--max='))?.split('=')[1] ?? '15', 10);
      const target: Platform | 'all' = platformFlag ?? 'all';

      if (target === 'all' || target === 'instagram') {
        const { runUnfollowSession } = await import('./engagement/unfollow.js');
        await runUnfollowSession({ dryRun, maxUnfollows });
      }
      if (target === 'all' || target === 'tiktok') {
        const { runTikTokUnfollowSession } = await import('./engagement/unfollow-tiktok.js');
        await runTikTokUnfollowSession({ dryRun, maxUnfollows: Math.min(maxUnfollows, 10) });
      }
      if (target === 'all' || target === 'youtube') {
        const { runYouTubeUnsubscribeSession } = await import('./engagement/unfollow-youtube.js');
        await runYouTubeUnsubscribeSession({ dryRun, maxUnsubscribes: Math.min(maxUnfollows, 5) });
      }
      break;
    }

    case 'followers': {
      const { collectAllFollowerSnapshots } = await import('./collectors/followers.js');
      await collectAllFollowerSnapshots();
      break;
    }

    case 'seed-messages': {
      const { seedDailyMessages } = await import('./content/message-seeder.js');
      const count = parseInt(flags.find((f) => f.startsWith('--count='))?.split('=')[1] ?? '2', 10);
      await seedDailyMessages({ count, dryRun });
      break;
    }

    case 'collect-metrics': {
      const { collectEngagementMetrics } = await import('./collectors/engagement.js');
      const platforms = platformFlag ? [platformFlag] : undefined;
      await collectEngagementMetrics({ platforms });
      break;
    }

    case 'status': {
      const { getQueueStatus } = await import('./scheduler/queue.js');
      const status = await getQueueStatus(platform);
      console.log('\nContent Queue Status:');
      console.log(`  Pending:    ${status.pending}`);
      console.log(`  QA Passed:  ${status.qa_passed}`);
      console.log(`  Captioned:  ${status.captioned}`);
      console.log(`  Scheduled:  ${status.scheduled}`);
      console.log(`  Posted:     ${status.posted}`);
      console.log(`  Failed:     ${status.failed}`);
      break;
    }

    default:
      console.log('Usage: tsx src/index.ts <command> [flags]');
      console.log('\nCommands:');
      console.log('  post           Publish the next scheduled item');
      console.log('  schedule       Start the full automation scheduler');
      console.log('  ingest         Scan for new videos from content-engine');
      console.log('  caption        Generate captions for pending items');
      console.log('  engage         Reply to comments on recent posts');
      console.log('  outbound       Like/follow/comment on related accounts');
      console.log('  unfollow       Unfollow non-followers (Instagram, TikTok, YouTube)');
      console.log('  collect-metrics Scrape engagement metrics from all platforms');
      console.log('  followers      Scrape follower counts from all platforms');
      console.log('  seed-messages  Seed website with new anonymous messages');
      console.log('  status         Show content queue status');
      console.log('\nFlags:');
      console.log('  --dry-run            Log actions without executing');
      console.log('  --platform=instagram  Target platform (instagram|tiktok|youtube|reddit|twitter|pinterest)');
      console.log('  --count=2            Number of messages to seed (seed-messages)');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
