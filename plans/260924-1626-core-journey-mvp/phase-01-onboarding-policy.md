---
phase: 1
title: "Onboarding 4 bước + Family Policy"
status: pending
priority: P1
effort: "0.5d"
dependencies: []
---

# Phase 1: Onboarding 4 bước + Family Policy

## Overview
Onboarding chỉ còn: Nhà mình → Thành viên (số con, tên, tuổi, cân nặng) → Ưu tiên (Quản lý tiền · Quản lý mua sắm · Giảm việc phải nhớ) → Phong cách (Tiết kiệm · Cân bằng · Tiện lợi). Kết thúc bằng tóm tắt + Family Policy + 3 thẻ khởi đầu. Câu hỏi tài chính / chăm con thành phần riêng (`?section=money|care`).

## Architecture
- `lib/onboarding/questions.ts`: `buildQuestions(profile, newId, now, section = "core")`; `core` = focus, setup, kids, child name/age/weight, **style**; `money` = housing…planning (cũ); `care` = child-care…safety (cũ).
- `HouseholdContext.style ∈ saving|balanced|convenience` (jsonb, không migration); style đặt luôn `pricePreference` (budget/balanced/value).
- `lib/policy/family-policy.ts`: `familyPolicy(profile)` → `{ style, reorderWindowDays, spendAlertPct, lowStockPushDays, suggestCheaper, waitForSale, label[] }` — đọc bởi attention engine, gợi ý mua, push.
- `components/onboarding/onboarding-summary.tsx`: tóm tắt nhà mình + “FamAgent sẽ làm việc thế này” (policy) + 3 bước đầu theo ưu tiên; `OnboardingReview` cũ chỉ dùng cho `section=money`.
- Ẩn phương pháp: `FrameworkPanel` (Tiền) và phần phương pháp nuôi dạy / Nurturing Care (Gia đình) vào `<details>` “Nâng cao”; Home bỏ “Việc hôm nay”.

## Success Criteria
- [ ] Gia đình 1 con: đúng 7 màn (focus, setup, số con, tên, tuổi, cân, phong cách) + tóm tắt.
- [ ] Chọn “Tiết kiệm” → `pricePreference=budget`, policy nhắc sớm hơn/nhạy chi hơn “Tiện lợi”.
- [ ] `?section=money` vẫn hỏi đủ câu tài chính và đánh giá cũ.
- [ ] Test câu hỏi cập nhật; test policy.
