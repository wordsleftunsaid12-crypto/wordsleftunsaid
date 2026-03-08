import 'dotenv/config';

const command = process.argv[2];
const flags = process.argv.slice(3);
const dryRun = flags.includes('--dry-run');
const platform = (flags.find((f) => f.startsWith('--platform='))?.split('=')[1] ?? 'instagram') as
  'instagram' | 'tiktok' | 'youtube';

async function main(): Promise<void> {
  switch (command) {
    case 'post': {
      const { publishNextScheduled } = await import('./scheduler/publish-job.js');
      await publishNextScheduled({ platform, dryRun });
      break;
    }

    case 'schedule': {
      const { startScheduler } = await import('./scheduler/scheduler.js');
      await startScheduler({ platform, dryRun });
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
      } else {
        const { runOutboundSession } = await import('./engagement/outbound.js');
        await runOutboundSession({ dryRun });
      }
      break;
    }

    case 'unfollow': {
      const { runUnfollowSession } = await import('./engagement/unfollow.js');
      const maxUnfollows = parseInt(flags.find((f) => f.startsWith('--max='))?.split('=')[1] ?? '15', 10);
      await runUnfollowSession({ dryRun, maxUnfollows });
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
      console.log('  unfollow       Unfollow non-followers on Instagram');
      console.log('  followers      Scrape follower counts from all platforms');
      console.log('  seed-messages  Seed website with new anonymous messages');
      console.log('  status         Show content queue status');
      console.log('\nFlags:');
      console.log('  --dry-run            Log actions without executing');
      console.log('  --platform=instagram  Target platform (instagram|tiktok|youtube)');
      console.log('  --count=2            Number of messages to seed (seed-messages)');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
