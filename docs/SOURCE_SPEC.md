# FAMILY AI
## AI Shopping Agent for Baby & Family Essentials

**Version:** MVP v0.1  
**Product type:** AI-native commerce / affiliate commerce  
**Initial market:** Việt Nam  
**Initial target user:** Bố/mẹ 25–38 tuổi, có con 0–3 tuổi  
**Primary platform:** Responsive Web  
**Primary objective:** Giúp người dùng chọn được sản phẩm phù hợp nhanh hơn việc tự tìm kiếm trên marketplace.

---

# 1. PRODUCT VISION

Family AI không phải một website thương mại điện tử có chatbot.

Family AI là:

> Một AI Shopping Agent hiểu gia đình người dùng, hiểu sản phẩm trên thị trường và giúp người dùng tìm, so sánh, lựa chọn và mua sản phẩm phù hợp nhất.

Long-term vision:

```text
Understand family
        ↓
Understand need
        ↓
Find products
        ↓
Compare
        ↓
Recommend
        ↓
Purchase
        ↓
Learn
        ↓
Predict next need
        ↓
Reorder
```

MVP chỉ cần chứng minh được phần:

```text
Understand need
      ↓
Find
      ↓
Compare
      ↓
Recommend
      ↓
Affiliate click
```

---

# 2. CORE PRODUCT PRINCIPLE

## 2.1 AI-first, không phải Search-first

Marketplace truyền thống:

```text
Search keyword
→ 1.000 products
→ Filter
→ Review
→ Compare
→ Decide
```

Family AI:

```text
Tell AI what you need
→ AI understands context
→ AI filters market
→ 3–5 recommendations
→ Explain differences
→ User decides
```

---

## 2.2 Recommend theo suitability, không theo commission

Affiliate commission KHÔNG được dùng làm biến ranking sản phẩm.

Ranking phải ưu tiên:

1. User fit
2. Requirement fit
3. Product quality
4. Value
5. Seller trust
6. Availability
7. Delivery

Affiliate revenue chỉ là business layer phía sau.

---

## 2.3 Explainable recommendation

Không chỉ nói:

> Sản phẩm A tốt nhất.

AI phải nói:

> Tôi ưu tiên sản phẩm A vì con bạn đang 10kg, cần dùng ban đêm và bạn ưu tiên hạn chế tràn. Giá/miếng cao hơn sản phẩm B khoảng 8%, nhưng phù hợp hơn với nhu cầu hiện tại.

---

# 3. MVP SUCCESS QUESTION

MVP phải trả lời được:

> Người dùng có chọn được sản phẩm nhanh hơn và tự tin hơn so với tự tìm trên Shopee/TikTok/Lazada hay không?

Nếu chưa chứng minh được điều này, chưa cần build checkout, logistics hay dropshipping.

---

# 4. TARGET USER

## Primary persona

### Young Family Shopper

Đặc điểm:

- 25–38 tuổi
- Có con 0–3 tuổi
- Mua đồ online thường xuyên
- Dùng Shopee / TikTok Shop / Lazada
- Có quá nhiều lựa chọn
- Hay đọc review trước khi mua
- Quan tâm giá nhưng không nhất thiết chọn rẻ nhất
- Ưu tiên sản phẩm phù hợp với con/gia đình

---

# 5. INITIAL CATEGORIES

MVP giới hạn 8 category:

```text
Baby
├── Diapers
├── Wet wipes
├── Baby laundry detergent
└── Bottle cleanser

Household
├── Laundry detergent
├── Dishwashing
├── Tissue
└── Trash bags
```

Không support MVP:

- thuốc
- thực phẩm chức năng
- sữa công thức
- thực phẩm có claim sức khỏe
- sản phẩm điều trị
- mỹ phẩm treatment
- medical devices

---

# 6. MVP SCOPE

## In scope

- AI Shopping Chat
- Intent extraction
- Family Profile
- Product catalog
- Product search
- Product filtering
- Recommendation ranking
- Top 3–5 recommendation
- Product comparison
- Product detail
- Affiliate outbound links
- Basic click tracking
- Conversation history
- Basic user preference memory

## Out of scope

- Cart
- Payment
- Own checkout
- Order management
- Fulfillment
- Dropshipping automation
- Supplier API
- Inventory ownership
- Auto reorder
- Subscription
- Price alert
- Mobile app
- Merchant dashboard
- B2B Commerce OS

