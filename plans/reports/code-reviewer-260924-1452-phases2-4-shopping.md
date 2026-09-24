# Code review: ec77fee, 0ea22cb, 997e3d5 (shopping phases 2-4 and phase-1 fixes)

Scope: 59 files, about 1.5k LOC. Plan: plans/260924-1431-shopping-plan-redesign/phase-02..04.
Checks run: `tsc --noEmit` exit 0; `eslint src tests` exit 0; `node --test` 169/169 pass. Edge cases were checked with a scratch script against lib/shopping/items.ts and calendar.ts.

## Critical
None confirmed. Every user route uses the JWT client, so RLS applies. Upserts on another user's `id` fail under RLS.

## High
1. **Push endpoint SSRF, plus one user can stall the whole cron**
   - Where: api/push/subscribe/route.ts:14 and api/cron/reminders/route.ts:73-95.
   - Any `https://` endpoint is accepted. There is no cap on subscriptions per user.
   - The cron handles users and endpoints one at a time, calls `webpush.sendNotification` with no `timeout`, and has `maxDuration` 60.
   - Effect: a user who registers slow or hanging hosts (or internal HTTPS hosts) gets the server to POST to them daily, and every family processed after them gets no reminders.
   - Fix:
     - Allowlist push-service hosts (fcm.googleapis.com, *.push.services.mozilla.com, *.notify.windows.com, web.push.apple.com).
     - Cap subscriptions at about 5 per user.
     - Pass `{ timeout: 5000 }`.
     - Send with bounded parallelism.
2. **The cron's DB role probably cannot read these tables**
   - Where: cron route:64-80.
   - Staging's `DATABASE_URL` is `famagent_app`, which has catalog tables plus an affiliate_clicks insert only.
   - Migration 0014 grants nothing. The cron needs:
     - select on push_subscriptions, family_profiles, children, shopping_items, purchases, stock_checks
     - insert/select on push_log
     - delete on push_subscriptions
   - Without these, the cron returns 500 every day. The grants are not in any migration, so verify on staging and add explicit GRANTs (or use a separate role).
3. **A purchase on the same day as a "Hết rồi" check is ignored**
   - Where: items.ts:124 (`after: purchasedOn > anchor.checkedOn`).
   - Home asks "còn không?", the user taps "Hết rồi", buys, and logs it the same day. The estimate stays at 0 (probe: remaining 0, daysLeft 0) until the next check or purchase.
   - The cron then pushes "có thể đã hết" every morning.
   - This breaks the criterion "Hết hôm nay → lần mua sau cộng từ 0".
   - Fix: count purchases with `purchasedOn >= anchor.checkedOn` whose created_at is after the check's created_at, or at least `>=` for level "out".
4. **The latest check is discarded when it predates the first purchase**
   - Where: items.ts:124 (`anchor.checkedOn >= own[0].purchasedOn`).
   - Probe: "còn 60" on the 18th, then +64 on the 20th, gives remaining 44 instead of about 94.
   - Items created from a check first ("Còn nhiều"), then bought, are always underestimated.
   - Fix: drop that condition. Every purchase is after the latest check, and the forward walk handles it.

## Medium
5. **"Còn ít" becomes 0 for slow items.** At items.ts:151, `Math.round(dailyRate*2)` is 0 for milk (0.08/day) and household items (0.033/day), so "Còn ít" is the same as "Hết". Use `Math.max(dailyRate*2, pack*0.15)` without rounding to an integer.
6. **Reconcile link sets unitCount = packs when the item has no packSize.** At reconcile-card.tsx:138, `size = item.packSize ?? 1` makes 1 pack of 64 diapers count as 1 unit, and the estimate collapses. Fall back to the last purchase's unitCount/packs, or open the draft card when packSize is unknown.
7. **The newest plan entries and checks get cut off.** At item-store-server.ts:47, plan entries are loaded with `order("created_at").limit(500)` ascending, so once there are more than 500 the newest are dropped. Checks at :46 have the same problem (ascending, limit 1000). Filter plan entries to `month >= prev month`, or order descending.
8. **Reminders nag, and a failed send loses the reminder**
   - At reminders.ts:112, an item that sits at 0 days (abandoned, not paused) is pushed every day, forever.
   - At cron:86, the slot is claimed before sending. If every send fails transiently, that day's reminder is lost.
   - Fix: stop after about 2 reminders per run-out (e.g. skip when `runsOutOn` is more than 2 days ago), and release the claim when no send succeeds.
