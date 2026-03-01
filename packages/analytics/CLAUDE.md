# @wlu/analytics

Engagement tracking, trend analysis, and feedback loop to content engine.

## Structure

- `src/collectors/` — Pull data from each platform's API
- `src/analysis/` — Score engagement, identify trends
- `src/feedback/` — Send insights back to content engine for optimization

## Conventions

- Collectors run on schedule (cron) or on-demand
- All metrics stored in Supabase `engagement_metrics` table
- Reports generated as markdown or JSON
- Feedback loop: high-performing message attributes inform AI content generation
