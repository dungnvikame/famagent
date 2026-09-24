"use client";

import Link from "next/link";
import { useState } from "react";
import { vnd } from "@/lib/catalog/format";
import type { ChildProfile } from "@/lib/experience/types";
import { cadenceDays, unitPrices, unitPriceTrend } from "@/lib/shopping/insights";
import { CATEGORY_LABELS, type ItemEstimate, type ShoppingItem } from "@/lib/shopping/items";
import type { Purchase } from "@/lib/shopping/purchases";
import { MarkPurchased } from "./mark-purchased";
import { tone } from "./upcoming-timeline";

const RATE_LABEL = { default: "ước tính", learned: "theo nhà mình", set: "bạn đặt" } as const;
const rateText = (rate: number) => `${Math.round(rate * 10) / 10}`.replace(".", ",");
/** "5,3 miếng/ngày" for daily items, "1 can / 30 ngày" for slow ones. */
export const rateLabel = (rate: number, unit: string) => rate >= 1 ? `${rateText(rate)} ${unit}/ngày` : `1 ${unit} / ${Math.round(1 / rate)} ngày`;
const dayLabel = (iso: string) => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;

/** Diaper items link to the catalog, prefilled with the child's weight/size, for "a cheaper option for this". */
export function findHref(item: ShoppingItem, children: ChildProfile[]): string | null {
  if (item.category !== "diapers") return null;
  const child = children.find((entry) => entry.id === item.childId) ?? children[0];
  const query = new URLSearchParams();
  if (child?.weightKg) query.set("weightKg", String(child.weightKg));
  if (child?.diaperSize) query.set("size", child.diaperSize);
  return `/shopping/find${query.size ? `?${query}` : ""}`;
}

/** Price per unit over the purchases (inline SVG), the latest change and the buying rhythm. */
function ItemTrend({ item, purchases }: { item: ShoppingItem; purchases: Purchase[] }) {
  const prices = unitPrices(item, purchases);
  const trend = unitPriceTrend(item, purchases);
  const cadence = cadenceDays(item, purchases);
  if (prices.length < 2 && cadence === null) return null;
  const values = prices.map((entry) => entry.price); const min = Math.min(...values); const max = Math.max(...values);
  const points = values.map((value, index) => `${Math.round(index / Math.max(1, values.length - 1) * 96) + 2},${Math.round(22 - (max === min ? 0.5 : (value - min) / (max - min)) * 18)}`).join(" ");
  const parts = [trend === null ? "" : trend === 0 ? "giá ổn định" : `giá/${item.unit} ${trend > 0 ? "+" : ""}${trend}% so với trước`, cadence === null ? "" : `mua mỗi ~${cadence} ngày`].filter(Boolean);
  return <p className="item-meta item-trend">
    {prices.length >= 2 && <svg width="100" height="24" viewBox="0 0 100 24" role="img" aria-label="Giá mỗi đơn vị qua các lần mua"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>}
    <span>{parts.join(" · ")}</span>
  </p>;
}

