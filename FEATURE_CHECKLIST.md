# Dompetara feature checklist

Reviewed: 2026-10-08. Checked items are implemented; unchecked items remain. Verification notes state what has been tested.

Design requirement: mobile first, then tablet, then desktop. Every feature must remain usable at each size, verified by rendering the affected views. This rule is recorded in `AGENTS.md`.

## Already working

- [x] English/Indonesian translations with unchanged URLs, browser language detection, a first-time account language prompt, and a saved language setting. Matching dictionaries and UI-copy coverage are checked automatically; both languages were rendered at phone, tablet, desktop, and short viewport sizes using an isolated local database. Apply the new preferences migration before deployment.

- [x] Google sign-in through Better Auth, with Supabase Postgres persistence. Login and persistence confirmed by the user.
- [x] Private ledger per signed-in user; authenticated server routes scope operations to that user.
- [x] Create, edit, and delete manual income and expenses.
- [x] Transaction history with selected-period income, expenses, and a clearly labeled current balance.
- [x] Named wallets for bank accounts, cash, and e-wallets such as GoPay.
- [x] Wallet opening balances and balance corrections recorded separately from income and expenses.
- [x] Same-currency and cross-currency transfers with explicit source/destination currencies and editable exchange rates. Manually entering sent and received amounts calculates the effective rate while preserving both actual amounts.
- [x] Optional source/destination service fees saved as linked Admin fees expenses; transfer edits/deletion update both atomically, and reports count fees as spending.
- [x] Shared Supabase Postgres exchange-rate cache using ECB data through Frankfurter, with a protected weekday refresh cron, ETag/304 validation, and manual fallback. Saved transfers retain their applied rate/source/date.
- [x] IDR, USD, and CAD balances kept separately; exact amounts stored as integer minor units.
- [x] Current balance defaults to an IDR equivalent across all wallets; changing the currency recalculates the combined estimate and native-currency breakdown using cached ECB rates. Native balances remain unchanged. Missing rates prevent partial totals, with retry available; stale rates are labeled.
- [x] Income and expense category management, preserving category names in transaction history.
- [x] Month/custom date selection and currency selection for summaries and reports. Transaction history includes all currencies for the selected period.
- [x] Expense category pie chart using the shadcn Chart container and Recharts, with visible category names, exact amounts, and percentages. Daily and monthly spending history charts are also available.
- [x] Version checks reject conflicting saves instead of overwriting another tab's changes.
- [x] Database migrations, public API table permissions, ledger RLS, and a runnable live database check.

## Remaining original requirements

### 0. Mobile-first layout

- [x] Start with a usable single-column phone layout, adding tablet and desktop layouts as space allows.
- [x] Give transaction history a readable phone layout with amounts and actions visible, without squeezed table columns or page-wide horizontal scrolling.
- [x] Keep navigation usable on narrow phones without clipping or overflow: floating shadcn Tabs below 768px switch sections directly, with bottom padding for the bar and safe area. Tablet uses a left-side Sheet; desktop has an expanded sidebar that collapses to an icon rail.
- [x] Adapt summary cards, wallet cards, and transaction history to tablet space. Navigation uses a Sheet from 768px to 1199px and a desktop sidebar at 1200px and above.
- [x] Keep action buttons, filters, dialog close buttons, and category removal controls comfortably tappable; target at least 44 × 44 CSS pixels for primary touch controls.
- [x] Keep forms readable on phones, with appropriate input sizes and dialogs that scroll while keeping actions reachable.
- [x] Verify short viewports and landscape, including scrolling to dialog actions, saving edits, Escape dismissal, outside-click dismissal, and restored focus.
- [ ] Verify text enlargement, Safari, and the on-screen keyboard on real devices.
- [x] Verify every tab, sign-in, and all editors at 320px and 390px phone widths, 768px tablet width, and 1024px/1440px desktop widths.
- [x] Apply mobile-first checks to receipt upload and review at eight viewport sizes, including short landscape and long item names. Saved insights still require their own checks.

