# Family AI — Spec kỹ thuật cho AI Household Purchasing Agent

**Phiên bản:** 1.0 · **Nhận:** 23/09/2026 · **Trạng thái:** spec định hướng, giữ nguyên làm bản gốc tham chiếu (cùng vai trò với [SOURCE_SPEC.md](SOURCE_SPEC.md)). Quyết định áp dụng ghi ở [PRODUCT.md](PRODUCT.md) và plan hiện hành.
**Thị trường đầu tiên:** Việt Nam · **Nền tảng đầu tiên:** Website responsive · **Đối tượng đầu tiên:** Gia đình có con nhỏ, mua đồ tiêu hao thường xuyên

## 1. Mục tiêu

Family AI giúp người dùng **tìm đúng sản phẩm, chọn nơi mua phù hợp và biết khi nào cần mua lại** dựa trên thông tin gia đình, lịch sử mua, mức sử dụng và các ưu đãi hiện có.

Lợi thế của sản phẩm nằm ở quy trình và dữ liệu riêng của gia đình:

```text
Nhu cầu
→ Thông tin gia đình
→ Sản phẩm phù hợp
→ Giá và nơi bán
→ Đề xuất có lý do
→ Người dùng chọn mua
→ Ghi nhận kết quả
→ Ước tính lần mua tiếp theo
```

Agent phải trả lời tốt các yêu cầu như:

> “Mua bỉm cho Gold.”

> “Loại nước giặt nhà mình dùng sắp hết chưa?”

> “Tháng này cần mua lại những gì? Tổng chi phí khoảng bao nhiêu?”

**Nguyên tắc cốt lõi:** LLM hiểu lời nói và diễn đạt kết quả. Mã nguồn kiểm tra điều kiện, tính toán và xếp hạng. Người dùng quyết định giao dịch.

### Kết quả cần đạt

- Người dùng nhận được 3 lựa chọn phù hợp cùng lý do và điểm khác biệt.
- Giá, quy cách, nơi bán và thời điểm cập nhật được hiển thị rõ.
- Hệ thống nhớ thông tin gia đình và lần mua trước khi người dùng cho phép.
- Hệ thống ước tính ngày cần mua lại, kèm độ tin cậy và cách tính.
- Có thể lập giỏ dự kiến theo tháng mà không tự đặt hàng.

## 2. Phạm vi và phần chưa làm

### Giai đoạn 1 — MVP hiện tại

Theo spec MVP trước đó, triển khai trên catalog nội bộ cho 8 nhóm: bỉm, khăn ướt, nước giặt cho bé, nước rửa bình, nước giặt gia đình, nước rửa bát, giấy và túi rác. Luồng chính là hỏi nhu cầu → lọc → so sánh → đề xuất → chuyển sang nơi bán qua liên kết đối tác.

### Giai đoạn 2 — Mua lại

Thêm lịch sử mua do người dùng nhập hoặc dữ liệu giao dịch mà Family AI thực sự sở hữu; theo dõi tồn kho ước tính, nhắc mua lại và tạo giỏ hàng tháng.

### Giai đoạn 3 — Giao dịch trực tiếp

Chỉ triển khai checkout, đặt hàng qua nhà cung cấp và theo dõi đơn khi đã có nguồn hàng, hợp đồng và dữ liệu tồn kho đáng tin cậy.

### Chưa làm

- Tự quyết định hoặc tự thanh toán thay người dùng.
- Tự động đặt hàng trên tài khoản sàn của người dùng.
- Thu thập giá, đơn hàng hoặc đánh giá từ nguồn không có quyền sử dụng.
- Tư vấn thuốc, điều trị, sữa công thức hoặc sản phẩm có tuyên bố y tế.
- Dùng hoa hồng làm tín hiệu xếp hạng.
- Đưa ra cam kết “giá thấp nhất thị trường” khi không quan sát toàn thị trường.

## 3. Trách nhiệm của Agent

Agent có 8 trách nhiệm:

1. **Hiểu nhu cầu:** Xác định người dùng muốn tìm mới, so sánh, mua lại, kiểm tra giá, lập giỏ tháng hay cập nhật thông tin gia đình.
2. **Lấy đúng ngữ cảnh:** Đọc thông tin gia đình và lịch sử liên quan đến yêu cầu hiện tại.
3. **Hỏi phần còn thiếu:** Chỉ hỏi dữ liệu cần thiết để tránh đề xuất sai.
4. **Tìm và chuẩn hóa:** Lấy sản phẩm, biến thể và offer từ các nguồn đã được tích hợp.
5. **Đề xuất:** Áp dụng bộ lọc cứng, tính điểm bằng mã nguồn và giải thích kết quả.
6. **Hỗ trợ mua:** Hiển thị nơi bán, tổng chi phí ước tính và chuyển người dùng sang đúng offer.
7. **Theo dõi mua lại:** Ước tính lượng còn lại, ngày hết hàng và thời điểm nên nhắc.
8. **Học từ phản hồi:** Cập nhật sở thích khi người dùng xác nhận; không suy diễn một cú click thành sở thích lâu dài.

