"use client";

import { useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { trackEvent } from "@/lib/experience/storage";
import type { ChildProfile } from "@/lib/experience/types";
import { parseVnd, todayLocal } from "@/lib/money/parse";
import type { PurchaseDraft } from "@/lib/shopping/capture";
import { CATEGORY_LABELS, CHILD_CATEGORIES, DEFAULT_UNIT, ITEM_CATEGORIES, type ItemCategory, type ShoppingItem } from "@/lib/shopping/items";
import { recordPurchase } from "@/lib/shopping/purchase-client";
import type { Purchase, PurchaseSource } from "@/lib/shopping/purchases";

export interface CatalogLink { productId: string; variantId?: string; offerId?: string; brand?: string }

/**
 * The one confirmation card for every purchase capture (chat, quick entry, photo, "Đã mua", plan, ledger link):
 * prefilled from the draft, the family fixes what is wrong, then one tap writes purchase + ledger expense + item.
 */
export function PurchaseDraftCard({ draft, items, familyChildren, source, catalog, linkTransactionId, defaultChildId, title = "Ghi lần mua", onSaved, onCancel }: {
  draft: PurchaseDraft; items: ShoppingItem[]; familyChildren: ChildProfile[]; source: PurchaseSource; catalog?: CatalogLink; linkTransactionId?: string; title?: string;
  /** Child the purchase is for when the caller knows (a recommendation for bé Gold). */
  defaultChildId?: string;
  onSaved: (purchase: Purchase, item: ShoppingItem) => void; onCancel?: () => void;
}) {
  const active = items.filter((item) => item.status !== "outgrown");
  const [itemId, setItemId] = useState(draft.itemId ?? "");
  const [name, setName] = useState(draft.name);
  const [category, setCategory] = useState<ItemCategory>(draft.category);
  const [unit, setUnit] = useState(draft.unit);
  const [packSize, setPackSize] = useState(draft.packSize ? String(draft.packSize) : "");
  const [packs, setPacks] = useState(String(draft.packs));
  const [amount, setAmount] = useState(draft.amount ? String(draft.amount) : "");
  const [merchant, setMerchant] = useState(draft.merchant ?? "");
  const [date, setDate] = useState(draft.purchasedOn);
  const [forChild, setForChild] = useState(CHILD_CATEGORIES.has(draft.category));
  const existing = active.find((item) => item.id === itemId);
  const [childId, setChildId] = useState(defaultChildId ?? existing?.childId ?? familyChildren[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function pick(id: string) {
    setItemId(id);
    const item = active.find((entry) => entry.id === id);
    if (!item) return;
    setName(item.name); setCategory(item.category); setUnit(item.unit); setForChild(CHILD_CATEGORIES.has(item.category));
    if (item.packSize) setPackSize(String(item.packSize));
    if (item.merchant && !merchant) setMerchant(item.merchant);
    if (item.childId) setChildId(item.childId);
  }

  async function submit() {
    const paid = parseVnd(amount); const count = Number(packs); const size = Number(packSize);
    if (paid === null || paid < 0) { setError("Nhập số tiền đã trả (ví dụ 350k)."); return; }
    if (!(Number.isInteger(count) && count >= 1 && count <= 50)) { setError("Số gói từ 1 đến 50."); return; }
    if (!(Number.isInteger(size) && size >= 1)) { setError(`Nhập số ${unit || "đơn vị"} trong mỗi gói.`); return; }
    if (!existing && !name.trim()) { setError("Nhập tên món."); return; }
    const kid = forChild && childId ? childId : undefined;
    const item: ShoppingItem = existing
      ? { ...existing, packSize: existing.packSize ?? size, merchant: merchant.trim() || existing.merchant, productId: existing.productId ?? catalog?.productId, brand: existing.brand ?? catalog?.brand }
      : { id: crypto.randomUUID(), name: name.trim(), category, unit: unit.trim() || DEFAULT_UNIT[category], packSize: size, merchant: merchant.trim() || undefined, childId: kid, productId: catalog?.productId, brand: catalog?.brand ?? draft.brand, status: "active" };
    const purchase: Purchase = { id: crypto.randomUUID(), itemId: item.id, productId: catalog?.productId ?? item.productId, variantId: catalog?.variantId, offerId: catalog?.offerId, productName: item.name, brand: item.brand, merchant: merchant.trim() || undefined, amount: paid, packs: count, unitCount: count * size, purchasedOn: date, childId: kid, source };
    setBusy(true); setError("");
    try {
      const stored = await recordPurchase(purchase, forChild, item, linkTransactionId);
      trackEvent("purchase_recorded", { source, category: item.category, amount: paid, packs: count });
      onSaved(stored, item);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa ghi được lần mua."); }
    finally { setBusy(false); }
  }

  const total = (Number(packs) || 1) * (Number(packSize) || 0);
  return <form className="app-card draft-card" aria-label={title} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
    <b>{title}</b>
    <label>Món<select value={itemId} onChange={(event) => pick(event.target.value)}>
      <option value="">+ Món mới</option>
      {active.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {!existing && <div className="draft-row">
      <label className="grow">Tên món<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Bỉm Merries size L" /></label>
      <label>Nhóm<select value={category} onChange={(event) => { const next = event.target.value as ItemCategory; setCategory(next); setForChild(CHILD_CATEGORIES.has(next)); if (!packSize) setUnit(DEFAULT_UNIT[next]); }}>{ITEM_CATEGORIES.map((id) => <option key={id} value={id}>{CATEGORY_LABELS[id]}</option>)}</select></label>
    </div>}
    <div className="draft-row">
      <label>Đã trả<input inputMode="decimal" value={amount} placeholder="350k" onChange={(event) => setAmount(event.target.value)} /></label>
      <label>Số gói<input type="number" min={1} max={50} value={packs} onChange={(event) => setPacks(event.target.value)} /></label>
      <label>Mỗi gói<span className="draft-unit"><input type="number" min={1} value={packSize} placeholder="64" onChange={(event) => setPackSize(event.target.value)} aria-label="Số đơn vị mỗi gói" />{existing ? <em>{unit}</em> : <input value={unit} onChange={(event) => setUnit(event.target.value)} aria-label="Đơn vị" />}</span></label>
    </div>
    <div className="draft-row">
      <label className="grow">Nơi mua<input value={merchant} placeholder="Shopee" onChange={(event) => setMerchant(event.target.value)} /></label>
      <label>Ngày mua<input type="date" value={date} max={todayLocal()} onChange={(event) => setDate(event.target.value)} /></label>
    </div>
    <label className="purchase-check"><input type="checkbox" checked={forChild} onChange={(event) => setForChild(event.target.checked)} /> Tính vào chi cho con
      {forChild && familyChildren.length > 1 && <select value={childId} onChange={(event) => setChildId(event.target.value)} aria-label="Cho bé">{familyChildren.map((child) => <option key={child.id} value={child.id}>{child.name ? `bé ${child.name}` : "bé"}</option>)}</select>}
    </label>
    <small>{total ? `${Number(packs) || 1} gói × ${packSize} ${unit} = ${total} ${unit}` : "Nhập số đơn vị mỗi gói để FamAgent ước tính ngày hết"}{linkTransactionId ? " · gắn với khoản đã có trong Tiền" : ` · ghi ${parseVnd(amount) ? vnd(parseVnd(amount)!) : ""} vào Tiền nhóm ${forChild ? "Con" : "Mua sắm"}`}</small>
    {error && <p className="form-error" role="alert">{error}</p>}
    <span className="purchase-actions"><button type="submit" className="app-btn" disabled={busy}>{busy ? "Đang ghi…" : "Ghi lại"}</button>{onCancel && <button type="button" className="ledger-link" onClick={onCancel}>Hủy</button>}</span>
  </form>;
}
