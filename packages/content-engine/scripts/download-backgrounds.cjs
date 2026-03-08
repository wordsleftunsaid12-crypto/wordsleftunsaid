/**
 * Download ambient background clips from Pexels.
 * Usage: node scripts/download-backgrounds.cjs [count]
 *
 * Downloads portrait (9:16) HD clips, saves to assets/backgrounds/pexels/
 * Each clip is named pexels-{id}.mp4
 * Skips already-downloaded IDs.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.PEXELS_API_KEY;
if (!API_KEY) {
  console.error('Missing PEXELS_API_KEY in environment');
  process.exit(1);
}

const TARGET_COUNT = parseInt(process.argv[2] || '30', 10);
const OUT_DIR = path.resolve(__dirname, '../assets/backgrounds/pexels');

// Ambient/atmospheric queries suited for emotional video backgrounds
const QUERIES = [
  'rain window', 'fog forest', 'ocean waves dark', 'city night lights',
  'sunset clouds', 'candle flame dark', 'morning mist nature',
  'river stream forest', 'snow falling night', 'autumn leaves wind',
  'moonlight clouds', 'rainy street night', 'mountain fog',
  'underwater dark', 'smoke dark background', 'clouds timelapse',
  'starry night sky', 'beach waves sunset', 'fireplace flames',
  'dew drops macro', 'northern lights', 'bokeh lights night',
  'wind grass field', 'cherry blossoms falling', 'thunderstorm clouds',
  'ice crystals', 'dust particles light', 'abstract light dark',
  'lonely road night', 'lake reflection calm',
];

function fetch(url, headers) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { headers }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location, {}).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`)));
        return;
      }
      resolve(res);
    });
    req.on('error', reject);
  });
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    fetch(url, { Authorization: API_KEY }).then((res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Invalid JSON: ' + body.slice(0, 200))); }
      });
    }).catch(reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    fetch(url, {}).then((res) => {
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        file.write(chunk);
        if (total > 0 && downloaded % (1024 * 1024) < chunk.length) {
          const pct = Math.round((downloaded / total) * 100);
          process.stdout.write(`\r    ${pct}% (${Math.round(downloaded / 1024 / 1024)}MB)`);
        }
      });
      res.on('end', () => {
        file.end();
        process.stdout.write('\n');
        resolve();
      });
      res.on('error', (e) => { file.end(); reject(e); });
    }).catch(reject);
  });
}

async function searchVideos(query) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=5`;
  const data = await fetchJSON(url);
  return (data.videos || []).filter((v) => v.duration >= 8 && v.duration <= 60);
}

function pickBestFile(video) {
  // Prefer 1080x1920 portrait, then any >= 1080 wide
  const files = video.video_files || [];
  const portrait1080 = files.find((f) => f.width === 1080 && f.height === 1920);
  if (portrait1080) return portrait1080;
  const hd = files
    .filter((f) => f.width >= 1080)
    .sort((a, b) => a.width - b.width)[0];
  if (hd) return hd;
  return files.sort((a, b) => b.width - a.width)[0];
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Track already-downloaded IDs
  const existing = new Set(
    fs.readdirSync(OUT_DIR)
      .filter((f) => f.startsWith('pexels-') && f.endsWith('.mp4'))
      .map((f) => f.replace('pexels-', '').replace('.mp4', '')),
  );

  console.log(`Target: ${TARGET_COUNT} clips | Already have: ${existing.size}`);
  console.log(`Output: ${OUT_DIR}\n`);

  const downloaded = [];
  const seenIds = new Set(existing);
  let queryIdx = 0;

  while (downloaded.length + existing.size < TARGET_COUNT && queryIdx < QUERIES.length) {
    const query = QUERIES[queryIdx++];
    console.log(`Searching: "${query}"...`);

    try {
      const videos = await searchVideos(query);
      for (const video of videos) {
        if (downloaded.length + existing.size >= TARGET_COUNT) break;
        if (seenIds.has(String(video.id))) continue;

        const file = pickBestFile(video);
        if (!file || !file.link) continue;

        const outPath = path.join(OUT_DIR, `pexels-${video.id}.mp4`);
        console.log(`  Downloading pexels-${video.id}.mp4 (${video.duration}s, ${file.width}x${file.height})`);

        try {
          await downloadFile(file.link, outPath);
          seenIds.add(String(video.id));
          downloaded.push(outPath);
        } catch (err) {
          console.error(`  Failed: ${err.message}`);
          // Clean up partial download
          try { fs.unlinkSync(outPath); } catch {}
        }
      }
    } catch (err) {
      console.error(`  Search failed: ${err.message}`);
    }

    // Rate limit: small delay between queries
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nDone! Downloaded ${downloaded.length} new clips (${downloaded.length + existing.size} total)`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