Before the layout fix, a rendered audit on 2026-10-01 used local Chromium with a temporary account and persisted sample ledger, removed afterward:

| Size | Findings |
| --- | --- |
| Phone, 320px | Transactions expanded the page to 474px; navigation overflowed, and other tabs expanded to 343–345px. |
| Phone, 390px | Transactions expanded the page to 474px; titles wrapped into one-letter-wide columns. Wallet, report, and settings fit the page width. |
| Tablet, 768px | No page overflow, but the desktop sidebar left transactions cramped and summary amounts broke across lines. |
| Desktop, 1024px/1440px | No page overflow in the tested tabs and editors; the 1440px transaction layout was readable. |

Before the fix, transaction Edit was approximately 19 × 17px, category removal 14 × 14px, and dialog Close 24 × 24px.

After the fix, `pnpm test:responsive` passed at 320×568, 390×844, 768×1024, 844×390, 1024×768, 1200×800, and 1440×900. All tabs and editors fit without horizontal overflow, controls met the 44px target, and form inputs used at least 16px text. Long wallet/category/transaction names and large amounts were included. Dialog saves and dismissal worked; no JavaScript page errors occurred. Temporary test data was deleted afterward. Real-device keyboard, text enlargement, and Safari checks remain unverified.

### 1. Reports and date ranges

- [x] Add an expense category pie chart with amounts, percentages, and an accessible legend.
- [x] Add a spending history graph with daily totals within a period and monthly totals across history.
- [x] Add custom start/end date filters alongside the existing month filter.
- [x] Use the same selected period for transaction history, income/expense totals, category breakdown, and daily charts. Monthly history is explicitly labeled All history.
- [x] Keep currencies separate and exclude transfers, opening balances, and corrections from spending charts. Linked service fees count as expenses.
- [x] Label current balance clearly when a historical period is selected. It includes all recorded transactions; a separate period-end balance is deferred.
- [x] Handle empty periods, single-category periods, and month/date boundaries correctly.

Balance and boundary verification (2026-10-01): `pnpm test` covers fixed UTC instants in UTC, Asia/Jakarta, and America/New_York, 23/25-hour DST days, inclusive midnight endpoints, leap years, and years 0001/9999. Report browser checks passed at all seven sizes with same-day ranges, zero totals in empty periods, and current balances preserved across historical selections. Lint, TypeScript, and the production build passed.

Spending history verification (2026-10-01): domain checks cover sorted daily/monthly totals, fee inclusion, excluded transfers/corrections, and currency isolation. `RESPONSIVE_SCOPE=reports pnpm test:responsive` passed at all seven sizes, including exact visible amounts, single-day/month data, empty periods, custom ranges, and the independent all-history chart. Zero-spending buckets are omitted with an explicit caption. Lint and TypeScript passed.

Date range verification (2026-10-01): production `pnpm test:responsive` passed at all seven sizes, including custom ranges across months, matching totals/category breakdown/history, invalid-range preservation, and existing editor/transfer persistence checks. Report domain checks passed in Asia/Jakarta and America/New_York; lint, TypeScript, production build, and live database checks passed. Dates retain device-timezone behavior.

Pie chart verification: `pnpm test:responsive` passed against both development and production servers at all seven viewport sizes listed above. Checks cover the chart's accessible name, visible semantic category breakdown, exact amounts, tiny nonzero percentages, long labels, month/currency filtering, excluded transfers/corrections, and single/empty periods. The pie has no animation or hover-only information. Lint, TypeScript, ledger checks, and the production build passed. Real-device screen-reader and Safari verification remains outstanding.

### 2. Screenshot and receipt import

