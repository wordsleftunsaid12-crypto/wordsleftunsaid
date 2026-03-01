---
description: TypeScript coding conventions
globs: ["**/*.ts", "**/*.tsx"]
---

- Use strict TypeScript (`"strict": true` in tsconfig)
- Never use `any`; use `unknown` with type guards if truly needed
- Prefer interfaces over type aliases for object shapes
- Use const assertions for literal types
- Export types from barrel files (`index.ts`)
- Use zod for runtime validation of external data (API responses, env vars)
- Prefer named exports over default exports
