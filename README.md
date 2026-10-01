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
- Transfers record source and destination balances. For different currencies, enter both the sent and received amounts; no automatic exchange-rate estimates are used.
- Wallet balance edits append corrections. Opening balances and corrections are excluded from income/expense reports and cannot be edited or deleted as ordinary transactions.
- Editing or deleting an income, expense, or transfer recalculates affected balances. Corrections remain fixed historical adjustments. Negative balances are allowed.
- Removing a category preserves its name in transaction history.
- Times are entered and displayed in the device timezone and stored as UTC instants. Month boundaries use the device timezone.
- Every API operation uses the authenticated user ID. Version checks reject conflicting saves from different tabs instead of overwriting changes.
- Each personal ledger is stored as one JSON document. Large histories will eventually need normalized entries and pagination.

## Checks

Requires Node 22.18+ (Node 24 recommended).

```sh
pnpm test
pnpm test:db
pnpm lint
pnpm typecheck
pnpm build
```

Tests cover exact money parsing, opening balances, corrections, editing/deleting entries, same-currency and cross-currency transfers, category history, and invalid wallet references. A live Google sign-in and persistence check requires working OAuth credentials and a reachable, migrated database.

`pnpm test:db` uses `.env` to check the live database connection, applied migrations, table permissions, and server reads/writes. Its sample records are rolled back.

The layout starts with phones and adds tablet/desktop layouts using `min-width` media queries. `AGENTS.md` makes mobile-first design a rule for future features.

With the app running and the same `.env` database/auth configuration, run `pnpm exec playwright install chromium` once, then `pnpm test:responsive`. This renders sign-in, every tab, and the editors at seven phone/tablet/desktop and landscape sizes. It checks overflow, touch controls, input text, long content, accessible pie chart breakdowns, report month/currency filtering, single/empty periods, and dialog save/dismissal. It creates a temporary account and ledger and deletes them afterward. Set `RESPONSIVE_SCREENSHOTS` to a directory to capture screenshots, `LEDGER_TEST_URL` to another local app URL, or `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing Chromium executable. If you use another port, start the app with a matching `BETTER_AUTH_URL` so its origin check permits saving.
