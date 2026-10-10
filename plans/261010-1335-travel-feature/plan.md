# FamAgent — Tính năng "Du lịch" (Travel): danh sách tính năng & kế hoạch phát triển

Ngày: 10/10/2026 · Nhánh: `main` · Trạng thái: **Đợt 0–4 ĐÃ XONG, deploy 10/10/2026** (mockup duyệt → code → 405 test xanh → migration 0028 áp staging → commit 51cc44d + 70729c0 push main). **Đợt 5 cũng đã xong** (10/10): gắn quỹ `money_goals` ở Tổng quan, AI gợi ý thêm đồ (`/api/travel/suggest`, consent + quota chat, chỉ gửi tuổi bé không gửi tên; nút tự ẩn khi server chưa bật AI), tổng kết sau chuyến (recap thay khối sẵn sàng khi đã về) + "chép checklist từ chuyến trước" thay cho lưu mẫu riêng (DRY: chuyến cũ chính là mẫu). Còn lại: Đợt 6 tuỳ chọn (mẫu Tết/nhân bản chuyến, quick-add chat gắn trip, xuất lịch trình).

Nguồn: khảo sát toàn bộ convention codebase (shopping/money/family, migrations, push/cron), roadmap tối ưu [260929-0926](../260929-0926-app-optimization-roadmap/plan.md), nghiên cứu usecase gia đình VN ([researcher-260929-0926](../reports/researcher-260929-0926-family-os-usecases.md)), và khảo sát app trip-planning 2026 (Wanderlog, TripIt, Stippl) + kinh nghiệm du lịch gia đình có con nhỏ (nguồn ở §9).

---

## 1. Hợp đồng brainstorm (contract)

**Outcome:** Người dùng tạo chuyến du lịch gia đình (tên, điểm đến, ngày đi–về, thành viên, ngân sách) trong ~1 phút, sau đó vào **không gian chuyến đi** `/travel/[id]` gồm: lịch trình theo ngày, danh sách đồ chuẩn bị (tự gợi ý theo hồ sơ gia đình), chi phí (ngân sách vs thực chi, ghi thẳng vào sổ thu chi), và nhắc nhở chuẩn bị trước ngày đi.

**Constraints (từ codebase + quy trình):**
- Scope theo `user_id` như mọi bảng khác (app chưa có multi-account family). Bảng mới prefix `travel_`, RLS "Own X", revoke anon, grant `famagent_app` cho cron.
- Chi phí chuyến đi **không tạo sổ thứ hai**: mỗi khoản chi là 1 dòng trong `money_transactions` (nguồn sự thật duy nhất — bài học G2), liên kết idempotent qua `transaction_id` như pattern `recordPurchase` của Shopping.
- Mọi tự động hoá (gợi ý đồ, gợi ý lịch trình) phải **đề xuất → người dùng xác nhận** (bài học G3).
- Trang không xếp chồng khối (bài học G5): workspace dùng tab, mỗi tab một việc chính.
- Quy trình: **mock UI bằng HTML, duyệt xong mới code** (yêu cầu owner). Migration add-only, backup trước khi áp. pnpm qua `npx`, không có build script.

**Non-goals (không làm):**
- Không tích hợp đặt vé/khách sạn, không search giá, không bản đồ tương tác (Google Maps API) — chỉ link ra ngoài.
- Không chia sẻ chuyến đi cho tài khoản khác (app 1 tài khoản/gia đình).
- Không import email booking (chưa có hạ tầng email-in).
- Không tách "ai trả" / chia tiền nhóm bạn (đây là app gia đình, không phải Splitwise).

