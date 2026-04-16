import { existsSync } from 'node:fs';

/**
 * Returns Homebrew bin path.
 * Apple Silicon Macs use /opt/homebrew/bin, Intel Macs use /usr/local/bin.
 */
export function homebrewBin(): string {
  if (existsSync('/opt/homebrew/bin')) return '/opt/homebrew/bin';
  return '/usr/local/bin';
}

/**
 * Returns a PATH string with Homebrew prepended to the existing PATH.
 * Used when spawning child processes (execFile) that need npx/tsx/ffmpeg on PATH,
 * since non-login shells from daemons may miss Homebrew's bin dir.
 */
export function pathWithHomebrew(): string {
  return `${homebrewBin()}:${process.env.PATH ?? ''}`;
}
