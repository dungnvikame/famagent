"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PhotoCapture } from "@/components/shopping/photo-capture";
import { PurchaseDraftCard } from "@/components/shopping/purchase-draft-card";
import { cloudEnabled, loadCloudProfile } from "@/lib/experience/cloud";
import { getProfile } from "@/lib/experience/storage";
import type { FamilyProfile } from "@/lib/experience/types";
import { classifyInbox, moneySummary, purchaseSummary, type InboxResult } from "@/lib/inbox/classify";
import { linkAdvice, type LinkAdvice } from "@/lib/inbox/link-advice";
import type { LinkInfo } from "@/lib/inbox/link";
import { loadMoney } from "@/lib/money/client";
import { parseVnd, todayLocal } from "@/lib/money/parse";
import { monthKey, summarizeMonth, type MonthSummary } from "@/lib/money/summary";
import { familyPolicy } from "@/lib/policy/family-policy";
import { loadShopping, savePlanEntry } from "@/lib/shopping/item-client";
import { estimateItems, itemRateResolver } from "@/lib/shopping/items";
import { SHOPPING_CATEGORIES } from "@/lib/shopping/reconcile";
import type { ShoppingState } from "@/lib/shopping/state";
import { MoneyDraftCard } from "./money-draft-card";

/** Pages listen for this to reload after the Inbox wrote something; `famagent:open-inbox` opens it (optional prefill). */
export const DATA_CHANGED = "famagent:data-changed";
export const OPEN_INBOX = "famagent:open-inbox";
export const openInbox = (text = "") => window.dispatchEvent(new CustomEvent(OPEN_INBOX, { detail: text }));
/** The agent page listens for this: a question typed in the Inbox while already on /agent is sent there directly. */
export const ASK_AGENT = "famagent:ask-agent";
const changed = () => window.dispatchEvent(new Event(DATA_CHANGED));

interface Context { profile: FamilyProfile | null; shopping: ShoppingState; month: MonthSummary | null }

/**
 * Universal Inbox (core journey spec §2): one place to tell FamAgent anything — a purchase, an expense, income, a photo
 * of an order, a product link or a question. Every reading is confirmed ("Đúng" / "Sửa") before anything is saved.
 */
export function Inbox() {
  const router = useRouter();
  const pathname = usePathname();
  const opener = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [context, setContext] = useState<Context | null>(null);
  const [result, setResult] = useState<InboxResult | null>(null);
  const [key, setKey] = useState(0);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function loadContext(): Promise<Context> {
    const [profile, shopping, money] = await Promise.all([
      (cloudEnabled ? loadCloudProfile() : Promise.resolve(getProfile())).catch(() => null),
      loadShopping().catch((): ShoppingState => ({ items: [], purchases: [], checks: [], plan: [], dismissed: [] })),
      loadMoney(monthKey(new Date())).then(summarizeMonth).catch(() => null),
    ]);
    const next = { profile, shopping, month: money };
    setContext(next);
    return next;
  }

  useEffect(() => {
    const show = (event: Event) => { opener.current = document.activeElement as HTMLElement | null; const prefill = (event as CustomEvent<string>).detail; setOpen(true); setDone(""); setResult(null); if (typeof prefill === "string" && prefill) setText(prefill); void loadContext(); };
    window.addEventListener(OPEN_INBOX, show);
    return () => window.removeEventListener(OPEN_INBOX, show);
  }, []);
  useEffect(() => { if (open) window.setTimeout(() => input.current?.focus(), 0); }, [open]);
  // Escape closes; focus goes back to whatever opened the Inbox.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  function close() { setOpen(false); window.setTimeout(() => opener.current?.focus?.(), 0); }

  async function submit() {
    if (!text.trim()) return;
    setError(""); setDone("");
    const ctx = context ?? await loadContext();
    const next = classifyInbox(text, ctx.shopping.items, todayLocal());
    if (next.kind === "question") {
      close(); setText("");
      if (pathname.startsWith("/agent")) window.dispatchEvent(new CustomEvent(ASK_AGENT, { detail: next.text }));
      else router.push(`/agent?q=${encodeURIComponent(next.text)}`);
      return;
    }
    setResult(next); setKey((value) => value + 1);
  }
  function saved(message: string) { setDone(message); setResult(null); setText(""); changed(); void loadContext(); }

  const children = context?.profile?.children ?? [];
  return <>
    <button type="button" className="inbox-trigger fab" onClick={() => openInbox()} aria-haspopup="dialog">＋ Ghi nhanh</button>
    {open && createPortal(<>
      <button type="button" className="purchase-backdrop" aria-label="Đóng" onClick={close} />
      <div className="purchase-form inbox-sheet" role="dialog" aria-modal="true" aria-label="Ghi nhanh cho FamAgent">
        <div className="app-card inbox-card">
          <b>Nói cho FamAgent</b>
          <form className="inbox-row" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <input ref={input} value={text} onChange={(event) => setText(event.target.value)} placeholder="Hôm nay mua bỉm 369k · ăn trưa 80k · dán link…" aria-label="Nội dung cần ghi" />
            <button type="submit" className="app-btn">Ghi</button>
          </form>
          <small className="app-sub">Chi tiêu, lần mua, khoản thu, link sản phẩm hoặc câu hỏi — FamAgent đọc rồi hỏi lại trước khi lưu.</small>
          {context && <PhotoCapture items={context.shopping.items} familyChildren={children} aiConsent={Boolean(context.profile?.aiConsent)} onSaved={(purchase, item) => saved(`✓ Đã ghi ${item.name} vào Tiền và Mua sắm`)} />}
          {error && <p className="form-error" role="alert">{error}</p>}
          {done && <p className="purchased-done" role="status">{done}</p>}
        </div>
        {result?.kind === "purchase" && context && <PurchaseDraftCard key={key} draft={result.purchase} items={context.shopping.items} familyChildren={children} source="quick" summary={purchaseSummary(result.purchase, children, todayLocal(), context.shopping.items.find((item) => item.id === result.purchase.itemId)?.childId)} title="Kiểm tra lần mua" onCancel={() => setResult(null)} onSaved={(purchase, item) => saved(`✓ Tiền +${Math.round(purchase.amount / 1000)}K · Mua sắm +1 lần mua · ${item.name}: theo dõi ${purchase.unitCount} ${item.unit}`)} />}
        {(result?.kind === "expense" || result?.kind === "income") && <MoneyDraftCard key={key} draft={result.money} summary={moneySummary(result.money, todayLocal())} onCancel={() => setResult(null)} onSaved={saved} />}
        {result?.kind === "link" && context && <LinkCard key={key} url={result.url} context={context} onSaved={saved} onCancel={() => setResult(null)} />}
      </div>
    </>, document.body)}
  </>;
}

