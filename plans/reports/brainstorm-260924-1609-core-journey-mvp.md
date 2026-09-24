# Core journey MVP (spec "FamAgents — User Journey MVP") — đối chiếu hiện trạng, phản biện, đề xuất

Ngày 24/09/2026 · main@f3de91a · Nối tiếp [audit](brainstorm-260924-1358-product-audit-roadmap.md), [Mua sắm](brainstorm-260924-1421-shopping-plan-redesign.md)

## 0. Contract

- **Outcome:** vòng lặp *đưa dữ liệu → hiểu → cập nhật Family State → phát hiện → đề xuất → phản hồi → hiểu hơn* chạy trọn cho Tiền + Mua sắm, với một điểm nhập (Inbox) và một nơi nhận (Attention Feed + push + Brief tuần).
- **Constraints:** rules-first (LLM cho ảnh/câu mơ hồ); mọi con số có nguồn; không crawl marketplace trái điều khoản; giữ IA 5 mục; chạy được ở demo mode.
- **Non-goals:** hộ gia đình nhiều tài khoản (vợ/chồng cùng đăng nhập) — plan riêng; checkout; bank sync.
- **Acceptance:** từng use case A–C, 3–9 có kịch bản chạy được trên production (xem §3).

## 1. Hiện trạng so với spec

| # | Spec | Đã có | Thiếu / lệch |
|---|---|---|---|
| 1 | Onboarding: Family, thành viên, 3 ưu tiên, 3 phong cách → Profile + **Family Policy** + 3 gợi ý khởi đầu | Quiz ~18 câu + 2 nhánh sâu, `focus`, `pricePreference`, 12 “phương pháp” (6 tiền, 6 nuôi dạy), bắt buộc tạo tài khoản | Quá dài; chưa có khái niệm Policy; phong cách đang lẫn vào `pricePreference` + frameworks |
| 2A | “Hôm nay mua bỉm 369k” → Expense + Purchase + Consumption | Có (ô ghi nhanh + Trợ lý, thẻ xác nhận) cho **lần mua** | Chi tiêu **không phải đồ dùng** (“ăn trưa 80k”) không ghi được qua chat; Inbox chỉ ở Mua sắm/Trợ lý, chưa phải “một chỗ” |
| 2B | Ảnh hóa đơn → “Tôi hiểu đây là Merries L64 cho Gold, 369K. Đúng/Sửa” | Đọc ảnh → mỗi dòng một **form đầy đủ** | Thiếu câu tóm tắt + `Đúng`/`Sửa` (form chỉ mở khi Sửa) |
| 2C | Dán link Shopee/TikTok → sản phẩm, giá, so sánh, bối cảnh tài chính | Không có | Toàn bộ |
| 3 | Home = “đáng chú ý” + “Đang ổn” | Cần chú ý + Việc hôm nay + ô Tiền + ô Mua sắm + insight | Quá nhiều khối; thiếu “Đang ổn”; nhắc cài đặt lẫn cảnh báo thật; thiếu “Xem nguyên nhân” |
| 4 | “Tháng này tiêu thế nào?” → pace so bình thường, tăng nhiều nhất, **giải thích Baby Care tăng do lượng hay giá** | `answerMoney` (tổng, còn lại, theo nhóm, sắp đến hạn…) so với **kế hoạch** | Chưa so với tháng trước/bình thường; chưa tách lượng vs giá; chưa CTA “Lập kế hoạch phần còn lại tháng” |
| 5 | “Mua lại bỉm cho Gold” → phù hợp? lần trước, **giá tốt hiện tại**, còn N ngày, `Mua lại` / `So sánh` | Stock reply + catalog bỉm | Chưa gộp thành một thẻ; “giá hiện tại” chỉ có với catalog |
| 6 | “Muốn mua robot hút bụi 8 triệu” → ảnh hưởng tiết kiệm, 3 lựa chọn | Không (câu này rơi vào pipeline bỉm → “chưa hỗ trợ”) | Toàn bộ |
| 7 | Proactive: sắp hết (+giá), chi bất thường | Push “sắp hết” hằng ngày; cảnh báo pace tháng | Chưa có bất thường theo **nhóm/tuần**; chưa có so giá |
| 8 | Brief tuần | Không (Home chỉ có brief tức thời) | Toàn bộ |
| 9 | Feedback Hữu ích / Không đúng / Chưa cần / Đừng nhắc | Không | Toàn bộ |
| 10 | Family State + vòng lặp | State rải ở nhiều bảng; insight sinh riêng ở Home, push, chat | Chưa có **một bộ máy insight** dùng chung cho mọi bề mặt |

## 2. Phản biện (chỗ tôi không đồng ý hoặc cần sửa spec)

