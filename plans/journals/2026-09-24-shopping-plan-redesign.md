# 24/09/2026 — Mua sắm: từ catalog sang “món đồ nhà mình dùng”

**Bối cảnh.** Chủ sản phẩm thấy trang Mua sắm vô giá trị (lưới sản phẩm không liên quan). Nguyên nhân gốc không phải UI: `purchases.product_id` bắt buộc là sản phẩm catalog, nên đồ mua ngoài catalog không ghi được và mọi thứ phía sau (theo dõi, nhắc) trống.

**Đã làm (plan 260924-1431, 4 phase + 2 vòng review).** Bảng `shopping_items`; ghi lần mua bằng một câu (quy tắc, không LLM) qua một thẻ xác nhận dùng chung; ước tính tồn học từ nhịp mua và câu “còn không?”; đối soát khoản chi nhập tay trong sổ Tiền; kế hoạch tháng gắn ngân sách; thói quen 6 tháng, giai đoạn của bé, mốc lương/sale; ảnh đơn hàng qua vision; PWA + Web Push hằng ngày.

**Điều đáng nhớ.**
- Review bắt nhiều lỗi thật mà test của chính mình không thấy: “cho” (for) không dấu = “chợ”; “da” = “đã”/“da”; merchant một mình không đủ để coi là câu kể đã mua. Bộ nhận câu giờ yêu cầu dấu hiệu quá khứ và loại từ hỏi/định/giới hạn giá, cả khi gõ không dấu.
- Thứ tự sự kiện trong ngày quan trọng cho ước tính: “Hết rồi” rồi mới mua; hai câu trả lời cùng ngày phải có thời điểm.
- Job máy chủ chạy bằng `DATABASE_URL` không phải người dùng → RLS “to authenticated” chặn hết; phải cấp riêng cho role máy chủ.
- Black Friday không phải “thứ Sáu cuối tháng 11”.

**Còn lại.** Áp migration 0012–0014 (backup trước), đặt VAPID/CRON_SECRET, xác nhận role của `DATABASE_URL` production, thử push và đọc ảnh thật; chia sẻ vợ/chồng là plan riêng.