**Acceptance criteria:**
1. Tạo chuyến đi với 5 trường (tên, điểm đến, ngày đi, ngày về, ngân sách dự kiến) → vào workspace ngay; thành viên mặc định là cả nhà.
2. Tab Lịch trình: mỗi ngày trong khoảng đi–về là 1 cột/khối; thêm hoạt động (giờ, tên, ghi chú, chi phí dự kiến) ≤ 3 thao tác; kéo được hoạt động giữa các ngày (hoặc đổi ngày bằng dropdown ở mobile).
3. Tab Đồ chuẩn bị: nút "Gợi ý theo nhà mình" sinh checklist từ tuổi/số bé + số ngày + loại điểm đến, hiện bảng xác nhận trước khi thêm; tick "đã xếp" cập nhật tiến độ.
4. Tab Chi phí: ghi 1 khoản chi trong chuyến → xuất hiện đồng thời ở workspace và sổ Money (category "Du lịch"), không bao giờ ghi đôi (unique index); thanh ngân sách vs thực chi theo 5 nhóm.
5. Thẻ "Chuyến đi sắp tới" trên Home với đếm ngược + 1 hành động (vd "12 món chưa xếp → mở checklist").
6. Push nhắc T-7 (bắt đầu chuẩn bị đồ), T-2 (đồ chưa xếp + giấy tờ), qua cron hiện có; mỗi loại nhắc ghi `travel_push_log` chống gửi trùng.
7. `tsc`/lint sạch, test pure-logic cho template đồ + tính ngân sách, không hồi quy 317 test hiện có.

---

## 2. Nghiên cứu: rút ra gì cho thiết kế

**Từ app quốc tế (Wanderlog/TripIt/Stippl):** thị trường 2026 vẫn "chọn 1 trong 3": lịch trình đẹp (Wanderlog — không có budget/packing), gom booking (TripIt), hoặc all-in-one (Stippl). Điểm mạnh của FamAgent là **đã có sẵn sổ thu chi + hồ sơ con cái** — thứ không app du lịch nào có. Vậy lợi thế cạnh tranh của module này không phải lịch trình đẹp, mà là: *chi phí nối thẳng vào tài chính gia đình* và *checklist đồ sinh tự động từ hồ sơ các bé*.

**Từ kinh nghiệm gia đình VN có con nhỏ (MoMo blog, mytour, VnExpress, mia.vn):**
- Checklist đồ cho bé là nỗi đau số 1: quần áo ≥1 bộ/ngày, bỉm + khăn ướt dự trữ, thuốc (hạ sốt, tiêu chảy, chống muỗi, băng gạc), đồ ngủ quen thuộc, túi nhỏ lấy nhanh khi di chuyển. → template theo **tuổi bé** (app đã có ngày sinh từng bé trong bảng `children`).
- Giấy tờ: hộ chiếu (nước ngoài), giấy khai sinh để chứng minh quan hệ (trong nước). → mục "Giấy tờ" là 1 category trong checklist, không cần bảng riêng.
- Ngân sách khung tham khảo: đi lại ~35%, lưu trú ~25%, ăn uống ~25%, còn lại hoạt động + vặt; dự phòng 10–15%. → gợi ý chia ngân sách tự động theo khung này, người dùng sửa được.
- Lời khuyên "đừng mang quá nhiều, mua tại nơi đến" → checklist có trạng thái "mua tại chỗ" ngoài "đã xếp".

**Từ chính app:** category chi "Du lịch" + category tiết kiệm "Tiết kiệm du lịch" + goal "travel" trong onboarding đã tồn tại (`lib/money/types.ts`, `lib/onboarding/questions.ts:273`) — module Du lịch là mảnh ghép hoàn thiện vòng: *tiết kiệm trước chuyến đi (goal) → chi trong chuyến (ledger) → tổng kết sau chuyến*.

---

## 3. Quyết định thiết kế (các lựa chọn đã cân)

### 3.1 Vị trí trong điều hướng
| Phương án | Ưu | Nhược |
|---|---|---|
| A. Tab thứ 6 | Dễ thấy | Chật bottom bar mobile (5 tab đã kín); du lịch là tính năng **theo mùa** (vài lần/năm), không đáng chỗ cố định |
| B. Nằm dưới tab Gia đình | Không tốn chỗ | Chôn 2 cấp, khó thấy khi cần |
| **C. Route `/travel` riêng + thẻ trên Home + lối vào ở Gia đình (chọn)** | Khi có chuyến sắp tới, thẻ đếm ngược trên Home nổi hơn cả tab; khi không có chuyến, không chiếm chỗ | Lần đầu phải biết lối vào ở Gia đình/Home |
- Giả định C dựa vào: Home được sửa thành "danh sách việc cần chú ý" (roadmap Đợt sau). Nếu Home chưa kịp sửa, thẻ chuyến đi vẫn chèn được vào brief hiện tại (`build-brief.ts`).

