---
title: "Phase 4: onboarding agent UI"
date: 2026-09-23
summary: Mockup-approved agent UI shipped; cloud-mode dead ends fixed in review
---

# Phase 4: onboarding agent UI

## What happened
- Commit 3fba9f7: components/onboarding/* (agent container, thread, editable FamilyContextPanel reused in /shop, review), onboarding-agent.css, anonymous ensureSession, sign-in link-vs-existing choice, email invite banner, pending-import removed.
- Browser-verified locally at 1280/375 (hidden window → drove UI via JS). Found & fixed: duplicated pending label, default "Cân bằng" shown as a choice, vague acks, hedge crossing commas.
- Review BLOCK: cloud-mode dead ends (existing email user stuck as guest; failed anonymous sign-in → unfinishable), panel edits overwritten by pending "Đúng"/in-flight replies, email update mode not saved. Re-review N1: failed profile load must not enable server writes.
- Decisions: Turnstile → P8; signing in to existing account doesn't merge guest data (text made accurate).

## Lessons
- Local-only verification hides auth-mode bugs; reviewer reading cloud paths caught them. P8 must run cloud mode end to end.
- Distinguish "load failed" from "no data" before enabling writes.

## Next
- P5 shopping pipeline (ShoppingIntentV1, product_score_v1 + offer ranking, fact-guard, trace).

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
