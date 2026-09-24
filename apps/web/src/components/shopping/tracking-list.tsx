"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { cloudEnabled, loadCloudProfile } from "@/lib/experience/cloud";
import { childAgeMonths } from "@/lib/experience/profile-mapper";
import { getProfile } from "@/lib/experience/storage";
import type { FamilyProfile } from "@/lib/experience/types";
import { deletePurchase, loadPurchases, setPurchaseRate } from "@/lib/shopping/purchase-client";
import { defaultDailyRate, estimateStock, REORDER_WINDOW_DAYS, type Purchase, type StockEstimate } from "@/lib/shopping/purchases";
import { MarkPurchased } from "./mark-purchased";

/** Rate resolver shared with Home: the child on the purchase (or the first child) sets the default pieces/day. */
export const rateResolver = (profile: FamilyProfile | null) => (purchase: Purchase) => { const child = profile?.children.find((item) => item.id === purchase.childId) ?? profile?.children[0]; return defaultDailyRate(child ? childAgeMonths(child) : undefined); };

const dayLabel = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;

/** Shopping → "Đang theo dõi" (consumption) and "Đã mua" (history), both from the same purchase list. */
export function TrackingList({ mode }: { mode: "tracking" | "history" }) {
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [rate, setRate] = useState("");
  const reload = useCallback(async () => { try { setPurchases(await loadPurchases()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải lịch sử mua."); setPurchases([]); } }, []);
  useEffect(() => { void reload(); (cloudEnabled ? loadCloudProfile() : Promise.resolve(getProfile())).then(setProfile).catch(() => {}); }, [reload]);

  if (purchases === null) return <p className="app-sub" aria-busy="true">Đang tải…</p>;
  if (!purchases.length) return <div className="app-card app-empty"><strong>{mode === "tracking" ? "Chưa theo dõi món nào" : "Chưa có lần mua nào"}</strong><p style={{ margin: 0 }}>Bấm “Đã mua” trên một gợi ý của FamAgent hoặc trang sản phẩm: lần mua được ghi vào Tiền, FamAgent ước tính ngày hết và nhắc mua lại trên Trang chủ.</p><Link className="app-btn ghost" href="/agent">Hỏi FamAgent tìm đồ →</Link>{error && <p className="form-error">{error}</p>}</div>;

  if (mode === "history") return <div className="app-card app-rows">{purchases.map((item) => <div key={item.id}><span><b>{item.productName}{item.packs > 1 ? ` ×${item.packs}` : ""}</b><small>{dayLabel(item.purchasedOn)}{item.merchant ? ` · ${item.merchant}` : ""} · {item.unitCount} miếng{item.transactionId ? " · đã ghi vào Tiền" : ""}</small></span><span className="row-actions"><b>{vnd(item.amount)}</b><button type="button" className="ledger-link danger" onClick={() => { if (window.confirm(`Xóa lần mua “${item.productName}” (và khoản chi tương ứng)?`)) void deletePurchase(item.id).then(reload).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Chưa xóa được.")); }}>Xóa</button></span></div>)}{error && <p className="form-error">{error}</p>}</div>;

  const estimates: StockEstimate[] = estimateStock(purchases, rateResolver(profile));
  async function saveRate(item: StockEstimate) {
    const value = rate.trim() ? Number(rate.replace(",", ".")) : null;
    if (value !== null && !(value > 0 && value <= 100)) { setError("Mức dùng là số miếng mỗi ngày, ví dụ 6."); return; }
    try { await setPurchaseRate(item.lastPurchase.id, value); setEditing(null); setError(""); await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
  }
  return <div className="brief-att">
    {estimates.map((item) => <div className="app-card brief-card tracking-card" key={item.productId}>
      <span className={`ic ${item.daysLeft <= 3 ? "warn" : item.daysLeft <= REORDER_WINDOW_DAYS ? "info" : "ok"}`} aria-hidden="true">{item.daysLeft}d</span>
      <div className="t"><b>{item.productName}</b><small>{item.daysLeft === 0 ? "Ước tính đã hết" : `Còn khoảng ${item.daysLeft} ngày (~${item.remaining} miếng)`} · {item.dailyRate} miếng/ngày{item.rateSource === "default" ? " (mặc định theo tuổi bé)" : ""} · mua {item.purchaseCount} lần, gần nhất {dayLabel(item.lastPurchase.purchasedOn)}
        {editing === item.productId ? <span className="budget-edit"><input autoFocus inputMode="decimal" aria-label="Miếng mỗi ngày" placeholder="6" value={rate} onChange={(event) => setRate(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveRate(item); if (event.key === "Escape") setEditing(null); }} /><button type="button" className="app-btn" onClick={() => void saveRate(item)}>Lưu</button></span> : <button type="button" className="ledger-link" onClick={() => { setEditing(item.productId); setRate(item.rateSource === "set" ? String(item.dailyRate) : ""); }}>Sửa mức dùng</button>}</small></div>
      <span className="tracking-actions"><Link className={`app-btn${item.daysLeft <= REORDER_WINDOW_DAYS ? "" : " ghost"}`} href={`/agent?q=${encodeURIComponent(`Mua lại ${item.productName}`)}`}>Mua lại</Link><MarkPurchased compact target={{ productId: item.productId, productName: item.productName, brand: item.brand, variantId: item.lastPurchase.variantId, offerId: item.lastPurchase.offerId, merchant: item.lastPurchase.merchant, price: item.lastPurchase.amount / item.lastPurchase.packs, piecesPerPack: Math.round(item.lastPurchase.unitCount / item.lastPurchase.packs), childId: item.lastPurchase.childId }} onDone={() => void reload()} /></span>
    </div>)}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
