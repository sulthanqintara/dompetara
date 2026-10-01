# Personal Ledger feature checklist

Reviewed: 2026-10-01. Checked items are implemented; unchecked items remain. Verification notes state what has been tested.

Design requirement: mobile first, then tablet, then desktop. Every feature must remain usable at each size, verified by rendering the affected views. This rule is recorded in `AGENTS.md`.

## Already working

- [x] Google sign-in through Better Auth, with Supabase Postgres persistence. Login and persistence confirmed by the user.
- [x] Private ledger per signed-in user; authenticated server routes scope operations to that user.
- [x] Create, edit, and delete manual income and expenses.
- [x] Transaction history with monthly income, expenses, and current balance.
- [x] Named wallets for bank accounts, cash, and e-wallets such as GoPay.
- [x] Wallet opening balances and balance corrections recorded separately from income and expenses.
- [x] Same-currency and cross-currency transfers with explicit source/destination currencies and editable exchange rates. Manually entering sent and received amounts calculates the effective rate while preserving both actual amounts.
- [x] Optional source/destination service fees saved as linked Admin fees expenses; transfer edits/deletion update both atomically, and reports count fees as spending.
- [x] Shared Supabase Postgres exchange-rate cache using ECB data through Frankfurter, with a protected weekday refresh cron, ETag/304 validation, and manual fallback. Saved transfers retain their applied rate/source/date.
- [x] IDR, USD, and CAD balances kept separately; exact amounts stored as integer minor units.
- [x] Income and expense category management, preserving category names in transaction history.
- [x] Month selection and currency selection for summaries and reports. Transaction history currently includes all currencies for the selected month.
- [x] Expense category pie chart using the shadcn Chart container and Recharts, with visible category names, exact amounts, and percentages. History charts are still missing.
- [x] Version checks reject conflicting saves instead of overwriting another tab's changes.
- [x] Database migrations, public API table permissions, ledger RLS, and a runnable live database check.

## Remaining original requirements

### 0. Mobile-first layout

- [x] Start with a usable single-column phone layout, adding tablet and desktop layouts as space allows.
- [x] Give transaction history a readable phone layout with amounts and actions visible, without squeezed table columns or page-wide horizontal scrolling.
- [x] Fit all navigation tabs on narrow phones without clipping or overflow.
- [x] Adapt summary cards, wallet cards, and transaction history to tablet space before introducing a full desktop sidebar and multi-column layout.
- [x] Keep action buttons, filters, dialog close buttons, and category removal controls comfortably tappable; target at least 44 × 44 CSS pixels for primary touch controls.
- [x] Keep forms readable on phones, with appropriate input sizes and dialogs that scroll while keeping actions reachable.
- [x] Verify short viewports and landscape, including scrolling to dialog actions, saving edits, Escape dismissal, outside-click dismissal, and restored focus.
- [ ] Verify text enlargement, Safari, and the on-screen keyboard on real devices.
- [x] Verify every tab, sign-in, and all editors at 320px and 390px phone widths, 768px tablet width, and 1024px/1440px desktop widths.
- [ ] Apply the same mobile-first checks to future receipt review, charts, date filters, and saved insights.

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
- [ ] Add a spending history graph with daily totals within a period and monthly totals across history.
- [ ] Add custom start/end date filters alongside the existing month filter.
- [ ] Use the same selected period for transaction history, income/expense totals, category breakdown, and charts.
- [ ] Keep currencies separate and exclude transfers, opening balances, and corrections from spending charts.
- [ ] Label current balance clearly when a historical period is selected; decide whether a separate period-end balance is needed.
- [ ] Handle empty periods, single-category periods, and month/date boundaries correctly.

Pie chart verification: `pnpm test:responsive` passed against both development and production servers at all seven viewport sizes listed above. Checks cover the chart's accessible name, visible semantic category breakdown, exact amounts, tiny nonzero percentages, long labels, month/currency filtering, excluded transfers/corrections, and single/empty periods. The pie has no animation or hover-only information. Lint, TypeScript, ledger checks, and the production build passed. Real-device screen-reader and Safari verification remains outstanding.

### 2. Screenshot and receipt import

