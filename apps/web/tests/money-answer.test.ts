import assert from "node:assert/strict";
import test from "node:test";
import { answerMoney, detectMoneyPeriod, detectMoneyQuestion, isMoneyPlanEdit, MONEY_PLAN_EDIT_REPLY, summarizeWeek } from "../src/lib/money/answer.ts";
import { summarizeMonth } from "../src/lib/money/summary.ts";
import { DEFAULT_CATEGORIES, type MoneyTransaction } from "../src/lib/money/types.ts";

test("nhận diện câu hỏi tiền, không nuốt câu mua sắm", () => {
  const cases: Array<[string, ReturnType<typeof detectMoneyQuestion>]> = [
    ["Tháng này nhà tôi tiêu thế nào?", "overview"], ["thang nay tieu bao nhieu", "overview"], ["Tiền đi đâu nhiều nhất?", "category"], ["Ăn uống tháng này tiêu bao nhiêu", "category"],
    ["Còn bao nhiêu trong kế hoạch?", "remaining"], ["Khoản nào sắp đến hạn?", "upcoming"], ["Tiết kiệm được bao nhiêu rồi", "savings"], ["Chi cho con bao nhiêu?", "child"], ["Số dư còn bao nhiêu?", "balance"],
    ["Tìm bỉm ban đêm cho bé dưới 350k", null], ["nới ngân sách lên 400k", null], ["so sánh Merries và Moony", null], ["bé 10kg", null], ["xin chào", null],
  ];
  for (const [message, expected] of cases) assert.equal(detectMoneyQuestion(message), expected, message);
});

test("trả lời từ tổng hợp tháng bằng template, kèm gợi ý hỏi tiếp", () => {
  const now = new Date(2026, 8, 24);
  const tx = (occurredOn: string, kind: MoneyTransaction["kind"], amount: number, category: string, forChild = false): MoneyTransaction => ({ id: crypto.randomUUID(), occurredOn, content: category, category, kind, amount, forChild, source: "manual" });
  const summary = summarizeMonth({ month: "2026-09", settings: { openingCash: 1_000_000, openingSavings: 20_000_000, monthlyPlan: 12_000_000, categories: DEFAULT_CATEGORIES }, totals: { income: 25_000_000, expense: 10_000_000, saving: 5_000_000 }, goals: [],
    transactions: [tx("2026-09-06", "income", 25_000_000, "Lương"), tx("2026-09-06", "saving", 5_000_000, "Tiết kiệm cho con", true), tx("2026-09-10", "expense", 7_000_000, "Ăn uống"), tx("2026-09-12", "expense", 3_000_000, "Con", true)],
    budgets: [{ id: "b", category: "Ăn uống", month: "2026-09", limitAmount: 5_000_000 }], recurring: [{ id: "r", name: "Internet", category: "Tiêu dùng", kind: "expense", amount: 450_000, dayOfMonth: 26, active: true }] }, now);
  const overview = answerMoney("overview", summary);
  assert.match(overview.text, /^Tháng 9: thu 25\.000\.000đ, đã chi 10\.000\.000đ, chuyển tiết kiệm 5\.000\.000đ\. Chi nhiều nhất: Ăn uống 7\.000\.000đ \(140% ngân sách\), Con 3\.000\.000đ\./);
  // Forecast = spent so far + fixed items still due (Internet 450k on day 26) + flexible pace: 10M + 0,45M + 2,5M = 12,95M, 8% over the plan.
  assert.match(overview.text, /cuối tháng sẽ chi khoảng 12\.950\.000đ — cao hơn kế hoạch 12\.000\.000đ khoảng 8%/);
  assert.equal(overview.choices.length, 3);
  assert.match(answerMoney("category", summary, "ăn uống tháng này tiêu bao nhiêu").text, /^Ăn uống tháng 9: đã chi 7\.000\.000đ trên ngân sách 5\.000\.000đ \(140%\)\./);
  assert.match(answerMoney("remaining", summary).text, /còn 2\.000\.000đ\./);
  assert.match(answerMoney("upcoming", summary).text, /Internet 450\.000đ \(còn 2 ngày\)/);
  assert.match(answerMoney("child", summary).text, /Chi cho con tháng 9: 3\.000\.000đ — 30% tổng chi\. Con 3\.000\.000đ\./);
  assert.match(answerMoney("savings", summary).text, /Tiết kiệm hiện 25\.000\.000đ; tháng 9 đã chuyển thêm 5\.000\.000đ \(20% thu nhập\)/);
  assert.match(answerMoney("balance", summary).text, /tiền mặt\/tài khoản 11\.000\.000đ, tiết kiệm 25\.000\.000đ/);
  const empty = answerMoney("overview", { ...summary, transactionCount: 0 });
  assert.match(empty.text, /chưa có khoản nào/);
});

