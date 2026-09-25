"use client";

import { useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { groupAmountTyping, parseVnd, todayLocal } from "@/lib/money/parse";
import { debtLeft, monthsToPayOff, positionSummary } from "@/lib/money/position";
import { parsePosition } from "@/lib/money/position-parse";
import { type MonthSummary } from "@/lib/money/summary";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, MONEY_KIND_LABELS, type AccountType, type MoneyBundle, type MoneyDebt, type MoneyPosition, type MoneyRecurring } from "@/lib/money/types";
import { AmountInput } from "./amount-input";

type AccountRow = { id: string; type: AccountType; name: string; amount: string };
type DebtRow = { id: string; name: string; balance: string; monthly: string; day: string; rate: string; recurringId?: string; asOf?: string; /** Shown remaining amount and the stored balance behind it (unchanged row = keep both). */ shown?: number; stored?: number };
type FixedRow = { key: string; name: string; kind: "income" | "expense"; amount: string; day: string };

interface Props {
  bundle: MoneyBundle; summary: MonthSummary;
  /** Onboarding estimate, used for ratios before any income is logged. */
  estimatedIncome: number;
  /** Saves the position (debt payments are synced to recurring items by the caller) and any new fixed items. */
  onSavePosition: (position: MoneyPosition, newFixed: Array<Omit<MoneyRecurring, "id" | "active" | "category"> & { category?: string }>) => Promise<void>;
  onRecurring: (item: MoneyRecurring) => Promise<void>;
  onDeleteRecurring: (id: string) => Promise<void>;
}

const uid = () => crypto.randomUUID();
const toAmount = (text: string) => text.trim() ? parseVnd(text) : null;
const dayLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const accountRows = (position?: MoneyPosition, fallback?: { cash: number; savings: number }): AccountRow[] => position?.accounts.length
  ? position.accounts.map((item) => ({ id: item.id, type: item.type, name: item.name, amount: groupAmountTyping(String(item.amount)) }))
  : [
    { id: uid(), type: "bank", name: "", amount: fallback?.cash ? groupAmountTyping(String(fallback.cash)) : "" },
    { id: uid(), type: "cash", name: "Tiền mặt", amount: "" },
    ...(fallback?.savings ? [{ id: uid(), type: "saving" as const, name: "Tiết kiệm", amount: groupAmountTyping(String(fallback.savings)) }] : []),
  ];
const debtRows = (debts: MoneyDebt[], paid: Record<string, number> = {}): DebtRow[] => debts.map((debt) => ({ id: debt.id, name: debt.name, balance: groupAmountTyping(String(debtLeft(debt, paid))), monthly: debt.monthlyPayment ? groupAmountTyping(String(debt.monthlyPayment)) : "", day: debt.dueDay ? String(debt.dueDay) : "", rate: debt.ratePct !== undefined ? String(debt.ratePct) : "", recurringId: debt.recurringId, asOf: debt.asOf, shown: debtLeft(debt, paid), stored: debt.balance }));

/** Accounts → validated list, or an error message. */
function readAccounts(rows: AccountRow[]): MoneyPosition["accounts"] | string {
  const out: MoneyPosition["accounts"] = [];
  for (const row of rows) {
    if (!row.name.trim() && !row.amount.trim()) continue;
    const amount = toAmount(row.amount);
    if (amount === null) return `Số tiền của “${row.name || ACCOUNT_TYPE_LABELS[row.type]}” chưa đúng (ví dụ 28,5tr).`;
    out.push({ id: row.id, type: row.type, name: row.name.trim() || ACCOUNT_TYPE_LABELS[row.type], amount });
  }
  return out;
}

