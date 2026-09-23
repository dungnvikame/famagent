# Phase 6 — catalog tooling (engineering part)

**What:** CSV validator split into a pure, tested module (`scripts/lib/catalog-csv.mjs`); importer gained `--dry-run`, full per-line error reports, provenance columns, stale-price → `unknown`, merchant-domain and slug guards; new `verify-offers.mjs` daily check; migration 0004 for attribute provenance.

**Review:** first pass BLOCK (merchant with two domains, unvalidated `merchant_domain`, stale prices published, verifier crash on one bad URL, dry-run passing rows the DB would reject, import-time `attribute_verified_at`, `--apply` hiding everything on an outage, race with a concurrent re-import, non-ISO dates). All fixed → APPROVE WITH NITS; slug-vs-DB and orphaned-offer nits also fixed.

**Lessons:** a "dry-run OK" promise must mirror every DB constraint, not just business rules. Cleanup jobs need an outage brake (>20% failure refuses `--apply`) — otherwise a network blip empties the catalog.

**Still blocked (not engineering):** data owner + source rights, Supabase dev project, 50–100 real variants with a manual sample check. Release gate unchanged.
