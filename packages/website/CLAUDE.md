# @wlu/website

Astro 4 site for wordsleftunsaid.com. SEO-optimized, server-rendered.

## Structure

- `src/pages/` — Astro page routes
- `src/components/` — Reusable Astro components
- `src/layouts/` — Page layout wrappers
- `src/styles/` — CSS (global + variables)

## Conventions

- Use Astro components (`.astro`), not React, unless interactivity is needed
- SSR for message pages (dynamic data from Supabase)
- Static generation for landing, about pages
- SEO: every page needs title, description, OG tags via SEOHead component
- Preserve brand aesthetic: warm browns, paper texture, Poppins/Lora fonts
- Google Analytics: G-CPHLT2VM2D

## Deployment

Netlify with Astro SSR adapter.
