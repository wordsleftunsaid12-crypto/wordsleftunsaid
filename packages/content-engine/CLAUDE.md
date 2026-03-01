# @wlu/content-engine

Video generation pipeline: database messages -> AI curation -> Remotion render -> FFmpeg post-processing.

## Pipeline Flow

1. Fetch approved messages from Supabase
2. Optionally generate AI variations via Claude API
3. Select template (classic/modern/emotional)
4. Render with Remotion (1080x1920 for Reels/TikTok, 1080x1080 for posts)
5. Post-process with FFmpeg (add audio, compress)
6. Output to `output/` directory

## Structure

- `src/compositions/` — Remotion React components
- `src/templates/` — Visual template variants
- `src/ai/` — Claude API integration for content generation
- `src/pipeline/` — Render and post-processing orchestration

## Conventions

- Templates must accept `MessageCardProps` from shared types
- All renders output to `output/` (gitignored)
- Video dimensions: 1080x1920 (vertical), 1080x1080 (square)
- Duration: 5-15 seconds per message, max 60 seconds per video
- Use `@wlu/shared` brand constants for colors/fonts
