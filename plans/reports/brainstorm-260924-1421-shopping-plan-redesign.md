# Mua sắm → “Kế hoạch & thói quen mua sắm của nhà mình”

Ngày 24/09/2026 · Tiếp nối [audit sản phẩm](brainstorm-260924-1358-product-audit-roadmap.md) · Nghiên cứu: [researcher-260924-1421-personal-shopping-planning.md](researcher-260924-1421-personal-shopping-planning.md)

## 0. Contract

- **Outcome:** trang Mua sắm trả lời 4 câu *của riêng nhà mình*: sắp cần mua gì · tháng này mua bao nhiêu, còn bao nhiêu ngân sách · nhà mình mua thế nào (nhịp, giá/đơn vị, nơi mua) · sắp tới bé cần gì mới. Agent ghi nhận, học và trực quan hóa từ dữ liệu thật; catalog chỉ là công cụ phụ.
- **Constraints:** rules-first (LLM chỉ để hiểu câu/ảnh); mọi con số có nguồn (lần mua, sổ Tiền, hồ sơ bé) hoặc gắn nhãn “ước tính”; không đòi nhập nhiều hơn hiện nay; tái dùng `lib/shopping/purchases.ts`, `budgetHint`, `transactionForPurchase`, sổ Tiền.
- **Non-goals:** không làm checkout/giỏ hàng; không crawl marketplace; không bank sync; không mở catalog danh mục mới trong đợt này.
- **Acceptance:** (1) ghi được lần mua món *không có trong catalog* chỉ bằng 1 câu chat; (2) trang mở ra không có danh sách sản phẩm chung chung; (3) sau 2 lần mua cùng món, ngày hết dự báo sai ≤ ±3 ngày; (4) ≥ 80% chi tiêu nhóm Con/Mua sắm trong sổ gắn được với một món.

## 1. Vì sao thiết kế hiện tại không có giá trị (nguyên nhân gốc)

| Triệu chứng | Nguyên nhân trong code |
|---|---|
| Trang mở vào lưới sản phẩm chẳng liên quan | Tab mặc định = `search` → `getProducts()` toàn catalog (`shopping/page.tsx:18-24`); bộ lọc không lấy từ hồ sơ bé |
| “Đang theo dõi” gần như luôn trống | `Purchase` **bắt buộc `productId` của catalog** (`purchase-validate.ts:13`); chỉ ghi được qua nút “Đã mua” trên thẻ sản phẩm/gợi ý → đồ mua ngoài catalog (99% thực tế) không vào được |
| Không học được thói quen | Chỉ có 1 mô hình tiêu hao: bỉm, miếng/ngày theo tuổi (`defaultDailyRate`); không có nhịp mua, giá/đơn vị theo thời gian, nơi mua |
| Chat không giúp ghi | Coordinator không có intent “ghi lần mua”; `monthly_basket`, `price_check` đang là “đang phát triển” (`pipeline.ts:27-30`) |
| Tiền và Mua sắm không nói chuyện với nhau | Chỉ chiều Mua → Sổ; khoản “Shopee 690k” nhập tay trong sổ không bao giờ thành lần mua |

→ Vấn đề không phải UI, mà **đơn vị dữ liệu sai**: trang xoay quanh *Sản phẩm của catalog*, trong khi giá trị nằm ở *Món đồ nhà mình dùng*.

## 2. Bài học thị trường (rút từ báo cáo nghiên cứu)

- **Amazon Buy Again / Instacart “usuals” / Shopee Mua lại:** giá trị đến từ *lịch sử của chính mình*, không phải gợi ý mới. Nhưng họ có dữ liệu đơn hàng sẵn — FamAgent phải tự thu thập.
- **Pantry apps (Out of Milk, NoWaste):** chết vì phải cập nhật tồn kho tay; lệch sau ~3 tuần. → Không bắt người dùng đếm; ước tính từ nhịp mua + hỏi 1 chạm thỉnh thoảng.
- **Huckleberry:** log 1 chạm, biểu đồ theo ngày → người dùng chịu ghi khi thấy biểu đồ ngay.
- **Babylist:** checklist theo giai đoạn tuổi → “sắp cần gì” có giá trị khi gắn tuổi/cân nặng thật.
- **Keepa/CamelCamelCamel:** biểu đồ giá theo thời gian → áp cho *giá/miếng nhà mình đã trả*, không cần crawl.
- Thu thập khả thi ở VN: chat > ảnh chụp đơn Shopee/Lazada (vision, xác nhận trước khi lưu) > email/hóa đơn điện tử (tốn bảo trì) > dán link (chỉ theo dõi giá).

