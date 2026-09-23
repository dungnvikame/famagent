---
phase: 6
title: "Catalog bỉm đã xác minh"
status: pending
priority: P1
effort: "1–2w (data ops, song song)"
dependencies: []
---

# Phase 6: Catalog bỉm đã xác minh

## Overview
Thay 6 sản phẩm demo bằng 50–100 variant bỉm thật, có nguồn và quyền sử dụng (MVP_PLAN Mốc 2, spec §50–51). Chủ yếu là việc data ops; engineering bổ sung kiểm tra chất lượng khi import và job làm mới giá/link.

## Requirements
- Functional:
  - Nhập qua `pnpm import-products -- data/products.csv` (đã có); import từ chối bản ghi thiếu trường bắt buộc (tên, brand, category, ảnh, variant, số miếng, khoảng cân nặng, giá, merchant, URL thuộc `merchant_domain` đã duyệt, tình trạng hàng).
  - Claim chất lượng (ban đêm, thấm hút) chỉ nhập khi có nguồn; thiếu → để trống, UI hiển thị "Chưa có thông tin".
  - Script kiểm tra hằng ngày: offer quá 48h chưa xác minh → đánh dấu/ẩn; link lỗi → ẩn.
- Non-functional: không trộn dữ liệu demo vào catalog thật (quyết định đã có trong PRODUCT.md).

## Architecture
- `scripts/import-products.mjs`: thêm báo cáo lỗi theo dòng, dry-run.
- `scripts/verify-offers.mjs`: HEAD/GET kiểm tra link + đánh dấu `last_verified_at`; chạy thủ công hoặc cron (sau).
- Supabase dev: chạy 3 migration hiện có + migration P2/P5.

## Related Code Files
- Modify: `apps/web/scripts/import-products.mjs`, `data/products.template.csv`, `docs/DATA.md`, `docs/OPERATIONS.md`
- Create: `apps/web/scripts/verify-offers.mjs`, `data/products.csv` (không commit nếu có điều khoản hạn chế)

## Implementation Steps
1. Chốt nguồn dữ liệu + quyền dùng ảnh/giá/link (owner: Data ops — cần chỉ định).
2. Tạo Supabase dev, chạy migrations (backup nếu đã có dữ liệu).
3. Nhập 20 variant thử → sửa import → nhập đủ 50–100.
4. Kiểm tra mẫu thủ công 20 sản phẩm: size, khoảng cân nặng, giá/miếng đúng variant/offer.
5. `verify-offers.mjs` + ghi quy trình vào OPERATIONS.md.

## Success Criteria
- [ ] ≥50 variant published, 0 bản ghi thiếu trường bắt buộc
- [ ] Mẫu kiểm tra: 0 sai size/cân nặng; giá/miếng khớp
- [ ] Link lỗi ≤5%

## Risk Assessment
- Không có quyền dữ liệu/affiliate program → **chặn release**; tín hiệu: sau tuần 2 chưa có nguồn → đưa quyết định lên user (thu thập thủ công có phép, hoặc hoãn release).
