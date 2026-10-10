import assert from "node:assert/strict";
import test from "node:test";
import { tripRemindersFor } from "../src/lib/push/travel-reminders.ts";
import { ledgerIdForTripExpense, transactionForTripExpense } from "../src/lib/travel/expense-store-server.ts";
import { travelHomeCard } from "../src/lib/travel/home-card.ts";
import { suggestPacking } from "../src/lib/travel/packing-template.ts";
import type { TripMember } from "../src/lib/travel/trip-members.ts";
import { childAgeMonths } from "../src/lib/travel/trip-members.ts";
import { cleanSuggestions, suggestSystem, validSuggestRequest } from "../src/lib/travel/suggest-ai.ts";
import { bucketBudgets, countdownDays, nextAction, orderTrips, suggestTripName, tripDays, tripNights, tripPhase, tripReadiness, tripRecap } from "../src/lib/travel/trip-state.ts";
import type { Trip, TripExpense } from "../src/lib/travel/types.ts";
import { validExpense, validItineraryEntry, validPackingItem, validTrip } from "../src/lib/travel/validate.ts";

const trip = (patch: Partial<Trip> = {}): Trip => ({ id: "11111111-1111-4111-8111-111111111111", name: "Đà Nẵng cuối năm", destination: "Đà Nẵng", destType: "beach", startDate: "2026-11-20", endDate: "2026-11-23", status: "planning", budgetAmount: 15_000_000, pushEnabled: true, ...patch });

test("trip dates: days, nights, countdown, phase", () => {
  assert.deepEqual(tripDays(trip()), ["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"]);
  assert.equal(tripNights(trip()), 3);
  assert.equal(countdownDays(trip(), "2026-10-10"), 41);
  assert.equal(countdownDays(trip(), "2026-11-20"), 0);
  assert.equal(tripPhase(trip(), "2026-10-10"), "planning");
  assert.equal(tripPhase(trip(), "2026-11-21"), "ongoing");
  assert.equal(tripPhase(trip(), "2026-11-24"), "done");
  assert.equal(tripPhase(trip({ status: "cancelled" }), "2026-10-10"), "cancelled");
});

test("suggestTripName picks the season of the departure month", () => {
  assert.equal(suggestTripName("Đà Nẵng", "2027-06-15"), "Đà Nẵng hè 2027");
  assert.equal(suggestTripName("Sa Pa", "2026-11-20"), "Sa Pa cuối năm 2026");
  assert.equal(suggestTripName("Về quê", "2027-02-10"), "Về quê đầu năm 2027");
});

test("bucketBudgets follows the split and defaults to 35/25/25/10/5", () => {
  assert.deepEqual(bucketBudgets(trip()), { transport: 5_250_000, lodging: 3_750_000, food: 3_750_000, activity: 1_500_000, misc: 750_000 });
  assert.equal(bucketBudgets(trip({ budgetSplit: { transport: 50 } })).transport, 7_500_000);
  assert.equal(bucketBudgets(trip({ budgetSplit: { transport: 50 } })).lodging, 0);
});

test("readiness counts planned days, packed items and budget use; nextAction prioritises packing near departure", () => {
  const entries = [
    { id: "e1", tripId: trip().id, dayDate: "2026-11-20", position: 0, title: "Bay", estAmount: 0 },
    { id: "e2", tripId: trip().id, dayDate: "2026-11-21", position: 0, title: "Bà Nà", estAmount: 2_600_000 },
    { id: "e3", tripId: trip().id, dayDate: undefined, position: 0, title: "Bảo tàng", estAmount: 0 },
  ];
  const packing = [
    { id: "p1", tripId: trip().id, name: "Bỉm", qty: 24, category: "kids" as const, status: "packed" as const, source: "template" as const },
    { id: "p2", tripId: trip().id, name: "Khăn ướt", qty: 3, category: "kids" as const, status: "todo" as const, source: "template" as const },
    { id: "p3", tripId: trip().id, name: "Phao", qty: 1, category: "clothes" as const, status: "buy_there" as const, source: "manual" as const },
  ];
  const expenses: TripExpense[] = [{ id: "x1", tripId: trip().id, occurredOn: "2026-10-02", content: "Vé máy bay", bucket: "transport", amount: 4_200_000 }];
  const ready = tripReadiness(trip(), entries, packing, expenses);
  assert.deepEqual([ready.daysPlanned, ready.daysTotal, ready.packed, ready.packLeft, ready.packTotal], [2, 4, 1, 1, 3]);
  assert.equal(ready.budgetPct, 28);
  assert.equal(nextAction(ready, 5).tab, "packing");
  assert.equal(nextAction(ready, 20).tab, "itin");
  assert.equal(nextAction({ ...ready, packLeft: 0, daysPlanned: 4 }, 5).label, "Mọi thứ sẵn sàng 🎉");
  assert.equal(nextAction(ready, -1).tab, "money");
});

