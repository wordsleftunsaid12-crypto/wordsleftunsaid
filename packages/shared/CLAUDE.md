# @wlu/shared

Shared utilities, types, and database client for all packages.

## Structure

- `src/types/` — TypeScript interfaces and type definitions
- `src/db/` — Supabase client and data access functions
- `src/utils/` — Pure utility functions (sanitize, format, brand constants)
- `src/config/` — Environment variable validation

## Rules

- All exports must go through `src/index.ts` barrel file
- DB functions return typed results, never raw Supabase responses
- No side effects in utility functions
- Brand constants (colors, fonts) are the single source of truth
- Env config uses zod schemas; crash early on invalid env