/** One household item: stock bar, rate and its source, rhythm, last price per unit, and quick actions. */
export function ItemCard({ estimate, familyChildren, purchases = [], extra, onChanged, onSave, onRemove }: { estimate: ItemEstimate; familyChildren: ChildProfile[]; purchases?: Purchase[]; extra?: React.ReactNode; onChanged: () => void; onSave: (item: ShoppingItem) => Promise<void>; onRemove: (item: ShoppingItem) => Promise<void> }) {
  const { item } = estimate;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [packSize, setPackSize] = useState(item.packSize ? String(item.packSize) : "");
  const [rate, setRate] = useState(item.dailyRate ? String(item.dailyRate) : "");
  const [error, setError] = useState("");
  const full = Math.max(estimate.remaining, (item.packSize ?? 0) * (estimate.lastPurchase?.packs ?? 1), 1);
  const unitPrice = estimate.lastPurchase ? Math.round(estimate.lastPurchase.amount / Math.max(1, estimate.lastPurchase.unitCount)) : null;
  const href = findHref(item, familyChildren);

  async function save(patch: Partial<ShoppingItem>) {
    try { await onSave({ ...item, ...patch }); setEditing(false); setError(""); onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
  }
  function submit() {
    const size = packSize.trim() ? Number(packSize) : undefined;
    const value = rate.trim() ? Number(rate.replace(",", ".")) : undefined;
    if (!name.trim()) { setError("Nhập tên món."); return; }
    if (size !== undefined && !(Number.isInteger(size) && size >= 1)) { setError("Mỗi gói là số nguyên ≥ 1."); return; }
    if (value !== undefined && !(value > 0 && value <= 1000)) { setError(`Mức dùng là số ${item.unit} mỗi ngày, ví dụ 6.`); return; }
    void save({ name: name.trim(), packSize: size, dailyRate: value });
  }

  return <article className="app-card item-card">
    <header><b>{item.name}</b><small>{CATEGORY_LABELS[item.category]} · {estimate.known ? `${RATE_LABEL[estimate.rateSource]} · ${estimate.purchaseCount} lần mua` : "chưa có lần mua"}</small></header>
    {estimate.known ? <>
      <span className="bar"><span className={estimate.daysLeft !== null && estimate.daysLeft <= 3 ? "over" : undefined} style={{ width: `${Math.round(estimate.remaining / full * 100)}%` }} /></span>
      <p className={`item-left due ${tone(estimate.daysLeft ?? 99)}`}>{estimate.daysLeft === 0 ? "Ước tính đã hết" : `~${estimate.remaining} ${item.unit} · còn ~${estimate.daysLeft} ngày`}</p>
      <p className="item-meta">{rateLabel(estimate.dailyRate, item.unit)}{estimate.lastPurchase ? ` · lần cuối ${dayLabel(estimate.lastPurchase.purchasedOn)}${estimate.lastPurchase.merchant ? ` ở ${estimate.lastPurchase.merchant}` : ""}` : ""}</p>
      {unitPrice !== null && <p className="item-meta">{vnd(unitPrice)}/{item.unit}</p>}
      <ItemTrend item={item} purchases={purchases} />
      {extra}
    </> : <p className="item-meta">Ghi lần mua đầu tiên để FamAgent bắt đầu đếm.</p>}
    {editing ? <form className="item-edit" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <label>Tên<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Mỗi gói ({item.unit})<input type="number" min={1} value={packSize} onChange={(event) => setPackSize(event.target.value)} /></label>
      <label>{item.unit}/ngày (để trống = FamAgent tự tính)<input inputMode="decimal" value={rate} placeholder={rateText(estimate.dailyRate)} onChange={(event) => setRate(event.target.value)} /></label>
      <span className="purchase-actions"><button type="submit" className="app-btn">Lưu</button><button type="button" className="ledger-link" onClick={() => void save({ status: item.status === "active" ? "paused" : "active" })}>Ngừng theo dõi</button><button type="button" className="ledger-link danger" onClick={() => { if (window.confirm(`Xóa ${item.name} và các lần mua của món này?`)) void onRemove(item).then(onChanged).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Chưa xóa được.")); }}>Xóa</button><button type="button" className="ledger-link" onClick={() => setEditing(false)}>Hủy</button></span>
    </form> : <footer className="item-actions">
      <MarkPurchased compact target={{ itemId: item.id, productId: item.productId, productName: item.name, brand: item.brand, merchant: item.merchant, price: estimate.lastPackPrice, piecesPerPack: item.packSize }} source="quick" onDone={onChanged} />
      {href && <Link className="ledger-link" href={href}>Tìm lựa chọn khác</Link>}
      <button type="button" className="ledger-link" onClick={() => setEditing(true)}>Sửa</button>
    </footer>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </article>;
}
