# Dompetara

Dompetara was previously called Personal Ledger. Existing production URLs and cloud resource IDs below retain their original names.

A private Google-account ledger built with Next.js, Better Auth, Drizzle, and Supabase Postgres.

See [the feature checklist](FEATURE_CHECKLIST.md) for completed features, remaining requirements, and open decisions.

## Setup

1. Copy `.env.example` to `.env` if you do not already have one. In Supabase's Connect dialog, choose Direct, then Session pooler, and copy its Postgres connection string into `DATABASE_URL`. Replace the password placeholder, URL-encode special characters in the password, and add `?sslmode=require`. Copy the actual pooler host from the dialog. Set a random `BETTER_AUTH_SECRET` and your app origin as `BETTER_AUTH_URL`.
2. Create a Google OAuth **Web application** client. Add `http://localhost:3000` as an authorized JavaScript origin and `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI. Add your own Google account as a test user if the consent screen is in testing mode.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. For production, register the corresponding production origin and callback and update `BETTER_AUTH_URL`. See [Better Auth’s Google setup](https://better-auth.com/docs/authentication/google).
4. Run `pnpm install`, `pnpm db:migrate`, and `pnpm dev`.
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

## Ledger behavior

- Summary income, expenses, and current and wallet balances start hidden behind dots. The eye toggle shows or hides these amounts for every currency across views; reloading hides them again.
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

In Transactions, choose **Import receipt**, then **OCR** or **AI** before reading a JPEG/PNG. OCR uses `glm-ocr` followed by a text-only `glm-4.6v-flash` call to structure the recognized text. AI sends the image directly to `glm-4.6v-flash`. Native `fetch` handles provider calls, Sharp handles server image decoding/resizing, and Zod validates the provider response and saved metadata; no AI SDK is needed for this request/response flow. Images up to 16 MB are resized in the browser; the server validates the decoded format, pixel count and upload size, then normalizes the image. Images are sent to the selected AI provider. By default they are temporary in the app; **Save receipt image** opts into retaining a private copy when the transaction is confirmed.

Review the original image, merchant, date/time, currency, wallet, category and final total. Both reading methods suggest an expense category with a reason, preferring your existing categories. An unfamiliar suggestion offers **Use new category** and an editable name; the category and expense are saved together, and equivalent existing names are reused. You can override the suggestion. Missing extracted fields stay empty. Select **Total only** or **Total and individual items**. Item details include quantities, optional unit prices and line totals, plus signed tax/service/discount/rounding adjustments. Every retained line total must be present, and their sum plus adjustments must equal the final total. One expense debits the wallet once; items are metadata, not additional expenses. Payment screenshots require explicit confirmation that they represent spending; movements between your own wallets belong in a transfer.

When a visible paying bank matches exactly one of your wallets in the charged currency, review preselects it and shows the payment-source evidence. You can change it before saving. Unknown sources or multiple matching accounts require manual selection. Bank debits use the amount actually charged: an OpenAI purchase converted to IDR stays an IDR expense, including fractional rupiah, without reconstructing the USD price or tax.

Use **Note (optional)** to record context such as “birthday gift for a friend.” Notes use the existing transaction `description` field, remain editable on ordinary and receipt transactions, and are preserved in JSON/CSV exports for future AI summaries.

Receipt details can be edited or deleted through the transaction's Edit action and are preserved in JSON and the CSV `receipt_details` column. Import IDs and image fingerprints prevent repeat saves, including retries after a lost response; deleting an expense retains its import record so a late retry cannot recreate it. Different photos of the same physical receipt are not guaranteed to be detected. The extraction endpoint allows five attempts per minute and one active request per user within a server process; use a shared limiter before deploying multiple instances.

`pnpm test` includes receipt reconciliation/retry/export checks and mocked provider requests. Browser tests also mock extraction, so they make no live provider calls. `RESPONSIVE_SCOPE=receipts pnpm test:responsive` runs the receipt flows alone. Optionally set `RECEIPT_TEST_IMAGES` to a JSON array of local image paths to exercise browser resizing with real samples. Live access was verified with five supplied samples on 2026-10-02. Both modes extracted correct totals in successful calls, but wrapped/blurry item rows and category suggestions still need review; provider overload can also return a busy error. See `FEATURE_CHECKLIST.md` for the observed results.

Local originals and expected totals for all seven samples live in `tests/receipt-images/`, which is gitignored. Run `pnpm test:receipts:live` to send all local samples through both providers, or `pnpm test:receipts:live shopee-bca openai-idr-debit` for the new cases only. This optional command uses the configured key and makes live provider calls; it never saves ledger entries. On 2026-10-03 both modes read Shopee as IDR 81,200 with BCA selected and the OpenAI debit as IDR 202,177.34 with manual wallet selection and a pending warning. The Shopee sample was subsequently replaced with the expanded timeline: both modes selected Waktu Pembayaran (2026-09-28 13:26), rather than order, shipping or completion timestamps. Hidden discount and item details still require review.

## Private receipt images

**Save receipt image** starts unchecked. Confirming an opted-in transaction uploads a resized JPEG to the private Supabase `receipt-images` bucket. The server validates the decoded format, rejects multi-page/oversized images, limits decoding to 36 million pixels, and strips EXIF/GPS and other metadata. The stored copy is at most 1600 pixels on its longest edge and 4 MB; it is not an archival copy of the original file.

Transaction history exposes **View receipt** for saved images. The viewer supports a full-size view, load-error retry, and independent image removal. The expense editor also shows the saved copy and can remove it on Save. Older receipt transactions can attach an image without re-running extraction. Images discarded before this feature cannot be recovered. Images are retained until removed or their transaction/account is deleted; removing an image does not change the amount or receipt details. Ledger exports contain attachment IDs, not image bytes or public URLs; they are not an image backup.

Enable storage before using the feature in production:

1. Apply `pnpm db:migrate` with the existing server database connection. The new `receipt_images` table enables RLS and denies `anon`/`authenticated` access.
2. Run [`scripts/setup-receipt-storage.sql`](scripts/setup-receipt-storage.sql) in the Supabase SQL editor. This creates or enforces a **private** bucket with JPEG-only uploads and a 4 MB limit. Do not add public/client storage policies.
3. Configure server-only `SUPABASE_URL` (the project's HTTPS API URL), `SUPABASE_SERVICE_ROLE_KEY`, and a random `CRON_SECRET` in the app's runtime environment, then redeploy. Never use `NEXT_PUBLIC_` variables for these credentials. Keep local configuration in ignored environment files.

Better Auth owns identity, not Supabase Auth. The app verifies the current session, ledger link, and attachment owner before streaming image bytes through `/api/receipts/image`; it never returns a public or signed storage URL. Responses use `private, no-store`, and object names use random IDs without receipt filenames or merchant names. Supabase supplies encryption at rest and production requests use HTTPS; this is not end-to-end encryption.

Image upload and ledger confirmation share one save operation. A storage failure leaves the ledger unchanged; version conflicts clean the staged object, and import retries do not upload/charge twice. A persisted record tracks objects before upload so a crashed request cannot leave an untracked file. Removal revokes app access as soon as the ledger save commits and attempts physical deletion immediately. Failed deletions, staged uploads older than one hour, and objects belonging to deleted accounts are retried by `/api/receipts/cleanup` at 03:00 UTC daily via `vercel.json`. Account deletion sets the attachment owner to null rather than erasing its cleanup record. Check the protected job's response/logs for `failed` counts; queued cleanup is not proof of physical deletion. The endpoint requires `Authorization: Bearer CRON_SECRET`. Each run processes up to 50 objects, so a larger backlog needs further runs. AI-provider retention is separate from the app's image retention.

`pnpm test:receipt-images` exercises the actual app API and browser with temporary accounts, synthetic images, a real Postgres database, and a local Supabase Storage protocol double. Run `node tests/helpers/receipt-storage-server.mjs` in a separate terminal, then run the app with `SUPABASE_URL=http://127.0.0.1:54330`, `SUPABASE_SERVICE_ROLE_KEY=receipt-storage-test-key`, and a test `CRON_SECRET`. Use the same database/auth/cron configuration for the test command, plus `RECEIPT_STORAGE_TEST_URL=http://127.0.0.1:54330`. Use an isolated local/test app and database, never production storage. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` and `RESPONSIVE_SCREENSHOTS` work as in the main responsive suite. The tests cover opt-out, owner-only access, forged IDs, metadata stripping, retries, upload/deletion failures, concurrent saves, account/transaction cleanup, and eight viewport sizes. `RECEIPT_IMAGES_API_ONLY=1` skips the browser checks. The general responsive suite now uses the committed synthetic `tests/fixtures/receipt.png`; real personal samples remain ignored.

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

