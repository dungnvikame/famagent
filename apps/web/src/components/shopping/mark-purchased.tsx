"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { vnd } from "@/lib/catalog/format";
import { trackEvent } from "@/lib/experience/storage";
import { parseVnd, todayLocal } from "@/lib/money/parse";
import { recordPurchase } from "@/lib/shopping/purchase-client";
import type { Purchase } from "@/lib/shopping/purchases";

export interface PurchaseTarget { productId: string; productName: string; brand?: string; variantId?: string; offerId?: string; merchant?: string; price?: number; piecesPerPack: number; childId?: string }

/**
 * "Đã mua" → PURCHASE_COMPLETED (SPEC_V2 §30): one tap records the purchase, writes the expense into Tiền and
 * starts the stock estimate. Amount/packs/date are prefilled; the family only corrects what differs.
 */
export function MarkPurchased({ target, compact = false, onDone }: { target: PurchaseTarget; compact?: boolean; onDone?: (purchase: Purchase) => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(target.price ? String(target.price) : "");
  const [packs, setPacks] = useState("1");
  const [date, setDate] = useState(todayLocal());
  const [forChild, setForChild] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Purchase | null>(null);

  async function submit() {
    const paid = parseVnd(amount); const count = Number(packs);
    if (paid === null || paid < 0) { setError("Nhập số tiền đã trả (ví dụ 350k)."); return; }
    if (!(count >= 1 && count <= 50)) { setError("Số gói từ 1 đến 50."); return; }
    setBusy(true); setError("");
    try {
      const purchase = await recordPurchase({ id: crypto.randomUUID(), productId: target.productId, productName: target.productName, brand: target.brand, variantId: target.variantId, offerId: target.offerId, merchant: target.merchant, amount: paid, packs: count, unitCount: count * target.piecesPerPack, purchasedOn: date, childId: forChild ? target.childId : undefined }, forChild);
      trackEvent("purchase_recorded", { productId: target.productId, amount: paid, packs: count });
      setDone(purchase); setOpen(false); onDone?.(purchase);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa ghi được lần mua."); }
    finally { setBusy(false); }
  }

  if (done) return <span className="purchased-done" role="status">✓ Đã ghi {vnd(done.amount)} vào Tiền · theo dõi {done.unitCount} miếng</span>;
  return <span className="mark-purchased">
    <button type="button" className={compact ? "ledger-link" : "app-btn ghost"} onClick={() => setOpen((value) => !value)} aria-expanded={open}>Đã mua</button>
    {open && createPortal(<>
    <button type="button" className="purchase-backdrop" aria-label="Đóng" onClick={() => setOpen(false)} />
    <div className="purchase-form app-card" role="dialog" aria-modal="true" aria-label={`Ghi lần mua ${target.productName}`}>
      <b>{target.productName}</b>
      <label>Đã trả<input inputMode="decimal" value={amount} placeholder="350k" onChange={(event) => setAmount(event.target.value)} autoFocus /></label>
      <label>Số gói<input type="number" min={1} max={50} value={packs} onChange={(event) => setPacks(event.target.value)} /></label>
      <label>Ngày mua<input type="date" value={date} max={todayLocal()} onChange={(event) => setDate(event.target.value)} /></label>
      <label className="purchase-check"><input type="checkbox" checked={forChild} onChange={(event) => setForChild(event.target.checked)} /> Tính vào chi cho con</label>
      <small>{Number(packs) || 1} gói × {target.piecesPerPack} miếng = {(Number(packs) || 1) * target.piecesPerPack} miếng · ghi vào Tiền nhóm {forChild ? "Con" : "Mua sắm"}</small>
      {error && <p className="form-error" role="alert">{error}</p>}
      <span className="purchase-actions"><button type="button" className="app-btn" disabled={busy} onClick={() => void submit()}>Ghi lại</button><button type="button" className="ledger-link" onClick={() => setOpen(false)}>Hủy</button></span>
    </div></>, document.body)}
  </span>;
}