Agent không được tự sửa dữ liệu gia đình quan trọng từ một câu nói mơ hồ. Ví dụ, “Gold chắc nặng khoảng 10 kg” là một quan sát có độ chắc chắn thấp; chỉ trở thành cân nặng hồ sơ sau khi người dùng xác nhận hoặc nhập trực tiếp.

## 4. Kiến trúc

```text
Web UI
  │
  ├─ Chat / Compare / Family / Basket
  │
Agent API
  │
  ├─ Xác thực và quyền truy cập
  ├─ Intent parser (LLM, structured output)
  ├─ Context resolver
  ├─ Orchestrator
  │    ├─ Catalog search
  │    ├─ Product matcher
  │    ├─ Offer resolver
  │    ├─ Purchase history
  │    ├─ Consumption engine
  │    ├─ Ranking engine
  │    └─ Basket planner
  ├─ Response composer (LLM có kiểm chứng)
  └─ Event/trace writer
       │
PostgreSQL: family, catalog, offers, purchases, sessions, events
       │
Nguồn dữ liệu được phép: CSV quản trị, feed/API đối tác, dữ liệu người dùng nhập
```

**Triển khai ban đầu:** Một backend ứng dụng và một database là đủ. Tách các module bằng interface để thay nguồn offer, LLM hoặc công thức ranking mà không phải viết lại luồng chính. Không cần nhiều “agent” tự trò chuyện với nhau.

## 5. Ranh giới giữa LLM và mã nguồn

| Việc | LLM | Mã nguồn |
|---|---|---|
| Hiểu câu tiếng Việt, nhận diện intent | Có | Kiểm tra schema |
| Nhận diện tên người, nhóm hàng, điều kiện | Có | Đối chiếu ID và giá trị |
| Hỏi câu làm rõ | Soạn câu | Quyết định cần hỏi trường nào |
| Tìm sản phẩm | Không trực tiếp | Truy vấn catalog |
| Lọc cân nặng, kích cỡ, ngân sách, tương thích | Không | Có |
| Tính giá/miếng, chi phí giao hàng, lượng tiêu thụ | Không | Có |
| Xếp hạng | Không | Có |
| Viết lý do, tóm tắt ưu nhược điểm | Có | Kiểm tra mọi dữ kiện |
| Tạo liên kết mua và ghi nhận click | Không | Có |
| Gửi nhắc mua lại | Soạn nội dung | Quyết định điều kiện, thời điểm và chống gửi lặp |

LLM không được tạo sản phẩm, giá, đặc tính, đánh giá, tồn kho hoặc ngày giao hàng ngoài dữ liệu đã cấp. Nếu phần diễn đạt của LLM không qua kiểm tra, hệ thống dùng câu mẫu từ dữ liệu có cấu trúc.

## 6. State và Family Memory

### 6.1 Bốn lớp dữ liệu

| Lớp | Ví dụ | Cách ghi |
|---|---|---|
| Hồ sơ đã xác nhận | Gold nặng 10,2 kg; máy giặt cửa trước | Người dùng nhập hoặc xác nhận |
| Sở thích đã xác nhận | Ưu tiên tiết kiệm; tránh hương liệu | Người dùng nhập hoặc xác nhận |
| Quan sát tạm thời | “Có lẽ còn 5 miếng bỉm” | Lưu cùng nguồn, thời điểm, độ chắc chắn |
| Dữ liệu suy ra | Dùng trung bình 4,5 miếng/ngày | Engine tính và có thể tính lại |

Mỗi trường memory quan trọng cần có: `value`, `source`, `observed_at`, `confirmed_at`, `confidence`, `expires_at` nếu phù hợp. Thông tin mới, đã xác nhận, được ưu tiên hơn thông tin cũ. Hai giá trị mâu thuẫn phải dẫn đến câu hỏi xác nhận; không ghi đè âm thầm.

### 6.2 Quyền riêng tư

- Chỉ lấy dữ liệu gia đình cần cho yêu cầu hiện tại.
- Tách dữ liệu của từng household; mọi truy vấn phải kiểm tra quyền thành viên.
- Người dùng có thể xem, sửa, xóa hồ sơ và tắt nhắc mua lại.
- Không đưa tên, ngày sinh hoặc lịch sử mua đầy đủ vào prompt nếu một vài thuộc tính đã đủ.
- Log kỹ thuật dùng ID và metadata; không ghi nguyên văn thông tin nhạy cảm khi không cần điều tra lỗi.
- Thời gian lưu hội thoại và event phải là cấu hình sản phẩm, được công bố trong chính sách dữ liệu.

## 7. Intent schema

Intent parser trả JSON hợp lệ, không trả văn bản tự do:

```typescript
type IntentType =
  | "discover"
  | "compare"
  | "reorder"
  | "check_replenishment"
  | "monthly_basket"
  | "price_check"
  | "update_family"
  | "unknown";

type SourceType = "user_message" | "family_profile" | "purchase_history";

interface ExtractedField<T> {
  value: T;
  source: SourceType;
  confidence: number; // 0..1, chỉ đo độ chắc chắn của việc trích xuất
}

interface ShoppingIntentV1 {
  schemaVersion: "1";
  intentType: IntentType;
  householdMemberRef?: string;
  categoryId?: string;
  productRef?: string;
  requiredAttributes: Record<string, unknown>;
  constraints: {
    maxTotalPriceVnd?: number;
    maxUnitPriceVnd?: number;
    minQuantity?: number;
    excludedBrands?: string[];
    requiredMerchants?: string[];
  };
  preferences: {
    priority?: "lowest_cost" | "best_value" | "quality" | "fast_delivery";
    preferredBrands?: string[];
  };
  comparisonRefs?: string[];
  timeHorizonDays?: number;
  fieldEvidence: Record<string, ExtractedField<unknown>>;
  ambiguity: string[];
}
```

Ví dụ:

```json
{
  "schemaVersion": "1",
  "intentType": "discover",
  "householdMemberRef": "Gold",
  "categoryId": "diapers",
  "requiredAttributes": {
    "nightUse": true
  },
  "constraints": {
    "maxUnitPriceVnd": 8000
  },
  "preferences": {
    "priority": "best_value"
  },
  "fieldEvidence": {
    "categoryId": {
      "value": "diapers",
      "source": "user_message",
      "confidence": 0.99
    }
  },
  "ambiguity": []
}
```

**Quy tắc hợp nhất:** Điều kiện trong tin nhắn hiện tại thắng sở thích hồ sơ. Hồ sơ đã xác nhận thắng dữ liệu suy ra. Điều kiện “không dùng thương hiệu X” luôn là bộ lọc cứng. Nếu điều kiện mâu thuẫn nhau, hỏi người dùng trước khi tìm.

## 8. Tool contracts

Mọi tool trả `requestId`, `dataVersion`, `asOf` và lỗi theo mã ổn định. Tool không trả văn bản thay cho dữ liệu có cấu trúc.

| Tool | Input chính | Output chính | Lỗi cần xử lý |
|---|---|---|---|
| `getHouseholdContext` | `householdId`, `scope` | thành viên, sở thích liên quan | không có quyền, thiếu hồ sơ |
| `searchCatalog` | category, từ khóa, thuộc tính | product/variant ID | không có kết quả |
| `getProductFacts` | variant IDs | thuộc tính, nguồn, ngày cập nhật | dữ liệu thiếu, biến thể ngừng bán |
| `getOffers` | variant IDs, địa điểm giao nếu có | offer còn hiệu lực | nguồn lỗi, giá cũ |
| `getPurchaseHistory` | household, category, khoảng thời gian | lần mua và trạng thái xác nhận | thiếu quyền, dữ liệu không đầy đủ |
| `estimateConsumption` | sản phẩm, lần mua, tồn kho | lượng dùng/ngày, ngày dự kiến hết, khoảng bất định | không đủ dữ liệu |
| `rankCandidates` | intent, facts, offers, preferences | điểm và mã lý do | không có ứng viên hợp lệ |
| `planMonthlyBasket` | tháng, nhu cầu dự kiến, ngân sách | danh sách cần mua, chi phí ước tính | dữ liệu giá/tiêu thụ thiếu |
| `recordUserFeedback` | session, loại phản hồi | bản ghi phản hồi | trùng request |

Ví dụ contract cho offer:

```typescript
interface OfferSnapshot {
  offerId: string;
  variantId: string;
  merchantId: string;
  source: "affiliate" | "direct";
  priceVnd: number;
  shippingVnd?: number;
  voucherVnd?: number;
  payableTotalVnd?: number;
  availability: "in_stock" | "out_of_stock" | "unknown";
  destinationUrlRef: string;
  observedAt: string;
  validUntil?: string;
  sourceStatus: "verified_feed" | "manual" | "user_reported";
}
```

`payableTotalVnd` chỉ được hiển thị là tổng tiền khi phí giao và điều kiện voucher đã biết. Nếu thiếu, ghi “giá sản phẩm, chưa gồm phí giao”.

## 9. Orchestration và state machine

```text
RECEIVED
→ AUTHORIZED
→ INTENT_PARSED
→ CONTEXT_RESOLVED
→ [CLARIFICATION_REQUIRED]
→ CANDIDATES_RETRIEVED
→ HARD_FILTERED
→ OFFERS_RESOLVED
→ RANKED
→ RESPONSE_VALIDATED
→ RESPONDED
```

Nhánh mua lại:

```text
CONTEXT_RESOLVED
→ PURCHASES_LOADED
→ CONSUMPTION_ESTIMATED
→ OFFERS_RESOLVED
→ REORDER_OPTIONS_RANKED
→ RESPONSE_VALIDATED
→ RESPONDED
```

Nhánh giỏ tháng:

```text
PURCHASES_LOADED
→ CONSUMPTION_ESTIMATED
→ ITEMS_DUE_SELECTED
→ QUANTITIES_CALCULATED
→ OFFERS_RESOLVED
→ BASKET_COSTED
→ RESPONDED
```

**Quy tắc chuyển trạng thái:**

- Nếu thiếu thông tin quyết định tính phù hợp hoặc an toàn, chuyển `CLARIFICATION_REQUIRED`.
- Mỗi lượt chỉ hỏi tối đa 2 câu, ưu tiên câu trả lời dạng lựa chọn.
- Nếu không có ứng viên sau bộ lọc cứng, giải thích điều kiện nào làm rỗng kết quả và đề nghị người dùng nới điều kiện đó.
- Không âm thầm bỏ điều kiện cứng để tạo ra kết quả.
- Khi nguồn offer lỗi, vẫn có thể trả sản phẩm phù hợp nhưng không đưa CTA mua từ giá cũ.
- Mỗi request có thời hạn xử lý và trạng thái lỗi rõ để UI không chờ vô hạn.

## 10. Product intelligence

### 10.1 Product, variant và offer

- **Product:** Dòng sản phẩm, ví dụ “Merries Natural”.
- **Variant:** Quy cách cụ thể, ví dụ “quần size L, 64 miếng”.
- **Offer:** Biến thể đó tại một nơi bán, với giá và điều kiện mua ở một thời điểm.

Không gộp hai biến thể chỉ vì tên gần giống. Ghép cùng sản phẩm phải kiểm tra thương hiệu, dòng, loại, size, số lượng, mã GTIN/SKU nếu có. Trường hợp không chắc chắn được đưa vào hàng chờ kiểm tra dữ liệu.

### 10.2 Thuộc tính bắt buộc

Mỗi category có schema riêng. Ví dụ:

```typescript
interface DiaperFacts {
  form: "pants" | "tape";
  sizeLabel: string;
  minWeightKg?: number;
  maxWeightKg?: number;
  piecesPerPack: number;
  nightUseEvidence?: {
    value: boolean;
    source: string;
    observedAt: string;
  };
}
```

Không biến lời quảng cáo “siêu thấm hút” thành điểm chất lượng định lượng nếu chưa có phương pháp đánh giá. Các điểm như chống tràn, mềm hoặc phù hợp da nhạy cảm cần nguồn và quy tắc chuẩn hóa; chưa có dữ liệu thì để `unknown`.

### 10.3 Kiểm tra chất lượng dữ liệu

Một variant chỉ được đề xuất khi có danh mục, thương hiệu, quy cách, đơn vị tính và các thuộc tính cứng cần cho category. Một offer chỉ có nút mua khi URL hợp lệ, nguồn được phép sử dụng và giá còn trong thời hạn hiệu lực đã cấu hình.

## 11. Đề xuất và xếp hạng

### 11.1 Hai cấp xếp hạng

1. **Xếp hạng sản phẩm:** Sản phẩm nào phù hợp nhất với nhu cầu.
2. **Xếp hạng offer:** Với cùng một biến thể, nên xem nơi bán nào trước.

Tách hai cấp để một sản phẩm không được đẩy lên chỉ vì nơi bán trả hoa hồng cao.

### 11.2 Bộ lọc cứng

Ví dụ: category, khoảng cân nặng, dạng bỉm, tương thích máy giặt, thương hiệu bị loại, giá trần, tình trạng hết hàng. Giá trần phải xác định áp vào **giá gói** hay **giá đơn vị** từ intent; nếu không rõ và kết quả thay đổi đáng kể, hỏi lại.

### 11.3 Điểm sản phẩm

Công thức ban đầu, có version:

```text
product_score_v1 =
  0,40 × requirement_fit
+ 0,20 × household_preference_fit
+ 0,15 × product_evidence_quality
+ 0,15 × value
+ 0,10 × purchase_continuity
```

Các điểm thành phần nằm trong khoảng 0–100. `purchase_continuity` chỉ phản ánh sản phẩm đã dùng và được người dùng đánh giá phù hợp; mua nhiều lần một mình không chứng minh chất lượng. Thành phần thiếu dữ liệu được đánh dấu `unknown`; hệ thống không tự gán điểm cao. Nếu dữ liệu thiếu nhiều, giảm độ tin cậy và dùng xếp hạng đơn giản hơn.

**Không đưa hoa hồng, mức tài trợ hoặc lợi nhuận trực tiếp vào công thức.** Nếu sau này có vị trí quảng cáo, hiển thị và gắn nhãn riêng.

### 11.4 Điểm offer

Chỉ so sánh các offer của cùng variant:

```text
offer_score_v1 =
  giá phải trả có thể xác minh
+ tình trạng còn hàng
+ độ tin cậy nơi bán
+ thời gian giao nếu biết
+ độ mới dữ liệu
```

