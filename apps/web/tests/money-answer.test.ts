import assert from "node:assert/strict";
import test from "node:test";
import { answerMoney, detectMoneyQuestion } from "../src/lib/money/answer.ts";
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
  assert.match(overview.text, /^Tháng 9: thu 25M, đã chi 10M, chuyển tiết kiệm 5M\. Chi nhiều nhất: Ăn uống 7M \(140% ngân sách\), Con 3M\./);
  assert.match(overview.text, /Nhịp chi đang trong kế hoạch 12M \(dự kiến 12,5M\)/, "12,5M / 12M = 4% chưa vượt ngưỡng 5%");
  assert.equal(overview.choices.length, 3);
  assert.match(answerMoney("category", summary, "ăn uống tháng này tiêu bao nhiêu").text, /^Ăn uống tháng 9: đã chi 7M trên ngân sách 5M \(140%\)\./);
  assert.match(answerMoney("remaining", summary).text, /còn 2M\./);
  assert.match(answerMoney("upcoming", summary).text, /Internet 450K \(còn 2 ngày\)/);
  assert.match(answerMoney("child", summary).text, /Chi cho con tháng 9: 3M — 30% tổng chi\. Con 3M\./);
  assert.match(answerMoney("savings", summary).text, /Tiết kiệm hiện 25M; tháng 9 đã chuyển thêm 5M \(20% thu nhập\)/);
  assert.match(answerMoney("balance", summary).text, /tiền mặt\/tài khoản 11M, tiết kiệm 25M/);
  const empty = answerMoney("overview", { ...summary, transactionCount: 0 });
  assert.match(empty.text, /chưa có khoản nào/);
});
