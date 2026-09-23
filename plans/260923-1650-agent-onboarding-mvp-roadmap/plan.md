---
title: "Agent onboarding + lộ trình hoàn thiện MVP Family AI"
description: "Thay onboarding 2 bước bằng agent thu thập bối cảnh gia đình đầy đủ (spec §12–13), dùng LLM free-tier qua adapter chung, rồi đi hết các mốc tới MVP release (spec §52–61, §69)."
status: in-progress
priority: P1
effort: "~7–8 tuần"
tags: [onboarding, agent, llm, mvp, roadmap]
created: 2026-09-23
blockedBy: []
blocks: []
---

# Agent onboarding + lộ trình hoàn thiện MVP

## Overview

Spec nguồn: [SOURCE_SPEC.md](../../docs/SOURCE_SPEC.md) (MVP) + [SPEC_V1_PURCHASING_AGENT.md](../../docs/SPEC_V1_PURCHASING_AGENT.md) (định hướng Household Purchasing Agent, nhận 23/09 — thắng khi mâu thuẫn).

Hiện trạng (scout 23/09): trang chủ `/` render `AgentOnboarding` — chat cứng 2 bước (`child` → `preferences` → `review`), parse bằng regex, **AI bị tắt trước khi đăng nhập** (`api/onboarding/route.ts` ép `aiConsent:false` khi có Supabase). Chỉ thu cân nặng/tuổi/size/tên bé đầu tiên + 1 concern + ngân sách. Thiếu phần lớn Family Profile theo spec §12–13 (số người lớn, nhiều bé, ngày sinh, da nhạy cảm, thương hiệu thích/tránh, ưu tiên giao hàng, máy giặt).

Hai component **không được import ở đâu** (dead code): `components/onboarding-flow.tsx`, `components/shopping-experience.tsx`. Live: `agent-onboarding.tsx` (`/`), `agent-shopping.tsx` (`/shop`).

Mục tiêu: onboarding là **agent hội thoại thật** — LLM hiểu câu tự nhiên, tự chọn câu hỏi tiếp theo dựa trên slot còn thiếu, xác nhận lại, cho bỏ qua/sửa; code quyết định slot nào bắt buộc, validate và lưu. Chi phí 0đ giai đoạn test thị trường: adapter OpenAI-compatible trỏ tới free tier (Gemini / Groq / OpenRouter free), fallback rules khi hết quota.

## Quyết định đã chốt (với user, 23/09)

| # | Quyết định |
|---|---|
| D1 | Onboarding dùng LLM ngay cả khi chưa đăng nhập, có rate limit guest; thiếu key/không đồng ý/lỗi → rules |
| D2 | Thu thập đủ spec §12–13; **bắt buộc tối thiểu**: cân nặng HOẶC size của ≥1 bé. Còn lại bỏ qua được |
| D3 | Chưa có ngân sách AI → provider free-tier qua adapter chung, chuyển provider bằng env; nâng cấp trả phí khi có tín hiệu thị trường |
| D4 | Plan chi tiết cho onboarding (P1–P4), roadmap tới MVP release (P5–P8) |
| D5 | Guest = **Supabase anonymous sign-in**; rate limit tái dùng `api_request_limits` (thêm endpoint `onboarding`); không có Supabase → in-memory |
| D6 | Sau onboarding vào thẳng `/shop` ẩn danh; mời liên kết email sau (sau gợi ý đầu tiên / khi lưu sản phẩm / đổi thiết bị) |
| D7 | Provider: Gemini Flash chính, Groq dự phòng, rồi rules |
| D8 | ~~dạng lồng spec §20~~ → **thay bởi D13**: `ShoppingIntentV1` theo [spec v1 §7](../../docs/SPEC_V1_PURCHASING_AGENT.md) trong P5 |
| D9 | Duyệt mockup HTML onboarding trước khi code UI (P4) |
| D10 | `git init` + commit baseline ở đầu P1; `experience.css` giữ file, chỉ xóa selector chết |
| D11 | Family Memory (spec v1 §6.1): P2 lưu lớp **hồ sơ/sở thích đã xác nhận** (cột hiện có) + `field_meta` jsonb (source, observedAt, confirmedAt) mỗi trường. Quan sát tạm/dữ liệu suy ra (`family_facts`) làm cùng plan Mua lại |
| D12 | MVP giữ 1 user = 1 household (`family_profiles` đóng vai household); households/members/permissions (spec v1 §16) khi cần chia sẻ |
| D13 | P3–P8 theo spec v1: `ShoppingIntentV1`, `product_score_v1` + xếp hạng offer riêng, tối đa 2 câu hỏi/lượt, trace mỗi lượt, offer snapshot, không hiện "94%". Lịch sử mua / consumption / nhắc mua / giỏ tháng = **plan riêng sau MVP release** |
| D14 | Câu mơ hồ ("chắc tầm 10kg") → agent hỏi xác nhận ngay bằng chip [Đúng] [Sửa]; chỉ ghi hồ sơ khi xác nhận (spec v1 §3) |

