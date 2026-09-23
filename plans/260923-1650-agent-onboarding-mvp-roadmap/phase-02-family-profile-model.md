---
phase: 2
title: "Family Profile model đầy đủ (spec §12–13)"
status: pending
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
- Non-functional: không thu dữ liệu sức khỏe ngoài phục vụ chọn hàng (PRODUCT.md §4); giới hạn độ dài mảng/chuỗi; RLS giữ nguyên nguyên tắc own-row.

## Architecture
- Migration mới `supabase/migrations/202609240001_family_profile_v2.sql`: `alter table` thêm cột (`delivery_preference`, `preferred_brands text[]`, `avoided_ingredients text[]`, `washing_machine`, `onboarding jsonb`), mở rộng check `price_preference`; `children` thêm `sensitivities text[]`, `preferred_brands text[]`, `disliked_brands text[]`, `current_brand` (`age_months`, `position`, `onboarded_at` đã có ở 0003 — verified). Nới check `price_preference` (0002:7) thêm `'value'`. `api_request_limits.endpoint` check thêm `'onboarding'` (D5). <!-- Updated: Validation Session 1 - verified 0003 + D5 -->
- Anonymous user (D5): profile gắn `user_id` của user ẩn danh; RLS own-row giữ nguyên; khi liên kết email user id không đổi nên không cần migrate dữ liệu.
- **Backup trước migration** (rule dự án): `pg_dump` bảng `family_profiles`, `children` trên môi trường có dữ liệu.
- `lib/experience/profile-mapper.ts`: 1 chỗ duy nhất map DB row ↔ `FamilyProfile` (hiện đang lặp ở `api/me/route.ts` và `api/chat/route.ts` — DRY).
- `storage.ts`: migrate `profile:v1` → v2 khi đọc (thêm `onboarding` rỗng).

## Related Code Files
- Create: `supabase/migrations/202609240001_family_profile_v2.sql`, `apps/web/src/lib/experience/profile-mapper.ts`, `apps/web/tests/profile.test.ts`
- Modify: `apps/web/src/lib/experience/{types,validate,storage}.ts`, `apps/web/src/app/api/me/route.ts`, `apps/web/src/app/api/chat/route.ts` (dùng mapper), `apps/web/src/components/family-editor.tsx` (hiển thị/sửa trường mới), `docs/DATA.md`

## Implementation Steps
1. Lấy tên constraint thật (`\d family_profiles`, `\d api_request_limits`) để drop/re-add check đúng tên.
2. Cập nhật types + `validProfile` (enum, giới hạn: ≤5 bé, ≤10 brand, chuỗi ≤40 ký tự, birthDate trong 0–6 năm).
3. Viết migration + mapper; thay 2 chỗ map lặp bằng mapper.
4. Migrate localStorage v1 → v2.
5. `family-editor.tsx`: thêm nhóm Household / Bé / Ưu tiên / Thiết bị theo layout §12; nút xóa từng bé và xóa toàn bộ.
6. Test: validate biên, mapper round-trip, migrate v1.

## Success Criteria
- [ ] Profile v1 cũ vẫn đọc được, không mất dữ liệu
- [ ] `/family` sửa/xóa được mọi trường mới; API `PUT /api/me` từ chối dữ liệu sai
- [ ] Chỉ còn 1 hàm map DB↔profile

## Risk Assessment
- Migration trên DB đã có user → backup + migration chỉ `add column`/nới check, không drop. Nếu check constraint cũ tên khác → đọc tên thật bằng `\d family_profiles` trước.
