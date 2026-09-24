---
phase: 1
title: "Món đồ + ghi nhận + trang mới"
status: completed
priority: P1
effort: "1.5d"
dependencies: []
---

# Phase 1: Món đồ + ghi nhận + trang mới

## Overview
Đưa “món đồ nhà mình dùng” thành thực thể chính; lần mua không cần catalog; ghi lần mua bằng một câu (Trợ lý + ô ghi nhanh); `/shopping` mới = Ô ghi nhanh · Tháng này · Sắp cần mua · Đồ nhà mình dùng · Lịch sử; catalog dời sang `/shopping/find`.

## Requirements
- Functional: tạo/sửa/ẩn món; lần mua gắn `item_id`, `product_id` tùy chọn; parser câu tiếng Việt → nháp lần mua; thẻ xác nhận dùng chung (chat, ô ghi nhanh, “Đã mua” trên sản phẩm); khởi đầu lạnh theo tuổi bé; ước tính tồn theo món cho mọi nhóm; Home + Trợ lý dùng ước tính mới.
- Non-functional: rules-only; demo mode (localStorage) giữ chạy; migration add-only + backfill; không có câu hỏi mua hàng (“mua bỉm dưới 400k”) bị hiểu nhầm thành ghi lần mua.

## Architecture
- DB `202609240012_shopping_items.sql`: `shopping_items(id, user_id, name, category ∈ diapers|wipes|milk|solids|hygiene|household|other, unit, pack_size, brand, merchant, daily_rate (người dùng đặt), child_id, product_id, status ∈ active|paused|outgrown, timestamps)`; `purchases` + `item_id` (backfill 1 món / (user, product_id); **giữ nullable** theo review để bản app cũ chạy được giữa lúc migrate và deploy), `product_id` nullable, `source ∈ catalog|chat|quick|ledger|photo|plan`. RLS theo `user_id`, revoke anon.
- `lib/shopping/items.ts` (thuần): kiểu `ShoppingItem`, `defaultRate(item, ageMonths)` (bỉm theo `defaultDailyRate`; khăn ướt 10 tờ/ngày; sữa hộp theo tuổi; nhóm khác: 1 gói/30 ngày), `estimateItems(items, purchases, rateFor, now)` → `ItemEstimate` (itemId, name, unit, remaining, dailyRate, daysLeft, runsOutOn, rateSource default|learned|set, lastPurchase, purchaseCount, lastUnitPrice), `runningLow`, `itemFromTarget`. `purchases.ts` giữ `budgetHint`, `transactionForPurchase`, `defaultDailyRate`; `estimateStock` bị thay.
- `lib/shopping/capture.ts` (thuần): `looksLikePurchaseLog(text)`, `parsePurchase(text, items, today)` → `PurchaseDraft` (itemId?, name, category, unit, packs, packSize?, amount?, merchant?, purchasedOn, missing[]). Quy tắc: số tiền qua `parseVnd`; “2 bịch/gói/hộp…”; “64 miếng”, “L64”; nơi mua (Shopee, Lazada, Tiki, TikTok, Con Cưng, Bibo Mart, Kids Plaza, Bách Hóa Xanh, WinMart, Co.op, chợ…); “hôm qua/hôm kia/dd-mm”; khớp món cũ theo token không dấu; đoán nhóm theo từ khóa.
- Store/API: `lib/shopping/item-store-server.ts`, `lib/shopping/item-client.ts` (cloud + local); `/api/shopping/items` (GET/PUT/DELETE); `/api/purchases` POST nhận `{ purchase, item?, forChild }` — tạo món mới khi cần.
- Chat: `/api/chat` phát hiện ghi lần mua trước câu hỏi tiền → `ChatResponse.purchaseDraft` (không gọi LLM); UI Trợ lý render thẻ xác nhận.
- UI: `components/shopping/purchase-draft-card.tsx` (form dùng chung), `mark-purchased.tsx` thành lớp mỏng mở thẻ này; `components/shopping/shopping-plan-page.tsx` (+ `quick-capture.tsx`, `upcoming-timeline.tsx`, `item-card.tsx`, `starter-items.tsx`); `/shopping/find` = catalog + đã lưu (code cũ); chuyển hướng `?tab=search|saved` → `/shopping/find`, `/products`, `/saved` → `/shopping/find`.

## Related Code Files
- Create: `supabase/migrations/202609240012_shopping_items.sql`, `src/lib/shopping/{items,capture,item-store-server,item-client,item-validate,starter}.ts`, `src/app/api/shopping/items/route.ts`, `src/app/(app)/shopping/find/page.tsx`, `src/components/shopping/{shopping-plan-page,purchase-draft-card,quick-capture,upcoming-timeline,item-card,starter-items}.tsx`, `src/app/shopping-plan.css`, `tests/shopping-capture.test.ts`, `tests/shopping-items.test.ts`
- Modify: `src/lib/shopping/{purchases,purchase-validate,purchase-store-server,purchase-client}.ts`, `src/app/api/purchases/route.ts`, `src/app/api/chat/route.ts`, `src/lib/experience/types.ts`, `src/components/agent-shopping.tsx`, `src/components/shopping/{mark-purchased,tracking-list}.tsx`, `src/components/home/family-brief.tsx`, `src/lib/brief/build-brief.ts`, `src/app/(app)/shopping/page.tsx`, `src/app/products/page.tsx`, `src/app/saved/page.tsx`, `tests/purchases.test.ts`, `tests/family-brief.test.ts`
- Delete: phần catalog trong `shopping/page.tsx` (dời sang find); `tracking-list.tsx` nếu không còn dùng

## Implementation Steps
1. Migration + backfill.
2. `items.ts` + test ước tính (mặc định, cộng dồn, nhóm khác).
3. `capture.ts` + test (ghi vs hỏi mua, số lượng, nơi mua, ngày, khớp món).
4. Store/validate/API/client cho món; mở rộng lần mua.
5. Thẻ xác nhận dùng chung; MarkPurchased dùng lại.
6. Trang `/shopping` mới + khởi đầu lạnh + `/shopping/find` + chuyển hướng.
7. Chat: phát hiện + `purchaseDraft` + render.
8. Home/brief/Trợ lý dùng `estimateItems`.
9. typecheck · lint · test · commit.

## Success Criteria
- [x] “vừa mua 2 bịch Merries L 64 miếng 690k ở Shopee” → nháp đúng: 2 gói × 64 miếng, 690.000đ, Shopee, hôm nay.
- [x] “mua bỉm dưới 400k”, “nên mua bỉm gì” không bị hiểu là ghi lần mua.
- [x] Món ngoài catalog ghi được, vào sổ Tiền, hiện trong Sắp cần mua.
- [x] `/shopping` không có lưới sản phẩm; catalog ở `/shopping/find`.
- [x] Test cũ + mới xanh.

## Risk Assessment
- Backfill sai món khi cùng product_id khác tên → nhóm theo (user_id, product_id) lấy tên lần mua mới nhất. Tín hiệu: món trùng tên trên UI → gộp thủ công (sửa/ẩn).
- Parser bắt nhầm câu hỏi mua → yêu cầu có số tiền + dấu hiệu quá khứ/nơi mua, loại từ “dưới/tối đa/nên/cần/tìm/?”; thẻ xác nhận là lưới an toàn (không ghi khi chưa bấm).
