import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { renderVideo, extractCoverFromVideo, isCinematic, needsBackgroundVideo, needsMusicFile, getCoverFrame, ensureBundle, copyToBundle } from './pipeline/render.js';
import type { CompositionId } from './pipeline/render.js';
import { detectMood } from './pipeline/mood.js';
import { calculateDurationFrames } from './templates/template-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../output');
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const PROCESSED_DIR = path.resolve(__dirname, '../output/processed');

const command = process.argv[2];

async function prepareBgVideo(
  mood: 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw',
  template: string,
  durationSec = 8,
  withMusic = true,
): Promise<string> {
  const { prepareBackgroundVideo } = await import('./pipeline/video-assets.js');
  const { VIDEO_PRESETS } = await import('@wlu/shared');

  const isVertical = template.includes('Vertical');
  const preset = isVertical ? VIDEO_PRESETS['9:16'] : VIDEO_PRESETS['1:1'];
  const processedPath = await prepareBackgroundVideo(mood, preset.width, preset.height, durationSec, withMusic);

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  const bgFilename = path.basename(processedPath);
  fs.copyFileSync(processedPath, path.join(PUBLIC_DIR, bgFilename));
  // Also copy into cached Remotion bundle so it's served for subsequent renders
  copyToBundle(processedPath, bgFilename);

  return bgFilename;
}

/**
 * Select a background music track and copy it into the Remotion bundle.
 * Returns the filename for use as musicFile prop.
 */
async function prepareMusicFile(
  mood: 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw',
): Promise<string | undefined> {
  const { selectBackgroundMusic } = await import('./pipeline/video-assets.js');
  const musicPath = selectBackgroundMusic(mood);
  if (!musicPath) return undefined;

  await ensureBundle();
  const musicFilename = path.basename(musicPath);
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.copyFileSync(musicPath, path.join(PUBLIC_DIR, musicFilename));
  copyToBundle(musicPath, musicFilename);

  console.log(`  Music track: ${musicFilename}`);
  return musicFilename;
}

/**
 * Generate TTS audio for VoiceNarration template, copy into the Remotion bundle,
 * and return props needed by the VoiceNarration component.
 */
async function prepareTTS(
  content: string,
  mood: 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw',
  voiceGender: 'male' | 'female' = 'male',
): Promise<{
  audioFile: string;
  wordTimings: Array<{ word: string; startMs: number; endMs: number }>;
  audioDurationMs: number;
  durationFrames: number;
}> {
  const { generateTTS, cleanupTTS } = await import('./pipeline/tts.js');
  const ttsResult = await generateTTS(content, mood, voiceGender);

  await ensureBundle();
  const audioFilename = path.basename(ttsResult.audioPath);
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.copyFileSync(ttsResult.audioPath, path.join(PUBLIC_DIR, audioFilename));
  copyToBundle(ttsResult.audioPath, audioFilename);

  // Clean up the original TTS file from output/tts/
  cleanupTTS(ttsResult.audioPath);

  console.log(`  TTS audio: ${audioFilename} (${ttsResult.durationSec.toFixed(1)}s, ${ttsResult.durationFrames} frames)`);

  return {
    audioFile: audioFilename,
    wordTimings: ttsResult.wordTimings,
    audioDurationMs: ttsResult.durationMs,
    durationFrames: ttsResult.durationFrames,
  };
}

