import assert from "node:assert/strict";
import test from "node:test";
import { applyNoteSignals } from "../src/lib/ai/chat-notes.ts";
import { answerMoneyTurn } from "../src/lib/ai/chat-money.ts";
import { intentWithoutPending, QUOTA_NOTICE, resolveAiUse, routeChat, rulesReply, usesLlm, type ChatRoute, type QuotaResult, type RouteContext } from "../src/lib/ai/chat-routing.ts";
import { NOTES_UNAVAILABLE_REPLY } from "../src/lib/ai/notes.ts";
import { resolvePending } from "../src/lib/ai/shopping/pending.ts";
import { demoProducts } from "../src/lib/catalog/demo.ts";
import { DEFAULT_CATEGORIES, type MoneyBundle, type MoneyTransaction } from "../src/lib/money/types.ts";
import type { ChatResponse, FamilyProfile, ShoppingIntent } from "../src/lib/experience/types.ts";

const profile: FamilyProfile = { id: "p", children: [{ id: "c1", name: "Gold", weightKg: 10, diaperSize: "L" }], pricePreference: "balanced", aiConsent: true, updatedAt: "2026-09-23T00:00:00Z" };
const signedIn: RouteContext = { profile, products: demoProducts, moneyAvailable: true };
const demo: RouteContext = { ...signedIn, moneyAvailable: false };
const kind = (message: string, context = signedIn) => routeChat(message, context).kind;

test("thứ tự rẽ nhánh /api/chat: ghi mua → hỏi tiền → sửa kế hoạch → sửa hồ sơ → mở màn hình → tư vấn", () => {
  const cases: Array<[string, ChatRoute["kind"]]> = [
    ["Vừa mua 2 bịch Merries 690k ở Shopee", "purchase-log"], ["hôm qua mua 1 thùng sữa Similac 1tr2", "purchase-log"],
    ["Tháng này nhà mình tiêu thế nào?", "money-question"], ["Còn bao nhiêu trong kế hoạch?", "money-question"], ["tuần này chi tiêu bao nhiêu", "money-question"], ["Khoản nào sắp đến hạn?", "money-question"],
    ["cập nhật kế hoạch chi 20 triệu", "money-plan-edit"], ["đặt kế hoạch chi tháng 25tr", "money-plan-edit"],
    ["cập nhật cân nặng bé 9kg", "profile-edit"], ["sửa size thành M", "profile-edit"], ["đặt ngân sách 300k", "profile-edit"],
    ["Cho tôi xem hồ sơ gia đình", "navigate"], ["Xem sản phẩm đã lưu", "navigate"], ["So sánh Merries và Moony", "navigate"], ["giúp tôi với", "navigate"],
    ["muốn thay hãng khác cho bé 9kg dưới 300k", "shopping"], ["Tìm bỉm ban đêm cho bé dưới 350k", "shopping"], ["bé 10kg", "shopping"], ["ok", "shopping"], ["nới ngân sách lên 400k", "shopping"], ["Mua bỉm size M", "shopping"],
  ];
  for (const [message, expected] of cases) assert.equal(kind(message), expected, message);
});

test("ghi mua thắng câu hỏi tiền; câu hỏi tiền thắng sửa hồ sơ và điều hướng", () => {
  assert.equal(kind("Vừa mua 2 bịch Merries 690k tháng này"), "purchase-log");
  assert.equal(kind("Tháng này tiêu bao nhiêu", { ...signedIn, profile: null }), "money-question");
  assert.equal(kind("cập nhật kế hoạch chi 20 triệu", { ...signedIn, profile }), "money-plan-edit", "không rơi vào sửa hồ sơ");
});

test("chế độ demo (không tài khoản): câu hỏi tiền do trình duyệt trả lời, server không rẽ sang nhánh tiền; không có hồ sơ thì không sửa hồ sơ", () => {
  assert.equal(kind("Tháng này tiêu thế nào?", demo), "shopping");
  assert.equal(kind("cập nhật cân nặng bé 9kg", { ...demo, profile: null }), "shopping");
  assert.equal(kind("Vừa mua 2 bịch Merries 690k ở Shopee", demo), "purchase-log");
  assert.equal(kind("cập nhật kế hoạch chi 20 triệu", demo), "money-plan-edit");
});

test("period đi kèm câu hỏi tiền", () => {
  assert.deepEqual(routeChat("Tuần này tiêu bao nhiêu?", signedIn), { kind: "money-question", question: "overview", period: "week" });
  assert.deepEqual(routeChat("Tháng trước tiêu thế nào?", signedIn), { kind: "money-question", question: "overview", period: "lastMonth" });
  assert.deepEqual(routeChat("Tháng này tiêu thế nào?", signedIn), { kind: "money-question", question: "overview", period: "month" });
});

const pendingPrice: ShoppingIntent = { schemaVersion: "1", intentType: "discover", categoryId: "diapers", requiredAttributes: { weightKg: 11 }, constraints: { maxTotalPriceVnd: 200_000 }, preferences: {}, fieldEvidence: {}, ambiguity: [], pendingQuestion: "price" };