Giá/miếng, giá/100 ml hoặc giá/lần dùng được tính từ cùng một quy cách chuẩn. Không so giá gói 54 miếng với gói 64 miếng mà bỏ qua số lượng. Nếu thiếu phí giao hoặc voucher phụ thuộc tài khoản, trình bày đó là giới hạn của phép so sánh.

### 11.5 Giải thích

Mỗi đề xuất trả:

```typescript
interface RecommendationItem {
  variantId: string;
  rank: number;
  score: number;
  scoreVersion: string;
  matchedReasons: string[];
  tradeoffs: string[];
  failedSoftPreferences: string[];
  bestOfferId?: string;
  evidenceRefs: string[];
}
```

UI dùng “Phù hợp với nhu cầu đã nêu” thay vì hiện “94% phù hợp” khi điểm chưa được hiệu chuẩn bằng dữ liệu đánh giá thực tế.

## 12. Confidence và fallback

Tách 3 loại độ tin cậy:

- **Intent confidence:** Hệ thống hiểu đúng lời người dùng đến mức nào.
- **Data confidence:** Thuộc tính, giá và lịch sử mua đầy đủ, mới và có nguồn đáng tin đến mức nào.
- **Recommendation confidence:** Có đủ ứng viên hợp lệ và chênh lệch giữa các lựa chọn có ý nghĩa hay không.

Các giá trị này phục vụ quyết định hệ thống, không mặc định hiển thị thành phần trăm cho người dùng.

| Tình huống | Xử lý |
|---|---|
| Không rõ bé nào | Hỏi chọn thành viên |
| Thiếu cân nặng để lọc bỉm | Hỏi cân nặng hoặc size đã dùng |
| Không rõ giá trần tính theo gói hay đơn vị | Hỏi hoặc hiển thị cả hai cách tính |
| Giá offer cũ | Ẩn CTA giá đó; cho phép xem sản phẩm |
| Không có offer còn hàng | Đề xuất sản phẩm và báo chưa có nơi mua được xác nhận |
| Thiếu dữ liệu đặc tính quan trọng | Không khẳng định đặc tính; có thể loại khỏi đề xuất |
| LLM lỗi/timeout | Trả kết quả có cấu trúc bằng câu mẫu |
| Catalog không có kết quả hợp lệ | Báo rõ và đưa tùy chọn sửa điều kiện |

## 13. Lịch sử mua và cá nhân hóa

### 13.1 Trạng thái giao dịch

`planned → clicked_outbound → ordered_user_reported/ordered_direct → delivered → returned/cancelled`

Click ra sàn **không phải** một đơn đã mua. Chỉ dùng giao dịch đã được xác nhận để tính tiêu thụ. Người dùng có thể nhập lần mua ngoài Family AI; bản ghi phải có `source=user_entered`.

### 13.2 Dữ liệu mỗi lần mua

Lưu variant, số lượng, giá thực trả nếu biết, ngày mua, ngày nhận, người sử dụng, trạng thái, nguồn xác nhận và phản hồi. Không suy ra giá thực trả từ offer lúc click.

### 13.3 Cá nhân hóa

- Sở thích người dùng nêu rõ có ưu tiên cao nhất.
- Phản hồi “không hợp”, “bị tràn”, “mùi quá nồng” phải được ghi thành tín hiệu theo category và người sử dụng.
- Một lượt xem, một cú click hoặc một lần mua chưa đủ để kết luận người dùng thích thương hiệu.
- Mọi sở thích suy ra phải có thể xem và xóa.

## 14. Consumption engine

### 14.1 Công thức cơ bản

Với hàng tính theo đơn vị:

```text
lượng còn ước tính =
  lượng tồn được người dùng xác nhận gần nhất
+ số lượng đã nhận sau thời điểm đó
− mức dùng mỗi ngày × số ngày
```

Nếu không có tồn kho xác nhận:

```text
mức dùng mỗi ngày =
  tổng lượng được xác nhận đã dùng
  ÷ số ngày giữa các lần bổ sung hợp lệ
```

Chỉ dùng các khoảng thời gian không có trả hàng, mua chồng nhiều gói không rõ tồn kho, thay đổi người dùng hoặc gián đoạn sử dụng. Cần tối thiểu 2 chu kỳ mua hợp lệ để ước tính theo lịch sử; nếu chưa đủ, dùng mức sử dụng người dùng khai báo hoặc khoảng mặc định có nhãn “ước tính ban đầu”.

Ví dụ: còn khoảng 18 miếng và dùng 4–5 miếng/ngày → còn khoảng 3,6–4,5 ngày. Hiển thị “khoảng 4 ngày”, kèm giả định. Không làm tròn thành ngày chắc chắn.

### 14.2 Thời điểm nhắc

```text
ngày nên nhắc =
  ngày dự kiến hết
− thời gian giao dự kiến
− số ngày dự phòng do người dùng chọn
```

Mỗi `household + category + consumption_cycle` chỉ có một nhắc chủ động còn hiệu lực. Người dùng có thể hoãn, tắt hoặc đánh dấu “đã mua”. Không nhắc tiếp nếu hệ thống ghi nhận đã bổ sung đủ hàng.

