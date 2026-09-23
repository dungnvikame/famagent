import assert from "node:assert/strict";
import test from "node:test";
import { runShoppingTurn } from "../src/lib/ai/shopping/pipeline.ts";
import { upgradeIntent, mergeIntent } from "../src/lib/ai/shopping/context-merger.ts";
import { brandMentions, emptyShoppingExtraction, extractShoppingRules } from "../src/lib/ai/shopping/extract.ts";
import { composeSummary, passesFactGuard } from "../src/lib/ai/shopping/composer.ts";
import { combine, rankOffers, recommend } from "../src/lib/ranking/recommend.ts";
import { demoProducts } from "../src/lib/catalog/demo.ts";
import type { chatJson } from "../src/lib/ai/llm/index.ts";
import type { FamilyProfile } from "../src/lib/experience/types.ts";
import type { Product } from "../src/lib/catalog/types.ts";

const NOW = Date.parse("2026-09-23T10:00:00Z");
const gold = { id: "11111111-1111-4111-8111-111111111111", name: "Gold", weightKg: 10, diaperSize: "L" };
const na = { id: "22222222-2222-4222-8222-222222222222", name: "Na", weightKg: 7, diaperSize: "M" };
const profile = (patch: Partial<FamilyProfile> = {}): FamilyProfile => ({ id: "p1", children: [gold], pricePreference: "balanced", aiConsent: false, updatedAt: "2026-09-23T00:00:00Z", ...patch });
/** The route always passes previous intents through JSON + upgradeIntent; tests must do the same. */
const rt = (intent: unknown) => upgradeIntent(JSON.parse(JSON.stringify(intent)));
const turn = (message: string, extra: Partial<Parameters<typeof runShoppingTurn>[0]> = {}, chat?: typeof chatJson) =>
  runShoppingTurn({ message, profile: profile(), previousIntent: null, products: demoProducts, allowAi: false, now: NOW, ...extra }, chat);

test("'Mua bỉm cho Gold' dùng hồ sơ đã xác nhận (spec v1 §24.1)", async () => {
  const { response } = await turn("Mua bỉm ban đêm cho Gold");
  assert.equal(response.intent.requiredAttributes.weightKg, 10);
  assert.equal(response.intent.fieldEvidence.weightKg.source, "family_profile");
  assert.equal(response.intent.householdMemberRef, "Gold");
  assert.ok(response.recommendations.length > 0 && response.recommendations.length <= 3);
  for (const item of response.recommendations) {
    assert.ok(item.product.diaper.minWeightKg <= 10 && item.product.diaper.maxWeightKg >= 10);
    assert.equal(item.product.variants.find((variant) => variant.id === item.variantId)?.size, "L");
    assert.equal(item.scoreVersion, "product_score_v1");
  }
  assert.deepEqual(response.recommendations.map((item) => item.rank), response.recommendations.map((_, index) => index + 1));
});

test("tin nhắn hiện tại thắng hồ sơ; hồ sơ thắng lượt trước chỉ khi lượt trước không nói", async () => {
  const { response } = await turn("bỉm cho bé 12kg");
  assert.equal(response.intent.requiredAttributes.weightKg, 12);
  assert.equal(response.intent.fieldEvidence.weightKg.source, "user_message");
  const next = await turn("thêm dưới 400k", { previousIntent: response.intent });
  assert.equal(next.response.intent.requiredAttributes.weightKg, 12);
  assert.equal(next.response.intent.constraints.maxTotalPriceVnd, 400_000);
});

test("thương hiệu muốn tránh là lọc cứng — từ tin nhắn và từ hồ sơ", async () => {
  const fromMessage = await turn("Tìm bỉm cho bé 10kg, không dùng Nhãn mẫu A");
  assert.ok(fromMessage.response.recommendations.every((item) => item.product.brand !== "Nhãn mẫu A"));
  assert.ok(fromMessage.rejected?.some((item) => item.reasons.includes("excluded_brand")));
  const fromProfile = await turn("Mua bỉm cho Gold", { profile: profile({ children: [{ ...gold, dislikedBrands: ["Nhãn mẫu B"] }] }) });
  assert.ok(fromProfile.response.recommendations.every((item) => item.product.brand !== "Nhãn mẫu B"));
  assert.deepEqual(fromProfile.response.intent.constraints.excludedBrands, ["Nhãn mẫu B"]);
});

