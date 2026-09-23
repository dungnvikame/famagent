---
phase: 3
title: "Onboarding Agent core (slot-filling)"
status: pending
priority: P1
effort: "3d"
dependencies: [1, 2]
---

# Phase 3: Onboarding Agent core

## Overview
Thay `processOnboarding` 2 bước cứng bằng agent slot-filling: mỗi lượt LLM trích xuất *mọi* thông tin người dùng nói (nhiều slot cùng lúc) và đề xuất câu trả lời; **code** quyết định slot nào còn thiếu, thứ tự hỏi, validate, khi nào đủ để review. Không có LLM → rules parser (mở rộng từ `fallback()` hiện tại) + câu hỏi template.

## Requirements
- Functional:
  - Slot & thứ tự hỏi (mỗi nhóm 1 lượt, gom câu hỏi tự nhiên):
    1. `household` — số người lớn, số bé (tùy chọn)
    2. `child.basics` — tên gọi (tùy chọn), ngày sinh/tuổi, **cân nặng hoặc size (bắt buộc)**
    3. `child.care` — da nhạy cảm, thương hiệu đang dùng/thích/tránh
    4. (lặp 2–3 cho bé thứ 2 nếu có)
    5. `preferences` — ưu tiên giá (budget/value/balanced/premium), ngân sách tối đa, ưu tiên giao hàng, mối quan tâm chính
    6. `home` — máy giặt cửa trước/trên (tùy chọn, 1 câu ngắn, giải thích lý do: chọn nước giặt)
    7. `review`
  - Người dùng nói "bỏ qua / không nhớ / sau" → slot vào `skippedSlots`, sang slot kế. Slot bắt buộc bị bỏ qua → agent giải thích ngắn vì sao cần (tránh sai size) và cho phép nhập size thay cân nặng; nếu vẫn bỏ qua → vẫn cho vào `/shop`, `/shop` sẽ hỏi lại (hành vi hiện có).
  - Sửa bất kỳ lúc nào: "à bé 11kg chứ" → cập nhật slot đã điền, xác nhận lại.
  - Trả về: `{ profile, reply, quickReplies: string[], activeSlot, done, mode: "ai" | "rules" }`.
  - Kết quả LLM được **gộp với rules** (carry-over P1): giá trị AI chỉ thắng khi khác null; AI trả toàn null → dùng rules, `mode:"rules"`. <!-- Updated: P1 carry-over -->
  - Guest rate limit (D1, D5): khi có Supabase, trang chủ gọi `supabase.auth.signInAnonymously()` nếu chưa có session → route onboarding dùng `authenticated()` như chat, đếm `api_request_limits` endpoint `onboarding` (~20 lượt LLM/giờ/user). Không có Supabase → bộ đếm in-memory theo IP. Vượt → rules, không lỗi. <!-- Updated: Validation Session 1 - D5 anonymous sign-in -->
  - Chống lạm dụng tạo user ẩn danh hàng loạt: bật CAPTCHA (Turnstile) cho anonymous sign-in trên Supabase trước khi mở test rộng; giới hạn tạo session theo IP của Supabase Auth.
- Non-functional:
  - Không đoán thông tin trẻ: chỉ nhận slot người dùng nói rõ; validate khoảng (cân nặng 2–30kg, size enum, ngày sinh 0–6 năm).
  - Giảm PII gửi provider: thay tên bé bằng `[BE_1]` trong nội dung gửi LLM khi đã biết tên; không gửi profile đầy đủ, chỉ danh sách slot còn thiếu + lịch sử ngắn (≤6 lượt).
  - p95 ≤4s/lượt; timeout → rules cho lượt đó.

## Architecture
```text
lib/ai/onboarding/
  slots.ts        // định nghĩa slot, thứ tự, required, nextSlot(profile) – thuần code
  extract-rules.ts// regex parser (từ onboarding.ts hiện tại + mới: số người lớn, ngày sinh,
                  //   brand list, "bỏ qua", máy giặt, giao hàng)
  agent.ts        // runOnboardingTurn(state, message):
                  //   1. LLM chatJson(schema: {updates:[{slot,value}], skip:[slot],
                  //      wantsReview:bool, reply:string, quickReplies:string[]})
                  //   2. null → extract-rules + template reply
                  //   3. applyUpdates(profile, updates) → validate từng giá trị (drop sai)
                  //   4. next = nextSlot(profile); nếu LLM reply hỏi slot khác next → dùng template
                  //   5. return {...}
  templates.ts    // câu hỏi/tóm tắt tiếng Việt cho rules mode + quickReplies mặc định
app/api/onboarding/route.ts // body {message, profile, history}; bỏ tham số step; rate limit guest
```
System prompt agent (tóm tắt): vai trò trợ lý Family AI tìm hiểu gia đình; chỉ ghi nhận điều người dùng nói rõ; không tư vấn sản phẩm; hỏi 1 nhóm thông tin mỗi lượt; câu ngắn, thân thiện, xưng "mình/bạn"; biết slot đang cần là `{activeSlot}`.

Quyết định: code là nguồn chân lý cho luồng; LLM chỉ trích xuất + viết câu. Tránh agent "tự do" gây lan man và khó test.

## Related Code Files
- Create: `apps/web/src/lib/ai/onboarding/{slots,extract-rules,agent,templates}.ts`, `apps/web/tests/onboarding-agent.test.ts`
- Modify: `apps/web/src/app/api/onboarding/route.ts`
- Delete: `apps/web/src/lib/ai/onboarding.ts` (sau khi chuyển logic)

## Implementation Steps
1. `slots.ts` + test `nextSlot` cho các profile mẫu.
2. Chuyển + mở rộng regex sang `extract-rules.ts`; test tiếng Việt: "nhà 2 vợ chồng 1 bé", "bé sinh tháng 3/2025", "đang dùng Bobby, tránh Huggies", "bỏ qua", "máy giặt cửa ngang", "10 ký", "size L".
3. `agent.ts`: gọi `chatJson` (P1), merge + validate, chọn reply; test với LLM mock (JSON đúng, JSON có slot sai giá trị, null).
4. Route: bỏ `step`, thêm `history`; có Supabase → yêu cầu session (ẩn danh hoặc email), đếm `api_request_limits`; không còn ép `aiConsent:false` — vẫn chỉ gọi LLM khi `aiConsent===true`. Profile lưu thẳng `family_profiles` của user ẩn danh sau mỗi lượt (không cần pending-import).
5. Bộ 30 hội thoại mẫu (fixture) chạy trong test ở rules mode; chạy tay trên Gemini/Groq ghi kết quả vào report.

## Success Criteria
- [ ] 1 câu nhiều ý điền ≥4 slot cùng lúc (AI mode)
- [ ] Rules mode hoàn tất được onboarding với 30 fixture, không slot nào nhận giá trị ngoài khoảng
- [ ] Không có tên bé thật trong payload gửi provider (test kiểm tra payload)
- [ ] Vượt rate limit → trả `mode:"rules"`, không lỗi 5xx

## Risk Assessment
- LLM hỏi lệch luồng/lan man → ép reply theo `activeSlot`, fallback template. Tín hiệu: >10% lượt dùng template thay LLM reply → sửa prompt.
- Rate limit in-memory (chế độ không Supabase) không bền khi serverless nhiều instance → chỉ dùng cho dev/demo; môi trường test thật phải có Supabase + anonymous sign-in.
- User ẩn danh tích tụ trong `auth.users` → job dọn user ẩn danh không hoạt động >30 ngày (P8).