## Phases

| # | Phase | Status | Effort | Depends |
|---|-------|--------|--------|---------|
| 1 | [Dọn dead code + LLM adapter free-tier](./phase-01-cleanup-and-llm-adapter.md) | Completed | 1.5d | – |
| 2 | [Family Profile model đầy đủ (§13)](./phase-02-family-profile-model.md) | Completed | 1.5d | – |
| 3 | [Onboarding Agent core (slot-filling)](./phase-03-onboarding-agent-core.md) | Completed | 3d | 1, 2 |
| 4 | [Onboarding Agent UI](./phase-04-onboarding-agent-ui.md) | Completed | 2.5d | 3 |
| 5 | [Shopping Agent pipeline theo §21–28](./phase-05-shopping-agent-pipeline.md) | Pending | 1.5w | 1, 2 |
| 6 | [Catalog bỉm đã xác minh](./phase-06-verified-diaper-catalog.md) | Pending | 1–2w (ops song song) | – |
| 7 | [Compare, trust UX, affiliate, analytics](./phase-07-compare-affiliate-analytics.md) | Pending | 1.5w | 5, 6 |
| 8 | [Đánh giá, staging, release](./phase-08-evaluation-and-release.md) | Pending | 1.5w | 4, 7 |

Song song được: P1 ∥ P2 ∥ P6 (P6 chủ yếu là data ops). P5 bắt đầu sau P1+P2, chạy song song P3–P4.

```text
P1 ─┬─> P3 ──> P4 ─────────────┐
P2 ─┤                          ├─> P8 (release)
    └─> P5 ──┐                 │
P6 ─────────┴─> P7 ────────────┘
```

## Kiến trúc agent (tổng)

```text
Onboarding:  user msg → OnboardingAgent(LLM: extract slots + propose reply)
                     → code: validate/merge slots → completeness → next slot
                     → reply (LLM wording, hoặc template rules) + quick-replies
Shopping:    user msg → IntentAgent → ContextMerger(profile+history)
                     → QueryPlanner → Retrieval → HardFilter → Ranking(code)
                     → RecommendationAgent(LLM, chỉ facts đã cung cấp) → response
LLM layer:   lib/ai/llm/ — chatJson(schema) qua OpenAI-compatible /chat/completions
             provider chain từ env: primary → secondary → null (rules)
```

LLM chỉ **hiểu và diễn đạt**; code quyết định slot bắt buộc, lọc, xếp hạng, validate (spec §67, PRODUCT.md §5).

## Success Criteria

- [x] Không còn component chết; lint/typecheck/test/build xanh
- [ ] Người dùng mới hoàn tất onboarding ≤2 phút (MVP_PLAN Mốc 1), trả lời bằng câu tự nhiên nhiều ý trong 1 lượt ("Nhà mình 2 vợ chồng, bé Gold 14 tháng 10kg dùng size L, da hơi nhạy cảm") được ghi nhận đủ
- [x] Agent không đoán thông tin trẻ; mọi slot có thể bỏ qua trừ cân nặng/size; xem lại + sửa + xóa được (P3–P4)
- [x] `/shop` câu đầu "Mua bỉm ban đêm cho Gold dưới 400k" dùng đúng profile (spec §57, §72) — kiểm tra trên browser P4
- [ ] Chạy được với 0đ chi phí AI (free tier) và vẫn chạy khi hết quota (rules)
- [ ] Đạt điều kiện phát hành MVP_PLAN §4 (100% hard constraint, không claim thiếu nguồn, p95 ≤8s, link lỗi ≤5%)

