---
phase: 6
title: "Chủ động + Brief tuần"
status: pending
priority: P2
effort: "0.75d"
dependencies: [3]
---

# Phase 6: Chủ động + Brief tuần

## Overview
Bất thường theo nhóm/tuần (“Ăn ngoài tuần này cao hơn trung bình 32%”); push hằng ngày lấy từ attention engine (sắp hết + chi bất thường), tôn trọng feedback; Brief tuần (trang trong app + push Chủ nhật 19:00).

## Architecture
- `category_spike` trong engine: 7 ngày gần nhất vs trung bình 4 tuần trước, ≥ ngưỡng policy và ≥ 200K chênh.
- `lib/attention/weekly.ts`: `buildWeekly(snapshot, now)` → Tiền (tuần này, so tuần trước), Mua sắm (đã mua, đủ tới), Mục tiêu, Tuần tới (món sắp hết 14 ngày, ngân sách nhóm còn lại).
- `/home/week` trang Brief; Home có link.
- Migration 0015: `notification_log(user_id, key, day)` thay `push_log` cho mọi loại nhắc; cron hằng ngày dùng engine; `/api/cron/weekly` (vercel.json `0 12 * * 0` = 19:00 VN).

## Success Criteria
- [ ] Test spike + weekly.
- [ ] Cron: tối đa 2 nhắc/ngày/nhà, không nhắc mục đã “Đừng nhắc”/“Chưa cần”.
