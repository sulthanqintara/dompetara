# Personal Ledger feature checklist

Reviewed: 2026-10-01. Checked items exist today; unchecked items remain. This is a plan, not a record of completed feature work.

Design requirement: mobile first, then tablet, then desktop. Every feature must remain usable at each size; the existing responsive breakpoints are not enough to meet this requirement yet.

## Already working

- [x] Google sign-in through Better Auth, with Supabase Postgres persistence. Login and persistence confirmed by the user.
- [x] Private ledger per signed-in user; authenticated server routes scope operations to that user.
- [x] Create, edit, and delete manual income and expenses.
- [x] Transaction history with monthly income, expenses, and current balance.
- [x] Named wallets for bank accounts, cash, and e-wallets such as GoPay.
- [x] Wallet opening balances and balance corrections recorded separately from income and expenses.
- [x] Same-currency and cross-currency transfers, with amounts entered explicitly.
- [x] IDR, USD, and CAD balances kept separately; exact amounts stored as integer minor units.
- [x] Income and expense category management, preserving category names in transaction history.
- [x] Month selection and currency selection for summaries and reports. Transaction history currently includes all currencies for the selected month.
- [x] Spending by category with amounts, percentages, and meters. Pie and history charts are still missing.
- [x] Version checks reject conflicting saves instead of overwriting another tab's changes.
- [x] Database migrations, public API table permissions, ledger RLS, and a runnable live database check.

## Remaining original requirements

### 0. Mobile-first layout (priority before new features)

- [ ] Start with a usable single-column phone layout, adding tablet and desktop layouts as space allows.
- [ ] Give transaction history a readable phone layout with amounts and actions visible, without squeezed table columns or page-wide horizontal scrolling.
- [ ] Fit all navigation tabs on narrow phones without clipping or overflow.
- [ ] Adapt summary cards, wallet cards, and transaction history to tablet space before introducing a full desktop sidebar and multi-column layout.
- [ ] Keep action buttons, filters, dialog close buttons, and category removal controls comfortably tappable; target at least 44 × 44 CSS pixels for primary touch controls.
- [ ] Keep forms readable on phones, with appropriate input sizes and dialogs that scroll while keeping actions reachable.
- [ ] Verify short viewports, landscape, text enlargement, and the on-screen keyboard; avoid hidden form controls and page overflow.
- [ ] Verify every tab, sign-in, and all editors at 320px and 390px phone widths, 768px tablet width, and 1024px/1440px desktop widths.
- [ ] Apply the same mobile-first checks to future receipt review, charts, date filters, and saved insights.

Rendered audit on 2026-10-01 used local Chromium with a temporary account and persisted sample ledger, removed afterward:

| Size | Findings |
| --- | --- |
| Phone, 320px | Transactions expanded the page to 474px; navigation overflowed, and other tabs expanded to 343–345px. |
| Phone, 390px | Transactions expanded the page to 474px; titles wrapped into one-letter-wide columns. Wallet, report, and settings fit the page width. |
| Tablet, 768px | No page overflow, but the desktop sidebar left transactions cramped and summary amounts broke across lines. |
| Desktop, 1024px/1440px | No page overflow in the tested tabs and editors; the 1440px transaction layout was readable. |

Sign-in fit all tested widths, and the editors opened and scrolled. Touch controls still need work: transaction Edit was approximately 19 × 17px, category removal 14 × 14px, and dialog Close 24 × 24px. No JavaScript page errors occurred. Real-device keyboard and Safari checks remain unverified. This audit records gaps; layout fixes are not implemented yet.

### 1. Reports and date ranges

- [ ] Add an expense category pie chart with amounts, percentages, and an accessible legend.
- [ ] Add a spending history graph with daily totals within a period and monthly totals across history.
- [ ] Add custom start/end date filters alongside the existing month filter.
- [ ] Use the same selected period for transaction history, income/expense totals, category breakdown, and charts.
- [ ] Keep currencies separate and exclude transfers, opening balances, and corrections from spending charts.
- [ ] Label current balance clearly when a historical period is selected; decide whether a separate period-end balance is needed.
- [ ] Handle empty periods, single-category periods, and month/date boundaries correctly.

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