test("orderTrips: upcoming soonest-first, past latest-first", () => {
  const a = trip({ id: "11111111-1111-4111-8111-111111111112", startDate: "2026-12-01", endDate: "2026-12-03" });
  const b = trip();
  const done = trip({ id: "11111111-1111-4111-8111-111111111113", startDate: "2026-06-01", endDate: "2026-06-04" });
  const { active, past } = orderTrips([a, b, done], "2026-10-10");
  assert.deepEqual(active.map((entry) => entry.id), [b.id, a.id]);
  assert.deepEqual(past.map((entry) => entry.id), [done.id]);
});

test("validTrip: happy path, defaults, and rejects", () => {
  const ok = validTrip({ id: trip().id, name: "Đà Nẵng", destination: "Đà Nẵng", startDate: "2026-11-20", endDate: "2026-11-23", budgetAmount: 15_000_000 });
  assert.ok(ok);
  assert.equal(ok!.destType, "other");
  assert.equal(ok!.pushEnabled, true);
  assert.equal(validTrip({ ...ok, endDate: "2026-11-19" }), null);
  assert.equal(validTrip({ ...ok, budgetSplit: { transport: 120 } }), null);
  assert.equal(validTrip({ ...ok, links: [{ label: "Vé", url: "javascript:alert(1)" }] }), null);
  assert.ok(validTrip({ ...ok, links: [{ label: "Vé", url: "https://x.vn" }], pushEnabled: false })!.pushEnabled === false);
});

test("validItineraryEntry and validPackingItem guard ranges", () => {
  const base = { id: trip().id, tripId: trip().id };
  assert.ok(validItineraryEntry({ ...base, title: "Bà Nà", estAmount: "2600000" }));
  assert.equal(validItineraryEntry({ ...base, title: "" }), null);
  assert.equal(validItineraryEntry({ ...base, title: "x", dayDate: "20/11/2026" }), null);
  assert.ok(validPackingItem({ ...base, name: "Bỉm", qty: 24, category: "kids" }));
  assert.equal(validPackingItem({ ...base, name: "Bỉm", qty: 0 }), null);
  assert.equal(validPackingItem({ ...base, name: "Bỉm", category: "nope" }), null);
});

test("validExpense requires content, bucket, amount, day", () => {
  const ok = validExpense({ id: trip().id, tripId: trip().id, occurredOn: "2026-10-10", content: "Ăn hải sản", bucket: "food", amount: 850_000 });
  assert.ok(ok);
  assert.equal(validExpense({ ...ok, amount: -5 }), null);
  assert.equal(validExpense({ ...ok, bucket: "fun" }), null);
});

test("childAgeMonths grows ageMonths from ageAsOf and prefers birthDate", () => {
  assert.equal(childAgeMonths({ birthDate: "2025-04-10" }, "2026-10-10"), 18);
  assert.equal(childAgeMonths({ ageMonths: 12, ageAsOf: "2026-04-10" }, "2026-10-10"), 18);
  assert.equal(childAgeMonths({ ageMonths: 12 }, "2026-10-10"), 12);
  assert.equal(childAgeMonths({}, "2026-10-10"), undefined);
});

const members: TripMember[] = [
  { id: "me", label: "Bố", kind: "adult" },
  { id: "22222222-2222-4222-8222-222222222222", label: "Na (4 tuổi)", kind: "child", ageMonths: 48 },
  { id: "33333333-3333-4333-8333-333333333333", label: "Bin (18 tháng)", kind: "child", ageMonths: 18 },
];

