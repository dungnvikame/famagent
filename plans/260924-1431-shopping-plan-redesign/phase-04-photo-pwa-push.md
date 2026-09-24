---
phase: 4
title: "Ảnh đơn hàng + PWA + nhắc sắp hết"
status: pending
priority: P2
effort: "0.75d"
dependencies: [1, 2]
---

# Phase 4: Ảnh đơn hàng + PWA + nhắc sắp hết

## Overview
Ghi nhiều lần mua từ ảnh chụp đơn Shopee/Lazada (vision LLM, xác nhận trước khi lưu); cài FamAgent như app; Web Push nhắc khi món còn ≤ 3 ngày.

## Requirements
- Functional: nút ảnh trong ô ghi nhanh (chỉ hiện khi `aiConsent` + AI bật) → ảnh thu nhỏ ≤1280px JPEG phía trình duyệt → `/api/shopping/receipt` → danh sách nháp → thẻ xác nhận từng dòng (source `photo`); PWA manifest + icon + service worker; bật/tắt nhắc trong Gia đình → Tài khoản và thẻ mời trên Mua sắm; cron hằng ngày gửi push cho món ≤ 3 ngày, mỗi món tối đa 1 lần/ngày.
- Non-functional: ảnh không lưu, không log nội dung; quota 20 ảnh/giờ; push ẩn khi thiếu `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`; cron xác thực `CRON_SECRET`.

## Architecture
- LLM: `ChatMessage.content` nhận `string | ContentPart[]` (text + image_url) — tương thích OpenAI (Gemini/Groq vision).
- `lib/shopping/receipt.ts`: schema JSON + `validReceiptLines` → `PurchaseDraft[]` (ghép `capture.ts` để khớp món/nhóm).
- DB `202609240014_receipt_push.sql`: thay `consume_request_quota` cho phép `receipt`; `push_subscriptions(id, user_id, endpoint unique, p256dh, auth)`; `push_log(user_id, item_id, day)`.
- Push: `public/sw.js` (push + notificationclick → `/shopping`), `src/app/manifest.ts`, `src/app/icon.svg`; `lib/push/client.ts` (đăng ký), `/api/push/subscribe` (POST/DELETE), `/api/cron/reminders` (Node runtime; `pg` + `DATABASE_URL` đọc món/lần mua/mốc/đăng ký; `estimateItems`; gửi bằng `web-push`); `vercel.json` cron 01:00 UTC (08:00 VN).

## Related Code Files
- Create: `supabase/migrations/202609240014_receipt_push.sql`, `src/lib/shopping/receipt.ts`, `src/app/api/shopping/receipt/route.ts`, `src/components/shopping/photo-capture.tsx`, `public/sw.js`, `src/app/manifest.ts`, `src/app/icon.svg`, `src/lib/push/{client,server}.ts`, `src/app/api/push/subscribe/route.ts`, `src/app/api/cron/reminders/route.ts`, `src/components/push-toggle.tsx`, `tests/shopping-receipt.test.ts`
- Modify: `src/lib/ai/llm/chat-json.ts`, `src/components/shopping/quick-capture.tsx`, `src/components/account-section.tsx`, `vercel.json`, `apps/web/package.json` (+`web-push`), `.env.example`, `docs/DEPLOYMENT.md`

## Implementation Steps
1. LLM content parts + test không vỡ cũ.
2. receipt.ts + route + test validate.
3. Photo capture UI.
4. Migration push + manifest/icon/sw.
5. Đăng ký push + toggle; cron gửi + dedupe + test chọn món cần nhắc.
6. env/docs; typecheck · lint · test · commit.

## Success Criteria
- [ ] Ảnh đơn 3 dòng → 3 thẻ xác nhận đúng tên/số tiền (test với JSON mẫu từ LLM).
- [ ] Không có AI/đồng ý → nút ảnh không hiện; route trả 403.
- [ ] Manifest hợp lệ; SW đăng ký; bật nhắc lưu đăng ký.
- [ ] Cron chỉ chọn món ≤ 3 ngày, không gửi trùng trong ngày; thiếu VAPID → 503, không lỗi.

## Risk Assessment
- Không cài được `web-push` (mạng/quyền) → dừng phần gửi, giữ đăng ký + báo lại; không tự viết mã hóa push.
- iOS chỉ nhận push khi đã “Thêm vào MH chính” → hiển thị hướng dẫn trong toggle.
- Vision OCR sai số tiền → luôn qua thẻ xác nhận; dòng thiếu số tiền để trống bắt nhập.