9. **Stage status ignores month**
   - At stages.ts:98-99, an entry "Thêm vào kế hoạch" from last month still marks the stage "đã có trong kế hoạch", so it shows with no actions.
   - But mergePlan (plan.ts:225) only shows the current month, so the stage vanishes from both lists.
   - Fix: count `planned` only for the current month.
10. **Several same-day checks have no defined order.** Checks are loaded ordered by `checked_on` only (item-store-server.ts:46), and the anchor sort at items.ts:123 also uses checkedOn only. A correction tap ("Còn ít", then "Còn nhiều") may lose to the first tap. Order by `checked_on, created_at`, or upsert one check per item per day.
11. **Stale-item merge**
    - At purchases/route.ts:176, `stored.packSize ?? item.packSize` means a new variant (44 → 64) never updates packSize, so proposals and "half" levels use the old size.
    - :189 returns the client's `item`, not `merged`.
    - The item is still saved before the purchase insert, so it is not atomic (carried over from phase 1 #10).
12. **Acceptance gaps**
    - Phase 4 wants a push "thẻ mời trên Mua sắm". PushToggle is only in account-section.
    - The photo button is shown whenever `aiConsent` is set, even when the server has no AI configured (the route returns 503). The criterion says the button must be hidden.
    - The image goes to every provider in the chain, including text-only ones. Each 400/invalid retry re-sends up to 2.8 MB.
    - Phase files still say `status: pending`.
13. **Calendar**
    - At calendar.ts:137, pre-Tết is only added for `year+1`. In January 2027 the 2027-01-27 marker is missing, because the loop starts at 2027.
    - At :134-135, Black Friday is wrong in 2029 and 2035 (30/11 instead of 23/11).

## Low
- sw.js:171: `new URL(data.url, origin)` accepts absolute URLs. Enforce `url.origin === self.location.origin`, otherwise use `/shopping`.
- cron:82: `estimateItems(..., now)` uses the server date (UTC), while `today` is the VN date. The two differ when the job runs after 17:00 UTC. Pass a VN-shifted `now`.
- items.ts:98-103: two purchase rows on the same day halve the learned rate. Merge same-day purchases first.
- cron:59: the CRON_SECRET comparison is not constant-time.
- A link race now hits the unique index and returns a 500 ("purchase") instead of a 409.
- capture.ts: PAST now needs diacritics, so unaccented chat such as "da mua 2 bich bim 690k" is no longer detected. This may be an acceptable precision trade-off.
- a11y:
  - photo-capture.tsx:153: the aria-label does not contain the visible text (WCAG 2.5.3), and there is no live "Đang đọc ảnh…" announcement.
  - month-plan and stage-list: repeated "Đã mua / Bỏ qua / Ẩn" buttons have no item context. Add an aria-label with the line name.
- The manifest has only an SVG icon. iOS needs an apple-touch-icon PNG, and iOS is the platform where installing is required for push.
- The timeline markers (em top:40px) can overlap when a payday and a sale are close together (e.g. 10/10). Worth checking at 360px.
- Receipt demo mode rate-limits by `x-forwarded-for`, which can be spoofed. This is dev-only.

## Phase-1 fixes (review 1452) verified
Fixed:
- #1, #2 (capture): PAST is required, "cho" is fixed, diacritic-aware.
- #3: left(…,120).
- #4: catalog variant size.
- #5: defaultChildId.
- #6: item_id nullable, documented.
- #7: source forced on server and client.
- #8: Object.hasOwn.

Partly fixed:
- #9: a stale copy is merged, but packSize sticks.
- #10: a unique index was added, but item-before-purchase is still not atomic.

## Acceptance
- **P2**:
  - The learned rate of 5.33 passes.
  - "Hết" → 0 fails for a same-day rebuy (H3).
  - Link with no new ledger row passes.
  - The plan total plus budget line passes.
- **P3**:
  - The 6-month total passes.
  - The size-L 10.6/13.4 case passes.
  - The 5-month solids item passes.
  - Payday and sale markers pass, with the calendar bugs in #13.
- **P4**:
  - 3 lines → 3 cards passes.
  - The no-consent 403 passes.
  - The no-AI case shows the button, which fails.
  - Cron selection and dedupe pass in the pure test. The real DB path is unverified (H2).
  - Missing VAPID → 503 passes.

## Unresolved questions
- Which role does production's `DATABASE_URL` use, and were GRANTs added outside migrations?
- Has 0012 already been applied anywhere? It was edited in place in ec77fee.
- Should the push also be sent for items with a manually set rate that stay at 0 for many days?
