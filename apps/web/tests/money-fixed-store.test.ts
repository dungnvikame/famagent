import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONFIRMED_MESSAGE, confirmLocal, undoLocal, type ConfirmInput, type LocalPeriodData } from "../src/lib/money/period-confirm.ts";
import { confirmPeriod, loadBundle, recurringFromRow, recurringRow, settingsFromRow, settingsRow, undoPeriod } from "../src/lib/money/store-server.ts";
import { DEFAULT_CATEGORIES, type MoneyRecurring, type MoneyTransaction } from "../src/lib/money/types.ts";
import { validConfirm, validRecurring, validSettings } from "../src/lib/money/validate.ts";

const USER = "11111111-1111-4111-8111-111111111111";
const uuid = () => crypto.randomUUID();
const NOON = new Date("2026-09-29T05:00:00Z"); // 12:00 in Vietnam
const power = (over: Partial<MoneyRecurring> = {}): MoneyRecurring => ({ id: uuid(), name: "Tiền điện", category: "Tiền điện", kind: "expense", amount: 600_000, dayOfMonth: 5, active: true, schedule: { kind: "range", to: 12 }, amountMode: "estimate", ...over });

// ---------- mapping ----------

test("recurring row round trip keeps schedule and amount mode; old rows read as monthly fixed", () => {
  const item = power();
  const row = recurringRow(item, USER);
  assert.deepEqual(row.schedule, { kind: "range", to: 12 });
  assert.equal(row.amount_mode, "estimate");
  assert.deepEqual(recurringFromRow(row), { ...item, lastPostedMonth: undefined });
  const legacy = recurringFromRow({ id: item.id, name: "Tiền nhà", category: "Gia đình", kind: "expense", amount: 6_000_000, day_of_month: 1, active: true, last_posted_month: "2026-08-01" });
  assert.equal(legacy.schedule, undefined);
  assert.equal(legacy.amountMode, "fixed");
  assert.equal(legacy.lastPostedMonth, "2026-08");
  assert.equal(recurringRow({ ...item, schedule: undefined, amountMode: undefined }, USER).schedule, null);
  assert.equal(recurringRow({ ...item, schedule: undefined, amountMode: undefined }, USER).amount_mode, "fixed");
});

test("settings row round trip carries monthlySaving; bigint strings and null are handled", () => {
  const settings = { openingCash: 0, openingSavings: 0, categories: DEFAULT_CATEGORIES, monthlySaving: 3_000_000 };
  const row = settingsRow(settings, USER);
  assert.equal(row.monthly_saving, 3_000_000);
  assert.equal(settingsFromRow(row).monthlySaving, 3_000_000);
  assert.equal(settingsFromRow({ ...row, monthly_saving: "2500000" }).monthlySaving, 2_500_000);
  assert.equal(settingsFromRow({ ...row, monthly_saving: null }).monthlySaving, undefined);
  assert.equal(settingsRow({ ...settings, monthlySaving: undefined }, USER).monthly_saving, null);
  assert.equal(settingsFromRow(null).monthlySaving, undefined);
});

// ---------- validation ----------

const recurringInput = (over: Record<string, unknown> = {}) => ({ name: "Tiền điện", category: "Tiền điện", kind: "expense", amount: 600_000, dayOfMonth: 5, ...over });

test("validRecurring: old payloads still pass; good schedules are kept", () => {
  const plain = validRecurring(recurringInput());
  assert.ok(plain); assert.equal(plain.schedule, undefined); assert.equal(plain.amountMode, undefined);
  assert.deepEqual(validRecurring(recurringInput({ schedule: { kind: "range", to: 12 }, amountMode: "estimate" }))?.schedule, { kind: "range", to: 12 });
  assert.equal(validRecurring(recurringInput({ amountMode: "estimate" }))?.amountMode, "estimate");
  assert.deepEqual(validRecurring(recurringInput({ schedule: { kind: "month" } }))?.schedule, { kind: "month" });
  assert.deepEqual(validRecurring(recurringInput({ schedule: { kind: "eom" } }))?.schedule, { kind: "eom" });
  assert.deepEqual(validRecurring(recurringInput({ schedule: { kind: "quarter" } }))?.schedule, { kind: "quarter" });
  assert.deepEqual(validRecurring(recurringInput({ schedule: { kind: "quarter", to: 10 } }))?.schedule, { kind: "quarter", to: 10 });
  assert.deepEqual(validRecurring(recurringInput({ schedule: { kind: "year", month: 12 } }))?.schedule, { kind: "year", month: 12 });
  assert.deepEqual(validRecurring(recurringInput({ schedule: { kind: "year", month: 3, to: 20 } }))?.schedule, { kind: "year", month: 3, to: 20 });
  assert.equal(validRecurring(recurringInput({ schedule: null }))?.schedule, undefined);
});

