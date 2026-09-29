import assert from "node:assert/strict";
import test from "node:test";
import { hasOutlook, outlook, outlookMonths } from "../src/lib/money/outlook.ts";
import { summarizeMonth } from "../src/lib/money/summary.ts";
import { DEFAULT_CATEGORIES, type MoneyBundle, type MoneyRecurring, type MoneyTransaction } from "../src/lib/money/types.ts";

const now = new Date(2026, 8, 15, 10); // 15/09/2026, day 15 of 30
let n = 0;
const tx = (occurredOn: string, amount: number, category: string): MoneyTransaction => ({ id: `t${++n}`, occurredOn, content: category, category, kind: "expense", amount, forChild: false, source: "manual" });
const item = (id: string, name: string, kind: MoneyRecurring["kind"], category: string, amount: number, patch: Partial<MoneyRecurring> = {}): MoneyRecurring => ({ id, name, kind, category, amount, dayOfMonth: 1, active: true, ...patch });
const salary = item("r-pay", "Lương", "income", "Lương", 25_000_000);
const rent = item("r-rent", "Tiền nhà", "expense", "Gia đình", 8_000_000);
const insurance = item("r-ins", "Bảo hiểm nhân thọ", "expense", "Tiêu dùng", 12_000_000, { schedule: { kind: "year", month: 12 } });
// Three earlier months of 10tr spending, Ăn uống 2tr of it.
const history = ["2026-06", "2026-07", "2026-08"].map((month) => ({ month, income: 25_000_000, expense: 10_000_000, saving: 0, byCategory: { "Ăn uống": 2_000_000, "Gia đình": 8_000_000 } }));
const bundle = (patch: Partial<MoneyBundle> = {}, transactions: MoneyTransaction[] = []): MoneyBundle => ({
  month: "2026-09", settings: { openingCash: 0, openingSavings: 5_000_000, monthlySaving: 5_000_000, categories: DEFAULT_CATEGORIES },
  transactions, totals: { income: 0, expense: 0, saving: 0 }, budgets: [], recurring: [salary, rent, insurance], goals: [], history, ...patch,
});
const run = (b: MoneyBundle) => outlook(b, summarizeMonth(b, now), now);
const ids = (b: MoneyBundle) => run(b).tips.map((tip) => tip.id);

test("3 tháng tới: sau tháng hiện tại; tháng của bundle ở tương lai thì tính sau nó", () => {
  assert.deepEqual(outlookMonths({ month: "2026-09" }, now), ["2026-10", "2026-11", "2026-12"]);
  assert.deepEqual(outlookMonths({ month: "2026-07" }, now), ["2026-10", "2026-11", "2026-12"]);
  assert.deepEqual(outlookMonths({ month: "2026-12" }, now), ["2027-01", "2027-02", "2027-03"]);
  const { months } = run(bundle());
  assert.deepEqual(months.map((row) => row.month), ["2026-10", "2026-11", "2026-12"]);
  // 25 thu − 8 cố định − 12 linh hoạt (kế hoạch 20) − 5 tiết kiệm = 0; tháng 12 thêm bảo hiểm 12tr.
  assert.equal(months[0].left, 0);
  assert.deepEqual(months[2].lumps, [{ name: "Bảo hiểm nhân thọ", amount: 12_000_000 }]);
  assert.equal(months[2].left, -12_000_000);
});

test("hasOutlook cần khoản cố định đang dùng và một kế hoạch", () => {
  assert.equal(hasOutlook(bundle(), now), true);
  assert.equal(hasOutlook(bundle({ recurring: [] }), now), false);
  assert.equal(hasOutlook(bundle({ recurring: [{ ...salary, active: false }] }), now), false);
  assert.equal(hasOutlook(bundle({ settings: { openingCash: 0, openingSavings: 0, categories: DEFAULT_CATEGORIES } }), now), false);
});

test("thiếu tiền: tháng có left < 0 nêu khoản lớn nhất và quỹ tiết kiệm", () => {
  const tip = run(bundle()).tips.find((row) => row.id === "shortfall")!;
  assert.equal(tip.tone, "warn");
  assert.equal(tip.title, "Tháng 12 dự kiến thiếu 12tr vì Bảo hiểm nhân thọ (12tr)");
  assert.match(tip.detail, /Quỹ tiết kiệm hiện có 5tr — chưa đủ bù/);
  assert.deepEqual(tip.action, { label: "Xem khoản cố định", target: "plan" });
  const rich = run(bundle({ settings: { openingCash: 0, openingSavings: 40_000_000, monthlySaving: 5_000_000, categories: DEFAULT_CATEGORIES } })).tips.find((row) => row.id === "shortfall")!;
  assert.match(rich.detail, /đủ bù nếu lấy từ quỹ/);
  // Không khoản quý/năm → không thiếu; không có khoản thu → không kết luận gì.
  assert.ok(!ids(bundle({ recurring: [salary, rent] })).includes("shortfall"));
  assert.ok(!ids(bundle({ recurring: [rent, insurance] })).includes("shortfall"));
});

