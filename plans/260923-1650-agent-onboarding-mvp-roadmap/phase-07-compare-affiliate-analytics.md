---
phase: 7
title: "Compare, trust UX, affiliate, analytics"
status: completed (engineering)
priority: P2
effort: "1.5w"
dependencies: [5, 6]
---

# Phase 7: Compare, trust UX, affiliate, analytics

## Overview
Hoàn thiện phần sau gợi ý theo spec §10–11, §33, §41–49: card gợi ý đủ trường, "Why this?", so sánh cùng variant/offer có AI summary, redirect affiliate thật, disclosure, funnel analytics + dashboard tối thiểu.

## Requirements
- Functional:
  - Card: **không hiển thị %** — dùng "Phù hợp với nhu cầu đã nêu" (spec v1 §11.5); giá kèm thời điểm cập nhật; offer cũ → ẩn nút mua; thiếu phí giao → "giá sản phẩm, chưa gồm phí giao" (§8, §12). <!-- Updated: Session 2 - D13 -->
  - Card §10 (spec MVP, trừ %): ảnh, brand, tên, 3 lý do, giá, giá/miếng, nơi bán, [So sánh] [Chi tiết] [Mua]; top card nhãn "Phù hợp nhất" (không "tốt nhất").
  - "Why this?" §48: Matched because ✓ / Tradeoffs.
  - Offer snapshot lưu giá đã thấy lúc đề xuất (`offer_snapshots`, spec v1 §16), không ghi đè bằng giá mới.
  - `/compare?products=` §11: giá, giá/miếng, cân nặng, ban đêm, độ dày, seller rating; thiếu → "Chưa có thông tin"; AI summary 1–2 câu qua fact-guard (P5).
  - `/go/:offerId`: HTTPS + domain allowlist + ghi `affiliate_clicks` + redirect; URL affiliate không có trong API public.
  - Disclosure §49 ở card/compare/footer.
  - Events §41 đủ + onboarding events (P4); funnel §42: homepage_view → onboarding_completed → ai_message_sent → recommendation_generated → product_clicked/compare_started → offer_clicked.
  - Dashboard: SQL views trên Supabase (funnel theo ngày, tỷ lệ không có kết quả, latency p95) — xem qua Supabase dashboard, chưa build UI admin.
- Non-functional: event ghi không chặn UI (keepalive, đã có).

## Related Code Files
- Modify: `apps/web/src/components/product-card.tsx`, `apps/web/src/app/compare/page.tsx`, `apps/web/src/app/go/[offerId]/route.ts`, `apps/web/src/components/agent-shopping.tsx`, `apps/web/src/app/api/events/route.ts`
- Create: `supabase/migrations/2026xxxx_analytics_views.sql`, `apps/web/tests/redirect.test.ts`

## Implementation Steps
1. Card + Why this? + disclosure.
2. Compare với cùng variant/offer + summary.
3. Redirect: test domain lạ, http, offer không tồn tại → 404/đích an toàn.
4. Event names chuẩn hóa theo §41; views funnel.

## Success Criteria
- [ ] Kịch bản §72 chạy trọn: gợi ý → so sánh A/B → Buy → click được ghi → redirect đúng
- [ ] Mỗi bước funnel có event đếm được trong view
- [ ] Không có URL merchant trong response `/api/products*`

## Risk Assessment
- Chưa có affiliate program → redirect tới URL gốc merchant đã duyệt, vẫn ghi click; disclosure vẫn hiển thị.

## Completion notes (2026-09-23)
Done:
- `components/recommendation-card.tsx`: image, brand, name, "Phù hợp với nhu cầu đã nêu" (no %), 3 reasons, price + per-piece, merchant, price time, "chưa gồm phí giao"; "Vì sao gợi ý này?" (Khớp vì / Đánh đổi incl. failed soft preferences); CTA hidden when the price is >48h old or the offer left the current catalog (live offer preferred over the stored conversation copy); `offer_clicked`.
- Compare selection bar in `/shop` → `/compare?items=product:variant:offer` compares exactly the recommended variant/offer (legacy `products=` still works); rows incl. absorbency/thickness/seller rating with "Chưa có thông tin"; template summary from facts, AI wording via `POST /api/compare` only with consent + `compare` quota and only if `passesFactGuard` (ordered=false).
- `lib/catalog/offer-status.ts`: `isOfferFresh`, ICU-independent `priceTimeLabel`, pure `decideRedirect`; `/go` sends stale offers to the product page (`?price=stale` notice).
- Disclosure (spec §49) under recommendations, compare, product page, footer (`AFFILIATE_DISCLOSURE`).
- Events allowlist incl. onboarding events, `product_saved`, `product_compared`; saving no longer counts as `product_clicked`.
- Migration `202609240005`: `offer_snapshots` written only via SECURITY DEFINER `record_offer_snapshots` (values copied from `product_offers`), `compare` quota, dashboard views (funnel, no-result rate, agent latency p50/p95, affiliate clicks) with `security_invoker` and revoked from app roles.
- Fix found during browser check: local-mode `/` ↔ `/shop` redirect loop when the gate cookie expired but localStorage kept the profile.
- Tests: `tests/compare-redirect.test.ts`.

Deviations: no separate `tests/redirect.test.ts` (merged into compare-redirect); compare page /go links carry no `?session` (no conversation context there).

Open until Supabase exists: success criteria "click recorded + redirect" and "funnel counts in views" need a real project (P8 staging).