Tests cover exact money and exchange-rate parsing, conversion rounding, all currency directions, provider validation, cache expiry and 200/304/error paths, corrections, linked source/destination fees, transfer edits/deletion, category history, and invalid wallet references. A live Google sign-in and persistence check requires working OAuth credentials and a reachable, migrated database.

`pnpm test:db` uses `.env` to check the live database connection, applied migrations, table permissions, and server reads/writes. Its sample records are rolled back.

The layout starts with phones and adds tablet/desktop layouts using `min-width` media queries. `AGENTS.md` makes mobile-first design a rule for future features.

With the app running and the same `.env` database/auth configuration, run `pnpm exec playwright install chromium` once, then `pnpm test:responsive`. This renders sign-in, every tab, and the editors at eight phone/tablet/desktop and landscape sizes. It checks overflow, touch controls, input text, long content, opened shadcn dropdowns/date pickers/confirmations, keyboard navigation, focus restoration, required transfer wallets, category and transaction saves, accessible pie chart breakdowns, report month/currency filtering, and single/empty periods. On narrow phones and desktops it also saves and reopens transfers with source/destination fees, checks their balances and reports, preserves manual amounts and saved reference rates, supports missing-cache manual entry, and verifies that ordinary transfers never refresh the shared cache. It creates a temporary account and ledger and deletes them afterward. Set `RESPONSIVE_SCREENSHOTS` to a directory to capture screenshots, `LEDGER_TEST_URL` to another local app URL, or `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing Chromium executable. If you use another port, start the app with a matching `BETTER_AUTH_URL` so its origin check permits saving.

## Vercel deployment

Production: https://personal-ledger-inky-alpha.vercel.app (project `personal-ledger`, scope `msulthanqs-projects`, owned by `sulthanqintara@gmail.com`, Node.js 24).

Production environment variables are configured on Vercel: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ZAI_API_KEY`, and `ENABLE_EXPERIMENTAL_COREPACK=1` to use the pinned pnpm version. Local credentials stay in local environment files. `.vercelignore` explicitly excludes environment files, local receipt samples and `.claude` worktrees from CLI uploads.

