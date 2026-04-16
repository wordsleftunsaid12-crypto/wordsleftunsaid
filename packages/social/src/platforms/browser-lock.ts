/**
 * In-process mutex for Playwright persistent browser contexts.
 * Prevents ProcessSingleton errors when multiple scheduler jobs
 * try to open the same browser profile directory simultaneously.
 *
 * Also cleans up stale SingletonLock/SingletonCookie/SingletonSocket files
 * left behind by orphaned Chrome processes (e.g. after laptop sleep/crash).
 */
import { readlinkSync, unlinkSync, existsSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';

const locks = new Map<string, Promise<void>>();

/** Chrome's ProcessSingleton files — all three must be cleared together. */
const SINGLETON_FILES = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'] as const;

/**
 * Extra launch options for Playwright. On hosts where the bundled Chromium
 * won't run (e.g. macOS 11 Big Sur — missing newer Apple frameworks), set
 * WLU_BROWSER_CHANNEL=chrome to route through the system-installed Google
 * Chrome instead. On Apple Silicon/modern macOS, leave it unset.
 */
export function chromiumLaunchOverrides(): { channel?: 'chrome' | 'msedge' } {
  const channel = process.env.WLU_BROWSER_CHANNEL;
  if (channel === 'chrome' || channel === 'msedge') return { channel };
  return {};
}

/**
 * Check if a process with the given PID is running.
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 = check existence only
    return true;
  } catch {
    return false;
  }
}

/** Wait (busy-loop free) until pid exits or timeout elapses. */
async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isProcessAlive(pid)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return !isProcessAlive(pid);
}

/** Remove a singleton file/symlink if it exists. Silently ignores errors. */
function unlinkSingleton(sessionDir: string, name: string): void {
  const p = resolve(sessionDir, name);
  try {
    // lstatSync won't follow symlinks — needed so we detect dangling ones
    lstatSync(p);
    unlinkSync(p);
  } catch {
    // Doesn't exist or can't remove — ignore
  }
}

/** Remove all ProcessSingleton files for a session. */
function removeAllSingletons(sessionDir: string): void {
  for (const name of SINGLETON_FILES) {
    unlinkSingleton(sessionDir, name);
  }
}

/**
 * Remove stale ProcessSingleton files if the Chrome process that created
 * them is dead. The lock is a symlink like: SingletonLock -> hostname-PID.
 * If the PID is alive but belongs to an orphan from a previous session,
 * SIGTERM it and then clean all three singleton files together.
 */
async function cleanStaleLock(sessionDir: string): Promise<void> {
  const lockPath = resolve(sessionDir, 'SingletonLock');
  if (!existsSync(lockPath)) {
    // SingletonLock is gone but Cookie/Socket may linger — clean them too.
    // These often survive crashes and cause "profile already in use" errors
    // on the next launch even though no Chrome is running.
    for (const stray of ['SingletonCookie', 'SingletonSocket']) {
      const p = resolve(sessionDir, stray);
      if (existsSync(p)) {
        console.log(`[browser-lock] Removing stray ${stray} in ${sessionDir}`);
        unlinkSingleton(sessionDir, stray);
      }
    }
    return;
  }

  try {
    const target = readlinkSync(lockPath); // e.g. "Nicolass-MacBook-Air.local-25810"
    const dashIdx = target.lastIndexOf('-');
    if (dashIdx === -1) {
      // Malformed symlink — nuke all three
      console.log(`[browser-lock] Removing malformed singleton files in ${sessionDir}`);
      removeAllSingletons(sessionDir);
      return;
    }

    const pid = Number(target.slice(dashIdx + 1));
    if (Number.isNaN(pid) || pid <= 0) {
      removeAllSingletons(sessionDir);
      return;
    }

    if (!isProcessAlive(pid)) {
      console.log(`[browser-lock] Removing stale singleton files (dead PID ${pid}) in ${sessionDir}`);
      removeAllSingletons(sessionDir);
      return;
    }

    // Process is alive — assume orphan from a previous session and kill it
    console.log(`[browser-lock] Killing orphaned Chrome PID ${pid} for ${sessionDir}`);
    try {
      process.kill(pid, 'SIGTERM');
      const exited = await waitForProcessExit(pid, 3000);
      if (!exited) {
        console.warn(`[browser-lock] PID ${pid} did not exit after SIGTERM, sending SIGKILL`);
        try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ }
        await waitForProcessExit(pid, 1000);
      }
      if (!isProcessAlive(pid)) {
        removeAllSingletons(sessionDir);
        console.log(`[browser-lock] Cleaned singleton files for PID ${pid}`);
      } else {
        console.warn(`[browser-lock] PID ${pid} still alive — leaving singletons in place`);
      }
    } catch {
      // Can't signal (permission or ESRCH) — still try to clean
      if (!isProcessAlive(pid)) {
        removeAllSingletons(sessionDir);
      }
    }
  } catch {
    // readlinkSync fails if not a symlink — treat as malformed
    removeAllSingletons(sessionDir);
  }
}

/**
 * Acquire an exclusive lock on a browser session directory,
 * execute `fn`, then release the lock.
 *
 * If another call is already holding the lock for the same sessionDir,
 * this call waits until the previous one finishes.
 */
export async function withBrowserLock<T>(
  sessionDir: string,
  fn: () => Promise<T>,
): Promise<T> {
  // Wait for any existing lock on this session dir
  while (locks.has(sessionDir)) {
    await locks.get(sessionDir);
  }

  let resolve: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  locks.set(sessionDir, promise);

  try {
    // Clean up stale OS-level locks before launching
    await cleanStaleLock(sessionDir);
    return await fn();
  } finally {
    locks.delete(sessionDir);
    resolve!();
  }
}

/**
 * Explicit startup cleanup: sweep a list of session dirs and remove any
 * stale ProcessSingleton files. Use this once at scheduler startup to
 * recover from prior crashes/laptop sleep.
 */
export async function cleanStaleSingletons(sessionDirs: string[]): Promise<void> {
  for (const dir of sessionDirs) {
    await cleanStaleLock(dir);
  }
}
