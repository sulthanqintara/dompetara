<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Code rules

## Architecture: feature-based

- Routing lives only in `src/app/` (pages/routes stay thin; logic goes in features).
- Feature code lives in `src/features/<feature>/`:
  - `<feature>.ts` — domain logic (types, pure functions); may be shared with the server.
  - `api.ts` — network calls for the feature.
  - `hooks.ts` — React hooks (state, data fetching).
  - `derive.ts` / `format.ts` — pure derived-data and formatting helpers.
  - `components/` — UI components for the feature.
- Cross-cutting concerns (auth, db) stay in `src/lib/`; shadcn primitives in `src/components/ui/`.

## File granularity: one component/function per file

- Each component file exports exactly one React component (named export; default export only where Next.js requires it).
- No god files: split multi-view, modal, and helper code into separate files.
- Domain modules (`src/features/*/*.ts`) are the exception: they may group cohesive pure functions.
- Extract API calls into `api.ts` instead of `fetch` inside components; extract business math into `derive.ts`/domain modules instead of computing inside components.

