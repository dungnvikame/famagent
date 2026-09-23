# Vận hành MVP Family AI

## Kết nối môi trường staging

1. Tạo Supabase project riêng cho staging. Sao lưu trước (`pg_dump`) nếu DB đã có dữ liệu, rồi chạy lần lượt mọi file trong `supabase/migrations` theo thứ tự tên (các migration `202609240001`→`0005` phải chạy trước khi deploy code mới) và kiểm tra các bảng, RLS, policy đã xuất hiện.
2. Đặt `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` trên web server. Đặt `DATABASE_URL` chỉ ở server để nhập catalog và ghi click merchant.
3. Trong Supabase Auth, đặt Site URL và Redirect URLs cho `/auth/confirm`. Sửa Magic Link và Confirm signup template theo hướng dẫn trong `README.md`; cấu hình SMTP và thử email thật.
4. Chỉ nhập sản phẩm đã kiểm tra quyền ảnh, nguồn thuộc tính, giá, tồn kho và URL. Luôn chạy `pnpm import-products -- <csv> --dry-run` trước, sửa hết lỗi rồi mới nhập thật. Chưa có dữ liệu đạt chuẩn thì giữ môi trường ở chế độ thử nghiệm.
5. Bật Auth > Anonymous Sign-ins và Auth > CAPTCHA (Cloudflare Turnstile) trong Supabase; đặt secret key Turnstile ở Supabase và `NEXT_PUBLIC_TURNSTILE_SITE_KEY` trên web server. Thiếu site key thì ứng dụng không gửi token và Supabase sẽ từ chối đăng nhập khi CAPTCHA đang bật.
6. Lên lịch `pnpm cleanup-anonymous` mỗi tuần (báo cáo; thêm `--apply` sau khi sao lưu để xóa khách ẩn danh không hoạt động >30 ngày). Báo cáo cũng cho tỷ lệ người đã onboarding có liên kết email.
7. Lên lịch `pnpm verify-offers` mỗi ngày (cron trên server có `DATABASE_URL`); cảnh báo khi mã thoát là 2 (tỷ lệ lỗi >5%).

## Kiểm tra trước khi phát hành

- Tài khoản A tạo hồ sơ, hội thoại và lưu sản phẩm. Đăng nhập tài khoản B trên trình duyệt khác: không thấy dữ liệu của A. Thử đọc và ghi trực tiếp qua Supabase Data API bằng token B phải bị RLS chặn.
- Đăng nhập bằng email trên thiết bị thứ hai: hồ sơ, hội thoại và sản phẩm đã lưu của cùng tài khoản phải xuất hiện. Sửa hồ sơ trên một thiết bị rồi tải lại thiết bị kia.
- Hỏi bỉm ban đêm cho bé 10 kg dưới 400.000đ: chỉ trả offer phù hợp cân nặng/size/giá; sản phẩm dùng đêm tốt hơn được ưu tiên khi các điều kiện khác tương đương.
- Xóa dữ liệu ở mục Gia đình: hồ sơ, hội thoại, phiên gợi ý và sản phẩm đã lưu của tài khoản không còn. Kiểm tra lại qua API và DB.
- Mở offer thật: chỉ redirect HTTPS tới domain đã duyệt; URL, variant, merchant và click khớp nhau. Offer sai domain hoặc hết hàng phải bị chặn.

## Cổng phát hành MVP (plan P8)

Chỉ mở công khai khi mọi mục dưới đây đạt; ghi kết quả vào `plans/reports/`.

| Mục | Cách kiểm tra | Đạt khi |
|---|---|---|
| Bộ lọc cứng, số liệu có nguồn | `pnpm test` (gồm `tests/eval-shopping-v1.test.ts`, 44 tình huống theo SPEC_V1 §21) + mẫu thủ công 20 câu trên staging | 0 vi phạm; 0 giá/thông số không có nguồn |
| Eval với provider thật | Bật `AI_ENABLED` + key trên staging, chạy `EVAL_BASE_URL=<staging> pnpm eval` và hỏi lại bộ tình huống trong `apps/web/evals/shopping-v1.ts` qua giao diện | 0 vi phạm; ghi số câu hỏi lại, độ trễ |
| Onboarding | Test 5–8 phụ huynh, bấm giờ | Hoàn tất ≥70%, median ≤2 phút, câu hỏi mua sắm đầu tiên dùng đúng hồ sơ |
| Quyền và xóa dữ liệu | Mục "Kiểm tra trước khi phát hành" ở trên, thêm tài khoản ẩn danh | RLS chặn truy cập chéo; liên kết email giữ hồ sơ; xóa dữ liệu sạch |
| Catalog | `pnpm import-products -- <csv> --dry-run`, `pnpm verify-offers` | ≥50 variant thật; link lỗi ≤5%; không còn dữ liệu minh họa |
| Hiệu năng | View `agent_latency_daily` | p95 ≤8 giây |
| AI provider | Điều khoản dữ liệu của provider trả phí/không dùng dữ liệu để huấn luyện | Đã chốt trước khi mở công khai |
| Minh bạch | Xem thẻ gợi ý, so sánh, trang sản phẩm, chân trang | Có đồng ý AI và công bố hoa hồng |

## Theo dõi sau phát hành

- Theo dõi lỗi API, p95 thời gian trả gợi ý, tỷ lệ yêu cầu không có kết quả, link merchant lỗi và tỷ lệ dữ liệu giá quá hạn. Các view trong Supabase SQL editor (migration `202609240005`): `analytics_funnel_daily` (homepage_view → onboarding_completed → ai_message_sent → recommendation_generated → product_clicked/compare_started → offer_clicked, theo ngày), `recommendation_quality_daily` (tỷ lệ phiên không có kết quả), `agent_latency_daily` (p50/p95 thời gian một lượt agent), `affiliate_clicks_daily` (click theo merchant). Các view không cấp cho `anon`/`authenticated`; xem bằng tài khoản quản trị.
- Mỗi ngày chạy `pnpm verify-offers`; xem báo cáo, sao lưu `product_offers` rồi chạy `--apply` để ẩn offer lỗi hoặc quá hạn xác minh. Nhập lại giá mới qua CSV.
- Mỗi tuần xem lại các câu hỏi bị hiểu sai, mẫu gợi ý không phù hợp và phản hồi của người dùng; cập nhật bộ đánh giá trước khi đổi thuật toán.

## Việc đang chặn phát hành công khai

Chưa có Supabase project và tài khoản thật để kiểm thử RLS/đăng nhập/SMTP; chưa có catalog và merchant feed được xác minh; chưa đo tải và độ trễ trên staging. Bản chạy với 6 sản phẩm hư cấu chỉ dùng để thử hành trình.
