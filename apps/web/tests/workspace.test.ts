import assert from "node:assert/strict";
import test from "node:test";
import { routeWorkspace } from "../src/lib/ai/workspace.ts";
import { parseProfileChange } from "../src/lib/ai/profile-change.ts";
import { demoProducts } from "../src/lib/catalog/demo.ts";

test("agent mở nội dung trong hội thoại theo yêu cầu tiếng Việt", () => {
  assert.equal(routeWorkspace("Cho tôi xem hồ sơ gia đình", demoProducts)?.view.kind, "family");
  assert.equal(routeWorkspace("Xem sản phẩm đã lưu", demoProducts)?.view.kind, "saved");
  assert.equal(routeWorkspace("So sánh các lựa chọn", demoProducts)?.view.kind, "compare");
  assert.deepEqual(routeWorkspace("Xem chi tiết Dòng Êm Đêm L56", demoProducts)?.view, { kind: "product", productId: "demo-2" });
  assert.equal(routeWorkspace("Tìm bỉm ban đêm cho bé dưới 400k", demoProducts), null);
});

test("cập nhật đúng bé được nhắc tới mà không đổi bé khác", () => {
  const profile = { id: "family", children: [{ id: "gold", name: "Gold", weightKg: 10 }, { id: "silver", name: "Silver", weightKg: 8 }], pricePreference: "balanced" as const, aiConsent: false, updatedAt: "2026-09-23T00:00:00Z" };
  const updated = parseProfileChange("Bé Gold hiện nặng 11kg", profile);
  assert.equal(updated?.children[0].weightKg, 11);
  assert.equal(updated?.children[1].weightKg, 8);
  assert.equal(parseProfileChange("Tìm bỉm cho bé Gold 11kg", profile), null);
});
