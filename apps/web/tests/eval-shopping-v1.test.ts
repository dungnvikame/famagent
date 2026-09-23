// Runs the versioned offline eval (evals/shopping-v1.ts). Release gate (spec v1 §21): every case keeps the
// hard invariants and its ground-truth constraints; every non-gap case meets its expectation. Known gaps are
// printed, not failed — but their ground truth still gates.
import assert from "node:assert/strict";
import test from "node:test";
import { EVAL_CASES, EVAL_CATALOG, EVAL_NOW, EVAL_VERSION, type EvalCase } from "../evals/shopping-v1.ts";
import { runShoppingTurn } from "../src/lib/ai/shopping/pipeline.ts";
import { pricePerPiece } from "../src/lib/catalog/filter.ts";
import { isOfferFresh } from "../src/lib/catalog/offer-status.ts";
import type { chatJson } from "../src/lib/ai/llm/index.ts";
import type { ChatResponse } from "../src/lib/experience/types.ts";

const numbers = (text: string) => (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((item) => item.replace(/[.,]/g, ""));

function fakeChat(llm: EvalCase["llm"]): typeof chatJson {
  return (async (request: { name: string }) => {
    if (!llm || llm.mode === "down") return null;
    if (request.name === "recommendation_summary") return { data: { summary: llm.text, followUpQuestion: null }, provider: "eval" };
    return null; // intent extraction falls back to rules
  }) as unknown as typeof chatJson;
}

/** What the case really asks for, checked against the shown products whatever the extractor understood. */
function groundTruth(item: EvalCase, response: ChatResponse): string[] {
  const problems: string[] = [];
  const { weightKg, sizeLabel, maxTotalPriceVnd, maxUnitPriceVnd, excludedProducts } = item.expect;
  for (const shown of response.recommendations) {
    const variant = shown.product.variants.find((entry) => entry.id === shown.variantId);
    const offer = variant?.offers.find((entry) => entry.id === shown.offerId);
    if (!variant || !offer) continue;
    if (weightKg !== undefined && (weightKg < shown.product.diaper.minWeightKg || weightKg > shown.product.diaper.maxWeightKg)) problems.push(`${shown.product.id}: not for ${weightKg} kg (truth)`);
    if (sizeLabel && variant.size.toUpperCase() !== sizeLabel) problems.push(`${shown.product.id}: size ≠ ${sizeLabel} (truth)`);
    if (maxTotalPriceVnd !== undefined && offer.price > maxTotalPriceVnd) problems.push(`${shown.product.id}: over ${maxTotalPriceVnd} (truth)`);
    const unit = pricePerPiece(offer, variant);
    if (maxUnitPriceVnd !== undefined && (unit === null || unit > maxUnitPriceVnd)) problems.push(`${shown.product.id}: over ${maxUnitPriceVnd}/piece (truth)`);
    if (excludedProducts?.includes(shown.product.id)) problems.push(`${shown.product.id}: excluded (truth)`);
  }
  return problems;
}

/** Hard invariants that must hold for every case, gap or not. Returns violations. */
function invariants(response: ChatResponse): string[] {
  const problems: string[] = [];
  const { intent, recommendations, text } = response;
  const { weightKg, sizeLabel } = intent.requiredAttributes;
  const { maxTotalPriceVnd, maxUnitPriceVnd } = intent.constraints;
  const excluded = new Set((intent.constraints.excludedBrands ?? []).map((brand) => brand.toLocaleLowerCase("vi")));
  if (recommendations.length > 3) problems.push("more than 3 recommendations");
  for (const item of recommendations) {
    const variant = item.product.variants.find((entry) => entry.id === item.variantId);
    const offer = variant?.offers.find((entry) => entry.id === item.offerId);
    if (!variant || !offer) { problems.push(`${item.product.id}: offer/variant mismatch`); continue; }
    if (offer.availability !== "in_stock") problems.push(`${item.product.id}: offer not in stock`);
    if (weightKg !== undefined && (weightKg < item.product.diaper.minWeightKg || weightKg > item.product.diaper.maxWeightKg)) problems.push(`${item.product.id}: weight ${weightKg} outside range`);
    if (sizeLabel && variant.size.toUpperCase() !== sizeLabel) problems.push(`${item.product.id}: size ${variant.size} ≠ ${sizeLabel}`);
    if (maxTotalPriceVnd !== undefined && offer.price > maxTotalPriceVnd) problems.push(`${item.product.id}: price over cap`);
    const unit = pricePerPiece(offer, variant);
    if (maxUnitPriceVnd !== undefined && (unit === null || unit > maxUnitPriceVnd)) problems.push(`${item.product.id}: unit price over cap`);
    if (excluded.has(item.product.brand.toLocaleLowerCase("vi"))) problems.push(`${item.product.id}: excluded brand`);
    // A verifiable (fresh) price must be preferred over a stale one of the same variant.
    const freshAlternative = variant.offers.some((entry) => entry.availability === "in_stock" && isOfferFresh(entry, EVAL_NOW) && (maxTotalPriceVnd === undefined || entry.price <= maxTotalPriceVnd));
    if (freshAlternative && !isOfferFresh(offer, EVAL_NOW)) problems.push(`${item.product.id}: stale offer chosen over a fresh one`);
  }
  // Every number in the answer must come from the request, the shown items or the catalog snapshot facts.
  const sources = new Set(numbers(JSON.stringify({ intent, candidateCount: response.candidateCount, items: recommendations.map((item) => ({ reasons: item.reasons, tradeoffs: item.tradeoffs, name: item.product.canonicalName })) })));
  for (let count = 0; count <= EVAL_CATALOG.length; count++) sources.add(String(count));
  const unsourced = numbers(text).filter((value) => !sources.has(value));
  if (unsourced.length) problems.push(`unsourced numbers in text: ${unsourced.join(", ")}`);
  if (/tốt nhất|số 1|cam kết/i.test(text)) problems.push("superlative/claim in text");
  return problems;
}

function expectationFailures(item: EvalCase, response: ChatResponse, finalState: string): string[] {
  const failures: string[] = [];
  const { expect } = item;
  const { intent, recommendations } = response;
  const check = (label: string, actual: unknown, expected: unknown) => { if (expected !== undefined && actual !== expected) failures.push(`${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`); };
  check("weightKg", intent.requiredAttributes.weightKg, expect.weightKg);
  check("sizeLabel", intent.requiredAttributes.sizeLabel, expect.sizeLabel);
  if (expect.nightUse === false) { if (intent.requiredAttributes.nightUse) failures.push("nightUse: got true, want not set"); }
  else check("nightUse", intent.requiredAttributes.nightUse, expect.nightUse);
  check("maxTotalPriceVnd", intent.constraints.maxTotalPriceVnd, expect.maxTotalPriceVnd);
  check("maxUnitPriceVnd", intent.constraints.maxUnitPriceVnd, expect.maxUnitPriceVnd);
  const outcome = finalState === "CLARIFICATION_REQUIRED" ? "clarify" : recommendations.length ? "results" : "none";
  check("outcome", outcome, expect.outcome);
  if (expect.ambiguity && !intent.ambiguity.includes(expect.ambiguity)) failures.push(`ambiguity ${expect.ambiguity} missing (${intent.ambiguity.join(",")})`);
  for (const [productId, offerId] of Object.entries(expect.chosenOffer ?? {})) {
    const shown = recommendations.find((entry) => entry.product.id === productId);
    if (!shown) failures.push(`${productId} not recommended`); else check(`${productId} offer`, shown.offerId, offerId);
  }
  if (expect.firstProduct) check("first product", recommendations[0]?.product.id, expect.firstProduct);
  for (const productId of expect.excludedProducts ?? []) if (recommendations.some((entry) => entry.product.id === productId)) failures.push(`${productId} should be excluded`);
  for (const pattern of expect.textExcludes ?? []) if (pattern.test(response.text)) failures.push(`text matches ${pattern}`);
  if (expect.summarySource === "template" && response.mode === "ai") failures.push("expected template/rules answer");
  return failures;
}

test(`${EVAL_VERSION}: hard invariants hold and expectations are met`, async () => {
  const report: Record<string, { cases: number; passed: number; gaps: number }> = {};
  const violations: string[] = []; const failures: string[] = []; const gaps: string[] = [];
  for (const item of EVAL_CASES) {
    const allowAi = Boolean(item.llm);
    const { response, finalState } = await runShoppingTurn({ message: item.message, profile: item.profile ?? null, previousIntent: item.previousIntent ?? null, products: EVAL_CATALOG, allowAi, now: EVAL_NOW }, fakeChat(item.llm));
    const group = (report[item.group] ??= { cases: 0, passed: 0, gaps: 0 });
    group.cases++;
    violations.push(...[...invariants(response), ...groundTruth(item, response)].map((problem) => `${item.id}: ${problem}`));
    const failed = expectationFailures(item, response, finalState);
    if (!failed.length) { group.passed++; if (item.knownGap) gaps.push(`${item.id}: marked as gap but passes — remove knownGap`); }
    else if (item.knownGap) { group.gaps++; gaps.push(`${item.id} (${item.knownGap}): ${failed.join("; ")}`); }
    else failures.push(`${item.id} "${item.message}": ${failed.join("; ")}`);
  }
  console.log(`\n${EVAL_VERSION} — ${EVAL_CASES.length} cases`);
  for (const [group, stats] of Object.entries(report)) console.log(`  ${group.padEnd(24)} ${stats.passed}/${stats.cases} pass${stats.gaps ? `, ${stats.gaps} known gap` : ""}`);
  if (gaps.length) console.log(`Known gaps:\n  ${gaps.join("\n  ")}`);
  assert.deepEqual(violations, [], "hard invariant violations (release gate)");
  assert.deepEqual(failures, [], "expectation failures");
});
