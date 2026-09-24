import assert from "node:assert/strict";
import test from "node:test";
import { runOnboardingTurn, type HistoryItem, type OnboardingTurnResult, type PendingConfirmation } from "../src/lib/ai/onboarding/agent.ts";
import { extractRules, parseVnd } from "../src/lib/ai/onboarding/extract-rules.ts";
import { emptyExtraction, type TurnOutput } from "../src/lib/ai/onboarding/extraction.ts";
import { nextSlot, slotId } from "../src/lib/ai/onboarding/slots.ts";
import { validProfile } from "../src/lib/experience/validate.ts";
import type { chatJson } from "../src/lib/ai/llm/index.ts";
import type { FamilyProfile } from "../src/lib/experience/types.ts";

const NOW = new Date("2026-09-23T10:00:00Z");
const fresh = (): FamilyProfile => ({ id: "p1", children: [], pricePreference: "balanced", aiConsent: false, updatedAt: NOW.toISOString() });

/** Drives a rules-mode conversation, carrying history/pending like the client does. */
async function converse(messages: string[], start = fresh(), chat?: typeof chatJson) {
  let profile = start; let pending: PendingConfirmation[] = []; const history: HistoryItem[] = []; let result: OnboardingTurnResult | undefined;
  for (const message of messages) {
    result = await runOnboardingTurn({ message, profile, history, pending, allowAi: Boolean(chat), now: NOW }, chat);
    assert.equal(validProfile(result.profile), true, `invalid profile after "${message}"`);
    history.push({ role: "user", text: message }, { role: "assistant", text: result.reply, slot: result.activeSlot });
    profile = result.profile; pending = result.pending;
  }
  return result!;
}

const mockChat = (output: Partial<TurnOutput>, seen: string[] = []) => (async (request: { messages: Array<{ content: string }>; system: string }) => {
  seen.push(JSON.stringify(request.messages) + request.system);
  return { data: { ...emptyExtraction(), askingSlot: null, reply: null, ...output }, provider: "mock" };
}) as unknown as typeof chatJson;

test("thứ tự slot: household → child.basics → child.care → preferences → home → review", () => {
  const childId = "11111111-1111-4111-8111-111111111111";
  assert.equal(nextSlot(fresh()).kind, "household");
  const withAdults = { ...fresh(), adultsCount: 2 };
  assert.equal(nextSlot(withAdults).kind, "child.basics");
  const withChild = { ...withAdults, children: [{ id: childId, weightKg: 10 }] };
  assert.equal(nextSlot(withChild).kind, "child.care");
  const cared = { ...withChild, onboarding: { version: 2 as const, completedSlots: [`child.care:${childId}`], skippedSlots: [] } };
  assert.equal(nextSlot(cared).kind, "preferences");
  // Default pricePreference is not an answer; an explicit budget is.
  assert.equal(nextSlot({ ...cared, maxBudget: 400_000 }).kind, "home");
  assert.equal(nextSlot({ ...cared, maxBudget: 400_000, appliances: { washingMachine: "front" } }).kind, "review");
});

test("rules: câu tiếng Việt tự nhiên", () => {
  const household = extractRules("Nhà 2 vợ chồng, 1 bé");
  assert.equal(household.adultsCount, 2); assert.equal(household.childrenCount, 1);
  assert.equal(extractRules("Bé sinh tháng 3/2025", NOW).ageMonths, 18);
  assert.equal(extractRules("bé sinh ngày 10/7/2025").birthDate, "2025-07-10");
  const brands = extractRules("Đang dùng Bobby, tránh Huggies");
  assert.equal(brands.currentBrand, "Bobby"); assert.deepEqual(brands.dislikedBrands, ["Huggies"]);
  assert.deepEqual(extractRules("Tránh Huggies và Pampers").dislikedBrands, ["Huggies", "Pampers"]);
  assert.equal(extractRules("thích loại mỏng").preferredBrands, null);
  assert.equal(extractRules("bỏ qua").skip, true);
  assert.equal(extractRules("máy giặt cửa ngang").washingMachine, "front");
  assert.equal(extractRules("bé 10 ký").weightKg, 10);
  assert.equal(extractRules("dùng size L").diaperSize, "L");
  assert.deepEqual(extractRules("da hơi nhạy cảm, hay bị hăm").sensitivities, ["sensitive_skin", "rash_prone"]);
  assert.equal(extractRules("Không có gì đặc biệt").nothing, true);
  assert.equal(extractRules("Đúng rồi").confirm, true);
  assert.equal(extractRules("à bé 11kg chứ").correction, true);
});

