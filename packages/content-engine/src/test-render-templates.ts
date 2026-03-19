/**
 * Test render script — renders frame 0 (cover) from each template as PNG.
 * Validates that all templates compile and render without errors.
 *
 * Usage: npx tsx src/test-render-templates.ts
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { renderCoverFrame, ensureBundle } from './pipeline/render.js';
import type { CompositionId } from './pipeline/render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../output/test-renders');

const TEST_PROPS = {
  from: 'Me',
  to: 'You',
  content: 'I never told you how much you meant to me. Every day I think about what I should have said.',
};

const TEMPLATES: Array<{
  id: CompositionId;
  extraProps?: Record<string, unknown>;
  /** Skip templates that need external assets (bg video, TTS audio) */
  skip?: string;
}> = [
  { id: 'TextOnGradientVertical', extraProps: { mood: 'tender' } },
  { id: 'TypewriterVertical' },
  { id: 'HandwrittenVertical' },
  { id: 'POVVertical' },
  { id: 'CinematicVertical', skip: 'requires background video file' },
  { id: 'ClassicVertical' },
  { id: 'ModernVertical' },
  { id: 'VoiceNarrationVertical', skip: 'requires TTS audio file' },
];

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('=== Template Test Render ===\n');
  console.log(`Output: ${OUTPUT_DIR}\n`);

  // Pre-bundle once
  await ensureBundle();

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const template of TEMPLATES) {
    if (template.skip) {
      console.log(`\n⊘ ${template.id} — skipped (${template.skip})`);
      skipped++;
      continue;
    }

    const outputPath = path.join(OUTPUT_DIR, `${template.id}-frame0.png`);
    try {
      console.log(`\nRendering ${template.id}...`);
      await renderCoverFrame({
        compositionId: template.id,
        props: { ...TEST_PROPS, ...template.extraProps },
        outputPath,
        frame: 0,
      });

      // Verify file exists and has content
      const stat = fs.statSync(outputPath);
      if (stat.size > 0) {
        console.log(`  ✓ ${template.id} — ${(stat.size / 1024).toFixed(1)} KB`);
        passed++;
      } else {
        console.log(`  ✗ ${template.id} — empty file`);
        failed++;
      }
    } catch (err) {
      console.error(`  ✗ ${template.id} — ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed, ${skipped} skipped out of ${TEMPLATES.length} ===\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