- [x] Implement upfront OCR (`glm-ocr` plus text-only `glm-4.6v-flash` structuring) or direct AI (`glm-4.6v-flash`) selection using server API calls.
- [x] Keep credentials out of browser responses and logs; document `ZAI_API_KEY` setup and show a useful error when it is missing.
- [x] Accept JPEG/PNG uploads with browser resizing and server-side decoded file type, pixel count and size validation.
- [x] Validate extracted merchant, date/time, currency, items, quantities, prices, discounts, tax/fees and total using Zod; missing values stay null.
- [x] Suggest an existing expense category with a reason, or a new category that the user can rename and confirm. Save new categories atomically with the reviewed expense, reusing equivalent existing names. Category suggestions remain editable.
- [x] Detect the visible payment source and preselect a unique matching wallet in the charged currency; keep selection editable and require manual choice for unknown or ambiguous accounts.
- [x] Use the displayed bank debit in its charged currency, including IDR fractions; do not reconstruct foreign prices or debit a USD wallet for a converted IDR payment.
- [x] Allow notes on receipt and ordinary transactions using the existing description field; preserve notes in edits and exports for future AI summaries.
- [x] Add categories directly inside manual income/expense and receipt-review modals. Create the category with the saved transaction, reuse existing names case-insensitively, and preserve the existing selection when switching back. Receipt extraction can suggest a new category for the user to confirm or rename.
- [x] Show an editable review with the original image; flag missing or uncertain values before saving.
- [x] Offer total-only saving or structured receipt items linked to one saved expense.
- [x] Reconcile exact item totals and signed adjustments with the final charge; require normalized decimal amounts before existing money validation.
- [x] Save one confirmed expense without counting its items as additional wallet charges.
- [x] Require explicit spending confirmation for payment screenshots; direct users to a transfer for their own wallet movements.
- [x] Prevent duplicate saves using durable import IDs and image fingerprints, including retries after deletion. Different photos of the same receipt are not guaranteed duplicates.
- [x] Preserve review drafts after failed saves or version conflicts; use the existing explicit reload/review/retry flow.
- [x] Preserve receipt details when editing, deleting and exporting transactions.
- [x] Verify live account access to GLM-OCR and GLM-4.6V-Flash with the supplied receipt samples.
- [ ] Improve extraction accuracy on wrapped/blurry item rows and category suggestions; live checks expose errors that still require review.

Receipt import verification (2026-10-02): lint, TypeScript, domain/provider tests, production build, live database checks, and the complete production responsive suite passed at all eight viewport sizes. Browser checks cover upfront OCR/AI selection, missing-key errors, editable review, exact item/adjustment reconciliation, one wallet charge, payment confirmation, conflict recovery with drafts retained, duplicate retry protection, reload persistence, and deletion. Phone, short-landscape, tablet, and desktop screenshots were inspected. Provider calls were mocked; live extraction accuracy remains pending the API key. Temporary test accounts were removed, including the stale synthetic account left by the interrupted run.

Category and note verification (2026-10-02): lint, TypeScript, domain/provider checks and production build passed. Targeted production browser checks passed at all eight sizes for existing-category suggestions, confirmed new-category creation, receipt notes, note persistence after reload, and ordinary transaction notes. Domain checks cover case-insensitive category reuse, atomic creation/retry behavior, failed-save isolation and exported notes. Model output was mocked; live suggestion quality still awaits the API key.

Inline category verification (2026-10-03): category and note spacing corrected; manual income/expense and receipt review share one category control with an Add category action. Lint, TypeScript, domain/provider tests and production build passed. Targeted browser checks passed at eight viewport sizes, covering long names, short screens, cancellation without writes, preservation of the existing selection, income/expense category creation, notes and reload persistence, plus receipt suggestions and confirmation. Phone, tablet and desktop screenshots were inspected; temporary test data was removed. Extraction was mocked for UI verification. Deployed to production and verified the new modal controls with the signed-in account, cancelling without saving.