### 3.2 Chi phí: bảng riêng mirror hay cột trên ledger
| Phương án | Ưu | Nhược |
|---|---|---|
| A. Thêm cột `trip_id` vào `money_transactions` | Ít bảng nhất | Đụng bảng lõi; mọi màn Money phải lờ cột mới; xoá chuyến phải quét ledger |
| **B. Bảng `travel_expenses` + mirror vào ledger qua `transaction_id` (chọn)** | Đúng pattern `recordPurchase` đã chạy thật ở Shopping (idempotent, rollback, unique index chống đếm đôi); ledger vẫn 1 nguồn sự thật về tổng chi | Thêm 1 bảng; phải giữ 2 dòng nhất quán (pattern đã giải) |
- Cần 1 thay đổi nhỏ bảng lõi: thêm `'trip'` vào check `money_transactions.source` (add-only, an toàn).

### 3.3 Gợi ý đồ chuẩn bị: rule template hay AI
| Phương án | Ưu | Nhược |
|---|---|---|
| **A. Rule-based template theo (tuổi bé × số ngày × loại điểm đến) (chọn cho MVP)** | Chạy tức thì, miễn phí, test được, không cần consent AI | Không "hiểu" điểm đến cụ thể |
| B. LLM sinh checklist | Linh hoạt | Tốn quota, cần aiConsent, khó test; app đang có bài học tự động hoá sai (G3) |
- MVP dùng A; Phase 3 thêm B như lớp "tinh chỉnh thêm bằng AI" (đề xuất → xác nhận), tái dùng pipeline Gemini hiện có.

### 3.4 Lịch trình: cấu trúc dữ liệu
Giữ phẳng và đơn giản (KISS): 1 bảng entries, mỗi entry thuộc 1 ngày (`day_date`), có `position` để sắp xếp trong ngày + `time_label` text tự do ("08:00", "chiều"). Không làm time-grid/calendar phức tạp — gia đình cần "hôm đó làm gì theo thứ tự", không cần lịch 30 phút.

---

## 4. Danh sách tính năng (feature list)

### MVP (Phase 1–2)
1. **Danh sách chuyến đi** `/travel`: thẻ chuyến (tên, điểm đến, ngày, đếm ngược, tiến độ chuẩn bị), trạng thái `planning / ongoing / done / cancelled`; chuyến đã xong xếp xuống "Kỷ niệm".
2. **Tạo chuyến** (1 form, 5 trường): tên (tự gợi ý "Đà Nẵng hè 2027"), điểm đến, ngày đi–về, ngân sách dự kiến; loại điểm đến (biển/núi/thành phố/về quê/nước ngoài) — 1 chạm chip, dùng cho template đồ.
3. **Workspace chuyến đi** `/travel/[id]`, 4 tab: **Tổng quan · Lịch trình · Đồ đạc · Chi phí**.
4. **Tổng quan**: đếm ngược, thời tiết-note tự do, tiến độ 3 vòng (lịch trình ngày đã lên / đồ đã xếp / ngân sách đã dùng), khối "Giấy tờ cần nhớ" (từ checklist category giấy tờ), link nhanh đặt phòng/vé (text + url, không tích hợp).
5. **Lịch trình**: mỗi ngày 1 khối; entry = giờ (text) + tên + ghi chú + chi phí dự kiến + link; thêm/sửa/xoá/đổi ngày; ngày đi–về đổi thì entries ngoài khoảng được giữ và báo "chưa xếp ngày".
6. **Đồ chuẩn bị**: checklist nhóm theo category (Quần áo, Đồ bé, Thuốc & y tế, Giấy tờ, Điện tử, Khác), mỗi item: tên, số lượng, cho ai (member/bé), trạng thái `cần mang / đã xếp / mua tại chỗ`; **nút "Gợi ý theo nhà mình"** sinh từ template rule-based → bảng xác nhận (bỏ chọn từng món) → thêm hàng loạt.
7. **Chi phí**: ngân sách tổng chia 5 nhóm (Đi lại ~35% / Lưu trú ~25% / Ăn uống ~25% / Hoạt động ~10% / Dự phòng ~5–10%, sửa được); ghi khoản chi nhanh (nội dung, số tiền, nhóm, ngày) → mirror vào sổ Money category "Du lịch"; thanh ngân sách vs thực chi theo nhóm; chi phí dự kiến từ lịch trình hiện thành "sắp chi".
8. **Thẻ Home**: chuyến gần nhất sắp tới — đếm ngược + 1 hành động theo ngữ cảnh (còn N món chưa xếp / chưa có lịch trình ngày đầu / đã sẵn sàng 🎉).