test("lượt ghi mua / trả lời tiền xoá pendingQuestion: 'ok' sau đó không nới giá cũ", () => {
  const money = rulesReply({ text: "Tháng 9: ...", choices: ["a"] }, pendingPrice, "money-rules-v1");
  assert.equal(money.intent.pendingQuestion, undefined);
  assert.deepEqual(money.intent.constraints, pendingPrice.constraints, "giữ ngữ cảnh tìm kiếm");
  assert.equal(resolvePending("ok", money.intent), null);
  assert.equal(resolvePending("ok", pendingPrice)?.message, "Bỏ giới hạn giá", "đối chứng: trước đó 'ok' nới giá");
  const purchase = rulesReply({ text: "Mình ghi lại lần mua" }, pendingPrice, "purchase-capture-v1", { purchaseDraft: { name: "Merries" } as never });
  assert.equal(purchase.intent.pendingQuestion, undefined);
  assert.equal(resolvePending("ok", purchase.intent), null);
  assert.equal(purchase.mode, "rules"); assert.equal(purchase.rankingVersion, "purchase-capture-v1"); assert.deepEqual(purchase.recommendations, []);
  assert.equal(intentWithoutPending(null).intentType, "unknown");
  assert.equal(pendingPrice.pendingQuestion, "price", "không sửa intent gốc");
});

test("hạn mức AI chỉ tính lượt có thể gọi LLM", async () => {
  const routes: ChatRoute[] = [{ kind: "purchase-log" }, { kind: "money-question", question: "overview", period: "month" }, { kind: "money-plan-edit" }, { kind: "profile-edit" }, { kind: "navigate" }];
  let consumed = 0;
  const consume = async (result: QuotaResult = "allowed") => { consumed += 1; return result; };
  for (const route of routes) { assert.equal(usesLlm(route), false, route.kind); assert.deepEqual(await resolveAiUse(route, true, consume), { allowAi: false }, route.kind); }
  assert.equal(consumed, 0, "lượt chỉ dùng luật không trừ hạn mức");
  const shopping: ChatRoute = { kind: "shopping" };
  assert.deepEqual(await resolveAiUse(shopping, false, consume), { allowAi: false });
  assert.equal(consumed, 0, "không bật AI thì cũng không trừ");
  assert.deepEqual(await resolveAiUse(shopping, true, () => consume("allowed")), { allowAi: true });
  assert.equal(consumed, 1);
});

test("hết hạn mức: vẫn trả lời bình thường bằng luật kèm thông báo, không lỗi", async () => {
  assert.deepEqual(await resolveAiUse({ kind: "shopping" }, true, async () => "exceeded"), { allowAi: false, notice: QUOTA_NOTICE });
  assert.match(QUOTA_NOTICE, /60 lượt/);
  assert.deepEqual(await resolveAiUse({ kind: "shopping" }, true, async () => "unavailable"), { allowAi: false });
});

// --- money turn: Vietnam-calendar periods -------------------------------------------------------------------------
const tx = (occurredOn: string, amount: number, category = "Ăn uống"): MoneyTransaction => ({ id: crypto.randomUUID(), occurredOn, content: category, category, kind: "expense", amount, forChild: false, source: "manual" });
const ledger = [tx("2026-09-25", 100_000), tx("2026-09-30", 200_000), tx("2026-10-01", 50_000), tx("2026-08-15", 900_000), tx("2026-12-20", 700_000), tx("2026-12-31", 10_000)];
function loader(calls: string[]) {
  return async (month: string): Promise<MoneyBundle | null> => { calls.push(month); return { month, settings: { openingCash: 0, openingSavings: 0, monthlyPlan: 5_000_000, categories: DEFAULT_CATEGORIES }, totals: { income: 0, expense: 0, saving: 0 }, goals: [], transactions: ledger.filter((item) => item.occurredOn.startsWith(month)), budgets: [], recurring: [] }; };
}

test("hỏi tiền lúc 00:30 giờ VN (17:30Z) dùng ngày/tháng Việt Nam", async () => {
  const calls: string[] = [];
  // 2026-09-30T18:00Z = 2026-10-01 01:00 in Vietnam: the month is already October.
  const answer = await answerMoneyTurn(loader(calls), "overview", "month", "tháng này tiêu bao nhiêu", new Date("2026-09-30T18:00:00Z"));
  assert.deepEqual(calls, ["2026-10"]);
  assert.match(answer!.text, /^Tháng 10: .*đã chi 50\.000đ/);
});

