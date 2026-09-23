# Scout Report — codebase overview

No specific target given; general map. Repo: pnpm monorepo `family-ai`, one app `apps/web` (Next.js 15, React 19, Supabase, optional OpenAI). ~1.8k LOC source. Not a git repo.

## Relevant Files

### Pages (`apps/web/src/app`)
- `page.tsx` - home = onboarding
- `shop/page.tsx`, `products/page.tsx`, `products/[slug]/page.tsx`, `compare/page.tsx` - shopping/catalog/compare
- `family/page.tsx`, `saved/page.tsx`, `sign-in/page.tsx`, `demo-offer/page.tsx`
- `layout.tsx`, `*.css` - shell + styles
- `middleware.ts` (src root) - Supabase session / auth gating

### API routes (`apps/web/src/app/api`)
- `chat/route.ts` (92) - agent chat endpoint, largest route
- `me/route.ts` (70) - profile read/write
- `conversations`, `onboarding`, `saved`, `events` - persistence + analytics
- `products`, `products/[id]`, `products/search` - catalog API
- `go/[offerId]/route.ts` - merchant redirect w/ HTTPS/domain check + click log
- `auth/callback`, `auth/confirm` - Supabase magic-link token exchange

### Components (`apps/web/src/components`)
- `agent-shopping.tsx` (126), `shopping-experience.tsx` (101) - main shop/chat UI
- `agent-onboarding.tsx` (91), `onboarding-flow.tsx` (78) - onboarding UI (two variants — possible duplication)
- `family-editor.tsx`, `product-card.tsx`, `saved-products.tsx`

### Lib
- `lib/ai/` - `onboarding.ts`, `intent.ts` + `intent-rules.ts` (rule fallback), `context.ts`, `profile-change.ts`, `recommendation.ts`, `workspace.ts`, `openai.ts` (adapter, gated by `AI_ENABLED` + consent)
- `lib/catalog/` - `types.ts`, `repository.ts` (DB vs demo), `demo.ts` (6 demo products), `filter.ts`, `format.ts`
- `lib/ranking/recommend.ts` - deterministic scoring
- `lib/experience/` - `types.ts`, `storage.ts` (localStorage), `cloud.ts` (server), `validate.ts`
- `lib/supabase/` - `browser.ts`, `server.ts` clients

### Scripts / tests / data
- `scripts/import-products.mjs` - CSV → DB import (`data/products.template.csv`)
- `scripts/evaluate.mjs` - 50-case eval vs running app (`EVAL_BASE_URL`)
- `tests/catalog.test.ts`, `intent.test.ts`, `workspace.test.ts` - node:test, strip-types

### DB / docs
- `supabase/migrations/202609230001_catalog.sql`, `..0002_experience.sql`, `..0003_account_api.sql`
- `docs/` - PRODUCT, MVP_PLAN, DATA, OPERATIONS, SOURCE_SPEC, TECH_DECISIONS

## Unresolved Questions
- What task should scouting target? (feature, bug, area)
- `agent-onboarding.tsx` vs `onboarding-flow.tsx`, `agent-shopping.tsx` vs `shopping-experience.tsx` — which are live vs legacy?
- No git repo — intentional?