### Phase 3 (Smart layer — sau khi MVP chạy thật)
9. **Nhắc qua push** (cron hiện có): T-7 "bắt đầu chuẩn bị đồ", T-2 "còn N món chưa xếp + kiểm tra giấy tờ", T+1 sau chuyến "ghi nốt chi phí & tổng kết?". Log `travel_push_log` chống trùng.
10. **Liên kết tiết kiệm**: gắn chuyến với `money_goals` ("Tiết kiệm du lịch") — tiến độ quỹ hiện ở tab Tổng quan trước ngày đi.
11. **AI tinh chỉnh checklist/lịch trình**: "Gợi ý thêm cho Đà Nẵng 4 ngày với bé 18 tháng" → đề xuất → xác nhận (pipeline Gemini + aiConsent hiện có).
12. **Tổng kết sau chuyến**: chi vs ngân sách theo nhóm, chênh lệch, lưu thành "Kỷ niệm"; 1 nút "Lưu checklist này làm mẫu cho lần sau".

### Phase 4 (tuỳ chọn, chỉ làm khi có nhu cầu thật)
13. Mẫu chuyến lặp lại ("Về quê Tết" — nối với usecase Tết trong research cũ), nhân bản chuyến cũ.
14. Quick-add chi phí bằng chat ("taxi sân bay 250k") nhận diện đang trong chuyến → gắn trip tự động (đề xuất → xác nhận).
15. Xuất lịch trình (print/share ảnh).

**Cắt bỏ có chủ đích** (giữ clean): bản đồ nhúng, đặt vé, chia tiền ai-trả, lịch grid theo giờ, import email, cộng tác đa tài khoản, thời tiết API (chỉ note tay — API thời tiết 7 ngày không phủ được chuyến đặt trước cả tháng).

---

## 5. Thiết kế dữ liệu (migration `2026xxxx_travel.sql`, add-only + backup)

```
travel_trips          id uuid pk · user_id → auth.users cascade · name ≤80 · destination ≤120
                      · dest_type check in (beach|mountain|city|hometown|abroad|other)
                      · start_date date · end_date date (check end ≥ start)
                      · status check in (planning|ongoing|done|cancelled) default planning
                      · budget_amount bigint default 0 · budget_split jsonb (5 nhóm, %)
                      · member_ids jsonb default [] (text ids như member_avatars)
                      · goal_id uuid null → money_goals · note text
                      · index (user_id, start_date desc)

travel_itinerary_entries  id · user_id · trip_id → travel_trips cascade
                      · day_date date null (null = "chưa xếp ngày") · position smallint
                      · time_label ≤20 · title ≤120 · note ≤500 · url ≤500
                      · est_amount bigint default 0
                      · index (trip_id, day_date, position)

travel_packing_items  id · user_id · trip_id cascade · name ≤80 · qty smallint 1–99
                      · category check in (clothes|kids|health|documents|electronics|food|other)
                      · member_id text null · status check in (todo|packed|buy_there) default todo
                      · source check in (manual|template|ai) default manual
                      · index (trip_id, category)

travel_expenses       id · user_id · trip_id cascade · occurred_on date · content ≤120
                      · bucket check in (transport|lodging|food|activity|misc)
                      · amount bigint · paid_from ≤40 null
                      · transaction_id uuid null → money_transactions
                      · unique index (transaction_id) where not null   -- chống đếm đôi
                      · index (trip_id, occurred_on desc)

travel_push_log       (user_id, trip_id, kind, day) pk — kind: prep7|prep2|wrapup

alter money_transactions: source check thêm 'trip'
alter family_events:      type check thêm 'travel'
```
Mỗi bảng: RLS "Own X" (auth.uid()), revoke anon, grant select `famagent_app` (khối `do $$ if exists`) cho cron nhắc.

