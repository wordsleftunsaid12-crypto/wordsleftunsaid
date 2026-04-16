# Migration Guide — Move Pipeline to a New Mac

**Target audience:** Claude Code running on a fresh machine with no conversation history. Read this top to bottom and follow each step.

## Target environment

- **Machine:** MacBook Pro, late 2013 Retina 13", Intel Core i5-4258U (2.4 GHz dual-core), 8 GB RAM, Intel Iris 5100, macOS Big Sur 11.7.11
- **Pipeline:** Social media scheduler for words-left-unsent.com. Renders videos with Remotion + ffmpeg, posts to Instagram/TikTok/YouTube/Reddit/Pinterest/Twitter via Playwright persistent browser sessions.

## Before you start

This guide assumes:

1. The new Mac has a working internet connection
2. A USB drive is plugged in containing `wlu-state.tgz` (created on the old Mac with the appendix commands below)
3. The user is physically at the new Mac and can solve CAPTCHAs / 2FA prompts when platforms challenge new-IP logins

**Do NOT start the scheduler on the new Mac while the old Mac's scheduler is still running.** Double-posting will result. Step 10 handles the hand-off.

---

## Step 1 — Verify environment

```bash
sw_vers
# ProductVersion should start with 11. (Big Sur). If it's older (10.x), warn the user and stop.

which brew || echo "BREW_MISSING"
```

If Homebrew is missing, install it:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Intel Macs install Homebrew to `/usr/local/bin`. Confirm:

```bash
which brew
# Expected: /usr/local/bin/brew
```

If `brew` isn't on PATH after install, add it:

```bash
echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/usr/local/bin/brew shellenv)"
```

## Step 2 — Install system dependencies

```bash
brew update
brew install node@20 ffmpeg git
brew link node@20 --force
```

Verify:

```bash
node --version    # must be v20.x
npm --version     # 10.x
ffmpeg -version   # 6.x or 7.x
git --version
```

**Fallback if `node@20` fails** (some Big Sur formulas have dropped support):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 20
nvm alias default 20
node --version    # must be v20.x
```

## Step 3 — Clone repo

```bash
cd ~
git clone https://github.com/wordsleftunsaid12-crypto/wordsleftunsaid.git
cd wordsleftunsaid
```

## Step 4 — Install npm dependencies

```bash
npm install
```

**Expect 5–10 minutes.** The `sharp` package compiles natively. Dual-core CPU will be slow.

**Fallback if `sharp` fails to compile:**

```bash
npm install sharp --ignore-scripts
npm rebuild sharp --platform=darwin --arch=x64
```

## Step 5 — Transfer state from USB

The USB drive contains `wlu-state.tgz` produced on the old Mac. Locate it and extract:

```bash
# Find the USB
ls /Volumes/

# Extract (replace USBNAME with actual volume name)
cd ~
tar xzf /Volumes/USBNAME/wlu-state.tgz

# Verify the browser sessions + state files landed in $HOME
ls -la ~ | grep wlu
# Expected output:
#   .wlu-instagram-session/
#   .wlu-tiktok-session/
#   .wlu-youtube-session/
#   .wlu-reddit-session/
#   .wlu-pinterest-session/
#   .wlu-twitter-session/
#   .wlu-learned-weights.json
#   .wlu-scheduler-state.json
```

Copy `.env` into the project root (NOT home dir):

```bash
cp /Volumes/USBNAME/.env ~/wordsleftunsaid/.env
# Verify
head -5 ~/wordsleftunsaid/.env  # should contain SUPABASE_URL, SUPABASE_ANON_KEY, etc.
```

## Step 6 — Install Playwright Chromium

```bash
cd ~/wordsleftunsaid
npx playwright install chromium
# Downloads to ~/Library/Caches/ms-playwright/
```

## Step 7 — Smoke test

```bash
cd ~/wordsleftunsaid

# Type-check all packages (all 4 must pass with no output)
npx tsc --noEmit -p packages/shared/tsconfig.json
npx tsc --noEmit -p packages/social/tsconfig.json
npx tsc --noEmit -p packages/content-engine/tsconfig.json
npx tsc --noEmit -p packages/analytics/tsconfig.json

# Run tests (must show "27 passed")
npx vitest run --root .

# Verify the Homebrew path helper picks up the Intel location
npx tsx -e "import { homebrewBin } from '@wlu/shared'; console.log(homebrewBin());"
# Expected on Intel Mac: /usr/local/bin

# Dry-run the scheduler — stops after showing queue status, no actual posts
npx tsx packages/social/src/index.ts schedule --dry-run
# Expected within 30s: "[scheduler] Queue status:", "[schedule] Upcoming posts (N):"
# Ctrl+C after you see these lines — dry-run mode still runs forever
```

## Step 8 — Handle platform re-auth (IMPORTANT)

The new Mac has a different IP than the old one. Instagram and TikTok will flag this and may require:

- Solving a CAPTCHA
- Entering a 2FA code from the connected phone
- Confirming "was this you" on the mobile app

**Test each platform by attempting a dry-run post.** For each one that opens a browser asking for login, the human user completes the login manually — the persistent Chromium context saves the new cookies automatically.

```bash
# Test Instagram (most likely to challenge)
npx tsx packages/social/src/index.ts post --platform=instagram --dry-run

