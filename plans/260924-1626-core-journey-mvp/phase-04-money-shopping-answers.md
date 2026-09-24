---
phase: 4
title: "Trả lời Tiền & Mua sắm"
status: pending
priority: P1
effort: "0.75d"
dependencies: [3]
---

# Phase 4: Trả lời Tiền & Mua sắm

## Overview
“Tháng này nhà tôi tiêu thế nào?” → đã chi, pace so **bình thường** (trung bình tới cùng ngày của tối đa 3 tháng trước; thiếu lịch sử thì so kế hoạch), nhóm tăng nhiều nhất, giải thích Con/Baby Care tăng do **lượng hay giá** (từ lần mua), CTA “Lập kế hoạch phần còn lại tháng”. “Mua lại bỉm cho Gold” → một thẻ: size còn hợp (cân nặng vs size), lần trước, giá thấp nhất từng trả (+ catalog nếu có), còn N ngày, `Ghi đã mua lại` / `So sánh loại khác`.

## Architecture
- `lib/money/explain.ts`: `explainMonth(current, history, purchases, items, now)` → `{ spent, normalAtDay, paceRatio, rises[], childCause }`; `planRestOfMonth(summary, now)` → mức chi/ngày còn lại + nhóm còn ngân sách.
- `lib/money/answer.ts`: dùng explain cho `overview`; thêm kind `plan_rest`.
- `/api/chat`: nạp 3 tháng trước; lựa chọn “Ghi đã mua lại <món>” → `purchaseDraft` từ lần mua trước.
- `lib/ai/shopping/pipeline.ts`: `StockLine` giàu hơn (itemId, lastPackPrice, minPackPrice, size fit); reorder reply theo spec.

## Success Criteria
- [ ] Test: tháng này 18,2M vs bình thường → “cao hơn ~9%”, top 2 nhóm tăng; bỉm tăng do lượng khi giá/miếng gần như không đổi.
- [ ] Test reorder: câu có lần trước, giá thấp nhất, còn N ngày, cảnh báo size khi gần trần.
