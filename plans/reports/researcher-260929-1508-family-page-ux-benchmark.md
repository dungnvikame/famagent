# Benchmark UX trang "Gia đình" (29/09/2026)

Lưu ý: tổng hợp từ hiểu biết về sản phẩm (không fetch web trực tiếp) → chi tiết UI cần đối chiếu ảnh chụp trước khi sao chép.

## 1. Sản phẩm & pattern
| Sản phẩm | Màn gia đình/thành viên | Pattern đáng học |
|---|---|---|
| Apple Family Sharing / Health | Hàng avatar, vai trò, "đang chia sẻ gì" | Danh sách gọn, sửa ở màn con, không form dài |
| Google Family Link | Thẻ từng bé + 1 số chính | Tóm tắt trước, cài đặt sau |
| Cozi | Mỗi thành viên 1 màu | Màu = danh tính, dùng xuyên app |
| FamilyWall | Feed, sinh nhật | Đếm ngược sinh nhật |
| Maple | Vai trò bố/mẹ/người chăm | Ông bà/giúp việc là thành viên (hợp VN) |
| Skylight / Hearth | Màn "hôm nay" nhìn 3 giây | Glanceable |
| Huckleberry | Hero tên + tuổi theo tuần, dự đoán | Tuổi điều khiển toàn bộ nội dung |
| Glow Baby | Biểu đồ tăng trưởng, cột mốc | Dữ liệu nhập ra được hình ảnh |
| BabyCenter / What to Expect | "Tuần thứ N" + so sánh kích thước | Móc cảm xúc theo tuổi |
| Kinedu | Hoạt động theo giai đoạn | "Làm gì hôm nay" hơn thông tin suông |
| Ohai / Ollie | Trợ lý AI "biết" gia đình | Cho thấy AI biết gì |
| ChatGPT Memory | Danh sách điều đã nhớ, xoá từng mục, hoàn tác | Chuẩn minh bạch bộ nhớ AI |
| Tinybeans / FamilyAlbum | Kỷ niệm gắn tuổi bé | Giữ chân bằng cảm xúc (ngoài phạm vi) |
| Qustodio | Báo cáo tuần theo bé | Digest tuần |
| Duolingo / OurHome | Streak, điểm | Bỏ: gây áp lực cho bố mẹ bé nhỏ |

## 2. Top pattern (theo tác động) — áp dụng cho FamAgent
1. Hero tuổi từng bé (tuổi tháng/ngày, ngày thứ N) — suy từ ngày sinh.
2. Tóm tắt trước, sửa sau: thẻ đọc + ngăn sửa tự lưu, bỏ form dài.
3. Hàng avatar thành viên đầu trang.
4. "Hôm nay cho bé" — 1 việc từ phương pháp nuôi dạy đã chọn (nội dung curated có sẵn).
5. Bộ nhớ AI minh bạch: nguồn, ngày, Đúng/Xoá, "Dùng cho".
6. Size bỉm ↔ cân nặng: "còn ~1,5kg nữa lên XL" + nhắc cân lại khi cũ >60 ngày — độc quyền của mình.
7. Màu riêng mỗi bé.
8. Chip "FamAgent dùng cho: Mua sắm / Tiền" giải thích lý do cần dữ liệu.
9. Gợi ý bổ sung 1–2 trường thiếu (không vòng % gây áp lực).
10. Đếm ngược sinh nhật + mốc ngày tuổi (500 ngày…).
11. Người chăm (ông bà/giúp việc) — để sau (đa người dùng).
12. Nhịp tuần của nhà (chi cho con, đồ sắp hết) — suy từ Tiền/Mua sắm.

Bỏ: vị trí (Life360), điểm/streak, album ảnh, lịch tiêm/cột mốc phát triển (quyết định 29/09).

## 3. Rủi ro
- Nội dung theo tuổi dễ thành lời khuyên y tế → chỉ dùng nội dung curated có nguồn (AASM/WHO/phương pháp), ghi "tham khảo", không chẩn đoán từ cân nặng.
- Dữ liệu trẻ em nhạy cảm (NĐ 13/2023) → ghi rõ mục đích, xoá bé có hỏi lại.
- Ghi nhớ sức khoẻ không lưu âm thầm → luôn hiện, xoá được.
- 0 bé / đang mang thai / nhiều bé phải có trạng thái riêng.

## Câu hỏi mở
- Cân nặng hiện chỉ 1 trường (có `fieldMeta.observedAt`) → không có biểu đồ tăng trưởng trừ khi lưu lịch sử.
- Người chăm/vợ chồng đăng nhập riêng: để sau theo roadmap.