/** Debts → validated list; a changed balance restarts that debt's "paid since" date at today. */
function readDebts(rows: DebtRow[], today: string, anchor?: string): MoneyDebt[] | string {
  const out: MoneyDebt[] = [];
  for (const row of rows) {
    if (!row.name.trim() && !row.balance.trim()) continue;
    const balance = toAmount(row.balance); const monthly = row.monthly.trim() ? toAmount(row.monthly) : undefined; const day = row.day.trim() ? Number(row.day) : undefined; const rate = row.rate.trim() ? Number(row.rate.replace(",", ".")) : undefined;
    if (!row.name.trim()) return "Đặt tên cho từng khoản nợ (ví dụ: Vay mua xe).";
    if (balance === null || balance < 0) return `Số còn nợ của “${row.name}” chưa đúng.`;
    if (monthly === null || (monthly !== undefined && monthly <= 0)) return `Số trả mỗi tháng của “${row.name}” chưa đúng.`;
    if (day !== undefined && !(Number.isInteger(day) && day >= 1 && day <= 31)) return `Ngày trả của “${row.name}” cần từ 1 đến 31.`;
    if (monthly && !day) return `Nhập ngày trả hằng tháng cho “${row.name}” để FamAgent tự ghi vào sổ.`;
    if (rate !== undefined && !(rate >= 0 && rate <= 100)) return `Lãi suất của “${row.name}” chưa đúng.`;
    const same = row.shown === balance && row.stored !== undefined;
    out.push({ id: row.id, name: row.name.trim(), balance: same ? row.stored! : balance, asOf: same ? row.asOf ?? anchor ?? today : today, monthlyPayment: monthly, dueDay: day, ratePct: rate, recurringId: row.recurringId });
  }
  return out;
}

function AccountsForm({ rows, setRows }: { rows: AccountRow[]; setRows: (rows: AccountRow[]) => void }) {
  const patch = (id: string, change: Partial<AccountRow>) => setRows(rows.map((row) => row.id === id ? { ...row, ...change } : row));
  return <div className="setup-form">
    {rows.map((row) => <div className="line" key={row.id}>
      <select aria-label="Loại" value={row.type} onChange={(event) => patch(row.id, { type: event.target.value as AccountType })}>{ACCOUNT_TYPES.map((type) => <option key={type} value={type}>{ACCOUNT_TYPE_LABELS[type]}</option>)}</select>
      <input aria-label="Tên" placeholder={row.type === "bank" ? "Vietcombank, Techcombank…" : row.type === "ewallet" ? "MoMo, ZaloPay…" : row.type === "saving" ? "Sổ tiết kiệm 12 tháng" : "Tiền mặt ở nhà"} value={row.name} maxLength={60} onChange={(event) => patch(row.id, { name: event.target.value })} />
      <AmountInput aria-label="Số dư" inputMode="decimal" placeholder="28,5tr" value={row.amount} onChange={(event) => patch(row.id, { amount: event.target.value })} />
      <button type="button" className="ledger-link danger" aria-label="Bỏ dòng này" onClick={() => setRows(rows.filter((item) => item.id !== row.id))}>×</button>
    </div>)}
    <div><button type="button" className="app-btn ghost" onClick={() => setRows([...rows, { id: uid(), type: "bank", name: "", amount: "" }])}>+ Thêm tài khoản</button></div>
  </div>;
}

function DebtsForm({ rows, setRows }: { rows: DebtRow[]; setRows: (rows: DebtRow[]) => void }) {
  const patch = (id: string, change: Partial<DebtRow>) => setRows(rows.map((row) => row.id === id ? { ...row, ...change } : row));
  return <div className="setup-form">
    {rows.length > 0 && <div className="line debt head" aria-hidden="true"><span>Khoản nợ</span><span>Còn nợ</span><span>Trả mỗi tháng</span><span>Ngày trả</span><span>Lãi %/năm</span><span /></div>}
    {rows.map((row) => <div className="line debt" key={row.id}>
      <input aria-label="Tên khoản nợ" placeholder="Vay mua xe, thẻ tín dụng…" value={row.name} maxLength={60} onChange={(event) => patch(row.id, { name: event.target.value })} />
      <AmountInput aria-label="Còn nợ" inputMode="decimal" placeholder="380tr" value={row.balance} onChange={(event) => patch(row.id, { balance: event.target.value })} />
      <AmountInput aria-label="Trả mỗi tháng" inputMode="decimal" placeholder="8,2tr (nếu có)" value={row.monthly} onChange={(event) => patch(row.id, { monthly: event.target.value })} />
      <input aria-label="Ngày trả" type="number" min={1} max={31} placeholder="15" value={row.day} onChange={(event) => patch(row.id, { day: event.target.value })} />
      <input aria-label="Lãi suất %/năm" inputMode="decimal" placeholder="8,5" value={row.rate} onChange={(event) => patch(row.id, { rate: event.target.value })} />
      <button type="button" className="ledger-link danger" aria-label="Bỏ khoản nợ này" onClick={() => setRows(rows.filter((item) => item.id !== row.id))}>×</button>
    </div>)}
    <div><button type="button" className="app-btn ghost" onClick={() => setRows([...rows, { id: uid(), name: "", balance: "", monthly: "", day: "", rate: "" }])}>+ Thêm khoản nợ</button></div>
    <small className="app-sub">Khoản có số trả mỗi tháng và ngày trả sẽ tự ghi vào sổ khi tới ngày, và số còn nợ tự giảm theo.</small>
  </div>;
}

