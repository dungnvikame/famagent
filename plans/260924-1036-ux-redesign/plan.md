# FamAgents Alpha — thiết kế lại luồng, điều hướng và bộ nhớ theo Spec v2

Ngày: 24/09/2026 · Nguồn: [docs/SPEC_V2_FAMILY_OS.md](../../docs/SPEC_V2_FAMILY_OS.md) (định hướng), [SPEC_V1](../../docs/SPEC_V1_PURCHASING_AGENT.md) (kỹ thuật Shopping) · Trạng thái: **Đợt 1–4 đã lên main** (`8a7d83a` khung & Home · `54dd44a` + `e0b1823` Tiền & Coordinator · `545b8eb` liên module · Đợt 4 bộ nhớ & chống lặp); migration 0007–0009 đã áp dụng lên Supabase. Còn Đợt 5 (rà soát).

## 1. Audit trải nghiệm hiện tại (24/09)

| Người dùng thấy | Nguyên nhân gốc |
|---|---|
| Menu “Khám phá / Đã lưu / Gia đình / Tài khoản / Tư vấn ngay” không rõ ý | Một header cho cả trang giới thiệu và app; tên theo tính năng kỹ thuật; sản phẩm vẫn là “shopping app có chat”, chưa phải Family OS |
| Không có nút đăng nhập, không có trang cá nhân | Link chỉ hiện sau khi JS kiểm tra phiên; chưa có mục tài khoản cố định |
| Không thấy lịch sử hội thoại | Có dữ liệu nhưng ẩn sau nút “Lịch sử ↗” |
| Agent lặp câu trả lời | Không nhớ câu hỏi làm rõ đang chờ; nút trả lời nhanh không hiển thị (đã sửa một phần, commit 78be2a1) |
| Bộ nhớ gia đình nghèo | Chỉ trường cấu trúc; không có ghi chú rút từ hội thoại; không có trạng thái tài chính / mua sắm / tiêu hao |
| Mở app là vào chat | Spec v2 §16: Home phải là “what needs attention”, không phải chatbot |

## 2. Kiến trúc thông tin mới (theo Spec v2 §34–35)

### Chưa đăng nhập
Landing (định vị mới: *Gia đình vận hành nhẹ nhàng hơn*) · header chỉ **Đăng nhập** và **Bắt đầu miễn phí** → onboarding trắc nghiệm (giữ, mở rộng thêm 2 câu tài chính: thu nhập/tháng theo khoảng, ngân sách chi tiêu/tháng) → tạo tài khoản (Google) → **Home**.

### Đã đăng nhập — 5 mục (sidebar desktop / thanh dưới điện thoại)