test("validRecurring: junk schedules and amount modes are rejected", () => {
  for (const schedule of [
    "range", 5, [], { kind: "weekly" }, {}, { kind: "range" }, { kind: "range", to: 4 }, { kind: "range", to: 32 }, { kind: "range", to: 12.5 }, { kind: "range", to: "12" },
    { kind: "month", to: 9 }, { kind: "eom", to: 30 }, { kind: "quarter", to: 3 }, { kind: "year" }, { kind: "year", month: 0 }, { kind: "year", month: 13 }, { kind: "year", month: 6.5 }, { kind: "year", month: "6" }, { kind: "year", month: 6, to: 99 },
  ]) assert.equal(validRecurring(recurringInput({ schedule })), null, JSON.stringify(schedule));
  for (const amountMode of ["auto", "", 1, true]) assert.equal(validRecurring(recurringInput({ amountMode })), null, String(amountMode));
});

test("validSettings: monthlySaving is an integer 0..max; absent or blank stays unset", () => {
  const base = { openingCash: 0, openingSavings: 0, categories: [] };
  assert.equal(validSettings(base)?.monthlySaving, undefined);
  assert.equal(validSettings({ ...base, monthlySaving: null })?.monthlySaving, undefined);
  assert.equal(validSettings({ ...base, monthlySaving: "" })?.monthlySaving, undefined);
  assert.equal(validSettings({ ...base, monthlySaving: 0 })?.monthlySaving, 0);
  assert.equal(validSettings({ ...base, monthlySaving: 3_000_000 })?.monthlySaving, 3_000_000);
  for (const monthlySaving of [-1, 1.5, "abc", 100_000_000_001, {}]) assert.equal(validSettings({ ...base, monthlySaving }), null, String(monthlySaving));
});

test("validConfirm: paid keeps the entry fields, skipped drops them, junk is rejected", () => {
  const recurringId = uuid(); const childId = uuid(); const debtId = uuid();
  assert.deepEqual(validConfirm({ recurringId, period: "2026-09", status: "skipped", amount: 5, content: "x" }), { recurringId, period: "2026-09", status: "skipped" });
  const paid = validConfirm({ recurringId, period: "2026-09", status: "paid", occurredOn: "2026-09-09", amount: 618_000, content: " Tiền điện T9 ", category: "Tiền điện", debtId, forChild: true, childId, paidFrom: "savings", note: "ghi tay" });
  assert.deepEqual(paid, { recurringId, period: "2026-09", status: "paid", occurredOn: "2026-09-09", amount: 618_000, content: "Tiền điện T9", category: "Tiền điện", debtId, forChild: true, childId, paidFrom: "savings", note: "ghi tay" });
  const bare = validConfirm({ recurringId, period: "2026-09", status: "paid" });
  assert.ok(bare); assert.equal(bare.amount, undefined); assert.equal(bare.occurredOn, undefined);
  assert.equal(validConfirm({ recurringId, period: "2026-09", status: "paid", childId })?.childId, undefined, "child id only rides with the child flag");
  for (const bad of [
    null, "x", {}, { recurringId: "nope", period: "2026-09", status: "paid" }, { recurringId, period: "2026-13", status: "paid" }, { recurringId, period: "2026-9", status: "paid" }, { recurringId, period: "2026-09", status: "done" },
    { recurringId, period: "2026-09", status: "paid", amount: 0 }, { recurringId, period: "2026-09", status: "paid", amount: -5 }, { recurringId, period: "2026-09", status: "paid", amount: 1.5 }, { recurringId, period: "2026-09", status: "paid", amount: 100_000_000_001 },
    { recurringId, period: "2026-09", status: "paid", occurredOn: "09/09/2026" }, { recurringId, period: "2026-09", status: "paid", debtId: "nope" }, { recurringId, period: "2026-09", status: "paid", content: "x".repeat(121) },
  ]) assert.equal(validConfirm(bad), null, JSON.stringify(bad));
});

// ---------- local confirm flow ----------

