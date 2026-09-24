"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AFFILIATE_DISCLOSURE, vnd } from "@/lib/catalog/format";
import { lowestOffer, pricePerPiece } from "@/lib/catalog/filter";
import type { Product } from "@/lib/catalog/types";
import { type AgentView, type ChatResponse, type ChatTurn, type Conversation, type FamilyProfile, type Recommendation } from "@/lib/experience/types";
import { getConversations, getProfile, getSavedProducts, saveConversations, saveProfile, saveSavedProducts, trackEvent } from "@/lib/experience/storage";
import Link from "next/link";
import { FamilyContextPanel } from "@/components/onboarding/family-context-panel";
import { RecommendationCard } from "@/components/recommendation-card";
import { compareToken, MAX_COMPARE } from "@/lib/catalog/compare";
import { formatWeight } from "@/lib/onboarding/questions";
import { cloudEnabled, loadCloudConversations, loadCloudProfile, loadCloudSaved, saveCloudConversation, saveCloudProfile, setCloudSaved } from "@/lib/experience/cloud";
import { answerMoney, detectMoneyQuestion } from "@/lib/money/answer";
import { loadMoney } from "@/lib/money/client";
import { monthKey, summarizeMonth } from "@/lib/money/summary";
import { emptyIntent, type StockLine } from "@/lib/ai/shopping/pipeline";
import type { MonthSummary } from "@/lib/money/summary";
import { loadPurchases } from "@/lib/shopping/purchase-client";
import { budgetHint, estimateStock } from "@/lib/shopping/purchases";
import { rateResolver } from "@/components/shopping/tracking-list";

/** First-screen prompts built from the profile, so a new user sees what to ask and that the agent already knows the child. */
function suggestionsFor(profile: FamilyProfile | null): string[] {
  const child = profile?.children[0];
  const who = child?.name ? `bé ${child.name}` : "bé";
  const budget = profile?.maxBudget ? ` dưới ${Math.round(profile.maxBudget / 1000)}k` : "";
  return [`Tìm bỉm ban đêm cho ${who}${budget}`, "Tháng này nhà mình tiêu thế nào?", "Khoản nào sắp đến hạn?"];
}
function newConversation(): Conversation { return { id: crypto.randomUUID(), title: "Cuộc trò chuyện mới", turns: [], updatedAt: new Date().toISOString() }; }

