"use client";

import { useRef, useState } from "react";
import { cloudEnabled } from "@/lib/experience/cloud";
import { trackEvent } from "@/lib/experience/storage";
import type { ChildProfile } from "@/lib/experience/types";
import type { PurchaseDraft } from "@/lib/shopping/capture";
import type { ShoppingItem } from "@/lib/shopping/items";
import type { Purchase } from "@/lib/shopping/purchases";
import { PurchaseDraftCard } from "./purchase-draft-card";

const MAX_SIDE = 1280;

/** Shrinks a photo to ≤1280 px JPEG in the browser so the upload is small and holds no EXIF location. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** Camera button: photo of an order → one confirmation card per line (source "photo"). Shown only with AI consent. */
export function PhotoCapture({ items, familyChildren, aiConsent, onSaved }: { items: ShoppingItem[]; familyChildren: ChildProfile[]; aiConsent: boolean; onSaved: (purchase: Purchase, item: ShoppingItem) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Array<PurchaseDraft & { key: string }>>([]);

  async function read(file: File) {
    setBusy(true); setError("");
    try {
      const image = await shrink(file);
      const response = await fetch("/api/shopping/receipt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, aiConsent: cloudEnabled ? undefined : aiConsent, items: cloudEnabled ? undefined : items }) });
      const data = await response.json().catch(() => ({})) as { drafts?: PurchaseDraft[]; error?: string };
      if (!response.ok || !data.drafts) throw new Error(data.error || "Chưa đọc được ảnh.");
      setDrafts(data.drafts.map((draft) => ({ ...draft, key: crypto.randomUUID() })));
      trackEvent("receipt_read", { lines: data.drafts.length });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa đọc được ảnh."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }

  if (!aiConsent) return null;
  return <div className="photo-capture">
    <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void read(file); }} />
    <button type="button" className="app-btn ghost" disabled={busy} onClick={() => input.current?.click()} aria-label="Chụp hoặc chọn ảnh đơn hàng">{busy ? "Đang đọc ảnh…" : "Ghi từ ảnh đơn hàng"}</button>
    {(error || drafts.length > 0) && <div className="photo-drafts">
      {error && <p className="form-error" role="alert">{error}</p>}
      {drafts.length > 0 && <p className="app-sub">Đọc được {drafts.length} dòng — kiểm tra từng dòng rồi ghi lại. Ảnh không được lưu.</p>}
      {drafts.map((draft) => <PurchaseDraftCard key={draft.key} draft={draft} items={items} familyChildren={familyChildren} source="photo" title={draft.name} onCancel={() => setDrafts((current) => current.filter((entry) => entry.key !== draft.key))} onSaved={(purchase, item) => { setDrafts((current) => current.filter((entry) => entry.key !== draft.key)); onSaved(purchase, item); }} />)}
    </div>}
  </div>;
}
