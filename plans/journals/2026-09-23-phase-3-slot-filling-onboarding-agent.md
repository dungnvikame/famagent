---
title: "Phase 3: slot-filling onboarding agent"
date: 2026-09-23
summary: Agent core shipped after two review blocks; quota made atomic
---

# Phase 3: slot-filling onboarding agent

## What happened
- Commit: lib/ai/onboarding (slots, extraction schema, rules, templates, agent, rate-limit), new /api/onboarding contract, profile-store, migration 202609240002 (atomic consume_request_quota; delete policy dropped; chat uses it).
- Review BLOCK #1 (13 findings): email profiles overwritten by per-turn save; `\b` ASCII-only regexes (size M from "size mình", age lost before "10kg"); quota bypass via RLS delete + count/insert race; AI erasing rule hedges; unmasked first-turn names; client strings in system prompt.
- Review BLOCK #2: wide masking turned ordinary words ("khoảng", "da") into child names via placeholders → only trusted names accepted.
- Found own bug in tests: slot ids "child.basics:<uuid>" exceeded 40-char validator limit.
- Tester deferred AI-unreachable check and left .claude/launch.json; main agent re-ran check.

## Lessons
- JS `\b` is ASCII-only — always use Unicode lookarounds for Vietnamese.
- Masking and name-trust are separate concerns: mask wide, trust narrow.
- Rate limits enforced via user-writable tables need atomic security-definer functions.

## Next
- P4: HTML mockup for approval (D9), then UI, anonymous sign-in + Turnstile, family context panel reuse in /shop.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
