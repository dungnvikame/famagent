---
phase: 8
title: "Đánh giá, staging, release MVP"
status: pending
priority: P1
effort: "1.5w"
dependencies: [4, 7]
---

# Phase 8: Đánh giá, staging, release MVP

## Overview
Kiểm chứng câu hỏi MVP (spec §3): người dùng chọn nhanh hơn và tự tin hơn so với tự tìm trên marketplace. Chạy eval offline, test người dùng, staging có auth/RLS, rồi kiểm tra release gate (MVP_PLAN §4, spec §61, §69).

## Requirements
- Functional:
  - Eval offline: 50 case shopping (có sẵn, mở rộng P5) + 30 case onboarding (P3) chạy trên provider thật; báo cáo hard-constraint, hallucination, số câu hỏi lại, latency.
  - Test người dùng 5–8 phụ huynh: onboarding (thời gian, chỗ khó hiểu) + so sánh với marketplace cùng tình huống bỉm (thời gian tới quyết định, tự tin 1–5).
  - Staging: Supabase + auth magic link + SMTP + **Anonymous Sign-ins + CAPTCHA** (D5); kiểm tra RLS (user A không đọc được dữ liệu user B, kể cả user ẩn danh), liên kết ẩn danh → email giữ nguyên hồ sơ/lịch sử, xóa dữ liệu.
  - Job dọn user ẩn danh không hoạt động >30 ngày (kèm dữ liệu cascade). <!-- Updated: Validation Session 1 - D5 -->
  - Đo tỷ lệ liên kết email sau onboarding (D6) — chỉ số giữ chân.
  - **Chi phí AI**: đo lượt gọi/phiên từ log P1; quyết định chuyển paid tier (hoặc provider không dùng dữ liệu để train) trước public launch.
- Non-functional: p95 gợi ý ≤8s; link lỗi ≤5%; offer >48h chưa xác minh bị ẩn/đánh dấu.

## Implementation Steps
1. Deploy staging (Vercel hoặc tương đương) + Supabase staging, chạy toàn bộ migration.
2. Chạy eval, sửa lỗi intent/dữ liệu/diễn đạt; lặp tới khi đạt gate.
3. Test người dùng, ghi kết quả vào `docs/MVP_PLAN.md` (bảng trạng thái) và `plans/reports/`.
4. Checklist release (bên dưới) → quyết định go/no-go với user.
5. Cập nhật `docs/PRODUCT.md` nhật ký quyết định, README.

## Success Criteria (release gate)
- [ ] 100% hard constraint trên eval + mẫu thủ công
- [ ] 0 giá/thông số/claim không có nguồn trong mẫu kiểm tra
- [ ] Onboarding: hoàn tất ≥70%, median ≤2 phút, dùng đúng profile ở câu hỏi đầu tiên
- [ ] RLS + xóa dữ liệu đã kiểm thử trên staging; consent AI/affiliate hiển thị rõ
- [ ] Provider AI cho public launch đã chốt (điều khoản dữ liệu phù hợp dữ liệu gia đình/trẻ em)
- [ ] Không còn dữ liệu demo trong môi trường public

## Risk Assessment
- Kết quả nghiên cứu không cho thấy nhanh/tự tin hơn → không mở rộng danh mục; quay lại P3–P5 điều chỉnh (spec §3: chưa chứng minh thì chưa build thêm).
- Sau khi đạt gate mới mở 7 danh mục còn lại (MVP_PLAN Mốc 5) — plan riêng, không nằm trong plan này.
