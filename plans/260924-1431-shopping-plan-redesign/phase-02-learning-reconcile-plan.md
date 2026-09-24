---
phase: 2
title: "Học mức dùng + đối soát sổ + kế hoạch tháng"
status: completed
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 2: Học mức dùng + đối soát sổ + kế hoạch tháng

## Overview
Ước tính “theo nhà mình” thay mặc định (từ nhịp mua và câu hỏi “còn không?”), gắn khoản chi đã nhập tay trong sổ với món, và kế hoạch mua tháng gắn ngân sách.

## Requirements
- Functional: mức dùng học từ ≥2 lần mua hoặc 2 mốc kiểm tra; hỏi 1 chạm “Còn không? Hết · Còn ít · Còn khoảng nửa · Còn nhiều” (Home + thẻ món); đối soát khoản Chi nhóm Con/Mua sắm chưa gắn món (2 tháng gần nhất) → chip món / Món khác / Không phải đồ dùng; kế hoạch tháng = đề xuất (món hết trước cuối tháng + 7 ngày) ∪ dòng người dùng thêm; bỏ qua, dời tháng sau, đã mua → thẻ xác nhận; tổng so ngân sách (`budgetHint`).
- Non-functional: gắn khoản sổ **không** tạo khoản chi mới; mọi thứ quy tắc; demo mode chạy.

## Architecture
- DB `202609240013_shopping_plan.sql`: `stock_checks(id, user_id, item_id, checked_on, remaining numeric)`; `shopping_plan_entries(id, user_id, month, item_id?, name, packs, est_amount, reason ∈ running_low|stage|manual|sale, status ∈ planned|bought|skipped, stage_key?)`; `shopping_tx_dismissed(user_id, transaction_id)`.
- `items.ts`: `learnedRate(purchases, checks)` (ưu tiên: đặt tay > mốc kiểm tra ≥3 ngày > khoảng mua ≥3 ngày > mặc định); ước tính từ mốc kiểm tra gần nhất; `levelToRemaining(level, estimate, item)`.
- `lib/shopping/reconcile.ts`: `unlinkedTransactions(transactions, purchases, dismissed)`; `/api/purchases` POST `linkTransactionId` (kiểm tra thuộc user, chưa gắn).
- `lib/shopping/plan.ts`: `proposePlan(estimates, month, now)`, `mergePlan(proposals, entries, purchases)`, `planTotal`.
- API `/api/shopping/[resource]` (items, checks, plan, dismissed) theo mẫu `api/money/[resource]`; client tương ứng.
- UI: `stock-check.tsx`, `reconcile-card.tsx`, `month-plan.tsx`; Home: 1 câu hỏi (đối soát hoặc còn không) + 2 món sắp hết.

## Related Code Files
- Create: `supabase/migrations/202609240013_shopping_plan.sql`, `src/lib/shopping/{reconcile,plan}.ts`, `src/app/api/shopping/[resource]/route.ts`, `src/components/shopping/{stock-check,reconcile-card,month-plan}.tsx`, `tests/shopping-plan.test.ts`
- Modify: `src/lib/shopping/{items,item-store-server,item-client,purchase-store-server}.ts`, `src/app/api/purchases/route.ts`, `src/app/api/shopping/items/route.ts` (gộp vào [resource]), `src/components/shopping/{shopping-plan-page,item-card,purchase-draft-card}.tsx`, `src/components/home/family-brief.tsx`

## Implementation Steps
1. Migration.
2. `learnedRate` + ước tính từ mốc + test sai số ≤ ±3 ngày.
3. Đối soát + API gắn khoản + test không tạo khoản trùng.
4. Kế hoạch tháng + test đề xuất/gộp/tổng.
5. UI + Home.
6. typecheck · lint · test · commit.

## Success Criteria
- [x] Mua đều 64 miếng mỗi 12 ngày → mức dùng ~5,3/ngày, dự báo lệch ≤ ±3 ngày.
- [x] “Hết” hôm nay → daysLeft 0, lần mua sau cộng từ 0.
- [x] Gắn khoản “Shopee 690k” vào món: 1 lần mua mới, 0 khoản chi mới.
- [x] Kế hoạch tháng hiện món sắp hết với số gói + tiền dự kiến, tổng và câu ngân sách.

## Risk Assessment
- Người dùng mua dồn (tích trữ) làm mức dùng học sai → chỉ dùng khoảng giữa các lần mua khi lần sau không quá sớm (≥ 40% thời gian dự kiến); mốc kiểm tra thắng khoảng mua.
- Đối soát làm phiền → tối đa 1 câu trên Home, 3 trên Mua sắm; “Không phải đồ dùng” nhớ vĩnh viễn.
