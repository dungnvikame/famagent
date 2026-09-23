---
title: "Phase 2: family profile v2 + spec v1 adoption"
date: 2026-09-23
summary: Profile v2 with provenance shipped; spec v1 reshaped plan P3-P8
---

# Phase 2: family profile v2 + spec v1 adoption

## What happened
- User shared spec v1 (Household Purchasing Agent) mid-phase; saved to docs/SPEC_V1_PURCHASING_AGENT.md. Decisions D11–D14: confirmed-profile + fieldMeta now (observations later), 1 user = 1 household, P3–P8 follow spec v1 (ShoppingIntentV1, product_score_v1, ≤2 questions/turn, no %), ambiguous values confirmed via chips. Replenishment/basket → separate post-MVP plan.
- Phase 2 committed: types/validate v2, profile-mapper (DRY), profile-meta stampChanges, /family rewrite, migration 202609240001 (add-only).
- Review BLOCK caught: ListInput lost text on Enter-submit; stampChanges invented provenance for unchanged fields; stored birth dates would age into invalid profiles; missing "value" label. All fixed.
- Tester skipped runtime smoke and left `next start` running again; main agent stopped it and ran 6/6 runtime checks.

## Lessons
- Validation for stored data must not depend on "now" in a way that makes old data invalid; keep strict ranges for input only.
- Tester subagent housekeeping is unreliable — always verify ports/stray files after it runs.

## Next
- Phase 3 onboarding agent core. Carry-overs: merge AI+rules (all-null), extractor must emit v2 fields incl. "value", confirmation chips, ≤2 questions/turn, anonymous sign-in.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
