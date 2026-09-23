---
phase: 5
title: "Shopping Agent pipeline theo spec v1 §4–12"
status: completed
priority: P1
effort: "1.5w"
dependencies: [1, 2]
---

# Phase 5: Shopping Agent pipeline

## Overview
Tách `api/chat/route.ts` (92 dòng, trộn auth + logic + DB) thành pipeline đúng spec §21: Intent Agent → Context Merger → Query Planner → Retrieval → Hard Filter → Ranking → Recommendation Agent. Dùng profile v2 (sensitivities, brand thích/tránh, delivery preference) trong merge + ranking. Recommendation Agent LLM viết lời giải thích **chỉ từ facts cung cấp**, có validator chống bịa.

## Requirements
- Functional:
  - `ShoppingIntent` chuyển sang **`ShoppingIntentV1`** (spec v1 §7, D13): `intentType` (MVP xử lý `discover`, `compare`, `update_family`, `unknown`; `reorder`/`check_replenishment`/`monthly_basket`/`price_check` trả lời "sắp có"), `householdMemberRef`, `categoryId`, `requiredAttributes`, `constraints {maxTotalPriceVnd, maxUnitPriceVnd, excludedBrands,...}`, `preferences.priority`, `fieldEvidence`, `ambiguity`. Quy tắc hợp nhất §7: tin nhắn hiện tại > hồ sơ xác nhận > suy ra; brand loại = lọc cứng; mâu thuẫn → hỏi. Giá trần không rõ gói hay đơn vị mà kết quả khác đáng kể → hỏi (§11.2). Metadata intent cũ đọc qua `upgradeIntent()`. <!-- Updated: Session 2 - D13 -->
  - Ranking `product_score_v1` (0.40 requirement_fit, 0.20 household_preference_fit, 0.15 evidence_quality, 0.15 value, 0.10 purchase_continuity — continuity = unknown khi chưa có lịch sử mua) + **offer_score_v1 riêng** cho cùng variant (§11); thành phần thiếu dữ liệu = `unknown`, không gán cao. `RecommendationItem` §11.5 (matchedReasons, tradeoffs, failedSoftPreferences, evidenceRefs, scoreVersion).
  - State machine §9 + trace mỗi lượt (bảng `agent_runs`/`agent_events`: bước, thời gian, số ứng viên trước/sau lọc, mã loại, version, lỗi, token) — không lưu prompt chứa dữ liệu cá nhân (§20).
  - Profile đọc từ user hiện tại (ẩn danh hoặc email — D5), route chat bỏ điều kiện chỉ-email.
  - Context Merger: dislikedBrands → `excludedBrands` (hard filter); preferredBrands/currentBrand → preference score; `sensitivities` → requirement `sensitiveSkin`; tuổi tính từ birthDate.
  - Hỏi khi thiếu slot bắt buộc: tối đa 2 câu/lượt, ưu tiên lựa chọn (spec v1 §9); đếm số câu hỏi lại trong hội thoại.
  - Recommendation Agent: input = intent + top N facts; output JSON `{summary, topReason, alternatives:[{productId, reason}], tradeoffs}`; validator: mọi số/giá/thuộc tính nhắc tới phải khớp facts, sai → dùng `explainRecommendations` template hiện có.
  - Lưu session: intent, candidates, **sản phẩm bị loại + lý do**, điểm thành phần, ranking version (MVP_PLAN Mốc 3).
- Non-functional: p95 ≤8s end-to-end; commission không bao giờ vào score (test khẳng định).

## Architecture
```text
lib/ai/shopping/
  intent-agent.ts       // chatJson + rules (intent-rules.ts)
  context-merger.ts     // từ lib/ai/context.ts
  query-planner.ts      // intent → CatalogQuery
  recommendation-agent.ts + fact-guard.ts
lib/catalog/retrieval.ts  // CatalogQuery → products (in-memory nay, SQL sau – giữ interface)
lib/ranking/recommend.ts  // thêm hard filter excludedBrands, preference score brand
app/api/chat/route.ts     // chỉ: auth/rate limit → pipeline → persist
lib/experience/chat-persistence.ts // tách phần ghi Supabase
```