### 14.3 Độ bất định

Engine trả `estimatedDepletionDate`, `earliestDate`, `latestDate`, `method`, `sampleCount`, `assumptions`. Nếu khoảng dự kiến quá rộng hoặc dữ liệu đã cũ, không gửi thông báo khẳng định “sắp hết”; hỏi người dùng kiểm tra lượng còn.

## 15. Proactive replenishment và giỏ tháng

### 15.1 Trigger chủ động

- Mặt hàng dự kiến sắp hết trong khoảng thời gian đủ để mua và nhận.
- Offer của đúng biến thể từng mua có giá tốt hơn ngưỡng người dùng đặt, nếu dữ liệu giá đủ tin cậy.
- Đầu tháng, người dùng đã bật tính năng giỏ tháng.
- Người dùng đổi thông tin làm sản phẩm hiện dùng không còn phù hợp, ví dụ cân nặng vượt khoảng size.

Mọi trigger phải kiểm tra quyền nhận thông báo, giờ yên lặng, tần suất tối đa và chống gửi trùng. Giá giảm không được thúc đẩy mua khi ước tính còn đủ dùng lâu.

### 15.2 Giỏ hàng tháng

Giỏ tháng là **kế hoạch mua**, không phải đơn hàng. Với từng mặt hàng, trả: lượng cần mua, lý do, ngày dự kiến cần, sản phẩm đang dùng, phương án thay thế, giá tham khảo, mức chắc chắn và nơi bán. Tổng tiền là tổng các giá quan sát được, có ghi rõ khoản chưa gồm phí giao hoặc voucher.

Nếu vượt ngân sách: giữ mặt hàng cần sớm, giảm hoặc dời hàng có thể chờ, và hỏi người dùng trước khi thay thương hiệu quan trọng. Không tự cắt sản phẩm có điều kiện bắt buộc.

## 16. Data model tối thiểu

```text
users
households
household_members
household_permissions
family_facts
preferences

categories
products
product_variants
product_facts
product_fact_sources
merchants
offers
offer_snapshots

conversations
messages
shopping_intents
recommendation_sessions
recommendation_items
recommendation_evidence

purchases
purchase_items
inventory_observations
consumption_estimates
replenishment_rules
notifications
monthly_baskets
monthly_basket_items

affiliate_clicks
user_feedback
agent_runs
agent_events
```

Các bảng giao dịch và event cần `id`, `created_at`, `household_id` khi phù hợp. Các bản ghi tính toán cần `algorithm_version` và `input_snapshot_id` để tái hiện kết quả. `offer_snapshots` lưu giá đã thấy tại thời điểm đề xuất; không ghi đè lịch sử bằng giá mới.

## 17. API và events

### API chính

```text
POST /api/agent/turns
GET  /api/agent/turns/:id

GET  /api/family
PATCH /api/family/facts
GET  /api/purchases
POST /api/purchases
PATCH /api/purchases/:id

POST /api/recommendations
POST /api/compare
GET  /api/products/:id
GET  /api/products/:id/offers

GET  /api/replenishment
PATCH /api/replenishment/rules/:id
GET  /api/baskets/monthly?month=YYYY-MM
POST /api/baskets/monthly/generate

POST /api/feedback
GET  /go/:offerId
```

Ví dụ lượt hội thoại:

```json
{
  "conversationId": "conv_123",
  "householdId": "hh_123",
  "message": "Mua lại bỉm cho Gold, loại như lần trước",
  "idempotencyKey": "client-generated-unique-key"
}
```

Response:

```json
{
  "turnId": "turn_123",
  "state": "responded",
  "intentType": "reorder",
  "message": "Lần trước bạn mua Merries quần L64. Tôi tìm thấy 2 nơi đang bán biến thể này.",
  "clarification": null,
  "recommendations": [
    {
      "variantId": "var_123",
      "rank": 1,
      "reasons": ["Đúng biến thể đã mua lần trước"],
      "tradeoffs": [],
      "offerIds": ["offer_1", "offer_2"]
    }
  ],
  "dataAsOf": "2026-09-23T08:00:00Z",
  "traceId": "trace_123"
}
```

`/go/:offerId` kiểm tra offer và URL đích, ghi click rồi redirect. URL đích không nhận trực tiếp từ client. Với POST có tác động ghi dữ liệu, dùng idempotency key để tránh tạo trùng khi client retry.

### Events

`intent_parsed`, `clarification_requested`, `recommendation_generated`, `recommendation_viewed`, `product_compared`, `offer_clicked`, `purchase_confirmed`, `purchase_returned`, `consumption_estimated`, `replenishment_due`, `notification_sent`, `notification_dismissed`, `basket_generated`, `feedback_submitted`.

Event có `eventId`, `occurredAt`, `householdId`, `sessionId`, `algorithmVersion`, `properties` đã giới hạn schema. Không dùng event analytics làm nguồn sự thật cho đơn hàng.

