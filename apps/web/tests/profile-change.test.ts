import assert from "node:assert/strict";
import test from "node:test";
import { isProfileEditCommand, parseProfileChange } from "../src/lib/ai/profile-change.ts";
import { runShoppingTurn } from "../src/lib/ai/shopping/pipeline.ts";
import { demoProducts } from "../src/lib/catalog/demo.ts";
import type { FamilyProfile } from "../src/lib/experience/types.ts";

const profile: FamilyProfile = { id: "p", children: [{ id: "11111111-1111-4111-8111-111111111111", name: "Gold", weightKg: 10, diaperSize: "L" }], maxBudget: 400_000, pricePreference: "balanced", aiConsent: false, updatedAt: "2026-09-23T00:00:00Z" };

test("lệnh sửa rõ ở đầu câu → cập nhật hồ sơ", () => {
  const edits: Array<[string, (next: FamilyProfile) => boolean]> = [
    ["cập nhật cân nặng bé 9kg", (next) => next.children[0].weightKg === 9],
    ["Cập nhật Gold giờ nặng 11kg", (next) => next.children[0].weightKg === 11],
    ["sửa size thành M", (next) => next.children[0].diaperSize === "M"],
    ["đổi size sang XL", (next) => next.children[0].diaperSize === "XL"],
    ["đặt ngân sách 300k", (next) => next.maxBudget === 300_000],
    ["đổi ngân sách thành 250 nghìn", (next) => next.maxBudget === 250_000],
    ["giúp mình cập nhật ngân sách 1 triệu", (next) => next.maxBudget === 1_000_000],
    ["Chỉnh lại cân nặng của Gold là 12,5kg", (next) => next.children[0].weightKg === 12.5],
    ["cập nhật ưu tiên giá tốt", (next) => next.pricePreference === "budget"],
    ["cap nhat can nang be 9kg", (next) => next.children[0].weightKg === 9],
    ["dat ngan sach 300k", (next) => next.maxBudget === 300_000],
  ];
  for (const [message, check] of edits) {
    const next = parseProfileChange(message, profile);
    assert.ok(next, message);
    assert.ok(check(next), message);
  }
});

test("câu tìm/mua/so sánh hoặc không có lệnh ở đầu → không đụng hồ sơ", () => {
  const requests = [
    "muốn thay hãng khác cho bé 9kg dưới 300k", "đổi hãng khác cho bé 9kg", "thay bỉm khác cho bé 10kg", "tìm bỉm cho bé 9kg dưới 300k",
    "mua bỉm size M cho Gold", "cập nhật giúp mình bỉm nào rẻ hơn cho bé 9kg", "đổi sang size L có bỉm nào tốt không", "gợi ý bỉm cho bé 9kg",
    "so sánh size M và L", "sửa lại lựa chọn bỉm cho bé 9kg", "bé 9kg", "Bé Gold hiện nặng 11kg", "size M", "ngân sách 300k", "nới ngân sách lên 400k",
    "thay tã size M cho Gold", "đổi nước giặt khác", "doi hang khac cho be 9kg", "tim bim cho be 9kg duoi 300k", "cập nhật xong tìm bỉm cho bé 11kg",
  ];
  for (const message of requests) assert.equal(parseProfileChange(message, profile), null, message);
});

test("isProfileEditCommand: chỉ tính lệnh ở đầu câu", () => {
  assert.equal(isProfileEditCommand("  Sửa size thành M"), true);
  assert.equal(isProfileEditCommand("sữa bột cho bé 9kg"), false, "sữa ≠ sửa");
  assert.equal(isProfileEditCommand("bé muốn đổi size thành M"), false);
  assert.equal(isProfileEditCommand("cập nhật hãng bỉm Merries"), false);
});

test("không có hồ sơ → không có gì để sửa", () => {
  assert.equal(parseProfileChange("cập nhật cân nặng bé 9kg", null), null);
});

test("pipeline: 'muốn thay hãng khác cho bé 9kg dưới 300k' đi tìm bỉm, không sửa hồ sơ", async () => {
  const result = await runShoppingTurn({ message: "muốn thay hãng khác cho bé 9kg dưới 300k", profile, previousIntent: null, products: demoProducts, allowAi: false, now: Date.parse("2026-09-23T10:00:00Z") });
  assert.notEqual(result.finalState, "PROFILE_UPDATED");
  assert.equal(result.profileChange, undefined);
  assert.equal(result.response.profile, undefined);
  assert.ok(result.trace.some((step) => step.state === "CONTEXT_RESOLVED"), "vào luồng tư vấn");
  const edit = await runShoppingTurn({ message: "cập nhật cân nặng bé 9kg", profile, previousIntent: null, products: demoProducts, allowAi: false });
  assert.equal(edit.finalState, "PROFILE_UPDATED");
  assert.equal(edit.profileChange?.children[0].weightKg, 9);
});
