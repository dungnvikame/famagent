import assert from "node:assert/strict";
import test from "node:test";
import { parsePosition } from "../src/lib/money/position-parse.ts";

test("the preview's paragraph → accounts, a debt with its payment, fixed items", () => {
  const parsed = parsePosition("VCB còn 28tr rưỡi, tiền mặt 3tr, sổ tiết kiệm 150tr. Đang vay mua xe TPBank còn 380tr, trả 8,2tr ngày 15. Tiền nhà 6tr, học phí bé 3,5tr, lương hai vợ chồng 30tr.");
  assert.deepEqual(parsed.accounts, [
    { name: "Vietcombank", type: "bank", amount: 28_500_000 },
    { name: "Tiền mặt", type: "cash", amount: 3_000_000 },
    { name: "Sổ tiết kiệm", type: "saving", amount: 150_000_000 },
  ]);
  assert.deepEqual(parsed.debts, [{ name: "Vay mua xe TPBank", balance: 380_000_000, monthlyPayment: 8_200_000, dueDay: 15, ratePct: undefined }]);
  assert.deepEqual(parsed.fixed, [
    { name: "Tiền nhà", kind: "expense", amount: 6_000_000, dayOfMonth: undefined },
    { name: "Học phí bé", kind: "expense", amount: 3_500_000, dayOfMonth: undefined },
    { name: "Lương hai vợ chồng", kind: "income", amount: 30_000_000, dayOfMonth: undefined },
  ]);
  assert.deepEqual(parsed.skipped, []);
});

test("debt with payment and rate in one clause; wallets; billions; unknown clauses are kept aside", () => {
  const parsed = parsePosition("nợ thẻ tín dụng 12tr\nvay mua nhà 1 tỷ 2 trả 15tr ngày 5 lãi 9%\nmomo 1,2tr\nông bà ngoại khỏe");
  assert.deepEqual(parsed.debts, [
    { name: "Nợ thẻ tín dụng", balance: 12_000_000, monthlyPayment: undefined, dueDay: undefined, ratePct: undefined },
    { name: "Vay mua nhà", balance: 1_200_000_000, monthlyPayment: 15_000_000, dueDay: 5, ratePct: 9 },
  ]);
  assert.deepEqual(parsed.accounts, [{ name: "MoMo", type: "ewallet", amount: 1_200_000 }]);
  assert.deepEqual(parsed.skipped, ["ông bà ngoại khỏe"]);
});
