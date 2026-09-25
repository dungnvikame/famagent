import assert from "node:assert/strict";
import test from "node:test";
import { draftsFromImage, memoryKey, parseQuickList, rememberCorrections, type QuickContext } from "../src/lib/money/quick-add.ts";
import { DEFAULT_CATEGORIES, type MoneyTransaction } from "../src/lib/money/types.ts";

const withOwn = [...DEFAULT_CATEGORIES, { name: "Sữa & bỉm", kind: "expense" as const }];
const electricity: MoneyTransaction = { id: "e1", occurredOn: "2026-09-10", content: "Tiền điện", category: "Tiền điện", kind: "expense", amount: 612_000, forChild: false, source: "recurring" };
const context = (extra: Partial<QuickContext> = {}): QuickContext => ({ today: "2026-09-24", categories: DEFAULT_CATEGORIES, existing: [], ...extra });

test("the preview's pasted list: dates carry, kinds and categories, duplicates start unselected", () => {
  const text = "12/9 ăn sáng 35k, cf highlands 45k, đổ xăng 80k\n13/9 bỉm bobby shopee 329k\n14/9 gửi tiết kiệm 5tr\n15/9 lương t9 25tr\nđiện t8 612k";
  const drafts = parseQuickList(text, context({ categories: withOwn, existing: [electricity] }));
  assert.deepEqual(drafts.map((d) => [d.occurredOn, d.content, d.kind, d.category, d.amount]), [
    ["2026-09-12", "Ăn sáng", "expense", "Ăn uống", 35_000],
    ["2026-09-12", "Cà phê highlands", "expense", "Ăn uống", 45_000],
    ["2026-09-12", "Đổ xăng", "expense", "Tiêu dùng", 80_000],
    ["2026-09-13", "Bỉm bobby shopee", "expense", "Sữa & bỉm", 329_000],
    ["2026-09-14", "Gửi tiết kiệm", "saving", "Tiết kiệm", 5_000_000],
    ["2026-09-15", "Lương tháng 9", "income", "Lương", 25_000_000],
    ["2026-09-15", "Điện tháng 8", "expense", "Tiền điện", 612_000],
  ]);
  const fuel = drafts[2];
  assert.equal(fuel.unsure, true);
  assert.equal(fuel.suggestNew, "Đi lại");
  assert.equal(drafts[3].forChild, true);
  assert.equal(drafts[6].dateNote, "ngày theo dòng trên");
  assert.match(drafts[6].dupeOf ?? "", /Tiền điện/);
  assert.equal(drafts[6].selected, false);
  assert.equal(drafts.filter((d) => d.selected).length, 6);
});

test("default child rule when the family has no own category; a family 'Đi lại' category wins", () => {
  const [diaper] = parseQuickList("bỉm merries 420k", context());
  assert.equal(diaper.category, "Con");
  assert.equal(diaper.forChild, true);
  assert.equal(diaper.dateNote, "không ghi ngày, lấy hôm nay");
  const [fuel] = parseQuickList("đổ xăng 80k", context({ categories: [...DEFAULT_CATEGORIES, { name: "Đi lại", kind: "expense" }] }));
  assert.equal(fuel.category, "Đi lại");
  assert.equal(fuel.unsure, false);
});

test("bank-style lines: signs, thousand separators, VND suffix, withdrawals", () => {
  const drafts = parseQuickList("-500,000VND chuyen tien nha\n+12.000.000 VND luong vo\nrút tiết kiệm 3tr\n1,5tr đi chợ tuần", context());
  assert.deepEqual(drafts.map((d) => [d.kind, d.amount, d.category]), [
    ["expense", 500_000, "Gia đình"],
    ["income", 12_000_000, "Lương"],
    ["saving", -3_000_000, "Rút tiết kiệm"],
    ["expense", 1_500_000, "Ăn uống"],
  ]);
});

test("remembered corrections and earlier ledger entries beat keyword rules", () => {
  const memory = { "do xang": "Gia đình" };
  assert.equal(parseQuickList("đổ xăng 80k", context({ memory }))[0].category, "Gia đình");
  const earlier: MoneyTransaction = { id: "x", occurredOn: "2026-09-02", content: "Grab đi làm", category: "Tiêu dùng", kind: "expense", amount: 40_000, forChild: false, source: "manual" };
  const [grab] = parseQuickList("grab đi làm 55k", context({ existing: [earlier] }));
  assert.equal(grab.category, "Tiêu dùng");
  assert.equal(grab.unsure, false);
});

test("lines without an amount are skipped; small numbers are not amounts; past-year dates", () => {
  const drafts = parseQuickList("ghi chú linh tinh\nbỉm size 3 329k\n28/12 quà tết 2tr", context());
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].amount, 329_000);
  assert.equal(drafts[1].occurredOn, "2025-12-28");
});

