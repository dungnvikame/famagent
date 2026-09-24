---
title: "Core journey MVP — một chỗ nhập, một bộ máy chú ý, vòng phản hồi"
description: "Spec 'FamAgents — User Journey MVP': onboarding 4 bước + Family Policy, Universal Inbox, Attention Feed, trả lời Tiền/Mua sắm, quyết định mua lớn, chủ động + Brief tuần, feedback."
status: completed
priority: P1
effort: "4d"
tags: [onboarding, inbox, attention, money, shopping, push]
created: 2026-09-24
---

# Core journey MVP

## Overview
Nguồn: spec chủ sản phẩm (24/09) · [brainstorm + phản biện](../reports/brainstorm-260924-1609-core-journey-mvp.md). Vòng lặp: *đưa dữ liệu → hiểu → cập nhật Family State → phát hiện → đề xuất → phản hồi → hiểu hơn*.

## Contract
- **Outcome:** use case 1–9 của spec chạy trên production cho Tiền + Mua sắm.
- **Constraints:** rules-first; số liệu có nguồn; không scrape trái điều khoản (link: đọc thẻ chia sẻ nếu trang cho phép, không thì hỏi giá); không khẳng định “phù hợp nhu cầu” cho sản phẩm ngoài dữ liệu; IA 5 mục; demo mode chạy.
- **Non-goals:** nhiều tài khoản chung một nhà; nguồn giá thị trường; email.
- **Quyết định (24/09):** 12 phương pháp ẩn vào “Nâng cao” (không xóa); vẫn bắt buộc đăng nhập sau onboarding; link = đọc được thì đọc, không thì hỏi; Brief tuần = trang trong app + push tối Chủ nhật.

## Phases
| # | Phase | Status |
|---|-------|--------|
| 1 | [Onboarding 4 bước + Family Policy](./phase-01-onboarding-policy.md) | Completed |
| 2 | [Universal Inbox](./phase-02-universal-inbox.md) | Completed |
| 3 | [Attention engine + Home + feedback](./phase-03-attention-home.md) | Completed |
| 4 | [Trả lời Tiền & Mua sắm](./phase-04-money-shopping-answers.md) | Completed |
| 5 | [Quyết định mua lớn](./phase-05-big-purchase.md) | Completed |
| 6 | [Chủ động + Brief tuần](./phase-06-proactive-weekly.md) | Completed |

## Success Criteria
- [x] Onboarding 4 bước: 1 con = 7 màn (nhà mình, số con, tên, tuổi, cân, ưu tiên, phong cách) → 3 thẻ khởi đầu.
- [x] Một ô nhập ở mọi trang: câu (lần mua / chi / thu / câu hỏi), ảnh, link → nháp tóm tắt `Đúng` / `Sửa`.
- [x] Home chỉ có Cần chú ý (≤3) + Đang ổn (+ thẻ khởi đầu); mỗi thẻ có nguồn và phản hồi 4 lựa chọn tác động lên state.
- [x] “Tháng này tiêu thế nào?” trả pace so bình thường, nhóm tăng nhiều nhất, giải thích lượng vs giá; CTA lập kế hoạch phần còn lại.
- [x] “Mua lại bỉm cho Gold” trả một thẻ: size còn hợp, lần trước, giá thấp nhất từng trả, còn N ngày.
- [x] “Muốn mua robot hút bụi 8 triệu” → ảnh hưởng ngân sách/mục tiêu + 3 lựa chọn.
- [x] Push: sắp hết + chi bất thường theo nhóm/tuần, tôn trọng phản hồi; Brief tuần + push Chủ nhật. *Chọn nhắc + giới hạn/ngày có test; chưa thử gửi thật trên thiết bị.*
- [x] typecheck/lint/test xanh; review; deploy.

<!-- slug: core-journey-mvp -->

## Kết quả (24/09/2026)

Commit trên `feat/core-journey`: J1 `737b5e6` · J2 `3fbd50d` · J3 `c24620f` · J4 `d98e3fa` · J5 `e6dc65a` · J6 `2bd993d` · sửa review (xem [báo cáo](../reports/code-reviewer-260924-1609-core-journey.md)): khoản định kỳ không còn ghi ngược vào tháng cũ, khóa phản hồi ổn định, giới hạn 2 nhắc/ngày, bộ phân loại Inbox, nút Ghi nhanh trên điện thoại, bỏ quyền đọc hội thoại khỏi 0015. Chưa làm: `plan_over_budget`, `GET /api/family-state` (Home nạp trực tiếp qua `snapshot-client`).
