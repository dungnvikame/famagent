---
phase: 3
title: "Attention engine + Home + feedback"
status: pending
priority: P1
effort: "1d"
dependencies: [1, 2]
---

# Phase 3: Attention engine + Home + feedback

## Overview
Một bộ máy sinh insight từ Family State, dùng chung cho Home, push, Brief tuần. Home = **Cần chú ý** (≤ 3) + **Đang ổn** + thẻ khởi đầu. Mỗi thẻ: 1 CTA + `⋯` (Hữu ích · Không đúng · Chưa cần · Đừng nhắc việc này nữa) — phản hồi đổi state.

## Architecture
- `lib/attention/types.ts`, `lib/attention/engine.ts`: `buildAttention(snapshot, policy, feedback, now)` → `{ attention, fine, starters }`. Kinds: `stock_low`, `money_pace`, `category_spike` (P6), `bill_due`, `plan_over_budget`, `stage_size`, `weight_missing/stale`, `pending_question`. Key = `kind:subject`.
- Snapshot: `{ profile, month: MonthSummary, history: MoneyTransaction[] (~120 ngày), shopping: ShoppingState, recurring, goals }`; `GET /api/family-state` (server) / demo local builder.
- Feedback: migration `202609240015_attention.sql` → `insight_feedback(user_id, key, verdict, until)`; `useful` ghi nhận, `later` ẩn 3 ngày, `wrong` ẩn 7 ngày (+ mở “Còn không?” với tồn kho), `mute` ẩn hẳn. Engine lọc theo feedback.
- Home viết lại (`family-brief.tsx`): lời chào · Cần chú ý · Đang ổn · thẻ khởi đầu · link Brief tuần. Bỏ ô KPI, Việc hôm nay; `build-brief.ts` thay bằng engine.

## Success Criteria
- [ ] Không quá 3 thẻ chú ý; mọi thẻ có nguồn + CTA + feedback.
- [ ] “Đang ổn” liệt kê điều đang đúng (tiết kiệm đúng tiến độ, không món nào gấp, chi trong nhịp).
- [ ] “Đừng nhắc” ẩn vĩnh viễn thẻ đó; “Chưa cần” ẩn 3 ngày; test engine + feedback.
