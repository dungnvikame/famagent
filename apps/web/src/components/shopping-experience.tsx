"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { vnd } from "@/lib/catalog/format";
import { getConversations, getProfile, getSavedProducts, saveConversations, saveProfile, saveSavedProducts, trackEvent } from "@/lib/experience/storage";
import type { ChatResponse, ChatTurn, Conversation, FamilyProfile, Recommendation } from "@/lib/experience/types";
import { clearPendingImport, cloudEnabled, isPendingImport, loadCloudConversations, loadCloudProfile, loadCloudSaved, saveCloudConversation, saveCloudProfile, setCloudSaved } from "@/lib/experience/cloud";

const starters = ["Tìm bỉm ban đêm cho bé dưới 400k", "Bỉm nào có giá mỗi miếng hợp lý?", "Tìm bỉm cho bé 10kg hay bị tràn"];
function newConversation(): Conversation { return { id: crypto.randomUUID(), title: "Cuộc trò chuyện mới", turns: [], updatedAt: new Date().toISOString() }; }

export function ShoppingExperience() {
  const router = useRouter();
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [agentMode, setAgentMode] = useState<"ai" | "rules">("rules");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let family = getProfile();
        let existing = getConversations();
        let savedIds = getSavedProducts();
        if (cloudEnabled) {
          const remote = await loadCloudProfile();
          if (remote) family = remote;
          else if (family?.onboardedAt && isPendingImport(family.onboardedAt)) { await saveCloudProfile(family); clearPendingImport(); }
          else family = null;
          existing = await loadCloudConversations();
          savedIds = await loadCloudSaved();
        }
        if (cancelled) return;
        if (!family?.onboardedAt) { router.replace("/"); return; }
        saveProfile(family); setProfile(family); setSaved(savedIds);
        const first = existing[0] ?? newConversation();
        setConversations(existing.length ? existing : [first]); setActiveId(first.id);
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu."); }
    }
    void load();
    return () => { cancelled = true; };
  }, [router]);

  const active = conversations.find((item) => item.id === activeId);
  const lastIntent = [...(active?.turns ?? [])].reverse().find((turn) => turn.role === "assistant" && turn.intent)?.intent ?? null;
  function persist(next: Conversation[]) { setConversations(next); saveConversations(next); }

  async function send(value = message) {
    if (!profile || !active || busy || !value.trim()) return;
    setBusy(true); setError(""); setMessage(""); setSelected([]);
    const userTurn: ChatTurn = { id: crypto.randomUUID(), role: "user", text: value.trim(), createdAt: new Date().toISOString() };
    const next = conversations.map((item) => item.id === activeId ? { ...item, title: item.turns.length === 0 ? value.trim().slice(0, 45) : item.title, turns: [...item.turns, userTurn], updatedAt: new Date().toISOString() } : item);
    persist(next); trackEvent("ai_message_sent", { conversationId: activeId });
    try {
      if (cloudEnabled) await saveCloudConversation(next.find((item) => item.id === activeId)!);
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: value.trim(), profile, previousIntent: lastIntent, conversationId: activeId }) });
      if (!response.ok) { const failure = await response.json().catch(() => ({})) as { error?: string }; throw new Error(failure.error || "Chưa thể xử lý yêu cầu. Vui lòng thử lại."); }
      const result = await response.json() as ChatResponse;
      setAgentMode(result.mode);
      const agentTurn: ChatTurn = { id: crypto.randomUUID(), role: "assistant", text: result.text, createdAt: new Date().toISOString(), intent: result.intent, recommendations: result.recommendations, candidateCount: result.candidateCount, candidateProductIds: result.candidateProductIds, rankingVersion: result.rankingVersion };
      const completed = next.map((item) => item.id === activeId ? { ...item, turns: [...item.turns, agentTurn], updatedAt: new Date().toISOString() } : item);
      if (cloudEnabled) await saveCloudConversation(completed.find((item) => item.id === activeId)!);
      persist(completed); trackEvent("intent_created", { category: result.intent.category ?? "none" });
      if (result.recommendations.length) { trackEvent("recommendation_generated", { count: result.recommendations.length }); trackEvent("recommendation_viewed", { count: result.recommendations.length }); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Có lỗi xảy ra."); }
    finally { setBusy(false); }
  }

  function startNew() { const conversation = newConversation(); persist([conversation, ...conversations]); if (cloudEnabled) void saveCloudConversation(conversation).catch(() => setError("Chưa lưu được cuộc trò chuyện mới.")); setActiveId(conversation.id); setSelected([]); }
  function toggleCompare(id: string) { setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : items.length < 3 ? [...items, id] : items); }
  function toggleSaved(id: string) { const isSaved = !saved.includes(id); const next = isSaved ? [...saved, id] : saved.filter((item) => item !== id); setSaved(next); saveSavedProducts(next); if (cloudEnabled) void setCloudSaved(id, isSaved).catch(() => setError("Chưa lưu được sản phẩm. Vui lòng thử lại.")); trackEvent("product_clicked", { productId: id }); }
  const child = profile?.children[0];
  return <div className="shop-layout">
    <aside className="shop-sidebar">
      <div className="sidebar-heading"><span className="agent-mark">✳</span><div><strong>Family AI</strong><small>Trợ lý mua sắm</small></div></div>
      <button className="new-chat" onClick={startNew}>＋ Cuộc trò chuyện mới</button>
      <p className="sidebar-label">GẦN ĐÂY</p><div className="history-list">{conversations.map((item) => <button className={item.id === activeId ? "active" : ""} key={item.id} onClick={() => { setActiveId(item.id); setSelected([]); }}>{item.title}</button>)}</div>
      <div className="sidebar-bottom"><Link href="/family">Hồ sơ gia đình</Link><Link href="/saved">Sản phẩm đã lưu</Link><Link href="/products">Khám phá catalog</Link></div>
    </aside>
    <section className="shop-main">
      <div className="shop-topbar"><div><p className="eyebrow accent">AI SHOPPING AGENT</p><h1>Hôm nay gia đình mình cần gì?</h1></div><span className="mode-badge">{agentMode === "ai" ? "AI đang hỗ trợ" : "Chế độ quy tắc"}</span></div>
      <div className="shop-content">{!active?.turns.length ? <div className="empty-chat"><div className="large-agent-mark">✳</div><h2>Chào {child?.name ? `gia đình bé ${child.name}` : "bạn"}!</h2><p>Tôi đã nhớ {child?.weightKg ? `bé nặng ${child.weightKg} kg` : "những gì bạn chia sẻ"}. Hãy nói sản phẩm bạn cần và điều quan trọng nhất khi chọn mua.</p><div className="starter-grid">{starters.map((item) => <button key={item} onClick={() => send(item)}>{item}<span>↗</span></button>)}</div></div> : <div className="chat-stream" aria-live="polite">{active.turns.map((turn) => <div className={`chat-turn ${turn.role}`} key={turn.id}>{turn.role === "assistant" && <span className="agent-avatar">✳</span>}<div className="chat-turn-body"><p>{turn.text}</p>{turn.recommendations?.length ? <div className="recommendation-grid">{turn.recommendations.map((item, index) => <RecommendationCard key={item.product.id} recommendation={item} rank={index + 1} selected={selected.includes(item.product.id)} saved={saved.includes(item.product.id)} onCompare={() => toggleCompare(item.product.id)} onSave={() => toggleSaved(item.product.id)} conversationId={active.id} />)}</div> : null}</div></div>)}{busy && <div className="chat-turn assistant"><span className="agent-avatar">✳</span><div className="typing-indicator">Đang đối chiếu nhu cầu với catalog...</div></div>}</div>}</div>
      <div className="shop-compose-wrap">{selected.length >= 2 && <Link className="compare-tray" href={`/compare?products=${selected.join(",")}`} onClick={() => trackEvent("compare_started", { count: selected.length })}>So sánh {selected.length} sản phẩm <span>→</span></Link>}<form className="shop-compose" onSubmit={(event) => { event.preventDefault(); void send(); }}><input aria-label="Nhập nhu cầu mua sắm" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ví dụ: Tìm bỉm ban đêm cho bé 10kg dưới 400k..." disabled={busy} /><button disabled={busy || !message.trim()} aria-label="Gửi yêu cầu">→</button></form>{error && <p className="form-error">{error}</p>}<p className="compose-note">Family AI có thể nhận hoa hồng khi bạn mua qua một số liên kết. Hoa hồng không ảnh hưởng thứ tự gợi ý. Dữ liệu mẫu không phải báo giá thật.</p></div>
    </section>
    <aside className="context-sidebar"><div className="context-card"><p className="eyebrow accent">GIA ĐÌNH CỦA BẠN</p><h2>{child?.name ? `Bé ${child.name}` : "Gia đình bạn"}</h2><div><span>Cân nặng</span><strong>{child?.weightKg ? `${child.weightKg} kg` : "Chưa có"}</strong></div><div><span>Size bỉm</span><strong>{child?.diaperSize || "Chưa có"}</strong></div><div><span>Ưu tiên</span><strong>{profile?.pricePreference === "budget" ? "Giá tốt" : profile?.pricePreference === "premium" ? "Cao cấp" : "Cân bằng"}</strong></div><div><span>Ngân sách</span><strong>{profile?.maxBudget ? vnd(profile.maxBudget) : "Linh hoạt"}</strong></div><Link href="/family">Chỉnh sửa hồ sơ ↗</Link></div><div className="tip-card"><span>✦</span><strong>Cách hỏi hiệu quả</strong><p>Nói rõ cân nặng, mục đích dùng và ngân sách. Tôi sẽ chỉ giữ sản phẩm đáp ứng điều kiện bắt buộc.</p></div></aside>
  </div>;
}

