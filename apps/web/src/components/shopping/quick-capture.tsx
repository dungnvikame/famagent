"use client";

import { useState } from "react";
import type { ChildProfile } from "@/lib/experience/types";
import { todayLocal } from "@/lib/money/parse";
import { parsePurchase, type PurchaseDraft } from "@/lib/shopping/capture";
import type { ShoppingItem } from "@/lib/shopping/items";
import type { Purchase } from "@/lib/shopping/purchases";
import { PurchaseDraftCard } from "./purchase-draft-card";

/** "Ghi lần mua…" — one sentence, parsed by rules, confirmed on the shared card before anything is saved. */
export function QuickCapture({ items, familyChildren, onSaved, extra }: { items: ShoppingItem[]; familyChildren: ChildProfile[]; onSaved: (purchase: Purchase, item: ShoppingItem) => void; extra?: React.ReactNode }) {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<PurchaseDraft | null>(null);
  const [saved, setSaved] = useState("");
  const [key, setKey] = useState(0);

  function parse() {
    if (!text.trim()) return;
    setDraft(parsePurchase(text, items, todayLocal())); setKey((value) => value + 1); setSaved("");
  }

  return <section className="app-section quick-capture" aria-labelledby="qc-title">
    <h2 id="qc-title" className="sr-only">Ghi lần mua</h2>
    <form className="app-card quick-capture-bar" onSubmit={(event) => { event.preventDefault(); parse(); }}>
      <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Ghi lần mua… vd: 2 bịch Merries L 64 miếng 690k ở Shopee" aria-label="Ghi lần mua bằng một câu" />
      <button type="submit" className="app-btn">Ghi</button>
    </form>
    {extra}
    {saved && <p className="purchased-done" role="status">{saved}</p>}
    {draft && <PurchaseDraftCard key={key} draft={draft} items={items} familyChildren={familyChildren} source="quick" title="Kiểm tra rồi ghi lại" onCancel={() => setDraft(null)} onSaved={(purchase, item) => { setDraft(null); setText(""); setSaved(`✓ Đã ghi ${item.name} — ${purchase.unitCount} ${item.unit}, vào Tài chính`); onSaved(purchase, item); }} />}
  </section>;
}
