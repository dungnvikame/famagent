import assert from "node:assert/strict";
import test from "node:test";
import { brandsToAvoid, extractNotes, NOTES_UNAVAILABLE_REPLY, startsWithStore, unconfirmedBrandNotes, unconfirmedNoteReply, type FamilyNote } from "../src/lib/ai/notes.ts";
import { recordNotes } from "../src/lib/notes/store-server.ts";
import type { FamilyProfile } from "../src/lib/experience/types.ts";

const profile: FamilyProfile = { id: "p", children: [{ id: "c1", name: "Gold", weightKg: 11 }], pricePreference: "balanced", aiConsent: true, updatedAt: "2026-09-24T00:00:00Z" };
const brands = ["Merries", "Huggies", "Bobby"];
const note = (patch: Partial<FamilyNote>): Pick<FamilyNote, "kind" | "brand" | "text" | "status"> => ({ kind: "health", brand: "Huggies", text: "Bé Gold bị hăm khi dùng Huggies", status: "recorded", ...patch });

test("ghi chú sức khỏe chưa xác nhận không loại hãng, đã xác nhận thì loại", () => {
  assert.deepEqual(brandsToAvoid([note({ status: "recorded" })]), []);
  assert.deepEqual(brandsToAvoid([note({ status: "confirmed" })]), [{ brand: "Huggies", reason: "Bé Gold bị hăm khi dùng Huggies" }]);
  assert.deepEqual(brandsToAvoid([note({ status: "confirmed", kind: "preference" })]), [], "chỉ ghi chú sức khỏe mới loại hãng");
  assert.deepEqual(brandsToAvoid([note({ status: "confirmed", brand: undefined })]), []);
});

test("ghi chú chưa xác nhận được nói rõ trong câu trả lời, mỗi hãng một lần", () => {
  const notes = [note({ status: "recorded" }), note({ status: "recorded", text: "Bé hăm Huggies lần 2" }), note({ status: "confirmed", brand: "Bobby", text: "Bé hăm Bobby" }), note({ status: "recorded", kind: "preference", brand: "Merries" })];
  assert.deepEqual(unconfirmedBrandNotes(notes).map((item) => item.brand), ["Huggies"]);
  assert.equal(unconfirmedNoteReply(notes), "Mình đã ghi nhận “Bé Gold bị hăm khi dùng Huggies”. Bạn xác nhận ở Gia đình để mình tránh hãng Huggies nhé.");
  assert.equal(unconfirmedNoteReply([note({ status: "confirmed" })]), "");
  assert.match(NOTES_UNAVAILABLE_REPLY, /chưa kiểm tra được ghi chú sức khỏe/);
});

test("tên sàn/cửa hàng không bao giờ là hãng bỉm", () => {
  for (const store of ["Shopee", "Lazada", "Tiki", "TikTok", "TikTok Shop", "Sendo", "Bách hóa xanh", "Co.op", "Co.opmart", "Winmart", "Con Cưng", "Big C"]) {
    assert.equal(startsWithStore(store), true, store);
    const [health] = extractNotes(`Gold bị hăm khi mua ${store}`, profile, brands);
    assert.equal(health?.brand, undefined, `mua ${store}`);
    assert.equal(extractNotes(`bé dễ bị kích ứng, hay dùng ${store}`, profile, brands)[0]?.brand, undefined, `dùng ${store}`);
  }
  assert.equal(startsWithStore("Tikiwiki"), false);
  assert.equal(startsWithStore("Pampers"), false);
});

test("hãng thật vẫn được bắt, kể cả khi câu có nhắc sàn", () => {
  assert.equal(extractNotes("Gold bị hăm khi dùng Pampers mua ở Shopee", profile, brands)[0].brand, "Pampers");
  assert.equal(extractNotes("Gold bị hăm khi dùng Huggies mua ở Shopee", profile, brands)[0].brand, "Huggies", "hãng trong catalog được ưu tiên");
  assert.equal(extractNotes("Gold bị hăm khi mua Pampers Premium", profile, brands)[0].brand, "Pampers Premium");
});

test("chèn ghi chú lỗi: trả cờ failed và ghi log có ngữ cảnh, không ném lỗi", async () => {
  const warned: unknown[][] = [];
  const original = console.warn; console.warn = (...args: unknown[]) => { warned.push(args); };
  try {
    const client = { from: () => ({ insert: async () => ({ error: { code: "23505", message: "duplicate key" } }) }) };
    const result = await recordNotes(client as never, "user-1", extractNotes("Gold bị hăm khi dùng Huggies", profile, brands), "11111111-1111-4111-8111-111111111111", []);
    assert.deepEqual(result, { recorded: [], failed: true });
    assert.equal(warned.length, 1);
    const context = JSON.parse(String(warned[0][1])) as Record<string, unknown>;
    assert.equal(context.code, "23505"); assert.equal(context.conversationId, "11111111-1111-4111-8111-111111111111"); assert.equal(context.count, 1);
    assert.doesNotMatch(String(warned[0][1]), /user-1/, "không log id người dùng");
    const ok = { from: () => ({ insert: async () => ({ error: null }) }) };
    const saved = await recordNotes(ok as never, "user-1", extractNotes("Gold bị hăm khi dùng Huggies", profile, brands), null, []);
    assert.equal(saved.failed, false); assert.equal(saved.recorded.length, 1);
    assert.deepEqual(await recordNotes(ok as never, "user-1", [], null, []), { recorded: [], failed: false });
  } finally { console.warn = original; }
});