function RecommendationCard({ recommendation: item, rank, selected, saved, onCompare, onSave, conversationId }: { recommendation: Recommendation; rank: number; selected: boolean; saved: boolean; onCompare: () => void; onSave: () => void; conversationId: string }) {
  const variant = item.product.variants.find((entry) => entry.id === item.variantId)!;
  const offer = variant.offers.find((entry) => entry.id === item.offerId)!;
  return <article className="recommendation-card"><div className="recommendation-top"><span>{rank === 1 ? "Phù hợp nhất" : `Lựa chọn ${rank}`}</span><button aria-label={saved ? "Bỏ lưu sản phẩm" : "Lưu sản phẩm"} onClick={onSave}>{saved ? "♥" : "♡"}</button></div><div className="rec-visual"><span>✳</span></div><div className="rec-body"><p className="eyebrow">{item.product.brand}</p><h3>{item.product.canonicalName}</h3><div className="match-line"><strong>{item.score}%</strong><span>Family Match</span></div><ul>{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><p className="rec-price">{vnd(offer.price)} <span>· {variant.quantity} miếng</span></p>{item.tradeoff && <p className="tradeoff">{item.tradeoff}</p>}<div className="rec-actions"><button className={selected ? "selected" : ""} onClick={onCompare}>{selected ? "✓ Đã chọn" : "So sánh"}</button><Link href={`/products/${item.product.slug}`} onClick={() => trackEvent("product_clicked", { productId: item.product.id })}>Chi tiết</Link></div><Link className="merchant-link" href={`/go/${offer.id}?session=${encodeURIComponent(conversationId)}`} onClick={() => trackEvent("offer_clicked", { offerId: offer.id })}>{item.product.isDemo ? "Xem bước mua thử" : `Xem tại ${offer.merchantName}`} ↗</Link></div></article>;
}
