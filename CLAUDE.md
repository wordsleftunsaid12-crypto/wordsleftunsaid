# Words Left Unsaid

Anonymous message sharing platform with AI-powered content generation for social media.

## Architecture

Monorepo using npm workspaces. All packages in `packages/`.

| Package | Purpose |
|---------|---------|
| shared | Types, DB client, utilities, brand constants |
| content-engine | Remotion video generation + Claude AI content |
| website | Astro 4 public site |
| social | Instagram/TikTok posting automation |
| analytics | Engagement tracking and feedback loop |

## Tech Stack

- TypeScript everywhere (strict mode, no `any`)
- Supabase cloud (Postgres + Auth + Storage)
- Astro 4 (website, deployed to Netlify)
- Remotion (video rendering)
- Claude API (content generation)
- FFmpeg (video post-processing)

## Key Commands

- `npm run dev` — Start website dev server
- `npm run build` — Build all packages
- `npm run render` — Render next video in queue
- `npm run post` — Post next scheduled content
- `npm run db:migrate` — Push Supabase migrations
- `npm test` — Run all tests

## Conventions

- Import from `@wlu/shared` for types and DB access
- Environment variables validated with zod at startup (see `packages/shared/src/config/env.ts`)
- Never hardcode credentials; always use env vars via `.env`
- Database access only through `packages/shared/src/db/` functions
- Brand colors/fonts defined in `packages/shared/src/utils/brand.ts`

## Database

Supabase cloud project. Core table:
`messages`: id (uuid), from (text), to (text), content (text), email (text), approved (bool), created_at (timestamptz)

## File Patterns

- Components: PascalCase (`MessageCard.tsx`)
- Utilities: camelCase (`sanitize.ts`)
- Tests: `*.test.ts` colocated or in `tests/`
- Config files: root of each package

## Visual Testing (Website)

After significant website changes, visually verify using Chrome DevTools Protocol:

1. **Start the dev server:** `npm run dev` (runs on localhost:4321+)
2. **Launch Chrome with remote debugging:**
   ```
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --remote-debugging-port=9222 \
     --user-data-dir="/tmp/chrome-debug-profile" \
     --no-first-run --no-default-browser-check \
     "http://localhost:4321/"
   ```
3. **Connect via CDP WebSocket:** Query `http://localhost:9222/json` to get tab WS URLs
4. **Take screenshots** at multiple viewports:
   - Desktop: 1440×900 @ 2x
   - Mobile (iPhone 14 Pro): 390×844 @ 3x
   - Mobile (iPhone SE): 375×667 @ 2x
   - Small (320px): 320×568 @ 2x
5. **Check for:** console errors, failed resources (404s), horizontal overflow, z-index issues
6. **Note:** Elements with `.fade-in` / `.blur-in` start at `opacity: 0`. Force them visible with:
   ```js
   document.querySelectorAll('.fade-in, .blur-in').forEach(el => el.classList.add('visible'));
   ```