Live provider verification (2026-10-02): both services accepted the configured key. Tested all five supplied images through OCR and direct AI, then repeated selected calls after fixes. Correct final amounts were observed for Solaria (IDR 191,000), Dapur Solo (137,445), Bosscha (187,000), Bebek (103,500), and GoPay (102,000). Fixed the OCR data-URI upload contract, normalized unambiguous grouped amount strings and printed seconds through Zod, and excluded subtotal/pre-rounding summary rows from provider adjustments. OCR Dapur Solo and Bosscha item details reconciled; direct AI Bosscha reconciled after normalization. Solaria and blurry Bebek item details were inaccurate and blocked by reconciliation. GoPay OCR was classified as payment with no items. Direct AI GoPay also returned an invalid schema response that validation rejected. Some calls returned provider 429 overload errors, and category suggestions sometimes forced restaurant meals into Shopping when dining was absent. Accurate totals do not establish accurate receipt numbers, items, dates or categories. These were direct calls through the server extraction function, without ledger writes or layout checks.

Additional screenshot cases (2026-10-03): all seven original PNGs and local expected amounts are preserved in gitignored `tests/receipt-images/`. Added a reusable optional live-check command plus mocked provider checks for BCA matching, invented IDs, currency mismatch, and the fractional IDR OpenAI debit. Repeated live OCR and AI checks both returned Shopee IDR 81,200 and BCA, and OpenAI IDR 202,177.34 with manual wallet choice and pending warnings. Shopee extraction still inferred unsupported date/time and was inconsistent on hidden discounts; review remains essential. No live calls saved ledger entries. Lint, TypeScript, domain/provider checks and production build passed. Targeted receipt browser checks passed at all eight sizes, including BCA preselection, manual override, and saving exactly 20217734 minor units in IDR from the selected bank wallet; screenshots were inspected at phone, tablet and desktop sizes. Temporary test accounts were removed.

Shopee timeline verification (2026-10-03): replaced the ignored Shopee original with the expanded screenshot. Extraction now prefers the payment phase (Waktu Pembayaran) and leaves an order timeline date/time unknown if the payment timestamp cannot be read. Live OCR and direct AI both returned 2026-09-28 at 13:26, IDR 81,200 and BCA. The live check now asserts the expected payment date/time; lint, TypeScript and mocked provider checks passed. Direct AI item details still needed correction. No UI changes or layout tests were needed.

### 3. Saved daily AI spending insights

- [ ] Analyze month-to-date spending by category, highlighting the largest expenses and practical opportunities to reduce or postpone spending.
- [ ] Base advice and savings estimates on recorded amounts; explain when there is insufficient history.
- [ ] Save each day's analysis with its date, covered period, currency, source totals, generation time, and model identity.
- [ ] Show saved analyses and their history in the report area.
- [ ] Define when an analysis is generated: on demand, first visit of the day, or an automatic daily schedule.
- [ ] Avoid duplicate daily records and repeated charges for unchanged inputs; show when a saved analysis is stale after ledger edits.
- [ ] Scope saved analyses to the authenticated user and use the same timezone rules as reports.

## Design components

Replaced the native/custom controls on 2026-10-01 using the existing shadcn Base UI preset. The green palette and mobile-first layouts remain, with shared 44px controls, 16px form text, readable muted text, and reduced-motion support. UI primitives export one component per file; unused generated primitives were removed.

