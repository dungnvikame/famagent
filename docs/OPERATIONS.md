# Vận hành MVP Family AI

## Kết nối môi trường staging

1. Tạo Supabase project riêng cho staging. Chạy lần lượt ba file trong `supabase/migrations` và kiểm tra các bảng, RLS, policy đã xuất hiện.
2. Đặt `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` trên web server. Đặt `DATABASE_URL` chỉ ở server để nhập catalog và ghi click merchant.
3. Trong Supabase Auth, đặt Site URL và Redirect URLs cho `/auth/confirm`. Sửa Magic Link và Confirm signup template theo hướng dẫn trong `README.md`; cấu hình SMTP và thử email thật.
4. Chỉ nhập sản phẩm đã kiểm tra quyền ảnh, nguồn thuộc tính, giá, tồn kho và URL. Chưa có dữ liệu đạt chuẩn thì giữ môi trường ở chế độ thử nghiệm.

## Kiểm tra trước khi phát hành

- Tài khoản A tạo hồ sơ, hội thoại và lưu sản phẩm. Đăng nhập tài khoản B trên trình duyệt khác: không thấy dữ liệu của A. Thử đọc và ghi trực tiếp qua Supabase Data API bằng token B phải bị RLS chặn.
- Đăng nhập bằng email trên thiết bị thứ hai: hồ sơ, hội thoại và sản phẩm đã lưu của cùng tài khoản phải xuất hiện. Sửa hồ sơ trên một thiết bị rồi tải lại thiết bị kia.
- Hỏi bỉm ban đêm cho bé 10 kg dưới 400.000đ: chỉ trả offer phù hợp cân nặng/size/giá; sản phẩm dùng đêm tốt hơn được ưu tiên khi các điều kiện khác tương đương.
- Xóa dữ liệu ở mục Gia đình: hồ sơ, hội thoại, phiên gợi ý và sản phẩm đã lưu của tài khoản không còn. Kiểm tra lại qua API và DB.
- Mở offer thật: chỉ redirect HTTPS tới domain đã duyệt; URL, variant, merchant và click khớp nhau. Offer sai domain hoặc hết hàng phải bị chặn.

## Theo dõi sau phát hành

- Theo dõi lỗi API, p95 thời gian trả gợi ý, tỷ lệ yêu cầu không có kết quả, link merchant lỗi và tỷ lệ dữ liệu giá quá hạn.
- Mỗi ngày đối chiếu giá, tồn kho và link của offer đã publish. Ẩn offer lỗi hoặc quá hạn xác minh.
- Mỗi tuần xem lại các câu hỏi bị hiểu sai, mẫu gợi ý không phù hợp và phản hồi của người dùng; cập nhật bộ đánh giá trước khi đổi thuật toán.

## Việc đang chặn phát hành công khai

Chưa có Supabase project và tài khoản thật để kiểm thử RLS/đăng nhập/SMTP; chưa có catalog và merchant feed được xác minh; chưa đo tải và độ trễ trên staging. Bản chạy với 6 sản phẩm hư cấu chỉ dùng để thử hành trình.