test("không có kết quả: nêu điều kiện làm rỗng, không tự bỏ điều kiện cứng (spec v1 §9, §24.2)", async () => {
  const { response, rejected } = await turn("bỉm cho bé 10kg dưới 200k");
  assert.equal(response.recommendations.length, 0);
  assert.match(response.text, /200\.000/);
  assert.ok(response.choices?.includes("Bỏ giới hạn giá"));
  assert.ok(rejected?.some((item) => item.reasons.includes("price_total")));
  const relaxed = await turn("Bỏ giới hạn giá", { previousIntent: response.intent });
  assert.ok(relaxed.response.recommendations.length > 0);
  assert.equal(relaxed.response.intent.constraints.maxTotalPriceVnd, undefined);
});

test("giá trần theo miếng lọc đúng đơn vị", async () => {
  const { response } = await turn("bỉm cho bé 10kg dưới 5k/miếng");
  assert.equal(response.intent.constraints.maxUnitPriceVnd, 5000);
  assert.equal(response.intent.constraints.maxTotalPriceVnd, undefined);
  for (const item of response.recommendations) {
    const variant = item.product.variants.find((entry) => entry.id === item.variantId)!;
    const offer = variant.offers.find((entry) => entry.id === item.offerId)!;
    assert.ok(offer.price / variant.quantity <= 5000);
  }
});

test("nhiều bé mà không rõ bé nào → hỏi chọn thành viên; nêu tên thì dùng đúng bé", async () => {
  const two = profile({ children: [gold, na] });
  const ask = await turn("tìm bỉm ban đêm", { profile: two });
  assert.equal(ask.finalState, "CLARIFICATION_REQUIRED");
  assert.deepEqual(ask.response.choices, ["Cho bé Gold 10kg", "Cho bé Na 7kg"]);
  const named = await turn("tìm bỉm cho Na", { profile: two });
  assert.equal(named.response.intent.requiredAttributes.weightKg, 7);
});

test("thương hiệu vừa muốn vừa bị tránh → hỏi lại trước khi tìm", async () => {
  const { response, finalState } = await turn("mua Nhãn mẫu B cho Gold", { profile: profile({ children: [{ ...gold, dislikedBrands: ["Nhãn mẫu B"] }] }) });
  assert.equal(finalState, "CLARIFICATION_REQUIRED");
  assert.equal(response.recommendations.length, 0);
  assert.match(response.text, /muốn tránh/);
});

test("intent chưa hỗ trợ trả lời 'đang phát triển', không gợi ý", async () => {
  const { response } = await turn("Mua lại bỉm như lần trước");
  assert.equal(response.intent.intentType, "reorder");
  assert.equal(response.recommendations.length, 0);
  assert.match(response.text, /lịch sử mua/);
});

test("thứ tự sản phẩm không đổi khi chỉ thay dữ liệu hoa hồng (spec v1 §24.4)", () => {
  const intent = mergeIntent(extractShoppingRules("bỉm cho bé 10kg"), null, null);
  const withCommission = demoProducts.map((product, index) => ({ ...product, affiliateCommission: 0.5 - index * 0.05, variants: product.variants.map((variant) => ({ ...variant, offers: variant.offers.map((offer) => ({ ...offer, commissionRate: index / 10 })) })) })) as Product[];
  const order = (products: Product[]) => recommend(products, intent, NOW).recommendations.map((item) => item.product.id);
  assert.deepEqual(order(withCommission), order(demoProducts));
  const affiliateSwapped = demoProducts.map((product, index) => ({ ...product, variants: product.variants.map((variant) => ({ ...variant, offers: variant.offers.map((offer) => ({ ...offer, source: index % 2 ? "affiliate" as const : "direct" as const, merchantName: `Đối tác ${index}` })) })) }));
  assert.deepEqual(order(affiliateSwapped), order(demoProducts));
});

test("thiếu dữ liệu: yêu cầu được hỏi mà không có dữ liệu chấm thấp; thành phần không có tín hiệu là unknown", () => {
  const intent = mergeIntent(extractShoppingRules("bỉm chống tràn cho bé 10kg"), null, null);
  const [first] = recommend(demoProducts, intent, NOW).recommendations;
  assert.equal(first.scores.purchaseContinuity, null);
  assert.equal(first.scores.requirementFit, 40); // demo has no absorbency data → weak fit, never a free pass
  assert.ok(first.tradeoffs.some((line) => line.includes("Chưa có dữ liệu")));
  assert.equal(combine({ requirementFit: null, householdPreferenceFit: null, evidenceQuality: 20, value: 80, purchaseContinuity: null }), 50);
});