| UI element | Current component and feature location |
| --- | --- |
| Wallet, source/destination wallet, currency, category, and category type | shadcn Select composed by `ledger/components/shared/ledger-select.tsx`; form values retain their field names and required validation. Long option labels wrap inside the popup. |
| Period / month / custom dates | shadcn Select, Popover, Button, Input, and Label composed by `ledger/components/filters/period-picker.tsx` and `month-picker.tsx`. Choose a month or apply inclusive start/end dates; invalid ranges preserve the last applied period. |
| Transaction date and time | shadcn Calendar + Popover and a time Input in `ledger/components/editor/date-time-field.tsx`; local date/time semantics are retained. |
| Wallet/category names, title, amounts, balances, description, and labels | shadcn Input, Textarea, and Label in `wallet-fields.tsx`, `entry-fields.tsx`, and `categories-settings.tsx`. Transfer help text is associated with its input separately from the label. |
| Wallet and transaction editors | shadcn Dialog in `ledger/components/editor/editor-form.tsx`; scrollable body, sticky heading/actions, Escape/outside dismissal, pending guards, and restored focus. |
| Transaction/category removal | shadcn AlertDialog composed by `ledger/components/shared/confirmation-dialog.tsx`; cancel preserves data, errors remain visible, and the dialog closes after a successful save. Browser `confirm()` calls are removed. |
| Income / expense / transfer switch | shadcn Tabs in `ledger/components/editor/entry-fields.tsx`. |
| Income and expense category pills | Rounded shadcn Badge with a 44px remove Button in `ledger/components/settings/categories-settings.tsx`. |
| All actions, including Google sign-in, sign-out, balance corrections, and add-wallet tile | shadcn Button throughout ledger views and `auth/sign-in-form.tsx`. |
| Summary, wallet, report, transaction, and settings panels | shadcn Card in the respective views; preserve single-column phone and wider-screen grids. |
| Converted current balance | shadcn Card, Skeleton, Alert, and retry Button in `ledger/components/shared/current-balance-card.tsx`; native totals and selected-currency equivalents remain visible with the cached reference date. Income/expense summaries retain their original currency filter. |
| Transaction history | shadcn Table primitives, with explicit table semantics and the existing readable phone row layout. Table styles are scoped so Calendar is unaffected. |
| Transaction kind markers, transaction count, and private-ledger status | shadcn Badge. |
| Workspace routes | Server-rendered `/transactions`, `/wallet`, `/report`, and `/settings`; `/` redirects to transactions. Next.js links keep the shared shell mounted, preserve refresh/history navigation, and animate page content with reduced-motion support. Initial ledger data is read on the server; subsequent saves update the shared client state. Device timezone is saved for later server renders. |
| Transaction pagination | shadcn Pagination and Button with Next.js links render 20 rows per page. `?page=` survives refresh and browser history; invalid or out-of-range values are safely clamped, and changing the period resets to page one. Equal timestamps are ordered consistently across edits. |
| Workspace navigation | Floating shadcn Tabs below 768px: History (Transactions), Wallet, Report, and Settings switch directly and return to the section top. The compact 56px bar shows an icon beside only the active label; icons animate between zero and full width, and the Base UI indicator slides with CSS transitions. Both respect reduced motion. Bottom padding reserves 80px plus the safe area. shadcn SidebarProvider, Sidebar, Header/Content/Footer, and SidebarTrigger provide a left-side Sheet on tablet and a desktop sidebar that collapses to a 72px icon rail, with its expand/collapse toggle inside the header. Tabs use horizontal keyboard navigation on phones and vertical navigation at wider sizes. Selecting a tablet section closes the Sheet and restores focus to the menu button. |
| Profile initial and divider | shadcn Avatar/Fallback and Separator in `ledger/components/navigation/sidebar.tsx`. |
| Workspace breadcrumb | shadcn Breadcrumb primitives in `ledger/components/layout/ledger-shell.tsx`. |
| Errors, loading, pending, and empty states | shadcn Alert, Skeleton, Spinner, and Empty in ledger views and sign-in. |
| Expense pie and spending history | shadcn Chart container and Recharts; category, daily, and monthly amount lists and captions remain accessible without hover. Monthly history is labeled All history. |
| Ledger exports | shadcn Card, Button, Spinner, and Alert in `ledger/components/settings/export-settings.tsx`; download a complete JSON backup or CSV transaction history from the latest authenticated ledger. |

Remaining custom markup is intentional: responsive page/sidebar layout, branding, headings, help text, privacy notes, footer, ordinary borders, and the semantic chart breakdown. The month picker is a feature composition of shadcn primitives. Time and number fields use browser input behavior inside shadcn Input. There are no visible raw buttons, selects, text inputs, textareas, native editor dialogs, or browser confirmation calls in feature views; hidden form values remain plain HTML.