test("nhóm chi cao: nhịp cuối tháng > 130% trung bình 3 tháng và đã chi ≥ 300k", () => {
  // 1,5tr trong 15 ngày → ~3tr cuối tháng so với trung bình 2tr = +50%.
  const tip = run(bundle({}, [tx("2026-09-05", 1_500_000, "Ăn uống")])).tips.find((row) => row.id === "pace-Ăn uống")!;
  assert.equal(tip.title, "Ăn uống đang chi cao hơn trung bình 3 tháng 50%");
  assert.match(tip.detail, /Đã chi 1\.500\.000đ trong 15 ngày đầu; với nhịp này cuối tháng ~3tr, trung bình 3 tháng là 2tr/);
  assert.deepEqual(tip.action, { label: "Xem khoản chi", target: "ledger", category: "Ăn uống" });
  assert.ok(!ids(bundle({}, [tx("2026-09-05", 1_000_000, "Ăn uống")])).includes("pace-Ăn uống"), "2tr cuối tháng = đúng trung bình");
  assert.ok(!ids(bundle({}, [tx("2026-09-05", 250_000, "Ăn uống")])).some((id) => id.startsWith("pace")), "dưới 300k");
  assert.ok(!ids(bundle({ history: [] }, [tx("2026-09-05", 1_500_000, "Ăn uống")])).some((id) => id.startsWith("pace")), "không có lịch sử");
  // Khoản của một mục cố định (tiền nhà) chỉ đến một lần: không nhân theo nhịp ngày.
  assert.ok(!ids(bundle({}, [tx("2026-09-01", 8_000_000, "Gia đình")])).some((id) => id.startsWith("pace")));
  // Đầu tháng nhịp chưa đáng tin; tháng khác tháng hiện tại không có nhịp.
  const early = new Date(2026, 8, 3, 10); const b = bundle({}, [tx("2026-09-02", 1_500_000, "Ăn uống")]);
  assert.ok(!outlook(b, summarizeMonth(b, early), early).tips.some((row) => row.id.startsWith("pace")));
  const past = bundle({ month: "2026-08" }, [tx("2026-08-05", 1_500_000, "Ăn uống")]);
  assert.ok(!outlook(past, summarizeMonth(past, now), now).tips.some((row) => row.id.startsWith("pace")));
});

test("quỹ dự phòng: dưới 3 tháng chi tiêu thì nhắc, đủ hoặc chưa có lịch sử thì im", () => {
  const tip = run(bundle()).tips.find((row) => row.id === "reserve")!;
  assert.equal(tip.title, "Quỹ dự phòng mới đủ 0,5 tháng chi tiêu"); // 5tr / 10tr
  assert.equal(tip.tone, "warn");
  assert.match(tip.detail, /chi tiêu trung bình 10tr mỗi tháng.*ít nhất 3 tháng \(khoảng 30tr\)/);
  assert.deepEqual(tip.action, { label: "Mở kế hoạch", target: "plan" });
  const mid = run(bundle({ settings: { openingCash: 0, openingSavings: 20_000_000, monthlySaving: 5_000_000, categories: DEFAULT_CATEGORIES } })).tips.find((row) => row.id === "reserve")!;
  assert.equal(mid.title, "Quỹ dự phòng mới đủ 2 tháng chi tiêu");
  assert.equal(mid.tone, "info");
  assert.ok(!ids(bundle({ settings: { openingCash: 0, openingSavings: 30_000_000, monthlySaving: 5_000_000, categories: DEFAULT_CATEGORIES } })).includes("reserve"), "đúng 3 tháng thì đủ");
  assert.ok(!ids(bundle({ history: [] })).includes("reserve"));
});

test("tối đa 3 gợi ý, theo thứ tự thiếu tiền → nhóm chi cao → quỹ dự phòng", () => {
  const tips = run(bundle({}, [tx("2026-09-05", 1_500_000, "Ăn uống")])).tips;
  assert.deepEqual(tips.map((tip) => tip.id), ["shortfall", "pace-Ăn uống", "reserve"]);
  assert.ok(tips.every((tip) => tip.action && ["plan", "ledger", "debt"].includes(tip.action.target)));
  assert.deepEqual(run(bundle({ recurring: [], history: [] })).tips, []);
});