test("rules: chỉ đánh dấu không chắc khi từ rào đứng ngay trước số đo của bé", () => {
  assert.deepEqual(extractRules("chắc tầm 10kg").uncertainFields, ["weightKg"]);
  assert.deepEqual(extractRules("hình như size L").uncertainFields, ["diaperSize"]);
  const mixed = extractRules("tầm 400k thôi, bé nặng 10kg");
  assert.deepEqual(mixed.uncertainFields, []); assert.equal(mixed.maxBudget, 400_000);
});

test("parseVnd: đơn vị tiền phổ biến, bỏ số không phải tiền", () => {
  assert.equal(parseVnd("dưới 400k"), 400_000);
  assert.equal(parseVnd("1,2 triệu"), 1_200_000);
  assert.equal(parseVnd("350.000đ"), 350_000);
  assert.equal(parseVnd("ngân sách 500"), 500_000);
  assert.equal(parseVnd("bé 14 tháng 10kg"), null);
});

test("kịch bản Gold (rules): hoàn tất ≤6 lượt, dữ liệu đúng, mỗi lượt ≤2 câu hỏi", async () => {
  const result = await converse(["2 người lớn, 1 bé", "Bé Gold 10kg, 14 tháng, size L", "Da nhạy cảm, đang dùng Bobby", "Ưu tiên chống tràn, dưới 400k", "Cửa trước"]);
  assert.equal(result.done, true);
  const [gold] = result.profile.children;
  assert.deepEqual({ name: gold.name, weightKg: gold.weightKg, diaperSize: gold.diaperSize, ageMonths: gold.ageMonths, currentBrand: gold.currentBrand }, { name: "Gold", weightKg: 10, diaperSize: "L", ageMonths: 14, currentBrand: "Bobby" });
  assert.deepEqual(gold.sensitivities, ["sensitive_skin"]);
  assert.equal(result.profile.maxBudget, 400_000); assert.equal(result.profile.mainConcern, "leak"); assert.equal(result.profile.appliances?.washingMachine, "front");
  assert.equal(result.profile.fieldMeta?.[`children.${gold.id}.weightKg`]?.source, "user_entered");
  assert.ok((result.reply.match(/\?/g) ?? []).length <= 2);
});

test("giá trị mơ hồ → hỏi xác nhận; 'Đúng' → lưu với nguồn user_confirmed", async () => {
  const asked = await converse(["Bỏ qua", "Bé chắc tầm 10kg"]);
  assert.equal(asked.pending.length, 1);
  assert.equal(asked.profile.children[0]?.weightKg, undefined);
  assert.deepEqual(asked.quickReplies, ["Đúng", "Sửa lại"]);
  const confirmed = await converse(["Bỏ qua", "Bé chắc tầm 10kg", "Đúng"]);
  const child = confirmed.profile.children[0];
  assert.equal(child.weightKg, 10);
  assert.equal(confirmed.profile.fieldMeta?.[`children.${child.id}.weightKg`]?.source, "user_confirmed");
  const retry = await converse(["Bỏ qua", "Bé chắc tầm 10kg", "Sửa lại"]);
  assert.match(retry.reply, /con số chính xác/);
  assert.equal(retry.profile.children[0]?.weightKg, undefined);
});

test("mâu thuẫn với giá trị đã xác nhận → hỏi lại; câu sửa rõ ràng → ghi đè", async () => {
  const base = await converse(["2 người lớn, 1 bé", "Bé Gold 10kg size L"]);
  const conflict = await converse(["bé Gold 12kg"], base.profile);
  assert.equal(conflict.pending.length, 1);
  assert.equal(conflict.profile.children[0].weightKg, 10);
  const corrected = await converse(["à Gold 12kg chứ"], base.profile);
  assert.equal(corrected.pending.length, 0);
  assert.equal(corrected.profile.children[0].weightKg, 12);
});

