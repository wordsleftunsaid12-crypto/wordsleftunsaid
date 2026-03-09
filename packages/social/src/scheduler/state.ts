/**
 * Scheduler state persistence — saves last-run timestamps to a local JSON file
 * so the scheduler can skip jobs that ran recently when restarted.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const STATE_FILE = resolve(process.env.HOME ?? '.', '.wlu-scheduler-state.json');

interface SchedulerState {
  lastRun: Record<string, string>; // job name → ISO timestamp
}

function loadState(): SchedulerState {
  try {
    const raw = readFileSync(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as SchedulerState;
    if (parsed && typeof parsed.lastRun === 'object') return parsed;
  } catch {
    // File missing, corrupt, or unreadable — start fresh
  }
  return { lastRun: {} };
}

function saveState(state: SchedulerState): void {
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  } catch (err) {
    console.warn('[state] Failed to save scheduler state:', err instanceof Error ? err.message : err);
  }
}

/**
 * Record the current time as the last-run timestamp for a job.
 */
export function saveLastRun(jobName: string): void {
  const state = loadState();
  state.lastRun[jobName] = new Date().toISOString();
  saveState(state);
}

/**
 * Get seconds elapsed since a job last ran.
 * Returns null if the job has never run (no recorded timestamp).
 */
export function getSecondsSinceLastRun(jobName: string): number | null {
  const state = loadState();
  const iso = state.lastRun[jobName];
  if (!iso) return null;
  const lastRun = new Date(iso).getTime();
  if (Number.isNaN(lastRun)) return null;
  return (Date.now() - lastRun) / 1000;
}

// --- Timestamp logger ---

/**
 * Install timestamp prefixes on console.log / console.warn / console.error.
 * Call once at scheduler startup. Produces output like:
 *   [07:38:05] [caption] Captioned: 912de79a-...
 */
export function installTimestampLogger(): void {
  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  function stamp(): string {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `[${hh}:${mm}:${ss}]`;
  }

  console.log = (...args: unknown[]) => origLog(stamp(), ...args);
  console.warn = (...args: unknown[]) => origWarn(stamp(), ...args);
  console.error = (...args: unknown[]) => origError(stamp(), ...args);
}
