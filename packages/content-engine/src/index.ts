import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { renderVideo, renderStaticImage, extractCoverFromVideo, isCinematic, isStaticTemplate, needsBackgroundVideo, needsBackgroundImage, needsMusicFile, getCoverFrame, ensureBundle, copyToBundle, extractFrameFromVideo } from './pipeline/render.js';
import { generateContactSheet } from './pipeline/qa.js';
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

/**
 * Extract a still frame from a mood-matched background video for static templates.
 * Returns the filename (relative to public/) for use as backgroundImage prop.
 */
async function prepareBackgroundImage(
  mood: 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw',
): Promise<string | undefined> {
  const { selectBackgroundVideo } = await import('./pipeline/video-assets.js');
  const videoPath = selectBackgroundVideo(mood);
  if (!videoPath) return undefined;

  await ensureBundle();
  const timestamp = Date.now();
  const imageFilename = `bg-frame-${timestamp}.jpg`;
  const imagePath = path.join(PUBLIC_DIR, imageFilename);
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  await extractFrameFromVideo(videoPath, imagePath, 2);
  copyToBundle(imagePath, imageFilename);

  console.log(`  Background image: ${imageFilename}`);
  return imageFilename;
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
      const isStatic = isStaticTemplate(template);
      const ext = isStatic ? '.png' : '.mp4';
      const outputPath = path.join(OUTPUT_DIR, `${template}-${timestamp}${ext}`);

      console.log(`\nRendering "${template}"${isStatic ? ' (static image)' : ''}...`);
      console.log(`  From: ${from}`);
      console.log(`  To: ${to}`);
      console.log(`  Content: ${content}\n`);

      if (isStatic) {
        // Static templates: render single-frame PNG — no bg video, no music, no contact sheet
        let backgroundImage: string | undefined;
        if (needsBackgroundImage(template)) {
          console.log(`Preparing background image (mood: ${mood})...`);
          backgroundImage = await prepareBackgroundImage(
            mood as 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw',
          );
        }
        await renderStaticImage({
          compositionId: template,
          props: { from, to, content, backgroundImage },
          outputPath,
        });
        console.log(`  Output: ${outputPath}`);
      } else {
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

        await renderVideo({
          compositionId: template,
          props: { from, to, content, backgroundVideo, musicFile, mood },
          outputPath,
        });

        // Extract cover frame from the rendered video (guaranteed to match)
        const coverPath = outputPath.replace('.mp4', '-cover.png');
        await extractCoverFromVideo(outputPath, coverPath, getCoverFrame(template));

        // Generate contact sheet for visual review
        const contactPath = outputPath.replace('.mp4', '-contact.png');
        try {
          await generateContactSheet(outputPath, contactPath);
          console.log(`  Contact sheet: ${contactPath}`);
        } catch (err) {
          console.warn(`  Contact sheet failed: ${err instanceof Error ? err.message : String(err)}`);
        }

        if (backgroundVideo) cleanupBgVideo(backgroundVideo);
      }

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
      const batchIsStatic = isStaticTemplate(template);
      for (const s of result.selected) {
        const timestamp = Date.now();
        const batchExt = batchIsStatic ? '.png' : '.mp4';
        const outputPath = path.join(OUTPUT_DIR, `${template}-${timestamp}${batchExt}`);

        console.log(`\nRendering [${s.mood}]: "${s.message.content}"`);

        let backgroundVideo: string | undefined;
        let musicFile: string | undefined;

        try {
          if (batchIsStatic) {
            let batchBgImage: string | undefined;
            if (needsBackgroundImage(template)) {
              batchBgImage = await prepareBackgroundImage(
                s.mood as 'tender' | 'regretful' | 'hopeful' | 'bittersweet' | 'raw',
              );
            }
            await renderStaticImage({
              compositionId: template,
              props: { from: s.message.from, to: s.message.to, content: s.message.content, backgroundImage: batchBgImage },
              outputPath,
            });
          } else {
            const batchDurationSec = calculateDurationFrames(s.message.content) / 30;

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

            await renderVideo({
              compositionId: template,
              props: {
                from: s.message.from,
                to: s.message.to,
                content: s.message.content,
                backgroundVideo,
                musicFile,
              },
              outputPath,
            });

            const coverPath = outputPath.replace('.mp4', '-cover.png');
            await extractCoverFromVideo(outputPath, coverPath, getCoverFrame(template));

            // Generate contact sheet for visual review
            const batchContactPath = outputPath.replace('.mp4', '-contact.png');
            try {
              await generateContactSheet(outputPath, batchContactPath);
              console.log(`  Contact sheet: ${batchContactPath}`);
            } catch { /* non-critical */ }

            if (backgroundVideo) cleanupBgVideo(backgroundVideo);
          }
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

      const { getApprovedMessages, getUsedMessageIds, createApprovedMessage, MAX_CONTENT_LENGTH } = await import('@wlu/shared');

      console.log('\nFetching unused messages...');
      const [allMessages, usedIds] = await Promise.all([
        getApprovedMessages({ limit: 200 }),
        getUsedMessageIds(),
      ]);

      const usedSet = new Set(usedIds);
      const existingContents = new Set(allMessages.map((m) => m.content.toLowerCase().trim()));
      const unused = allMessages.filter((m) => !usedSet.has(m.id));

      // Prioritize UGC (non-seeded) messages — submitters share their own videos
      const sorted = unused.sort((a, b) => {
        if (a.seeded === b.seeded) return Math.random() - 0.5;
        return a.seeded ? 1 : -1; // non-seeded first
      });

      console.log(`Found ${unused.length} unused messages for ${targetPlatform}...\n`);

      const isAutoTemplate = rawTemplate === 'auto';
      const autoWeights = getTemplateWeights(targetPlatform);

      // Track recently-used templates to prevent back-to-back repeats.
      // Seed with the last 2 templates posted/scheduled on this platform.
      const recentTemplates = new Set<CompositionId>();
      if (isAutoTemplate) {
        const { getContentQueue } = await import('@wlu/shared');
        const recent = await getContentQueue({ platform: targetPlatform, limit: 2 });
        for (const item of recent) {
          if (item.template) recentTemplates.add(item.template as CompositionId);
        }
        if (recentTemplates.size > 0) {
          console.log(`  Recent templates (excluded): ${[...recentTemplates].join(', ')}`);
        }
      }

      /**
       * Seed a new short message from the pool that fits the given max length.
       * Returns the newly created DB message, or null if no suitable pool entry exists.
       */
      async function seedShortMessage(maxLength: number): Promise<{ id: string; from: string; to: string; content: string } | null> {
        // Inline pool of short, video-ready messages (avoids cross-package import)
        const SHORT_MESSAGES = [
          { from: 'me', to: 'J', content: 'i still have your hoodie. i know you dont care but i sleep in it sometimes and i hate myself for it' },
          { from: 'anonymous', to: 'dad', content: 'You missed my graduation. Again.' },
          { from: 'Aisha', to: 'Noor', content: 'come home. thats it. thats the whole message. just come home.' },
          { from: 'tired', to: 'anyone', content: 'does anyone else feel like theyre just pretending to be a functioning adult or is it just me' },
          { from: 'K', to: 'Marcus', content: 'i typed "i miss you" and then deleted it 4 times today' },
          { from: 'still here', to: 'the empty chair', content: 'Christmas is the worst. Someone always sits in your spot. Nobody mentions it. But we all feel it.' },
          { from: 'anonymous', to: 'this website', content: 'I dont know if anyone actually reads these. Probably not. But just typing it out helped. So thanks I guess.' },
          { from: 'Rach', to: 'Dev', content: 'We said wed stay friends. We both knew that was a lie. But it was a nice lie.' },
          { from: 'Mia', to: 'Ben', content: 'every time our hands accidentally touch I forget what I was saying. Im 28. This is ridiculous.' },
          { from: 'anonymous', to: 'the person reading this', content: 'if someone out there thinks nobody notices them - I notice you. I see you trying. Thats not nothing.' },
          { from: 'Nora', to: 'the old me', content: 'I dont recognize you anymore and Im not sad about it. You were surviving. Im living now.' },
          { from: 'Liam', to: 'Ava', content: 'I told you it didnt bother me. It did. I said I was fine. I wasnt. By the time I was honest you stopped asking.' },
          { from: 'day 847', to: 'day 1', content: 'You were the worst day of my life. But also the most honest. Those words dont break you. They build you.' },
          { from: 'Zara', to: 'my anxiety', content: 'You dont get to drive anymore. You kept me safe by keeping me small and I am done being small.' },
          { from: 'Chloe', to: 'Bear', content: 'The vet said you wouldnt feel anything. You were the best boy. My apartment is so quiet without your snoring.' },
          { from: 'honest', to: 'my job', content: 'I spend 40 hours a week doing something that means nothing to me so I can afford to exist.' },
          { from: 'Alex', to: 'the barista', content: 'You spelled my name wrong on the cup again. At this point its kind of our thing.' },
          { from: 'Ty', to: 'nobody', content: 'Im 26 and I still dont know what Im doing. Starting to think maybe nobody has and were all just winging it.' },
          { from: 'finally okay', to: 'anyone struggling', content: 'it gets different. you learn to carry it differently. thats enough. i promise thats enough.' },
          { from: 'a night owl', to: '3am', content: 'youre the only hour thats honest. everything else is performance. the truth just shows up uninvited.' },
          { from: 'Andre', to: 'Coach', content: 'You were the first adult who didnt give up on me. I was testing you. You passed. That changed everything.' },
          { from: 'grateful', to: 'the uber driver', content: 'I was crying in your backseat at 2am and you just changed the music to something soft. That was exactly what I needed.' },
          { from: 'the middle child', to: 'my parents', content: 'I got good at being invisible. Im 31 and I still dont know how to ask for what I need.' },
          { from: 'Mateo', to: 'pops', content: 'I got the job. The one you said id never get. Part of me wants to call you.' },
        ];

        const candidates = SHORT_MESSAGES
          .filter((m) => m.content.length <= maxLength)
          .filter((m) => !existingContents.has(m.content.toLowerCase().trim()));

        if (candidates.length === 0) return null;

        // Pick a random candidate
        const pick = candidates[Math.floor(Math.random() * candidates.length)];

        console.log(`  Seeding new short message: "${pick.content.slice(0, 50)}..." (${pick.content.length} chars)`);
        const created = await createApprovedMessage({
          from: pick.from,
          to: pick.to,
          content: pick.content,
          seeded: true,
        });

        existingContents.add(pick.content.toLowerCase().trim());
        return { id: created.id, from: created.from, to: created.to, content: created.content };
      }

      let renderedCount = 0;
      let sortedIdx = 0; // Track position in sorted messages across render iterations
      for (let i = 0; i < count; i++) {
        // Pick a fresh template for each video in auto mode, excluding recent ones
        let videoTemplate = isAutoTemplate
          ? pickWeightedTemplate(autoWeights, recentTemplates)
          : template;

        let maxLen = MAX_CONTENT_LENGTH[videoTemplate] ?? 160;

        // Find a message that fits — scan through unused messages, don't just take the first
        let renderMsg: typeof sorted[0] | undefined;
        for (let j = sortedIdx; j < sorted.length; j++) {
          const candidate = sorted[j];
          if (candidate.content.length <= maxLen) {
            renderMsg = candidate;
            // Remove from sorted so it's not picked again
            sorted.splice(j, 1);
            break;
          }
          if (isAutoTemplate) {
            // Try to find a template that fits this message
            const fitTemplate = autoWeights.find(
              ([t]) => candidate.content.length <= (MAX_CONTENT_LENGTH[t] ?? 160),
            );
            if (fitTemplate) {
              videoTemplate = fitTemplate[0];
              maxLen = MAX_CONTENT_LENGTH[videoTemplate] ?? 160;
              renderMsg = candidate;
              sorted.splice(j, 1);
              break;
            }
          }
        }

        // If no suitable message found among unused, seed a new short one
        if (!renderMsg) {
          console.log(`  No unused message fits ${videoTemplate} (max ${maxLen} chars) — seeding a short one`);
          const seeded = await seedShortMessage(maxLen);
          if (!seeded) {
            console.log(`  No short messages available for ${videoTemplate} (max ${maxLen} chars). Skipping.`);
            continue;
          }
          renderMsg = seeded as typeof sorted[0];
        }

        const timestamp = Date.now();
        const isStatic = isStaticTemplate(videoTemplate);
        const ext = isStatic ? '.png' : '.mp4';
        const outputPath = path.join(OUTPUT_DIR, `${videoTemplate}-${timestamp}${ext}`);
        const mood = detectMood(renderMsg.content, renderMsg.from, renderMsg.to);

        console.log(`Rendering: "${renderMsg.content.slice(0, 80)}..."`);
        console.log(`  From: ${renderMsg.from} → To: ${renderMsg.to} | Mood: ${mood} | Template: ${videoTemplate}${isStatic ? ' (static)' : ''}`);

        let backgroundVideo: string | undefined;
        let musicFile: string | undefined;
        let coverPath: string;

        if (isStatic) {
          // Static templates: render single-frame PNG — IS the cover image
          let bgImage: string | undefined;
          if (needsBackgroundImage(videoTemplate)) {
            console.log('  Preparing background image...');
            bgImage = await prepareBackgroundImage(mood);
          }
          await renderStaticImage({
            compositionId: videoTemplate,
            props: { from: renderMsg.from, to: renderMsg.to, content: renderMsg.content, backgroundImage: bgImage },
            outputPath,
          });
          coverPath = outputPath; // The rendered image IS the cover
        } else {
          const nextDurationSec = calculateDurationFrames(renderMsg.content) / 30;

          if (needsBackgroundVideo(videoTemplate)) {
            console.log('  Preparing background video...');
            await ensureBundle();
            backgroundVideo = await prepareBgVideo(mood, videoTemplate, nextDurationSec, isCinematic(videoTemplate));
          }

          if (needsMusicFile(videoTemplate)) {
            musicFile = await prepareMusicFile(mood);
          }

          const renderProps = {
            from: renderMsg.from, to: renderMsg.to, content: renderMsg.content, backgroundVideo, musicFile,
            mood,
          };
          await renderVideo({
            compositionId: videoTemplate,
            props: renderProps,
            outputPath,
          });

          // Extract cover frame from the rendered video (guaranteed to match)
          coverPath = outputPath.replace('.mp4', '-cover.png');
          await extractCoverFromVideo(outputPath, coverPath, getCoverFrame(videoTemplate));

          // Generate contact sheet for visual review
          const nextContactPath = outputPath.replace('.mp4', '-contact.png');
          try {
            await generateContactSheet(outputPath, nextContactPath);
            console.log(`  Contact sheet: ${nextContactPath}`);
          } catch { /* non-critical */ }

          if (backgroundVideo) cleanupBgVideo(backgroundVideo);
        }

        // Record the message ID in the content queue so it won't be picked again
        const { createContentQueueItem } = await import('@wlu/shared');
        await createContentQueueItem({
          videoPath: outputPath,
          coverImagePath: coverPath,
          messageIds: [renderMsg.id],
          template: videoTemplate,
          mood,
          platform: targetPlatform,
          isExploration: false,
        });
        console.log(`  Queued with message ID tracked.\n`);
        recentTemplates.add(videoTemplate);
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
        const rrIsStatic = isStaticTemplate(template);
        const rrExt = rrIsStatic ? '.png' : '.mp4';
        const newOutputPath = path.join(OUTPUT_DIR, `${template}-${timestamp}${rrExt}`);

        console.log(`  Re-rendering ${item.id.slice(0, 8)}: "${msgContent.slice(0, 60)}..."`);
        console.log(`    Template: ${template} | Mood: ${mood}${rrIsStatic ? ' (static)' : ''}`);

        let backgroundVideo: string | undefined;
        let musicFile: string | undefined;
        let newCoverPath: string;

        if (rrIsStatic) {
          await renderStaticImage({
            compositionId: template,
            props: { from: msgFrom, to: msgTo, content: msgContent },
            outputPath: newOutputPath,
          });
          newCoverPath = newOutputPath; // Static image IS the cover
        } else {
          const rerenderDurationSec = calculateDurationFrames(msgContent) / 30;

          if (needsBackgroundVideo(template)) {
            console.log('    Preparing background video...');
            await ensureBundle();
            backgroundVideo = await prepareBgVideo(mood, template, rerenderDurationSec, isCinematic(template));
          }

          if (needsMusicFile(template)) {
            musicFile = await prepareMusicFile(mood);
          }

          const renderProps = { from: msgFrom, to: msgTo, content: msgContent, backgroundVideo, musicFile };
          await renderVideo({
            compositionId: template,
            props: renderProps,
            outputPath: newOutputPath,
          });

          // Extract cover frame from the rendered video (guaranteed to match)
          newCoverPath = newOutputPath.replace('.mp4', '-cover.png');
          await extractCoverFromVideo(newOutputPath, newCoverPath, getCoverFrame(template));

          // Generate contact sheet for visual review
          const rerenderContactPath = newOutputPath.replace('.mp4', '-contact.png');
          try {
            await generateContactSheet(newOutputPath, rerenderContactPath);
            console.log(`    Contact sheet: ${rerenderContactPath}`);
          } catch { /* non-critical */ }

          if (backgroundVideo) cleanupBgVideo(backgroundVideo);
        }

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
      // Extract template name from filename (e.g., "DeletedTextVertical-1234.mp4" → "DeletedTextVertical")
      const basename = path.basename(videoPath);
      const templateMatch = basename.match(/^([A-Za-z]+Vertical|[A-Za-z]+Square)-/);
      const detectedTemplate = templateMatch ? templateMatch[1] : 'CinematicVertical';
      const report = await runQA(videoPath, content, detectedTemplate);

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

    case 'review': {
      // List recent output videos with their contact sheet paths for visual inspection
      const reviewCount = parseInt(process.argv[3] || '5', 10);
      console.log(`\nRecent rendered videos (last ${reviewCount}):\n`);

      if (!fs.existsSync(OUTPUT_DIR)) {
        console.log('No output directory found.');
        break;
      }

      const outputFiles = fs.readdirSync(OUTPUT_DIR)
        .filter((f) => f.endsWith('.mp4') || (f.endsWith('.png') && !f.includes('-cover') && !f.includes('-contact')))
        .map((f) => ({
          name: f,
          path: path.join(OUTPUT_DIR, f),
          mtime: fs.statSync(path.join(OUTPUT_DIR, f)).mtimeMs,
          isStatic: f.endsWith('.png'),
        }))
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, reviewCount);

      if (outputFiles.length === 0) {
        console.log('No rendered videos or images found in output/');
        break;
      }

      for (const file of outputFiles) {
        const date = new Date(file.mtime).toLocaleString();
        console.log(`  ${file.name}${file.isStatic ? ' (static image)' : ''}`);
        console.log(`    Date: ${date}`);

        if (!file.isStatic) {
          const contactSheet = file.path.replace('.mp4', '-contact.png');
          const cover = file.path.replace('.mp4', '-cover.png');
          const hasContact = fs.existsSync(contactSheet);
          const hasCover = fs.existsSync(cover);
          if (hasContact) console.log(`    Contact sheet: ${contactSheet}`);
          if (hasCover) console.log(`    Cover: ${cover}`);
          if (!hasContact) console.log(`    Contact sheet: (not generated — run render again)`);
        }
        console.log();
      }
      break;
    }

    default:
      console.log('Usage: tsx src/index.ts <render|render-next|curate|batch|qa|qa-all|review> [options]');
      console.log('\nCommands:');
      console.log('  render [template] [from] [to] [content] [mood]  - Render a single video/image');
      console.log('  render-next [template] [count] [platform]       - Render next unused message(s) for platform');
      console.log('  curate                                           - Select best messages from DB');
      console.log('  batch [template]                                - Curate + render all selected');
      console.log('  qa <video-path> [content]                       - Run QA checks on a video');
      console.log('  qa-all                                           - Run QA on all pending queue items');
      console.log('  review [count]                                   - List recent videos/images with contact sheets');
      console.log('\nVideo Templates:');
      console.log('  CinematicVertical (default), TextOnGradientVertical,');
      console.log('  DeletedTextVertical, SplitScreenVertical, HandwritingSVGVertical');
      console.log('\nStatic Image Templates:');
      console.log('  QuoteCardVertical (1080x1350 Pinterest), RawTextVertical (1080x1080 cover)');
      console.log('\nSquare: CinematicSquare');
      console.log('Use "auto" for weighted random selection per platform');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
