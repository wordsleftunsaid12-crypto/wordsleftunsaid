import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { renderVideo, extractCoverFromVideo, isCinematic, ensureBundle, copyToBundle } from './pipeline/render.js';
import type { CompositionId } from './pipeline/render.js';
import { detectMood } from './pipeline/mood.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../output');
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const PROCESSED_DIR = path.resolve(__dirname, '../output/processed');

const command = process.argv[2];

async function prepareBgVideo(
  mood: 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw',
  template: string,
): Promise<string> {
  const { prepareBackgroundVideo } = await import('./pipeline/video-assets.js');
  const { VIDEO_PRESETS } = await import('@wlu/shared');

  const isVertical = template.includes('Vertical');
  const preset = isVertical ? VIDEO_PRESETS['9:16'] : VIDEO_PRESETS['1:1'];
  const processedPath = await prepareBackgroundVideo(mood, preset.width, preset.height);

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  const bgFilename = path.basename(processedPath);
  fs.copyFileSync(processedPath, path.join(PUBLIC_DIR, bgFilename));
  // Also copy into cached Remotion bundle so it's served for subsequent renders
  copyToBundle(processedPath, bgFilename);

  return bgFilename;
}

/**
 * Clean up processed background video after render completes.
 * Removes copies from public/ and output/processed/ to prevent disk accumulation.
 */