| Mục | Đường dẫn | Trả lời câu hỏi | Nội dung MVP |
|---|---|---|---|
| **Trang chủ** | `/home` | Gia đình tôi hiện có gì đáng chú ý? | *Family Brief*: lời chào theo giờ; **Cần chú ý** (thẻ hành động: bỉm còn ~N ngày → Mua lại; chi tiêu lệch plan → Xem; hóa đơn đến hạn → Đánh dấu đã trả); **Tiền tháng này** (đã chi / kế hoạch, dự kiến cuối tháng); **Mua sắm** (đồ đang theo dõi tiêu hao, đã mua gần đây); **Sắp tới** (khoản định kỳ); **FamAgents nhận thấy** (1–3 insight có nguồn). Mỗi thẻ có đúng một CTA. |
| **Tiền** | `/money` | Nhà tôi có bao nhiêu, tiền đi đâu, có vấn đề gì, nên làm gì? | Tháng hiện tại (Thu · Đã chi · Còn lại · Dự kiến cuối tháng); chi theo nhóm với lệch so với ngân sách; giao dịch (thêm tay nhanh, nhập CSV); khoản định kỳ; ngân sách theo nhóm; mục tiêu tiết kiệm (dự báo tháng đạt); tài sản & nợ (net worth). Insight bằng SQL/quy tắc trước, AI khi hỏi. CTA “Hỏi FamAgents về tiền”. |
| **Mua sắm** | `/shopping` | Cần mua gì, mua gì cho đúng, còn bao nhiêu? | **Đang theo dõi** (đồ tiêu hao: bỉm — còn ~N ngày, Mua lại); **Đã mua** (lịch sử, đánh dấu đã mua → tự tạo giao dịch Tiền + tồn kho); **Tìm & so sánh** (catalog, bộ lọc theo hồ sơ, đã lưu); gợi ý có ngữ cảnh tài chính (“khoản này làm chi tiêu tuỳ ý vượt ngân sách ~X”). |
| **Trợ lý** | `/agent`, `/agent/[id]` | Hỏi gì cũng được, không cần chọn agent | Một cửa (Family Coordinator): route Tiền / Mua sắm; danh sách hội thoại bên trái; lời chào theo hồ sơ; nút trả lời nhanh; nhớ câu hỏi đang chờ; kết quả dạng thẻ (sản phẩm, số liệu tiền). |
| **Gia đình** | `/family` | FamAgents biết gì về nhà tôi, ai thấy gì? | Thành viên (thẻ từng bé đầy đủ trường + người lớn); Nhà & thiết bị; Ưu tiên; **Điều FamAgents đã ghi nhớ** (ghi chú tự rút từ hội thoại, nhãn “Ghi nhận”/“Bạn xác nhận”, nguồn, xóa từng dòng); **Tài khoản & quyền riêng tư** (đăng nhập bằng gì, tên/ảnh Google, quyền AI, tải/xóa dữ liệu, đăng xuất). |

Chuyển hướng: `/shop` → `/agent`, `/products` → `/shopping`, `/saved` → `/shopping?tab=saved`. Sidebar hiển thị tên + ảnh Google; bấm vào → phần Tài khoản trong Gia đình.

## 3. Mô hình dữ liệu mới (Family Graph MVP)

- `money_transactions` (household, member?, amount VND, type income/expense, category, merchant?, occurred_at, source: manual/csv/purchase, purchase_id?, note) · `money_categories` (mặc định VN: Ăn uống, Đi lại, Nhà ở & hóa đơn, Em bé, Sức khỏe, Mua sắm gia đình, Giáo dục, Giải trí, Tiết kiệm & đầu tư, Khác) · `money_budgets` (category, month, limit) · `money_recurring` (name, amount, cadence, next_due, category, kind income/expense) · `money_goals` (name, target, saved, monthly_plan) · `money_accounts` (asset/debt, name, balance) — tất cả RLS theo household (user).
- `purchases` (product/variant/offer?, quantity, unit_count, amount, merchant, purchased_at, member) + `consumption_estimates` (purchase → daily_rate mặc định theo tuổi bé, est_depleted_at, confidence) — nền cho “còn ~N ngày”.
- `family_notes` (text ≤160, kind health/habit/preference/other, source conversation+date, status recorded/confirmed) — ghi chú rút từ hội thoại, lưu tự động (đã chốt).
- `family_events` (event stream: PURCHASE_COMPLETED, TRANSACTION_ADDED, NOTE_RECORDED…; payload jsonb) — một sự kiện, nhiều module cập nhật (Spec §30). MVP: xử lý trong cùng request; bảng làm nhật ký/replay.
- Hồ sơ hiện có (`family_profiles`, `children`) giữ nguyên; thêm `monthly_income_band`, `monthly_budget`.

## 4. Coordinator & chống lặp
- `pendingQuestion` lưu trong intent lượt trước (nới giá / chọn bé / xác nhận hãng). Câu ngắn khẳng định (“ok”, “được”, “nới đi”) → thực hiện; phủ định → giữ điều kiện, đưa lựa chọn khác; không lặp cùng câu hai lần liên tiếp.
- Route: câu hỏi về tiền (“tháng này tiêu bao nhiêu”, “còn bao nhiêu ngân sách ăn uống”) → Finance (SQL + template, AI diễn đạt); mua sắm → pipeline hiện có; mua có số tiền lớn → Finance bổ ngữ cảnh ngân sách.
- Economics: quy tắc/SQL trước, LLM chỉ khi cần (Spec §43).