Các phần này sẽ được thêm sau khi MVP chứng minh được demand.

---

# 7. CORE USER JOURNEY

## Journey 1 — AI Product Discovery

User vào homepage.

Input:

> Tìm giúp tôi bỉm ban đêm cho bé 14 tháng, khoảng 10kg, hay bị tràn.

System:

1. Parse intent.
2. Nếu thiếu dữ liệu quan trọng → hỏi tối đa 1–3 câu.
3. Search catalog.
4. Apply hard filters.
5. Rank products.
6. Return Top 3.
7. Explain recommendation.
8. User compare.
9. User click merchant.
10. Track affiliate click.

---

# 8. SCREEN 01 — HOME

## Objective

Cho người dùng hiểu trong vòng vài giây rằng đây là một AI hỗ trợ mua sắm.

## Layout

### Header

```text
Family AI
Explore
Saved
Family
Sign in
```

### Hero

Headline:

> Mua đúng thứ gia đình bạn cần.

Subheadline:

> Nói cho Family AI biết bạn đang cần gì. AI sẽ tìm, so sánh và đề xuất những lựa chọn phù hợp nhất.

### Main AI Input

Large textarea:

```text
Bạn đang cần mua gì?
```

Placeholder examples:

```text
Tìm bỉm ban đêm cho bé 10kg
```

Quick prompts:

- Bỉm cho bé
- Khăn ướt
- Nước giặt gia đình
- Nước rửa bát
- So sánh sản phẩm
- Mua theo ngân sách

### Suggested use cases

Card:

**Tìm sản phẩm**

> “Tìm loại bỉm phù hợp cho bé 10kg.”

Card:

**So sánh**

> “Merries và Moony khác nhau như thế nào?”

Card:

**Tối ưu ngân sách**

> “Tôi có 500k để mua đồ vệ sinh gia đình.”

---

# 9. SCREEN 02 — AI SHOPPING CHAT

Route:

```text
/shop
```

## Layout

Left/main:

Conversation.

Right sidebar desktop:

Family Context.

Example:

```text
Bạn:
Tìm cho tôi bỉm dùng ban đêm cho Gold.

AI:
Gold hiện đang khoảng 10kg.

Anh ưu tiên điều nào hơn?

[Hạn chế tràn]
[Mỏng nhẹ]
[Giá tốt]
[Da nhạy cảm]
```

Sau khi có đủ context:

```text
Tôi tìm thấy 18 sản phẩm phù hợp.

Dựa trên cân nặng, nhu cầu dùng ban đêm và mức giá hiện tại,
tôi ưu tiên 3 sản phẩm này:
```

Render product cards.

---

# 10. SCREEN 03 — AI RECOMMENDATION

Component:

```text
RecommendationResult
```

Mỗi card gồm:

```text
Image

Brand
Product name

Family Match: 94%

Why it fits:
- phù hợp 9–14kg
- chống tràn tốt
- phù hợp dùng ban đêm

Price:
399.000đ

Price/unit:
6.234đ / miếng

Available at:
Shopee
TikTok Shop

[Compare]
[View details]
[Buy]
```

Top recommendation có label:

```text
Best match
```

Không dùng:

```text
Best product
```

vì recommendation phụ thuộc context.

---

# 11. SCREEN 04 — PRODUCT COMPARE

Route:

```text
/compare?products=id1,id2,id3
```

Ví dụ:

| Attribute | Merries | Moony | Huggies |
|---|---:|---:|---:|
| Family Match | 94% | 91% | 82% |
| Price | 399K | 369K | 315K |
| Unit price | 6.2K | 5.9K | 4.6K |
| Weight | 9–14kg | 9–14kg | 9–14kg |
| Night use | Excellent | Excellent | Good |
| Thickness | Medium | Thin | Medium |
| Seller rating | 4.9 | 4.8 | 4.8 |

AI summary bên trên:

> Nếu ưu tiên chống tràn ban đêm, Merries phù hợp hơn với nhu cầu hiện tại. Nếu ưu tiên chi phí, Huggies có giá/miếng thấp hơn đáng kể.

CTA:

```text
View offer
```

---

# 12. SCREEN 05 — FAMILY PROFILE

Route:

```text
/family
```

## Household

```text
Family name

Adults:
2

Children:
1
```

## Child Profile

```text
Name
Birth date
Current weight
Current diaper size
Skin sensitivity
Current brands
```