- [ ] Confirm which GLM 5.4 or ChatGPT credit/account route can be used by this app, including image support, authentication, and usage costs.
- [ ] Connect the chosen provider through the server; keep credentials out of browser responses and logs.
- [ ] Accept screenshot/image uploads with server-side file type and size validation.
- [ ] Extract text, merchant, date, currency, items, quantities, prices, discounts, tax/fees, and total when present.
- [ ] Suggest transaction category and let the user choose the wallet being charged.
- [ ] Show an editable review before saving; flag missing or uncertain values instead of silently guessing.
- [ ] Preserve structured receipt items linked to the saved expense. The current entry model has no item list.
- [ ] Reconcile item totals and adjustments with the final charge; normalize receipt number formats before existing money validation.
- [ ] Save a confirmed receipt without counting both its items and its total as separate wallet charges.
- [ ] Prevent accidental duplicate imports and duplicate saves after retries.
- [ ] Show useful processing errors and preserve the review draft when processing or saving fails.

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
| Wallet, source/destination wallet, currency, category, and category type | shadcn Select composed by `ledger/components/ledger-select.tsx`; form values retain their field names and required validation. Long option labels wrap inside the popup. |
| Period / month | shadcn Popover, Button, Input, and Label composed by `ledger/components/month-picker.tsx`. Select a whole month and year; custom date ranges remain a separate feature. |
| Transaction date and time | shadcn Calendar + Popover and a time Input in `ledger/components/date-time-field.tsx`; local date/time semantics are retained. |
| Wallet/category names, title, amounts, balances, description, and labels | shadcn Input, Textarea, and Label in `wallet-fields.tsx`, `entry-fields.tsx`, and `categories-settings.tsx`. Transfer help text is associated with its input separately from the label. |
| Wallet and transaction editors | shadcn Dialog in `ledger/components/editor-form.tsx`; scrollable body, sticky heading/actions, Escape/outside dismissal, pending guards, and restored focus. |
| Transaction/category removal | shadcn AlertDialog composed by `ledger/components/confirmation-dialog.tsx`; cancel preserves data, errors remain visible, and the dialog closes after a successful save. Browser `confirm()` calls are removed. |
| Income / expense / transfer switch | shadcn Tabs in `ledger/components/entry-fields.tsx`. |
| Income and expense category pills | Rounded shadcn Badge with a 44px remove Button in `ledger/components/categories-settings.tsx`. |
| All actions, including Google sign-in, sign-out, balance corrections, and add-wallet tile | shadcn Button throughout ledger views and `auth/sign-in-form.tsx`. |
| Summary, wallet, report, transaction, and settings panels | shadcn Card in the respective views; preserve single-column phone and wider-screen grids. |
| Transaction history | shadcn Table primitives, with explicit table semantics and the existing readable phone row layout. Table styles are scoped so Calendar is unaffected. |
| Transaction kind markers, transaction count, and private-ledger status | shadcn Badge. |
| Workspace navigation | shadcn Tabs; compact desktop sidebar rows and phone tab-strip layouts use the same accessible view-switch controls. Workspace triggers override full-height tab styling to prevent stretched desktop items. |
| Profile initial and divider | shadcn Avatar/Fallback and Separator in `ledger/components/sidebar.tsx`. |
| Workspace breadcrumb | shadcn Breadcrumb primitives in `ledger/components/ledger-app.tsx`. |
| Errors, loading, pending, and empty states | shadcn Alert, Skeleton, Spinner, and Empty in ledger views and sign-in. |
| Expense pie | shadcn Chart container and Recharts; the visible semantic category list, swatches, and caption remain accessible without hover. |

Remaining custom markup is intentional: responsive page/sidebar layout, branding, headings, help text, privacy notes, footer, ordinary borders, and the semantic chart breakdown. The month picker is a feature composition of shadcn primitives. Time and number fields use browser input behavior inside shadcn Input. There are no visible raw buttons, selects, text inputs, textareas, native editor dialogs, or browser confirmation calls in feature views; hidden form values remain plain HTML.

Verification: `pnpm test:responsive` passed against development and production servers at all seven viewport sizes listed above. It checks open selects, month picker, Calendar, and AlertDialogs as well as all tabs and editors. It covers compact desktop navigation, keyboard selection, date navigation, focus restoration, required transfer wallets, category saves/removals, transaction edits, and cross-currency transfer saves. Transfer checks cover source/destination fees, fee spending reports, atomic edits/deletion, cached/manual rate snapshots, missing-cache fallback, and CAD 159.33 → IDR 2,000,000 with exact amounts preserved through edits and reloads. Ordinary transfer operations leave the shared rate cache unchanged. Lint, TypeScript, domain/database checks, and the production build passed. The linked Supabase migration, protected refresh function, named weekday cron, initial cache, and a real conditional HTTP 304 refresh were verified; unauthorized refresh requests were rejected. Test accounts and ledgers are removed afterward. Real-device keyboard, screen-reader, Safari, and text-enlargement checks remain outstanding.

## Decisions needed before the relevant feature

- [ ] AI access: identify the actual GLM/ChatGPT plan or API credentials available, then verify the supported integration. Do not assume subscription credit and API credit are interchangeable.
- [ ] Receipt categories: one category per receipt initially, or item-level splits across categories?
- [ ] Image retention: discard images after extraction or retain them privately for later review? If retained, define deletion behavior.
- [ ] Daily insights: choose the generation trigger and whether regenerating a day replaces the previous analysis or keeps revisions.
- [ ] Timezone: retain current device-timezone behavior or use a fixed timezone such as Asia/Jakarta for reports and daily insights?
- [ ] Personal access: allow a private ledger for any Google account, as today, or restrict sign-in to your own account?

## Additional improvements worth considering

These extend the original request and are optional.

- [ ] Search transactions and filter by wallet, category, type, and currency.
- [ ] Add a reason and optional effective date to balance corrections so later reconciliation is understandable.
- [ ] Archive wallets without losing their history.
- [ ] Export CSV/JSON for backups; validate any future restore/import before changing balances.
- [ ] Add budget targets or recurring transaction reminders if the basic reports and AI advice are not enough.
- [ ] Let users reload the latest ledger after a version conflict while preserving their unsaved form values.
- [ ] Before production deployment, configure its Google callback, app URL, server secrets, and database connection; verify login and persistence there.
- [ ] Normalize entries and add pagination only when real history size makes the current JSON ledger slow.

## Suggested implementation order

1. Fix and verify the phone layout, then tablet and desktop layouts.
2. Finish reports and date ranges; this can ship using existing ledger data.
3. Resolve AI access, then build image upload → extraction → review → confirmed save.
4. Add saved daily insights using the same reporting totals and chosen AI provider.
5. Choose optional improvements based on actual use.

## Acceptance checks for the new work

- [ ] Complete the feature on a narrow phone first, then verify tablet and desktop layouts without page overflow or inaccessible controls.
- [ ] A representative receipt saves the correct total, wallet, currency, date, and items; a retry does not charge the wallet twice.
- [ ] Charts and totals agree across month boundaries and custom ranges, including currencies, transfers, and corrections.
- [ ] Saved daily insights survive reloads and cannot be accessed by another signed-in user.
- [ ] Existing manual transactions, Google login, and database persistence still work after each feature.