Verification: `pnpm test:responsive` passed against development and production servers at all seven viewport sizes listed above. It checks open selects, month picker, Calendar, and AlertDialogs as well as all tabs and editors. It covers compact desktop navigation, keyboard selection, date navigation, focus restoration, required transfer wallets, category saves/removals, transaction edits, and cross-currency transfer saves. Transfer checks cover source/destination fees, fee spending reports, atomic edits/deletion, cached/manual rate snapshots, missing-cache fallback, and CAD 159.33 → IDR 2,000,000 with exact amounts preserved through edits and reloads. Ordinary transfer operations leave the shared rate cache unchanged. Lint, TypeScript, domain/database checks, and the production build passed. The linked Supabase migration, protected refresh function, named weekday cron, initial cache, and a real conditional HTTP 304 refresh were verified; unauthorized refresh requests were rejected. Test accounts and ledgers are removed afterward. Real-device keyboard, screen-reader, Safari, and text-enlargement checks remain outstanding.

Export verification (2026-10-01): `pnpm test` passed for complete JSON snapshots, exact minor-unit amounts, transfer/rate/fee preservation, empty ledgers, quoted multiline CSV, and formula-like text escaping. The final production `pnpm test:responsive` passed at all seven sizes with actual JSON/CSV downloads, latest-data refetches, failure/retry handling without partial downloads, authenticated reads, and unchanged ledger data/version after export. Existing transaction edits and transfer/fee saves, reloads, and deletions also passed. Lint, TypeScript, and production build passed; live database checks passed during this work. Temporary test accounts and ledgers were removed. Real-device Safari, keyboard, text-enlargement, and screen-reader checks remain outstanding.

Sidebar verification (2026-10-01): navigation/report checks passed against development and the complete `pnpm test:responsive` passed against production at all seven viewport sizes. Checks cover the mobile Sheet, vertical keyboard navigation, focus trapping/restoration, section selection, Escape/close-button/outside dismissal, resizing across the desktop breakpoint, and desktop collapse reclaiming workspace width. Existing editors, exports, persistence, and transfer/fee flows passed. Phone, tablet, short landscape, and expanded/collapsed desktop screenshots were inspected. Lint, TypeScript, domain checks, and production build passed; temporary test accounts and ledgers were removed. Real-device Safari, keyboard, text-enlargement, and screen-reader checks remain outstanding.

Floating navigation verification (2026-10-01): the full production `pnpm test:responsive` passed at 320×568, 390×844, 568×320, 768×1024, 844×390, 1024×768, 1200×800, and 1440×900 with compact direct phone navigation, scroll-to-top behavior, and final content/footer clearing the bar in every section. Existing editors, exports, persistence, and transfer/fee flows passed. After adding icon width animations, the production navigation/report checks passed again at all eight sizes, verifying collapsed inactive icons, expanded active icons, indicator alignment, reduced motion, tablet Sheet behavior, and desktop collapse. Phone, short landscape, tablet, and desktop screenshots were inspected. Lint, TypeScript, domain checks, and production build passed. Temporary accounts and ledgers were removed. Real-device Safari and screen-reader checks remain outstanding.

Desktop icon rail verification (2026-10-01): production navigation/report checks passed at all eight sizes. Desktop collapse keeps all four section buttons accessible in a 72px rail; the internal toggle expands with the keyboard and restores labels/profile details. Expanded and collapsed desktop screenshots were inspected, and phone navigation and tablet Sheet checks passed. Lint, TypeScript, and production build passed. Temporary test accounts and ledgers were removed.

Converted balance verification (2026-10-01): lint, TypeScript, all domain tests, production build, and the full production `pnpm test:responsive` passed. Checks cover all eight sizes and all three target currencies, exact native totals and converted equivalents, missing-rate retry, stale-rate labels, unchanged ledger/version and shared cache, and balances independent of report dates. Domain checks also cover negative/zero balances, rounding to zero, mixed reference dates, invalid rates, and overflow. Existing editors, exports, transfers, linked fees, reloads, and sidebar navigation passed. Phone and desktop screenshots were inspected; temporary test accounts and ledgers were removed. Real-device Safari and screen-reader checks remain outstanding.