test("từ khoá mua sắm không nuốt câu hỏi tiền chứa 'nói', 'sửa', 'mua sắm', 'nới'", () => {
  const finance: Array<[string, ReturnType<typeof detectMoneyQuestion>]> = [
    ["Tháng này đã chi bao nhiêu cho sửa xe?", "overview"], ["Nói cho mình biết tháng này tiêu bao nhiêu", "overview"], ["Tháng này đã chi mua sắm bao nhiêu", "overview"],
    ["Nội thất tháng này tiêu bao nhiêu", "overview"], ["thang nay da chi bao nhieu", "overview"], ["tuần này chi tiêu thế nào", "overview"],
  ];
  for (const [message, expected] of finance) assert.equal(detectMoneyQuestion(message), expected, message);
  for (const message of ["Mua sữa bột cho bé hết bao nhiêu tiền", "tìm khăn ướt dưới 100k", "sữa tắm nào tốt", "bé 10kg tiêu bao nhiêu miếng một ngày", "tang ngan sach len 500k", "goi y bim cho be", "mua tã M"]) assert.equal(detectMoneyQuestion(message), null, message);
});

test("nhận diện khoảng thời gian: tuần này, tháng trước, mặc định tháng này", () => {
  assert.equal(detectMoneyPeriod("Tuần này tiêu bao nhiêu?"), "week");
  assert.equal(detectMoneyPeriod("7 ngày qua chi bao nhiêu"), "week");
  assert.equal(detectMoneyPeriod("Tháng trước nhà mình tiêu thế nào?"), "lastMonth");
  assert.equal(detectMoneyPeriod("thang truoc chi bao nhieu"), "lastMonth");
  assert.equal(detectMoneyPeriod("Tháng này tiêu thế nào?"), "month");
  assert.equal(detectMoneyPeriod("Ăn uống tiêu bao nhiêu"), "month");
});

test("cập nhật kế hoạch chi không trả lời 'còn bao nhiêu'", () => {
  for (const message of ["cập nhật kế hoạch chi 20 triệu", "Đặt kế hoạch chi tháng 25tr", "sửa kế hoạch chi thành 18 triệu", "giúp mình điều chỉnh kế hoạch 20tr"]) {
    assert.equal(detectMoneyQuestion(message), null, message);
    assert.equal(isMoneyPlanEdit(message), true, message);
  }
  assert.equal(detectMoneyQuestion("Còn bao nhiêu trong kế hoạch?"), "remaining");
  assert.equal(isMoneyPlanEdit("Còn bao nhiêu trong kế hoạch?"), false);
  assert.match(MONEY_PLAN_EDIT_REPLY.text, /Mục tiêu/);
  assert.doesNotMatch(MONEY_PLAN_EDIT_REPLY.text, /Định kỳ/);
});

const tx = (occurredOn: string, kind: MoneyTransaction["kind"], amount: number, category: string, forChild = false): MoneyTransaction => ({ id: crypto.randomUUID(), occurredOn, content: category, category, kind, amount, forChild, source: "manual" });
const ledger = [tx("2026-09-01", "expense", 9_000_000, "Ăn uống"), tx("2026-09-22", "expense", 500_000, "Ăn uống"), tx("2026-09-23", "expense", 200_000, "Ăn uống"), tx("2026-09-25", "expense", 300_000, "Con", true), tx("2026-09-28", "income", 1_000_000, "Lương"), tx("2026-09-29", "saving", 400_000, "Tiết kiệm"), tx("2026-09-29", "expense", 100_000, "Ăn uống")];
const bundle = (month: string, transactions: MoneyTransaction[], monthlyPlan?: number) => ({ month, settings: { openingCash: 0, openingSavings: 0, monthlyPlan, categories: DEFAULT_CATEGORIES }, totals: { income: 0, expense: 0, saving: 0 }, goals: [], transactions, budgets: [], recurring: [] });