const local = (over: Partial<LocalPeriodData> = {}): LocalPeriodData => ({ recurring: [], transactions: [], periods: [], settings: {}, ...over });
const paidEntry = (recurringId: string, occurredOn: string, amount: number): MoneyTransaction => ({ id: uuid(), occurredOn, content: "Tiền điện", category: "Tiền điện", kind: "expense", amount, forChild: false, source: "recurring", recurringId });
const confirm = (recurringId: string, over: Partial<ConfirmInput> = {}): ConfirmInput => ({ recurringId, period: "2026-09", status: "paid", ...over });

test("local: paid writes a ledger entry with the recurring id and a record; a second confirm is rejected", () => {
  const item = power({ amountMode: "fixed" });
  const data = local({ recurring: [item] });
  const { transaction } = confirmLocal(data, confirm(item.id), "2026-09-29", "tx1");
  assert.ok(transaction);
  assert.deepEqual([transaction.id, transaction.recurringId, transaction.source, transaction.kind, transaction.amount, transaction.occurredOn, transaction.content, transaction.category], ["tx1", item.id, "recurring", "expense", 600_000, "2026-09-29", "Tiền điện", "Tiền điện"]);
  assert.equal(data.transactions.length, 1);
  assert.deepEqual(data.periods, [{ recurringId: item.id, period: "2026-09", status: "paid", paidOn: "2026-09-29", amount: 600_000, transactionId: "tx1" }]);
  assert.throws(() => confirmLocal(data, confirm(item.id, { amount: 1 }), "2026-09-29", "tx2"), { message: CONFIRMED_MESSAGE });
  assert.equal(data.transactions.length, 1, "no second entry");
  assert.equal(data.periods.length, 1);
});

test("local: the family's own date, amount, wording and child/savings flags reach the entry", () => {
  const item = power(); const childId = uuid();
  const data = local({ recurring: [item] });
  const { transaction } = confirmLocal(data, confirm(item.id, { occurredOn: "2026-09-09", amount: 618_000, content: "Điện T9", category: "Khác", forChild: true, childId, paidFrom: "savings", note: "đã chuyển khoản" }), "2026-09-29", "tx1");
  assert.deepEqual(transaction, { id: "tx1", occurredOn: "2026-09-09", content: "Điện T9", category: "Khác", kind: "expense", amount: 618_000, forChild: true, childId, note: "đã chuyển khoản", source: "recurring", recurringId: item.id, paidFrom: "savings", debtId: undefined });
  assert.equal(data.periods[0].paidOn, "2026-09-09");
  // paidFrom only applies to expenses.
  const salary = power({ id: uuid(), name: "Lương", kind: "income", category: "Lương", amountMode: "fixed", schedule: undefined });
  const income = confirmLocal(local({ recurring: [salary] }), confirm(salary.id, { paidFrom: "savings" }), "2026-09-29", "tx2").transaction;
  assert.equal(income?.paidFrom, undefined);
});

test("local: skipped records the answer and writes nothing to the ledger", () => {
  const item = power();
  const data = local({ recurring: [item] });
  assert.deepEqual(confirmLocal(data, confirm(item.id, { status: "skipped" }), "2026-09-29", "tx1"), { transaction: undefined });
  assert.deepEqual(data.periods, [{ recurringId: item.id, period: "2026-09", status: "skipped" }]);
  assert.equal(data.transactions.length, 0);
  assert.throws(() => confirmLocal(data, confirm(item.id), "2026-09-29", "tx2"), { message: CONFIRMED_MESSAGE });
});

test("local: undo removes the entry it created and frees the period; nothing to undo is fine; other entries stay", () => {
  const item = power({ amountMode: "fixed" });
  const other = paidEntry(item.id, "2026-08-09", 590_000);
  const data = local({ recurring: [item], transactions: [other] });
  confirmLocal(data, confirm(item.id), "2026-09-29", "tx1");
  assert.equal(data.transactions.length, 2);
  undoLocal(data, item.id, "2026-09");
  assert.deepEqual(data.transactions, [other]);
  assert.deepEqual(data.periods, []);
  undoLocal(data, item.id, "2026-09");
  assert.ok(confirmLocal(data, confirm(item.id), "2026-09-30", "tx3").transaction, "the period can be answered again");
  const skipped = local({ recurring: [item], transactions: [other] });
  confirmLocal(skipped, confirm(item.id, { status: "skipped" }), "2026-09-29", "tx4");
  undoLocal(skipped, item.id, "2026-09");
  assert.deepEqual([skipped.transactions, skipped.periods], [[other], []]);
});

