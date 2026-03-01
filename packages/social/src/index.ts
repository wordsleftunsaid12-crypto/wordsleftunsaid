import 'dotenv/config';

const command = process.argv[2];
const flags = process.argv.slice(3);
const dryRun = flags.includes('--dry-run');
const platform = (flags.find((f) => f.startsWith('--platform='))?.split('=')[1] ?? 'instagram') as
  'instagram' | 'tiktok';

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
      const { runOutboundSession } = await import('./engagement/outbound.js');
      await runOutboundSession({ dryRun });
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
      console.log('  post       Publish the next scheduled item');
      console.log('  schedule   Start the full automation scheduler');
      console.log('  ingest     Scan for new videos from content-engine');
      console.log('  caption    Generate captions for pending items');
      console.log('  engage     Reply to comments on recent posts');
      console.log('  outbound   Like/follow/comment on related accounts');
      console.log('  status     Show content queue status');
      console.log('\nFlags:');
      console.log('  --dry-run            Log actions without executing');
      console.log('  --platform=instagram  Target platform (default: instagram)');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
