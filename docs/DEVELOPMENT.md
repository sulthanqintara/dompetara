# Dompetara development and operations

Setup, testing, and maintenance guidance for contributors. Coding rules live in [AGENTS.md](../AGENTS.md); implementation status and verification history live in [FEATURE_CHECKLIST.md](../FEATURE_CHECKLIST.md). Deployment records below describe the setup verified on their stated dates.

## Visual style guide

With `pnpm dev` running, open `/style-guide` to review the Dompetara design system: light/dark colors, Geist typography, spacing, semantic colors, and shadcn control specimens. It uses the existing saved-language/browser preference flow for English and Indonesian. The same palette powers the app; specimens retain their individual light/dark appearance. The route and its metadata render only when `NODE_ENV` is `development`; production and test environments invoke `notFound()`.

Palette values live in `src/features/branding/design-system.ts`. Run `pnpm test:design-system` to check text/control contrast and the route's environment guard. Contrast targets follow [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html); labels and icons accompany semantic colors per [Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html). The root layout emits palette CSS variables from this source, so the guide and runtime theme share one set of values.

`colorScales` defines nine fixed shades (100–900) for neutrals, brand green, income green, red, blue, and amber. `colorRoles` maps light/dark semantic roles to references such as `brand.500`; `shadeColor` resolves them for previews and runtime CSS. White is a separate endpoint. The guide displays exact HEX and rounded HSL values alongside shade numbers and marks 500 as the base. Tests verify ordered shade keys, progressively decreasing luminance, HSL conversion, translated family labels, role resolution, and contrast for the actual theme pairings. A shade's position alone does not guarantee accessible text contrast.

`next-themes` applies a `light`/`dark` class before hydration, follows the system appearance by default, and stores explicit choices in browser local storage under `dompetara-theme`. The header toggle shows the current theme (sun for light, moon for dark) and chooses the other theme; Settings also offers System. After interaction, the incoming icon spins/bounces with a brief gold/blue glow. Reduced motion retains only the color pulse; initial load stays still. Controls wait for hydration before reading the resolved theme. Shared app styles, shadcn primitives, charts, and the monochrome brand mark use the palette roles. Source icon illustrations retain their artwork colors.

With the dev server and test database configured, run `pnpm test:theme:browser` for both themes/locales at phone, tablet, desktop, and short viewport sizes, including editors, keyboard activation, system changes, reload persistence, and cross-tab synchronization. It creates and removes its own temporary account. Set `THEME_SCREENSHOTS` to save renders and `LEDGER_TEST_URL` to target another running server.

Run `pnpm test:theme-toggle:browser` with a running server to check icon meaning, temporary color and reset, reduced motion, keyboard activation, and touch targets in both locales without database fixtures.

The design reference is *Refactoring UI*: Working with Color (fixed shades and saturation, printed pages 129–138), Hierarchy is Everything (action hierarchy, pages 52–54), and Layout and Spacing (restricted spacing scales and grouped fields, pages 60–64 and 83–86). The guide uses these principles with Dompetara's own values: a deep brand fill shared between themes, separate readable semantic text shades, an explicit hover shade, and tighter spacing within a field than between groups. PDF assets remain outside the repository.

## Database schema workflow

The TypeScript schema exported by `src/lib/db/schema.ts` is the source of truth. Edit it, run `pnpm db:push`, review the SQL and confirmation prompt, then run `pnpm test:db`. The strict, verbose push command compares the actual database with the schema and applies approved differences directly, without creating migration files or requiring a migration journal. It manages only the ten app tables in `public`; add new app tables to the allowlist in `drizzle.config.ts` and the permission list in `scripts/database-security.sql`.

The command then runs `scripts/secure-database.ts` to revoke direct Supabase API access, preserve the exchange-rate service grant, and ensure the cron/HTTP extensions exist. These operations are idempotent. Receipt bucket policies and exchange-rate job provisioning still use their separate setup scripts described below. `DATABASE_URL` must point at the intended Supabase project; the existing TLS-aware tooling configuration supports the session pooler on port 5432.

Fetch and reconcile the latest code before updating a shared database. Changes applied from another checkout can make an older checkout incompatible. Never use `--force` or accept a drop/truncate operation against populated data without explicit approval. Take a database backup before destructive changes. Renames and data transformations need reviewed one-time SQL rather than automatic drop-and-create. Direct push does not provide a saved SQL history or automatic rollback, and must not run during application startup, builds, or deployment. Existing files under `drizzle/` document past releases and support legacy-cutover tests; the old `db:generate`/`db:migrate` scripts are removed.

