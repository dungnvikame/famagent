# Code review: 847ac13 (phase 1: shopping items, capture, plan page)

Scope: 48 files, about 1.9k LOC changed. Plan: plans/260924-1431-shopping-plan-redesign/phase-01-items-capture-page.md
Checks: eslint on the changed paths: 0 issues. `node --test`: 156/156 pass. `tsc`: 1 error, in shopping-plan-page.tsx:38. It comes from uncommitted phase-2 edits in the working tree (state.ts now requires checks/plan/dismissed). The commit's own state.ts only has items/purchases, so the commit should typecheck. I did not check this in a clean worktree.

## Critical
None found. Item ownership holds: the POST /api/purchases item upsert and PUT /api/shopping/items use the user's JWT client (publishable key, not service role), so RLS applies. With RLS, `INSERT ... ON CONFLICT DO UPDATE` on another user's row fails with an error instead of overwriting it. The row's user_id is always forced to auth.uid. linkTransactionId is checked by `user_id` + `kind='expense'` + "not already linked".

## High
1. **Shopping requests are mistaken for purchase logs.** This breaks the acceptance criterion. Examples (probed with a script):
   - "mua bỉm 300k cho em bé 8kg" -> purchase draft, merchant "Chợ".
   - "mua bỉm Merries ở Shopee 300k được không" -> purchase draft.
   - "mình định mua bỉm Merries 690k ở Shopee" -> purchase draft.
   - "sắp hết bỉm, mua Huggies 350k ở Tiki có rẻ không" -> purchase draft.
   - "mua kem dưỡng da 200k" -> treated as a log, because "da" matches the past-tense marker.

   Causes in capture.ts:
   - :29, merchant `\bcho\b(?! (be|con)\b)`: "cho" (for) folds to the same text as "chợ". "cho em", "cho chồng" and "cho vợ" all count as a merchant.
   - :56, looksLikePurchaseLog: a merchant name alone is enough, with no past-tense marker.
   - :35, NEED is missing "được không", "có rẻ không", "định", "tính", "sắp", "hay", "không".

   The chat route checks this before the LLM pipeline (api/chat/route.ts:100), so a core agent question returns a card instead of recommendations.

   Fix:
   - Require PAST for chat, not just a merchant.
   - Drop bare "cho" (keep "chợ" only when the original text has the diacritic, or when it follows "ở/tại").
   - Add question particles (`khong$`, `duoc khong`, `dinh|tinh|sap|hay`) to NEED.
   - Add these sentences as negative tests.
2. **Real purchases rejected (false negatives).** "đã mua 2 can nước giặt 380k" and "vừa mua lại 2 bịch bỉm 600k" are not detected. "can" (a jerrycan, also in PACK_WORDS) and "mua lại" are both in NEED (capture.ts:35). The existing test only calls parsePurchase on the "can" sentence, so the problem is hidden.
3. **Migration can fail on existing data** (202609240012:8,33). `shopping_items.name` has a 120-character limit, but it is backfilled from `purchases.product_name`, which allows up to 200 characters and comes from uncapped `catalog canonical_name`. One long name aborts the migration. Fix: `left(p.product_name,120)`, or allow 200 characters on the item.
4. **"Đã mua" from the catalog prefills the wrong pack size** (mark-purchased.tsx:44). It uses `match?.packSize ?? target.piecesPerPack`. Buying a different variant (44 pieces vs 64) of a product that already has an item prefills the old size, so `unitCount` and the estimate are wrong unless the user notices. Before this commit, the variant's quantity was used. For catalog targets, prefer `target.piecesPerPack`.
5. **`target.childId` is dropped.** recommendation-card.tsx:47 still passes it, but the draft card defaults to `existing?.childId ?? familyChildren[0]` (purchase-draft-card.tsx:34). In families with more than one child, the purchase and ledger entry go to the first child. Before this commit, `target.childId` was used.

## Medium
6. **Deploy order has no safe window.** Before the migration, the new code returns 500 from /api/shopping and fails POST /api/purchases (no shopping_items table; the `source`/`item_id` columns are missing). After the migration, the old code's purchase insert fails on `item_id NOT NULL`. So "Đã mua" is broken on one side or the other until both the migration and the deploy land. Options: apply the migration and deploy back to back, or add `NOT NULL` in a follow-up migration.
7. **`source` is set by the client** (purchase-validate.ts:47). A client can send `source:"ledger"` without linking a transaction. deletePurchase and deleteItem then keep the auto-created expense, leaving an orphaned ledger row. Server-side: reject "ledger" unless `linkTransactionId` is present, or force it: `purchase.source = link ? "ledger" : (purchase.source === "ledger" ? "quick" : purchase.source)`.
8. **Resource lookup uses `value in SHOPPING_RESOURCES`** ([resource]/route.ts:8). `/api/shopping/constructor` (or `toString`) passes the check, then `handler.validate` is undefined and the route throws a 500. Use `Object.hasOwn`. This is also a one-entry generic registry with `as never` casts, built ahead of phase 2. The plan specified a plain `/api/shopping/items` route.
9. **Stale item overwrites newer edits.** The draft card sends the full `existing` item (purchase-draft-card.tsx:47), and the server upserts every column. If the page's copy is stale (e.g. agent page loaded earlier, item paused or renamed elsewhere), status, name and dailyRate are silently reverted. Send only `itemId` plus the fields that changed (packSize/merchant/productId) and merge on the server.
10. **Links and deletes are not atomic.** Two concurrent links of the same `linkTransactionId` can both pass the "taken" check (purchase-store-server.ts:31-33). There is no unique index on `purchases.transaction_id`. Also, in POST, the item is saved before the purchase insert, so a failed insert leaves a new item with no purchases.

## Low
- The migration has no explicit `begin`/`commit`. It is atomic under `supabase db query` (a single implicit transaction), but not under a plain `psql -f`.
- `purchases.item_id` and `shopping_items.child_id` can point at another user's rows. FK checks bypass RLS, and PostgREST can be called directly with the user's JWT. UUIDs are unguessable, so impact is minimal.
- deleteItem emits no `PURCHASE_REMOVED` events (deletePurchase does) and ignores ledger delete errors.
- Demo upgradeLocal takes the first `dailyRate` it finds, not the latest (item-client.ts:17); the migration takes the latest.
- MarkPurchased's done label shows "đơn vị" when the item was just created (mark-purchased.tsx:41).
- Conversation metadata (`purchaseDraft`/`purchaseSaved`) is stored unvalidated; this is the same as the existing fields.
- The phase file still says `status: pending` with all boxes unchecked. `tests/family-brief.test.ts` is listed under Modify but was not touched.

## Acceptance criteria
- Main sentence -> correct draft: PASS (tested).
- "mua bỉm dưới 400k" / "nên mua bỉm gì": PASS. The broader "no shopping question misread" requirement FAILS (#1).
- Off-catalog item -> ledger + upcoming: PASS by code reading.
- /shopping has no product grid; the catalog is at /shopping/find with redirects: PASS.
- Tests green: PASS (156).

## Callers checked
- No remaining references to `estimateStock` / `StockEstimate` / `setPurchaseRate` / `tracking-list` / PATCH.
- Home, brief and agent are switched to `estimateItems`.
- Conversations metadata round-trips (GET spreads metadata).

## Unresolved questions
- Should the chat require PAST even when a merchant is present? That trades recall for precision.
- Is `NOT NULL` on `item_id` allowed to cause a short "Đã mua" outage during deploy?
