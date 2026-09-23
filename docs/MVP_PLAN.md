# Kế hoạch phát triển MVP — Family AI

**Cập nhật:** 23/09/2026 · **Phạm vi demo hiện tại:** luồng bỉm từ onboarding đến bước mở nơi bán. Đây là kế hoạch nguồn của MVP; mỗi mốc cập nhật trạng thái, kết quả kiểm tra và quyết định thay đổi ngay trong file này.

## 1. Hành trình cần chứng minh

1. Người dùng mới vào trang chủ. Agent hỏi thông tin cần thiết về bé và ưu tiên mua sắm; người dùng xem lại rồi bắt đầu.
2. Người dùng nói “Tôi cần bỉm ban đêm cho Gold, dưới 400k”. Hệ thống dùng bối cảnh Gold 10 kg/size L, hỏi lại nếu thiếu size và cân nặng.
3. Hệ thống lọc catalog theo điều kiện bắt buộc, xếp hạng bằng code, hiển thị 3–5 lựa chọn cùng giá mỗi miếng, lý do và điểm đánh đổi.
4. Người dùng mở chi tiết, chọn 2–3 sản phẩm để so sánh, rồi mở một offer của merchant. Hệ thống ghi nhận các bước trong funnel.
5. Người dùng quay lại có thể xem lịch sử, hồ sơ gia đình và sản phẩm đã lưu.

**Mục tiêu nghiên cứu:** Người dùng chọn nhanh hơn và tự tin hơn so với tự tìm trên marketplace. Đo bằng thời gian tới quyết định, mức tự tin 1–5 và phỏng vấn ngắn sau phiên dùng. Lượt bấm merchant là proxy, chưa phải đơn hàng.

## 2. Trạng thái triển khai

| Năng lực | Demo hiện có | Còn thiếu để phát hành thật |
|---|---|---|
| Onboarding bằng agent | Hội thoại 2 bước, tóm tắt, sửa/xóa hồ sơ, đồng ý dùng AI; đã nối lưu hồ sơ theo tài khoản khi có Supabase | Kiểm thử người dùng, thông tin riêng tư và auth trên staging |
| Catalog bỉm | Trang danh sách/chi tiết, lọc cân nặng, size, giá, thương hiệu | 50–100 variant được xác minh, ảnh và giá cập nhật |
| Hiểu yêu cầu | Structured Outputs khi có API key; parser quy tắc để chạy demo | Cấu hình model, kiểm thử tiếng Việt và trường hợp thiếu dữ liệu |
| Lọc và xếp hạng | Điều kiện bắt buộc, điểm 7 thành phần; API ghi intent/ứng viên/điểm vào Supabase khi đã đăng nhập | Kiểm chứng điểm chất lượng, seller trust, delivery và log trên staging |
| Gợi ý và so sánh | 3–5 thẻ, lý do từ catalog, bảng so sánh | Dữ liệu nguồn cho claim, kiểm tra diễn đạt, thử nghiệm UX |
| Mở merchant | Bước mua thử cho demo; redirect thật kiểm tra domain và ghi click khi có DB | Feed và URL thật, kiểm tra link, attribution |
| Lịch sử, đã lưu, analytics | API theo tài khoản và RLS khi có Supabase; demo vẫn lưu trình duyệt | Kiểm thử nhiều thiết bị, dashboard và độ tin cậy ghi sự kiện |
| Đánh giá | 50 tình huống tự động kiểm tra cân nặng và giá trần | Dataset thực tế, đánh giá hallucination và nghiên cứu người dùng |

## 3. Thứ tự phát triển tiếp theo

### Mốc 1 — Chốt onboarding và bối cảnh (dự kiến tuần 1)

- Thử onboarding với 5–8 bố/mẹ mục tiêu; ghi chỗ khó hiểu, câu bị bỏ qua và thời gian hoàn tất.
- Giữ câu hỏi tối thiểu cho nhu cầu mua đầu tiên: tên gọi của bé nếu muốn, cân nặng hoặc size, ưu tiên, ngân sách tùy chọn.
- Hoàn thiện thông báo dữ liệu, đồng ý dùng AI và chức năng sửa/xóa.
- Kết nối đăng nhập trước khi lưu hồ sơ và hội thoại trên server; bảo đảm chỉ chủ tài khoản đọc được dữ liệu.

**Nghiệm thu:** Người dùng mới hoàn tất trong tối đa 2 phút, biết thông tin nào đã lưu và có thể sửa/xóa; hồ sơ Gold 10 kg được dùng đúng trong câu hỏi đầu tiên.

### Mốc 2 — Chuẩn hóa dữ liệu bỉm và catalog (dự kiến tuần 1–2)

- Nhập 50–100 variant bỉm từ nguồn được phép sử dụng; xác minh ảnh, size, khoảng cân nặng, số miếng, giá, tình trạng hàng và URL.
- Chạy 3 migration trên Supabase dev, nhập CSV và kiểm tra giao diện/API với dữ liệu thật.
- Định nghĩa nguồn cho điểm dùng ban đêm, thấm hút và các claim; nếu chưa có bằng chứng thì để trống.
- Thiết lập quy trình cập nhật giá và kiểm tra link hằng ngày; tạm ẩn offer sai hoặc quá cũ.

**Nghiệm thu:** Không có sản phẩm publish thiếu dữ liệu bắt buộc; giá mỗi miếng lấy từ đúng variant/offer; không có sản phẩm sai size hoặc cân nặng trong mẫu kiểm tra.

