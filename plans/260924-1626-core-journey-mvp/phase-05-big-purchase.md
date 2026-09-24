---
phase: 5
title: "Quyết định mua lớn"
status: completed
priority: P2
effort: "0.5d"
dependencies: [4]
---

# Phase 5: Quyết định mua lớn

## Overview
“Tôi muốn mua robot hút bụi 8 triệu” → ảnh hưởng tới kế hoạch chi tháng, mục tiêu tiết kiệm, quỹ dự phòng; 3 lựa chọn `Mua ngay` · `Xem loại dưới ~X` · `Để tháng sau`. Không khẳng định “phù hợp nhu cầu” khi không có dữ liệu sản phẩm (phản biện §2.3).

## Architecture
- `lib/money/decision.ts`: `detectBigPurchase(text)` (muốn/định/tính/có nên mua + số tiền ≥ 1tr, không phải đồ tiêu hao) → `{ what, amount }`; `decide(amount, summary, goals, policy)` → text + mức giá giữ được mục tiêu + choices.
- `/api/chat` (và demo client): thứ tự: ghi lần mua → quyết định mua lớn → câu hỏi tiền → pipeline mua sắm. `Để tháng sau` → mục kế hoạch tháng sau; `Mua ngay` → nháp khoản chi.

## Success Criteria
- [x] Test: 8tr với còn 4,5tr kế hoạch và mục tiêu 5tr/tháng → nói thiếu mục tiêu ~3,5tr, gợi ý ≤ X, 3 lựa chọn.
- [x] “muốn mua bỉm dưới 400k” vẫn đi pipeline bỉm.