**Ghi chi tiêu (pattern recordPurchase):** build transaction (category "Du lịch", source `trip`, content = nội dung khoản chi) → id định danh `ledgerIdForTripExpense(tripId, expenseId)` → upsert `ignoreDuplicates` → lưu `transaction_id` vào `travel_expenses` → lỗi thì rollback expense → log `family_events`.

## 6. Thiết kế module (theo convention hiện có)

```
app/(app)/travel/page.tsx            — server mỏng, render <TravelPage/>
app/(app)/travel/[tripId]/page.tsx   — server mỏng, render <TripWorkspace tripId/>
app/travel.css                       — import trong app/layout.tsx
middleware.ts                        — thêm /travel vào protectedPath

components/travel/
  travel-page.tsx        — danh sách chuyến + form tạo (client, useEffect load)
  trip-workspace.tsx     — khung tab Tổng quan/Lịch trình/Đồ đạc/Chi phí
  trip-overview.tsx · trip-itinerary.tsx · trip-packing.tsx · trip-expenses.tsx
  packing-suggest-dialog.tsx — bảng xác nhận template

lib/travel/
  types.ts               — Trip, ItineraryEntry, PackingItem, TripExpense, buckets
  packing-template.ts    — PURE: (destType, nights, members, children ages) → items  [test]
  budget.ts              — PURE: split mặc định, budget vs actual theo bucket        [test]
  trip-state.ts          — PURE: countdown, tiến độ, trạng thái dẫn xuất             [test]
  validate.ts            — validators theo pattern item-validate.ts
  store-server.ts        — row mappers + TRAVEL_RESOURCES registry + loadTravelState
  expense-store-server.ts— recordTripExpense (mirror ledger, idempotent)
  client.ts              — fetch wrapper + localStorage fallback demo mode

app/api/travel/route.ts            — GET toàn bộ state (trips hoặc 1 trip ?id=)
app/api/travel/[resource]/route.ts — PUT upsert/DELETE generic (trips, itinerary, packing, expenses)
lib/push/reminders.ts (hoặc travel-reminders.ts) — tripRemindersFor() PURE
app/api/cron/reminders/route.ts    — thêm 1 khối try/catch travel
components/home/… (brief)          — thẻ chuyến sắp tới
```

## 7. Kế hoạch phát triển theo đợt

| Đợt | Nội dung | Sản phẩm kiểm chứng | Ước lượng |
|---|---|---|---|
| **0. Mockup & duyệt** | Mock HTML 3 màn (danh sách + tạo chuyến, workspace 4 tab desktop/375px, thẻ Home) trong `plans/261010-1335-travel-feature/mockups/`; **owner duyệt rồi mới code** | File HTML mở trực tiếp, đi được luồng chính | 0.5 ngày |
| **1. Nền & CRUD chuyến** | Migration (backup trước khi áp) · types/validate · store-server + registry · API travel · trang `/travel` + form tạo · workspace shell + tab Tổng quan · middleware + CSS | Tạo/sửa/xoá chuyến trên staging; RLS kiểm bằng user thứ 2; demo mode (localStorage) chạy | 1–1.5 ngày |
| **2. Lịch trình + Đồ đạc** | Tab Lịch trình (entry CRUD, đổi ngày, position, "chưa xếp ngày") · tab Đồ đạc (CRUD, tick, buy_there, nhóm category) · `packing-template.ts` + dialog xác nhận · test pure logic | Test đơn vị template/state xanh; đi thử bằng gõ thật (quy trình test typing) | 1.5–2 ngày |
| **3. Chi phí ↔ Money** | `budget.ts` + UI ngân sách 5 nhóm · ghi chi nhanh → `recordTripExpense` mirror ledger (idempotent, rollback) · alter source check · thanh budget vs actual · est_amount lịch trình thành "sắp chi" | Ghi 1 khoản ở trip thấy ở Money, bấm 2 lần không đôi; test idempotency | 1–1.5 ngày |
| **4. Home + Nhắc** | Thẻ brief chuyến sắp tới (1 hành động) · `tripRemindersFor()` + khối cron + `travel_push_log` + grants | Cron chạy tay trên staging gửi đúng 1 push, chạy lại không gửi trùng | 0.5–1 ngày |
| **5. Smart (Phase 3)** | Gắn goal tiết kiệm · AI tinh chỉnh checklist (đề xuất→xác nhận) · tổng kết sau chuyến + lưu mẫu | Luồng AI có consent, bảng xác nhận; tổng kết đúng số với ledger | 1.5–2 ngày |
| 6. Tuỳ chọn (Phase 4) | Mẫu "Về quê Tết", nhân bản chuyến, quick-add chat gắn trip | — | theo nhu cầu |

