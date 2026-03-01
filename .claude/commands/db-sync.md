---
name: db-sync
description: Check Supabase status and run migrations
---

## Steps

1. Check Supabase connection by running a simple query via the shared package

2. Run any pending migrations:
   ```bash
   npx supabase db push
   ```

3. Report current table counts and migration status