test("photo lines use the model's direction and dates", () => {
  const drafts = draftsFromImage([{ date: "2026-09-20", content: "Highlands Coffee", amount: 59_000, direction: "out" }, { date: null, content: "Nhận tiền từ Nguyen Van A", amount: 2_000_000, direction: "in" }, { date: "2026-09-30", content: "sai ngày", amount: 10_000, direction: "out" }], context());
  assert.deepEqual(drafts.map((d) => [d.occurredOn, d.kind, d.category]), [["2026-09-20", "expense", "Ăn uống"], ["2026-09-24", "income", "Khác"], ["2026-09-24", "expense", "Khác"]]);
});

test("rememberCorrections keeps only changed, selected lines", () => {
  const drafts = parseQuickList("đổ xăng 80k\nphở 50k", context());
  drafts[0].category = "Gia đình";
  assert.deepEqual(rememberCorrections({}, drafts), { "do xang": "Gia đình" });
  assert.equal(rememberCorrections({}, drafts.map((d) => ({ ...d, category: d.autoCategory }))), undefined);
  assert.equal(memoryKey("Đổ xăng xe máy 80k"), "do xang");
});

test("the owner's real lines: loans, baby items, drinks, SIM, cosmetics, a child's name", () => {
  const text = "1/1 Cọc trang trí sinh nhật Gold 500k\n1/1 Siêu thị 264,7k\n1/1 Tom vay bet 5tr\n1/1 Bỉm + giấy 859k\n1/2 Bún riêu 80k\n1/2 Váy 380k\n1/2 E sim 35k\n1/2 Cacao 50k\n1/3 Kem dưỡng + rơ lưỡi + lì xì 597k\n1/3 Đầu hút mũi 45k\n1/3 A Báu vay 3tr\n1/4 Trang trí sinh nhật Gold 149k\nvay ngân hàng 50tr\nanh Nam trả nợ 2tr\ncho chị Hà mượn 1tr";
  const drafts = parseQuickList(text, context({ children: ["Gold"] }));
  assert.deepEqual(drafts.map((d) => [d.content, d.kind, d.category]), [
    ["Cọc trang trí sinh nhật Gold", "expense", "Con"],
    ["Siêu thị", "expense", "Ăn uống"],
    ["Tom vay bet", "expense", "Tiền cho vay"],
    ["Bỉm + giấy", "expense", "Con"],
    ["Bún riêu", "expense", "Ăn uống"],
    ["Váy", "expense", "Mua sắm"],
    ["E sim", "expense", "Tiêu dùng"],
    ["Cacao", "expense", "Ăn uống"],
    ["Kem dưỡng + rơ lưỡi + lì xì", "expense", "Con"],
    ["Đầu hút mũi", "expense", "Con"],
    ["A Báu vay", "expense", "Tiền cho vay"],
    ["Trang trí sinh nhật Gold", "expense", "Con"],
    ["Vay ngân hàng", "income", "Vay ngân hàng"],
    ["Anh Nam trả nợ", "income", "Tiền trả nợ nhận về"],
    ["Cho chị Hà mượn", "expense", "Tiền cho vay"],
  ]);
  assert.equal(drafts.filter((d) => d.unsure).length, 0);
  assert.equal(drafts[0].forChild, true);
});

test("an instruction line or a header sets the kind of the lines after it", () => {
  const drafts = parseQuickList("Nhập cho tôi tất cả khoản dưới đây thành khoản Thu\n01/01/2026\tLời\t2,866\n01/01/2026\tBác Thủy trả\t200,000\n02/01/2026\tLời\t2,162\nChi:\nđổ xăng 80k", context());
  assert.deepEqual(drafts.map((d) => [d.content, d.kind, d.category, d.amount]), [
    ["Lời", "income", "Đầu tư", 2_866],
    ["Bác Thủy trả", "income", "Tiền trả nợ nhận về", 200_000],
    ["Lời", "income", "Đầu tư", 2_162],
    ["Đổ xăng", "expense", "Tiêu dùng", 80_000],
  ]);
  const plain = parseQuickList("Bác Thủy trả 200k\nlãi tiết kiệm tháng 9 1,2tr\nmua lại ốp lưng 90k", context());
  assert.deepEqual(plain.map((d) => d.kind), ["income", "income", "expense"]);
});

test("monthly-looking lines are suggested, never ticked", () => {
  const drafts = parseQuickList("tiền nhà 6tr\nlương t9 25tr\nphở 50k", context());
  assert.deepEqual(drafts.map((d) => [d.repeatHint, d.repeat]), [[true, false], [true, false], [false, false]]);
});
