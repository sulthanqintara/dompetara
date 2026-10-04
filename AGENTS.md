<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Code rules

## API error logging

- Always log failed API requests on the server with `console.error` through `logServerError` / `withApiErrorLogging` so their messages appear in Vercel runtime logs. Wrap new route handlers with `withApiErrorLogging` to cover error responses and uncaught exceptions.
- Log the original exception before replacing it with a friendly response, and log upstream provider failures even when a fallback succeeds. Include the method, route or provider, HTTP status when available, and failure stage.
- Never log API keys, tokens, cookies, authorization headers, request bodies, receipt images, or ledger contents. Keep detailed diagnostics server-side and preserve safe client-facing error messages.

## Design: mobile first

- Design and implement the phone layout first, then adapt it for tablet and desktop with `min-width` media queries.
- Keep navigation, amounts, forms, and actions readable and usable at 320px without page-wide horizontal scrolling.
- Give interactive controls at least 44 × 44px touch targets and use at least 16px text in form inputs.
- For UI changes, render and check every affected view at phone, tablet, and desktop sizes, including short viewports and long content. Do not consider CSS breakpoints alone proof of responsiveness. Backend-only changes do not require layout checks.

## Components: shadcn

- Always use shadcn components for new or changed UI elements. Reuse the existing Base UI preset primitives; if a required primitive is missing, add it in `src/components/ui/` before composing the feature. Ordinary semantic content and layout markup may remain HTML.

- Use the existing shadcn Base UI preset for controls, dialogs, confirmations, cards, and status states. Compose feature components from `src/components/ui/` instead of adding raw browser controls or `confirm()` calls.
- Keep labels, form field names, required validation, keyboard navigation, and focus restoration when replacing controls.
- Split generated files that export several React components into one component per file, and keep only the primitives the app uses.

## Architecture: feature-based

- Routing lives only in `src/app/` (pages/routes stay thin; logic goes in features).
- Feature code lives in `src/features/<feature>/`:
  - `<feature>.ts` — domain logic (types, pure functions); may be shared with the server.
  - `api.ts` — network calls for the feature.
  - `hooks.ts` — React hooks (state, data fetching).
  - `derive.ts` / `format.ts` — pure derived-data and formatting helpers.
  - `components/` — UI components grouped in folders by responsibility (for example, navigation, transactions, reports, and shared).
- Cross-cutting concerns (auth, db) stay in `src/lib/`; shadcn primitives in `src/components/ui/`.

## File granularity: one component/function per file

- Each component file exports exactly one React component (named export; default export only where Next.js requires it).
- No god files: split multi-view, modal, and helper code into separate files.
- Domain modules (`src/features/*/*.ts`) are the exception: they may group cohesive pure functions.
- Extract API calls into `api.ts` instead of `fetch` inside components; extract business math into `derive.ts`/domain modules instead of computing inside components.

## Libraries and validation

- Recommend a library when it meaningfully simplifies implementation or improves correctness; do not hesitate to explain the benefit and tradeoffs. Prefer existing dependencies and native APIs for simple tasks.
- Use Zod for structured external input validation and infer TypeScript types from schemas instead of duplicating validators and type definitions. Keep business rules and money calculations explicit.
