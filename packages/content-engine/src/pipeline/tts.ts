/**
 * Edge TTS pipeline — generates speech audio from text content.
 *
 * Uses Microsoft Edge's free TTS service (no API key needed).
 * Supports mood-variant voice styles for emotional range.
 * Returns audio file path and word-level timing for video sync.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { MessageMood } from '@wlu/shared';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TTS_OUTPUT_DIR = path.resolve(__dirname, '../../output/tts');

/** Voice options — newer Multilingual generation sounds more natural */
const VOICES = {
  male: 'en-US-BrianMultilingualNeural',
  female: 'en-US-AvaMultilingualNeural',
} as const;

type VoiceGender = keyof typeof VOICES;

/** Mood-to-rate mapping for emotional pacing */
const MOOD_RATE: Record<string, string> = {
  tender: '-15%',
  regretful: '-20%',
  hopeful: '-5%',
  bittersweet: '-10%',
  raw: '+0%',
};

export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export interface TTSResult {
  audioPath: string;
  durationMs: number;
  durationSec: number;
  durationFrames: number;
  wordTimings: WordTiming[];
}

/**
 * Generate TTS audio for a message using Edge TTS.
 * Returns audio path, duration, and word-level timing for video sync.
 */
export async function generateTTS(
  content: string,
  mood: MessageMood = 'bittersweet',
  voiceGender: VoiceGender = 'male',
): Promise<TTSResult> {
  if (!fs.existsSync(TTS_OUTPUT_DIR)) {
    fs.mkdirSync(TTS_OUTPUT_DIR, { recursive: true });
  }

  const timestamp = Date.now();
  const audioPath = path.join(TTS_OUTPUT_DIR, `tts-${timestamp}.mp3`);
  const subsPath = path.join(TTS_OUTPUT_DIR, `tts-${timestamp}.vtt`);

  const voice = VOICES[voiceGender];
  const rate = MOOD_RATE[mood] ?? '-10%';

  console.log(`  Generating TTS (voice: ${voice}, rate: ${rate})...`);

  await execFileAsync('edge-tts', [
    '--text', content,
    '--voice', voice,
    '--rate', rate,
    '--pitch', '-2Hz',
    '--write-media', audioPath,
    '--write-subtitles', subsPath,
  ]);

  // Parse word timings from WebVTT subtitles
  const wordTimings = parseVTTTimings(subsPath, content);

  // Clean up VTT file
  try { fs.unlinkSync(subsPath); } catch { /* ignore */ }

  // Get actual audio duration via ffprobe
  const durationMs = await getAudioDurationMs(audioPath);
  const durationSec = durationMs / 1000;
  // Add 2 seconds of padding for intro/outro
  const totalSec = durationSec + 4;
  const durationFrames = Math.ceil(totalSec * 30);

  console.log(`  TTS audio: ${durationSec.toFixed(1)}s → ${durationFrames} frames (with padding)`);

  return {
    audioPath,
    durationMs,
    durationSec,
    durationFrames,
    wordTimings,
  };
}

/**
 * Parse WebVTT subtitles into word-level timings.
 * Falls back to evenly distributed timings if VTT parsing fails.
 */
function parseVTTTimings(vttPath: string, content: string): WordTiming[] {
  try {
    if (!fs.existsSync(vttPath)) {
      return generateFallbackTimings(content, 0);
    }

    const vtt = fs.readFileSync(vttPath, 'utf-8');
    const timings: WordTiming[] = [];

    // Parse VTT cues: "00:00:00.123 --> 00:00:01.456\nWord word word"
    const cueRegex = /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\s*\n(.+)/g;
    let match;

    while ((match = cueRegex.exec(vtt)) !== null) {
      const startMs = vttTimeToMs(match[1]);
      const endMs = vttTimeToMs(match[2]);
      const cueText = match[3].trim();

      // Split cue text into individual words
      const words = cueText.split(/\s+/);
      const wordDuration = (endMs - startMs) / words.length;

      for (let i = 0; i < words.length; i++) {
        timings.push({
          word: words[i],
          startMs: Math.round(startMs + i * wordDuration),
          endMs: Math.round(startMs + (i + 1) * wordDuration),
        });
      }
    }

    if (timings.length === 0) {
      return generateFallbackTimings(content, 0);
    }

    return timings;
  } catch {
    return generateFallbackTimings(content, 0);
  }
}

function vttTimeToMs(time: string): number {
  const [h, m, rest] = time.split(':');
  const [s, ms] = rest.split('.');
  return (
    parseInt(h) * 3600000 +
    parseInt(m) * 60000 +
    parseInt(s) * 1000 +
    parseInt(ms)
  );
}

/**
 * Generate evenly-spaced word timings as fallback.
 */
function generateFallbackTimings(content: string, durationMs: number): WordTiming[] {
  const words = content.split(/\s+/);
  // Estimate ~150 words per minute if no duration given
  const totalMs = durationMs || (words.length / 150) * 60000;
  const wordDuration = totalMs / words.length;

  return words.map((word, i) => ({
    word,
    startMs: Math.round(i * wordDuration),
    endMs: Math.round((i + 1) * wordDuration),
  }));
}

/**
 * Get audio duration in milliseconds via ffprobe.
 */
async function getAudioDurationMs(audioPath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'quiet',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    audioPath,
  ]);
  const seconds = parseFloat(stdout.trim()) || 0;
  return Math.round(seconds * 1000);
}

/**
 * Clean up TTS audio file after render.
 */
export function cleanupTTS(audioPath: string): void {
  try {
    fs.unlinkSync(audioPath);
    console.log(`  Cleaned up TTS audio: ${path.basename(audioPath)}`);
  } catch { /* ignore */ }
}