test("tuần này qua đầu tháng tải cả tháng trước và ghi rõ 7 ngày qua", async () => {
  let calls: string[] = [];
  const answer = await answerMoneyTurn(loader(calls), "overview", "week", "tuần này tiêu bao nhiêu", new Date("2026-09-30T18:00:00Z"));
  assert.deepEqual(calls, ["2026-10", "2026-09"]);
  assert.match(answer!.text, /^7 ngày qua \(25\/09–01\/10\): .*đã chi 350\.000đ/);
  const mid = await answerMoneyTurn(loader(calls = []), "overview", "week", "tuần này", new Date("2026-09-30T05:00:00Z"));
  assert.deepEqual(calls, ["2026-09"], "giữa tháng chỉ cần tháng này");
  assert.match(mid!.text, /^7 ngày qua \(24\/09–30\/09\): .*đã chi 300\.000đ/);
});

test("tháng trước: tải tháng trước (qua năm) và ghi rõ; số dư/hạn tới luôn theo tháng này", async () => {
  let calls: string[] = [];
  const answer = await answerMoneyTurn(loader(calls), "overview", "lastMonth", "tháng trước tiêu thế nào", new Date("2027-01-15T03:00:00Z"));
  assert.deepEqual(calls, ["2027-01", "2026-12"]);
  assert.match(answer!.text, /^Tháng 12 \(tháng trước\): .*đã chi 710\.000đ/);
  const balance = await answerMoneyTurn(loader(calls = []), "balance", "lastMonth", "số dư tháng trước", new Date("2027-01-15T03:00:00Z"));
  assert.deepEqual(calls, ["2027-01"]);
  assert.match(balance!.text, /^Số dư ước tính/);
  const week = await answerMoneyTurn(loader(calls = []), "remaining", "week", "còn bao nhiêu tuần này", new Date("2026-09-30T05:00:00Z"));
  assert.match(week!.text, /^Mục này tính theo tháng nên mình trả lời theo tháng 9\./);
});

test("không tải được sổ → null để route báo lỗi", async () => {
  assert.equal(await answerMoneyTurn(async () => null, "overview", "month", "", new Date()), null);
  let first = true;
  assert.equal(await answerMoneyTurn(async (month) => { if (first) { first = false; return loader([])(month); } return null; }, "overview", "lastMonth", "", new Date("2026-09-30T05:00:00Z")), null);
});

// --- notes on the reply --------------------------------------------------------------------------------------------
const shoppingReply = (brands: string[]): ChatResponse => ({ text: "Gợi ý cho Gold.", intent: pendingPrice, recommendations: brands.map((brand) => ({ product: { brand } })) as never, candidateCount: brands.length, candidateProductIds: [], rankingVersion: "v", mode: "rules" });

test("ghi chú sức khỏe vừa ghi nhận: nói rõ cần xác nhận, không âm thầm lọc", () => {
  const recorded = [{ text: "Bé Gold bị hăm khi dùng Huggies", kind: "health" as const, brand: "Huggies" }];
  const out = applyNoteSignals(shoppingReply(["Merries"]), { recorded, existing: [], unavailable: false });
  assert.equal(out.text, "Gợi ý cho Gold. Mình đã ghi nhận “Bé Gold bị hăm khi dùng Huggies”. Bạn xác nhận ở Gia đình để mình tránh hãng Huggies nhé.");
  assert.deepEqual(out.notesRecorded, ["Bé Gold bị hăm khi dùng Huggies"]);
  const plain = applyNoteSignals(shoppingReply(["Merries"]), { recorded: [{ text: "Bé Gold hợp với Merries", kind: "preference", brand: "Merries" }], existing: [], unavailable: false });
  assert.equal(plain.text, "Gợi ý cho Gold.", "ghi chú thường không thêm câu");
});

test("ghi chú chưa xác nhận cũ nhắc khi hãng đó đang được gợi ý", () => {
  const existing = [{ id: "n", text: "Bé hăm khi dùng Huggies", kind: "health" as const, status: "recorded" as const, brand: "Huggies", createdAt: "2026-09-01T00:00:00Z" }];
  assert.match(applyNoteSignals(shoppingReply(["Huggies", "Moony"]), { recorded: [], existing, unavailable: false }).text, /xác nhận ở Gia đình để mình tránh hãng Huggies/);
  assert.equal(applyNoteSignals(shoppingReply(["Moony"]), { recorded: [], existing, unavailable: false }).text, "Gợi ý cho Gold.");
  assert.equal(applyNoteSignals(shoppingReply(["Huggies"]), { recorded: [], existing: [{ ...existing[0], status: "confirmed" }], unavailable: false }).text, "Gợi ý cho Gold.");
});

test("tải ghi chú lỗi: gợi ý có cảnh báo hiển thị; câu không có gợi ý thì không kèm", () => {
  assert.equal(applyNoteSignals(shoppingReply(["Merries"]), { recorded: [], existing: null, unavailable: true }).text, `Gợi ý cho Gold. ${NOTES_UNAVAILABLE_REPLY}`);
  assert.equal(applyNoteSignals(shoppingReply([]), { recorded: [], existing: null, unavailable: true }).text, "Gợi ý cho Gold.");
  assert.equal(applyNoteSignals(shoppingReply(["Merries"]), { recorded: [], existing: null, unavailable: false }).text, "Gợi ý cho Gold.", "demo không có tài khoản: không cảnh báo");
});
