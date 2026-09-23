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