## 18. Prompt contracts

### Intent parser

**Input:** Lời người dùng, tóm tắt hội thoại liên quan, danh mục hợp lệ và những fact gia đình đã được phép sử dụng.  
**Output:** `ShoppingIntentV1` đúng schema.  
**Ràng buộc:** Không đề xuất sản phẩm; không điền dữ liệu chưa được cung cấp; ghi điểm mơ hồ vào `ambiguity`; dẫn nguồn cho trường trích xuất.

### Response composer

**Input:** Intent đã xác nhận, kết quả xếp hạng, fact và offer snapshots, lý do/đánh đổi có cấu trúc.  
**Output:** JSON gồm `summary`, `itemExplanations`, `followUpQuestion`.  
**Ràng buộc:** Chỉ nêu giá, thuộc tính và lịch sử mua có `evidenceRef`; không nói “tốt nhất” chung chung; không tạo link; không đổi thứ tự xếp hạng.

Sau khi LLM trả lời, validator kiểm tra ID, giá, số lượng, nguồn và thứ tự. Thất bại thì dùng template an toàn:

> “Tôi tìm thấy 3 lựa chọn phù hợp với cân nặng và ngân sách bạn đã cung cấp. Giá được cập nhật lúc … Bạn có thể xem điểm khác nhau trong từng thẻ sản phẩm.”

Prompt là tài sản có version, được kiểm thử khi thay đổi.

## 19. Guardrails

- Kiểm tra quyền household ở mọi API và tool.
- Chặn prompt injection từ tên sản phẩm, mô tả, review hoặc feed đối tác; các chuỗi đó là dữ liệu, không phải lệnh.
- Không tự checkout, tự gửi đơn hoặc lưu thông tin thanh toán qua agent.
- Không đưa ra tuyên bố sức khỏe, an toàn hoặc hiệu quả sản phẩm nếu không có nguồn được chấp nhận.
- Đánh dấu liên kết có thể tạo hoa hồng; hoa hồng không tác động xếp hạng.
- Kiểm tra URL chuyển hướng theo allowlist đối tác; tránh open redirect.
- Ghi rõ thời điểm cập nhật giá và phạm vi nơi bán được so sánh.
- Giới hạn số lượt gọi LLM/tool, thời gian xử lý và chi phí mỗi phiên.
- Có thể tắt từng nguồn offer hoặc tính năng nhắc chủ động khi dữ liệu lỗi.

## 20. Observability và analytics

Mỗi lượt agent cần trace theo các bước: parse, lấy context, tìm kiếm, lọc, lấy offer, xếp hạng, diễn đạt, kiểm chứng. Lưu thời gian, số ứng viên trước/sau lọc, mã lý do bị loại, version thuật toán, lỗi và số token/chi phí LLM. Không cần lưu toàn bộ prompt chứa dữ liệu cá nhân để đo hiệu năng.

Dashboard vận hành theo dõi:

- Tỷ lệ parse intent hợp lệ và tỷ lệ phải hỏi lại.
- Tỷ lệ phiên có ít nhất một đề xuất hợp lệ.
- Tỷ lệ vi phạm điều kiện cứng: mục tiêu **0**.
- Độ mới offer, lỗi nguồn giá và tỷ lệ click vào offer hết hiệu lực.
- Thời gian phản hồi theo phân vị.
- Tỷ lệ xem đề xuất → so sánh → click nơi bán.
- Tỷ lệ người dùng đánh dấu “phù hợp/không phù hợp”.
- Tỷ lệ nhắc mua lại được mở, hoãn, tắt và xác nhận đã mua.

“Click ra sàn” chỉ là chỉ số quan tâm, không được báo cáo là đơn hàng hay doanh thu khi chưa có xác nhận chuyển đổi.

## 21. Eval suite

Tạo tập dữ liệu phiên bản hóa, bắt đầu từ 50 tình huống MVP và mở rộng lên ít nhất 200 tình huống trước khi bật nhắc chủ động. Mỗi case có input, family facts, catalog/offer snapshot, kết quả kỳ vọng và điều kiện không được vi phạm.

Các nhóm bắt buộc:

- Tiếng Việt tự nhiên, viết tắt, sai chính tả và nhiều ý trong một câu.
- Thiếu cân nặng/size; nhiều bé trong một gia đình.
- Mâu thuẫn giữa lời nói hiện tại và hồ sơ.
- Giá trần theo gói và theo đơn vị.
- Quy cách gần giống, trùng tên, sai số lượng.
- Offer cũ, hết hàng, phí giao chưa biết.
- Không có sản phẩm đáp ứng toàn bộ điều kiện.
- Mua nhiều gói, trả hàng, thay sản phẩm giữa chu kỳ.
- Prompt injection nằm trong dữ liệu sản phẩm.
- LLM timeout, nguồn giá lỗi và retry API.

