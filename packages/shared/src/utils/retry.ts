/**
 * Retry a function with exponential backoff for transient failures.
 * Retries on TypeError (fetch failed) and similar network errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const { maxRetries = 2, baseDelayMs = 1000, label = 'operation' } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable =
        err instanceof TypeError && /fetch failed/i.test(err.message);

      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(
        `[retry] ${label} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms: ${err instanceof Error ? err.message : err}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error('Retry exhausted');
}