function FixedList({ recurring, debts, onRecurring, onDeleteRecurring, pending, setPending, categories }: { recurring: MoneyRecurring[]; debts: MoneyDebt[]; onRecurring: Props["onRecurring"]; onDeleteRecurring: Props["onDeleteRecurring"]; pending?: FixedRow[]; setPending?: (rows: FixedRow[]) => void; categories: MoneyBundle["settings"]["categories"] }) {
  const [row, setRow] = useState<FixedRow>({ key: "", name: "", kind: "expense", amount: "", day: "1" });
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const linked = new Set(debts.map((debt) => debt.recurringId).filter(Boolean));
  const options = (kind: "income" | "expense") => categories.filter((item) => item.kind === kind && !item.archived).map((item) => item.name);
  const run = async (task: () => Promise<void>) => { try { setError(""); await task(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); } };
  const income = recurring.filter((item) => item.active && item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = recurring.filter((item) => item.active && item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);

  function add() {
    const amount = toAmount(row.amount); const day = Number(row.day);
    if (!row.name.trim() || amount === null || amount <= 0 || !(day >= 1 && day <= 31)) { setError("Điền tên, số tiền (ví dụ 6tr) và ngày 1–31."); return; }
    if (setPending && pending) { setPending([...pending, { ...row, key: uid(), name: row.name.trim() }]); setRow({ key: "", name: "", kind: row.kind, amount: "", day: "1" }); return; }
    void run(async () => { await onRecurring({ id: uid(), name: row.name.trim(), kind: row.kind, category: category || options(row.kind)[0] || "Khác", amount, dayOfMonth: day, active: true }); setRow({ key: "", name: "", kind: row.kind, amount: "", day: "1" }); setCategory(""); });
  }

  return <div className="app-card app-rows fixed-list">
    {recurring.filter((item) => item.kind !== "saving").map((item) => <div key={item.id}>
      <span><b>{item.name}</b>{linked.has(item.id) && <span className="linked">từ khoản nợ</span>}<small>{MONEY_KIND_LABELS[item.kind]} · {item.category} · ngày {item.dayOfMonth}{item.active ? "" : " · đang tạm dừng"}</small></span>
      <span className="row-actions"><b>{item.kind === "income" ? "+" : ""}{vnd(item.amount)}</b>
        <button type="button" className="ledger-link" onClick={() => void run(() => onRecurring({ ...item, active: !item.active }))}>{item.active ? "Tạm dừng" : "Bật lại"}</button>
        {!linked.has(item.id) && <button type="button" className="ledger-link danger" onClick={() => { if (window.confirm(`Xóa “${item.name}”?`)) void run(() => onDeleteRecurring(item.id)); }}>Xóa</button>}</span>
    </div>)}
    {pending?.map((item) => <div key={item.key}><span><b>{item.name}</b><small>{MONEY_KIND_LABELS[item.kind]} · ngày {item.day} · sẽ lưu khi bấm Xong</small></span><span className="row-actions"><b>{item.kind === "income" ? "+" : ""}{vnd(parseVnd(item.amount) ?? 0)}</b><button type="button" className="ledger-link danger" onClick={() => setPending?.(pending.filter((entry) => entry.key !== item.key))}>Bỏ</button></span></div>)}
    <div className="inline-form fixed-add">
      <input aria-label="Tên khoản" placeholder="Tiền nhà, học phí, lương…" value={row.name} maxLength={80} onChange={(event) => setRow({ ...row, name: event.target.value })} />
      <select aria-label="Loại" value={row.kind} onChange={(event) => { setRow({ ...row, kind: event.target.value as FixedRow["kind"] }); setCategory(""); }}><option value="expense">Chi</option><option value="income">Thu</option></select>
      {!setPending && <select aria-label="Nhóm" value={category} onChange={(event) => setCategory(event.target.value)}>{options(row.kind).map((name) => <option key={name}>{name}</option>)}</select>}
      <AmountInput aria-label="Số tiền" inputMode="decimal" placeholder="6tr" value={row.amount} onChange={(event) => setRow({ ...row, amount: event.target.value })} />
      <label className="day-field">Ngày <input type="number" min={1} max={31} aria-label="Ngày trong tháng" value={row.day} onChange={(event) => setRow({ ...row, day: event.target.value })} /></label>
      <button type="button" className="app-btn" onClick={add}>Thêm</button>
    </div>
    {(income > 0 || expense > 0) && <div className="totals-line"><span>Thu cố định {vnd(income)} · Chi cố định {vnd(expense)}</span><b>{income >= expense ? `Còn ~${vnd(income - expense)}/tháng` : `Thiếu ~${vnd(expense - income)}/tháng`}</b></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}

/**
 * "Tình hình": what the family has, owes, and pays every month. First visit = 3 short steps (or one paragraph the
 * agent fills in); afterwards the numbers follow the ledger from the date the family entered them.
 */
export function PositionView({ bundle, summary, estimatedIncome, onSavePosition, onRecurring, onDeleteRecurring }: Props) {
  const position = bundle.settings.position;
  const [step, setStep] = useState(1);
  const [later, setLater] = useState(false);
  const [editing, setEditing] = useState<"accounts" | "debts" | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>(() => accountRows(position, summary.balances));
  const [debts, setDebts] = useState<DebtRow[]>(() => debtRows(position?.debts ?? [], bundle.debtPaid));
  const [pendingFixed, setPendingFixed] = useState<FixedRow[]>([]);
  const [story, setStory] = useState("");
  const [filled, setFilled] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const today = todayLocal();

  function fillFromStory() {
    const parsed = parsePosition(story);
    if (!parsed.accounts.length && !parsed.debts.length && !parsed.fixed.length) { setError("Chưa đọc được con số nào. Thử kể theo kiểu: “VCB còn 28tr, tiền mặt 3tr, vay mua xe còn 380tr trả 8tr ngày 15”."); return; }
    setError("");
    if (parsed.accounts.length) setAccounts(parsed.accounts.map((item) => ({ id: uid(), type: item.type, name: item.name, amount: groupAmountTyping(String(item.amount)) })));
    if (parsed.debts.length) setDebts(parsed.debts.map((item) => ({ id: uid(), name: item.name, balance: String(item.balance), monthly: item.monthlyPayment ? String(item.monthlyPayment) : "", day: item.dueDay ? String(item.dueDay) : "", rate: item.ratePct !== undefined ? String(item.ratePct) : "" })));
    if (parsed.fixed.length) setPendingFixed(parsed.fixed.map((item) => ({ key: uid(), name: item.name, kind: item.kind, amount: String(item.amount), day: String(item.dayOfMonth ?? 1) })));
    setFilled(`Trợ lý đã điền ${parsed.accounts.length} tài khoản, ${parsed.debts.length} khoản nợ, ${parsed.fixed.length} khoản cố định. Xem lại từng bước rồi bấm Xong.${parsed.skipped.length ? ` Chưa hiểu: “${parsed.skipped.slice(0, 3).join("”, “")}”.` : ""}`);
    setStep(1);
  }

  async function save(next: { accounts?: AccountRow[]; debts?: DebtRow[] }, withFixed: FixedRow[] = []) {
    const readA = readAccounts(next.accounts ?? accounts); if (typeof readA === "string") { setError(readA); return false; }
    const readD = readDebts(next.debts ?? debts, today, position?.asOf); if (typeof readD === "string") { setError(readD); return false; }
    setBusy(true); setError("");
    try {
      // New account balances re-anchor at today; editing only debts keeps the earlier anchor date.
      const asOf = next.accounts || !position ? today : position.asOf;
      await onSavePosition({ asOf, accounts: readA, debts: readD }, withFixed.map((item) => ({ name: item.name, kind: item.kind, amount: parseVnd(item.amount) ?? 0, dayOfMonth: Number(item.day) || 1 })).filter((item) => item.amount > 0));
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); return false; }
    finally { setBusy(false); }
  }

  if (!position && later) return <div className="banner"><span>Chưa nhập tình hình hiện tại. Nhập để FamAgent tính đúng số dư, nợ và khoản cố định.</span><button type="button" className="app-btn ghost" onClick={() => setLater(false)}>Nhập ngay</button></div>;

  if (!position) return <section className="app-card setup">
    <div className="fw-panel-head"><div><b>Cho FamAgent biết tình hình hiện tại của nhà mình</b><small>Khoảng 2 phút. Số ước chừng là được, sửa lại lúc nào cũng được. Chỉ nhà mình thấy.</small></div></div>
    <div className="steps3" role="list">{[["Tiền đang có", "Tiền mặt, tài khoản ngân hàng, ví, sổ tiết kiệm"], ["Khoản nợ", "Vay mua nhà/xe, thẻ tín dụng, trả góp, vay người thân"], ["Thu & chi cố định", "Lương, tiền nhà, học phí, điện nước, bảo hiểm…"]].map(([title, hint], index) => <button type="button" role="listitem" key={title} className={step === index + 1 ? "now" : undefined} onClick={() => setStep(index + 1)}><span>Bước {index + 1}</span><b>{title}</b><small>{hint}</small></button>)}</div>
    {filled && <p className="health ok" role="status">{filled}</p>}
    {step === 1 && <AccountsForm rows={accounts} setRows={setAccounts} />}
    {step === 2 && <DebtsForm rows={debts} setRows={setDebts} />}
    {step === 3 && <FixedList recurring={bundle.recurring} debts={[]} categories={bundle.settings.categories} onRecurring={onRecurring} onDeleteRecurring={onDeleteRecurring} pending={pendingFixed} setPending={setPendingFixed} />}
    {step === 1 && !filled && <>
      <div className="or-line">hoặc</div>
      <div className="tell"><b>Kể cho Trợ lý, Trợ lý điền giúp cả 3 bước</b>
        <textarea aria-label="Kể về tình hình tài chính" placeholder="VCB còn 28tr rưỡi, tiền mặt 3tr, sổ tiết kiệm 150tr. Đang vay mua xe còn 380tr, trả 8,2tr ngày 15. Tiền nhà 6tr, học phí bé 3,5tr, lương hai vợ chồng 30tr." value={story} maxLength={3000} onChange={(event) => setStory(event.target.value)} />
        <div className="tell-actions"><button type="button" className="app-btn ghost" disabled={!story.trim()} onClick={fillFromStory}>Điền giúp tôi</button></div></div>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="setup-actions">
      {step === 1 ? <button type="button" className="ledger-link" onClick={() => setLater(true)}>Để sau</button> : <button type="button" className="app-btn ghost" onClick={() => setStep(step - 1)}>← Quay lại</button>}
      <span className="row-actions">
        {step < 3 && <button type="button" className="app-btn ghost" onClick={() => setStep(step + 1)}>Bỏ qua bước này</button>}
        {step < 3 ? <button type="button" className="app-btn" onClick={() => setStep(step + 1)}>{step === 1 ? "Tiếp: Khoản nợ →" : "Tiếp: Thu & chi cố định →"}</button>
          : <button type="button" className="app-btn" disabled={busy} onClick={() => void save({ accounts, debts }, pendingFixed).then((ok) => { if (ok) { setPendingFixed([]); setFilled(""); } })}>{busy ? "Đang lưu…" : "Xong"}</button>}
      </span>
    </div>
  </section>;

  const view = positionSummary(bundle, summary.balances, summary.income, estimatedIncome);
  return <div className="situ">
    <div className="situ-kpis">
      <div><small>Đang có</small><b>{vnd(view.has)}</b><em>tiền tiêu {vnd(view.cash)} · tiết kiệm {vnd(view.savings)}</em></div>
      <div><small>Đang nợ</small><b>{view.owes ? vnd(view.owes) : "—"}</b><em>{view.debtMonthly ? `trả ${vnd(view.debtMonthly)}/tháng` : position.debts.length ? "chưa có lịch trả" : "không có khoản nợ"}</em></div>
      <div><small>Chi cố định</small><b>{view.fixedExpense ? vnd(view.fixedExpense) : "—"}</b><em>{view.fixedRatio !== undefined ? `/tháng · ${Math.round(view.fixedRatio * 100)}% thu nhập` : "/tháng"}</em></div>
      <div><small>Quỹ dự phòng</small><b>{view.emergencyMonths !== undefined ? `~${view.emergencyMonths.toLocaleString("vi-VN")} tháng` : "—"}</b><em>tiết kiệm ÷ chi cố định</em></div>
    </div>
    {view.notes.map((note) => <p key={note.text} className={`health ${note.tone}`}>{note.tone === "ok" ? "✓" : "!"} {note.text}</p>)}
    {error && <p className="form-error" role="alert">{error}</p>}

    <section className="situ-sec">
      <header><h2>Tiền đang có</h2><small>Nhập ngày {dayLabel(position.asOf)} · sau đó tự cộng trừ theo sổ · <button type="button" className="ledger-link" onClick={() => { setAccounts(accountRows(position)); setEditing("accounts"); }}>Cập nhật số dư</button></small></header>
      {editing === "accounts" ? <div className="app-card"><p className="app-sub">Nhập số dư <b>hôm nay</b> của từng nơi; FamAgent lấy hôm nay làm mốc mới.</p><AccountsForm rows={accounts} setRows={setAccounts} /><div className="setup-actions"><button type="button" className="app-btn ghost" onClick={() => setEditing(null)}>Hủy</button><button type="button" className="app-btn" disabled={busy} onClick={() => void save({ accounts }).then((ok) => { if (ok) setEditing(null); })}>Lưu số dư</button></div></div>
        : <div className="app-card app-rows">
          {position.accounts.map((item) => <div key={item.id}><span><span className="acc-type">{ACCOUNT_TYPE_LABELS[item.type]}</span><b>{item.name}</b></span><span className="row-actions"><b>{vnd(item.amount)}</b></span></div>)}
          <div className="totals-line"><span>Tổng hiện tại<small>mốc {vnd(position.accounts.reduce((sum, item) => sum + item.amount, 0))} ngày {dayLabel(position.asOf)}, cộng trừ các khoản ghi sau đó</small></span><b>{vnd(view.has)}</b></div>
        </div>}
    </section>

    <section className="situ-sec">
      <header><h2>Khoản nợ</h2><small>{view.owes ? `Tổng ${vnd(view.owes)} · ` : ""}<button type="button" className="ledger-link" onClick={() => { setDebts(debtRows(position.debts, bundle.debtPaid)); setEditing("debts"); }}>{position.debts.length ? "Sửa" : "Thêm khoản nợ"}</button></small></header>
      {editing === "debts" ? <div className="app-card"><DebtsForm rows={debts} setRows={setDebts} /><div className="setup-actions"><button type="button" className="app-btn ghost" onClick={() => setEditing(null)}>Hủy</button><button type="button" className="app-btn" disabled={busy} onClick={() => void save({ debts }).then((ok) => { if (ok) setEditing(null); })}>Lưu khoản nợ</button></div></div>
        : position.debts.length ? <div className="app-card app-rows">{position.debts.map((debt) => {
          const left = debtLeft(debt, bundle.debtPaid); const months = monthsToPayOff(left, debt.monthlyPayment, debt.ratePct);
          const parts = [debt.monthlyPayment ? `Trả ${vnd(debt.monthlyPayment)} ngày ${debt.dueDay} hằng tháng` : "Chưa có lịch trả", debt.ratePct !== undefined ? `lãi ${debt.ratePct.toLocaleString("vi-VN")}%/năm` : "", months ? `còn khoảng ${months} tháng` : debt.monthlyPayment && left > 0 && months === undefined ? "số trả chưa đủ lãi" : ""].filter(Boolean);
          return <div key={debt.id}><span><b>{debt.name}</b><small>{parts.join(" · ")}{bundle.debtPaid?.[debt.id] ? ` · đã trả ${vnd(bundle.debtPaid[debt.id])} từ ${dayLabel(debt.asOf ?? position.asOf)}` : ""}</small></span><span className="row-actions"><b>{vnd(left)}</b></span></div>;
        })}</div> : <p className="app-sub">Không có khoản nợ nào.</p>}
    </section>

    <section className="situ-sec">
      <header><h2>Thu & chi cố định hằng tháng</h2><small>Tự ghi vào sổ khi tới ngày, bạn không phải nhớ</small></header>
      <FixedList recurring={bundle.recurring} debts={position.debts} categories={bundle.settings.categories} onRecurring={onRecurring} onDeleteRecurring={onDeleteRecurring} />
    </section>
  </div>;
}
