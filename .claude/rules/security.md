---
description: Security rules for the entire project
globs: ["**/*"]
---

- NEVER commit credentials, API keys, or tokens to git
- All secrets go in `.env` files (gitignored) with `.env.example` as template
- Supabase service role key MUST NEVER be exposed to client-side code
- Sanitize all user input before database insertion
- Content moderation: all messages require `approved: true` before display
- Rate limit API endpoints to prevent abuse
