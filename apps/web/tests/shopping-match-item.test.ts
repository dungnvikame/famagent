import assert from "node:assert/strict";
import test from "node:test";
import { matchItem, type ShoppingItem } from "../src/lib/shopping/items.ts";

const item = (id: string, name: string, patch: Partial<ShoppingItem> = {}): ShoppingItem => ({ id, name, category: "other", unit: "gói", packSize: 1, status: "active", ...patch });
const merriesL = item("l", "Bỉm Merries L", { category: "diapers", brand: "Merries" });
const merriesM = item("m", "Bỉm Merries M", { category: "diapers", brand: "Merries" });
const giat = item("giat", "Nước giặt");
const omo = item("omo", "Nước giặt Omo 3,7kg");
const meiji = item("meiji", "Sữa Meiji", { brand: "Meiji" });
const khan = item("khan", "Khăn ướt cho bé Bobby");
const id = (text: string, items: ShoppingItem[]) => matchItem(text, items)?.id;

test("không khớp nhầm: nước mắm không phải nước giặt", () => {
  assert.equal(id("nước mắm", [giat]), undefined);
  assert.equal(id("mua nước mắm Chinsu 45k", [giat, omo]), undefined);
  assert.equal(id("nước rửa chén", [giat]), undefined);
});

test("từ đơn ký tự, số và từ đệm (bé, cho, của, loại) không tính là trùng", () => {
  assert.equal(id("bé L 64", [merriesL]), undefined);
  assert.equal(id("dầu gội cho bé", [khan]), undefined);
  assert.equal(id("loại của bé cho con", [khan]), undefined);
  assert.equal(id("size L 64 miếng", [merriesL]), undefined);
});

test("khớp đúng: cần từ nhận diện (2 từ, hoặc 1 nếu món chỉ có 1), hoặc hãng", () => {
  assert.equal(id("nước giặt", [giat]), "giat");
  assert.equal(id("nước giặt Omo 690k", [giat, omo]), "omo");
  assert.equal(id("giặt Omo", [omo]), "omo");
  assert.equal(id("merries l", [merriesL]), "l");
  assert.equal(id("Merries 690k ở Shopee", [merriesL]), "l");
  assert.equal(id("sữa meiji", [meiji]), "meiji");
  assert.equal(id("Meiji 1tr2", [meiji]), "meiji");
  assert.equal(id("khăn ướt Bobby", [khan]), "khan");
});

test("không khớp món khác hãng hoặc khác loại", () => {
  assert.equal(id("sữa meiji", [merriesL]), undefined);
  assert.equal(id("bỉm Huggies", [merriesL]), undefined);
  assert.equal(id("sữa Similac", [meiji]), undefined);
  assert.equal(id("sữa tắm", [meiji]), undefined);
});

test("chữ size chỉ để chọn giữa các món cùng hãng", () => {
  assert.equal(id("Merries M 690k", [merriesL, merriesM]), "m");
  assert.equal(id("Merries L 690k", [merriesM, merriesL]), "l");
});

test("món có nhiều từ nhận diện hơn khớp trước món chung chung", () => {
  assert.equal(id("nước giặt Omo", [giat, omo]), "omo");
});