Routing and pagination verification (2026-10-01): lint, TypeScript, domain checks, production build, and the complete production responsive suite passed at all eight sizes. Authenticated HTML and JavaScript-disabled browsers render all four pages. Checks cover the default redirect, persistent navigation during soft route changes, refresh, Back/Forward, 20-row limits, page URLs, edits without timestamp/order drift, last-page controls, and period resets. Existing balances, reports, exports, editors, transfers, and linked fees passed. Phone, short landscape, and desktop screenshots were inspected; temporary test accounts and ledgers were removed.

Component organization verification (2026-10-01): lint, TypeScript, domain tests, and production build passed after the moves. Production navigation/report browser checks passed again at all eight sizes, including server-rendered HTML, refresh/history navigation, pagination edits, currency conversion, all sections, and responsive controls.

Conflict recovery verification (2026-10-02): lint, TypeScript, domain tests, production build, live database checks, and the complete production responsive suite passed at all eight sizes. Browser checks cover real stale-version rejection, failed reload/retry, repeated conflicts, preserved transaction/wallet/transfer/category drafts, recovery inside delete confirmations, explicit save after review, other-tab changes retained after retry, and reload persistence. Reloading does not write data or increment the ledger version. Phone, short landscape, tablet, and desktop recovery screenshots were inspected; temporary test accounts and ledgers were removed. The browser test receipt/report fixture now anchors its date to Asia/Jakarta to avoid a UTC-midnight mismatch.

Component organization: ledger UI lives in `components/layout`, `navigation`, `transactions`, `wallets`, `reports`, `settings`, `filters`, `editor`, and `shared`. Sign-in UI lives in `auth/components`. shadcn primitives remain in `src/components/ui/`; routing stays in `src/app/`, and domain/API/hooks stay in their feature roots.

## Decisions needed before the relevant feature

- [ ] AI access: identify the actual GLM/ChatGPT plan or API credentials available, then verify the supported integration. Do not assume subscription credit and API credit are interchangeable.
- [ ] Receipt categories: one category per receipt initially, or item-level splits across categories?
- [x] Image retention: optional private storage on confirmation; owner-only viewing, independent removal, transaction/account deletion, and durable cleanup retries. Production requires the new migration, private bucket, and server storage/cron credentials.
- [ ] Daily insights: choose the generation trigger and whether regenerating a day replaces the previous analysis or keeps revisions.
- [ ] Timezone: retain current device-timezone behavior or use a fixed timezone such as Asia/Jakarta for reports and daily insights?
- [ ] Personal access: allow a private ledger for any Google account, as today, or restrict sign-in to your own account?

## Additional improvements worth considering

These extend the original request and are optional.

- [x] Search transactions and filter by wallet, category, type, and currency. Filters apply within the selected period, persist in the URL, reset pagination when applied, and match either side of transfers.
- [ ] Add a reason and optional effective date to balance corrections so later reconciliation is understandable.
- [ ] Archive wallets without losing their history.
- [x] Export CSV/JSON for backups. JSON preserves the complete ledger; CSV includes all transactions, exact minor-unit amounts, transfer destinations/rates, and linked fees.
- [ ] Validate any future restore/import before changing balances.
- [ ] Add budget targets or recurring transaction reminders if the basic reports and AI advice are not enough.
- [x] Let users reload the latest ledger after a version conflict while preserving their unsaved form values. Reloading fetches current data without refreshing the page; saves remain blocked until reload succeeds, and the user reviews and retries explicitly. Recovery is available in transaction/wallet editors, category settings, and delete confirmations.
- [x] Configure the production Google callback, app URL, server secrets, and database connection; verify Google login and persistence there.
- [x] Paginate transaction history at 20 rows per page, with the page in the URL.
- [x] Give each section its own server-rendered route: `/transactions` (default), `/wallet`, `/report`, and `/settings`. Refresh and browser history retain the route; shared navigation and mobile animations persist.
- [ ] Normalize entries and paginate database reads when the JSON ledger becomes slow; current pagination limits rendered rows while retaining the existing ledger storage.