export function AgentShopping() {
  const router = useRouter();
  const threadRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"ai" | "rules">("rules");
  // Compare selection: exact recommended variant + offer per product (plan P7).
  const [compare, setCompare] = useState<string[]>([]);
  // Phone: the conversation list slides over the thread.
  const [convsOpen, setConvsOpen] = useState(false);
  // Cross-module context (spec v2 §14, §38): month money summary for budget hints, stock for reorder answers.
  const [money, setMoney] = useState<MonthSummary | null>(null);
  const [stock, setStock] = useState<StockLine[]>([]);
  const pendingPrefill = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let family = getProfile();
        let existing = getConversations();
        let savedIds = getSavedProducts();
        if (cloudEnabled) {
          const remote = await loadCloudProfile();
          family = remote;
          existing = await loadCloudConversations(); savedIds = await loadCloudSaved();
        }
        if (!family?.onboardedAt) { router.replace("/onboarding"); return; }
        const catalogResponse = await fetch("/api/products");
        if (!catalogResponse.ok) throw new Error("Chưa tải được danh sách sản phẩm.");
        const catalog = await catalogResponse.json() as { products: Product[] };
        if (cancelled) return;
        saveProfile(family); setProfile(family); setProducts(catalog.products); setSaved(savedIds);
        // Deep links: ?c= opens a conversation (Home "đang chờ bạn trả lời"); ?q= starts a new one with that message ("Mua lại …").
        const params = new URLSearchParams(window.location.search);
        const wanted = params.get("c"); const prefill = params.get("q")?.trim().slice(0, 300);
        const first = prefill ? newConversation() : existing.find((item) => item.id === wanted) ?? existing[0] ?? newConversation();
        setConversations(prefill || !existing.length ? [first, ...existing] : existing); setActiveId(first.id);
        if (prefill) { pendingPrefill.current = prefill; window.history.replaceState(null, "", "/agent"); }
        loadMoney(monthKey(new Date())).then((bundle) => { if (!cancelled) setMoney(summarizeMonth(bundle)); }).catch(() => {});
        loadPurchases().then((purchases) => { if (!cancelled) setStock(estimateStock(purchases, rateResolver(family)).map((item) => ({ productName: item.productName, brand: item.brand, daysLeft: item.daysLeft, remaining: item.remaining, lastPurchasedOn: item.lastPurchase.purchasedOn }))); }).catch(() => {});
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu."); }
    }
    void load();
    return () => { cancelled = true; };
  }, [router]);

  const active = conversations.find((item) => item.id === activeId);
  const liveOffers = new Map(products.flatMap((product) => product.variants.flatMap((variant) => variant.offers.filter((offer) => offer.availability === "in_stock").map((offer) => [offer.id, offer] as const))));
  const lastIntent = [...(active?.turns ?? [])].reverse().find((turn) => turn.role === "assistant" && turn.intent)?.intent ?? null;
  const recentRecommendations = [...(active?.turns ?? [])].reverse().find((turn) => turn.recommendations?.length)?.recommendations ?? [];
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" }); }, [active?.turns.length, busy]);
  // Send the ?q= message once the profile, catalog and conversation are in place.
  useEffect(() => { if (pendingPrefill.current && profile && active && products.length && !busy) { const text = pendingPrefill.current; pendingPrefill.current = null; void send(text); } }, [profile, active, products.length, busy]); // eslint-disable-line react-hooks/exhaustive-deps -- send is recreated each render; guard runs once via the ref


  /** Inline edit from the family panel (already stamped + validated there). */
  function updateProfile(next: FamilyProfile) {
    setProfile(next); saveProfile(next); trackEvent("family_profile_updated", { source: "panel" });
    if (cloudEnabled) void saveCloudProfile(next).catch(() => setError("Chưa lưu được hồ sơ lên máy chủ."));
  }

  function persist(next: Conversation[]) { setConversations(next); saveConversations(next); }
  async function saveItem(id: string) {
    const isSaved = !saved.includes(id);
    const next = isSaved ? [...saved, id] : saved.filter((item) => item !== id);
    setSaved(next); saveSavedProducts(next);
    if (cloudEnabled) try { await setCloudSaved(id, isSaved); } catch { setError("Chưa lưu được sản phẩm. Vui lòng thử lại."); }
    trackEvent("product_saved", { productId: id, saved: isSaved });
  }
  function toggleCompare(item: Recommendation) {
    const token = compareToken(item.product.id, item.variantId, item.offerId);
    setCompare((current) => current.some((entry) => entry.startsWith(`${item.product.id}:`)) ? current.filter((entry) => !entry.startsWith(`${item.product.id}:`)) : current.length >= MAX_COMPARE ? current : [...current, token]);
  }
  function openDetails(item: Recommendation) {
    trackEvent("product_clicked", { productId: item.product.id, rank: item.rank });
    void send(`Xem chi tiết ${item.product.canonicalName}`);
  }

  async function send(value = message) {
    const input = value.trim();
    if (!profile || !active || busy || !input) return;
    setBusy(true); setError(""); setMessage("");
    const userTurn: ChatTurn = { id: crypto.randomUUID(), role: "user", text: input, createdAt: new Date().toISOString() };
    const next = conversations.map((item) => item.id === activeId ? { ...item, title: item.turns.length ? item.title : input.slice(0, 48), turns: [...item.turns, userTurn], updatedAt: new Date().toISOString() } : item);
    persist(next); trackEvent("ai_message_sent", { conversationId: activeId });
    try {
      if (cloudEnabled) await saveCloudConversation(next.find((item) => item.id === activeId)!);
      // Coordinator, money side: in demo mode the ledger lives in this browser, so the answer is built here
      // with the same templates the server uses for signed-in users (/api/chat).
      const moneyQuestion = !cloudEnabled ? detectMoneyQuestion(input) : null;
      const result: ChatResponse = moneyQuestion
        ? await loadMoney(monthKey(new Date())).then((bundle): ChatResponse => ({ ...answerMoney(moneyQuestion, summarizeMonth(bundle), input), intent: lastIntent ?? emptyIntent(), recommendations: [], candidateCount: 0, candidateProductIds: [], rankingVersion: "money-rules-v1", mode: "rules" }))
        : await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: input, profile, previousIntent: lastIntent, conversationId: activeId, stock: cloudEnabled ? undefined : stock }) }).then(async (response) => {
          if (!response.ok) { const failure = await response.json().catch(() => ({})) as { error?: string }; throw new Error(failure.error || "Chưa thể xử lý yêu cầu."); }
          return response.json() as Promise<ChatResponse>;
        });
      setMode(result.mode);
      if (result.profile) { setProfile(result.profile); saveProfile(result.profile); trackEvent("family_profile_updated"); }
      const agentTurn: ChatTurn = { id: crypto.randomUUID(), role: "assistant", text: result.text, createdAt: new Date().toISOString(), intent: result.intent, recommendations: result.recommendations, candidateCount: result.candidateCount, candidateProductIds: result.candidateProductIds, rankingVersion: result.rankingVersion, view: result.view, choices: result.choices };
      const completed = next.map((item) => item.id === activeId ? { ...item, turns: [...item.turns, agentTurn], updatedAt: new Date().toISOString() } : item);
      if (cloudEnabled) await saveCloudConversation(completed.find((item) => item.id === activeId)!);
      persist(completed);
      if (result.recommendations.length) { trackEvent("recommendation_generated", { count: result.recommendations.length }); trackEvent("recommendation_viewed", { count: result.recommendations.length }); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Có lỗi xảy ra."); }
    finally { setBusy(false); }
  }

  function startNew() {
    const conversation = newConversation();
    persist([conversation, ...conversations]); setActiveId(conversation.id); setMessage("");
    if (cloudEnabled) void saveCloudConversation(conversation).catch(() => setError("Chưa lưu được cuộc trò chuyện mới."));
  }
  const child = profile?.children[0];
  /** Child a turn was for (by the intent's member ref) so "Đã mua" books the expense under them. */
  const childFor = (turn: ChatTurn) => (profile?.children.find((item) => item.name && item.name === turn.intent?.householdMemberRef) ?? child)?.id;
  /** Budget line under the results (spec v2 §14): the top pick's price against the "Con" budget / month plan. */
  const hintFor = (turn: ChatTurn) => {
    const top = turn.recommendations?.[0]; const price = top && liveOffers.get(top.offerId)?.price;
    if (!money || !top || !price || money.transactionCount === 0) return null;
    const text = budgetHint(price, money.byCategory.find((line) => line.category === "Con"), money.remainingOfPlan);
    return text ? <p className={`agent-budget-hint${text.startsWith("Trong ngân sách") || text.startsWith("Sau khoản") ? " ok" : ""}`}><span aria-hidden="true">₫</span><span>{text} <Link href="/money">Xem Tiền</Link></span></p> : null;
  };
  // What the agent is using right now (spec v1: show the context it acts on; edit via "Cập nhật hồ sơ").
  const contextChips = [
    child ? [`Bé ${child.name ?? ""}`.trim(), child.weightKg ? formatWeight(child.weightKg) : null, child.diaperSize ? `size ${child.diaperSize}` : null].filter(Boolean).join(" · ") : null,
    profile?.maxBudget ? `Ngân sách ≤ ${vnd(profile.maxBudget)}` : null,
    (profile?.children.length ?? 0) > 1 ? `${profile!.children.length} bé` : null,
  ].filter((chip): chip is string => Boolean(chip));
  const withTurns = conversations.filter((item) => item.turns.length);
  const dayLabel = (iso: string) => { const date = new Date(iso); const diff = Math.floor((Date.now() - date.getTime()) / 86_400_000); return diff <= 0 ? "Hôm nay" : diff === 1 ? "Hôm qua" : date.toLocaleDateString("vi-VN"); };
  return <div className={`agent-app shopping-app${convsOpen ? " convs-open" : ""}`}><div className="agent-decoration one" aria-hidden="true"/><div className="agent-decoration two" aria-hidden="true"/>
    <aside className="agent-convs" aria-label="Lịch sử hội thoại"><button type="button" className="app-btn" onClick={() => { startNew(); setConvsOpen(false); }}>＋ Hội thoại mới</button>
      {withTurns.length ? <><h4>Gần đây</h4>{withTurns.map((item) => <button type="button" key={item.id} className={`agent-conv${item.id === activeId ? " on" : ""}`} onClick={() => { setActiveId(item.id); setConvsOpen(false); }} aria-current={item.id === activeId ? "true" : undefined}><b>{item.title}</b><small>{dayLabel(item.updatedAt)} · {item.turns.length} tin</small></button>)}</> : <p className="agent-convs-empty">Chưa có hội thoại nào. Hỏi FamAgent về đồ cho bé, ngân sách hay so sánh sản phẩm.</p>}
    </aside>
    <main className="agent-center shopping-center"><div className="agent-header"><span className="agent-status"><button type="button" className="agent-history-trigger agent-convs-toggle" onClick={() => setConvsOpen((open) => !open)} aria-expanded={convsOpen} aria-controls="agent-convs">Hội thoại</button><span className="status-dot"/> {mode === "ai" ? "AI đang hỗ trợ" : profile && !profile.aiConsent ? <>Đang dùng quy tắc · <button type="button" className="agent-inline-toggle" onClick={() => updateProfile({ ...profile, aiConsent: true, updatedAt: new Date().toISOString() })}>Bật AI</button></> : "FamAgent đang sẵn sàng"}</span><span className="agent-header-actions"><Link className="agent-history-trigger" href="/family">Hồ sơ gia đình</Link></span></div>{contextChips.length > 0 && <div className="agent-context" aria-label="Thông tin agent đang dùng">{contextChips.map((chip) => <span key={chip}>{chip}</span>)}</div>}
      
      {!active?.turns.length ? <div className="agent-core shopping-core"><div className="agent-orbit" aria-hidden="true"><span>✳</span></div><p className="agent-overline">HỎI FAMAGENT</p><h1>Hôm nay gia đình mình cần gì?</h1><p className="agent-subtitle">{child ? `Mình đã nhớ ${child.name ? `bé ${child.name}` : "bé"}${child.weightKg ? ` · ${formatWeight(child.weightKg)}` : ""}${profile?.maxBudget ? ` · ngân sách ≤ ${vnd(profile.maxBudget)}` : ""}. ` : ""}Hỏi mình như đang nhắn tin — mình sẽ lọc theo hồ sơ, giải thích vì sao và chỉ nơi bán. Bạn có thể bấm một gợi ý bên dưới để bắt đầu.</p><AgentPrompt value={message} onChange={setMessage} onSend={() => void send()} busy={busy}/><div className="agent-suggestions"><span>HOẶC THỬ NÓI</span>{suggestionsFor(profile).map((item) => <button key={item} onClick={() => void send(item)}>{item}<b>↗</b></button>)}</div></div> : <><div className="agent-thread" ref={threadRef} aria-live="polite"><div className="agent-thread-heading"><p className="agent-overline">CUỘC TRÒ CHUYỆN VỚI FAMAGENT</p><h1>{active.title}</h1></div>{active.turns.map((turn) => <div className={`agent-line ${turn.role}`} key={turn.id}>{turn.role === "assistant" && <span className="agent-line-icon">✳</span>}<div className="agent-line-content"><p>{turn.text}</p>{turn.role === "assistant" && turn.choices?.length && turn.id === active.turns.at(-1)?.id ? <div className="agent-choices" role="group" aria-label="Trả lời nhanh">{turn.choices.map((choice) => <button type="button" key={choice} disabled={busy} onClick={() => void send(choice)}>{choice}</button>)}</div> : null}{turn.recommendations?.length ? <><div className="agent-results">{turn.recommendations.map((item, index) => <RecommendationCard key={item.product.id} item={item} liveOffer={products.length ? liveOffers.get(item.offerId) ?? null : undefined} rank={index + 1} saved={saved.includes(item.product.id)} comparing={compare.some((entry) => entry.startsWith(`${item.product.id}:`))} compareFull={compare.length >= MAX_COMPARE} onSave={() => void saveItem(item.product.id)} onDetails={() => openDetails(item)} onCompare={() => toggleCompare(item)} conversationId={active.id} childId={childFor(turn)}/>)}</div>{hintFor(turn)}<p className="agent-disclosure">{AFFILIATE_DISCLOSURE}</p></> : null}{turn.view && <AgentViewPanel view={turn.view} profile={profile} products={products} saved={saved} conversations={conversations} recent={recentRecommendations} onAsk={(value) => void send(value)} onConversation={setActiveId} onSave={(id) => void saveItem(id)} onProfileEdit={updateProfile}/>}</div></div>)}{busy && <div className="agent-line agent"><span className="agent-line-icon">✳</span><div className="agent-line-content"><p>Đang đối chiếu nhu cầu của gia đình...</p></div></div>}</div>{compare.length > 0 && <div className="agent-compare-bar" role="region" aria-label="So sánh"><span>{compare.length < 2 ? "Chọn thêm 1–2 sản phẩm để so sánh" : `Đã chọn ${compare.length} sản phẩm`}</span><span><button onClick={() => setCompare([])}>Bỏ chọn</button>{compare.length >= 2 && <Link href={`/compare?items=${encodeURIComponent(compare.join(","))}`} onClick={() => trackEvent("compare_started", { count: compare.length })}>So sánh ↗</Link>}</span></div>}<div className="agent-fixed-prompt"><AgentPrompt value={message} onChange={setMessage} onSend={() => void send()} busy={busy}/></div></>}
      {error && <p className="agent-error agent-stage-error">{error}</p>}
      <div className="agent-bottom-note">Gợi ý dựa trên mức phù hợp, không dùng hoa hồng để xếp hạng. {products.some((item) => item.isDemo) ? "Đang dùng dữ liệu minh họa." : "Giá có thể thay đổi tại nơi bán."}</div>
    </main>
  </div>;
}

