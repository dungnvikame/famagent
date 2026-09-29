# Trang Gia đình mới (29/09/2026)

Preview duyệt: [preview.html](preview.html) · benchmark: [../reports/researcher-260929-1508-family-page-ux-benchmark.md](../reports/researcher-260929-1508-family-page-ux-benchmark.md)
Owner thêm yêu cầu: biểu đồ cân nặng, chỉnh avatar bố mẹ/con, thêm tính năng hay.

## Đã làm (branch `feat/family-page`)
- Migration `202609290021_family_page.sql`: `child_weights` (1 lần cân/bé/ngày), `member_avatars` (JPEG vuông ≤256px, ≤120KB). Chỉ thêm bảng, RLS theo user.
- Hồ sơ (`household` jsonb, không thêm cột): `members` (người lớn: tên, vai trò Bố/Mẹ/Ông/Bà/Người chăm bé, emoji, màu; `adultsCount` = số người), `looks` (emoji + màu từng bé), `motto`, `theme` (5 ảnh bìa).
- `profile-store` tự ghi 1 lần cân khi cân nặng hồ sơ đổi (form hay chat) → biểu đồ luôn đủ điểm.
- API `/api/family/weights`, `/api/family/avatars`; demo mode dùng localStorage.
- UI `components/family/*`: bìa + avatar cả nhà + "Hôm nay" (mốc ngày tuổi, sinh nhật, đồ sắp hết, khoản đến hạn, việc nuôi dạy); 4 ô nhịp (ẩn ô không có dữ liệu); hồ sơ bé (vòng tới sinh nhật, confetti ngày sinh nhật, "Hôm nay với bé" tick đồng bộ Trang chủ, giờ ngủ AASM/màn hình WHO theo tuổi, biểu đồ cân nặng trên vùng size bỉm + nhịp tăng + dự báo ngày lên size + gợi ý đổi size, lưu ý chọn đồ kèm lý do); bộ nhớ FamAgent (chờ xác nhận, lọc, dùng cho gì); ưu tiên, nuôi dạy, tài khoản thu gọn. Mọi sửa trong ngăn bên, tự lưu.
- Bỏ `family-editor.tsx`, `family-notes.tsx`. Ẩn máy giặt & "điều quan trọng nhất" (roadmap §6).
- Test: `tests/family-page.test.ts` (tuổi, sinh nhật 29/02, mốc ngày, chuỗi cân, nhịp tăng, dự báo size, validate).

## Triển khai
1. Áp migration 0021 lên staging TRƯỚC khi push (DELETE /api/me xoá cả 2 bảng mới).
2. Merge `feat/family-page` → main, push (Vercel tự deploy).
