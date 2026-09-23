---
title: Plan agent onboarding + MVP roadmap
date: 2026-09-23
summary: "Scout + 8-phase plan validated: agent onboarding, free-tier LLM, anonymous sign-in"
---

# Plan agent onboarding + MVP roadmap

## What happened
- Scout: `components/onboarding-flow.tsx`, `components/shopping-experience.tsx` không được import (dead). Live: `agent-onboarding.tsx` (/), `agent-shopping.tsx` (/shop).
- Onboarding hiện tại: 2 bước cứng, regex, AI tắt trước đăng nhập; thiếu phần lớn Family Profile spec §12–13.
- Tạo plan `plans/260923-1650-agent-onboarding-mvp-roadmap` (8 phase) và validate (7 câu hỏi).

## Validation findings
- `api_request_limits` yêu cầu `user_id` FK auth.users + RLS authenticated → không dùng cho guest như plan ban đầu → chọn Supabase anonymous sign-in.
- `app/experience.css` còn ~30 class dùng chung → chỉ xóa selector chết.

## Decision
- LLM free-tier qua adapter OpenAI-compatible: Gemini Flash → Groq → rules (chưa có ngân sách AI).
- Guest vào /shop ẩn danh, mời liên kết email sau.
- ShoppingIntent chuyển sang dạng lồng spec §20 ở P5.
- Duyệt mockup HTML trước UI onboarding; git init ở P1.

## Next steps
- `/ak:cook plans/260923-1650-agent-onboarding-mvp-roadmap/plan.md` (P1 → P2 → P3 → P4).
- Chờ: owner nguồn dữ liệu bỉm, Supabase dev/staging, xác minh điều khoản free tier.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
