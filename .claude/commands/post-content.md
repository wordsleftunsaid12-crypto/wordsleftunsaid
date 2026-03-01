---
name: post-content
description: Post the latest rendered video to social media
---

## Steps

1. Check the content queue status:
   ```bash
   npx tsx packages/social/src/index.ts status
   ```

2. If there are no scheduled items, run the full pipeline:
   ```bash
   npx tsx packages/social/src/index.ts ingest
   npx tsx packages/social/src/index.ts caption
   ```

3. Post the next scheduled item:
   ```bash
   npx tsx packages/social/src/index.ts post
   ```

4. For a dry run (preview without publishing):
   ```bash
   npx tsx packages/social/src/index.ts post --dry-run
   ```

5. Report success with the post ID from the output.

## Key Files
- Publish flow: `packages/social/src/platforms/instagram/publish.ts`
- Content queue: `packages/shared/src/db/content-queue.ts`