## Rủi ro chính

| Rủi ro | Giảm thiểu |
|---|---|
| Free tier: quota thấp, điều khoản có thể dùng dữ liệu để cải thiện model | Provider chain + rules fallback; tối thiểu PII gửi đi (không gửi tên bé nếu có thể thay bằng placeholder), consent nói rõ; chuyển paid trước public launch |
| LLM free trả JSON sai schema | Validate bằng code, retry 1 lần, rơi về rules |
| Chưa có dữ liệu merchant thật (P6) chặn release | P6 chạy song song từ đầu; release gate cứng |

## Unresolved Questions

1. Điều khoản free tier (đặc biệt việc dùng dữ liệu để train) chấp nhận được cho giai đoạn test kín? Cần xác minh trang điều khoản hiện hành của từng provider trước khi bật.
2. Ai phụ trách nguồn dữ liệu bỉm/merchant feed (P6)? Chưa có owner.
3. Có Supabase project dev/staging chưa? P2/P8 cần (và phải bật Anonymous Sign-ins — D5).
4. Plan Mua lại/Consumption/Giỏ tháng (spec v1 Phase 2–4) tạo sau khi MVP đạt release gate.

## Validation Log

### Session 1 — 2026-09-23
7 câu hỏi, 2 lượt. Quyết định D5–D10 ở bảng trên.

| Câu hỏi | Trả lời | Ảnh hưởng |
|---|---|---|
| Guest rate limit (kiểm chứng thất bại) | Anonymous sign-in | P2 migration, P3, P4, P8 |
| `experience.css` dùng chung | Chỉ xóa selector chết | P1 |
| Provider chính | Gemini → Groq → rules | P1 |
| Intent schema | Dạng lồng §20 (sau đó thay bởi D13 — ShoppingIntentV1) | P5 |
| Bắt đăng nhập sau onboarding | Không; mời liên kết email sau | P4, P7 |
| Wireframe trước UI | Có, mockup HTML | P4 |
| Git | init + baseline ở P1 | P1 |

### Verification Results
- Claims checked: 18 (paths, symbols, schema, CSS usage)
- Verified: 16 | Failed: 2 | Unverified: 0
- Tier: Full (8 phases, sampled — plan mostly roadmap for P5–P8)
- Failures (đã sửa qua interview):
  1. `supabase/migrations/202609230003_account_api.sql:23-33` — `api_request_limits.user_id not null` FK auth.users, `endpoint in ('chat')`, RLS authenticated → không dùng cho guest như P3 viết → D5.
  2. `apps/web/src/app/experience.css` — ~30 class dùng bởi /family, /compare, /saved, sign-in → không xóa file được (P1 viết "xóa file nếu rỗng") → D10.
- Verified mẫu: `children.age_months` và `family_profiles.onboarded_at` đã có (0003:1,3); `price_preference` check chỉ budget/balanced/premium (0002:7) → P2 phải nới; `RANKING_VERSION`, `recommend`, `extractIntent`, `explainRecommendations`, `parseProfileChange` tồn tại; `api/events/route.ts`, `go/[offerId]` tồn tại; không có `commission` trong `lib/`.

### Session 2 — 2026-09-23 (spec v1)
4 câu hỏi → D11–D14. D8 bị thay. Ảnh hưởng: P2 (field_meta), P3 (xác nhận, ≤2 câu/lượt), P5 (intent V1, ranking v1, 2 cấp, trace), P7 (không %, offer snapshot, asOf), P8 (eval §21, cách ly household).

### Whole-Plan Consistency Sweep
- Đã rà plan.md + 8 phase: thay "xóa experience.css", "api_request_limits với key ẩn danh", redirect `/sign-in` sau onboarding, `ShoppingIntent` phẳng, `pending-import` trong luồng cloud. Bỏ câu hỏi mở về git.
- Mâu thuẫn còn lại: 0.
