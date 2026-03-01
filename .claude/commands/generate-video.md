---
name: generate-video
description: Generate a video from database messages
---

## Steps

1. Read the latest approved messages from Supabase that haven't been used in a video yet:
   - Query `packages/shared/src/db/messages.ts` for the fetch function
   - Check `content_queue` table for already-used message IDs

2. Use the content-writer agent to curate 3-5 messages and generate variations

3. Select a template from `packages/content-engine/src/templates/`

4. Run the Remotion render:
   ```bash
   cd packages/content-engine && npx remotion render src/compositions/Root.tsx MessageCard --props='{"messages": [...]}' output/video-$(date +%s).mp4
   ```

5. Post-process with FFmpeg if needed (add background audio, adjust duration)

6. Report the output file path and a preview frame