function isVoiceNarration(template: string): boolean {
  return template.startsWith('VoiceNarration');
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
      let musicFile: string | undefined;
      const durationSec = calculateDurationFrames(content) / 30;

      if (needsBackgroundVideo(template)) {
        console.log(`Preparing background video (mood: ${mood})...`);
        await ensureBundle();
        backgroundVideo = await prepareBgVideo(
          mood as 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw',
          template,
          durationSec,
          isCinematic(template), // Only embed music for Cinematic (others use <Audio>)
        );
      }

      if (needsMusicFile(template)) {
        musicFile = await prepareMusicFile(
          mood as 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw',
        );
      }

      // VoiceNarration: generate TTS audio + word timings
      let ttsProps: Record<string, unknown> = {};
      if (isVoiceNarration(template)) {
        const tts = await prepareTTS(
          content,
          mood as 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw',
        );
        ttsProps = {
          audioFile: tts.audioFile,
          wordTimings: tts.wordTimings,
          audioDurationMs: tts.audioDurationMs,
        };
      }

      await renderVideo({
        compositionId: template,
        props: { from, to, content, backgroundVideo, musicFile, mood, ...ttsProps },
        outputPath,
      });

      // Extract cover frame from the rendered video (guaranteed to match)
      const coverPath = outputPath.replace('.mp4', '-cover.png');
      await extractCoverFromVideo(outputPath, coverPath, getCoverFrame(template));

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
        let musicFile: string | undefined;
        const batchDurationSec = calculateDurationFrames(s.message.content) / 30;

        try {
          if (needsBackgroundVideo(template)) {
            console.log(`  Preparing background video (mood: ${s.mood})...`);
            await ensureBundle();
            backgroundVideo = await prepareBgVideo(
              s.mood as 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw',
              template,
              batchDurationSec,
              isCinematic(template),
            );
          }

          if (needsMusicFile(template)) {
            musicFile = await prepareMusicFile(
              s.mood as 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw',
            );
          }

          let batchTtsProps: Record<string, unknown> = {};
          if (isVoiceNarration(template)) {
            const batchContentHash = s.message.content.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
            const batchVoiceGender = batchContentHash % 2 === 0 ? 'male' as const : 'female' as const;
            const tts = await prepareTTS(
              s.message.content,
              s.mood as 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw',
              batchVoiceGender,
            );
            batchTtsProps = {
              audioFile: tts.audioFile,
              wordTimings: tts.wordTimings,
              audioDurationMs: tts.audioDurationMs,
            };
          }

          await renderVideo({
            compositionId: template,
            props: {
              from: s.message.from,
              to: s.message.to,
              content: s.message.content,
              backgroundVideo,
              musicFile,
              ...batchTtsProps,
            },
            outputPath,
          });

          const coverPath = outputPath.replace('.mp4', '-cover.png');
          await extractCoverFromVideo(outputPath, coverPath, getCoverFrame(template));

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
      const { getTemplateWeights, pickWeightedTemplate } = await import('./pipeline/template-weights.js');

      const rawTemplate = process.argv[3] || 'CinematicVertical';
      const targetPlatform = (process.argv[5] || 'instagram') as 'instagram' | 'tiktok' | 'youtube';

      const template = rawTemplate === 'auto'
        ? pickWeightedTemplate(getTemplateWeights(targetPlatform))
        : rawTemplate as CompositionId;
      const count = Math.min(parseInt(process.argv[4] || '1', 10), 5);

      const { getApprovedMessages, getUsedMessageIds, MAX_CONTENT_LENGTH } = await import('@wlu/shared');

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

      // Prioritize UGC (non-seeded) messages — submitters share their own videos
      const sorted = unused.sort((a, b) => {
        if (a.seeded === b.seeded) return Math.random() - 0.5;
        return a.seeded ? 1 : -1; // non-seeded first
      });
      const selected = sorted.slice(0, count);

      console.log(`Found ${unused.length} unused messages, rendering ${selected.length} for ${targetPlatform}...\n`);

      const isAutoTemplate = rawTemplate === 'auto';

      const autoWeights = getTemplateWeights(targetPlatform);

      let renderedCount = 0;
      for (const msg of selected) {
        // Pick a fresh template for each video in auto mode
        let videoTemplate = isAutoTemplate
          ? pickWeightedTemplate(autoWeights)
          : template;

        // Per-template content length filter — retry with a different template if too long
        let maxLen = MAX_CONTENT_LENGTH[videoTemplate] ?? 160;
        if (msg.content.length > maxLen) {
          if (isAutoTemplate) {
            // Try up to 5 other templates before giving up
            let found = false;
            for (let attempt = 0; attempt < 5; attempt++) {
              const alt = pickWeightedTemplate(autoWeights);
              const altMax = MAX_CONTENT_LENGTH[alt] ?? 160;
              if (msg.content.length <= altMax) {
                videoTemplate = alt;
                maxLen = altMax;
                found = true;
                break;
              }
            }
            if (!found) {
              console.log(`  Skipping "${msg.content.slice(0, 40)}..." — ${msg.content.length} chars exceeds all tried template limits`);
              continue;
            }
          } else {
            console.log(`  Skipping "${msg.content.slice(0, 40)}..." — ${msg.content.length} chars exceeds ${videoTemplate} limit (${maxLen})`);
            continue;
          }
        }

        const timestamp = Date.now();
        const outputPath = path.join(OUTPUT_DIR, `${videoTemplate}-${timestamp}.mp4`);
        const mood = detectMood(msg.content, msg.from, msg.to);

        console.log(`Rendering: "${msg.content.slice(0, 80)}..."`);
        console.log(`  From: ${msg.from} → To: ${msg.to} | Mood: ${mood} | Template: ${videoTemplate}`);

        let backgroundVideo: string | undefined;
        let musicFile: string | undefined;
        const nextDurationSec = calculateDurationFrames(msg.content) / 30;

        if (needsBackgroundVideo(videoTemplate)) {
          console.log('  Preparing background video...');
          await ensureBundle();
          backgroundVideo = await prepareBgVideo(mood, videoTemplate, nextDurationSec, isCinematic(videoTemplate));
        }

        if (needsMusicFile(videoTemplate)) {
          musicFile = await prepareMusicFile(mood);
        }

        let nextTtsProps: Record<string, unknown> = {};
        if (isVoiceNarration(videoTemplate)) {
          // Alternate voice gender based on content hash for variety
          const contentHash = msg.content.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
          const voiceGender = contentHash % 2 === 0 ? 'male' as const : 'female' as const;
          const tts = await prepareTTS(msg.content, mood, voiceGender);
          nextTtsProps = {
            audioFile: tts.audioFile,
            wordTimings: tts.wordTimings,
            audioDurationMs: tts.audioDurationMs,
          };
        }

        const renderProps = {
          from: msg.from, to: msg.to, content: msg.content, backgroundVideo, musicFile,
          mood,
          ...nextTtsProps,
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
        await extractCoverFromVideo(outputPath, coverPath, getCoverFrame(videoTemplate));

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
        renderedCount++;
      }

      console.log(`Done! Rendered ${renderedCount} video(s) from unique messages.`);
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
        let musicFile: string | undefined;
        const rerenderDurationSec = calculateDurationFrames(msgContent) / 30;

        if (needsBackgroundVideo(template)) {
          console.log('    Preparing background video...');
          await ensureBundle();
          backgroundVideo = await prepareBgVideo(mood, template, rerenderDurationSec, isCinematic(template));
        }

        if (needsMusicFile(template)) {
          musicFile = await prepareMusicFile(mood);
        }

        let rerenderTtsProps: Record<string, unknown> = {};
        if (isVoiceNarration(template)) {
          const rrContentHash = msgContent.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
          const rrVoiceGender = rrContentHash % 2 === 0 ? 'male' as const : 'female' as const;
          const tts = await prepareTTS(msgContent, mood, rrVoiceGender);
          rerenderTtsProps = {
            audioFile: tts.audioFile,
            wordTimings: tts.wordTimings,
            audioDurationMs: tts.audioDurationMs,
          };
        }

        const renderProps = { from: msgFrom, to: msgTo, content: msgContent, backgroundVideo, musicFile, ...rerenderTtsProps };
        await renderVideo({
          compositionId: template,
          props: renderProps,
          outputPath: newOutputPath,
        });

        // Extract cover frame from the rendered video (guaranteed to match)
        const newCoverPath = newOutputPath.replace('.mp4', '-cover.png');
        await extractCoverFromVideo(newOutputPath, newCoverPath, getCoverFrame(template));

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
      console.log('           ClassicVertical, ClassicSquare, ModernVertical, ModernSquare,');
      console.log('           POVVertical, TextOnGradientVertical, TypewriterVertical,');
      console.log('           HandwrittenVertical');
      console.log('           Use "auto" for weighted random selection');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