Không yêu cầu dữ liệu không cần thiết.

---

## Household preferences

```text
Primary preference:

[ ] Lowest price
[ ] Best value
[ ] Premium
[ ] Fast delivery
[ ] Trusted brands
```

## Appliances

Optional:

```text
Washing machine:
Front load / Top load
```

---

# 13. FAMILY PROFILE DATA MODEL

```typescript
interface FamilyProfile {
  id: string
  userId: string

  name?: string

  adultsCount?: number

  children: ChildProfile[]

  householdPreferences: HouseholdPreferences

  appliances?: ApplianceProfile[]

  createdAt: Date
  updatedAt: Date
}
```

Child:

```typescript
interface ChildProfile {
  id: string

  name?: string
  birthDate?: Date

  currentWeightKg?: number

  diaperSize?: string

  sensitivities?: string[]

  preferredBrands?: string[]
  dislikedBrands?: string[]
}
```

Preferences:

```typescript
interface HouseholdPreferences {
  pricePreference?:
    | "budget"
    | "value"
    | "balanced"
    | "premium"

  deliveryPreference?:
    | "cheapest"
    | "fastest"
    | "balanced"

  preferredBrands?: string[]

  avoidedIngredients?: string[]
}
```

---

# 14. PRODUCT DATA MODEL

Core entity:

```typescript
interface Product {
  id: string

  canonicalName: string
  slug: string

  brand: string
  categoryId: string

  description?: string

  images: string[]

  attributes: ProductAttributes

  variants: ProductVariant[]

  recommendationMetadata: RecommendationMetadata

  createdAt: Date
  updatedAt: Date
}
```

---

# 15. PRODUCT VARIANT

```typescript
interface ProductVariant {
  id: string

  productId: string

  name: string

  sku?: string
  gtin?: string

  size?: string

  quantity?: number
  quantityUnit?: string

  offers: ProductOffer[]
}
```

---

# 16. OFFER DATA MODEL

Một product có thể có nhiều nơi bán.

```typescript
interface ProductOffer {
  id: string

  productVariantId: string

  merchantId: string

  source:
    | "shopee"
    | "tiktok"
    | "lazada"
    | "affiliate"
    | "direct"

  price: number

  originalPrice?: number

  currency: "VND"

  availability:
    | "in_stock"
    | "out_of_stock"
    | "unknown"

  affiliateUrl?: string

  sellerRating?: number

  sellerReviewCount?: number

  shippingEstimate?: string

  updatedAt: Date
}
```

---

# 17. CATEGORY-SPECIFIC ATTRIBUTES

Không cố dùng một schema cho tất cả sản phẩm.

Ví dụ diaper:

```typescript
interface DiaperAttributes {
  minWeightKg?: number
  maxWeightKg?: number

  type?:
    | "tape"
    | "pants"

  pieces?: number

  nightUseScore?: number

  absorbencyScore?: number

  softnessScore?: number

  thicknessScore?: number

  sensitiveSkinScore?: number
}
```

Laundry detergent:

```typescript
interface LaundryAttributes {
  volumeMl?: number

  machineType?:
    | "front_load"
    | "top_load"
    | "both"

  babySuitable?: boolean

  fragranceLevel?: number

  sensitiveSkinSuitable?: boolean

  estimatedWashes?: number
}
```

---

# 18. NORMALIZED METRICS

Hệ thống phải tính được:

```text
price_per_piece
price_per_ml
price_per_100ml
price_per_wash
price_per_use
discount_percent
```

Ví dụ:

```typescript
pricePerPiece =
offer.price / variant.quantity
```

Điều này rất quan trọng cho recommendation.

---

# 19. MERCHANT MODEL

```typescript
interface Merchant {
  id: string

  name: string

  type:
    | "marketplace"
    | "brand"
    | "affiliate"
    | "supplier"

  domain?: string

  logo?: string

  trustScore?: number

  affiliateProvider?: string
}
```

---

# 20. SHOPPING INTENT MODEL

LLM phải convert conversation thành structured JSON.

Ví dụ user:

> Tôi cần bỉm ban đêm cho bé 10kg, dưới 400k, ưu tiên chống tràn.

Output:

```json
{
  "category": "diapers",
  "user": {
    "child_weight_kg": 10
  },
  "requirements": {
    "night_use": true,
    "leak_protection": "high"
  },
  "constraints": {
    "max_price": 400000
  },
  "preferences": {
    "price": "balanced"
  }
}
```