Google OAuth is configured in the `personal-ledger-510306` Google Cloud project under `sulthanqintara@gmail.com`, using the existing `NextJS-personal-ledger` client. Its authorized redirect URIs include `https://personal-ledger-inky-alpha.vercel.app/api/auth/callback/google` and the existing localhost callback. Production Google sign-in was verified through the callback to `/transactions`, with authenticated ledger access returning HTTP 200.

The project was transferred to the personal account on 2026-10-03, preserving its production URL, deployments and environment variables. The CLI is signed in to the personal account and linked locally. Redeploy the current workspace with `vercel deploy --prod --scope msulthanqs-projects`. GitHub repository `sulthanqintara/dompetara` is connected, with `main` as the production branch; future pushes trigger Git deployments. Current workspace changes are deployed through the CLI but remain uncommitted, so commit and push them before relying on Git deployments for this version. Production variables are scoped to production; configure separate preview settings before using preview deployments.

Deployment verification (2026-10-03): cloud build succeeded, the sign-in page loaded, unauthenticated ledger access was rejected, authenticated reads/writes and reload persistence passed with a temporary test account, invalid origins were rejected, and live production OCR returned Shopee IDR 81,200 with payment date/time 2026-09-28 13:26 and the matching BCA wallet. Test accounts and their data were deleted; no receipt expense was saved.