## 5. Đợt thực hiện

| Đợt | Nội dung | Kết quả nhìn thấy |
|---|---|---|
| **1 · Khung & Home** | App shell 5 mục (sidebar/bottom nav, tên + ảnh Google); Home Family Brief từ dữ liệu hiện có (hồ sơ, hội thoại, đồ đã lưu) với “Cần chú ý” và insight; Trợ lý có danh sách hội thoại; Gia đình gộp Tài khoản; chuyển hướng URL cũ; landing đổi định vị | Mở app thấy Home, điều hướng rõ, có lịch sử, có tài khoản |
| **2 · Tiền (Finance MVP)** | Migration bảng money_*; nhập giao dịch tay + CSV; ngân sách theo nhóm; định kỳ; mục tiêu; tháng hiện tại + lệch plan; insight quy tắc; Coordinator route câu hỏi tiền | Mục Tiền hoạt động, Home có số thật |
| **3 · Liên module** | “Đã mua” → purchase + giao dịch + tồn kho; “còn ~N ngày” + Mua lại trên Home/Mua sắm; gợi ý mua có ngữ cảnh ngân sách; Family Brief hằng tuần (email/in-app) | Magic moment: app nhắc trước khi mình nhớ |
| **4 · Bộ nhớ & chống lặp** | `family_notes` tự rút sau lượt chat (AI + fact-guard), hiện ở Gia đình; pendingQuestion; hiển thị đủ trường hồ sơ | Agent nhớ và không lặp |
| **5 · Rà soát** | Checklist UI/UX (44px, tương phản, focus, 375px, reduced-motion), copy CTA, eval mở rộng cho Tiền, cổng phát hành | Sẵn sàng thử với 5–8 gia đình |

Mockup: `mockups/famagents-shell.html` (5 mục, Home brief, Tiền, Mua sắm, Trợ lý, Gia đình; desktop + điện thoại).

## 6. Quyết định (24/09, chủ sản phẩm)
1. Tên hiển thị giữ **FamAgent** (spec viết FamAgents chỉ là tên tài liệu).
2. Tiền: **nhập tay theo dạng sổ Excel linh hoạt** (không CSV ở alpha). Tham chiếu file chủ sản phẩm đang dùng:
   - Sổ giao dịch, một dòng/khoản: Ngày · Nội dung · Nhóm · **Chi** (Payment) · **Thu** (Deposit) · **Chuyển tiết kiệm** (Saving; âm = rút) · **Tiêu cho con** · Ghi chú; hai số dư chạy dồn: **Tiền mặt** (Balance) và **Tài khoản tiết kiệm**.
   - Bảng tháng: Thu nhập (Open Cash chuyển kỳ, Lương, Đầu tư, Thưởng, Dự án ngoài, Vay cá nhân, Vay ngân hàng, Tiền trả nợ nhận về, Gia đình hỗ trợ, Others) và Chi tiêu (Tiêu dùng, Ăn uống, Mua sắm, Giải trí, Học tập, Hiếu hỉ, Khám thuốc, Chi phí đầu tư, Gia đình, Con, Du lịch, Tiền điện, Tiền nước, Trả góp, Thẻ tín dụng, Trả nợ cá nhân, Trả nợ quỹ, Cho vay, Others) → dùng làm **bộ nhóm mặc định**, cho phép thêm/sửa/ẩn nhóm.
   - Hệ quả mô hình: `money_transactions.kind ∈ {expense, income, saving_transfer}` + cờ `for_child` (member_id); `money_accounts` tối thiểu 2 tài khoản mặc định (Tiền mặt, Tiết kiệm); trang Tiền có chế độ **Sổ** (bảng nhập nhanh, thêm dòng như Excel, sửa tại chỗ) và **Tháng** (bảng nhóm × tháng).
3. Family Brief hằng tuần: **chỉ hiện trong app**, chưa gửi email.