function cleanupBgVideo(bgFilename: string): void {
  const publicCopy = path.join(PUBLIC_DIR, bgFilename);
  const processedCopy = path.join(PROCESSED_DIR, bgFilename);
  for (const filePath of [publicCopy, processedCopy]) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // File may already be removed or not exist
    }
  }
  console.log(`  Cleaned up background: ${bgFilename}`);
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

      // Extract cover frame from the rendered video (guaranteed to match)
      const coverPath = outputPath.replace('.mp4', '-cover.png');
      await extractCoverFromVideo(outputPath, coverPath);

      if (backgroundVideo) cleanupBgVideo(backgroundVideo);

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

      let successCount = 0;
      let failCount = 0;
      for (const s of result.selected) {
        const timestamp = Date.now();
        const outputPath = path.join(OUTPUT_DIR, `${template}-${timestamp}.mp4`);

        console.log(`\nRendering [${s.mood}]: "${s.message.content}"`);

        let backgroundVideo: string | undefined;

        try {
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

          const coverPath = outputPath.replace('.mp4', '-cover.png');
          await extractCoverFromVideo(outputPath, coverPath);

          if (backgroundVideo) cleanupBgVideo(backgroundVideo);
          successCount++;
        } catch (err) {
          failCount++;
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`  Failed to render: ${msg.slice(0, 200)}`);
          if (backgroundVideo) cleanupBgVideo(backgroundVideo);
        }
      }

      console.log(`\nBatch complete! ${successCount} rendered, ${failCount} failed.`);
      break;
    }

    case 'render-next': {
      const TEMPLATE_WEIGHTS: [string, number][] = [
        ['CinematicVertical', 0.5],
        ['POVVertical', 0.5],
      ];

      function pickWeightedTemplate(): CompositionId {
        const r = Math.random();
        let cumulative = 0;
        for (const [name, weight] of TEMPLATE_WEIGHTS) {
          cumulative += weight;
          if (r < cumulative) return name as CompositionId;
        }
        return TEMPLATE_WEIGHTS[0][0] as CompositionId;
      }

      const rawTemplate = process.argv[3] || 'CinematicVertical';
      const template = rawTemplate === 'auto'
        ? pickWeightedTemplate()
        : rawTemplate as CompositionId;
      const count = Math.min(parseInt(process.argv[4] || '1', 10), 5);
      const targetPlatform = (process.argv[5] || 'instagram') as 'instagram' | 'tiktok' | 'youtube';

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

      // Hard filter — never render messages that won't fit on screen
      const { MAX_VIDEO_CONTENT_LENGTH } = await import('@wlu/shared');
      const candidates = unused.filter((m) => m.content.length <= MAX_VIDEO_CONTENT_LENGTH);
      const skippedCount = unused.length - candidates.length;
      if (skippedCount > 0) {
        console.log(`Skipped ${skippedCount} message(s) exceeding ${MAX_VIDEO_CONTENT_LENGTH} chars`);
      }

      if (candidates.length === 0) {
        console.log('No unused messages short enough for video. Seed more or add shorter messages.');
        break;
      }

      // Prioritize UGC (non-seeded) messages — submitters share their own videos
      const sorted = candidates.sort((a, b) => {
        if (a.seeded === b.seeded) return Math.random() - 0.5;
        return a.seeded ? 1 : -1; // non-seeded first
      });
      const selected = sorted.slice(0, count);

      console.log(`Found ${unused.length} unused messages, rendering ${selected.length} for ${targetPlatform}...\n`);

      const isAutoTemplate = rawTemplate === 'auto';

      for (const msg of selected) {
        // Pick a fresh template for each video in auto mode
        const videoTemplate = isAutoTemplate ? pickWeightedTemplate() : template;
        const timestamp = Date.now();
        const outputPath = path.join(OUTPUT_DIR, `${videoTemplate}-${timestamp}.mp4`);
        const mood = detectMood(msg.content, msg.from, msg.to);

        console.log(`Rendering: "${msg.content.slice(0, 80)}..."`);
        console.log(`  From: ${msg.from} → To: ${msg.to} | Mood: ${mood} | Template: ${videoTemplate}`);

        let backgroundVideo: string | undefined;

        if (isCinematic(videoTemplate)) {
          console.log('  Preparing background video...');
          await ensureBundle();
          backgroundVideo = await prepareBgVideo(mood, videoTemplate);
        }

        const renderProps = {
          from: msg.from, to: msg.to, content: msg.content, backgroundVideo,
          ...(targetPlatform === 'youtube' ? {
            ctaLine1: 'Subscribe for more',
            ctaLine2: '@wordsleftunsent',
          } : {}),
        };
        await renderVideo({
          compositionId: videoTemplate,
          props: renderProps,
          outputPath,
        });

        // Extract cover frame from the rendered video (guaranteed to match)
        const coverPath = outputPath.replace('.mp4', '-cover.png');
        await extractCoverFromVideo(outputPath, coverPath);

        if (backgroundVideo) cleanupBgVideo(backgroundVideo);

        // Record the message ID in the content queue so it won't be picked again
        const { createContentQueueItem } = await import('@wlu/shared');
        await createContentQueueItem({
          videoPath: outputPath,
          coverImagePath: coverPath,
          messageIds: [msg.id],
          template: videoTemplate,
          mood,
          platform: targetPlatform,
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

      const rerenderStatus = (process.argv[3] || 'pending') as 'pending' | 'scheduled';
      console.log(`\nFetching ${rerenderStatus} queue items for re-render...`);
      const pendingItems = await getContentQueue({ status: rerenderStatus });

      if (pendingItems.length === 0) {
        console.log(`No ${rerenderStatus} items to re-render.`);
        break;
      }

      console.log(`Found ${pendingItems.length} ${rerenderStatus} item(s). Re-rendering...\n`);

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

        const renderProps = { from: msgFrom, to: msgTo, content: msgContent, backgroundVideo };
        await renderVideo({
          compositionId: template,
          props: renderProps,
          outputPath: newOutputPath,
        });

        // Extract cover frame from the rendered video (guaranteed to match)
        const newCoverPath = newOutputPath.replace('.mp4', '-cover.png');
        await extractCoverFromVideo(newOutputPath, newCoverPath);

        if (backgroundVideo) cleanupBgVideo(backgroundVideo);

        // Update the queue item with new video + cover path, preserve original status
        await updateContentQueueStatus(item.id, rerenderStatus, { videoPath: newOutputPath, coverImagePath: newCoverPath });
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
      console.log('  render-next [template] [count] [platform]       - Render next unused message(s) for platform');
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
