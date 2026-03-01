---
description: Supabase and database access patterns
globs: ["**/db/**", "**/migrations/**", "**/*supabase*"]
---

- All database access goes through `@wlu/shared/db` functions
- Never construct raw SQL in application code; use the Supabase client
- Always filter with `.eq()`, `.in()` etc., never string interpolation
- Paginate all list queries (default page size: 20)
- Handle errors explicitly; never ignore Supabase error responses
- Migrations in `supabase/migrations/` with sequential numbering
- Use RLS (Row Level Security) policies for public-facing tables
