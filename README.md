# Personal Ledger

A private Google-account ledger built with Next.js, Better Auth, Drizzle, and Supabase Postgres.

See [the feature checklist](FEATURE_CHECKLIST.md) for completed features, remaining requirements, and open decisions.

## Setup

1. Copy `.env.example` to `.env` if you do not already have one. In Supabase's Connect dialog, choose Direct, then Session pooler, and copy its Postgres connection string into `DATABASE_URL`. Replace the password placeholder, URL-encode special characters in the password, and add `?sslmode=require`. Copy the actual pooler host from the dialog. Set a random `BETTER_AUTH_SECRET` and your app origin as `BETTER_AUTH_URL`.
2. Create a Google OAuth **Web application** client. Add `http://localhost:3000` as an authorized JavaScript origin and `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI. Add your own Google account as a test user if the consent screen is in testing mode.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. For production, register the corresponding production origin and callback and update `BETTER_AUTH_URL`. See [Better Auth’s Google setup](https://better-auth.com/docs/authentication/google).
4. Run `pnpm install`, `pnpm db:migrate`, and `pnpm dev`.
5. Sign in and create your first wallet with its opening balance. Edit the wallet to add other currencies.

Better Auth manages identity and sessions; Supabase supplies Postgres, not Supabase Auth. Keep database credentials server-side. The ledger table has RLS enabled with no public policies; the server database role must own the table or have BYPASSRLS. Migrations revoke access to the auth and ledger tables from Supabase's public API roles.

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
- Each personal ledger is stored as one JSON document. Large histories will eventually need normalized entries and pagination.

## Exchange-rate cache and scheduled refresh

The `exchange_rate_cache` Postgres table stores dated ECB snapshots for USD→IDR and USD→CAD; reverse and cross rates are derived with 12-decimal fixed precision. Money conversions round once to integer minor units. The authenticated `/api/exchange-rates?from=USD&to=IDR&date=YYYY-MM-DD` route reads the latest cached snapshot on or before the selected date. It never fetches the provider. Dates earlier than the available cache history require manual entry.

After migrating the database, log the Supabase CLI into the project's account and run:

```sh
pnpm fx:setup YOUR_PROJECT_REF
```

This deploys `refresh-exchange-rates`, configures a private refresh token in Supabase function secrets and Vault, installs the named cron job, and performs the initial refresh. It is repeatable for the same project; it does not create duplicate jobs. The linked personal-ledger project has already been configured.

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

With the app running and the same `.env` database/auth configuration, run `pnpm exec playwright install chromium` once, then `pnpm test:responsive`. This renders sign-in, every tab, and the editors at seven phone/tablet/desktop and landscape sizes. It checks overflow, touch controls, input text, long content, opened shadcn dropdowns/date pickers/confirmations, keyboard navigation, focus restoration, required transfer wallets, category and transaction saves, accessible pie chart breakdowns, report month/currency filtering, and single/empty periods. On narrow phones and desktops it also saves and reopens transfers with source/destination fees, checks their balances and reports, preserves manual amounts and saved reference rates, supports missing-cache manual entry, and verifies that ordinary transfers never refresh the shared cache. It creates a temporary account and ledger and deletes them afterward. Set `RESPONSIVE_SCREENSHOTS` to a directory to capture screenshots, `LEDGER_TEST_URL` to another local app URL, or `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing Chromium executable. If you use another port, start the app with a matching `BETTER_AUTH_URL` so its origin check permits saving.
