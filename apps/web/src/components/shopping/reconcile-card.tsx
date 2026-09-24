"use client";

import { useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { trackEvent } from "@/lib/experience/storage";
import type { ChildProfile } from "@/lib/experience/types";
import type { MoneyTransaction } from "@/lib/money/types";
import { dismissTransaction } from "@/lib/shopping/item-client";
import { CHILD_CATEGORIES, type ShoppingItem } from "@/lib/shopping/items";
import { recordPurchase } from "@/lib/shopping/purchase-client";
import type { Purchase } from "@/lib/shopping/purchases";
import { packsFor, suggestItems } from "@/lib/shopping/reconcile";
import { PurchaseDraftCard } from "./purchase-draft-card";

const dayLabel = (iso: string) => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;

/**
 * "Khoản *Shopee 690k* ngày 12/9 là mua gì?" — an expense typed in Tiền becomes a purchase of an item in one tap
 * (packs guessed from the last price per pack, same amount and day, linked to the existing ledger row — never a second expense).
 */
export function ReconcileCard({ tx, items, purchases, familyChildren, onDone }: { tx: MoneyTransaction; items: ShoppingItem[]; purchases: Purchase[]; familyChildren: ChildProfile[]; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [other, setOther] = useState(false);
  const [error, setError] = useState("");
  const options = suggestItems(tx, items, purchases);

  async function link(item: ShoppingItem) {
    setBusy(true); setError("");
    try {
      const size = item.packSize ?? 1;
      const packs = packsFor(tx.amount, item, purchases);
      await recordPurchase({ id: crypto.randomUUID(), itemId: item.id, productId: item.productId, productName: item.name, brand: item.brand, merchant: item.merchant, amount: tx.amount, packs, unitCount: size * packs, purchasedOn: tx.occurredOn, childId: tx.childId ?? item.childId, source: "ledger" }, CHILD_CATEGORIES.has(item.category), undefined, tx.id);
      trackEvent("ledger_linked", { category: item.category });
      onDone();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa gắn được."); }
    finally { setBusy(false); }
  }
  async function dismiss() {
    setBusy(true);
    try { await dismissTransaction(tx.id); onDone(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); } finally { setBusy(false); }
  }

  return <div className="app-card reconcile-card">
    <p><span className="ic info" aria-hidden="true">?</span> Khoản <b>{tx.content}</b> {vnd(tx.amount)} ngày {dayLabel(tx.occurredOn)} là mua gì?</p>
    {other ? <PurchaseDraftCard draft={{ name: tx.content, category: tx.forChild ? "diapers" : "other", unit: "gói", packs: 1, amount: tx.amount, purchasedOn: tx.occurredOn, missing: [] }} items={items} familyChildren={familyChildren} source="ledger" linkTransactionId={tx.id} title="Gắn với một món" onCancel={() => setOther(false)} onSaved={() => onDone()} />
      : <span className="chip-row">
        {options.map((item) => <button key={item.id} type="button" className="chip" disabled={busy} onClick={() => void link(item)}>{item.name}</button>)}
        <button type="button" className="chip" disabled={busy} onClick={() => setOther(true)}>Món khác…</button>
        <button type="button" className="chip ghost" disabled={busy} onClick={() => void dismiss()}>Không phải đồ dùng</button>
      </span>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
