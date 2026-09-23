---
phase: 7
title: "Compare, trust UX, affiliate, analytics"
status: pending
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