test("xếp hạng offer chỉ so trong cùng variant: giá đã xác minh (≤48h) luôn đứng trước giá cũ", () => {
  const variant = demoProducts[1].variants[0];
  const offers = [
    { ...variant.offers[0], id: "old-cheap", price: 360000, updatedAt: "2026-09-01T00:00:00Z" },
    { ...variant.offers[0], id: "fresh", price: 365000, updatedAt: "2026-09-23T08:00:00Z", sellerRating: 4.9 },
    { ...variant.offers[0], id: "fresh-pricey", price: 420000, updatedAt: "2026-09-23T08:00:00Z" },
  ];
  assert.deepEqual(rankOffers(variant, offers, NOW).map((entry) => entry.offer.id), ["fresh", "fresh-pricey", "old-cheap"]);
});

test("fact-guard chặn giá/số bịa và lời 'tốt nhất'; LLM bịa → dùng câu mẫu", async () => {
  const facts = JSON.stringify({ items: [{ reasons: ["379.000 ₫", "56 miếng"] }] });
  assert.equal(passesFactGuard("Lựa chọn đầu 379.000đ cho 56 miếng.", facts), true);
  assert.equal(passesFactGuard("Chỉ 299.000đ thôi.", facts), false);
  assert.equal(passesFactGuard("Đây là loại tốt nhất.", facts), false);
  const intent = mergeIntent(extractShoppingRules("bỉm cho bé 10kg"), null, null);
  const items = recommend(demoProducts, intent, NOW).recommendations;
  const lying = (async () => ({ data: { summary: "Loại này chỉ 199.000đ, tốt nhất thị trường.", followUpQuestion: null }, provider: "mock" })) as unknown as typeof chatJson;
  const composed = await composeSummary(intent, 3, items, true, lying);
  assert.equal(composed.source, "template");
});

test("trace đi qua đủ trạng thái; tên bé không tới provider", async () => {
  const seen: string[] = [];
  const spy = (async (request: { messages: Array<{ content: string }> }) => { seen.push(JSON.stringify(request.messages)); return null; }) as unknown as typeof chatJson;
  const result = await turn("Mua bỉm ban đêm cho Gold", { allowAi: true, profile: profile({ aiConsent: true }) }, spy);
  assert.deepEqual(result.trace.map((step) => step.state), ["INTENT_PARSED", "CONTEXT_RESOLVED", "CANDIDATES_RETRIEVED", "HARD_FILTERED", "RANKED", "RESPONSE_VALIDATED", "RESPONDED"]);
  assert.ok(seen.length > 0);
  assert.equal(seen.some((payload) => payload.includes("Gold")), false);
});

test("upgradeIntent đọc dạng cũ và bỏ giá trị không hợp lệ từ client", () => {
  const legacy = upgradeIntent({ category: "diapers", weightKg: 10, diaperSize: "L", maxPrice: 400000, nightUse: true });
  assert.deepEqual([legacy?.requiredAttributes.weightKg, legacy?.requiredAttributes.sizeLabel, legacy?.constraints.maxTotalPriceVnd, legacy?.requiredAttributes.nightUse], [10, "L", 400000, true]);
  const forged = upgradeIntent({ schemaVersion: "1", requiredAttributes: { weightKg: 500, sizeLabel: "HUGE" }, constraints: { maxTotalPriceVnd: -1, excludedBrands: [1, "A"] } });
  assert.deepEqual([forged?.requiredAttributes.weightKg, forged?.requiredAttributes.sizeLabel, forged?.constraints.maxTotalPriceVnd, forged?.constraints.excludedBrands], [undefined, undefined, undefined, ["A"]]);
  assert.equal(upgradeIntent("nope"), null);
});

test("brandMentions: phủ định → tránh, còn lại → ưu tiên", () => {
  assert.deepEqual(brandMentions("thích Nhãn mẫu C, tránh Nhãn mẫu A", ["Nhãn mẫu A", "Nhãn mẫu C"]), { preferred: ["Nhãn mẫu C"], excluded: ["Nhãn mẫu A"], lifted: [] });
  assert.deepEqual(emptyShoppingExtraction().removePriceLimit, false);
});