test("local: an unknown item is rejected; estimate items default to the average of the last three paid amounts", () => {
  assert.throws(() => confirmLocal(local(), confirm(uuid()), "2026-09-29", "tx1"), { message: /Không tìm thấy/ });
  const item = power({ amount: 500_000 });
  const noHistory = local({ recurring: [item] });
  assert.equal(confirmLocal(noHistory, confirm(item.id), "2026-09-29", "tx1").transaction?.amount, 500_000, "first guess before any history");
  const history = [paidEntry(item.id, "2026-05-10", 100_000), paidEntry(item.id, "2026-06-10", 600_000), paidEntry(item.id, "2026-07-10", 630_000), paidEntry(item.id, "2026-08-10", 590_000)];
  const data = local({ recurring: [item], transactions: history });
  assert.equal(confirmLocal(data, confirm(item.id), "2026-09-29", "tx2").transaction?.amount, 606_667, "average of the newest three");
  const typed = local({ recurring: [item], transactions: history });
  assert.equal(confirmLocal(typed, confirm(item.id, { amount: 618_000 }), "2026-09-29", "tx3").transaction?.amount, 618_000, "typed amount wins");
});

test("local: an expense of a debt's linked item is tagged with the debt; income and an explicit debt are respected", () => {
  const car = power({ name: "Trả góp xe", category: "Tiền trả góp", amount: 4_500_000, amountMode: "fixed", schedule: undefined });
  const debt = { id: uuid(), name: "Vay mua xe", balance: 80_000_000, recurringId: car.id };
  const settings = { position: { debts: [debt] } };
  const tagged = confirmLocal(local({ recurring: [car], settings }), confirm(car.id), "2026-09-29", "tx1").transaction;
  assert.equal(tagged?.debtId, debt.id);
  const other = uuid();
  assert.equal(confirmLocal(local({ recurring: [car], settings }), confirm(car.id, { debtId: other }), "2026-09-29", "tx2").transaction?.debtId, other);
  const income = { ...car, id: uuid(), kind: "income" as const, category: "Lương" };
  assert.equal(confirmLocal(local({ recurring: [income], settings: { position: { debts: [{ ...debt, recurringId: income.id }] } } }), confirm(income.id), "2026-09-29", "tx3").transaction?.debtId, undefined);
  const plain = power({ amountMode: "fixed" });
  assert.equal(confirmLocal(local({ recurring: [plain], settings }), confirm(plain.id), "2026-09-29", "tx4").transaction?.debtId, undefined);
});

// ---------- server confirm with a fake Supabase client ----------

type Row = Record<string, unknown>;
/** In-memory stand-in for the PostgREST calls of the money store. Unique keys mimic the migration; `failInsert` makes inserts into a table fail. */
function fakeClient(seed: Record<string, Row[]> = {}, failInsert: string[] = []) {
  const tables: Record<string, Row[]> = { money_transactions: [], money_recurring: [], money_recurring_periods: [], money_settings: [], money_budgets: [], money_goals: [], ...seed };
  const writes: Array<{ table: string; op: "insert" | "delete" }> = [];
  const client = {
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = []; let action: "select" | "delete" = "select"; let range: [number, number] | null = null; let max = Infinity;
      const matches = () => tables[table].filter((row) => filters.every((test) => test(row)));
      const result = () => {
        if (action === "delete") { const gone = matches(); tables[table] = tables[table].filter((row) => !gone.includes(row)); writes.push({ table, op: "delete" }); return { data: null, error: null }; }
        const rows = matches(); return { data: (range ? rows.slice(range[0], range[1] + 1) : rows).slice(0, max), error: null };
      };
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return chain; },
        gte: (key: string, value: string) => { filters.push((row) => String(row[key]) >= value); return chain; },
        lt: (key: string, value: string) => { filters.push((row) => String(row[key]) < value); return chain; },
        in: (key: string, values: unknown[]) => { filters.push((row) => values.includes(row[key])); return chain; },
        order: () => chain,
        limit: (count: number) => { max = count; return chain; },
        range: (from: number, to: number) => { range = [from, to]; return chain; },
        maybeSingle: () => Promise.resolve({ data: matches()[0] ?? null, error: null }),
        delete: () => { action = "delete"; return chain; },
        insert: (row: Row) => {
          if (failInsert.includes(table)) return Promise.resolve({ error: { code: "XX000" } });
          const clash = tables[table].some((entry) => entry.id === row.id || (table === "money_recurring_periods" && entry.recurring_id === row.recurring_id && entry.period === row.period));
          if (clash) return Promise.resolve({ error: { code: "23505" } });
          tables[table].push(row); writes.push({ table, op: "insert" }); return Promise.resolve({ error: null });
        },
        then: (resolve: (value: unknown) => unknown) => resolve(result()),
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, tables, writes };
}

