import assert from "node:assert/strict";
import test from "node:test";
import { brandsToAvoid, extractNotes, newNotes } from "../src/lib/ai/notes.ts";
import { readAffirmation, resolvePending } from "../src/lib/ai/shopping/pending.ts";
import type { FamilyProfile, ShoppingIntent } from "../src/lib/experience/types.ts";

const profile: FamilyProfile = { id: "p", children: [{ id: "c1", name: "Gold", weightKg: 11 }], pricePreference: "balanced", aiConsent: true, updatedAt: "2026-09-24T00:00:00Z" };
const brands = ["Merries", "Huggies", "Bobby", "Moony"];

test("ghi nhận từ hội thoại: hăm với hãng, nơi mua quen, ưu tiên; không ghi câu tìm hàng thường", () => {
  assert.deepEqual(extractNotes("Gold bị hăm khi dùng Huggies", profile, brands).map((note) => [note.kind, note.text, note.brand]), [["health", "Bé Gold bị hăm khi dùng Huggies", "Huggies"]]);
  assert.deepEqual(extractNotes("nhà mình thường mua trên Shopee vào đợt sale", profile, brands).map((note) => note.text), ["Nhà thường mua trên Shopee vào đợt khuyến mãi"]);
  assert.deepEqual(extractNotes("bé thích Merries lắm, dùng quen rồi", profile, brands).map((note) => [note.kind, note.text]), [["preference", "Bé Gold hợp với Merries"]]);
  assert.deepEqual(extractNotes("đêm nào cũng tràn", profile, brands).map((note) => note.text), ["Bé Gold hay bị tràn ban đêm"]);
  assert.deepEqual(extractNotes("Tìm bỉm ban đêm cho Gold dưới 350k", profile, brands), []);
  assert.deepEqual(extractNotes("ok", profile, brands), []);
  const two = { ...profile, children: [...profile.children, { id: "c2", name: "Na" }] };
  assert.equal(extractNotes("bé dễ bị dị ứng", two, brands)[0].text, "Bé dễ bị dị ứng", "nhiều bé, không nêu tên → không gán bé");
});

test("không ghi trùng; hãng gây hăm bị tránh khi tư vấn", () => {
  const existing = [{ text: "bé gold bị hăm khi dùng huggies" }];
  assert.equal(newNotes(extractNotes("Gold bị hăm khi dùng Huggies", profile, brands), existing).length, 0);
  assert.deepEqual(brandsToAvoid([{ kind: "health", brand: "Huggies", text: "Bé Gold bị hăm khi dùng Huggies" }, { kind: "preference", brand: "Merries", text: "x" }]), [{ brand: "Huggies", reason: "Bé Gold bị hăm khi dùng Huggies" }]);
});

test("câu trả lời ngắn được đọc theo câu hỏi đang chờ", () => {
  assert.equal(readAffirmation("ok"), "yes"); assert.equal(readAffirmation("Được"), "yes"); assert.equal(readAffirmation("nới đi"), "yes"); assert.equal(readAffirmation("không"), "no"); assert.equal(readAffirmation("thôi"), "no");
  assert.equal(readAffirmation("bé 10kg"), null); assert.equal(readAffirmation("ok tìm bỉm ban đêm cho bé"), null);
  const pendingPrice: ShoppingIntent = { schemaVersion: "1", intentType: "discover", categoryId: "diapers", requiredAttributes: { weightKg: 11 }, constraints: { maxTotalPriceVnd: 200_000 }, preferences: {}, fieldEvidence: {}, ambiguity: [], pendingQuestion: "price" };
  assert.deepEqual(resolvePending("ok", pendingPrice), { message: "Bỏ giới hạn giá", note: "Mình nới mức giá theo ý bạn." });
  assert.equal(resolvePending("không", pendingPrice)?.message, "Xem tất cả bỉm");
  assert.equal(resolvePending("bé 12kg", pendingPrice), null);
  assert.equal(resolvePending("ok", { ...pendingPrice, pendingQuestion: undefined }), null);
  assert.equal(resolvePending("ok", { ...pendingPrice, pendingQuestion: "category" })?.message, "Tìm bỉm cho bé");
  assert.equal(resolvePending("có", { ...pendingPrice, pendingQuestion: "brand_conflict", constraints: { excludedBrands: ["Bobby"] } })?.message, "Vẫn tìm Bobby");
});
