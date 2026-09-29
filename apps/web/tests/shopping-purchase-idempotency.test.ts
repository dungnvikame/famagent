import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ledgerIdForPurchase } from "../src/lib/shopping/purchase-idempotency.ts";
import { recordPurchase } from "../src/lib/shopping/purchase-store-server.ts";
import { addPurchaseOnce, type Purchase } from "../src/lib/shopping/purchases.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER = "u1";
const buy = (id: string, patch: Partial<Purchase> = {}): Purchase => ({ id, itemId: "i1", productName: "Merries L64", amount: 350_000, packs: 1, unitCount: 64, purchasedOn: "2026-09-29", source: "quick", ...patch });

type Row = Record<string, unknown>;
/** In-memory stand-in for the few PostgREST calls recordPurchase makes. `failInsert` makes inserts into a table fail. */
function fakeClient(failInsert: string[] = []) {
  const tables: Record<string, Row[]> = { money_transactions: [], purchases: [], family_events: [] };
  const client = {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      let action: "select" | "delete" = "select"; let max = Infinity;
      const matches = () => (tables[table] ?? []).filter((row) => filters.every(([key, value]) => (key.includes("->>") ? (row.payload as Row)[key.split("->>")[1]] : row[key]) === value));
      const run = () => {
        if (action === "delete") { tables[table] = tables[table].filter((row) => !matches().includes(row)); return { data: null, error: null }; }
        return { data: matches().slice(0, max), error: null };
      };
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (key: string, value: unknown) => { filters.push([key, value]); return chain; },
        limit: (count: number) => { max = count; return chain; },
        maybeSingle: () => Promise.resolve({ data: matches()[0] ?? null, error: null }),
        delete: () => { action = "delete"; return chain; },
        insert: (row: Row) => {
          if (failInsert.includes(table)) return Promise.resolve({ error: { code: "XX000" } });
          if (row.id !== undefined && tables[table].some((entry) => entry.id === row.id)) return Promise.resolve({ error: { code: "23505" } });
          tables[table].push(row); return Promise.resolve({ error: null });
        },
        upsert: (row: Row, options: { ignoreDuplicates?: boolean }) => {
          const exists = tables[table].some((entry) => entry.id === row.id);
          if (!exists) tables[table].push(row); else if (!options.ignoreDuplicates) Object.assign(tables[table].find((entry) => entry.id === row.id)!, row);
          return Promise.resolve({ error: null });
        },
        then: (resolve: (value: unknown) => unknown) => resolve(run()),
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, tables };
}

test("id của dòng sổ suy ra từ id lần mua: ổn định, hợp lệ, khác nhau theo lần mua", () => {
  const id = crypto.randomUUID();
  assert.equal(ledgerIdForPurchase(id), ledgerIdForPurchase(id.toUpperCase()));
  assert.match(ledgerIdForPurchase(id), UUID);
  assert.notEqual(ledgerIdForPurchase(id), ledgerIdForPurchase(crypto.randomUUID()));
});

test("ghi lại cùng một lần mua hai lần: 1 purchase, 1 khoản chi, 1 event", async () => {
  const { client, tables } = fakeClient();
  const purchase = buy(crypto.randomUUID());
  const first = await recordPurchase(client, USER, purchase, true);
  const second = await recordPurchase(client, USER, { ...purchase }, true);
  assert.ok(typeof first !== "string" && typeof second !== "string");
  assert.equal(tables.purchases.length, 1);
  assert.equal(tables.money_transactions.length, 1);
  assert.equal(tables.family_events.length, 1);
  assert.equal(tables.money_transactions[0].id, ledgerIdForPurchase(purchase.id));
  assert.equal(typeof second !== "string" && second.transactionId, ledgerIdForPurchase(purchase.id));
});

test("insert purchase lỗi thì xoá khoản chi vừa tạo; thử lại cùng id thành công, không đôi", async () => {
  const purchase = buy(crypto.randomUUID());
  const broken = fakeClient(["purchases"]);
  assert.equal(await recordPurchase(broken.client, USER, purchase, true), "purchase");
  assert.equal(broken.tables.money_transactions.length, 0, "không để lại khoản chi mồ côi");
  const ok = fakeClient();
  ok.tables.money_transactions.push({ id: ledgerIdForPurchase(purchase.id), user_id: USER }); // left by a crashed attempt
  const result = await recordPurchase(ok.client, USER, purchase, true);
  assert.ok(typeof result !== "string");
  assert.equal(ok.tables.money_transactions.length, 1, "dùng lại khoản chi cũ của chính lần mua này");
});

test("event lỗi không làm hỏng lần mua; thử lại bù event", async () => {
  const purchase = buy(crypto.randomUUID());
  const noEvents = fakeClient(["family_events"]);
  const first = await recordPurchase(noEvents.client, USER, purchase, false);
  assert.ok(typeof first !== "string");
  assert.equal(noEvents.tables.purchases.length, 1);
  assert.equal(noEvents.tables.family_events.length, 0);
  // Same store, events now work: the retry returns the stored purchase and logs the missing event once.
  const retry = fakeClient();
  retry.tables.purchases.push({ id: purchase.id, user_id: USER, product_name: "Merries L64", amount: 350_000, packs: 1, unit_count: 64, purchased_on: "2026-09-29", transaction_id: ledgerIdForPurchase(purchase.id) });
  await recordPurchase(retry.client, USER, purchase, false);
  await recordPurchase(retry.client, USER, purchase, false);
  assert.equal(retry.tables.family_events.length, 1);
  assert.equal(retry.tables.purchases.length, 1);
});

test("lưu cục bộ: cùng id không thêm lần hai", () => {
  const first = buy("p1");
  const { list } = addPurchaseOnce([], first);
  const again = addPurchaseOnce(list, { ...first, amount: 1 });
  assert.equal(again.list.length, 1);
  assert.equal(again.existing?.amount, 350_000);
  assert.equal(addPurchaseOnce(list, buy("p2")).list.length, 2);
});