const itemRow = (item: MoneyRecurring): Row => recurringRow(item, USER);
const ledgerRow = (recurringId: string, occurredOn: string, amount: number): Row => ({ id: uuid(), user_id: USER, occurred_on: occurredOn, content: "Tiền điện", category: "Tiền điện", kind: "expense", amount, source: "recurring", recurring_id: recurringId, paid_from: "cash" });
const answer = (recurringId: string, over: Partial<ConfirmInput> = {}): ConfirmInput => ({ recurringId, period: "2026-09", status: "paid", ...over });

test("server confirm success: period row and ledger entry, dated today in Vietnam, estimate from history", async () => {
  const item = power({ amount: 500_000 });
  const { client, tables } = fakeClient({ money_recurring: [itemRow(item)], money_transactions: [ledgerRow(item.id, "2026-08-10", 600_000), ledgerRow(item.id, "2026-07-10", 640_000)] });
  const late = new Date("2026-09-29T18:00:00Z"); // 01:00 on the 30th in Vietnam
  const outcome = await confirmPeriod(client, USER, answer(item.id), late);
  assert.ok(outcome.ok && outcome.transaction);
  assert.equal(outcome.transaction.occurredOn, "2026-09-30");
  assert.equal(outcome.transaction.amount, 620_000, "average of the two paid amounts");
  assert.equal(tables.money_transactions.length, 3);
  const written = tables.money_transactions.find((row) => row.id === outcome.transaction!.id)!;
  assert.deepEqual([written.user_id, written.recurring_id, written.source, written.kind, written.content, written.category, written.amount], [USER, item.id, "recurring", "expense", "Tiền điện", "Tiền điện", 620_000]);
  assert.equal(tables.money_recurring_periods.length, 1);
  const period = tables.money_recurring_periods[0];
  assert.deepEqual([period.user_id, period.recurring_id, period.period, period.status, period.paid_on, period.amount, period.transaction_id], [USER, item.id, "2026-09", "paid", "2026-09-30", 620_000, outcome.transaction.id]);
});

test("server confirm: typed fields win, and the debt linked to the item tags the entry", async () => {
  const car = power({ name: "Trả góp xe", category: "Tiền trả góp", amountMode: "fixed", schedule: undefined, amount: 4_500_000 });
  const debtId = uuid();
  const { client, tables } = fakeClient({ money_recurring: [itemRow(car)], money_settings: [{ user_id: USER, position: { asOf: "2026-09-01", accounts: [], debts: [{ id: debtId, name: "Vay xe", balance: 1, recurringId: car.id }] } }] });
  const outcome = await confirmPeriod(client, USER, answer(car.id, { occurredOn: "2026-09-28", amount: 4_600_000, content: "Góp xe T9" }), NOON);
  assert.ok(outcome.ok && outcome.transaction);
  assert.deepEqual([outcome.transaction.debtId, outcome.transaction.amount, outcome.transaction.occurredOn, outcome.transaction.content], [debtId, 4_600_000, "2026-09-28", "Góp xe T9"]);
  assert.equal(tables.money_transactions[0].debt_id, debtId);
});

test("server confirm skipped: only the period row, no ledger entry", async () => {
  const item = power();
  const { client, tables } = fakeClient({ money_recurring: [itemRow(item)] });
  const outcome = await confirmPeriod(client, USER, answer(item.id, { status: "skipped" }), NOON);
  assert.deepEqual(outcome, { ok: true });
  assert.equal(tables.money_transactions.length, 0);
  assert.deepEqual([tables.money_recurring_periods[0].status, tables.money_recurring_periods[0].transaction_id, tables.money_recurring_periods[0].paid_on], ["skipped", null, null]);
});

test("server confirm conflict: second answer is 409 with the Vietnamese message and writes no transaction", async () => {
  const item = power();
  const { client, tables, writes } = fakeClient({ money_recurring: [itemRow(item)] });
  assert.ok((await confirmPeriod(client, USER, answer(item.id, { status: "skipped" }), NOON)).ok);
  const before = writes.length;
  const second = await confirmPeriod(client, USER, answer(item.id, { amount: 618_000 }), NOON);
  assert.deepEqual(second, { ok: false, status: 409, error: CONFIRMED_MESSAGE });
  assert.equal(tables.money_transactions.length, 0, "no ledger entry for the rejected answer");
  assert.equal(writes.length, before, "nothing written at all");
  assert.equal(tables.money_recurring_periods.length, 1);
});

