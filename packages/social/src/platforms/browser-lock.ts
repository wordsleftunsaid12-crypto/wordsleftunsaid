/**
 * In-process mutex for Playwright persistent browser contexts.
 * Prevents ProcessSingleton errors when multiple scheduler jobs
 * try to open the same browser profile directory simultaneously.
 */

const locks = new Map<string, Promise<void>>();

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
    return await fn();
  } finally {
    locks.delete(sessionDir);
    resolve!();
  }
}