test("review P5 — C1: mọi cách nói phủ định đều loại thương hiệu, không biến thành ưu tiên", () => {
  const brands = ["Nhãn mẫu A"];
  for (const message of ["không mua Nhãn mẫu A", "đừng lấy Nhãn mẫu A", "Nhãn mẫu A không hợp với bé", "bé bị hăm với Nhãn mẫu A", "Nhãn mẫu A bị tràn"]) {
    assert.deepEqual(brandMentions(message, brands).excluded, ["Nhãn mẫu A"], message);
    assert.deepEqual(brandMentions(message, brands).preferred, [], message);
  }
  assert.deepEqual(brandMentions("vẫn tìm Nhãn mẫu A", brands).lifted, ["Nhãn mẫu A"]);
  assert.deepEqual(brandMentions("bé vẫn dùng Nhãn mẫu A nhưng hay tràn", brands).lifted, []);
});

test("review P5 — C2: số miếng trong gói không thành giá mỗi miếng; giá nhỏ không đơn vị gói → giá/miếng", () => {
  assert.equal(extractShoppingRules("Tìm bỉm 10kg gói 21 miếng").maxUnitPriceVnd, null);
  assert.equal(extractShoppingRules("loại 51 miếng").maxUnitPriceVnd, null);
  assert.equal(extractShoppingRules("dưới 6.500đ/1 miếng").maxUnitPriceVnd, 6500);
  assert.equal(extractShoppingRules("bỉm dưới 8k").maxUnitPriceVnd, 8000);
});

test("review P5 — C3: cân nặng vừa nói không kết hợp với size cũ trong hồ sơ", async () => {
  const { response } = await turn("bỉm cho Gold nặng 14kg", { profile: profile({ children: [{ ...gold, diaperSize: "M" }] }) });
  assert.equal(response.intent.requiredAttributes.weightKg, 14);
  assert.equal(response.intent.requiredAttributes.sizeLabel, undefined);
  assert.ok(response.recommendations.length > 0);
});

test("review P5 — H3: hai bé trùng tên được phân biệt bằng cân nặng trong lựa chọn", async () => {
  const twins = profile({ children: [{ ...gold, name: "An" }, { ...na, name: "An" }] });
  const ask = await turn("tìm bỉm cho An", { profile: twins });
  assert.equal(ask.finalState, "CLARIFICATION_REQUIRED");
  assert.deepEqual(ask.response.choices, ["Cho bé An 10kg", "Cho bé An 7kg"]);
  const pick = await turn("Cho bé An 7kg", { profile: twins, previousIntent: rt(ask.response.intent) });
  assert.equal(pick.finalState, "RESPONDED");
  assert.equal(pick.response.intent.requiredAttributes.weightKg, 7);
});

test("review P5 — M1: không rõ bé nào → áp dụng thương hiệu tránh của mọi bé; 'Bé Gold' viết hoa vẫn nhận", async () => {
  const two = profile({ children: [{ ...gold, dislikedBrands: ["Nhãn mẫu A"] }, { ...na, dislikedBrands: ["Nhãn mẫu C"] }] });
  const selfContained = await turn("bỉm cho bé 10kg", { profile: two });
  assert.deepEqual(selfContained.response.intent.constraints.excludedBrands?.sort(), ["Nhãn mẫu A", "Nhãn mẫu C"]);
  assert.equal(extractShoppingRules("Bé Gold 10kg cần bỉm").childName, "Gold");
});

test("review P5 — M2/M3: bỏ giới hạn giá giữ qua các lượt; 'Vẫn tìm X' gỡ tránh cho cả cuộc trò chuyện", async () => {
  const first = await turn("bỉm cho bé 10kg", { profile: profile({ maxBudget: 300_000 }) });
  const removed = await turn("Bỏ giới hạn giá", { profile: profile({ maxBudget: 300_000 }), previousIntent: rt(first.response.intent) });
  const next = await turn("thêm dùng ban đêm", { profile: profile({ maxBudget: 300_000 }), previousIntent: rt(removed.response.intent) });
  assert.equal(next.response.intent.constraints.maxTotalPriceVnd, undefined);
  const newPrice = await turn("dưới 350k", { profile: profile({ maxBudget: 300_000 }), previousIntent: rt(next.response.intent) });
  assert.equal(newPrice.response.intent.constraints.maxTotalPriceVnd, 350_000);

  const disliking = profile({ children: [{ ...gold, dislikedBrands: ["Nhãn mẫu B"] }] });
  const conflict = await turn("mua Nhãn mẫu B cho Gold", { profile: disliking });
  assert.ok(conflict.response.choices?.includes("Vẫn tìm Nhãn mẫu B"));
  const lifted = await turn("Vẫn tìm Nhãn mẫu B", { profile: disliking, previousIntent: rt(conflict.response.intent) });
  assert.equal(lifted.response.intent.constraints.excludedBrands, undefined);
  const later = await turn("thêm dùng ban đêm", { profile: disliking, previousIntent: rt(lifted.response.intent) });
  assert.equal(later.response.intent.constraints.excludedBrands, undefined);
});