Schema:

```typescript
interface ShoppingIntent {
  category: string

  requirements: Record<string, unknown>

  constraints: {
    minPrice?: number
    maxPrice?: number
    brands?: string[]
    excludedBrands?: string[]
  }

  preferences: Record<string, unknown>

  missingRequiredFields?: string[]
}
```

---

# 21. AI AGENT ARCHITECTURE

Không dùng một LLM prompt làm tất cả.

Dùng pipeline:

```text
User Message
      ↓
Intent Agent
      ↓
Context Merger
      ↓
Query Planner
      ↓
Product Retrieval
      ↓
Hard Filter
      ↓
Ranking Engine
      ↓
Recommendation Agent
      ↓
Response
```

---

# 22. AGENT 01 — INTENT AGENT

Responsibility:

Chuyển language tự nhiên thành ShoppingIntent.

Input:

```text
User message
Conversation context
```

Output:

```json
ShoppingIntent
```

Agent KHÔNG được recommend sản phẩm.

---

# 23. CONTEXT MERGER

Merge:

```text
Shopping Intent
+
Family Profile
+
Conversation Context
```

Ví dụ user nói:

> Mua bỉm cho Gold.

Family profile:

```text
Gold
10kg
14 tháng
Size L
```

Final intent:

```text
category = diaper
weight = 10kg
size = L
```

---

# 24. QUERY PLANNER

Convert intent thành query database.

Ví dụ:

```text
category = diaper
weight support contains 10kg
availability = in_stock
price <= 400000
```

---

# 25. HARD FILTER

Loại product không hợp requirement.

Ví dụ:

```typescript
if (
  childWeight < product.minWeightKg ||
  childWeight > product.maxWeightKg
) {
  reject()
}
```

Hard constraint examples:

- size
- weight
- price ceiling
- availability
- machine compatibility

---

# 26. RANKING ENGINE

MVP scoring:

```text
Fit                    35%
Quality                20%
Value                  20%
Seller trust           10%
Availability           5%
Delivery               5%
User preference        5%
```

Pseudo:

```typescript
score =
  fitScore * 0.35 +
  qualityScore * 0.20 +
  valueScore * 0.20 +
  sellerTrustScore * 0.10 +
  availabilityScore * 0.05 +
  deliveryScore * 0.05 +
  preferenceScore * 0.05
```

Final:

```text
0 → 100
```

Display:

```text
Family Match: 94%
```

---

# 27. IMPORTANT RANKING RULE

Affiliate commission:

```text
MUST NOT affect recommendationScore
```

Có thể track:

```text
affiliateCommission
expectedRevenue
```

nhưng chỉ dùng analytics/business optimization.

---

# 28. RECOMMENDATION AGENT

Input:

```text
ShoppingIntent
Family context
Top ranked products
Product facts
```

Output:

```text
Summary
Top recommendation
Alternatives
Reason
Tradeoffs
```

Agent chỉ được dùng dữ liệu được cung cấp.

Không được invent:

- price
- reviews
- features
- ingredients
- product claims

---

# 29. RAG RULE

Recommendation Agent không search toàn Internet trong MVP.

Data source:

```text
Internal Product Catalog ONLY
```

Sau này có thể thêm:

```text
External Search
Marketplace APIs
Merchant feeds
Web search
```

---

# 30. DATABASE

Recommended:

```text
PostgreSQL
```

Có thể dùng:

```text
Supabase
```

cho MVP.

Tables:

```text
users

family_profiles
children
household_preferences

categories
products
product_variants

merchants
product_offers

product_attributes

conversations
messages

shopping_intents

recommendation_sessions
recommendation_items

affiliate_clicks

saved_products
```

---

# 31. RECOMMENDATION SESSION

```typescript
interface RecommendationSession {
  id: string

  userId?: string
  conversationId: string

  intent: ShoppingIntent

  candidateCount: number

  resultProductIds: string[]

  createdAt: Date
}
```

---

# 32. RECOMMENDATION ITEM

```typescript
interface RecommendationItem {
  id: string

  sessionId: string
  productId: string

  rank: number

  totalScore: number

  fitScore: number
  qualityScore: number
  valueScore: number

  reason?: string
}
```

Đây là data cực kỳ quan trọng cho evaluation sau này.

---

# 33. AFFILIATE CLICK