test("bỏ qua slot bắt buộc → giải thích và hỏi lại một lần; bỏ qua lần nữa mới đi tiếp; slot tùy chọn 'không có gì' → hoàn tất", async () => {
  const explained = await converse(["Bỏ qua", "Bỏ qua"]);
  assert.match(explained.reply, /cân nặng hoặc size/);
  assert.equal(explained.activeSlot.startsWith("child.basics"), true);
  const skipped = await converse(["Bỏ qua", "Bỏ qua", "Bỏ qua"]);
  assert.equal(skipped.activeSlot.startsWith("child.care"), true);
  const nothing = await converse(["Bỏ qua", "Bé 9kg", "Không có gì đặc biệt"]);
  assert.equal(nothing.activeSlot, "preferences");
});

test("xác nhận giả mạo từ client không ghi được trường ngoài danh sách", async () => {
  const start = await converse(["2 người lớn, 1 bé", "Bé 10kg"]);
  const forged: PendingConfirmation[] = [{ path: "aiConsent", value: true, label: "x" }, { path: "__proto__", value: { polluted: 1 }, label: "x" }, { path: "maxBudget", value: 10, label: "x" }, { path: "pricePreference", value: "free", label: "x" }];
  const result = await runOnboardingTurn({ message: "Đúng", profile: start.profile, history: [], pending: forged, allowAi: false, now: NOW });
  assert.equal(result.profile.aiConsent, false);
  assert.equal(result.profile.maxBudget, undefined);
  assert.equal(result.profile.pricePreference, "balanced");
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("AI: một câu nhiều ý điền ≥4 slot, giá trị sai phạm vi bị bỏ", async () => {
  const chat = mockChat({ adultsCount: 2, childrenCount: 1, childName: "Gold", weightKg: 10, diaperSize: "L", ageMonths: 14, sensitivities: ["sensitive_skin"], maxBudget: 400_000, washingMachine: "front", askingSlot: "child.care", reply: "Cảm ơn bạn!" });
  const result = await converse(["Nhà mình 2 vợ chồng, bé Gold 14 tháng 10kg dùng size L, da hơi nhạy cảm, ngân sách 400k, máy giặt cửa trước"], fresh(), chat);
  assert.equal(result.mode, "ai");
  // Every slot group answered in one message → straight to review.
  assert.equal(result.done, true);
  const [gold] = result.profile.children;
  assert.deepEqual([result.profile.adultsCount, gold.name, gold.weightKg, gold.diaperSize, gold.sensitivities?.[0], result.profile.maxBudget, result.profile.appliances?.washingMachine], [2, "Gold", 10, "L", "sensitive_skin", 400_000, "front"]);
  const wrong = await converse(["bé nặng 300kg"], fresh(), mockChat({ weightKg: 300, askingSlot: "child.basics", reply: "Ok" }));
  assert.equal(wrong.profile.children[0]?.weightKg, undefined);
});

test("AI: tên bé không được gửi tới provider; placeholder được trả lại thành tên", async () => {
  const seen: string[] = [];
  const base = await converse(["2 người lớn, 1 bé", "Bé Gold 10kg size L"]);
  const withConsent = { ...base.profile, aiConsent: true };
  const result = await converse(["Gold đang dùng Bobby"], withConsent, mockChat({ childRef: "[BE_1]", currentBrand: "Bobby", askingSlot: "preferences", reply: "Mình nhớ [BE_1] đang dùng Bobby rồi. Bạn ưu tiên giá thế nào?" }, seen));
  assert.equal(seen.some((payload) => payload.includes("Gold")), false);
  assert.match(result.reply, /Gold đang dùng Bobby/);
  assert.equal(result.profile.children[0].currentBrand, "Bobby");
});

test("AI trả toàn null → dùng rules, mode 'rules'; reply lệch slot → dùng câu mẫu", async () => {
  const empty = await converse(["Bé 10kg size L"], { ...fresh(), adultsCount: 2 }, mockChat({}));
  assert.equal(empty.mode, "rules"); assert.equal(empty.profile.children[0].weightKg, 10);
  const offSlot = await converse(["2 người lớn"], fresh(), mockChat({ adultsCount: 2, askingSlot: "home", reply: "Nhà dùng máy giặt gì?" }));
  assert.equal(offSlot.reply.includes("máy giặt"), false);
  assert.equal(slotId({ kind: "child.basics", childId: "x", required: true }), "child.basics:x");
});

// 30 opening answers seen in user research drafts; the rest of the flow is skipped.
const FIXTURES = [
  "Bé Gold 10kg size L", "bé nhà mình 9,5 ký", "con 8kg, 7 tháng", "Size M", "bé Na 12 kg dùng XL", "10kg", "bé trai 11kg size L",
  "Bé Bin 6kg, 3 tháng tuổi, size S", "cỡ M thôi", "con mình 13kg", "bé sinh ngày 10/7/2025, 10kg", "tên là Sữa, 7kg", "bé 2 tuổi, 12kg",
  "hình như size L", "chắc tầm 9kg", "bé 10kg nhưng chưa rõ size", "đang dùng size NB", "bé 4,2kg", "Bé Mít 10kg, da nhạy cảm", "XXL",
  "bé 15 kg", "size S, 5kg", "bé Gạo nặng 11 ký", "bé 16 tháng 10.5kg size L", "cân nặng 9kg", "bé mới 3kg", "size xl", "con gái 8,8kg",
  "bé Tôm 14kg, đang dùng Merries", "bé 30kg",
];

test("30 hội thoại mẫu (rules): luôn tới review, hồ sơ hợp lệ, không giá trị ngoài phạm vi", async () => {
  for (const opening of FIXTURES) {
    let profile = fresh(); let pending: PendingConfirmation[] = []; let turn: OnboardingTurnResult | undefined; const history: HistoryItem[] = [];
    const queue = ["2 người lớn, 1 bé", opening];
    for (let step = 0; step < 12 && !turn?.done; step++) {
      // After the scripted answers: confirm anything pending, skip everything else.
      const message = queue.shift() ?? (pending.length ? "Đúng" : "Bỏ qua");
      turn = await runOnboardingTurn({ message, profile, history, pending, allowAi: false, now: NOW });
      history.push({ role: "user", text: message }, { role: "assistant", text: turn.reply, slot: turn.activeSlot });
      profile = turn.profile; pending = turn.pending;
    }
    assert.equal(turn?.done, true, );
    assert.equal(validProfile(profile), true, opening);
    for (const child of profile.children) {
      if (child.weightKg !== undefined) assert.ok(child.weightKg >= 2 && child.weightKg <= 30, opening);
      if (child.diaperSize !== undefined) assert.ok(["NB", "S", "M", "L", "XL", "XXL"].includes(child.diaperSize), opening);
    }
  }
});

test("rules: các lỗi đã gặp khi review (regression)", () => {
  const noSize = extractRules("size mình không nhớ");
  assert.equal(noSize.diaperSize, null); assert.equal(noSize.skip, true);
  assert.equal(extractRules("size lớn hơn L").diaperSize, null);
  assert.equal(extractRules("bé 14 tháng 10kg").ageMonths, 14);
  assert.equal(extractRules("nhà 4 người, 2 bé").adultsCount, 2);
  assert.equal(extractRules("nhà 4 người").adultsCount, null);
  assert.equal(extractRules("ba con thích bỉm mỏng").childrenCount, null);
  assert.equal(extractRules("Không phải lo, bé 9kg").correction, false);
  assert.equal(extractRules("không phải 10kg mà 11kg").correction, true);
});

test("AI không xóa được dấu hiệu 'không chắc' mà rules đã thấy", async () => {
  const result = await converse(["Bé chắc tầm 10kg"], { ...fresh(), adultsCount: 2, aiConsent: true }, mockChat({ weightKg: 10, askingSlot: "child.care", reply: "Đã ghi 10kg" }));
  assert.equal(result.pending.length, 1);
  assert.equal(result.profile.children[0]?.weightKg, undefined);
});

test("AI: tên chưa biết nhưng có từ gợi ý ('bé gold') cũng bị che ngay lượt đầu", async () => {
  const seen: string[] = [];
  await converse(["bé gold 10kg size L"], { ...fresh(), adultsCount: 2, aiConsent: true }, mockChat({ weightKg: 10, diaperSize: "L", childName: "[BE_1]" }, seen));
  assert.equal(seen.some((payload) => /gold/i.test(payload)), false);
});

test("AI: câu trả lời nhắc số không được lưu → dùng câu mẫu; mảng rỗng của AI không che danh sách từ rules", async () => {
  const dropped = await converse(["bé nặng 45kg"], { ...fresh(), adultsCount: 2, aiConsent: true }, mockChat({ weightKg: 45, askingSlot: "child.basics", reply: "Mình ghi 45kg rồi. Size bé là gì?" }));
  assert.equal(dropped.reply.includes("45"), false);
  const merged = await converse(["Đang dùng Bobby, tránh Huggies"], (await converse(["2 người lớn, 1 bé", "Bé 10kg"])).profile, mockChat({ dislikedBrands: [], currentBrand: "Bobby", askingSlot: "preferences", reply: "Bạn ưu tiên giá thế nào?" }));
  assert.deepEqual(merged.profile.children[0].dislikedBrands, ["Huggies"]);
});

test("tên bé mới được gán cho bé đã khai báo nhưng chưa có tên, không tạo thêm bé", async () => {
  const twoKids = await converse(["2 người lớn, 2 bé", "Bé Gold 10kg size L", "Không có gì đặc biệt", "Bé Na 7kg size M"]);
  assert.equal(twoKids.profile.children.length, 2);
  assert.deepEqual(twoKids.profile.children.map((child) => child.name), ["Gold", "Na"]);
});

test("AI: placeholder của từ thường không bao giờ thành tên bé (chỉ nhận tên đã biết hoặc rules thấy)", async () => {
  for (const message of ["bé khoảng 10kg", "bé da nhạy cảm, con thích Bobby", "bé hiện 10kg size L", "bé ngoan 10kg"]) {
    const result = await converse([message], { ...fresh(), adultsCount: 2, aiConsent: true }, mockChat({ childName: "[BE_1]", childRef: "[BE_1]", weightKg: 10 }));
    assert.equal(result.profile.children[0]?.name, undefined, message);
  }
  const trusted = await converse(["Bé Gold 10kg"], { ...fresh(), adultsCount: 2, aiConsent: true }, mockChat({ childName: "[BE_1]", weightKg: 10 }));
  assert.equal(trusted.profile.children[0]?.name, "Gold");
});

test("rules: '12 bé' không bị đọc thành 2 bé", () => {
  assert.equal(extractRules("nhóm 12 bé").childrenCount, null);
  assert.equal(extractRules("nhà có 2 bé").childrenCount, 2);
});

test("'tên bé là X' được nhận là tên và bị che trước khi gửi provider", async () => {
  assert.equal(extractRules("Tên bé là Gold nhé").childName, "Gold");
  const seen: string[] = [];
  await converse(["tên bé là gold nhé, 10kg"], { ...fresh(), adultsCount: 2, aiConsent: true }, mockChat({ weightKg: 10 }, seen));
  assert.equal(seen.some((payload) => /gold/i.test(payload)), false);
});

test("tóm tắt chỉ nêu điều người dùng đã nói; lời ghi nhận nêu rõ giá trị", async () => {
  const { profileSummary } = await import("../src/lib/ai/onboarding/templates.ts");
  const result = await converse(["2 người lớn, 1 bé", "Bé Gold 10kg size L", "Không có gì đặc biệt", "Ưu tiên chống tràn, dưới 400k"]);
  assert.match(result.reply, /ưu tiên hạn chế tràn/);
  const summary = profileSummary(result.profile).join(" | ");
  // The onboarding summary lists family facts only; shopping preferences live in chat/Family page.
  assert.match(summary, /Bé Gold: 10 kg/);
  assert.doesNotMatch(summary, /Cân bằng|size|400\.000/);
  const home = await converse(["Cửa trước"], result.profile);
  assert.match(home.reply, /máy giặt cửa trước/);
});

test("từ rào không vượt qua dấu phẩy sang giá trị khác", () => {
  assert.deepEqual(extractRules("Bé Gold chắc tầm 10kg, size L").uncertainFields, ["weightKg"]);
  assert.deepEqual(extractRules("chắc tầm 10kg, 14 tháng").uncertainFields, ["weightKg"]);
});