Run `db:push` in an interactive terminal so you can review and answer its confirmation prompt. Local Supabase containers must grant the connection role permission to create tables in `public` and use the database configured for `pg_cron` (normally `postgres`).

## Setup

1. Copy `.env.example` to `.env` if you do not already have one. In Supabase's Connect dialog, choose Direct, then Session pooler, and copy its Postgres connection string into `DATABASE_URL`. Replace the password placeholder, URL-encode special characters in the password, and add `?sslmode=require`. Copy the actual pooler host from the dialog. Set a random `BETTER_AUTH_SECRET` and your app origin as `BETTER_AUTH_URL`.
2. Create a Google OAuth **Web application** client. Add `http://localhost:3000` as an authorized JavaScript origin and `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI. Add your own Google account as a test user if the consent screen is in testing mode.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. For production, register the corresponding production origin and callback and update `BETTER_AUTH_URL`. See [Better Auth’s Google setup](https://better-auth.com/docs/authentication/google).
4. Run `pnpm install`, `pnpm db:push`, and `pnpm dev`.
5. Sign in and create your first wallet with its opening balance. Edit the wallet to add other currencies.

Better Auth manages identity and sessions; Supabase supplies Postgres, not Supabase Auth. Keep database credentials server-side. The ledger table has RLS enabled with no public policies; the server database role must own the table or have BYPASSRLS. Migrations revoke access to the auth and ledger tables from Supabase's public API roles.

## Local development on the Poco Pad

`pnpm dev` listens on all network interfaces. On the same Wi-Fi, open the Mac's current LAN IP on port 3000 (currently `http://192.168.1.99:3000`). The dev asset allowlist automatically includes the Mac's current IPv4 addresses, so changing networks does not require editing `next.config.ts`.

For Google sign-in, use Tailscale's private HTTPS address: Google does not permit ordinary LAN IPs as OAuth callbacks, and `localhost` on the tablet points to the tablet itself. Connect Tailscale on both the Mac and Poco Pad to the same tailnet, and put the existing database and OAuth credentials in `.env.local` using `.env.example` as the template. Then run:

```sh
pnpm dev:tablet
```

This command checks the required credentials, discovers the Mac's Tailscale hostname, configures Tailscale Serve on HTTPS port 8443 forwarding to local port 3000, and starts Next.js with the matching Better Auth URL. It uses a fixed local port; stop another server on port 3000 first. It leaves the private proxy configured after stopping Next.js; turn it off with `tailscale serve --https=8443 off`.

For this Mac, open **https://sulthans-mac-mini.tailad97fe.ts.net:8443** in Chrome on the Poco Pad. In Google Cloud project `personal-ledger-510306`, edit the existing **NextJS-personal-ledger** OAuth Web client and add:

- Authorized JavaScript origin: `https://sulthans-mac-mini.tailad97fe.ts.net:8443`
- Authorized redirect URI: `https://sulthans-mac-mini.tailad97fe.ts.net:8443/api/auth/callback/google`

Keep the existing localhost and production entries. If the Google consent screen is in testing mode, your Google account must be a test user. Sign in and continue using the HTTPS address on both devices during a tablet session; its cookies and callbacks belong to that address. Ordinary `pnpm dev` still uses your environment file's `BETTER_AUTH_URL`. On a different Mac, use the origin and callback printed by `pnpm dev:tablet`.


## Private receipt images

**Save receipt image** starts unchecked. Confirming an opted-in transaction uploads a resized JPEG to the private Supabase `receipt-images` bucket. The server validates the decoded format, rejects multi-page/oversized images, limits decoding to 36 million pixels, and strips EXIF/GPS and other metadata. The stored copy is at most 1600 pixels on its longest edge and 4 MB; it is not an archival copy of the original file.

Transaction history exposes **View receipt** for saved images. The viewer supports a full-size view, load-error retry, and independent image removal. The expense editor also shows the saved copy and can remove it on Save. Older receipt transactions can attach an image without re-running extraction. Images discarded before this feature cannot be recovered. Images are retained until removed or their transaction/account is deleted; removing an image does not change the amount or receipt details. Ledger exports contain attachment IDs, not image bytes or public URLs; they are not an image backup.

Enable storage before using the feature in production:

1. Apply `pnpm db:push` with the existing server database connection. The new `receipt_images` table enables RLS and denies `anon`/`authenticated` access.
2. Run [`scripts/setup-receipt-storage.sql`](scripts/setup-receipt-storage.sql) in the Supabase SQL editor. This creates or enforces a **private** bucket with JPEG-only uploads and a 4 MB limit. Do not add public/client storage policies.
3. Configure server-only `SUPABASE_URL` (the project's HTTPS API URL), `SUPABASE_SERVICE_ROLE_KEY`, and a random `CRON_SECRET` in the app's runtime environment, then redeploy. Never use `NEXT_PUBLIC_` variables for these credentials. Keep local configuration in ignored environment files.

Better Auth owns identity, not Supabase Auth. The app verifies the current session, ledger link, and attachment owner before streaming image bytes through `/api/receipts/image`; it never returns a public or signed storage URL. Responses use `private, no-store`, and object names use random IDs without receipt filenames or merchant names. Supabase supplies encryption at rest and production requests use HTTPS; this is not end-to-end encryption.

Image upload and ledger confirmation share one save operation. A storage failure leaves the ledger unchanged; version conflicts clean the staged object, and import retries do not upload/charge twice. A persisted record tracks objects before upload so a crashed request cannot leave an untracked file. Removal revokes app access as soon as the ledger save commits and attempts physical deletion immediately. Failed deletions, staged uploads older than one hour, and objects belonging to deleted accounts are retried by `/api/receipts/cleanup` at 03:00 UTC daily via `vercel.json`. Account deletion sets the attachment owner to null rather than erasing its cleanup record. Check the protected job's response/logs for `failed` counts; queued cleanup is not proof of physical deletion. The endpoint requires `Authorization: Bearer CRON_SECRET`. Each run processes up to 50 objects, so a larger backlog needs further runs. AI-provider retention is separate from the app's image retention.

`pnpm test:receipt-images` exercises the actual app API and browser with temporary accounts, synthetic images, a real Postgres database, and a local Supabase Storage protocol double. Run `node tests/helpers/receipt-storage-server.mjs` in a separate terminal, then run the app with `SUPABASE_URL=http://127.0.0.1:54330`, `SUPABASE_SERVICE_ROLE_KEY=receipt-storage-test-key`, and a test `CRON_SECRET`. Use the same database/auth/cron configuration for the test command, plus `RECEIPT_STORAGE_TEST_URL=http://127.0.0.1:54330`. Use an isolated local/test app and database, never production storage. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` and `RESPONSIVE_SCREENSHOTS` work as in the main responsive suite. The tests cover opt-out, owner-only access, forged IDs, metadata stripping, retries, upload/deletion failures, concurrent saves, account/transaction cleanup, and eight viewport sizes. `RECEIPT_IMAGES_API_ONLY=1` skips the browser checks. The general responsive suite now uses the committed synthetic `tests/fixtures/receipt.png`; real personal samples remain ignored.


## Language support

The app supports English and Bahasa Indonesia through `next-intl`, keeping existing URLs. Run `pnpm db:push` before starting the app to create the private `user_preferences` table without modifying ledger data.

The server chooses the saved account language first, then the language cookie, then the preferred browser language (`id` / `id-ID` selects Indonesian; other languages fall back to English). A bilingual modal appears after sign-in if it has never been shown to that account. Its shown marker is persisted on display; choosing a language or dismissing it saves the preference and updates the cookie. **Settings → Language** changes it later. There is no IP detection.

`messages/en.json` and `messages/id.json` contain app text and matching message keys. Use `useTranslations("UI")` in components and `getTranslations("UI")` on the server. Use whole ICU messages for sentences with dynamic values. Existing domain/API error messages remain stable and are translated at the display boundary through `useErrorMessage`; add corresponding `Errors` entries when introducing a user-facing error. Unknown provider errors receive a safe translated fallback.

App labels, accessibility text, calendar labels, dates, displayed amounts and manifest descriptions follow the selected language. Currency input parsing remains tied to the currency, preserving its existing decimal conventions. Custom wallet/category names, transaction titles, notes and printed receipt text remain unchanged; identified default categories and generated transaction titles are translated for display. Receipt extraction receives the language for generated warnings and suggestions.

`pnpm test:i18n` checks locale precedence, validation, matching dictionaries, ICU messages and untranslated JSX. `pnpm test:i18n:browser` checks both languages at phone, tablet, desktop and short viewport sizes, using temporary test accounts in the configured database. Set `I18N_SCREENSHOTS` to save screenshots. Browser tests require schema synchronization and a running app pointed at the same test database.

For every new feature, follow the internationalization rules in `AGENTS.md`: add both translations, use whole ICU sentences, localize formatting and errors, preserve user content, and review affected views in both languages. `pnpm build` runs the i18n checks before Next.js, so detected translation regressions block production builds. The scan covers JSX text and literal, conditional, and template expressions in visible children and copy/accessibility props. Computed strings, third-party copy, and translation quality still need review; extend the scan when introducing new patterns. Use `pnpm build` in deployment configuration rather than calling `next build` directly.

## Ledger behavior

- Wallets can contain IDR, USD, and CAD balances. Amounts use integer minor units with at most two decimal places.
- Monthly income and expenses are shown in the selected currency. Total balance is the current balance across all wallets in that currency; currencies are never added together.
- Transfers select source and destination wallets/currencies. Different-currency transfers suggest an ECB reference rate from the shared database cache. Enter both actual amounts to calculate the effective rate: CAD 159.33 sent and IDR 2,000,000 received gives 1 CAD = 12,552.563861168644 IDR. Changing either actual amount preserves the other and recalculates the rate; explicitly editing the rate or choosing the suggested rate recalculates the received amount instead. Amounts before service fees and the applied rate/source/date are saved with the transfer and survive future reference-rate updates.
- Optional transfer fees are linked Admin fees expenses, charged in the selected source or destination balance's currency. A Rp200,000 transfer with a Rp1,000 destination fee debits Rp200,000 from the source and credits Rp199,000 net to the destination. Fees appear in spending reports. Editing/deleting the transfer updates/removes its fee in the same ledger save; the fee's Edit button opens its parent transfer.
- Wallet balance edits append corrections. Opening balances and corrections are excluded from income/expense reports and cannot be edited or deleted as ordinary transactions.
- Editing or deleting an income, expense, or transfer recalculates affected balances. Corrections remain fixed historical adjustments. Negative balances are allowed.
- Removing a category preserves its name in transaction history.
- Times are entered and displayed in the device timezone and stored as UTC instants. Month boundaries use the device timezone.
- Every API operation uses the authenticated user ID. Version checks reject conflicting saves from different tabs instead of overwriting changes.
- Each user ledger is stored as one JSON document. Large histories will eventually need normalized entries and pagination.

## Receipt import

Add `ZAI_API_KEY` to your existing `.env` and restart the app. Use a Z.ai API key with access to the general API, not a browser login or a coding-plan endpoint. The server calls [GLM-OCR layout parsing](https://docs.z.ai/api-reference/tools/layout-parsing) and [chat completions](https://docs.z.ai/api-reference/llm/chat-completion). No key is sent to the browser. Without a key, receipt reading shows a setup error and ordinary ledger features remain usable.

In Transactions, choose **Import receipt**, then **OCR** or **AI** before reading a JPEG/PNG. OCR uses `glm-ocr` followed by a text-only `glm-4.6v-flash` call to structure the recognized text. AI sends the image directly to `glm-4.6v-flash`. Native `fetch` handles provider calls, Sharp handles server image decoding/resizing, and Zod validates the provider response and saved metadata; no AI SDK is needed for this request/response flow. Images up to 16 MB are resized in the browser; the server validates the decoded format, pixel count and upload size, then normalizes the image. Images are sent to Z.ai and are temporary in the app; only confirmed structured details are stored in the ledger.

Review the original image, merchant, date/time, currency, wallet, category and final total. Both reading methods suggest an expense category with a reason, preferring your existing categories. An unfamiliar suggestion offers **Use new category** and an editable name; the category and expense are saved together, and equivalent existing names are reused. You can override the suggestion. Missing extracted fields stay empty. Select **Total only** or **Total and individual items**. Item details include quantities, optional unit prices and line totals, plus signed tax/service/discount/rounding adjustments. Every retained line total must be present, and their sum plus adjustments must equal the final total. One expense debits the wallet once; items are metadata, not additional expenses. Payment screenshots require explicit confirmation that they represent spending; movements between your own wallets belong in a transfer.

When a visible paying bank matches exactly one of your wallets in the charged currency, review preselects it and shows the payment-source evidence. You can change it before saving. Unknown sources or multiple matching accounts require manual selection. Bank debits use the amount actually charged: an OpenAI purchase converted to IDR stays an IDR expense, including fractional rupiah, without reconstructing the USD price or tax.

Use **Note (optional)** to record context such as “birthday gift for a friend.” Notes use the existing transaction `description` field, remain editable on ordinary and receipt transactions, and are preserved in JSON/CSV exports for future AI summaries.

Receipt details can be edited or deleted through the transaction's Edit action and are preserved in JSON and the CSV `receipt_details` column. Import IDs and image fingerprints prevent repeat saves, including retries after a lost response; deleting an expense retains its import record so a late retry cannot recreate it. Different photos of the same physical receipt are not guaranteed to be detected. Receipt admission is shared across server instances through PostgreSQL. Each user can start five attempts per UTC minute and 30 per UTC day, with one active attempt at a time. The default global limits are 100 attempts per UTC day and three active attempts; configure `RECEIPT_GLOBAL_DAILY_LIMIT` and `RECEIPT_GLOBAL_CONCURRENCY` on the server (zero disables new extractions). Admission follows authentication, bounded form validation, provider configuration and ledger lookup; admitted attempts count even if image decoding or the provider fails. Locks expire after 90 seconds if a worker stops. A separate intake limit bounds malformed requests before body parsing.

`pnpm test` includes receipt reconciliation/retry/export checks and mocked provider requests. Browser tests also mock extraction, so they make no live provider calls. `RESPONSIVE_SCOPE=receipts pnpm test:responsive` runs the receipt flows alone. Optionally set `RECEIPT_TEST_IMAGES` to a JSON array of local image paths to exercise browser resizing with real samples. Live access was verified with five supplied samples on 2026-10-02. Both modes extracted correct totals in successful calls, but wrapped/blurry item rows and category suggestions still need review; provider overload can also return a busy error. See `FEATURE_CHECKLIST.md` for the observed results.

Local originals and expected totals for all seven samples live in `tests/receipt-images/`, which is gitignored. Run `pnpm test:receipts:live` to send all local samples through both providers, or `pnpm test:receipts:live shopee-bca openai-idr-debit` for the new cases only. This optional command uses the configured key and makes live provider calls; it never saves ledger entries. On 2026-10-03 both modes read Shopee as IDR 81,200 with BCA selected and the OpenAI debit as IDR 202,177.34 with manual wallet selection and a pending warning. The Shopee sample was subsequently replaced with the expanded timeline: both modes selected Waktu Pembayaran (2026-09-28 13:26), rather than order, shipping or completion timestamps. Hidden discount and item details still require review.

## Exchange-rate cache and scheduled refresh

The `exchange_rate_cache` Postgres table stores dated ECB snapshots for USD→IDR and USD→CAD; reverse and cross rates are derived with 12-decimal fixed precision. Money conversions round once to integer minor units. The authenticated `/api/exchange-rates?from=USD&to=IDR&date=YYYY-MM-DD` route reads the latest cached snapshot on or before the selected date. It never fetches the provider. Dates earlier than the available cache history require manual entry.

After migrating the database, log the Supabase CLI into the project's account and run:

```sh
pnpm fx:setup YOUR_PROJECT_REF
```

This deploys `refresh-exchange-rates`, configures a private refresh token in Supabase function secrets and Vault, installs the named cron job, and performs the initial refresh. It is repeatable for the same project; it does not create duplicate jobs. The linked Supabase project has already been configured.

The job runs at 17:00 UTC on weekdays, with 18:00/19:00 retry slots. Fresh snapshots skip provider requests based on `Cache-Control` and `Age`; expired snapshots send their ETag using `If-None-Match`. HTTP 304 preserves rates and updates verification metadata; successful HTTP 200 responses are validated and stored. Errors preserve the previous snapshot. New publication dates retain earlier cached snapshots for historical defaults. Reference dates and last-check timestamps remain distinct, and the UI warns after four days without successful verification. ECB holidays can retain earlier rates; these defaults are estimates, and the bank's actual converted amount takes precedence.

The table has RLS enabled and denies direct access to `anon` and `authenticated`; the app's existing server connection reads it. Only the protected refresh function writes through the service role. The function does not accept rates or provider URLs from callers, and refresh secrets never reach the browser. Inspect the job in Supabase Cron and its response in `net._http_response`; a queued HTTP request does not by itself prove the refresh succeeded.

Supabase Free projects can still pause for low activity. An internal cron is not a guaranteed exemption and cannot run while Postgres is paused. The GitHub Actions keep-alive workflow runs `select now()` against Postgres daily; add the pooler connection string as the repository Actions secret `DATABASE_URL`, then use **Actions → Supabase keep-alive → Run workflow** to verify it. See [Supabase's pausing policy](https://supabase.com/docs/guides/platform/free-project-pausing). Provider details: [Frankfurter](https://frankfurter.dev/) and [ECB reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/html/index.en.html).

## Checks

Requires Node 22.18+ (Node 24 recommended).

```sh
pnpm test
pnpm test:db
pnpm lint
pnpm typecheck
pnpm build
```

Tests cover exact money and exchange-rate parsing, conversion rounding, all currency directions, provider validation, cache expiry and 200/304/error paths, corrections, linked source/destination fees, transfer edits/deletion, category history, and invalid wallet references. A live Google sign-in and persistence check requires working OAuth credentials and a reachable database synchronized with the current schema.

`pnpm test:db` uses `.env` to check the live database connection, the current session schema, privacy guards, table permissions, and server reads/writes. Its sample records are rolled back.

The layout starts with phones and adds tablet/desktop layouts using `min-width` media queries. `AGENTS.md` makes mobile-first design a rule for future features.

With the app running and the same `.env` database/auth configuration, run `pnpm exec playwright install chromium` once, then `pnpm test:responsive`. This renders sign-in, every tab, and the editors at eight phone/tablet/desktop and landscape sizes. It checks overflow, touch controls, input text, long content, opened shadcn dropdowns/date pickers/confirmations, keyboard navigation, focus restoration, required transfer wallets, category and transaction saves, accessible pie chart breakdowns, report month/currency filtering, and single/empty periods. On narrow phones and desktops it also saves and reopens transfers with source/destination fees, checks their balances and reports, preserves manual amounts and saved reference rates, supports missing-cache manual entry, and verifies that ordinary transfers never refresh the shared cache. It creates a temporary account and ledger and deletes them afterward. Set `RESPONSIVE_SCREENSHOTS` to a directory to capture screenshots, `LEDGER_TEST_URL` to another local app URL, or `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing Chromium executable. If you use another port, start the app with a matching `BETTER_AUTH_URL` so its origin check permits saving.

## Deployment notes (recorded 2026-10-03)

### Speed Insights

`@vercel/speed-insights/next` is mounted once in `src/app/layout.tsx`, covering every page and tracking route changes. The component has no visible UI. On Vercel, it loads `/_vercel/speed-insights/script.js`; a plain local production server does not provide that endpoint. Deploy the integration before expecting real visitor metrics.

View results in the project's [Speed Insights dashboard](https://vercel.com/msulthanqs-projects/personal-ledger/speed-insights). To check production data from the CLI without a local project link:

```sh
pnpx vercel metrics schema vercel.speed_insights --scope msulthanqs-projects
pnpx vercel metrics vercel.speed_insights.lcp_ms --aggregation p75 --group-by route --since 7d --project personal-ledger --scope msulthanqs-projects --prod
```

An empty response means there are no collected samples for that query; it is not a performance score. Use `inp_ms` and `cls` in place of `lcp_ms` for the other Core Web Vitals. Real Experience Score is available in the dashboard. See [Vercel's metrics guide](https://vercel.com/docs/speed-insights/accessing-metrics-with-vercel-cli).

### Production configuration

Production: https://dompetara.my.id (legacy alias https://personal-ledger-inky-alpha.vercel.app; project `personal-ledger`, scope `msulthanqs-projects`, owned by `sulthanqintara@gmail.com`, Node.js 24).

Production environment variables are configured on Vercel: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ZAI_API_KEY`, and `ENABLE_EXPERIMENTAL_COREPACK=1` to use the pinned pnpm version. Local credentials stay in local environment files. `.vercelignore` explicitly excludes environment files, local receipt samples and `.claude` worktrees from CLI uploads.

Google OAuth is configured in the `personal-ledger-510306` Google Cloud project under `sulthanqintara@gmail.com`, using the existing `NextJS-personal-ledger` client. Its authorized redirect URIs include `https://personal-ledger-inky-alpha.vercel.app/api/auth/callback/google` and the existing localhost callback. Production Google sign-in was verified through the callback to `/transactions`, with authenticated ledger access returning HTTP 200.

The project was transferred to the personal account on 2026-10-03, preserving its production URL, deployments and environment variables. The CLI is signed in to the personal account and linked locally. Redeploy the current workspace with `vercel deploy --prod --scope msulthanqs-projects`. GitHub repository `sulthanqintara/dompetara` is connected, with `main` as the production branch; future pushes trigger Git deployments. Production variables are scoped to production; configure separate preview settings before using preview deployments.

Deployment verification (2026-10-03): cloud build succeeded, the sign-in page loaded, unauthenticated ledger access was rejected, authenticated reads/writes and reload persistence passed with a temporary test account, invalid origins were rejected, and live production OCR returned Shopee IDR 81,200 with payment date/time 2026-09-28 13:26 and the matching BCA wallet. Test accounts and their data were deleted; no receipt expense was saved.

### Authentication data minimization

Google sign-in retains name, email, email verification status, local IDs, the stable Google subject, and timestamps. The subject is necessary for returning-user identity and is still a personal identifier. Create/update hooks discard profile images, Google access/refresh/ID tokens, token expiry dates and scopes, and session IP/user-agent fields. Tokens exist briefly in memory during OAuth verification; Google API integrations and token-refresh endpoints must not depend on persisted provider tokens. `includeGrantedScopes: false` avoids requesting previous grants. OAuth state/PKCE data uses Better Auth's encrypted ten-minute state cookie, with existing origin/state checks intact; provider account cookies and session cookie caching remain disabled. Request rate limiting still processes IPs transiently and stores HMAC-derived budget keys, independently of session records.

Session storage uses Better Auth's authenticated symmetric encryption with a purpose-derived key from `BETTER_AUTH_SECRET`. A separate SHA-256 digest of each high-entropy random session token provides database lookup. The adapter encrypts writes, rewrites token predicates, decrypts reads and joined session results, and wraps transactions; digests are never returned to clients. Keep the secret server-only and at least 32 characters. Changing it invalidates session cookies and the encrypted session records; revoke sessions as part of intentional rotation. Ciphertext/plaintext corruption fails closed. Encryption protects against database-only disclosure, not compromise of the running application or its secrets. The operator still has access to name/email and ledger contents; operator-blind storage needs a separately designed client-held-key encryption and recovery flow.

Historical migrations `0007_auth_privacy` and `0008_auth_privacy_guards` performed the production privacy cutover on 2026-10-09. They cleared legacy sessions/provider credentials/photos and installed session/privacy constraints while preserving profiles/account links/ledgers. They are retained as history and legacy-cutover test fixtures; do not replay them. Future schema changes use `pnpm db:push`. An upgrade from a legacy database containing plaintext sessions or retained credentials needs a reviewed one-time cleanup operation before privacy constraints can be applied; direct push does not transform those records. Historical cleanup does not erase backups or provider logs; apply their retention policies separately. Restoring legacy application code alone is not a valid rollback because it cannot write sessions under the current privacy constraints.

`pnpm test` includes in-memory authentication/privacy regression coverage. For isolated PostgreSQL migration and Google-flow checks, set `AUTH_TEST_DATABASE_URL` to a localhost test database and run `pnpm test:auth:db`. The test creates and drops a unique schema, checks cleanup with seeded legacy records, exercises real adapter transactions and cookie sessions with only Google's verification/token responses mocked, and proves returning users can sign in without stored Google tokens. Never point this command at production. Browser/security fixtures and navigation profiling use the shared session codec when seeding test sessions.

### Database pooling on Vercel

Production `DATABASE_URL` must use the Supabase **transaction pooler** on port `6543`; copy the host and credentials from the project's Connect dialog. Local schema tooling can retain the session endpoint on port `5432`. Environment changes take effect on a new deployment. The application rejects a Supabase session-pooler URL when `VERCEL=1`, so a future configuration mistake fails with a safe diagnostic.

The runtime uses Drizzle's `node-postgres` driver with one shared `pg.Pool` per server instance, `max: 2`, a 10-second connection timeout, and a five-second idle timeout. `attachDatabasePool` from `@vercel/functions` allows idle connections to close before Vercel suspends an instance. Two connections is a per-instance limit; multiple instances can still create more clients. Supabase transaction mode releases the underlying database connection at the end of each transaction. Avoid named prepared statements and session-scoped database state; use explicit transactions for atomic work. Drizzle Kit schema synchronization uses the installed `pg` driver with explicit connection fields and the same trusted Supabase CA; the session pooler remains supported for schema synchronization.

Supabase pooler connections verify TLS against the bundled public Supabase Root 2021 CA, valid until 2031-04-26. The certificate comes from [Supabase's certificate download](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt); replace it before expiry or if Supabase rotates its root. URL SSL options are removed for this endpoint so they cannot override CA verification. Better Auth failures use the safe server logger rather than printing raw query parameters or session objects.

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` for the driver/configuration change. `pnpm test:db` checks live schema/privacy guards, API access restrictions and rolled-back database writes. Verify an authenticated wallet/report read, exchange-rate fetch, concurrent ledger requests, a synthetic wallet save and reload, then remove the temporary account.


### Shared request protection

Run `pnpm db:push` **before** deploying schema changes. The security schema includes two server-only tables with RLS and revoked `anon`/`authenticated` permissions. Admission uses transaction-scoped advisory locks and the database clock to atomically consume all applicable budgets, including concurrent first requests. Denials create no extra buckets; expired rows are swept in bounded batches. Stored keys are HMAC hashes rather than IP addresses or user IDs. `SECURITY_LIMITER_SECRET` may provide a stable 32+ character key; otherwise `BETTER_AUTH_SECRET` is used. Rotating this key resets effective budgets.

Shared budgets use fixed windows aligned to the UTC epoch, including Better Auth endpoint budgets. Better Auth keeps its endpoint window lengths/maximum counts and additionally enforces 100 requests per IP/minute and 600 globally/minute. Only Vercel's overwritten `x-vercel-forwarded-for` ingress header is trusted. App limits per user/minute (global/minute) are ledger reads 120 (1,200), ledger writes 30 (300), preferences 30 (300), exchange-rate reads 120 (1,200), receipt images 60 (600), and extraction intake 10 (200). API denials return 429 with `Retry-After` and `Cache-Control: no-store`; unavailable protection fails closed. Ledger pages show a translated retry state. Platform DDoS mitigation remains necessary because requests still reach authentication and the database; these budgets bound application work and provider use, rather than proving resistance to arbitrary traffic volume.

Ledger mutations allow up to 50 wallets, 200 categories, 10,000 transactions, 10,000 retained receipt-import records, and 3,000,000 serialized UTF-8 bytes. Existing overages may be edited without growth or reduced. Server-generated image references are included in the final size check before upload. Balance validation visits transactions once. Receipt model context includes at most 50 categories and 50 wallets, names no longer than 100 Unicode code points, and 16,000 total UTF-8 bytes; names are preserved exactly and oversized names are omitted.

`pnpm test` includes limiter policies, legacy ledger recovery and bounded mocked-provider prompts. To test atomic admissions, expiry and concurrency across independent pools against an **isolated local PostgreSQL database**, set `SECURITY_TEST_DATABASE_URL` and run `pnpm test:security:db`. This test refuses remote hosts and creates/removes its own temporary schema; it never falls back to `DATABASE_URL`. No traffic flood is used for verification.

`pnpm test:security:api` requires `SECURITY_TEST_DATABASE_URL`, `SECURITY_TEST_URL` and the isolated app's `BETTER_AUTH_SECRET` (plus `SECURITY_LIMITER_SECRET` if configured). Start a production build against that same local database and secret. This test creates/removes a synthetic account, seeds quota counters, and briefly renames a limiter table to exercise fail-closed handling; use an exclusive disposable local database. It refuses remote URLs and makes no provider calls.

### Account deletion

Better Auth account deletion is enabled with its default recent-session check. Settings uses a shadcn account confirmation dialog; successful deletion performs a full navigation to sign-in to discard in-memory ledger data. Foreign keys cascade ledger, preferences, linked accounts, and sessions; receipt image ownership becomes null so the existing cleanup job can remove stored objects. The existing auth route logging wrapper covers failures.

Run `pnpm test:account-deletion` against a local app (`LEDGER_TEST_URL`, default `http://localhost:3000`) and a disposable database synchronized with `pnpm db:push`. The app and test must share `DATABASE_URL` and `BETTER_AUTH_SECRET`. The test creates and removes synthetic accounts and receipt metadata, makes no OAuth or storage calls, and verifies both languages at phone, tablet, desktop, and short viewport sizes, confirmation/cancel/focus, safe errors, cascading deletion, cross-user isolation, stale sessions, unauthenticated access, and origin protection. Set `ACCOUNT_DELETION_SCREENSHOTS` to save screenshots and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to select a browser.
