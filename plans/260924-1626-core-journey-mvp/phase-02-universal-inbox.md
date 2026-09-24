---
phase: 2
title: "Universal Inbox"
status: pending
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 2: Universal Inbox

## Overview
Một ô “Ghi nhanh” trên mọi trang (app shell). Câu → phân loại: **lần mua đồ dùng** (Expense + Purchase + Consumption) · **chi thường** (Expense) · **thu** · **câu hỏi** (→ Trợ lý) · **link** · **ảnh**. Mọi nháp: một câu “Tôi hiểu đây là … Đúng không?” + `Đúng` / `Sửa`.

## Architecture
- `lib/inbox/classify.ts` (thuần): `classifyInbox(text, items, categories, today)` → `{ kind: "purchase" | "expense" | "income" | "question" | "link", purchase?, expense?, url? }`; lần mua khi có “mua” + đồ dùng (nhóm đồ tiêu hao hoặc khớp món); chi thường theo từ khóa → nhóm trong sổ (Ăn uống, Đi lại, hóa đơn…); thu (“lương”, “thưởng”, “nhận”).
- `summaryOf(draft, children)` → câu tóm tắt tiếng Việt (“Merries L64 cho Gold, 369K, Shopee, hôm nay”).
- `PurchaseDraftCard` + `ExpenseDraftCard` có chế độ `summaryFirst`: câu + `Đúng` (ghi luôn nếu đủ dữ liệu) / `Sửa` (mở form).
- Link: `POST /api/inbox/link` — chỉ host sàn đã biết (shopee.vn, shp.ee, lazada.vn, tiki.vn, tiktok.com, concung.com, bibomart.com.vn…), timeout 5 s, ≤ 1 MB, đọc `og:title`, giá từ meta/JSON-LD nếu có; không được → trả `{ title?: , price: null }` và UI hỏi giá. `LinkCard`: khớp món, giá/đơn vị so lần trước, còn N ngày, câu ngân sách; hành động “Đã mua” / “Thêm vào kế hoạch”.
- `components/inbox/inbox.tsx` trong `AppShell` (nút nổi trên điện thoại, thanh trên desktop); ảnh dùng lại `PhotoCapture`.

## Success Criteria
- [ ] “Hôm nay mua bỉm 369k” → nháp lần mua; `Đúng` → +1 khoản chi (Con), +1 lần mua, cập nhật tồn.
- [ ] “ăn trưa 80k” → khoản chi Ăn uống; “lương về 25tr” → khoản thu; “tháng này tiêu bao nhiêu” → Trợ lý.
- [ ] Link sàn không đọc được giá → hỏi giá, không lỗi; host lạ → từ chối.
- [ ] Test phân loại, tóm tắt, bộ đọc meta.