```typescript
interface AffiliateClick {
  id: string

  userId?: string

  sessionId?: string

  productId: string

  offerId: string

  merchantId: string

  destinationUrl: string

  createdAt: Date
}
```

---

# 34. CORE API

## AI Shopping

```text
POST /api/chat
```

Input:

```json
{
  "conversationId": "...",
  "message": "Tìm bỉm cho bé 10kg"
}
```

---

## Products

```text
GET /api/products
GET /api/products/:id
```

---

## Search

```text
POST /api/products/search
```

---

## Recommend

```text
POST /api/recommend
```

Input:

```json
{
  "intent": {},
  "familyProfileId": "..."
}
```

---

## Compare

```text
POST /api/compare
```

---

## Family

```text
GET /api/family
PUT /api/family
```

---

## Affiliate redirect

Không expose affiliate URL trực tiếp.

Use:

```text
GET /go/:offerId
```

Backend:

```text
track click
↓
resolve affiliate link
↓
302 redirect
```

---

# 35. FRONTEND ARCHITECTURE

Recommended stack:

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui

PostgreSQL
Supabase

LLM API
```

Application:

```text
/apps/web

/components
/features

  /chat
  /products
  /recommendations
  /compare
  /family

/lib

  /ai
  /ranking
  /catalog
  /analytics
```

---

# 36. AI SERVICE STRUCTURE

```text
/lib/ai

intent.ts

context.ts

recommendation.ts

prompts/
  intent.prompt.ts
  recommendation.prompt.ts
```

Không đặt toàn bộ logic vào API route.

---

# 37. RANKING SERVICE

```text
/lib/ranking

calculateFit.ts

calculateQuality.ts

calculateValue.ts

calculateSellerTrust.ts

calculateTotal.ts
```

Ranking là deterministic code.

Không phải LLM.

---

# 38. PRODUCT SEARCH

MVP chưa cần vector DB.

Use:

```text
Postgres filtering
+
full text search
```

Sau khi catalog >10K SKU mới xem xét:

```text
pgvector
```

---

# 39. PRODUCT INGESTION

MVP support:

```text
CSV import
```

Format:

```text
product_id
name
brand
category

variant
quantity

merchant

price

affiliate_url

attribute_json
```

Admin script:

```text
npm run import-products
```

---

# 40. ADMIN MVP

Không build admin UI.

Manage data bằng:

```text
CSV
+
Supabase
```

Nếu cần chỉnh product:

Supabase dashboard.

---

# 41. ANALYTICS EVENTS

Track:

```text
homepage_view

ai_message_sent

intent_created

recommendation_generated

recommendation_viewed

product_clicked

compare_started

offer_clicked

family_profile_created

family_profile_updated
```

---

# 42. PRIMARY FUNNEL

```text
Visitors

↓

AI started

↓

Recommendation generated

↓

Product clicked

↓

Offer clicked
```

MVP conversion:

```text
AI Session
→ Affiliate Click
```

---

# 43. NORTH STAR METRIC

## Successful Shopping Sessions

MVP proxy:

```text
recommendation session
+
at least one outbound merchant click
```

Sau khi có conversion attribution:

```text
recommendation
→ purchase
```

---

# 44. SECONDARY METRICS

Track:

```text
AI interaction rate

Recommendation generation rate

Recommendation → Product View

Recommendation → Offer Click

Compare usage rate

Family Profile completion

Return users

Recommendation latency
```

---

# 45. AI EVALUATION DATASET

Tạo tối thiểu 50 test cases.

Example:

```text
Baby 8kg
night diaper
budget <350k
```

Expected:

```text
No incompatible weight products

All offers:
<=350k

Recommendation reasons grounded in data
```

---

# 46. EVALUATION DIMENSIONS

```text
Intent Accuracy

Constraint Compliance

Product Fit

Hallucination Rate

Explanation Quality

Recommendation Diversity
```

P0:

```text
Hard constraint compliance = 100%
```

Không được recommend sản phẩm sai size.

---

# 47. UX RULES

AI không được trả response dạng essay dài.

Recommendation response:

```text
Short explanation

Top 3 product cards

Tradeoff summary

Follow-up action
```

Ví dụ:

```text
Dựa trên bé 10kg và nhu cầu dùng ban đêm,
tôi tìm được 3 lựa chọn phù hợp.

[Product cards]

