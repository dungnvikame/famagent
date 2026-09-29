import { NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/ai/llm";
import { upgradeIntent } from "@/lib/ai/shopping/context-merger";
import { runShoppingTurn, type StockLine } from "@/lib/ai/shopping/pipeline";
import { brandsToAvoid, extractNotes } from "@/lib/ai/notes";
import { applyNoteSignals } from "@/lib/ai/chat-notes";
import { answerMoneyTurn } from "@/lib/ai/chat-money";
import { CHAT_AI_PER_HOUR, resolveAiUse, routeChat, rulesReply, type QuotaResult } from "@/lib/ai/chat-routing";
import { loadNotes, recordNotes } from "@/lib/notes/store-server";
import { loadShoppingState } from "@/lib/shopping/item-store-server";
import { estimateItems, itemRateResolver, stockLines, type ShoppingItem } from "@/lib/shopping/items";
import { parsePurchase } from "@/lib/shopping/capture";
import { validItem } from "@/lib/shopping/item-validate";
import { MONEY_PLAN_EDIT_REPLY } from "@/lib/money/answer";
import { loadBundle } from "@/lib/money/store-server";
import { getProducts } from "@/lib/catalog/repository";
import type { Product } from "@/lib/catalog/types";
import { persistShoppingTurn, type PersistError } from "@/lib/experience/chat-persistence";
import { profileFromRow } from "@/lib/experience/profile-mapper";
import { allowInMemory } from "@/lib/ai/onboarding/rate-limit";
import { validProfile } from "@/lib/experience/validate";
import type { ChatResponse, FamilyProfile, ShoppingIntent } from "@/lib/experience/types";
import { authenticated, authConfigured } from "@/lib/supabase/server";
import { nowVn, todayVn } from "@/lib/time/vn-date";

const persistErrors: Record<PersistError, string> = { profile: "Không thể cập nhật hồ sơ", children: "Không thể cập nhật thông tin bé", intent: "Không thể lưu yêu cầu", session: "Không thể lưu phiên gợi ý", items: "Không thể lưu kết quả gợi ý", trace: "Không thể lưu nhật ký" };

// Thin route: auth → routing (lib/ai/chat-routing) → rules-only answers or the shopping pipeline (lib/ai/shopping) → persistence.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { message?: unknown; profile?: unknown; previousIntent?: unknown; conversationId?: unknown; stock?: unknown; avoidBrands?: unknown; items?: unknown } | null;
  if (!body || typeof body.message !== "string" || !body.message.trim() || body.message.length > 1000) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const message = body.message.trim();
  // Local mode: profile and previous intent come from the browser; anything invalid is ignored, not fatal.
  let profile = validProfile(body.profile) ? body.profile as FamilyProfile : null;
  let previousIntent: ShoppingIntent | null = upgradeIntent(body.previousIntent);
  let account: Awaited<ReturnType<typeof authenticated>> = null;
  let conversationId: string | null = null;
  if (authConfigured()) {
    account = await authenticated();
    if (!account) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
    const { data, error } = await account.client.from("family_profiles").select("*,children(*)").eq("user_id", account.user.id).maybeSingle();
    if (error) return NextResponse.json({ error: "Không thể tải hồ sơ" }, { status: 500 });
    profile = data ? profileFromRow(data) : null;
    previousIntent = null;
    if (typeof body.conversationId === "string" && /^[a-f0-9-]{36}$/i.test(body.conversationId)) {
      const { data: conversation } = await account.client.from("conversations").select("id").eq("id", body.conversationId).eq("user_id", account.user.id).maybeSingle();
      if (conversation) {
        conversationId = conversation.id;
        const { data: history } = await account.client.from("messages").select("metadata").eq("conversation_id", conversation.id).eq("role", "assistant").order("created_at", { ascending: false }).limit(1);
        previousIntent = upgradeIntent(history?.[0]?.metadata?.intent);
      }
    }
    if (!conversationId) return NextResponse.json({ error: "Cần tạo hội thoại trước khi tư vấn" }, { status: 400 });
  }

  // Vietnam calendar for everything date-shaped: a UTC server is a day behind between 00:00 and 07:00 local.
  const instant = new Date();
  // The catalog only matters to shopping-shaped turns (and brand names in notes); a failure surfaces there, as before.
  let products: Product[] = [];
  let catalogError: unknown = null;
  try { products = await getProducts(); } catch (error) { catalogError = error; }
  const route = routeChat(message, { profile, products, moneyAvailable: Boolean(account) });

  // Family memory: existing notes steer the turn (confirmed health → avoid brand); new notes are recorded from every turn's message.
  const notes = account ? await loadNotes(account.client, account.user.id) : null;
  const notesUnavailable = Boolean(account) && notes === null;
  const brandNames = [...new Set(products.map((product) => product.brand))];
  const settle = async (response: ChatResponse) => {
    const saved = account && conversationId ? await recordNotes(account.client, account.user.id, extractNotes(message, profile, brandNames), conversationId, notes ?? []) : { recorded: [], failed: false };
    return NextResponse.json(applyNoteSignals(response, { recorded: saved.recorded, existing: notes, unavailable: notesUnavailable }));
  };

  // Rules-only turns: no LLM, no quota, and they never leave a shopping question pending ("ok" later must not answer it).
  // “Vừa mua 2 bịch Merries 690k ở Shopee” → a purchase draft; nothing is saved until the card is confirmed.
  if (route.kind === "purchase-log") {
    const items: ShoppingItem[] = account ? (await loadShoppingState(account.client, account.user.id))?.items ?? []
      : Array.isArray(body.items) ? body.items.map(validItem).filter((item): item is ShoppingItem => Boolean(item)).slice(0, 300) : [];
    const draft = parsePurchase(message, items, todayVn(instant));
    const missing = draft.missing.includes("amount") ? " Bạn nhập thêm số tiền nhé." : draft.missing.includes("packSize") ? " Mỗi gói bao nhiêu " + draft.unit + "?" : "";
    return settle(rulesReply({ text: `Mình ghi lại lần mua ${draft.name} thế này, bạn kiểm tra rồi bấm “Ghi lại”.${missing}` }, previousIntent, "purchase-capture-v1", { purchaseDraft: draft }));
  }
  // Family Coordinator (spec v2 §18): finance questions are answered from the ledger by rules.
  if (route.kind === "money-question" && account) {
    const answer = await answerMoneyTurn((month, now) => loadBundle(account.client, account.user.id, month, now), route.question, route.period, message, instant);
    if (!answer) return NextResponse.json({ error: "Không thể tải sổ thu chi" }, { status: 500 });
    return settle(rulesReply(answer, previousIntent, "money-rules-v1"));
  }
  if (route.kind === "money-plan-edit") return settle(rulesReply(MONEY_PLAN_EDIT_REPLY, previousIntent, "money-rules-v1"));
  if (catalogError) throw catalogError;

  // The hourly quota is spent only by a turn that can actually call the LLM; when it is used up the turn still gets
  // a normal reply from the rules (the client has already saved the user's message, so an error would strand it).
  const aiEnabled = Boolean(profile?.aiConsent) && isAiConfigured();
  const ai = await resolveAiUse(route, aiEnabled, async (): Promise<QuotaResult> => {
    if (!account) return allowInMemory(`chat:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim || "local"}`, instant.getTime(), CHAT_AI_PER_HOUR) ? "allowed" : "exceeded";
    // Atomic count-and-insert (migration 202609240002) so parallel requests cannot exceed the hourly limit.
    const { data: allowed, error } = await account.client.rpc("consume_request_quota", { p_endpoint: "chat", p_limit: CHAT_AI_PER_HOUR });
    if (error) { console.warn("[chat quota]", JSON.stringify({ code: error.code ?? "unknown" })); return "unavailable"; }
    return allowed === true ? "allowed" : "exceeded";
  });
  // Purchase history feeds reorder / "còn không?" answers; demo mode sends its browser-side estimate.
  let stock: StockLine[] = [];
  if (account) {
    const shopping = await loadShoppingState(account.client, account.user.id);
    if (shopping) stock = stockLines(estimateItems(shopping.items, shopping.purchases, itemRateResolver(profile, nowVn(instant)), nowVn(instant), shopping.checks));
  } else if (Array.isArray(body.stock)) {
    stock = body.stock.filter((item): item is StockLine => typeof item === "object" && item !== null && typeof (item as StockLine).productName === "string" && typeof (item as StockLine).daysLeft === "number").slice(0, 20);
  }
  // Demo mode keeps notes in the browser and sends the brands to avoid with the message.
  const localAvoid = !account && Array.isArray(body.avoidBrands) ? body.avoidBrands.filter((item): item is { brand: string; reason: string } => typeof item === "object" && item !== null && typeof (item as { brand?: unknown }).brand === "string" && (item as { brand: string }).brand.length <= 80 && typeof (item as { reason?: unknown }).reason === "string" && (item as { reason: string }).reason.length <= 200).slice(0, 20) : [];
  const result = await runShoppingTurn({ message, profile, previousIntent, products, allowAi: ai.allowAi, stock, avoidBrands: account ? brandsToAvoid(notes ?? []) : localAvoid });
  const response = ai.notice ? { ...result.response, text: `${ai.notice} ${result.response.text}` } : result.response;

  if (account && conversationId) {
    const failed = await persistShoppingTurn(account.client, account.user.id, conversationId, result);
    if (failed) return NextResponse.json({ error: persistErrors[failed] }, { status: 500 });
    return settle(response);
  }
  return NextResponse.json(response);
}
