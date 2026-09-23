---
title: "Phase 1: LLM layer + dead code cleanup"
date: 2026-09-23
summary: Provider-agnostic LLM chain shipped; review caught missing schema validation
---

# Phase 1: LLM layer + dead code cleanup

## What happened
- Commit `cf0593e`: `lib/ai/llm` (OpenAI-compatible chain gemini→groq→openai), deleted `onboarding-flow.tsx`, `shopping-experience.tsx`, dead CSS (14.8KB→4.2KB), `openai.ts`.
- Code review BLOCKED first pass: model output not validated against schema → `json_object` providers could return `{}`/wrong types, skip rules fallback, crash `context.ts` `.toUpperCase`. Fixed with always-on `schema-guard.ts`; also per-attempt timeout split, blank `LLM_PROVIDERS` → openai, JSON-only retry note.
- Tester PASS (18/18, build ok, smoke AI off & unreachable provider → rules <150ms). Tester left `next start` on :3137 + stray files in apps/web — cleaned up.

## Lessons
- Switching from strict Responses API to json_object mode silently removed a guarantee; always re-establish validation in code.
- pnpm not on PATH in this env; use `npx --no-install` via PowerShell. Hook blocks literal node_modules/.next paths in Bash.

## Next
- Phase 2 Family Profile v2; carry-overs: server-only guard, merge AI+rules (P3), live provider smoke test once keys exist.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
