# Dữ liệu sản phẩm và nhập CSV

## Cấu trúc hiện tại

`products` lưu sản phẩm gốc; `diaper_attributes` lưu thuộc tính riêng cho bỉm; `product_variants` lưu size và số miếng; `product_offers` lưu giá và tình trạng hàng theo merchant. Migration nằm tại `supabase/migrations/202609230001_catalog.sql`.

Trong vòng đầu, chỉ có danh mục `diapers`. Bảng thuộc tính riêng cho từng danh mục được thêm khi triển khai danh mục đó. Catalog public chỉ đọc sản phẩm `published = true`; URL affiliate không được cấp quyền đọc cho anon.

## Chuẩn nhập

File mẫu: `data/products.template.csv`. Mỗi dòng tương ứng một offer. Có thể lặp `product_id` và `variant_id` khi một variant có nhiều nơi bán; `offer_id` phải riêng. ID cần ổn định giữa các lần nhập. Tên cột, kiểu dữ liệu và giá trị cho phép được kiểm tra trong script `apps/web/scripts/import-products.mjs`.

`merchant_domain` là domain được phép mở từ nút “Xem nơi bán”. URL offer phải dùng HTTPS và thuộc domain này hoặc subdomain của nó. Nếu mạng affiliate chuyển qua một domain riêng, cần khai báo và xác minh domain đó trước khi nhập.

Trước khi nhập, người phụ trách dữ liệu xác nhận:

- Ảnh và mô tả có quyền sử dụng, đúng sản phẩm và variant.
- Khoảng cân nặng và size lấy từ nhãn hoặc thông tin chính thức; không suy từ review.
- Giá, số miếng, nơi bán và URL trỏ đúng cùng một variant; ghi thời điểm kiểm tra.
- Điểm chất lượng chỉ có khi có thang đo và nguồn được lưu lại; để trống nếu chưa xác thực.
- Offer hết hàng hoặc link lỗi được ẩn/cập nhật trước khi publish.

Script import kiểm tra cột bắt buộc và URL HTTPS, sau đó nhập trong một transaction. Cần `DATABASE_URL` kết nối PostgreSQL. Chạy lại với cùng ID sẽ cập nhật giá và thông tin thay vì tạo bản ghi mới. Không đưa mật khẩu DB vào CSV, Git hoặc biến `NEXT_PUBLIC_`.

## Dữ liệu minh họa

Khi chưa cấu hình Supabase, `apps/web/src/lib/catalog/demo.ts` cung cấp 6 sản phẩm hư cấu để thử giao diện. Các tên, thông số và giá không được dùng làm tư vấn mua thật. Chế độ Supabase không tự chuyển về demo khi truy vấn lỗi để tránh che giấu sự cố dữ liệu.

## Việc cần bổ sung trước khi mở chat công khai

Nguồn và thời điểm xác thực cho từng thuộc tính, quy trình cập nhật offer, chính sách gỡ sản phẩm, bảng lịch sử thay đổi giá và bộ dữ liệu đánh giá. Các điểm chất lượng như “chống tràn” cần định nghĩa và bằng chứng trước khi xuất hiện trong lời giải thích.

## Dữ liệu người dùng và tài khoản

Khi chưa có Supabase, onboarding, hồ sơ, hội thoại và sản phẩm đã lưu nằm trong `localStorage` để thử luồng. Khi có URL và publishable key, người dùng đăng nhập bằng email; API `/api/me`, `/api/conversations`, `/api/saved`, `/api/events` xác thực tài khoản trước khi đọc/ghi. Migration thứ hai và thứ ba tạo bảng, RLS, cột tuổi bé và log kết quả gợi ý. Trang `/family` cho phép sửa hoặc xóa hồ sơ, hội thoại và sản phẩm đã lưu. Chưa kiểm thử quyền và xóa dữ liệu trên Supabase thật.

## Hồ sơ gia đình v2 (migration `202609240001_family_profile_v2.sql`)

Hồ sơ chứa đủ bối cảnh theo [SOURCE_SPEC §12–13](SOURCE_SPEC.md): số người lớn; mỗi bé có tên gọi, ngày sinh (ưu tiên hơn tuổi theo tháng), cân nặng, size, lưu ý (`sensitive_skin`, `rash_prone`, `fragrance_free`), thương hiệu đang dùng, thích và muốn tránh; ưu tiên giá (`budget`, `value`, `balanced`, `premium`), ưu tiên giao hàng, ngân sách, thương hiệu tin dùng, thành phần muốn tránh; loại máy giặt. `onboarding` ghi nhóm câu hỏi agent đã hỏi hoặc người dùng bỏ qua.

**Nguồn gốc giá trị ([SPEC_V1 §6.1](SPEC_V1_PURCHASING_AGENT.md)):** hồ sơ chỉ chứa giá trị đã xác nhận. `field_meta` lưu cho từng trường (vd `maxBudget`, `children.<id>.weightKg`) `source` (`user_entered` khi người dùng tự nhập ở `/family` hoặc ra lệnh sửa trong chat; `user_confirmed` khi xác nhận giá trị agent đề xuất), `observedAt`, `confirmedAt`. Quan sát tạm thời và dữ liệu suy ra (vd lượng còn, mức dùng/ngày) chưa lưu ở lớp này; sẽ thêm bảng riêng cùng tính năng mua lại. Ánh xạ DB ↔ hồ sơ nằm duy nhất ở `apps/web/src/lib/experience/profile-mapper.ts`.

Migration chỉ thêm cột và nới ràng buộc, không xóa dữ liệu. **Thứ tự triển khai: sao lưu → chạy migration → rồi mới deploy code.** Code mới ghi các cột mới (`field_meta`, `preferred_brands`, `sensitivities`…) và giá trị `pricePreference = "value"`; deploy trước migration làm `PUT /api/me` và cập nhật hồ sơ qua chat lỗi 500 (đọc hồ sơ vẫn chạy). Lệnh `pg_dump` ở đầu file migration. Dữ liệu trình duyệt cũ (`family-ai:profile:v1`) vẫn hợp lệ vì mọi trường mới đều tùy chọn.

## Giới hạn lượt gọi AI (migration `202609240002_request_quota.sql`)

`api_request_limits` đếm lượt gọi LLM theo người dùng (kể cả người dùng ẩn danh) cho `chat` (60/giờ) và `onboarding` (20/giờ). Hàm `consume_request_quota(endpoint, limit)` đếm và ghi trong cùng một giao dịch nên yêu cầu song song không vượt giới hạn. Người dùng không còn quyền xóa bản ghi của mình (trước đây xóa trực tiếp qua API là vượt được giới hạn); bản ghi chỉ có user_id, endpoint, thời điểm và bị xóa cùng tài khoản. Vì vậy "Xóa hồ sơ và dữ liệu mua sắm" không xóa các bản ghi này. Thứ tự: sao lưu → migration `202609240001` → `202609240002` → deploy code.

## Trace và lý do loại (migration `202609240003_agent_trace.sql`)

`recommendation_sessions.rejected_products` lưu sản phẩm bị lọc cứng và mã lý do (`weight`, `size`, `price_total`, `price_unit`, `excluded_brand`, `out_of_stock`, `category`); `recommendation_items.score_version` ghi phiên bản công thức. `agent_runs` lưu mỗi lượt agent: trạng thái cuối, các bước (tên trạng thái, thời gian, số ứng viên), phiên bản thuật toán — không lưu nội dung tin nhắn hay prompt. Thứ tự: sao lưu → `202609240001` → `202609240002` → `202609240003` → deploy code.
