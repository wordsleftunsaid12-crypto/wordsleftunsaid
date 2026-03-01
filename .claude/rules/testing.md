---
description: Testing conventions
globs: ["**/*.test.ts", "**/*.spec.ts"]
---

- Use vitest for all packages
- Test files: `*.test.ts` colocated or in `tests/` directory
- Mock Supabase client in unit tests
- Name tests descriptively: `it("returns approved messages sorted by date")`
- Test edge cases: empty results, malformed input, network errors