### Mốc 3 — Làm chắc AI Shopping Agent (dự kiến tuần 3–4)

- Đánh giá Intent Agent với tối thiểu 50 câu tiếng Việt, gồm câu nói ngắn, nhiều điều kiện, sửa điều kiện trong hội thoại và danh mục chưa hỗ trợ.
- Xử lý tối đa 1–3 câu hỏi bổ sung khi thiếu thông tin quan trọng; không đoán cân nặng, size hoặc claim.
- Đưa truy vấn/lọc xuống PostgreSQL khi catalog tăng; giữ ranking deterministic và không dùng hoa hồng trong điểm.
- Lưu mỗi phiên gợi ý trên server: intent, ứng viên, sản phẩm bị loại, điểm thành phần, phiên bản xếp hạng và kết quả.

**Nghiệm thu:** Điều kiện bắt buộc đạt 100% trên bộ kiểm tra; lời giải thích chỉ dùng facts có nguồn; người dùng thấy được lý do và điểm đánh đổi.

### Mốc 4 — So sánh, merchant và analytics (dự kiến tuần 5–6)

- Hoàn thiện so sánh theo cùng variant/offer, hiển thị “Chưa có thông tin” ở chỗ thiếu.
- Kiểm tra allowlist domain merchant, redirect `/go/:offerId`, ghi click và affiliate disclosure.
- Ghi đủ funnel: vào trang → onboarding hoàn tất → hỏi AI → nhận gợi ý → xem sản phẩm/so sánh → mở offer.
- Dựng dashboard đánh giá funnel, độ trễ, tỷ lệ không có kết quả và nguồn lỗi dữ liệu.

**Nghiệm thu:** Lượt bấm dẫn đúng offer được xác minh; URL không xuất hiện trong API public; mỗi bước chính đo được bằng sự kiện.

### Mốc 5 — Kiểm chứng MVP và mở danh mục (dự kiến tuần 7–8)

- Chạy nghiên cứu so sánh Family AI với cách tìm trên marketplace cho cùng tình huống mua bỉm.
- Rà 50 tình huống offline và các phiên dùng thật, sửa lỗi hiểu intent, dữ liệu và diễn đạt.
- Chỉ sau khi luồng bỉm đạt ngưỡng, mở 7 danh mục còn lại theo độ sẵn sàng của dữ liệu: khăn ướt, nước giặt đồ em bé, nước rửa bình, nước giặt gia đình, nước rửa bát, khăn giấy, túi rác.
- Tạo thuộc tính và điều kiện bắt buộc riêng cho từng danh mục; không dùng schema/score bỉm cho sản phẩm khác.

**Nghiệm thu:** Có bằng chứng người dùng quyết định nhanh và tự tin hơn; các danh mục mở thêm đều đạt chuẩn dữ liệu và kiểm thử riêng.

## 4. Điều kiện phát hành công khai

- **100%** tuân thủ cân nặng, size, giá trần, còn hàng và các điều kiện bắt buộc khác trên bộ đánh giá và mẫu kiểm tra thủ công.
- Không có giá, thông số, review hoặc claim không có nguồn trong câu trả lời được kiểm tra.
- Link merchant lỗi **≤5%** trong mẫu offer publish; redirect chỉ tới domain đã duyệt.
- Offer có giá quá **48 giờ** chưa xác minh phải được đánh dấu hoặc ẩn; ngưỡng điều chỉnh theo nguồn feed.
- Độ trễ gợi ý p95 **≤8 giây** trên staging với catalog MVP.
- Hồ sơ gia đình/hội thoại có đăng nhập, phân quyền, xóa dữ liệu và thông báo rõ việc dùng AI/affiliate.

Các ngưỡng 48 giờ và 8 giây là mục tiêu thử nghiệm ban đầu, cần điều chỉnh theo dữ liệu thực. Không dùng sản phẩm minh họa trong phát hành công khai.

## 5. Phân công và phụ thuộc

| Vai trò | Trách nhiệm chính |
|---|---|
| Product/UX | Thử onboarding, tiêu chí gợi ý, nghiên cứu thời gian và mức tự tin |
| Data operations | Nguồn và quyền sử dụng catalog, kiểm tra giá/link/thuộc tính |
| Engineering | Auth, dữ liệu, agent, ranking, so sánh, redirect, analytics |
| QA | Bộ tình huống tiếng Việt, điều kiện bắt buộc, quyền dữ liệu, mobile |

**Phụ thuộc lớn nhất:** quyền dùng dữ liệu sản phẩm và merchant feed; tài khoản Supabase; API key/model của provider LLM nếu bật AI (free tier khi thử nghiệm); quyết định đăng nhập và retention. Những phần này không được thay bằng dữ liệu đoán hoặc URL giả.

## 6. Cách cập nhật tài liệu

Khi một mốc hoàn thành, cập nhật bảng trạng thái, kết quả đo, lỗi còn lại và ngày thực tế. Đổi hành vi sản phẩm ở [PRODUCT.md](PRODUCT.md), đổi schema/quy trình nhập ở [DATA.md](DATA.md), đổi kiến trúc ở [TECH_DECISIONS.md](TECH_DECISIONS.md). [SOURCE_SPEC.md](SOURCE_SPEC.md) giữ nguyên làm bản gốc tham chiếu.