Tổng MVP (đợt 0–4): **~5–6.5 ngày dev**. Mỗi đợt: commit khi verify xong rồi đi tiếp (không dừng hỏi giữa chừng); tsc + lint + test trước mỗi commit; migration áp qua CLI staging trước (không in secret).

**Rủi ro & giả định dễ gãy nhất:**
- *Giả định tải-bearing:* pattern mirror ledger của Shopping tái dùng được nguyên vẹn cho trip expense. Nếu `recordPurchase` có coupling riêng với shopping (reconcile), phải viết `recordTripExpense` độc lập — đã dự phòng trong thiết kế (file riêng).
- Recurring/ledger đang có lỗi đã biết ở roadmap Đợt 2 (ghi trùng, lastPostedMonth) — trip expense dùng đường upsert riêng nên không phụ thuộc, nhưng **không** dùng chung code recurring.
- Nav: nếu owner muốn tab thứ 6 thay vì thẻ Home, chỉ đổi 1 entry `SECTIONS` + icon — quyết định này hoãn được đến đợt 4 (rẻ để đổi).
- 2 migration cũ (202609290018/19) ghi chú "chưa áp dụng" trong roadmap — kiểm trạng thái DB trước khi áp migration travel.

## 8. Câu hỏi chưa chốt (cần owner trả lời trước đợt 0)
1. Vị trí điều hướng: đồng ý phương án **thẻ Home + lối vào Gia đình** (không thêm tab 6)?
2. Ngân sách chuyến có **tự trừ vào ngân sách tháng** của Money không, hay chỉ hiện trong sổ như chi thường (đề xuất: như chi thường, category "Du lịch" — tránh G2)?
3. Push nhắc T-7/T-2 mặc định bật cho mọi chuyến hay opt-in từng chuyến (đề xuất: bật, tắt được trong Tổng quan)?

## 9. Nguồn nghiên cứu ngoài
- Stippl blog so sánh app 2026 (vendor, tự xếp mình nhất): https://app.stippl.io/blog/best-travel-planning-apps-2026
- TripProf tổng hợp 20+ app ("không app nào all-in-one thật"): https://tripprof.com/nl/blog/best-trip-planning-apps-2026/
- Wanderlog alternatives cho gia đình: https://www.endlesstravelplans.com/guides/planning-tools/wanderlog-alternatives-family-trip-planning
- Kinh nghiệm đi du lịch với con nhỏ: https://momo.vn/blog/kinh-nghiem-di-du-lich-khi-co-con-nho-c101dt781 · https://mytour.vn/vi/blog/bai-viet/bi-quyet-du-lich-voi-be.html · https://vnexpress.net/luu-y-khi-cho-tre-di-du-lich-4787688.html · https://mia.vn/tin-tuc/di-du-lich-cung-be-can-chuan-bi-nhung-gi-1052 · https://vinwonders.com/vi/wonderpedia/news/chuan-bi-do-cho-be-di-du-lich/
- Khung ngân sách 3N2Đ (Khánh Hoà tourism): https://dulichso.khanhhoa.gov.vn/en/article/estimated-budget-for-a-3-day-2-night-family-trip-6ec
- Budget gia đình + dự phòng ~10%: https://www.tescotravelmoney.com/guides/budget-for-family-holiday/ · https://www.lonelyplanet.com/articles/affordable-family-holiday-tips
