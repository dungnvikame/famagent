import assert from "node:assert/strict";
import test from "node:test";
import { guessCategory, parsePurchase } from "../src/lib/shopping/capture.ts";
import type { ItemCategory } from "../src/lib/shopping/items.ts";

const TABLE: Array<[string, ItemCategory | null]> = [
  // hygiene "sữa" is not milk
  ["mua sữa tắm Cetaphil 250k", "hygiene"], ["sua tam cho be 120k", "hygiene"], ["Sữa rửa mặt Simple", "hygiene"], ["sua rua mat cerave", "hygiene"],
  ["sữa rửa tay Lifebuoy", "hygiene"], ["sữa dưỡng thể Lipikar", "hygiene"], ["sua duong am cho be", "hygiene"],
  ["dầu gội cho bé", "hygiene"], ["kem hăm Bepanthen", "hygiene"], ["phấn rôm Johnson", "hygiene"], ["tắm bé", "hygiene"],
  // real milk still milk
  ["sữa bột Similac 350k", "milk"], ["sua meiji", "milk"], ["sữa tươi Vinamilk", "milk"], ["sữa chua Vinamilk", "milk"], ["sữa công thức Aptamil", "milk"],
  ["Nan Optipro 2", "milk"], ["mua sữa 1tr2", "milk"], ["chúng ta mua sữa Meiji", "milk"],
  // diapers: "tã", bỉm, brands; never the pronoun "ta"
  ["mua tã Bobby 300k", "diapers"], ["Tã quần Huggies size L", "diapers"], ["TÃ DÁN Merries", "diapers"], ["ta dan Merries", "diapers"], ["ta quan goon", "diapers"],
  ["bỉm Merries L64", "diapers"], ["bim pampers", "diapers"], ["mua ta bobby 300k", "diapers"], ["ta l64 690k", "diapers"], ["tả lót sơ sinh", "diapers"], ["Goon 4 bịch", "diapers"],
  ["chúng ta cần mua đồ", null], ["anh ta mua rau 100k", null], ["chung ta di cho", null], ["ta di mua do", null],
  // the rest of the table
  ["khăn ướt Bobby 135k", "wipes"], ["khan uot", "wipes"], ["bột ăn dặm Gerber", "solids"], ["cháo tươi Cây Thị", "solids"],
  ["nước giặt Omo", "household"], ["nước lau sàn", "household"], ["giấy vệ sinh", "household"], ["khăn giấy", "household"], ["nước giặt xả cho bé", "hygiene"],
  ["rau ở chợ 120k", null], ["đồ chơi lego", null],
];

test("phân loại nhóm đồ từ câu tiếng Việt, có và không dấu", () => {
  assert.ok(TABLE.length >= 30);
  for (const [phrase, expected] of TABLE) assert.equal(guessCategory(phrase), expected, phrase);
});

test("parsePurchase dùng cùng luật: sữa tắm là vệ sinh, 'chúng ta' không phải bỉm", () => {
  assert.equal(parsePurchase("vừa mua sữa tắm Cetaphil 250k", [], "2026-09-29").category, "hygiene");
  assert.equal(parsePurchase("hôm nay chúng ta mua rau 100k", [], "2026-09-29").category, "other");
  assert.equal(parsePurchase("vừa mua tã Bobby 300k", [], "2026-09-29").category, "diapers");
});