**Điều kiện đạt trước khi phát hành:** 100% case không vi phạm bộ lọc cứng; 100% giá/thuộc tính trong câu trả lời có nguồn trong snapshot; không có truy cập chéo household; không có thông báo trùng trong cùng chu kỳ. Các chỉ số chất lượng mềm như thứ tự Top 3 và độ hữu ích của giải thích cần được đánh giá thủ công, theo dõi theo version và cải thiện dần.

## 22. Failure modes cần thiết kế trước

| Lỗi | Hành vi mong muốn |
|---|---|
| LLM hiểu sai intent | Hiển thị cách hiểu ngắn gọn; cho sửa trước khi gợi ý |
| Hồ sơ cũ | Hỏi xác nhận trường ảnh hưởng lớn |
| Catalog ghép sai biến thể | Chặn publish hoặc chặn đề xuất |
| Nguồn offer lỗi | Không hiển thị giá như giá hiện tại |
| Lịch sử mua thiếu | Dùng mức sử dụng do người dùng nhập; ghi rõ là ước tính |
| Người dùng mua ở nơi khác | Cho đánh dấu đã mua và cập nhật tồn kho |
| Thay đổi mức sử dụng đột ngột | Giảm độ tin cậy; hỏi lượng còn |
| Voucher cá nhân hóa | Không tính vào giá phải trả mặc định |
| LLM tạo lý do không có dữ liệu | Validator loại bỏ hoặc dùng template |
| Gửi nhắc quá nhiều | Deduplicate, giới hạn tần suất, cho tắt dễ dàng |

## 23. Kế hoạch triển khai

### Phase 0 — Làm chắc dữ liệu MVP

Chuẩn hóa product/variant/offer, schema theo category, nguồn dữ liệu, thời hạn giá và công cụ nhập CSV. Tạo bộ dữ liệu kiểm thử cố định.

**Xong khi:** Tìm và so sánh sản phẩm bằng mã nguồn hoạt động ổn định, chưa cần LLM.

### Phase 1 — Agent tìm và so sánh

Làm intent parser, context resolver, bộ lọc cứng, ranking, giải thích có kiểm chứng, UI đề xuất và affiliate redirect.

**Xong khi:** Người dùng nhập yêu cầu tự nhiên, nhận Top 3 hợp lệ, hiểu lý do và đi tới nơi bán.

### Phase 2 — Family Memory và mua lại

Cho nhập/xác nhận hồ sơ, ghi lịch sử mua thật, phản hồi sau mua và “mua lại loại lần trước”.

**Xong khi:** Agent nhận ra đúng variant đã mua, phân biệt click với mua thật và không dùng dữ liệu hộ gia đình khác.

### Phase 3 — Consumption engine và nhắc mua

Tính lượng dùng, hiển thị ngày dự kiến hết, cho sửa lượng tồn, bật/tắt nhắc và chống gửi trùng.

**Xong khi:** Người dùng hiểu giả định, sửa được dự báo và không nhận nhắc khi đã đánh dấu mua bổ sung.

### Phase 4 — Giỏ tháng

Tạo danh sách cần mua theo chu kỳ, so sánh offer, tính tổng chi phí với giới hạn dữ liệu rõ ràng.

**Xong khi:** Người dùng có thể duyệt, sửa, bỏ hoặc hoãn từng món trước khi đi mua.

### Phase 5 — Checkout trực tiếp, nếu kinh doanh yêu cầu

Tích hợp nguồn hàng và đơn hàng riêng, có kiểm tra tồn kho, giá, thanh toán, giao hàng và hoàn trả. Thiết kế này là một dự án giao dịch riêng; không ghép vội vào logic đề xuất.

## 24. Điều kiện nghiệm thu tổng thể

1. Với “Mua bỉm cho Gold”, hệ thống dùng đúng hồ sơ Gold hoặc hỏi nếu có nhiều người trùng tên; không tự đoán cân nặng chưa xác nhận.
2. Mọi đề xuất đáp ứng điều kiện cứng. Nếu không có sản phẩm, hệ thống nêu rõ điều kiện gây ra và không lén bỏ qua.
3. Một biến thể có nhiều nơi bán được so theo cùng quy cách; giá và thời điểm cập nhật được hiển thị.
4. Thứ tự sản phẩm không đổi khi chỉ thay dữ liệu hoa hồng.
5. Agent không gọi click ra sàn là “đã mua”.
6. “Mua lại” tìm đúng biến thể lần trước; nếu biến thể đã ngừng bán, trình bày phương án thay thế cùng khác biệt.
7. Dự báo dùng hết có công thức, dữ liệu đầu vào và khoảng bất định; người dùng có thể sửa lượng còn.
8. Nhắc mua chỉ chạy khi người dùng bật, không gửi trùng và dừng khi đã xác nhận mua.
9. Giỏ tháng phân biệt giá sản phẩm với tổng chi phí giao dịch khi chưa biết phí giao.
10. Mọi câu trả lời có thể truy ngược tới intent, dữ liệu, offer snapshot và version thuật toán đã dùng.