Merries phù hợp hơn nếu ưu tiên chống tràn.
Huggies tiết kiệm hơn khoảng 25%/miếng.
```

---

# 48. TRUST UX

Mỗi recommendation nên support:

```text
Why this?
```

Click sẽ hiển thị:

```text
Matched because

✓ phù hợp cân nặng
✓ dùng ban đêm
✓ trong ngân sách

Tradeoffs

- giá/miếng cao hơn
```

---

# 49. AFFILIATE DISCLOSURE

Hiển thị rõ:

> Family AI có thể nhận hoa hồng khi bạn mua sản phẩm qua một số liên kết. Điều này không ảnh hưởng đến thứ tự đề xuất sản phẩm.

---

# 50. MVP SEED DATA

Target:

```text
300–500 products
```

Không cần lớn hơn.

Ưu tiên:

```text
100 diaper variants

50 wipes

50 laundry

30 bottle cleanser

50 household

remaining categories
```

Ưu tiên dataset sạch.

---

# 51. PRODUCT QUALITY

Một product chỉ publish khi có tối thiểu:

```text
Name

Brand

Category

Image

Variant

Price

Merchant

Affiliate URL

Required category attributes
```

---

# 52. MVP IMPLEMENTATION PLAN

## Milestone 1 — Foundation

Build:

```text
Next.js

Supabase

DB schema

seed products
```

Done khi:

```text
GET /products
```

return data.

---

# 53. Milestone 2 — Product Discovery

Build:

```text
product search

filter

product cards

product details
```

Không AI.

Mục tiêu:

Product catalog hoạt động ổn định trước.

---

# 54. Milestone 3 — Intent Agent

Build:

```text
chat UI

intent extraction

structured JSON
```

Test:

```text
50 prompts
```

---

# 55. Milestone 4 — Recommendation Engine

Build:

```text
hard filter

ranking

Top 3
```

Không cần LLM explanation trước.

---

# 56. Milestone 5 — AI Recommendation

Build:

```text
Recommendation Agent

explanation

tradeoffs
```

---

# 57. Milestone 6 — Family Profile

Build:

```text
Family Profile

Context Merge
```

Test:

```text
“Mua bỉm cho Gold”
```

phải hiểu context.

---

# 58. Milestone 7 — Compare

Build:

```text
Compare selected products

Normalized metrics

AI compare summary
```

---

# 59. Milestone 8 — Affiliate

Build:

```text
/go/:offerId

click tracking

merchant redirect
```

---

# 60. Milestone 9 — Analytics

Build event tracking.

Dashboard ban đầu có thể dùng:

```text
PostHog
```

hoặc analytics khác.

---

# 61. MVP RELEASE CRITERIA

Không release public nếu:

```text
AI hallucinate product facts

AI recommend incompatible size

broken affiliate link > 5%

product pricing stale > threshold

recommendation latency unusable
```

---

# 62. POST-MVP ROADMAP

## Phase 2

```text
Purchase history

Saved products

Price history

Family memory

Better recommendations
```

---

## Phase 3

```text
Consumption Engine

Estimated depletion

Reorder reminder
```

Example:

```text
64 diapers

usage:
5/day

estimated:
12.8 days
```

---

## Phase 4

```text
Direct supplier

Dropshipping

Own checkout
```

Only enable SKU with proven demand.

---

## Phase 5

```text
Auto reorder

Never Run Out
```

---

## Phase 6

```text
Merchant integration

AI Commerce OS
```

---

# 63. FUTURE PURCHASE MODEL

Mỗi product có:

```text
Affiliate Offer
Direct Offer
Supplier Offer
```

Example:

```text
Merries L64

Family AI
359k

TikTok
349k

Shopee
365k
```

Recommendation engine vẫn phải neutral.

---

# 64. FUTURE CONSUMPTION MODEL

```typescript
interface ConsumptionModel {
  familyId: string

  productId: string

  averageUsagePerDay?: number

  lastPurchaseDate?: Date

  quantityPurchased?: number

  estimatedRunOutDate?: Date
}
```

---

# 65. FUTURE COMMERCE INTELLIGENCE

Mỗi interaction tạo data:

```text
Need

Product considered

Product selected

Offer clicked

Purchase

Repeat
```

Đây là foundation để build:

```text
AI Commerce OS
```

cho merchant sau này.

---

# 66. PRODUCT MOAT

Không xem LLM là moat.

Long-term moat gồm:

```text
Family Graph

Product Graph

