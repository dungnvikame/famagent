# Code Review — feat/core-journey vs main (737b5e6..2bd993d)

## Scope
- 71 files, +2107 / -451. Focus: the 6 core-journey phases, plus security, regressions and UX.
- Checks: `tsc --noEmit` passes (exit 0). `node --test`: 184/184 pass. No build or dev server was run (as instructed).
- I ran probe scripts against the real modules for `classifyInbox`, `dueRecurring`, `buildQuestions` sections, `detectBigPurchase` and `looksLikePurchaseLog`. The results are quoted below.

## Overall
The pure-function layer is tidy and tested, and the SSRF guard on `/api/inbox/link` holds. But the branch makes a latent recurring-posting bug fire on every Home load and every money question, which duplicates ledger rows. It also over-grants the DB role. Two plan promises don't hold yet: "feedback must change state" (fails for spikes and bills) and the Inbox on mobile (no button shows). **Not ready to ship.**

## Critical

### C1. Recurring bills and income are copied into past months, and the copies keep growing
Where:
- `lib/money/summary.ts:101` (`dueRecurring`)
- `lib/money/store-server.ts:30-35` (`loadBundle`)
- `lib/money/client.ts:25-29` (demo)
- New callers:
  - `lib/attention/snapshot-client.ts:25` (every Home and weekly-brief load)
  - `app/api/chat/route.ts:86` (months -1, -2, -3 in parallel)
  - `components/agent-shopping.tsx:146` (demo)

What happens:
- For any past month, `dueRecurring` returns every active recurring item whose `lastPostedMonth !== month`. Probe: an item with `lastPostedMonth: "2026-09"` is due for 2026-08, 07 and 06.
- `loadBundle` then inserts the posting and sets `lastPostedMonth` to that past month.
- On the next current-month load, the item looks due again and posts again.

Result: each Home load or "tháng này tiêu thế nào?" writes duplicate rent, salary and bill rows into up to 4 months. This inflates the "bình thường" baseline, pace, spikes and the weekly brief. `family-brief.tsx:25-33` makes it worse: `load` depends on `account.name`, so it runs twice on mount, and a parallel current/previous load races on the same `lastPostedMonth`.

This already existed on the Shopping page (`shopping-plan-page.tsx:57`), but this branch turns it into automatic, high-frequency data corruption.

Fix:
- Never post for months other than the current one: `if (month !== monthKey(now)) return []` in `dueRecurring`, or a read-only `loadBundle(..., { post: false })` for history.
- Longer term, track postings per month (unique `(recurring_id, month)`) instead of a single `lastPostedMonth`.
- Add a test that loading a past month posts nothing.

## High