## Suggested implementation order

1. Completed: phone layout, then tablet and desktop verification.
2. Completed: reports, custom date ranges, balance labeling, and JSON/CSV export.
3. Resolve AI access, then build image upload → extraction → review → confirmed save.
4. Add saved daily insights using the same reporting totals and chosen AI provider.
5. Choose optional improvements based on actual use.

## Acceptance checks for the new work

- [x] Complete reports/date ranges/exports on a narrow phone first, then verify tablet and desktop layouts without page overflow or inaccessible controls. Apply these checks again to future AI features.
- [x] A representative receipt with mocked extraction saves the correct total, wallet, currency, date, and items; a retry does not charge the wallet twice. Live access is verified; item accuracy and category quality limitations are recorded below.
- [x] Charts and totals agree across month boundaries and custom ranges, including currencies, transfers, and corrections.
- [x] JSON/CSV exports include all dates and currencies, fetch the latest saved ledger, handle failures/retries, and leave balances and ledger versions unchanged.
- [ ] Saved daily insights survive reloads and cannot be accessed by another signed-in user.
- [ ] Existing manual transactions, Google login, and database persistence still work after each feature.

## Production deployment (2026-10-03)

Speed Insights verification (2026-10-09): installed `@vercel/speed-insights` 2.0.0 and mounted the Next.js integration once in the root layout. Production build (including i18n), lint and TypeScript passed. Browser verification confirmed the SDK script is injected with `/sign-in` route tracking; its Vercel-hosted endpoint is unavailable on the plain local production server. The existing Vercel project reports `speedInsights.hasData: false`, and the production LCP sample query over seven days returns empty data. These workspace changes have not been deployed; live collection remains unverified.

- [x] Create and link `personal-ledger`; transferred from the work account to personal account `sulthanqintara@gmail.com` (scope `msulthanqs-projects`) on 2026-10-03, preserving production URL: https://personal-ledger-inky-alpha.vercel.app.
- [x] Configure production credentials and authentication origin; enable the pinned pnpm version with Corepack.
- [x] Verify deployment uploads exclude environment files, personal receipt images and local worktrees.
- [x] Complete cloud build and production endpoint, authentication, database read/write, persistence and live OCR checks using temporary accounts; remove test data afterward.
- [x] Register the production Google OAuth callback on `NextJS-personal-ledger` in Google Cloud project `personal-ledger-510306` under `sulthanqintara@gmail.com`, preserving localhost. Verified real Google sign-in returns to `/transactions` with the correct account and authenticated ledger access (HTTP 200).
- [x] Connect `sulthanqintara/dompetara` through the personal account's existing GitHub integration, with production branch `main`. Update local CLI authentication and project linking to the personal scope. Current deployed workspace changes remain uncommitted; future Git deployments use pushed commits.

Transaction history verification (2026-10-05): opening balances and corrections use a scale icon, separate from income/expense arrows. Search and wallet/category/type/currency filters persist in URLs and are applied before pagination. Domain checks cover combined filters, notes, destination wallets/currencies, historical categories, malformed parameters and page clamping. Lint, TypeScript, domain tests and the production build passed. `RESPONSIVE_SCOPE=filters pnpm test:responsive` passed at all eight sizes, including long content, refresh, filtered pagination, reset on Apply, empty results, and 200 ms shadcn dialog/dropdown animations with restored focus. Rebased onto the newer compact history and account/action menus, preserving their layouts and branding; the shared dropdown now animates both the plus menu and top-right account menu. Phone, tablet and desktop screenshots were inspected; temporary test data was removed.

Mobile transaction menu verification (2026-10-05): below 768px, opening the plus menu dims the background by 25% and rotates the icon into an X; button, outside tap, Escape and selection restore it. Tablet/desktop menus retain the plus and have no dimming. TypeScript, lint, production build and responsive checks at all eight sizes passed; phone/tablet/desktop screenshots were inspected and temporary test data removed.