test("tuần này = 7 ngày kết thúc hôm nay, ghi rõ khoảng thời gian", () => {
  const week = summarizeWeek(ledger, "2026-09-29");
  assert.equal(week.from, "2026-09-23");
  assert.deepEqual([week.expense, week.income, week.saving, week.childSpend, week.count], [600_000, 1_000_000, 400_000, 300_000, 5]);
  const summary = summarizeMonth(bundle("2026-09", ledger, 12_000_000), new Date(2026, 8, 29));
  const overview = answerMoney("overview", summary, "tuần này tiêu bao nhiêu", { period: "week", week });
  assert.match(overview.text, /^7 ngày qua \(23\/09–29\/09\): thu 1\.000\.000đ, đã chi 600\.000đ, chuyển tiết kiệm 400\.000đ\. Chi nhiều nhất: Ăn uống 300\.000đ, Con 300\.000đ\./);
  assert.match(answerMoney("category", summary, "ăn uống tuần này tiêu bao nhiêu", { period: "week", week }).text, /^Ăn uống trong 7 ngày qua \(23\/09–29\/09\): đã chi 300\.000đ\./);
  assert.match(answerMoney("child", summary, "", { period: "week", week }).text, /Chi cho con trong 7 ngày qua .*: 300\.000đ — 50% tổng chi/);
  assert.match(answerMoney("remaining", summary, "", { period: "week", week }).text, /^Mục này tính theo tháng nên mình trả lời theo tháng 9\. Kế hoạch chi tháng 9/);
  assert.match(answerMoney("overview", summary, "", { period: "week", week: summarizeWeek([], "2026-09-29") }).text, /7 ngày qua .* chưa có khoản nào/);
});

test("tuần này đi qua đầu tháng và bỏ khoản vay/trả nợ", () => {
  const across = [tx("2026-08-30", "expense", 50_000, "Ăn uống"), tx("2026-09-02", "expense", 70_000, "Ăn uống"), tx("2026-08-27", "expense", 999_000, "Ăn uống"), tx("2026-09-01", "income", 5_000_000, "Vay cá nhân")];
  const week = summarizeWeek(across, "2026-09-03");
  assert.equal(week.from, "2026-08-28");
  assert.equal(week.expense, 50_000 + 70_000, "ngày 27/8 ngoài cửa sổ 7 ngày");
  assert.equal(week.income, 0, "khoản vay không phải thu nhập");
});

test("tháng trước: trả lời bằng số của tháng trước và ghi rõ", () => {
  const august = [tx("2026-08-10", "expense", 4_000_000, "Ăn uống"), tx("2026-08-11", "income", 20_000_000, "Lương")];
  const summary = summarizeMonth(bundle("2026-08", august, 10_000_000), new Date(2026, 8, 29));
  const answer = answerMoney("overview", summary, "tháng trước tiêu thế nào", { period: "lastMonth" });
  assert.match(answer.text, /^Tháng 8 \(tháng trước\): thu 20\.000\.000đ, đã chi 4\.000\.000đ\./);
  assert.match(answerMoney("remaining", summary, "", { period: "lastMonth" }).text, /^Kế hoạch chi tháng 8 \(tháng trước\) 10\.000\.000đ, đã chi 4\.000\.000đ → còn 6\.000\.000đ\./);
});

test("lời nhắc không còn trỏ tới tab 'Định kỳ & mục tiêu' đã bỏ", () => {
  const summary = summarizeMonth(bundle("2026-09", ledger), new Date(2026, 8, 29));
  for (const text of [answerMoney("remaining", summary).text, answerMoney("upcoming", summary).text]) assert.doesNotMatch(text, /Định kỳ & mục tiêu/);
  assert.match(answerMoney("remaining", summary).text, /Tài chính → Mục tiêu/);
  assert.match(answerMoney("upcoming", summary).text, /tab Sổ/);
});