test("review P5 — M4: lý do loại theo sản phẩm; size chỉ khi không có variant nào đúng size", () => {
  const multi: Product = { ...demoProducts[1], id: "multi", variants: [{ ...demoProducts[1].variants[0], id: "v-l" }, { ...demoProducts[1].variants[0], id: "v-m", size: "M" }] };
  const intent = mergeIntent(extractShoppingRules("bỉm size L cho bé 10kg dưới 100k"), null, null);
  const [rejection] = recommend([multi], intent, NOW).rejected;
  assert.deepEqual(rejection.reasons, ["price_total"]);
});

test("review P5 — H1: fact-guard chặn thương hiệu ngoài kết quả, claim không nguồn, % bịa và đảo thứ tự", () => {
  const facts = JSON.stringify({ items: [{ name: "A1", brand: "Hãng A", tradeoffs: ["rẻ hơn khoảng 12%"] }, { name: "B1", brand: "Hãng B" }], weight: 10 });
  const context = { items: [{ name: "A1", brand: "Hãng A" }, { name: "B1", brand: "Hãng B" }], catalog: [{ name: "A1", brand: "Hãng A" }, { name: "B1", brand: "Hãng B" }, { name: "C1", brand: "Hãng C" }] };
  assert.equal(passesFactGuard("Mình gợi ý A1 trước, B1 là lựa chọn tiếp theo.", facts, context), true);
  assert.equal(passesFactGuard("Hãng C cũng đáng cân nhắc.", facts, context), false);
  assert.equal(passesFactGuard("A1 siêu mỏng.", facts, context), false);
  assert.equal(passesFactGuard("B1 rẻ hơn 10%.", facts, context), false);
  assert.equal(passesFactGuard("B1 phù hợp hơn A1.", facts, context), false);
});

test("review P5 — gỡ tránh chỉ khi trả lời câu hỏi xung đột; 'tránh X' ở lượt sau luôn loại lại", async () => {
  const disliking = profile({ children: [{ ...gold, dislikedBrands: ["Nhãn mẫu A"] }] });
  // A descriptive sentence never lifts a confirmed dislike.
  const described = await turn("bé vẫn dùng Nhãn mẫu A nhưng hay tràn, tìm bỉm khác cho Gold", { profile: disliking });
  assert.ok(described.response.recommendations.every((item) => item.product.brand !== "Nhãn mẫu A"));
  // "Vẫn tìm X" without a preceding conflict question does not lift either.
  const unprompted = await turn("Vẫn tìm Nhãn mẫu A cho Gold", { profile: disliking });
  assert.notEqual(unprompted.response.intent.constraints.liftedBrands?.length, 1);
  // After the conflict question it lifts; a later "tránh X" re-excludes.
  const conflict = await turn("mua Nhãn mẫu A cho Gold", { profile: disliking });
  const lifted = await turn("Vẫn tìm Nhãn mẫu A", { profile: disliking, previousIntent: rt(conflict.response.intent) });
  assert.deepEqual(lifted.response.intent.constraints.liftedBrands, ["Nhãn mẫu A"]);
  assert.ok(lifted.response.recommendations.some((item) => item.product.brand === "Nhãn mẫu A"));
  const reExcluded = await turn("thôi, tránh Nhãn mẫu A ra", { profile: disliking, previousIntent: rt(lifted.response.intent) });
  assert.ok(reExcluded.response.intent.constraints.excludedBrands?.includes("Nhãn mẫu A"));
  assert.ok(reExcluded.response.recommendations.every((item) => item.product.brand !== "Nhãn mẫu A"));
});