# Test TikTok
npx tsx packages/social/src/index.ts post --platform=tiktok --dry-run

# Test YouTube
npx tsx packages/social/src/index.ts post --platform=youtube --dry-run

# Test Reddit, Pinterest, Twitter — usually tolerate new IPs better
npx tsx packages/social/src/index.ts post --platform=reddit --dry-run
npx tsx packages/social/src/index.ts post --platform=pinterest --dry-run
npx tsx packages/social/src/index.ts post --platform=twitter --dry-run
```

If a browser opens and sits on a login page, stop and ask the user to complete authentication. Do not proceed until all 6 platforms open to their feed/dashboard without asking for credentials.

## Step 9 — Configure 24/7 operation

Prevent the Mac from sleeping:

```bash
sudo pmset -a disablesleep 1
sudo pmset -a sleep 0
sudo pmset -a displaysleep 30   # screen can sleep, system stays awake
sudo pmset -a powernap 0

# Confirm settings
pmset -g
```

## Step 10 — Hand-off from old Mac

**Do this on the old Mac first** (ask the user to run it there, or SSH in):

```bash
ps -ef | grep 'tsx.*schedule' | grep -v grep | awk '{print $2}' | xargs kill
# Verify nothing is running
ps -ef | grep 'tsx.*schedule' | grep -v grep
```

**Then on the new Mac**, start the scheduler:

```bash
cd ~/wordsleftunsaid
nohup npx tsx packages/social/src/index.ts schedule > /tmp/wlu-scheduler.log 2>&1 &
echo "PID: $!"

# Watch it boot for 30 seconds to confirm no errors
sleep 5 && tail -30 /tmp/wlu-scheduler.log
```

Expected log output:

```
[HH:MM:SS] [scheduler] Starting social media engine...
[HH:MM:SS] [scheduler] Platforms: ALL (instagram, tiktok, youtube, reddit, pinterest, twitter)
[HH:MM:SS] [scheduler] Queue status: {"pending":..., "scheduled":..., "posted":..., ...}
[HH:MM:SS] [schedule] Upcoming posts (N): ...
[HH:MM:SS] [scheduler] All jobs running. Press Ctrl+C to stop.
```

If you see `Error:` or the process exits, diagnose — common issues:

- **"SUPABASE_URL Required"** → `.env` missing or in wrong directory. Must be at `~/wordsleftunsaid/.env`.
- **"browserType.launchPersistentContext: Failed to create a ProcessSingleton"** → Stale lock from an earlier crash. Run: `find ~/.wlu-*-session -name 'SingletonLock' -delete`
- **"Cannot find module '@wlu/shared'"** → `npm install` didn't complete. Rerun it.

## Step 11 — Verification (after 1 hour of runtime)

Confirm the pipeline is actually working:

```bash
# Check scheduler is still alive
ps -ef | grep 'tsx.*schedule' | grep -v grep

# Tail the log for recent activity
tail -50 /tmp/wlu-scheduler.log

# Check DB queue status
npx tsx packages/social/src/index.ts status
```

Pass criteria:

1. Scheduler process is alive
2. At least one `[publish-job] Published!` line in the log, OR at least one new `scheduled` post appeared
3. Queue status shows counts in expected ranges (pending: 0-5, scheduled: 3-10, posted: incrementing)
4. No repeating `Error:` lines

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `npm install` fails on `sharp` | Missing Xcode CLI tools | `xcode-select --install` then retry |
| `fetch failed` on every Supabase call | Time drift breaks TLS on old Mac | `sudo sntp -sS time.apple.com` |
| Browser sessions crash immediately | Playwright Chromium too new for Big Sur | `npx playwright install chromium@1.58.2` |
| Instagram "suspicious login" every post | IP still not trusted | Let the user manually log in once via the mobile app from the same WiFi |
| Scheduler consumes all RAM | Multiple browsers running concurrently | Check `browser-lock.ts` serialization is active — normal load is ~1 browser at a time |
| `tiktok-batch-post.ts` fails | Dev script with hardcoded paths | **Do not run this file.** It's a one-off script. Scheduler handles TikTok posting automatically. |

---

## Appendix — USB packing instructions (run on OLD Mac before migration)

When you're ready to move, run these on the current Apple Silicon Mac:

```bash
# Make sure scheduler is stopped
ps -ef | grep 'tsx.*schedule' | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null || true

# Pack browser sessions + state files (preserves permissions/symlinks)
cd ~
tar czf /Volumes/USBNAME/wlu-state.tgz \
  .wlu-instagram-session \
  .wlu-tiktok-session \
  .wlu-youtube-session \
  .wlu-reddit-session \
  .wlu-pinterest-session \
  .wlu-twitter-session \
  .wlu-learned-weights.json \
  .wlu-scheduler-state.json

# Copy .env separately (small, easier to verify)
cp "/Users/ncebron/Coding/wordsleftunsaid copy/.env" /Volumes/USBNAME/.env

# Verify the archive
tar tzf /Volumes/USBNAME/wlu-state.tgz | head -20

# Eject USB safely
diskutil eject /Volumes/USBNAME
```

Bring the USB to the new Mac and follow Step 5 onward.
