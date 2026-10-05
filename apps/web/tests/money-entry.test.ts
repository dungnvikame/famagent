import assert from "node:assert/strict";
import test from "node:test";
import { buildEntry, type EntryInput } from "../src/lib/money/entry.ts";
import { vndCompact } from "../src/lib/money/format-vnd.ts";

const base: EntryInput = { content: "  ăn sáng ", amountText: "35k", kind: "expense", category: "Ăn uống", occurredOn: "2026-09-29" };
const id = () => "new-id";

test("typed text becomes an entry with the amount parsed and the content trimmed", () => {
  const result = buildEntry(base, id);
  assert.ok("entry" in result);
  assert.deepEqual(result.entry, { id: "new-id", occurredOn: "2026-09-29", content: "ăn sáng", category: "Ăn uống", kind: "expense", amount: 35_000, paidFrom: undefined, forChild: false, childId: undefined, note: undefined, source: "manual", recurringId: undefined, debtId: undefined });
});

test("empty content and bad amounts give the message, negatives only for savings", () => {
  assert.deepEqual(buildEntry({ ...base, content: " " }, id), { error: "Nhập nội dung khoản (ví dụ: Ăn sáng)." });
  assert.ok("error" in buildEntry({ ...base, amountText: "abc" }, id));
  assert.ok("error" in buildEntry({ ...base, amountText: "-35k" }, id));
  const withdrawal = buildEntry({ ...base, kind: "saving", category: "Rút tiết kiệm", amountText: "-698k" }, id);
  assert.ok("entry" in withdrawal && withdrawal.entry.amount === -698_000);
  const bad = buildEntry({ ...base, kind: "saving", amountText: "x" }, id);
  assert.ok("error" in bad && bad.error.includes("-698k"));
});

test("paid-from-savings only applies to expenses; child link only when for a child; empty category falls back", () => {
  const spent = buildEntry({ ...base, fromSavings: true, forChild: true, childId: "c1", category: "" }, id);
  assert.ok("entry" in spent);
  assert.equal(spent.entry.paidFrom, "savings");
  assert.equal(spent.entry.childId, "c1");
  assert.equal(spent.entry.category, "Khác");
  const income = buildEntry({ ...base, kind: "income", fromSavings: true, forChild: false, childId: "c1" }, id);
  assert.ok("entry" in income);
  assert.equal(income.entry.paidFrom, undefined);
  assert.equal(income.entry.childId, undefined);
});

test("editing keeps the id, source and recurring link", () => {
  const result = buildEntry({ ...base, existing: { id: "old", source: "recurring", recurringId: "r1" } }, id);
  assert.ok("entry" in result);
  assert.equal(result.entry.id, "old");
  assert.equal(result.entry.source, "recurring");
  assert.equal(result.entry.recurringId, "r1");
});

test("editing keeps the debt link while the entry stays a repayment", () => {
  const repay: EntryInput = { ...base, content: "Trả nợ ngân hàng", category: "Tiền trả nợ", existing: { id: "old", source: "manual", debtId: "d1" } };
  const kept = buildEntry(repay, id);
  assert.ok("entry" in kept && kept.entry.debtId === "d1");
  // Recategorised away from a repayment (or no longer an expense): it stops paying the debt down.
  const moved = buildEntry({ ...repay, category: "Ăn uống" }, id);
  assert.ok("entry" in moved && moved.entry.debtId === undefined);
  const income = buildEntry({ ...repay, kind: "income", category: "Tiền trả nợ nhận về" }, id);
  assert.ok("entry" in income && income.entry.debtId === undefined);
  // The family's own choice wins: a picked debt replaces the old one, null removes it.
  const picked = buildEntry({ ...repay, debtId: "d2" }, id);
  assert.ok("entry" in picked && picked.entry.debtId === "d2");
  const removed = buildEntry({ ...repay, debtId: null }, id);
  assert.ok("entry" in removed && removed.entry.debtId === undefined);
});

test("compact money: k / tr / tỷ, trimmed decimals", () => {
  assert.equal(vndCompact(329_000), "329k");
  assert.equal(vndCompact(45_500), "45,5k");
  assert.equal(vndCompact(13_651_000), "13,65tr");
  assert.equal(vndCompact(15_000_000), "15tr");
  assert.equal(vndCompact(1_200_000_000), "1,2 tỷ");
  assert.equal(vndCompact(-2_000_000), "2tr");
  assert.equal(vndCompact(800), "800đ");
});
