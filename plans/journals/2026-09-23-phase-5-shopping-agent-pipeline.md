---
title: "Phase 5: shopping agent pipeline"
date: 2026-09-23
summary: Spec v1 pipeline shipped after 3 review rounds; lift/round-trip bugs caught
---

# Phase 5: shopping agent pipeline

## What happened
- Commit f48ac7c: ShoppingIntentV1 + fieldEvidence, context-merger precedence, hardFilter reject reasons, product_score_v1 (unknown components), offer_score_v1, fact-guarded composer, pipeline state trace, agent_runs migration, thin route, eval 62 cases.
- Review BLOCK #1: "không mua X" became a preference; "gói 21 miếng" became a 2k/miếng cap (regex backtracking); stale profile size + new weight → empty results; fact-guard numbers-only; same-name children loop.
- Review BLOCK #2: lift semantics let a later "tránh X" be ignored and a descriptive "vẫn dùng X" lift a profile dislike.
- Review BLOCK #3: the "Vẫn tìm X" button never worked in production — upgradeIntent reset ambiguity and tests bypassed the route's JSON round trip.
- An earlier test passed for the wrong reason (category question instead of brand conflict) — tightened.

## Lessons
- Tests must go through the same serialisation path as production (JSON + upgradeIntent).
- Regex over Vietnamese: boundaries and backtracking need explicit probes; reviewer probe scripts are high-value.
- `String.replace` treats `$&` in replacement strings specially — use index slicing for code edits.

## Next
- P6 engineering part (import validation/dry-run, offer verification script); data sourcing needs an owner + Supabase.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