Purchase Graph

Consumption Graph
```

Kết hợp thành:

```text
Who
needs
what
when
and where to buy.
```

---

# 67. CODING PRINCIPLES

Codex phải ưu tiên:

### Simple

Không over-engineer.

### Modular

AI logic khác commerce logic.

### Deterministic where possible

LLM:

```text
understand
explain
```

Code:

```text
filter
calculate
rank
validate
```

### Observable

Mọi recommendation lưu:

```text
intent

candidate products

scores

result
```

để debug.

---

# 68. SECURITY / DATA

Không lưu:

```text
payment data

medical information

unnecessary child data
```

Family profile data chỉ lưu những thông tin cần cho shopping recommendation.

---

# 69. DEFINITION OF DONE — MVP

Một user mới có thể:

```text
Open website

↓

Ask:
“Tìm bỉm ban đêm cho bé 10kg dưới 400k”

↓

AI understands request

↓

Returns 3 relevant products

↓

Explains recommendation

↓

User compares

↓

Clicks affiliate merchant
```

Nếu flow này chạy tốt, MVP đạt mục tiêu đầu tiên.

---

# 70. FIRST BUILD ORDER FOR CODEX

Codex KHÔNG được build toàn bộ cùng lúc.

Build theo đúng order:

```text
01 Project setup

02 Database schema

03 Seed products

04 Product catalog

05 Product search

06 Chat UI

07 Intent Agent

08 Hard filtering

09 Ranking engine

10 Recommendation UI

11 Recommendation Agent

12 Family Profile

13 Context Merge

14 Compare

15 Affiliate tracking

16 Analytics

17 Evaluation
```

---

# 71. FIRST VERTICAL TO IMPLEMENT

Chỉ implement:

```text
Diapers
```

trước.

Lý do:

- dễ hiểu requirement;
- có size/weight constraint rõ;
- có giá/miếng;
- nhiều brand;
- comparison có giá trị;
- AI recommendation dễ test.

Seed:

```text
50–100 diaper variants
```

Sau khi diaper flow ổn mới mở các category khác.

---

# 72. FIRST DEMO SCENARIO

Family Profile:

```text
Child:
Gold

Weight:
10kg

Age:
14 months

Preference:
Balanced
```

User:

> Tôi cần mua bỉm dùng ban đêm cho Gold, khoảng dưới 400k.

System:

```text
Intent
↓
weight = 10kg

night_use = true

max_price = 400k
```

Return:

```text
1. Product A
Family Match 94%

2. Product B
Family Match 90%

3. Product C
Family Match 84%
```

AI:

> Tôi ưu tiên A vì phù hợp cân nặng hiện tại của Gold và có điểm chống tràn ban đêm tốt hơn. B rẻ hơn khoảng 10% và là lựa chọn cân bằng hơn về giá.

User:

> So sánh A và B.

System render compare.

User click:

```text
Buy on Shopee
```

Track:

```text
affiliate_click
```

Redirect.

---

# 73. INITIAL CODEX TASK

Use this as the first instruction to Codex:

**Goal**

Build the foundation of Family AI, an AI-native shopping assistant for Baby & Family Essentials.

Do not attempt to implement the entire specification at once.

For the first iteration, implement only:

```text
1. Next.js + TypeScript application

2. Supabase/PostgreSQL data layer

3. Product, ProductVariant, Merchant and ProductOffer schema

4. Diaper-specific attributes

5. Seed dataset support

6. Product catalog page

7. Product detail page

8. Product filtering by:
   - weight
   - size
   - maximum price
   - brand

9. Normalized price-per-piece calculation

10. Clean responsive UI foundation
```

Do NOT implement yet:

```text
AI chat

LLM

ranking

family profile

affiliate tracking

payment

checkout
```

Architecture must leave clean boundaries for:

```text
/features/products
/features/chat
/features/recommendations
/features/family

/lib/ai
/lib/ranking
/lib/catalog
```

Before coding:

1. Inspect current repository.
2. Propose the file structure.
3. Identify existing components that should be reused.
4. Create database migration/schema.
5. Implement Milestone 1–2 only.
6. Run lint/typecheck/tests.
7. Report:
   - files changed
   - architecture decisions
   - how to run
   - remaining work

Use mock/seed data where real merchant feeds are not yet available.

Primary principle:

> Build the smallest robust foundation that allows the recommendation engine to be added without rewriting the commerce layer.