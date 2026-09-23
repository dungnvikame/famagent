---
phase: 1
title: "Dọn dead code + LLM adapter free-tier"
status: completed
priority: P1
effort: "1.5d"
dependencies: []
---

# Phase 1: Dọn dead code + LLM adapter free-tier

## Overview
Xóa 2 component không dùng và CSS chỉ phục vụ chúng. Thay `lib/ai/openai.ts` (gắn cứng OpenAI Responses API) bằng lớp LLM provider-agnostic dùng chuẩn OpenAI-compatible `/chat/completions`, để chạy free tier (Gemini, Groq, OpenRouter `:free`) và đổi provider chỉ bằng env.

## Requirements
- Functional:
  - Xóa `components/onboarding-flow.tsx`, `components/shopping-experience.tsx`.
  - `git init` + `.gitignore` (kiểm tra có `.env*.local`, `.pnpm-store`, `.next`, `node_modules`, `*.tsbuildinfo`) + commit baseline trước mọi thay đổi. <!-- Updated: Validation Session 1 - D10 git -->
  - Xóa selector CSS trong `app/experience.css` chỉ dùng bởi 2 file trên (vd `.onboarding-shell`, `.onboarding-intro*`). **Giữ file** — ~30 class còn dùng bởi /family, /compare, /saved, sign-in. <!-- Updated: Validation Session 1 - D10 CSS -->
  - Thứ tự provider mặc định: `LLM_PROVIDERS=gemini,groq` (D7).
  - `chatJson<T>({ system, messages, schema, name })` trả `T | null`; provider chain thử lần lượt, lỗi/timeout/429 → provider kế tiếp → `null` (caller dùng rules).
  - Env: `LLM_PROVIDERS=gemini,groq` + mỗi provider `*_API_KEY`, `*_MODEL`, `*_BASE_URL` (có default). `AI_ENABLED=true` vẫn là công tắc tổng.
- Non-functional: server-only (không lộ key), timeout 9s tổng, log provider + latency + fail reason (không log nội dung người dùng).

## Architecture
```text
lib/ai/llm/
  providers.ts   // đọc env → [{name, baseUrl, apiKey, model, supportsJsonSchema}]
  chat-json.ts   // POST {baseUrl}/chat/completions, response_format json_schema
                 //   hoặc json_object + schema trong system prompt nếu provider không hỗ trợ
                 // parse → validate bằng validator truyền vào → retry 1 lần → next provider
  index.ts       // export chatJson, isAiConfigured
```
Default base URL (xác minh lại docs trước khi code):
- Gemini OpenAI-compatible: `https://generativelanguage.googleapis.com/v1beta/openai/`
- Groq: `https://api.groq.com/openai/v1`
- OpenRouter: `https://openrouter.ai/api/v1`

Giữ chữ ký cũ `structuredOutput()` làm wrapper mỏng trong giai đoạn chuyển (intent.ts, onboarding.ts đang gọi), xóa khi P3/P5 xong.

## Related Code Files
- Delete: `apps/web/src/components/onboarding-flow.tsx`, `apps/web/src/components/shopping-experience.tsx`
- Create: `.git/` (init), kiểm tra `.gitignore`
- Modify: `apps/web/src/app/experience.css` (chỉ xóa selector chết)
- Create: `apps/web/src/lib/ai/llm/{providers,chat-json,index}.ts`, `apps/web/tests/llm.test.ts`
- Modify: `apps/web/src/lib/ai/openai.ts` → wrapper hoặc delete; `apps/web/.env.example`; `README.md` (mục cấu hình AI); `docs/TECH_DECISIONS.md`

## Implementation Steps
0. `git init`, rà `.gitignore`, `git add -A && git commit` baseline.
1. `grep` từng class trong `experience.css` trên toàn `src/`; xóa class chỉ xuất hiện ở 2 component chết. Xóa 2 component.
2. Viết `providers.ts` (parse env, bỏ provider thiếu key).
3. Viết `chat-json.ts` với `fetch` + `AbortSignal.timeout`, xử lý 429/5xx → next provider; JSON parse lỗi → retry 1 lần với nhắc "chỉ trả JSON".
4. Test với fetch mock: provider 1 lỗi → provider 2; JSON hỏng → null; không có provider → null.
5. Cập nhật `.env.example`, README, TECH_DECISIONS (ghi quyết định D3 + điều kiện chuyển sang paid).
6. Tạo key free-tier Gemini (Google AI Studio) và Groq để test tay.

## Success Criteria
- [x] `grep -r "OnboardingFlow\|ShoppingExperience" src` rỗng; `pnpm lint typecheck test build` xanh
- [x] Đổi `LLM_PROVIDERS` không cần sửa code; tắt mạng → app vẫn chạy bằng rules
- [x] Không có `OPENAI_*`/key nào trong bundle client

## Risk Assessment
- Provider free không hỗ trợ `json_schema` strict → dùng `json_object` + validate code. Tín hiệu: tỷ lệ parse fail >5% trong log → đổi model/provider primary.
- Điều khoản free tier (dữ liệu có thể dùng để cải thiện dịch vụ) → chỉ test kín, consent ghi rõ, giảm PII (Phase 3). Trước public launch: chuyển paid tier/no-training (gate ở P8).

## Completion Notes (2026-09-23)
- Done: git baseline `2bc1ebc`; 2 dead components removed; `experience.css` 14.8KB → 4.2KB (dead selectors only); `lib/ai/llm/{providers,chat-json,schema-guard,index}.ts`; `openai.ts` deleted, `intent.ts`/`onboarding.ts` call `chatJson`; docs + `.env.example` updated.
- Added beyond plan (from review): `schema-guard.ts` always validates model output (H1); per-attempt timeout split (M1); blank `LLM_PROVIDERS` → openai (M2); retry carries JSON-only reminder (M3); success not logged.
- Verification: tests 18/18, tsc/eslint/build 0; runtime smoke AI off + AI on w/ unreachable provider → 200 `mode:"rules"` (<150ms); no secrets in `.next/static`. Report: `plans/reports/ak-engineer-tester-260923-1709-phase01-validation.md`.
- Carry-over:
  - `import "server-only"` not added (package missing, pnpm unavailable) → add when deps can be installed.
  - All-null AI reply still counts as `mode:"ai"` (pre-existing) → P3/P5: merge AI result with rules result, AI wins only on non-null.
  - No live provider smoke test (no keys) — unverified whether Gemini accepts nullable union types under `strict`; 400 → json_object downgrade covers rejection.