/** Link → read what the shop page shares; ask for anything missing; compare with our history, stock and budget. */
function LinkCard({ url, context, onSaved, onCancel }: { url: string; context: Context; onSaved: (text: string) => void; onCancel: () => void }) {
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [advice, setAdvice] = useState<LinkAdvice | null>(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/inbox/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) })
      .then(async (response) => { const data = await response.json().catch(() => ({})) as { info?: LinkInfo; error?: string }; if (!response.ok || !data.info) throw new Error(data.error || "Chưa đọc được link."); setInfo(data.info); setTitle(data.info.title ?? ""); setPrice(data.info.price ? String(data.info.price) : ""); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Chưa đọc được link."));
  }, [url]);

  function assess() {
    const value = parseVnd(price);
    if (!title.trim()) { setError("Nhập tên sản phẩm (sàn không cho đọc)."); return; }
    if (!value) { setError("Nhập giá đang bán (sàn không cho đọc giá)."); return; }
    setError("");
    const now = new Date();
    const estimates = estimateItems(context.shopping.items, context.shopping.purchases, itemRateResolver(context.profile, now), now, context.shopping.checks);
    const lines = context.month?.byCategory.filter((line) => SHOPPING_CATEGORIES.includes(line.category)) ?? [];
    const limit = lines.reduce((sum, line) => sum + (line.limit ?? 0), 0);
    setAdvice(linkAdvice(title.trim(), value, info?.merchant ?? "", todayLocal(), context.shopping.items, context.shopping.purchases, estimates, limit ? { spent: lines.reduce((sum, line) => sum + line.spent, 0), limit } : undefined, context.month?.remainingOfPlan, familyPolicy(context.profile).reorderWindowDays));
  }
  async function plan() {
    if (!advice) return;
    try { await savePlanEntry({ id: crypto.randomUUID(), month: monthKey(new Date()), itemId: advice.item?.id, name: advice.draft.name, packs: 1, estAmount: advice.draft.amount, reason: "manual", status: "planned" }); onSaved(`✓ Đã thêm ${advice.draft.name} vào kế hoạch tháng`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
  }

  if (buying && advice) return <PurchaseDraftCard draft={advice.draft} items={context.shopping.items} familyChildren={context.profile?.children ?? []} source="quick" summary={purchaseSummary(advice.draft, context.profile?.children ?? [], todayLocal(), advice.item?.childId)} title="Ghi lần mua từ link" onCancel={() => setBuying(false)} onSaved={(purchase, item) => onSaved(`✓ Đã ghi ${item.name}, ${Math.round(purchase.amount / 1000)}K`)} />;
  return <div className="app-card draft-card">
    <b>{info ? `Link ${info.merchant}` : "Đang đọc link…"}</b>
    {info && <>
      <div className="draft-row">
        <label className="grow">Sản phẩm<input value={title} onChange={(event) => { setTitle(event.target.value); setAdvice(null); }} placeholder="Bỉm quần Merries L64" /></label>
        <label>Giá đang bán<input inputMode="decimal" value={price} onChange={(event) => { setPrice(event.target.value); setAdvice(null); }} placeholder="349k" /></label>
      </div>
      {!info.price && !advice && <small className="app-sub">Sàn không cho đọc giá — nhập giá bạn đang thấy để FamAgent so sánh.</small>}
      {advice ? <>
        <ul className="ob-summary-list">{advice.lines.map((line) => <li key={line}>{line}</li>)}</ul>
        <span className="purchase-actions"><button type="button" className="app-btn" onClick={() => setBuying(true)}>Đã mua</button><button type="button" className="app-btn ghost" onClick={() => void plan()}>Thêm vào kế hoạch</button><a className="ledger-link" href={info.url} target="_blank" rel="noopener noreferrer">Mở link</a><button type="button" className="ledger-link" onClick={onCancel}>Bỏ</button></span>
      </> : <span className="purchase-actions"><button type="button" className="app-btn" onClick={assess}>Xem có nên mua</button><button type="button" className="ledger-link" onClick={onCancel}>Bỏ</button></span>}
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