### H1. `famagent_app` is granted more than it needs
`supabase/migrations/202609240015_attention.sql:228` grants SELECT and a `using (true)` policy on `conversations` and `messages` (all users' chat content). `snapshot-pg.ts` never reads either table (`conversations: []`).

Per DEPLOYMENT.md, `DATABASE_URL` is also the web runtime's role (catalog, `/go` clicks). So the app's runtime connection can now read every family's ledger and chat.

Fix: remove `conversations` and `messages` from the list. Consider a separate cron role, or SECURITY DEFINER functions scoped by `user_id`, for the `money_*` reads.

### H2. Feedback on spike insights doesn't stick (the brainstorm's "feedback must change state" rule fails)
In `lib/attention/spikes.ts:195`, `week: end` is today, so the key `category_spike:<cat>:<today>` (`engine.ts:98`) changes every day. As a result:
- "Đừng nhắc" or "Chưa cần" only hides today's card.
- The cron pushes the same spike on up to 7 days in a row, because the 7-day window slides.

`bill_due:<id>:<dueOn>` (`engine.ts:102`) has a similar problem: "Đừng nhắc việc này nữa" only mutes one occurrence of a recurring bill.

Fix:
- Use stable keys: `category_spike:<category>`, and `bill_due:<id>` for mute.
- Keep the day only in the `notification_log` claim.
- Tie snooze to the category, e.g. an ISO week bucket.

### H3. Inbox misclassifies common sentences, and a wrong kind can't be corrected
`lib/inbox/classify.ts:30,57`: the income check runs before the expense check, and the folded (accent-stripped) matching is too loose. Probe results:

| Sentence | Result | Why |
|---|---|---|
| "mừng cưới bạn 500k" | income "Gia đình hỗ trợ" | "mung" matches before the Hiếu hỉ expense rule |
| "ăn uống bình thường 200k" | income "Thưởng" | "thường" folds to "thuong" |
| "sữa chất lượng cao 300k" | income "Lương" | "lượng" folds to "luong" |
| "nhận hàng shopee 369k" | income | "nhận" |
| "được bạn trả 200k" | income | "được" |
| "chi phí dự án 2tr" | income | "dự án" |
| "đầu tư chứng khoán 10tr" | income | "đầu tư" |
| "tiệm tóc 100k" | "Khám, thuốc" | "tiệm" folds to "tiem" |
| "mình tiêu 5tr ăn uống là nhiều không" | expense | a question with no "?" and no leading question word |

On top of that, `MoneyDraftCard` (`components/inbox/money-draft-card.tsx:168`) only offers categories of the same kind. "Sửa" can't flip income to expense, so the user can only cancel.

Fix:
- Match income words on the lower-cased text with diacritics (like `NEED`/`PAST` in capture.ts): "thưởng", "lương", "nhận lương", "được cho".
- Check expense-only phrases (mừng cưới, đám, đầu tư vào, chi) first, or require income words at the start of the sentence.
- Treat a trailing "không", "nhỉ" or "à" as a question.
- Add a Thu/Chi toggle in edit mode.
- Add these sentences as regression tests.

### H4. No Inbox entry point on mobile
`components/inbox/inbox.tsx:78-79` renders both triggers inside `<aside class="app-side">` (`app-shell.tsx:31`), and `app-shell.css:68` hides `.app-side` at ≤900px. The `position: fixed` FAB inherits `display: none`, so on phones the "Ghi nhanh on every page" promise fails. Only Shopping has a fallback (`inbox-hint`).

Fix: render `<Inbox/>` outside the aside (next to `app-bottom`). Also set the FAB offset to `calc(var(--app-bottom-h) + 16px)`; the current `84px` sits under the bottom nav on iOS devices with a home-indicator safe area.

### H5. The cron doesn't enforce "tối đa 2 nhắc/ngày/nhà"
`lib/push/reminders.ts:165` limits reminders per run; `sentToday` only excludes keys already sent. A retry or manual re-run (or a Vercel duplicate invocation) sends 2 more different keys.

Fix: `limit = PUSH_PER_DAY - sentToday.size` (counting only today's reminder keys, not `weekly_brief`). Add a route-level test.

## Medium

- **M1.** Asking a question from the Inbox while on `/agent` is lost. `inbox.tsx:70` calls `router.push('/agent?q=…')` on the same route; `agent-shopping.tsx` reads `q` only in a mount effect (deps `[router]`, line 96), so nothing is sent.
- **M2.** The Money page doesn't listen for `DATA_CHANGED` (`money-page.tsx`). An expense logged via the Inbox while on `/money` doesn't show until reload.
- **M3.** The Inbox dialog has no Escape handler, no focus trap and no focus restore (`inbox.tsx:80-82`), and the backdrop `<button>` sits in the tab order. Same for the feedback menu (`family-brief.tsx:83-84`): `role="menu"` without arrow keys, Escape or outside-click close, and focus doesn't move into the menu.
- **M4.** The reorder card claims a fit it doesn't know. `lib/ai/shopping/pipeline.ts:58` says "hiện còn phù hợp" whenever `sizeNote` is undefined, including when the weight is missing or the child is unknown. Brainstorm rule: no fit claims without data. Also, target selection (`:52`) ignores the child name ("cho Gold") in two-child homes.
- **M5.** `decide()` uses partial-month income (`lib/money/decision.ts:120`): `summary.income || monthlyIncome`. Before salary is logged, a small side income produces a huge "shortfall". Prefer `max(summary.income, monthlyIncome)` or the normal monthly income.
- **M6.** `explainMonth` counts any earlier month with at least one expense as "normal" (`lib/money/explain.ts:27-40`). A family that started logging mid-last-month gets "cao hơn 200%". Require a minimum of transactions or days of coverage per month, or fall back to the plan.
- **M7.** `reorderDraft` hard-codes `category: "diapers"` (`lib/shopping/capture.ts:95`). "Ghi đã mua lại" for milk or wipes produces a draft with the wrong category when the item isn't resolved.
- **M8.** Demo-mode precedence differs from the plan. `agent-shopping.tsx:142-146` checks big purchase, then money, on the client, before `/api/chat` checks purchase logs. Cloud mode (`route.ts:62-87`) follows purchase log → big purchase → money → shopping as planned. Low impact today, since `INTENT` excludes past tense, but the two paths should be kept aligned.
- **M9.** Cron scaling: 14 queries per family on one `pg.Client` (serialized), 400 days of purchases, and `maxDuration` 60 s. This will time out at a few hundred families. Consider a pool, or batching queries with `user_id = any($1)`.
- **M10.** Every money answer returns `choices`, so `pending_question` ("FamAgent đang chờ bạn trả lời", priority 90, warn) takes a Home slot after almost every chat (`engine.ts:80`). The logic predates this branch, but it now uses one of only 3 slots.

## Low

- `/api/inbox/link` has no rate limit (chat uses `consume_request_quota`) and is unauthenticated when `!authConfigured()`. Add a quota.
- `/api/feedback` accepts any key string. Rows per user are unbounded, and GET caps at 1000, so the newest mutes may be ignored. Validate the key prefix against `InsightKind`.
- `weekly-brief.tsx:115`: a `sendFeedback` rejection is unhandled.
- `push_log` is no longer written or read. On the deploy day, items already pushed may be pushed again, and the out-of-stock reminder counter resets (one-time).
- `classifyInbox` treats a scheme-less link ("shopee.vn/…") as an expense or a question.
- `fineLines` "sớm nhất" uses the first known estimate, not the one with the smallest `daysLeft` (`engine.ts:134`).
- `CATEGORY_WORDS` matches "mua sữa tắm cho bé" as milk (pre-existing order, now used by the Inbox).

## Security verification (passed)
- `shopOf` (`lib/inbox/link.ts`):
  - https only, and the WHATWG hostname is matched against anchored regexes.
  - `https://shopee.vn@evil.com` resolves to host `evil.com` and is rejected. `https://evil.com\@shopee.vn` is rejected. IP literals are rejected, as are `shopee.vn.evil.com` and `http:`.
- Redirects are followed by hand and re-checked on each hop (max 4). Timeout is 5 s, applied to the body as well. Reads stop at 1 MB, and non-HTML responses are ignored. Users can't poison DNS for the allowlisted zones.
- Cron: `timingSafeEqual` Bearer check, no secret gives 401, and every pg query is parameterized and scoped by `user_id`.
- `/api/feedback`: requires a non-anonymous user, upsert is scoped to `auth.user.id`, and RLS is on.
- Migration 0015 is add-only. Table names in the grant loop exist. `month` types match (`shopping_plan_entries.month` is text, `money_budgets.month` is date).

## Plan acceptance status
| Phase | Status | Gaps |
|---|---|---|
| 1 Onboarding | Mostly met | Core = 7 screens for 1 child (matches phase), but plan.md's top-level "≤ 6 màn" contradicts it. `?section=money` → 9 questions + OnboardingReview. Tests present. |
| 2 Inbox | Partial | Sample sentences pass; unknown host refused; missing price → asks for it. Fails: mobile entry point (H4), misclassification (H3). |
| 3 Attention | Partial | ≤3 cards, fine lines and feedback tests pass. Spike/bill feedback doesn't stick (H2). `plan_over_budget` kind, `GET /api/family-state` and `lib/attention/types.ts` from the plan are not implemented. |
| 4 Money/Shopping | Met (tests) | Correctness blocked by C1 (the baseline is polluted). M4 fit claim. |
| 5 Big purchase | Met | Test gives 3.5M shortfall; "bỉm dưới 400k" stays in the shopping pipeline. M5. |
| 6 Proactive | Partial | Spike and weekly tests pass. Max 2/day not enforced (H5); the spike re-pushes daily (H2). No cron test. |

plan.md and the phase files still say "Pending". The lead should update them once C1–H5 are fixed.

## Recommended actions (in order)
1. C1: stop posting recurring items for non-current months, and add a regression test. Check staging for duplicate `source='recurring'` rows and clean them up.
2. H1: drop the `conversations` and `messages` grants (new migration 0016, `revoke` + `drop policy`).
3. H2: stable feedback keys for spikes and bills.
4. H4: move `<Inbox/>` out of `.app-side`.
5. H3: tighten the income rules, add a Thu/Chi toggle, add tests.
6. H5: daily cap across runs.
7. M1–M4, then the Low items.

## Metrics
- Typecheck: 0 errors. Tests: 184 pass / 0 fail. Lint: not run.
- Test gaps: cron routes, `/api/inbox/link` (redirect/userinfo), past-month `loadBundle`, classifier negative cases.

## Unresolved questions
- Is `DATABASE_URL` on production the `famagent_app` role, or a privileged role? This decides how serious H1 is.
- Should "Đừng nhắc" on a spike mute the category permanently, or only for N weeks?
- Which is the target: plan.md "≤ 6 màn" or phase 1 "đúng 7 màn"?
