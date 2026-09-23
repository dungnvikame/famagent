---
phase: 2
title: "Family Profile model đầy đủ (spec §12–13)"
status: completed
priority: P1
effort: "1.5d"
dependencies: []
---

# Phase 2: Family Profile model đầy đủ

## Overview
Mở rộng `FamilyProfile`/`ChildProfile` và schema Supabase để chứa toàn bộ bối cảnh spec §12–13, giữ tương thích dữ liệu localStorage v1 và các chỗ đang dùng (`mainConcern`, `maxBudget`, `ageMonths`).

## Requirements
- Functional — trường mới:
  - Household: `adultsCount?`, `familyName?` (đã có), `appliances?: { washingMachine?: "front" | "top" | "none" }`
  - Preferences: `pricePreference` thêm `"value"`; `deliveryPreference?: "cheapest" | "fastest" | "balanced"`; `preferredBrands?`, `avoidedIngredients?`; giữ `mainConcern`, `maxBudget`
  - Child: `birthDate?` (ưu tiên hơn `ageMonths`; `ageMonths` tính ra khi hiển thị), `sensitivities?: string[]` (enum ngắn: `sensitive_skin`, `rash_prone`, `fragrance_free`), `preferredBrands?`, `dislikedBrands?`, `currentBrand?`
  - `onboarding?: { completedSlots: string[]; skippedSlots: string[]; version: 2 }` để agent biết đã hỏi/bỏ qua gì
  - `fieldMeta?: Record<fieldPath, { source: "user_entered" | "user_confirmed"; observedAt; confirmedAt? }>` (D11, spec v1 §6.1) — fieldPath vd `maxBudget`, `children.<id>.weightKg`. `/family` ghi `user_entered`; onboarding agent ghi `user_confirmed` sau khi người dùng bấm xác nhận (P3). Cột DB `family_profiles.field_meta jsonb`. <!-- Updated: Session 2 - D11 -->
- Non-functional: không thu dữ liệu sức khỏe ngoài phục vụ chọn hàng (PRODUCT.md §4); giới hạn độ dài mảng/chuỗi; RLS giữ nguyên nguyên tắc own-row.

## Architecture
- Migration mới `supabase/migrations/202609240001_family_profile_v2.sql`: `alter table` thêm cột (`delivery_preference`, `preferred_brands text[]`, `avoided_ingredients text[]`, `washing_machine`, `onboarding jsonb`), mở rộng check `price_preference`; `children` thêm `sensitivities text[]`, `preferred_brands text[]`, `disliked_brands text[]`, `current_brand` (`age_months`, `position`, `onboarded_at` đã có ở 0003 — verified). Nới check `price_preference` (0002:7) thêm `'value'`. `api_request_limits.endpoint` check thêm `'onboarding'` (D5). <!-- Updated: Validation Session 1 - verified 0003 + D5 -->
- Anonymous user (D5): profile gắn `user_id` của user ẩn danh; RLS own-row giữ nguyên; khi liên kết email user id không đổi nên không cần migrate dữ liệu.
- **Backup trước migration** (rule dự án): `pg_dump` bảng `family_profiles`, `children` trên môi trường có dữ liệu.
- `lib/experience/profile-mapper.ts`: 1 chỗ duy nhất map DB row ↔ `FamilyProfile` (hiện đang lặp ở `api/me/route.ts` và `api/chat/route.ts` — DRY).
- ~~`storage.ts`: migrate `profile:v1` → v2 khi đọc~~ — **không cần** (quyết định khi implement): mọi trường mới đều tùy chọn nên dữ liệu v1 hợp lệ nguyên trạng (có test); giữ key `family-ai:profile:v1`.
- **Thứ tự deploy:** backup → migration `202609240001` → deploy code (code ghi cột mới; ngược lại PUT /api/me lỗi 500).

## Related Code Files
- Create: `supabase/migrations/202609240001_family_profile_v2.sql`, `apps/web/src/lib/experience/profile-mapper.ts`, `apps/web/tests/profile.test.ts`
- Modify: `apps/web/src/lib/experience/{types,validate}.ts` (~~storage.ts~~ không cần đổi), `apps/web/src/app/api/me/route.ts`, `apps/web/src/app/api/chat/route.ts` (dùng mapper), `apps/web/src/components/family-editor.tsx` (hiển thị/sửa trường mới), `docs/DATA.md`

## Implementation Steps
1. Lấy tên constraint thật (`\d family_profiles`, `\d api_request_limits`) để drop/re-add check đúng tên.
2. Cập nhật types + `validProfile` (enum, giới hạn: ≤5 bé, ≤10 brand, chuỗi ≤40 ký tự, birthDate trong 0–6 năm).
3. Viết migration + mapper; thay 2 chỗ map lặp bằng mapper.
4. ~~Migrate localStorage v1 → v2.~~ Không cần — xem Architecture (dữ liệu v1 hợp lệ nguyên trạng).
5. `family-editor.tsx`: thêm nhóm Household / Bé / Ưu tiên / Thiết bị theo layout §12; nút xóa từng bé và xóa toàn bộ.
6. Test: validate biên, mapper round-trip, migrate v1.

## Success Criteria
- [x] Profile v1 cũ vẫn đọc được, không mất dữ liệu
- [x] `/family` sửa/xóa được mọi trường mới; API `PUT /api/me` từ chối dữ liệu sai
- [x] Chỉ còn 1 hàm map DB↔profile

## Risk Assessment
- Migration trên DB đã có user → backup + migration chỉ `add column`/nới check, không drop. Nếu check constraint cũ tên khác → đọc tên thật bằng `\d family_profiles` trước.

## Completion Notes (2026-09-23)
- Done: types v2 + `fieldMeta` (D11), `validate.ts` rewrite, `profile-mapper.ts` (single DB↔profile mapping; api/me + api/chat), `profile-meta.ts` `stampChanges` (only changed fields stamped; no invented provenance), `/family` editor with all §12 groups, chat profile-change stamps `user_entered`, migration `202609240001` (add-only), `recommend.ts` handles `"value"`, shared `PRICE_PREFERENCE_LABELS`.
- Review: BLOCK → fixed H1 (list input lost on Enter), H2 (deploy order documented), M1 (invented provenance), M2 (stored birth date aging invalid → loose 18y stored / 6y input), M3, M4 → APPROVE WITH NITS (nits resolved/carried to P3).
- Verification: tests 28/28, typecheck + lint + production compile exit 0; runtime smoke 6/6 (report `plans/reports/tester-260923-1730-phase02-validation.md`).
- Not verified: migration not applied to a real Supabase DB (no project yet) — static review only.
- Deploy order: backup → migration → code.
