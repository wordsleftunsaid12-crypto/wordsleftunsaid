import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderVideo, isCinematic, ensureBundle, copyToBundle } from './pipeline/render.js';
import type { CompositionId } from './pipeline/render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../output');
const PUBLIC_DIR = path.resolve(__dirname, '../public');

const command = process.argv[2];

async function prepareBgVideo(
  mood: 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw',
  template: string,
): Promise<string> {
  const { prepareBackgroundVideo } = await import('./pipeline/video-assets.js');
  const { VIDEO_PRESETS } = await import('@wlu/shared');
  const { mkdirSync, copyFileSync } = await import('fs');

  const isVertical = template.includes('Vertical');
  const preset = isVertical ? VIDEO_PRESETS['9:16'] : VIDEO_PRESETS['1:1'];
  const processedPath = await prepareBackgroundVideo(mood, preset.width, preset.height);

  mkdirSync(PUBLIC_DIR, { recursive: true });
  const bgFilename = path.basename(processedPath);
  copyFileSync(processedPath, path.join(PUBLIC_DIR, bgFilename));
  // Also copy into cached Remotion bundle so it's served for subsequent renders
  copyToBundle(processedPath, bgFilename);

  return bgFilename;
}

async function main() {
  switch (command) {
    case 'render': {
      const template = (process.argv[3] || 'CinematicVertical') as CompositionId;
      const from = process.argv[4] || 'Me';
      const to = process.argv[5] || 'You';
      const content =
        process.argv[6] ||
        'I never told you how much you meant to me. Every day I think about what I should have said.';
      const mood = process.argv[7] || 'bittersweet';

      const timestamp = Date.now();
      const outputPath = path.join(OUTPUT_DIR, `${template}-${timestamp}.mp4`);

      console.log(`\nRendering "${template}"...`);
      console.log(`  From: ${from}`);
      console.log(`  To: ${to}`);
      console.log(`  Content: ${content}\n`);

      let backgroundVideo: string | undefined;

      if (isCinematic(template)) {
        console.log(`Preparing background video (mood: ${mood})...`);
        await ensureBundle();
        backgroundVideo = await prepareBgVideo(
          mood as 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw',
          template,
        );
      }

      await renderVideo({
        compositionId: template,
        props: { from, to, content, backgroundVideo },
        outputPath,
      });

      console.log('\nDone!');
      break;
    }

    case 'curate': {
      const { fetchAndCurate } = await import('./ai/curate.js');
      console.log('\nCurating messages from database...\n');
      const result = await fetchAndCurate();
      console.log(`Found ${result.total} messages, selected ${result.selected.length}:\n`);
      for (const s of result.selected) {
        console.log(`  [${s.mood}] "${s.message.content}" (${s.reason})`);
      }
      break;
    }

    case 'batch': {
      const { fetchAndCurate } = await import('./ai/curate.js');
      const template = (process.argv[3] || 'CinematicVertical') as CompositionId;

      console.log('\nBatch mode: curating messages then rendering videos...\n');
      const result = await fetchAndCurate();

      if (result.selected.length === 0) {
        console.log('No messages selected for rendering.');
        break;
      }

      for (const s of result.selected) {
        const timestamp = Date.now();
        const outputPath = path.join(OUTPUT_DIR, `${template}-${timestamp}.mp4`);

        console.log(`\nRendering [${s.mood}]: "${s.message.content}"`);

        let backgroundVideo: string | undefined;

        if (isCinematic(template)) {
          console.log(`  Preparing background video (mood: ${s.mood})...`);
          await ensureBundle();
          backgroundVideo = await prepareBgVideo(
            s.mood as 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw',
            template,
          );
        }

        await renderVideo({
          compositionId: template,
          props: {
            from: s.message.from,
            to: s.message.to,
            content: s.message.content,
            backgroundVideo,
          },
          outputPath,
        });
      }

      console.log(`\nBatch complete! Rendered ${result.selected.length} videos.`);
      break;
    }

    case 'render-next': {
      const template = (process.argv[3] || 'CinematicVertical') as CompositionId;
      const count = Math.min(parseInt(process.argv[4] || '1', 10), 5);

      const { getApprovedMessages, getUsedMessageIds } = await import('@wlu/shared');

      console.log('\nFetching unused messages...');
      const [allMessages, usedIds] = await Promise.all([
        getApprovedMessages({ limit: 50 }),
        getUsedMessageIds(),
      ]);

      const usedSet = new Set(usedIds);
      const unused = allMessages.filter((m) => !usedSet.has(m.id));

      if (unused.length === 0) {
        console.log('All approved messages have been used! Add new messages or clear the queue.');
        break;
      }

      // Prefer messages under 150 chars for best video readability
      const shortMessages = unused.filter((m) => m.content.length <= 150);
      const candidates = shortMessages.length > 0 ? shortMessages : unused;

      // Shuffle and pick up to `count`
      const shuffled = candidates.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, count);

      console.log(`Found ${unused.length} unused messages, rendering ${selected.length}...\n`);

      const moods: Array<'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw'> = [
        'tender', 'regretful', 'hopeful', 'bittersweet', 'raw',
      ];

      for (const msg of selected) {
        const timestamp = Date.now();
        const outputPath = path.join(OUTPUT_DIR, `${template}-${timestamp}.mp4`);
        const mood = moods[Math.floor(Math.random() * moods.length)];

        console.log(`Rendering: "${msg.content.slice(0, 80)}..."`);
        console.log(`  From: ${msg.from} → To: ${msg.to} | Mood: ${mood}`);

        let backgroundVideo: string | undefined;

        if (isCinematic(template)) {
          console.log('  Preparing background video...');
          await ensureBundle();
          backgroundVideo = await prepareBgVideo(mood, template);
        }

        await renderVideo({
          compositionId: template,
          props: { from: msg.from, to: msg.to, content: msg.content, backgroundVideo },
          outputPath,
        });

        // Record the message ID in the content queue so it won't be picked again
        const { createContentQueueItem } = await import('@wlu/shared');
        await createContentQueueItem({
          videoPath: outputPath,
          messageIds: [msg.id],
          template,
          mood,
          platform: 'instagram',
          isExploration: false,
        });
        console.log(`  Queued with message ID tracked.\n`);
      }

      console.log(`Done! Rendered ${selected.length} video(s) from unique messages.`);
      break;
    }

    case 'rerender-pending': {
      const {
        getContentQueue,
        getMessageById,
        updateContentQueueStatus,
      } = await import('@wlu/shared');

      console.log('\nFetching pending queue items for re-render...');
      const pendingItems = await getContentQueue({ status: 'pending' });

      if (pendingItems.length === 0) {
        console.log('No pending items to re-render.');
        break;
      }

      console.log(`Found ${pendingItems.length} pending item(s). Re-rendering...\n`);

      for (const item of pendingItems) {
        // Fetch the original message content
        let msgFrom = 'Me';
        let msgTo = 'You';
        let msgContent = '';
        if (item.messageIds.length > 0) {
          const msg = await getMessageById(item.messageIds[0]);
          if (msg) {
            msgFrom = msg.from;
            msgTo = msg.to;
            msgContent = msg.content;
          }
        }

        if (!msgContent) {
          console.log(`  Skipping ${item.id.slice(0, 8)} — no message content found`);
          continue;
        }

        const template = (item.template || 'CinematicVertical') as CompositionId;
        const mood = (item.mood || 'bittersweet') as 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw';
        const timestamp = Date.now();
        const newOutputPath = path.join(OUTPUT_DIR, `${template}-${timestamp}.mp4`);

        console.log(`  Re-rendering ${item.id.slice(0, 8)}: "${msgContent.slice(0, 60)}..."`);
        console.log(`    Template: ${template} | Mood: ${mood}`);

        let backgroundVideo: string | undefined;

        if (isCinematic(template)) {
          console.log('    Preparing background video...');
          await ensureBundle();
          backgroundVideo = await prepareBgVideo(mood, template);
        }

        await renderVideo({
          compositionId: template,
          props: { from: msgFrom, to: msgTo, content: msgContent, backgroundVideo },
          outputPath: newOutputPath,
        });

        // Update the queue item with new video path, keep status as pending
        await updateContentQueueStatus(item.id, 'pending', { videoPath: newOutputPath });
        console.log(`    Updated queue item → ${path.basename(newOutputPath)}\n`);
      }

      console.log(`Done! Re-rendered ${pendingItems.length} pending item(s).`);
      break;
    }

    case 'qa': {
      const videoPath = process.argv[3];
      const content = process.argv[4] || '';

      if (!videoPath) {
        console.log('Usage: tsx src/index.ts qa <video-path> [content]');
        break;
      }

      const { runQA } = await import('./pipeline/qa.js');
      const report = await runQA(videoPath, content);

      console.log(`\nOverall: ${report.passed ? 'PASSED' : 'FAILED'}`);
      if (report.frameScreenshots.length > 0) {
        console.log('Frame screenshots:');
        for (const f of report.frameScreenshots) {
          console.log(`  ${f.label}: ${f.path}`);
        }
      }
      break;
    }

    case 'qa-all': {
      const { runQAForPendingItems } = await import('./pipeline/qa.js');
      const results = await runQAForPendingItems();
      console.log(`\nQA complete: ${results.passed} passed, ${results.failed} failed out of ${results.total}`);
      break;
    }

    default:
      console.log('Usage: tsx src/index.ts <render|render-next|curate|batch|qa|qa-all> [options]');
      console.log('\nCommands:');
      console.log('  render [template] [from] [to] [content] [mood]  - Render a single video');
      console.log('  render-next [template] [count]                  - Render next unused message(s)');
      console.log('  curate                                           - Select best messages from DB');
      console.log('  batch [template]                                - Curate + render all selected');
      console.log('  qa <video-path> [content]                       - Run QA checks on a video');
      console.log('  qa-all                                           - Run QA on all pending queue items');
      console.log('\nTemplates: CinematicVertical (default), CinematicSquare,');
      console.log('           ClassicVertical, ClassicSquare, ModernVertical, ModernSquare');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
