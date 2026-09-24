---
title: "Core journey MVP — một chỗ nhập, một bộ máy chú ý, vòng phản hồi"
description: "Spec 'FamAgents — User Journey MVP': onboarding 4 bước + Family Policy, Universal Inbox, Attention Feed, trả lời Tiền/Mua sắm, quyết định mua lớn, chủ động + Brief tuần, feedback."
status: in-progress
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
| 1 | [Onboarding 4 bước + Family Policy](./phase-01-onboarding-policy.md) | Pending |
| 2 | [Universal Inbox](./phase-02-universal-inbox.md) | Pending |
| 3 | [Attention engine + Home + feedback](./phase-03-attention-home.md) | Pending |
| 4 | [Trả lời Tiền & Mua sắm](./phase-04-money-shopping-answers.md) | Pending |
| 5 | [Quyết định mua lớn](./phase-05-big-purchase.md) | Pending |
| 6 | [Chủ động + Brief tuần](./phase-06-proactive-weekly.md) | Pending |

## Success Criteria
- [ ] Onboarding ≤ 6 màn (nhà mình, số con, tên/tuổi/cân từng con, ưu tiên, phong cách) → 3 thẻ khởi đầu.
- [ ] Một ô nhập ở mọi trang: câu (lần mua / chi / thu / câu hỏi), ảnh, link → nháp tóm tắt `Đúng` / `Sửa`.
- [ ] Home chỉ có Cần chú ý (≤3) + Đang ổn (+ thẻ khởi đầu); mỗi thẻ có nguồn và phản hồi 4 lựa chọn tác động lên state.
- [ ] “Tháng này tiêu thế nào?” trả pace so bình thường, nhóm tăng nhiều nhất, giải thích lượng vs giá; CTA lập kế hoạch phần còn lại.
- [ ] “Mua lại bỉm cho Gold” trả một thẻ: size còn hợp, lần trước, giá thấp nhất từng trả, còn N ngày.
- [ ] “Muốn mua robot hút bụi 8 triệu” → ảnh hưởng ngân sách/mục tiêu + 3 lựa chọn.
- [ ] Push: sắp hết + chi bất thường theo nhóm/tuần, tôn trọng phản hồi; Brief tuần + push Chủ nhật.
- [ ] typecheck/lint/test xanh; review; deploy.

<!-- slug: core-journey-mvp -->