## 3. Mô hình mới: lấy “Món đồ nhà mình dùng” làm trung tâm

```
household_items  (món nhà mình dùng)
  id, user_id, name "Bỉm Merries L", category (bỉm·khăn ướt·sữa·ăn dặm·vệ sinh·gia dụng…),
  child_id?, unit (miếng/hộp/gói/chai), pack_size?, usual_brand?, usual_merchant?,
  rate_per_day?, rate_source (default|learned|set), status (active|paused|outgrown), product_id? (catalog, tùy chọn)
purchases        + item_id (bắt buộc), product_id → tùy chọn, source (chat|ledger|photo|manual|catalog)
stock_checks     item_id, checked_on, level (nhiều|ít|hết|số cụ thể)   → hiệu chỉnh rate
shopping_plan    month, item_id?, name, qty, est_amount, due_by, reason (hết_hàng|giai_đoạn|tự_thêm|dịp_sale), status (planned|bought|skipped)
```

Suy ra bằng code (không cần bảng): nhịp mua (trung vị khoảng cách), rate học được = đơn vị mua ÷ ngày giữa các lần, giá/đơn vị theo thời gian, chi theo nhóm/bé/nơi mua, dự báo cuối tháng = đã chi + kế hoạch còn lại.

Migration: mỗi `purchases` hiện có → tạo 1 `household_items` theo `productId`; backup trước.

## 4. Agent làm gì (5 vai, tất cả hiện dưới tên FamAgent)

| Vai | Đầu vào | Làm gì | Quy tắc / LLM |
|---|---|---|---|
| **Ghi nhận** | “vừa mua 2 bịch Merries L 64 miếng 690k ở Shopee” · ảnh đơn hàng | Tách món, số lượng, đơn vị, tiền, nơi mua, ngày → thẻ xác nhận 1 chạm → purchase + khoản chi + cập nhật món | `parseVnd` + regex số lượng/đơn vị trước; LLM khi câu mơ hồ; vision cho ảnh |
| **Đối soát** | Khoản chi nhóm Con/Mua sắm chưa gắn món | Hỏi “Khoản *Shopee 690k* ngày 12/9 là mua gì?” + chip các món hay mua | Quy tắc |
| **Học** | Các lần mua, lần hỏi “còn không?” | Cập nhật rate, nhịp, giá/đơn vị; đổi nhãn “ước tính” → “theo nhà mình” | Quy tắc |
| **Lập kế hoạch** | Ngày hết dự báo, giai đoạn bé, ngân sách, ngày lương, lịch sale | Đề xuất danh sách tháng; cảnh báo vượt ngân sách; “đừng tích size L, bé sắp lên XL” | Quy tắc + `budgetHint` |
| **Giải thích** | Mọi thứ trên | Trả lời “tháng này mua đồ cho con hết bao nhiêu?”, “Merries có đắt lên không?” | SQL/quy tắc, LLM chỉ diễn đạt |

## 5. Giao diện trang Mua sắm mới (từ trên xuống)

1. **Ô ghi nhanh** luôn ở trên: “Ghi lần mua… (vd: 2 bịch Merries L 690k Shopee)” + nút ảnh đơn hàng.
2. **Tháng này**: đã mua / kế hoạch / dự kiến cuối tháng + thanh chia theo nhóm; nguồn = sổ Tiền.
3. **Sắp cần mua (30 ngày)** — dòng thời gian: mỗi món là một chấm tại ngày dự báo hết, màu theo độ gấp; mốc *ngày lương* và *ngày sale* (10.10, 11.11). Mỗi món: *Mua lại ~690k* · *Đã mua* · *Còn nhiều*.
4. **Kế hoạch tháng** — checklist do agent đề xuất (lý do ghi rõ), tổng so với ngân sách, “Dời sang tháng sau”.
5. **Đồ nhà mình dùng** — thẻ mỗi món: thanh tồn ước tính, “mua mỗi ~12 ngày”, sparkline giá/miếng, nơi hay mua, nhãn độ tin cậy.
6. **Thói quen mua** — chi 6 tháng theo nhóm (cột chồng), nơi mua (tỷ trọng), so với mức trung bình theo tuổi (“Gold dùng 5,2 miếng/ngày — khớp mức 12–24 tháng”).
7. **Sắp tới theo giai đoạn của bé** — từ tuổi/cân nặng: đổi size, ăn dặm 6 tháng, ghế ô tô… (checklist kiểu Babylist, không bán hàng).
8. **Catalog** không còn là tab: chỉ mở từ thẻ món (“Tìm lựa chọn rẻ hơn cho món này” → lọc sẵn theo size/cân nặng/giá/miếng đang trả) và trong câu trả lời của agent.

