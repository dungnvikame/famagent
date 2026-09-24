# Research: Personalized Shopping Behaviour/Plan (vs generic catalog)

Date 2026-09-24. Scope: pattern-mine products that do personalised shopping well; VN-feasible data capture; consumption benchmarks; plan concepts; pitfalls. No code changes.

## Existing FamAgent infra (reusable, don't rebuild)
`lib/shopping/purchases.ts` already has: `Purchase` records, `estimateStock()` (stock decay model), `runningLow()` (≤7-day reorder window), `defaultDailyRate(ageMonths)` diaper curve, `budgetHint()` linking to ledger budget. `components/shopping/tracking-list.tsx` + `mark-purchased.tsx` feed it. This is the seed of a "usuals" reorder engine — the gap is **breadth of items** (only diapers demoed) and **surfacing as personalized cards**, not catalog browsing. `app/(app)/shopping/page.tsx` tabs (tracking/search/history/saved) are the right shell; "search" tab (generic catalog) is what PO wants demoted/removed.

## 1–2. Patterns from reference products (data → UI → friction → automation)

| Product | Personal data used | Key UI pattern | User friction | Automated part |
|---|---|---|---|---|
| **Amazon Buy Again / Favorite Reorders** [aboutamazon.com](https://www.aboutamazon.com/news/retail/amazon-shopping-features-rufus-lens), [convenience.org](https://www.convenience.org/stay-current/news/2023/october/11/5-new-amazon-feature_tech) | Full order history | "Buy Again" tab, card grid of past items w/ 1-tap reorder, heart to pin favorites | None — just tap | Surfacing + reorder button |
| **Amazon Subscribe & Save** [amazon.com help](https://www.amazon.com/gp/help/customer/display.html?nodeId=GZDA8GUKHLZALJJL) | Chosen interval | Recurring calendar-style schedule | User picks interval upfront | Auto-ships on cadence |
| **Instacart Smart Shop / "usuals"** [instacart.com](https://www.instacart.com/company/updates/introducing-smart-shop-personalization/), [modernretail.co](https://www.modernretail.co/technology/instacart-launches-custom-ai-assistants-for-retailers-and-its-own/) | Order history + declared household context (has baby/toddler/pet) + chat intent ("restock my usuals") | Chat → generated cart; affinity-based product ranking | Declare household facts once | NLU turns fuzzy request into itemized cart |
| **Shopee "Mua lại"** [ai-hay.vn](https://ai-hay.vn/shopee-lam-sao-de-mua-lai-mon-hang-yeu-thich-da-tung-dat-pN1UmH5WsbG), [quantrimang.com](https://quantrimang.com/cong-nghe/huong-dan-kiem-tra-lich-su-mua-hang-tren-shopee-202251) | Order history | Order-history list + "mua lại" button per order | None | 1-tap re-purchase; also used for budget reconciliation |
| **Huckleberry baby tracker** [huckleberrycare.com](https://huckleberrycare.com/blog/how-to-use-a-baby-tracker-to-support-your-routine), [apps.apple.com](https://apps.apple.com/us/app/huckleberry-baby-tracker/id1169136078) | Manual one-tap logs (diaper/feed/sleep) | One-touch tracker, customizable home screen, multi-caregiver sync | Manual per-event logging (high) | Trend charts from logs |
| **Babylist checklist/registry** [babylist.com](https://www.babylist.com/baby-registry-checklist) | Baby's age/stage (declared) | Interactive stage checklist ("newborn" → "3–6mo" → "6–12mo") with progress bar | Declare stage once, check off items | Age-gated item suggestions |
| **CamelCamelCamel / Keepa** [camelcamelcamel.com/features](https://camelcamelcamel.com/features), [revenuegeeks.com](https://revenuegeeks.com/compare/keepa-vs-camelcamelcamel) | Watched product + target price | Price-history line chart (30d/90d/all, high/low/avg markers) + email alert | Paste product link once | Price scraping + threshold email, no account needed |
| **Pantry apps (NoWaste, Out of Milk)** [recipyapp.com](https://recipyapp.com/blog/best-pantry-tracking-apps-2026), [Play Store NoWaste.ai](https://play.google.com/store/apps/details?id=com.nowaste.ai&hl=en_US) | Manual/barcode/receipt-scan inventory | Inventory list, expiry countdown | Manual entry is the #1 churn driver — "death spiral": 40 items day 1, drifts out of sync by week 3 [recipyapp.com](https://recipyapp.com/blog/best-pantry-tracking-apps-2026) | Newer versions add AI receipt OCR to rebuild inventory automatically |

## 3. VN-feasible data capture (no marketplace API access)

| Method | Feasibility | Accuracy/cost note |
|---|---|---|
| **Chat parsing** ("mua 2 bịch bỉm 350k ở Shopee") | High — FamAgent already has `lib/ai/shopping/pipeline.ts` chat→purchase pipeline; extend entity extraction | Cheapest, no OCR; relies on user typing, same friction as manual pantry entry — mitigate with quick-reply templates |
| **Order-confirmation email forwarding** (Shopee/Lazada/Tiki send these) | Medium — needs inbound email address + parser per template; templates change over time | Structured HTML, high accuracy once parsed; brittle to template changes |
| **Receipt/order-page screenshot OCR (Gemini Flash vision)** | Medium-high | Gemini 2.0 Flash-Lite ~$13.50/100K clean pages [aicostcheck.com](https://aicostcheck.com/blog/ai-ocr-document-processing-costs-2026); Gemini "Flash" generalist OCR ~87% accuracy on benchmarks [roboflow.com](https://playground.roboflow.com/models/google/gemini-3-8-flash) — good enough for line-item extraction w/ human confirm step, not for unattended posting |
| **E-invoice (hóa đơn điện tử) email** | Medium — VN law requires e-invoices from many retailers; XML/PDF structured, more reliable than screenshot OCR, but format varies by issuer | Higher accuracy than OCR if parseable |
| **Paste product link** | High, simple | No purchase amount without user typing it too; good for wishlist/price-watch use case (Keepa-style), not purchase logging |
| **Bank transaction notes** | Already likely feeding ledger (Money module) | Merchant name only, no product/quantity — good for spend totals, useless for consumption estimate |
| **Voice** | Low priority, same NLU pipeline as chat once transcribed | Adds STT cost/latency, marginal gain over typed chat |

Ranked by effort/value: **chat parsing (extend existing pipeline) > OCR of screenshots (confirm-before-save) > email forwarding > e-invoice > link paste (for price-watch only)**. Voice/bank-notes are lower priority.

## 4. Baby consumables benchmarks (0–3)

- **Diapers/day** (already coded, matches sources): NB/0–3mo ~8–12 [pampers.com](https://www.pampers.com/en-us/baby/diapering/article/how-many-diapers-a-day), 3–6mo ~10–14 dropping toward 6–8 by 9–12mo [sleepybaby.com](https://www.sleepybaby.com/blogs/our-blog/the-daily-diaper-dilemma-how-many-diapers-per-day), 12mo+ ~8–10 trending down further by 24mo. FamAgent's current curve (9/8/6/5/4 by age band) is directionally consistent — reasonable, keep.
- **Size transitions**: driven by weight, not age — Huggies has a weight→size chart [huggies.com](https://www.huggies.com/en-us/resources/parenting/everyday-diaper-tips/diaper-size-calculator) (unverified exact kg cutoffs, should pull at implementation time). Family already provides child weight in Shopping filters — reusable signal to predict "sắp đổi size" nudge.
- **Wipes**: NHS recommends cotton wool + water for month 1, wipes after [nhs-sourced via search summary] (unverified — not independently confirmed on nhs.uk directly, mark unverified).
- **Formula**: AAP rule of thumb ≈ 150 ml/kg/day, capped ~32 oz/day; newborn ~45–90 ml per feed q2–3h rising to 180–240 ml q4–5h by 6mo [healthychildren.org / kidshealth.org summarized](https://www.healthychildren.org/English/ages-stages/baby/formula-feeding/Pages/amount-and-schedule-of-formula-feedings.aspx). No WHO-specific figure surfaced in search — cite AAP, mark WHO gap as unresolved.
- Confidence: diaper/day figures cross-referenced across 3 sources (Pampers, SleepyBaby, BumpBites/FirstCry) — solid. Formula figures from 2 sources agreeing — solid. Wipes claim single-source — flag unverified.

## 5. "Shopping plan" concepts

- **Stage-based upcoming needs**: size L→XL by weight trigger, starting solids ~6mo (high chair, bottles→cups), car seat stage upgrade by weight/age — same pattern as Babylist's stage checklist, gated on child's age/weight already in FamAgent's child profile.
- **VN sale calendar**: recurring monthly double-date sales (1/1…12/12), mid-month (~15th) and payday (~25th) promos, three peak events 9.9/11.11/12.12, plus Tết (lunar, Jan/Feb) as a stock-up trigger for household goods [khuyenmaidacbiet.com](https://khuyenmaidacbiet.com/landing-page/lich-sale-shopee-tiktok-shop-2026-day-du), [janio.asia](https://www.janio.asia/resources/articles/major-e-commerce-shopping-events-vietnam) — usable as a "mua trước ngày sale X, tiết kiệm ước tính" nudge tied to running-low items.
- **Bulk vs unit price / stock-up timing vs cash flow**: no single named product does this well for baby specifically (gap/opportunity) — combine existing `budgetHint()` (ledger-aware) with runs-out date + next sale date to recommend buy-now vs wait-for-sale.

## 6. Pitfalls
- **Manual-entry death spiral** is the #1 churn cause in every pantry/inventory app studied — any FamAgent design that requires typing every purchase will decay in ~3 weeks [recipyapp.com](https://recipyapp.com/blog/best-pantry-tracking-apps-2026). Must lean on chat (already low-friction, part of core UX) + OCR-with-confirm, not a dedicated "add item" form.
- **Privacy**: parsing order-confirmation emails/screenshots means handling PII (address, phone) inside receipts — needs redaction/no-persist-of-raw-image policy (unresolved — no dedicated source found, general inference).
- **Trust in AI recommendations**: Instacart/Amazon reduce trust risk by only ever suggesting from the user's own history (not novel products) — FamAgent should do the same: never "recommend a new brand," only reflect back the family's own pattern + flag when it deviates from benchmark (e.g., "bé dùng bỉm nhanh hơn mức trung bình 20%").

## Patterns ranked by value/effort for FamAgent

| # | Pattern | Value | Effort | Why |
|---|---|---|---|---|
| 1 | Chat-based purchase logging (extend existing pipeline to more product types) | High | Low | Infra exists; zero new UI; kills catalog-browsing complaint directly |
| 2 | "Đang theo dõi" running-low cards (stock decay, reorder nudge) | High | Low | Already built (`estimateStock`/`runningLow`); just needs broader item coverage + prominent placement as default tab |
| 3 | Spend-by-category / month view tied to ledger | High | Low | Ledger integration exists (`transactionForPurchase`) |
| 4 | Order-history "mua lại" quick action (from FamAgent's own purchase log, not marketplace) | Med-High | Low | Pure UI on existing `Purchase` records |
| 5 | Receipt/screenshot OCR capture (Gemini Flash, confirm-before-save) | High | Med | Solves manual-entry death spiral for non-chat users |
| 6 | Stage-based upcoming-needs checklist (weight→size, 6mo solids, car seat) | Med | Med | Needs a benchmark table + child profile hooks |
| 7 | Price-watch on pasted product links (Keepa-style chart) | Low-Med | Med | Nice but not core to "our behaviour" framing; scope-creep risk |
| 8 | VN sale-calendar-aware "wait or buy now" nudge | Med | Med | Combine running-low + budgetHint + sale dates |
| 9 | Consumption vs benchmark comparison ("bé dùng nhanh hơn TB X%") | Med | Low | Pure derived stat from existing daily-rate data |
| 10 | Email/e-invoice forwarding capture | Med | High | Parser-per-template maintenance burden |
| 11 | Voice capture | Low | High | Marginal gain over chat |
| 12 | Bulk-vs-unit-price optimizer | Low | Med | No baby-specific precedent found; speculative |

## 8–12 most valuable personalized shopping-page cards (recommend building these, not a catalog)

1. **"Sắp hết" (running low)** — item, days left, runs-out date, 1-tap "đã mua" — reuses `estimateStock`.
2. **Chi tiêu mua sắm theo tháng** — spend-by-category bar/line, sourced from ledger `source: "purchase"` entries.
3. **Mua lại nhanh (Buy Again)** — cards of past purchases, 1-tap re-log (not re-order via affiliate).
4. **Lịch sử mua (timeline)** — chronological purchase log, filterable by child/category.
5. **So với mức trung bình** — this child's diaper/day (or other rate) vs. age-benchmark curve, flags anomaly.
6. **Sắp đổi size / lên giai đoạn mới** — weight-triggered size change or age-triggered stage need (solids, car seat) — needs benchmark table (§4) wired to child profile.
7. **Gợi ý thời điểm mua** — "còn X ngày, đợt sale 9.9 còn Y ngày" combining running-low + VN sale calendar.
8. **Ngân sách còn lại cho Con tháng này** — reuse `budgetHint()`, shown before logging a new purchase.
9. **Đã lưu / theo dõi giá** (optional, lower priority) — pasted-link price watch, Keepa-style mini chart.
10. **Ghi chi tiêu qua chat** — prominent chat entry point/prompt examples ("mua 2 bịch bỉm 350k ở Shopee"), the primary capture surface.
11. **Chụp hóa đơn** — camera/upload → OCR → confirm screen, secondary capture surface.
12. **Nhắc theo mùa/giai đoạn** — proactive card surfaced on Home/Shopping when a stage transition or sale window is near (ties 6+7 into a single "Home brief"-style nudge, consistent with existing family-brief pattern).

## Unresolved questions
- Exact weight-kg cutoffs per diaper size (Huggies chart) not pulled in detail — verify at implementation.
- WHO-specific (vs AAP) formula-volume guideline not found — only AAP/HealthyChildren sourced.
- NHS wipes-after-month-1 claim is single-source (search-summarized, not directly fetched from nhs.uk) — verify before citing to users.
- No direct source found for pantry-app privacy backlash specifics — inference from general OCR/PII risk, not a cited incident.
- Bulk-vs-unit-price decision support has no strong baby-specific product precedent — treat as FamAgent-original feature, lower confidence on demand.
