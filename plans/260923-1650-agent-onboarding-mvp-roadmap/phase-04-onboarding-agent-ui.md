---
phase: 4
title: "Onboarding Agent UI"
status: pending
priority: P1
effort: "2.5d"
dependencies: [3]
---

# Phase 4: Onboarding Agent UI

## Overview
Viết lại `agent-onboarding.tsx` thành trải nghiệm agent: hội thoại chính + **thẻ "Family AI đang hiểu"** cập nhật trực tiếp theo từng lượt, quick-reply chips, bỏ qua, sửa inline, màn review có cấu trúc, consent và thông báo dữ liệu rõ ràng. Không còn cảm giác landing page.

## Requirements
- Functional:
  - Mở đầu: agent chào + giải thích 1 câu vì sao hỏi (để gợi ý đúng size/ngân sách) + ước lượng "khoảng 1–2 phút" + consent AI (bật/tắt ngay đầu, mặc định tắt; tắt vẫn dùng được rules).
  - Thread chat: bubble agent/user, typing indicator, quick-reply chips từ `quickReplies` (vd "Size L", "Chưa biết size", "Bỏ qua", "Ưu tiên chống tràn").
  - Context panel (desktop: cột phải; mobile: thanh gọn trên cùng mở rộng được): nhóm Household / Bé (mỗi bé 1 thẻ) / Ưu tiên / Thiết bị; slot vừa cập nhật highlight; slot trống hiển thị "Chưa có"; bấm vào slot → sửa inline (không cần chat).
  - Tiến độ theo nhóm slot (không phải "01/03" cứng).
  - Review: tóm tắt đầy đủ, nút "Bắt đầu tư vấn", "Sửa", "Xóa hết và làm lại"; nói rõ lưu ở đâu (trình duyệt / tài khoản).
  - Người đã onboard quay lại `/` → vào `/shop` (giữ logic hiện có); nút "Cập nhật hồ sơ" từ `/shop` mở lại agent ở chế độ cập nhật.
  - "Bắt đầu tư vấn" → vào thẳng `/shop` (bỏ redirect `/sign-in`, bỏ `markPendingImport` trong chế độ cloud vì profile đã lưu cho user ẩn danh). <!-- Updated: Validation Session 1 - D6 -->
  - Mời liên kết email (`supabase.auth.updateUser({ email })` cho user ẩn danh): banner nhẹ sau gợi ý đầu tiên và khi lưu sản phẩm — "Lưu hồ sơ để dùng trên thiết bị khác"; không chặn luồng. `/sign-in` xử lý cả trường hợp liên kết.
- Non-functional: responsive 360px+, a11y (aria-live cho thread, focus quản lý, chips là button), reduced-motion, tiếng Việt nhất quán, không gradient/orb trang trí thừa.

## Architecture
```text
components/onboarding/
  onboarding-agent.tsx     // container: state {profile, history, activeSlot, busy}, gọi /api/onboarding
  onboarding-thread.tsx    // bubbles + chips + composer
  family-context-panel.tsx // hiển thị/sửa slot, dùng lại được ở /shop sidebar (spec §9 "Family Context")
  onboarding-review.tsx
```
`app/page.tsx` import `OnboardingAgent`. `family-context-panel` tái sử dụng trong `agent-shopping.tsx` thay phần hiển thị profile hiện có (DRY).

## Related Code Files
- Create: `apps/web/src/components/onboarding/*.tsx`
- Modify: `apps/web/src/app/page.tsx`, `apps/web/src/app/agent-workspace.css`, `apps/web/src/components/agent-shopping.tsx` (dùng panel + nút cập nhật hồ sơ + banner liên kết email), `apps/web/src/lib/experience/cloud.ts`, `apps/web/src/lib/supabase/browser.ts` (anonymous sign-in helper), `apps/web/src/app/sign-in/page.tsx`, `apps/web/src/middleware.ts` (cho phép user ẩn danh vào `/shop`)
- Delete: `apps/web/src/components/agent-onboarding.tsx`

## Implementation Steps
1. Mockup HTML tĩnh (desktop + mobile, trạng thái: mở đầu, giữa hội thoại, review) lưu `plans/260923-1650-agent-onboarding-mvp-roadmap/mockups/onboarding.html` → **user duyệt trước khi code** (D9).
2. Tách component theo cấu trúc trên; state & gọi API ở container.
3. Context panel với sửa inline → gọi cùng hàm validate P2.
4. Review + finish (giữ cookie `family-ai-onboarded`; cloud: set `onboarded_at` cho user ẩn danh → `/shop`). Banner liên kết email trong `agent-shopping.tsx`; dọn `isPendingImport`/`markPendingImport` khỏi `cloud.ts` nếu không còn dùng.
5. Events: `onboarding_started`, `onboarding_slot_filled{slot}`, `onboarding_slot_skipped{slot}`, `onboarding_completed{durationSec, turns, mode}`, `family_profile_created`.
6. Kiểm tra tay trên Browser pane: mobile 375px, desktop; kịch bản Gold (spec §72).

## Success Criteria
- [ ] Kịch bản Gold hoàn tất ≤2 phút, 3–5 lượt chat
- [ ] Panel phản ánh đúng mọi slot sau mỗi lượt; sửa inline lưu ngay
- [ ] Không có horizontal scroll ở 360px; điều hướng bàn phím đầy đủ
- [ ] Event `onboarding_completed` có duration + turns

## Risk Assessment
- Người dùng thấy dài vì spec §12 nhiều trường → nhóm câu hỏi, cho "Bỏ qua phần còn lại" sau khi đủ slot bắt buộc. Tín hiệu: tỷ lệ hoàn tất <70% trong test 5–8 phụ huynh (MVP_PLAN Mốc 1) → cắt nhóm `home`/`child.care` ra khỏi onboarding, hỏi lúc cần trong `/shop`.