## Related Code Files
- Create: các file trên, `apps/web/tests/{pipeline,fact-guard}.test.ts`
- Modify: `apps/web/src/app/api/chat/route.ts`, `apps/web/src/lib/ai/{intent,context,recommendation}.ts` (di chuyển), `apps/web/src/lib/ranking/recommend.ts`, `apps/web/scripts/evaluate.mjs`
- Có thể cần migration: bảng/ cột `rejected_products jsonb` trên `recommendation_sessions` (backup trước)

## Implementation Steps
1. Tách route thành pipeline không đổi hành vi (test hồi quy hiện có xanh).
1b. Đổi `ShoppingIntent` sang `ShoppingIntentV1` (spec v1 §7) + `upgradeIntent()`; typecheck kéo theo mọi consumer.
2. Mở rộng intent + merger với profile v2; test "Mua bỉm cho Gold" (§57), "tránh Huggies" loại Huggies.
3. Recommendation Agent + fact-guard; test câu bịa giá → bị chặn.
4. Ghi rejected products; cập nhật eval 50 case thêm kiểm tra excludedBrands và số câu hỏi ≤2 mỗi lượt.

## Success Criteria
- [x] Eval 50 case: 100% hard constraint (cân nặng, giá trần, brand tránh, còn hàng) — eval mở rộng 62/62
- [x] 0 claim/giá không có trong facts ở output đã qua fact-guard (test fact-guard + template fallback)
- [x] Route chat mỏng (59 dòng — lệch mục tiêu 40, xem Deviations), logic nằm trong lib có test

## Risk Assessment
- Free-tier model viết tiếng Việt kém/bịa → fact-guard + template fallback; tín hiệu: fact-guard chặn >20% → giữ template làm mặc định, chỉ dùng LLM cho summary ngắn.

## Deviations decided during implementation (2026-09-23, review P5)
- **No separate `query-planner.ts` / `retrieval.ts`:** catalog is in-memory for the MVP; `hardFilter` is the query + filter step. SQL-side retrieval arrives with the real catalog (P6) behind the same `hardFilter` contract.
- **Fact-guard lives in `composer.ts`** (tests in `pipeline.test.ts`), not a separate file.
- **Composer output = `{summary, followUpQuestion}`:** per-item reasons/tradeoffs come from structured ranking data (never LLM text), which is safer than LLM `topReason/alternatives`.
- **`compare` intent:** "so sánh" is routed by `routeWorkspace` to the compare view before extraction (unchanged behaviour); a dedicated compare flow is P7.
- **Trace:** one `agent_runs` row with `steps` jsonb instead of `agent_runs` + `agent_events`; no token counts (the LLM layer doesn't expose usage yet). OFFERS_RESOLVED is folded into RANKED (offers are ranked per variant inside ranking).
- **Price basis (§11.2):** resolved by domain rule instead of a question — amounts ≤20k without "/miếng" are per-piece ceilings (no diaper pack costs <20k).
- **Route ≤40 lines:** 58 lines (auth + quota + persistence call); all logic is in `lib/ai/shopping` + `chat-persistence.ts`.
- **Repeated clarification counter** not implemented; each clarification asks one question with choices. Revisit with real-session data in P8.
- Decisions: when the child is unclear, every child's disliked brands apply; "rẻ hơn khoảng N%" (price comparison) is allowed, only match-score % is banned.

## Completion Notes (2026-09-23)
- Done: `ShoppingIntentV1` types; `lib/ai/shopping/{extract,context-merger,composer,pipeline}.ts`; `ranking/recommend.ts` (hardFilter with per-product reasons, `offer_score_v1`, `product_score_v1` with unknown components, top 3); thin `api/chat` + `chat-persistence.ts`; migration `202609240003_agent_trace.sql`; card shows "Phù hợp với nhu cầu đã nêu"; eval extended.
- Review: BLOCK ×3 (brand negation → preference, pack count as unit price, stale profile size, weak fact-guard, same-name loop, lift regressions incl. ambiguity lost in upgradeIntent round trip) → fixed → APPROVE WITH NITS.
- Verification: tests 76/76, eval 62/62 against server, tsc + eslint + next compile exit 0, runtime 12/12 asserts through route.
- Carry-over to P8 eval: bare budget "300"; identical same-name choice labels when weight/size missing/equal; CLAIMS list growth; fact-guard number semantics; local limiter dev-only.
- Deploy order: backup → 202609240001 → 202609240002 → 202609240003 → code.
