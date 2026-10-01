# Personal Ledger feature checklist

Reviewed: 2026-10-01. Checked items exist today; unchecked items remain. This is a plan, not a record of completed feature work.

Design requirement: mobile first, then tablet, then desktop. Every feature must remain usable at each size, verified by rendering the affected views. This rule is recorded in `AGENTS.md`.

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

## Design audit: native and custom UI remaining

Reviewed after the pie chart on 2026-10-01. These are candidates for the next design pass, not changes made in this feature. The app currently imports only the shadcn Chart container; the installed Button, Card, Input, and Label components are unused by app views. Use the existing Base UI preset when adding components. Suggested components are listed in the [official shadcn catalog](https://ui.shadcn.com/docs/components).

All paths below are relative to `src/features/`; ledger view files live in `ledger/components/`.

| UI element | Current implementation and locations | Suggested shadcn component/pattern |
| --- | --- | --- |
| Wallet, source/destination wallet, currency, destination currency, category, and category-type dropdowns | Native `select` in `filters-bar.tsx`, `editor-form.tsx`, `settings-tab.tsx` | Select; preserve labels, required validation, keyboard access, and dependent wallet choices. |
| Period / month filter | Native `input type="month"` in `filters-bar.tsx` | Popover with month/year selection; Calendar for the planned custom date range. Preserve whole-month selection. |
| Transaction date and time | Native `datetime-local` in `editor-form.tsx` | Calendar + Popover for date, Input for time; retain local-timezone semantics. |
| Wallet/category names, transaction title, amounts, and balances | Native text/number inputs in `editor-form.tsx`, `settings-tab.tsx` | Input; preserve money limits, steps, required fields, and mobile input size. |
| Description | Native textarea in `editor-form.tsx` | Textarea. |
| Form labels, optional markers, help text, and field errors | HTML labels/text in `filters-bar.tsx`, `editor-form.tsx`, `settings-tab.tsx` | Field / Label with associated descriptions and errors. |
| Wallet and transaction editors | Native dialog with custom backdrop, focus restoration, body scroll lock, and sticky actions in `editor-form.tsx` | Dialog; consider Drawer on phones if it improves long-form editing. Keep actions reachable. |
| Delete transaction and remove category confirmations | Browser `confirm()` in `editor-form.tsx`, `settings-tab.tsx` | AlertDialog. No browser `alert()` calls were found. |
| Income / expense / transfer switch | Custom segmented buttons in `editor-form.tsx` | Single-selection ToggleGroup or Tabs, with selected state announced. |
| Income and expense category chips | Custom rectangular spans and remove buttons in `settings-tab.tsx` | Badge styled as a pill + accessible remove Button; maintain a 44px touch target. |
| Action buttons throughout the app | Native buttons for add/edit/save/cancel/delete/close, correction balance rows, add category, sign out, reload, and Google sign-in | Button in `ledger-app.tsx`, `editor-form.tsx`, `transactions-tab.tsx`, `wallets-tab.tsx`, `settings-tab.tsx`, and `auth/sign-in-form.tsx`; retain navigation-specific patterns below. |
| Summary, wallet, report, transaction, and settings panels | Custom articles/sections in `stats-bar.tsx`, `wallets-tab.tsx`, `report-tab.tsx`, `transactions-tab.tsx`, `settings-tab.tsx` | Card; preserve responsive grids. Add-wallet tile uses Button within an appropriate container. |
| Transaction history | HTML table with custom phone row layout in `transactions-tab.tsx` | Table on desktop with a readable mobile list/card layout; retain table semantics where used. No data-table framework needed yet. |
| Transaction kind markers | Custom icon backgrounds in `transactions-tab.tsx` | Badge styling where useful; keep income/expense/transfer/correction distinguishable beyond color. |
| Workspace navigation | Custom aside/nav/buttons, desktop sidebar and phone tab strip in `sidebar.tsx` | Sidebar on desktop; Tabs or Buttons for the phone view switch. |
| Profile initial | Custom avatar span in `sidebar.tsx` | Avatar with fallback initial. |
| Transaction count and private-ledger status | Custom spans in `transactions-tab.tsx`, `ledger-app.tsx` | Badge. |
| Workspace breadcrumb | Custom span/ChevronRight in `ledger-app.tsx` | Breadcrumb. |
| Sign-in, loading, and save errors | Custom `role="alert"` blocks in `auth/sign-in-form.tsx`, `ledger-app.tsx`, `editor-form.tsx` | Alert; keep retry actions and form error announcements. |
| Loading and pending states | Custom loading text in `ledger-app.tsx`; changing button text in editor/sign-in | Skeleton for initial loading, Spinner or Button pending state for actions. |
| Empty ledger, no wallets, no transactions, and no spending | Custom icon/heading/text blocks in `transactions-tab.tsx`, `report-tab.tsx`, `ledger-app.tsx` | Empty with appropriate action buttons. |
| Pie chart category breakdown | Custom semantic definition list, swatches, caption, and spacing in `expense-category-chart.tsx`; chart itself uses shadcn | Retain the visible accessible list; theme its typography and separators alongside the design pass. No hover tooltip is required to read values. |
| Panel/profile/footer dividers | Custom CSS borders in `globals.css` | Separator where a semantic divider is useful; ordinary card borders can remain CSS. |
| Sign-in page composition, branding, headings, descriptions, privacy note, and footer | Custom HTML/CSS in `auth/sign-in-form.tsx`, `ledger-app.tsx`, `sidebar.tsx` | Align typography, spacing, colors, and icons with the chosen theme; these do not each require a new shadcn component. |

Start the next mobile-first design pass with Select, Dialog/AlertDialog, Button, Input/Field/Label, Textarea, and category Badges. Then address the period picker and shared cards/navigation/status states. Re-render phone, tablet, desktop, and short landscape views after each group, including opened dropdowns, confirmations, keyboard focus, and long category/wallet names.

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