test("suggestPacking: beach trip with a toddler gets diapers, swim gear, birth certificates; no duplicates", () => {
  const suggestions = suggestPacking({ destType: "beach", nights: 3, members, existing: [] });
  const names = suggestions.map((suggestion) => suggestion.name);
  assert.ok(names.some((name) => name.startsWith("Bỉm Bin")));
  assert.ok(!names.some((name) => name.startsWith("Bỉm Na")), "4yo needs no diapers");
  assert.ok(names.includes("Giấy khai sinh Na"));
  assert.ok(names.some((name) => name.includes("Đồ bơi + phao Na")));
  assert.ok(names.some((name) => name.includes("chống nắng")));
  const keys = names.map((name) => name.toLowerCase().split(/[·(,]/)[0].trim());
  assert.equal(new Set(keys).size, keys.length, "no duplicate suggestions");
  const diapers = suggestions.find((suggestion) => suggestion.name.startsWith("Bỉm Bin"))!;
  assert.equal(diapers.qty, 24); // 4 days × 6
});

test("suggestPacking: existing items hide matching suggestions; abroad adds passports", () => {
  const existing = [{ name: "Bỉm Bin size M ×10" }, { name: "Sạc điện thoại + sạc dự phòng" }];
  const suggestions = suggestPacking({ destType: "abroad", nights: 3, members, existing });
  const names = suggestions.map((suggestion) => suggestion.name);
  assert.ok(!names.some((name) => name.startsWith("Bỉm Bin")));
  assert.ok(!names.some((name) => name.startsWith("Sạc điện thoại")));
  assert.ok(names.some((name) => name.includes("Hộ chiếu")));
  assert.ok(names.some((name) => name.includes("Ổ cắm chuyển đổi")));
});

test("tripRemindersFor: T-7, T-2 with pack counts, wrap-up the day after; off-switch and cancelled respected", () => {
  const base = { id: trip().id, name: "Đà Nẵng cuối năm", startDate: "2026-11-20", endDate: "2026-11-23", status: "planning" as const, pushEnabled: true };
  const packLeft = new Map([[base.id, 12]]);
  const t7 = tripRemindersFor([base], packLeft, "2026-11-13");
  assert.equal(t7.length, 1);
  assert.deepEqual([t7[0].kind, t7[0].url], ["prep7", `/travel/${base.id}?tab=packing`]);
  assert.match(t7[0].body, /12 món/);
  const t2 = tripRemindersFor([base], new Map(), "2026-11-18");
  assert.equal(t2[0].kind, "prep2");
  assert.match(t2[0].body, /giấy tờ/);
  const wrap = tripRemindersFor([{ ...base, status: "ongoing" }], packLeft, "2026-11-24");
  assert.equal(wrap[0].kind, "wrapup");
  assert.equal(tripRemindersFor([base], packLeft, "2026-11-10").length, 0, "no reminder on ordinary days");
  assert.equal(tripRemindersFor([{ ...base, pushEnabled: false }], packLeft, "2026-11-13").length, 0);
  assert.equal(tripRemindersFor([{ ...base, status: "cancelled" }], packLeft, "2026-11-13").length, 0);
});

test("travelHomeCard: context-aware single card, none without trips", () => {
  assert.equal(travelHomeCard(null, "2026-10-10"), null);
  assert.equal(travelHomeCard({ trips: [], itinerary: [], packing: [], expenses: [] }, "2026-10-10"), null);
  const state = { trips: [trip()], itinerary: [], packing: [{ id: "p1", tripId: trip().id, name: "Bỉm", qty: 1, category: "kids" as const, status: "todo" as const, source: "manual" as const }], expenses: [] };
  const far = travelHomeCard(state, "2026-10-10")!;
  assert.equal(far.urgent, false);
  assert.match(far.title, /còn 41 ngày/);
  const near = travelHomeCard(state, "2026-11-15")!;
  assert.equal(near.urgent, true);
  const lastDays = travelHomeCard(state, "2026-11-19")!;
  assert.match(lastDays.detail, /chưa xếp/);
  assert.equal(lastDays.cta.href, `/travel/${trip().id}?tab=packing`);
  const ongoing = travelHomeCard(state, "2026-11-21")!;
  assert.match(ongoing.title, /Đang trong chuyến/);
  const back = travelHomeCard(state, "2026-11-25")!;
  assert.match(back.title, /Tổng kết/);
  assert.equal(travelHomeCard(state, "2026-12-05"), null, "card disappears a few days after the trip");
});

test("tripRecap sums buckets against the split and reports the diff", () => {
  const expenses: TripExpense[] = [
    { id: "x1", tripId: trip().id, occurredOn: "2026-11-20", content: "Vé bay", bucket: "transport", amount: 4_200_000 },
    { id: "x2", tripId: trip().id, occurredOn: "2026-11-21", content: "Khách sạn", bucket: "lodging", amount: 3_600_000 },
    { id: "x3", tripId: trip().id, occurredOn: "2026-11-21", content: "Hải sản", bucket: "food", amount: 5_000_000 },
  ];
  const recap = tripRecap(trip(), expenses);
  assert.deepEqual([recap.total, recap.budget, recap.diff, recap.count], [12_800_000, 15_000_000, -2_200_000, 3]);
  assert.equal(recap.byBucket.length, 5, "every budgeted bucket shows");
  assert.deepEqual(recap.byBucket.find((row) => row.bucket === "food"), { bucket: "food", spent: 5_000_000, budget: 3_750_000 });
  const noBudget = tripRecap(trip({ budgetAmount: 0 }), expenses);
  assert.equal(noBudget.byBucket.length, 3, "without a budget only spent buckets show");
});

test("suggest-ai: request validation, child-age privacy shape, reply cleaning + dedupe", () => {
  const request = validSuggestRequest({ destination: "Đà Nẵng", destType: "beach", nights: 3, adults: 2, childAges: ["bé 18 tháng", "bé 4 tuổi"], existing: ["Bỉm Bin", "Kem chống nắng trẻ em"] });
  assert.ok(request);
  assert.equal(validSuggestRequest({ ...request, childAges: ["bé Na 4 tuổi"] }), null, "names in ages are rejected");
  assert.equal(validSuggestRequest({ ...request, nights: 99 }), null);
  assert.match(suggestSystem(request!), /Đà Nẵng/);
  assert.match(suggestSystem(request!), /bé 18 tháng, bé 4 tuổi/);
  const cleaned = cleanSuggestions({ items: [
    { name: "Lều che nắng cho bé", category: "kids", qty: 1 },
    { name: "Kem chống nắng", category: "health" },            // already on the checklist → dropped
    { name: "Lều che nắng", category: "kids" },                 // duplicate of the first → dropped
    { name: "Gì đó", category: "nope" },                        // bad category → dropped
    { name: "Túi chống nước điện thoại", category: "electronics", qty: 150 }, // qty clamped to 1
  ] }, request!);
  assert.deepEqual(cleaned.map((item) => item.name), ["Lều che nắng cho bé", "Túi chống nước điện thoại"]);
  assert.equal(cleaned[1].qty, 1);
});

test("trip expense ledger mirror: deterministic uuid, category Du lịch, source trip", () => {
  const expense: TripExpense = { id: "4a4b4c4d-4444-4444-8444-44aabbccdd44", tripId: trip().id, occurredOn: "2026-11-20", content: "Ăn hải sản Bé Mặn", bucket: "food", amount: 850_000 };
  const first = ledgerIdForTripExpense(expense.id);
  assert.equal(first, ledgerIdForTripExpense(expense.id.toUpperCase()), "case-insensitive and stable");
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const transaction = transactionForTripExpense(expense, "Đà Nẵng cuối năm");
  assert.equal(transaction.id, first);
  assert.equal(transaction.category, "Du lịch");
  assert.equal(transaction.source, "trip");
  assert.equal(transaction.kind, "expense");
  assert.equal(transaction.note, "Chuyến Đà Nẵng cuối năm");
  assert.notEqual(ledgerIdForTripExpense("55555555-5555-4555-8555-555555555555"), first);
});