**Khởi đầu lạnh (rủi ro lớn nhất):** lần đầu vào → “Nhà mình đang dùng gì cho bé?” — checklist gợi ý theo tuổi (bỉm, khăn ướt, sữa/ăn dặm) chọn trong 3 chạm + hãng/size → dòng thời gian hiện ngay với nhãn “ước tính”, rồi mời “Ghi lần mua gần nhất”.

**Home** thay thẻ “Mua sắm” hiện tại bằng 2 món sắp hết + 1 câu hỏi đối soát/“còn không?”.

## 6. Phương án

| | A. Vẽ dashboard trên dữ liệu hiện có | **B. Lấy món đồ làm trung tâm (đề xuất)** | C. Suy từ sổ Tiền |
|---|---|---|---|
| Làm gì | Giữ `purchases` gắn catalog, thêm biểu đồ | Bảng `household_items`, purchase không cần catalog, chat/ảnh ghi | Phân tích khoản chi nhóm Con/Mua sắm |
| Giả định | Người dùng sẽ mua qua catalog | Người dùng chịu ghi 1 câu/lần mua | Sổ đủ chi tiết |
| Hỏng trước khi | Món ngoài catalog → dashboard trống | Người dùng không ghi → ít dữ liệu (giảm bằng đối soát sổ + hỏi 1 chạm + ảnh) | Không có số lượng → không dự báo hết, không kế hoạch |
| Chi phí bỏ | Thấp nhưng vô dụng | Trung bình, tái dùng phần lớn code | Thấp |

B là phương án duy nhất đạt acceptance (1) và (3). C được giữ như *một nguồn* bên trong B (vai Đối soát).

## 7. Lộ trình

| Đợt | Nội dung | Đo nghiệm thu |
|---|---|---|
| **S1 · Nền dữ liệu + ghi nhận** | Migration `household_items`, `purchases.item_id`, `product_id` tùy chọn (backup trước); intent chat “ghi lần mua” + thẻ xác nhận; trang mới: Ô ghi nhanh · Tháng này · Sắp cần mua · Đồ nhà mình dùng; khởi đầu lạnh theo tuổi; catalog rời khỏi tab | Ghi được món ngoài catalog bằng 1 câu; trang không còn lưới sản phẩm; test pipeline + E2E |
| **S2 · Học + kế hoạch** | Rate học từ lịch sử; `stock_checks` hỏi “còn không?” ở Home; đối soát khoản chi chưa gắn món; `shopping_plan` + đề xuất tháng + `budgetHint`; Home dùng dữ liệu mới | Sai số ngày hết ≤ ±3 ngày sau 2 lần mua; ≥ 80% chi nhóm Con/Mua sắm gắn món |
| **S3 · Trực quan hóa thói quen + giai đoạn** | Biểu đồ chi 6 tháng, giá/đơn vị, nơi mua, so trung bình theo tuổi; “Sắp tới theo giai đoạn”; lịch sale VN + ngày lương trên dòng thời gian | Tỷ lệ mở trang Mua sắm/tuần; số lần “Mua lại” từ dòng thời gian |
| **S4 · Ảnh đơn hàng + chia sẻ** | Vision OCR ảnh đơn Shopee/Lazada (xác nhận trước khi lưu, có đồng ý AI); kế hoạch dùng chung vợ/chồng khi có hộ gia đình; push “sắp hết” | % lần mua ghi bằng ảnh; độ chính xác tách dòng |

## 8. Câu hỏi mở

1. Phạm vi món: chỉ đồ cho con (bỉm, khăn, sữa, ăn dặm) hay mọi đồ tiêu hao gia đình (nước giặt, giấy, gạo)? Đề xuất: bắt đầu đồ con + 3–4 đồ gia đình hay mua.
2. Catalog + affiliate còn là nguồn doanh thu không? Nếu còn, giữ ở vai “Tìm lựa chọn rẻ hơn cho món này”; nếu không, có thể đóng băng hẳn.
3. Ảnh đơn hàng gửi lên LLM vision — có chấp nhận ở alpha với lựa chọn đồng ý riêng không?
4. Nhắc “ngày sale” có thể khuyến khích chi thêm — chỉ hiện khi món sắp hết *và* còn ngân sách?
5. Ngưỡng cân nặng đổi size theo từng hãng chưa có nguồn xác thực — dùng khoảng cân trên bao bì từ catalog/người dùng nhập.