test("server confirm: a failed ledger insert takes the period row back so it can be retried", async () => {
  const item = power();
  const broken = fakeClient({ money_recurring: [itemRow(item)] }, ["money_transactions"]);
  const outcome = await confirmPeriod(broken.client, USER, answer(item.id), NOON);
  assert.ok(!outcome.ok && outcome.status === 500);
  assert.equal(broken.tables.money_recurring_periods.length, 0, "no period row left behind");
  assert.equal(broken.tables.money_transactions.length, 0);
  const retry = fakeClient({ money_recurring: [itemRow(item)] });
  assert.ok((await confirmPeriod(retry.client, USER, answer(item.id), NOON)).ok);
});

test("server confirm: an item that is not the user's (or does not exist) is 404 and nothing is written", async () => {
  const item = power();
  const { client, tables } = fakeClient({ money_recurring: [{ ...itemRow(item), user_id: "someone-else" }] });
  assert.deepEqual(await confirmPeriod(client, USER, answer(item.id), NOON), { ok: false, status: 404, error: "Không tìm thấy khoản cố định." });
  assert.equal(tables.money_recurring_periods.length + tables.money_transactions.length, 0);
});

test("server undo: removes the entry the answer created and the period row; unknown period is fine; other users' rows stay", async () => {
  const item = power({ amountMode: "fixed" });
  const { client, tables } = fakeClient({ money_recurring: [itemRow(item)], money_transactions: [ledgerRow(item.id, "2026-08-10", 600_000)] });
  const paid = await confirmPeriod(client, USER, answer(item.id), NOON);
  assert.ok(paid.ok);
  assert.equal(tables.money_transactions.length, 2);
  assert.deepEqual(await undoPeriod(client, USER, item.id, "2026-09"), { ok: true });
  assert.equal(tables.money_transactions.length, 1, "only the August entry is left");
  assert.equal(tables.money_recurring_periods.length, 0);
  assert.deepEqual(await undoPeriod(client, USER, item.id, "2026-09"), { ok: true });
  assert.ok((await confirmPeriod(client, USER, answer(item.id), NOON)).ok, "answerable again after undo");
  const foreign = fakeClient({ money_recurring_periods: [{ id: uuid(), user_id: "someone-else", recurring_id: item.id, period: "2026-09", status: "skipped", transaction_id: null }] });
  await undoPeriod(foreign.client, USER, item.id, "2026-09");
  assert.equal(foreign.tables.money_recurring_periods.length, 1);
});

// ---------- bundle: no auto-posting, periods and amounts come along ----------

test("loadBundle never posts fixed items; it returns records merged with ledger-derived periods and recent amounts", async () => {
  const rent = power({ id: uuid(), name: "Tiền nhà", category: "Gia đình", amount: 6_000_000, dayOfMonth: 1, amountMode: "fixed", schedule: undefined });
  const skipped = power({ id: uuid(), name: "Internet" });
  const { client, tables, writes } = fakeClient({
    money_recurring: [itemRow(rent), itemRow(skipped), itemRow(power({ id: uuid(), name: "Chưa ai trả" }))],
    money_transactions: [ledgerRow(rent.id, "2026-09-01", 6_000_000), ledgerRow(rent.id, "2026-08-01", 6_000_000)],
    money_recurring_periods: [{ id: uuid(), user_id: USER, recurring_id: skipped.id, period: "2026-09", status: "skipped", paid_on: null, amount: null, transaction_id: null }],
    money_settings: [{ user_id: USER, monthly_saving: 2_000_000 }],
  });
  const bundle = await loadBundle(client, USER, "2026-09", NOON);
  assert.ok(bundle);
  assert.equal(writes.length, 0, "opening the page writes nothing");
  assert.equal(tables.money_transactions.length, 2);
  assert.equal(bundle.recurring.length, 3);
  assert.deepEqual([...bundle.periods!].sort((a, b) => a.recurringId.localeCompare(b.recurringId) || a.period.localeCompare(b.period)).map((p) => [p.recurringId === rent.id ? "rent" : "internet", p.period, p.status]).sort(), [["internet", "2026-09", "skipped"], ["rent", "2026-08", "paid"], ["rent", "2026-09", "paid"]]);
  assert.deepEqual(bundle.recurringAmounts, { [rent.id]: [6_000_000, 6_000_000] });
  assert.equal(bundle.settings.monthlySaving, 2_000_000);
});
