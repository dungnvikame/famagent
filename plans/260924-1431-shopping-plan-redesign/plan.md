---
title: "Mua sắm → Kế hoạch & thói quen mua sắm của nhà mình"
description: "Đổi Mua sắm từ catalog sang món đồ nhà mình dùng: ghi nhận bằng chat/ảnh, học mức dùng, kế hoạch tháng, trực quan hóa thói quen, nhắc sắp hết."
status: completed
priority: P1
effort: "4d"
tags: [shopping, money, agent, pwa]
created: 2026-09-24
---

# Mua sắm → Kế hoạch & thói quen mua sắm của nhà mình

## Overview

Nguồn: [brainstorm](../reports/brainstorm-260924-1421-shopping-plan-redesign.md) · [nghiên cứu](../reports/researcher-260924-1421-personal-shopping-planning.md) · [audit](../reports/brainstorm-260924-1358-product-audit-roadmap.md).
Nguyên nhân gốc: `purchases.product_id` bắt buộc là sản phẩm catalog → đồ mua ngoài catalog không ghi được → trang chỉ còn catalog. Plan đổi đơn vị dữ liệu sang **món đồ nhà mình dùng** (`shopping_items`), lần mua không cần catalog, rồi xây kế hoạch + thói quen + nhắc trên đó.

## Contract

- **Outcome:** `/shopping` trả lời: sắp cần mua gì · tháng này mua bao nhiêu/còn bao nhiêu · nhà mình mua thế nào · bé sắp cần gì. Catalog chỉ mở từ một món (“Tìm lựa chọn khác”).
- **Constraints:** rules-first (LLM chỉ cho ảnh đơn hàng); số liệu có nguồn hoặc nhãn “ước tính”; giữ chế độ demo (localStorage) chạy được; migration add-only + backfill, backup trước khi áp dụng; không đổi IA 5 mục.
- **Non-goals:** checkout/giỏ hàng; crawl marketplace; bank sync; mở danh mục catalog mới; **chia sẻ vợ/chồng** (cần mô hình hộ gia đình — plan riêng theo audit mục O2).
- **Acceptance:** xem Success Criteria.

## Quyết định mặc định (câu hỏi mở trong brainstorm, chưa có trả lời → chọn mặc định, đổi được)

1. Phạm vi món: tự do; gợi ý khởi đầu = đồ con theo tuổi + 3 đồ gia đình (nước giặt, giấy vệ sinh, nước rửa bát).
2. Catalog + affiliate giữ ở `/shopping/find`, chỉ mở từ món bỉm hoặc Trợ lý.
3. Ảnh đơn hàng: chỉ khi đã bật đồng ý AI (`aiConsent`) và server có AI; ảnh không lưu.
4. Nhắc ngày sale chỉ khi món còn đủ tới ngày sale; không bao giờ đẩy mua thêm khi vượt ngân sách.
5. Push: Web Push + PWA; ẩn khi thiếu khóa VAPID.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Món đồ + ghi nhận + trang mới](./phase-01-items-capture-page.md) | Completed |
| 2 | [Học mức dùng + đối soát sổ + kế hoạch tháng](./phase-02-learning-reconcile-plan.md) | Completed |
| 3 | [Thói quen + giai đoạn của bé + lịch sale/lương](./phase-03-habits-stages-calendar.md) | Completed |
| 4 | [Ảnh đơn hàng + PWA + nhắc sắp hết](./phase-04-photo-pwa-push.md) | Completed |

Phụ thuộc: 1 → 2 → 3; 4 cần 1 (ảnh) và 2 (ước tính có mốc kiểm tra) cho nhắc.

## Triển khai & dữ liệu

- Migration mới: `202609240012_shopping_items.sql` (P1), `202609240013_shopping_plan.sql` (P2), `202609240014_receipt_push.sql` (P4). Áp lên Supabase **chỉ sau khi chủ sản phẩm đồng ý**, `pg_dump` trước. Không push `main` (Vercel tự deploy) trước khi migration đã áp dụng.
- Mỗi phase: `tsc --noEmit`, `eslint`, `node --test`, commit riêng.

## Success Criteria

- [x] Ghi được lần mua món không có trong catalog bằng 1 câu (Trợ lý hoặc ô ghi nhanh), có thẻ xác nhận, tự vào sổ Tiền.
- [x] `/shopping` không còn lưới sản phẩm; catalog chỉ ở `/shopping/find`.
- [x] Sau 2 lần mua cùng món, mức dùng “theo nhà mình” thay mặc định; test: ngày hết sai ≤ ±3 ngày trên dữ liệu mẫu đều đặn.
- [x] Khoản chi Con/Mua sắm trong sổ chưa gắn món được hỏi “là mua gì?” và gắn 1 chạm (không tạo khoản trùng).
- [x] Kế hoạch tháng đề xuất từ ngày hết + giai đoạn bé, tổng so ngân sách.
- [x] Biểu đồ chi 6 tháng theo nhóm, nơi mua, giá/đơn vị, so mức trung bình theo tuổi.
- [x] Ảnh đơn hàng → danh sách thẻ xác nhận (khi có AI + đồng ý). *Kiểm bằng test với JSON mẫu; chưa gọi model vision thật.*
- [ ] Cài được như app; bật nhắc → nhận push khi món còn ≤ 3 ngày (khi có VAPID). *Code + test chọn món xong; chưa thử gửi thật vì chưa có khóa VAPID/CRON_SECRET và migration chưa áp dụng.*
- [x] typecheck/lint/test xanh ở mỗi phase.

<!-- slug: shopping-plan-redesign -->

## Kết quả (24/09/2026)

Commit trên `feat/shopping-plan-redesign`: `847ac13` P1 · `ec77fee` P2 + sửa review P1 · `0ea22cb` P3 · `997e3d5` P4 · `5f9ae0d` sửa review P2–4. 173 test, typecheck, lint xanh; kiểm tra trên trình duyệt ở chế độ demo. Review: [P1](../reports/code-reviewer-260924-1452-phase1-shopping-items.md), [P2–4](../reports/code-reviewer-260924-1452-phases2-4-shopping.md). **Chưa làm:** áp migration 0012–0014 lên Supabase, push nhánh, cấu hình VAPID/CRON_SECRET/LLM vision — chờ chủ sản phẩm.
