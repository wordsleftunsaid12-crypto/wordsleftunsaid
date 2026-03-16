/**
 * In-process mutex for Playwright persistent browser contexts.
 * Prevents ProcessSingleton errors when multiple scheduler jobs
 * try to open the same browser profile directory simultaneously.
 *
 * Also cleans up stale SingletonLock files left by orphaned Chrome processes.
 */
import { readlinkSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const locks = new Map<string, Promise<void>>();

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

/**
 * Remove stale SingletonLock if the Chrome process that created it is dead.
 * The lock is a symlink like: SingletonLock -> hostname-PID
 */
function cleanStaleLock(sessionDir: string): void {
  const lockPath = resolve(sessionDir, 'SingletonLock');
  if (!existsSync(lockPath)) return;

  try {
    const target = readlinkSync(lockPath); // e.g. "Nicolass-MacBook-Air.local-25810"
    const dashIdx = target.lastIndexOf('-');
    if (dashIdx === -1) return;

    const pid = Number(target.slice(dashIdx + 1));
    if (Number.isNaN(pid) || pid <= 0) return;

    if (!isProcessAlive(pid)) {
      console.log(`[browser-lock] Removing stale SingletonLock (dead PID ${pid}) in ${sessionDir}`);
      unlinkSync(lockPath);
    } else {
      // Process is alive — try to kill it (orphaned Chrome from a previous session)
      console.log(`[browser-lock] Killing orphaned Chrome PID ${pid} for ${sessionDir}`);
      try {
        process.kill(pid, 'SIGTERM');
        // Give it a moment to exit
        const start = Date.now();
        while (isProcessAlive(pid) && Date.now() - start < 3000) {
          // busy-wait up to 3s
        }
        if (!isProcessAlive(pid)) {
          unlinkSync(lockPath);
          console.log(`[browser-lock] Killed and cleaned lock for PID ${pid}`);
        }
      } catch {
        // Can't kill — leave it
      }
    }
  } catch {
    // readlinkSync fails if not a symlink — ignore
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
    cleanStaleLock(sessionDir);
    return await fn();
  } finally {
    locks.delete(sessionDir);
    resolve!();
  }
}