function AgentPrompt({ value, onChange, onSend, busy }: { value: string; onChange: (value: string) => void; onSend: () => void; busy: boolean }) {
  return <form className="agent-prompt" onSubmit={(event) => { event.preventDefault(); onSend(); }}><label htmlFor="shop-message">Trò chuyện với FamAgent</label><textarea id="shop-message" rows={2} placeholder="Ví dụ: Tìm bỉm ban đêm cho bé 10kg dưới 400k..." value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSend(); } }} disabled={busy}/><div className="agent-prompt-bottom"><span>Hỏi, so sánh hoặc yêu cầu tôi mở nội dung bạn cần.</span><button disabled={busy || !value.trim()} aria-label="Gửi cho agent">Gửi <span>↗</span></button></div></form>;
}

function AgentViewPanel({ view, profile, products, saved, conversations, recent, onAsk, onConversation, onSave, onProfileEdit }: { view: AgentView; profile: FamilyProfile | null; products: Product[]; saved: string[]; conversations: Conversation[]; recent: Recommendation[]; onAsk: (value: string) => void; onConversation: (id: string) => void; onSave: (id: string) => void; onProfileEdit: (next: FamilyProfile) => void }) {
  if (view.kind === "family") return <div className="agent-data-panel">{profile ? <FamilyContextPanel profile={profile} title="Hồ sơ gia đình" onEdit={onProfileEdit}/> : <p>Chưa có thông tin gia đình.</p>}<p className="agent-panel-foot">Bạn cũng có thể nói “đổi ngân sách thành 350k” hoặc “bé Gold hiện nặng 11kg”.</p></div>;
  if (view.kind === "history") return <div className="agent-data-panel"><h3>Cuộc trò chuyện gần đây</h3><div className="agent-list">{conversations.map((item) => <button key={item.id} onClick={() => onConversation(item.id)}><strong>{item.title}</strong><span>{new Date(item.updatedAt).toLocaleDateString("vi-VN")}</span></button>)}</div></div>;
  if (view.kind === "help") return <div className="agent-data-panel"><h3>Bạn có thể hỏi tôi</h3><div className="agent-list">{["Tìm bỉm cho bé 10kg dưới 400k", "So sánh các lựa chọn vừa gợi ý", "Cho tôi xem sản phẩm đã lưu", "Cho tôi xem hồ sơ gia đình"].map((item) => <button key={item} onClick={() => onAsk(item)}>{item}<span>↗</span></button>)}</div></div>;
  const items = view.kind === "saved" ? products.filter((item) => saved.includes(item.id)) : view.kind === "product" ? products.filter((item) => item.id === view.productId) : view.kind === "compare" ? recent.map((item) => item.product).slice(0, 3) : products.slice(0, 8);
  if (!items.length) return <div className="agent-data-panel"><h3>{view.kind === "saved" ? "Sản phẩm đã lưu" : view.kind === "compare" ? "So sánh" : "Sản phẩm"}</h3><p>{view.kind === "saved" ? "Bạn chưa lưu sản phẩm nào. Tôi sẽ ghi nhớ khi bạn chọn biểu tượng trái tim." : "Hãy mô tả nhu cầu trước để tôi có lựa chọn phù hợp cho bạn."}</p></div>;
  return <div className="agent-data-panel"><h3>{view.kind === "saved" ? "Sản phẩm đã lưu" : view.kind === "compare" ? "So sánh lựa chọn" : view.kind === "product" ? "Chi tiết sản phẩm" : "Bỉm đang có"}</h3><div className={view.kind === "compare" ? "agent-compare-grid" : "agent-catalog-list"}>{items.map((item) => { const match = lowestOffer(item); const unit = match ? pricePerPiece(match.offer, match.variant) : null; return <div className="agent-catalog-item" key={item.id}><span className="catalog-symbol">✳</span><div><small>{item.brand}</small><strong>{item.canonicalName}</strong><span>{item.diaper.minWeightKg}–{item.diaper.maxWeightKg} kg · {match?.variant.size || "Chưa rõ size"}</span><span>{match ? vnd(match.offer.price) : "Chưa có giá"}{unit ? ` · ${vnd(unit)}/miếng` : ""}</span>{view.kind === "compare" && <span>Điểm dùng đêm: {item.diaper.nightUseScore ? `${item.diaper.nightUseScore}/5` : "chưa có"}</span>}</div><div className="catalog-actions"><button onClick={() => onAsk(`Xem chi tiết ${item.canonicalName}`)}>Xem</button><button onClick={() => onSave(item.id)} aria-label={saved.includes(item.id) ? "Bỏ lưu" : "Lưu"}>{saved.includes(item.id) ? "♥" : "♡"}</button></div></div>; })}</div>{view.kind === "compare" && <p className="agent-panel-foot">Giá và điểm chất lượng chỉ phản ánh dữ liệu đang có trong catalog.</p>}</div>;
}
