import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type CompositionId =
  | 'ClassicVertical'
  | 'ClassicSquare'
  | 'ModernVertical'
  | 'ModernSquare'
  | 'CinematicVertical'
  | 'CinematicSquare';

export interface RenderOptions {
  compositionId: CompositionId;
  props: {
    from: string;
    to: string;
    content: string;
    backgroundVideo?: string;
  };
  outputPath: string;
}

export function isCinematic(compositionId: CompositionId): boolean {
  return compositionId.startsWith('Cinematic');
}

/** Cached bundle URL — avoids re-bundling for every video in a batch */
let cachedBundleUrl: string | null = null;

/**
 * Bundle the Remotion project once. Reuses the cached bundle for subsequent calls.
 */
export async function ensureBundle(): Promise<string> {
  if (cachedBundleUrl) return cachedBundleUrl;

  const entryPoint = path.resolve(__dirname, '../compositions/Root.tsx');

  console.log('Bundling Remotion project (one-time)...');
  cachedBundleUrl = await bundle({
    entryPoint,
    onProgress: (progress) => {
      if (progress % 25 === 0) console.log(`  Bundle progress: ${progress}%`);
    },
  });

  return cachedBundleUrl;
}

/**
 * Copy a file into the cached bundle's public directory so Remotion can serve it.
 * Must be called after ensureBundle() and before renderVideo() for dynamic assets.
 */
export function copyToBundle(srcPath: string, filename: string): void {
  if (!cachedBundleUrl) return;
  const dest = path.join(cachedBundleUrl, 'public', filename);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(srcPath, dest);
}

export async function renderVideo(options: RenderOptions): Promise<string> {
  const { compositionId, props, outputPath } = options;

  const bundled = await ensureBundle();

  console.log('Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundled,
    id: compositionId,
    inputProps: props,
  });

  console.log(`Rendering ${composition.width}x${composition.height} @ ${composition.fps}fps...`);
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: props,
    onProgress: ({ progress }) => {
      if (Math.round(progress * 100) % 20 === 0) {
        console.log(`  Render progress: ${Math.round(progress * 100)}%`);
      }
    },
  });

  console.log(`Video saved to: ${outputPath}`);
  return outputPath;
}