1. **Dán link Shopee/TikTok để “lấy giá”** — không làm được đúng nghĩa: Shopee/TikTok chặn bot, trang render bằng JS, điều khoản cấm scrape; API chính thức (Shopee Affiliate Open API) cần duyệt tài khoản affiliate. *Đề xuất:* đọc tên/giá từ link khi trang cho phép (OG tags), không được thì hỏi 1 câu “giá bao nhiêu?”; giá trị thật nằm ở phần **so với lịch sử nhà mình + tồn kho + ngân sách** (“đang còn ~10 ngày”, “giá/miếng rẻ hơn lần trước 6%”) — phần này làm được ngay.
2. **“Giá tốt hiện tại 349K”, “thấp hơn lần trước 20K”** — cần nguồn giá thật; hiện chỉ có catalog thử nghiệm. *Đề xuất:* hiện “giá thấp nhất nhà mình từng trả” + giá catalog nếu món có liên kết; không bịa giá thị trường. Nguồn giá thật là dự án dữ liệu riêng (affiliate feed).
3. **“Model này phù hợp nhu cầu nhà mình” (robot hút bụi)** — không có dữ liệu sản phẩm ngoài bỉm → không được khẳng định. *Đề xuất:* chỉ đánh giá **phù hợp tài chính** (ngân sách tháng, mục tiêu tiết kiệm, quỹ dự phòng) + 3 lựa chọn; phần “phù hợp nhu cầu” để khi có catalog danh mục đó.
4. **“Tạo Family + thêm thành viên”** — nếu người dùng hiểu là mời vợ/chồng cùng dùng thì hiện chưa có (mọi dữ liệu theo 1 tài khoản). *Đề xuất:* ở MVP gọi là “Thành viên trong nhà” (người lớn + con, để cá nhân hóa), ghi rõ “mời vợ/chồng dùng chung: sắp có”.
5. **Phong cách Tiết kiệm/Cân bằng/Tiện lợi** — tốt hơn 12 phương pháp hiện tại. *Đề xuất:* phong cách → **Family Policy** (quy tắc máy đọc được: ưu tiên giá/miếng hay mua dồn hay tiện giao nhanh; ngưỡng nhắc; mức cảnh báo chi) và **ẩn 12 phương pháp khỏi luồng chính** (để trong Tiền → Nâng cao). Đây là đảo lại quyết định 211542f — cần anh/chị xác nhận.
6. **Feedback 4 nút trên mọi thẻ** — quá nặng cho Home 3–5 thẻ. *Đề xuất:* mỗi thẻ 1 CTA chính + nút `⋯` mở 4 lựa chọn; “Không đúng” trên thẻ tồn kho mở luôn “Còn không?” để sửa dữ liệu (phản hồi phải *làm thay đổi* state, không chỉ ghi log).
7. **Brief tuần “gửi”** — trước đây chốt chỉ trong app. Nay đã có push → *đề xuất:* push tối Chủ nhật 1 dòng + trang brief trong app; email để sau.
8. **Onboarding bỏ câu hỏi tài chính** — đồng ý rút gọn, nhưng “Chi tiêu cao hơn kế hoạch 8%” cần kế hoạch → thẻ khởi đầu “Thêm tình hình tài chính” (thu nhập/chi tiêu khoảng) phải là thẻ đầu tiên nếu ưu tiên = Quản lý tiền.

## 3. Thiết kế đề xuất

**Một bộ máy insight** `lib/attention/` sinh `Insight { id, kind, subjectId, tone, title, detail, source, cta, feedback }` từ Family State (profile + policy + ledger + items/purchases/checks + goals). Dùng chung cho: Home feed, push (hằng ngày + tuần), Brief tuần, câu trả lời chat. Feedback lưu `insight_feedback(kind, subject_id, verdict, until)` và **lọc** insight (snooze/mute) + **sửa** state (stock check).

**Inbox** = một ô nhập ở mọi trang (thanh dưới cùng trên điện thoại / đầu trang desktop): câu → phân loại *lần mua đồ dùng* | *chi tiêu thường* | *thu* | *câu hỏi* | *link* | *ảnh*; mọi nháp hiện dạng tóm tắt 1 câu + `Đúng` / `Sửa`.

| Đợt | Nội dung | Nghiệm thu |
|---|---|---|
| **J1 · Onboarding mới + Policy** | 4 bước (Nhà mình · Thành viên · Ưu tiên · Phong cách) ≤ 60 giây; `family_policy` từ phong cách; 3 thẻ khởi đầu theo ưu tiên; quiz cũ + frameworks ra khỏi luồng chính | Hoàn tất ≤ 6 màn; Home mở ra đúng 3 thẻ khởi đầu |
| **J2 · Inbox chung** | Ô nhập toàn cục; phân loại chi tiêu thường vs lần mua; nháp tóm tắt `Đúng/Sửa` (câu, ảnh); link → tên/giá (khi đọc được) + so lịch sử/tồn/ngân sách | A, B, C theo spec (C với giới hạn ở §2.1) |
| **J3 · Attention engine + Home** | `lib/attention`; Home = Cần chú ý (≤3) + Đang ổn; “Xem nguyên nhân”; feedback `⋯` | Home không còn ô KPI; mỗi thẻ có nguồn + feedback |
| **J4 · Trả lời Tiền & Mua sắm** | Pace so tháng trước/bình thường, tăng nhiều nhất, tách **lượng vs giá** từ purchases; “Lập kế hoạch phần còn lại tháng”; thẻ Mua lại gộp (phù hợp size, lần trước, giá thấp nhất từng trả/catalog, còn N ngày) | Use case 4, 5 |
| **J5 · Quyết định mua lớn** | “muốn mua X 8 triệu” → ảnh hưởng ngân sách/mục tiêu, 3 lựa chọn (Mua ngay / Xem dưới ~60% / Để tháng sau → kế hoạch tháng sau) | Use case 6 |
| **J6 · Proactive + Brief tuần** | Bất thường theo nhóm/tuần (vs trung bình 4 tuần); push dùng attention engine + feedback; Brief tuần (trang + push Chủ nhật 19:00) | Use case 7, 8 |

## 4. Câu hỏi mở

1. Đồng ý thay 12 phương pháp bằng Phong cách + Policy (ẩn frameworks, không xóa dữ liệu)?
2. Onboarding mới: vẫn **bắt buộc tạo tài khoản** trước khi vào Home, hay cho dùng thử rồi mới lưu?
3. Link sản phẩm: chấp nhận mức “đọc được thì đọc, không thì hỏi giá” (không scrape)?
4. Brief tuần: push Chủ nhật tối + trang trong app là đủ cho MVP?
