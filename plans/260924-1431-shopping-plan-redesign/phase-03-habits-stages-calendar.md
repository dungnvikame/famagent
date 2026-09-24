---
phase: 3
title: "Thói quen + giai đoạn của bé + lịch sale/lương"
status: pending
priority: P2
effort: "0.75d"
dependencies: [2]
---

# Phase 3: Thói quen + giai đoạn của bé + lịch sale/lương

## Overview
Trực quan hóa hành vi mua (chi 6 tháng theo nhóm, nơi mua, giá/đơn vị, so trung bình theo tuổi), danh sách “Sắp tới theo giai đoạn của bé”, và mốc ngày lương/ngày sale trên dòng thời gian.

## Requirements
- Functional: cột chồng chi 6 tháng theo nhóm (từ lần mua); tỷ trọng nơi mua; sparkline giá/đơn vị + % thay đổi (3 lần gần nhất vs trước đó) trên thẻ món; nhịp mua trung vị; so mức dùng bỉm với mức trung bình theo tuổi; giai đoạn: sắp đổi size bỉm (cân nặng gần trần size, khoảng theo bao bì), ăn dặm 6 tháng, bình tập uống, giày tập đi, chuyển sữa 12 tháng, bô 18–30 tháng, đổi ghế ô tô ~9 kg / ~18 kg → “Đã có” / “Thêm vào kế hoạch”; mốc ngày lương (khoản định kỳ Thu) và ngày sale VN (ngày đôi hằng tháng, 11.11, 12.12, Black Friday, trước Tết) trên dòng thời gian; gợi ý chờ sale chỉ khi món còn đủ tới ngày đó và kế hoạch không vượt ngân sách.
- Non-functional: SVG/CSS thuần, không thêm thư viện biểu đồ; nhãn “khoảng, theo bao bì” cho ngưỡng size.

## Architecture
- `lib/shopping/insights.ts`: `monthlySpend(purchases, months, now)`, `merchantShare`, `unitPriceTrend(purchases)`, `cadenceDays`, `benchmarkNote(estimate, ageMonths)`.
- `lib/shopping/stages.ts`: `upcomingStages(profile, items, entries, now)` → mục có `stageKey`, lý do, thời điểm.
- `lib/shopping/calendar.ts`: `saleDays(from, to)`, `paydays(recurring, from, to)`, `waitForSale(estimate, sales, planOverBudget)`.
- UI: `habits-panel.tsx`, `stage-list.tsx`; timeline nhận markers; item-card thêm sparkline.

## Related Code Files
- Create: `src/lib/shopping/{insights,stages,calendar}.ts`, `src/components/shopping/{habits-panel,stage-list}.tsx`, `tests/shopping-insights.test.ts`
- Modify: `src/components/shopping/{shopping-plan-page,upcoming-timeline,item-card,month-plan}.tsx`, `src/lib/shopping/plan.ts`, `src/app/shopping-plan.css`

## Implementation Steps
1. insights + test.
2. stages + test (đổi size, mốc tuổi, đã có/đã thêm).
3. calendar + test (ngày đôi, Black Friday, lương, chờ sale).
4. UI + timeline markers.
5. typecheck · lint · test · commit.

## Success Criteria
- [ ] 6 tháng chi theo nhóm khớp tổng lần mua.
- [ ] Bé 10,6 kg đang dùng size L (≈9–14 kg) chưa cảnh báo; 13,4 kg → “sắp lên XL, đừng tích trữ L”.
- [ ] Bé 5 tháng → “Ăn dặm (khoảng 6 tháng)” trong danh sách.
- [ ] Dòng thời gian có mốc lương từ khoản định kỳ Thu và ngày sale trong 30 ngày.

## Risk Assessment
- Ngưỡng size khác nhau theo hãng → dùng khoảng chung + khoảng trên bao bì khi món có `product_id` catalog; nhãn rõ là ước tính.
- Gợi ý sale thành khuyến mua → điều kiện chặt (đủ hàng + trong ngân sách), không hiện ở Home.
