// One shopping turn (spec v1 §9): INTENT_PARSED → CONTEXT_RESOLVED → [CLARIFICATION_REQUIRED]
// → CANDIDATES_RETRIEVED → HARD_FILTERED → OFFERS_RESOLVED → RANKED → RESPONSE_VALIDATED → RESPONDED.
// Pure orchestration: no DB access (persistence lives in the route) so every branch is testable.
import type { Product } from "../../catalog/types.ts";
import type { ChatResponse, FamilyProfile, ShoppingIntent } from "../../experience/types.ts";
import { hardFilter, rankCandidates, RANKING_VERSION, type Rejection } from "../../ranking/recommend.ts";
import { chatJson } from "../llm/index.ts";
import { parseProfileChange } from "../profile-change.ts";
import { routeWorkspace } from "../workspace.ts";
import { composeSummary, noResultAdvice } from "./composer.ts";
import { mergeIntent } from "./context-merger.ts";
import { brandMentions, extractShopping } from "./extract.ts";

export interface TraceStep { state: string; ms: number; detail?: Record<string, string | number | boolean> }
export interface ShoppingTurnResult {
  response: ChatResponse;
  /** Set when the turn changed the family profile (caller persists it). */
  profileChange?: FamilyProfile;
  /** Set only when ranking ran (caller persists a recommendation session). */
  rejected?: Rejection[];
  finalState: string;
  trace: TraceStep[];
}

const COMING_SOON: Partial<Record<ShoppingIntent["intentType"], string>> = {
  monthly_basket: "Giỏ hàng tháng đang được phát triển. Hiện mình giúp chọn bỉm cho bé theo cân nặng và ngân sách.",
  price_check: "Theo dõi giá đang được phát triển. Mình có thể tìm các lựa chọn đang có trong ngân sách của bạn.",
};

/** What the family has bought and how much is estimated left (from lib/shopping/purchases); drives reorder / replenishment answers. */
export interface StockLine { productName: string; brand?: string; daysLeft: number; remaining: number; lastPurchasedOn: string }

/** Reorder / "còn không?" answered from purchase history; without history, fall back to discovery with an honest note. */
function replenishmentReply(intentType: ShoppingIntent["intentType"], stock: StockLine[]): { text: string; choices: string[] } | null {
  if (intentType !== "reorder" && intentType !== "check_replenishment") return null;
  if (!stock.length) return { text: intentType === "reorder" ? "Mình chưa có lần mua nào được ghi để mua lại. Khi bạn bấm “Đã mua” trên một gợi ý, lần sau chỉ cần nói “mua lại” là đủ. Giờ mình tìm theo hồ sơ bé nhé?" : "Mình chưa theo dõi món nào — bấm “Đã mua” trên sản phẩm sau khi mua để mình ước tính ngày hết và nhắc bạn.", choices: ["Tìm bỉm cho bé"] };
  const low = stock.filter((item) => item.daysLeft <= 7);
  const lines = stock.slice(0, 3).map((item) => `${item.productName}: ${item.daysLeft === 0 ? "ước tính đã hết" : `còn khoảng ${item.daysLeft} ngày (~${item.remaining} miếng)`}`);
  if (intentType === "check_replenishment") return { text: `${lines.join(". ")}.${low.length ? ` Nên mua lại ${low.map((item) => item.productName).join(", ")} trong tuần này.` : " Chưa cần mua thêm."}`, choices: low.length ? low.slice(0, 2).map((item) => `Mua lại ${item.productName}`) : ["Tìm bỉm cho bé"] };
  const target = low[0] ?? stock[0];
  return { text: `Lần trước bạn mua ${target.productName} (${target.lastPurchasedOn.slice(8)}/${target.lastPurchasedOn.slice(5, 7)}), hiện ${target.daysLeft === 0 ? "ước tính đã hết" : `còn khoảng ${target.daysLeft} ngày`}. Mình tìm lại đúng loại này hay xem lựa chọn tương tự rẻ hơn?`, choices: [`Tìm ${target.brand ?? target.productName}`, "Xem lựa chọn tương tự", "Đổi size lớn hơn"] };
}

export function emptyIntent(previous: ShoppingIntent | null = null): ShoppingIntent {
  return previous ?? { schemaVersion: "1", intentType: "unknown", requiredAttributes: {}, constraints: {}, preferences: {}, fieldEvidence: {}, ambiguity: [] };
}

export async function runShoppingTurn(input: { message: string; profile: FamilyProfile | null; previousIntent: ShoppingIntent | null; products: Product[]; allowAi: boolean; now?: number; stock?: StockLine[] }, chat = chatJson): Promise<ShoppingTurnResult> {
  const trace: TraceStep[] = [];
  let clock = Date.now();
  const step = (state: string, detail?: TraceStep["detail"]) => { const now = Date.now(); trace.push({ state, ms: now - clock, ...(detail ? { detail } : {}) }); clock = now; };
  const base = (intent: ShoppingIntent, mode: "ai" | "rules"): ChatResponse => ({ text: "", intent, recommendations: [], candidateCount: 0, candidateProductIds: [], rankingVersion: RANKING_VERSION, mode });
  const done = (response: ChatResponse, finalState: string, extra: Partial<ShoppingTurnResult> = {}): ShoppingTurnResult => { step("RESPONDED"); return { response, finalState, trace, ...extra }; };

  // update_family: explicit profile edits in chat.
  const profileChange = parseProfileChange(input.message, input.profile);
  if (profileChange) {
    step("INTENT_PARSED", { intentType: "update_family" });
    return done({ ...base(emptyIntent(input.previousIntent), "rules"), text: "Mình đã cập nhật hồ sơ gia đình và sẽ dùng thông tin mới cho những gợi ý tiếp theo.", view: { kind: "family" }, profile: profileChange }, "PROFILE_UPDATED", { profileChange });
  }
  const navigation = routeWorkspace(input.message, input.products);
  if (navigation) { step("INTENT_PARSED", { intentType: "navigate" }); return done({ ...base(emptyIntent(input.previousIntent), "rules"), text: navigation.text, view: navigation.view }, "NAVIGATED"); }

  // Child names never reach the provider (spec v1 §6.2).
  const children = input.profile?.children ?? [];
  const names = children.map((child) => child.name).filter((name): name is string => Boolean(name));
  // Same [BE_n] placeholders the prompt describes.
  const masked = names.reduce((text, name, index) => text.replace(new RegExp(`(?<![\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "giu"), `[BE_${index + 1}]`), input.message);
  const { extraction, mode } = await extractShopping(input.message, input.allowAi, masked, chat);
  step("INTENT_PARSED", { mode, intentType: extraction.intentType ?? "unknown" });
  const mentions = brandMentions(input.message, input.products.map((product) => product.brand));
  // A catalog brand implies its category ("mua Nhãn mẫu B" means diapers in the MVP catalog).
  if (!extraction.categoryId && mentions.preferred.length + mentions.lifted.length) {
    const named = new Set([...mentions.preferred, ...mentions.lifted]);
    extraction.categoryId = input.products.find((product) => named.has(product.brand))?.category ?? null;
  }
  const intent = mergeIntent(extraction, input.profile, input.previousIntent, mentions);
  step("CONTEXT_RESOLVED", { ambiguity: intent.ambiguity.join(",") });
  const reply = base(intent, mode);

  // Clarification: at most one question per turn, choices first (spec v1 §9).
  const replenishment = replenishmentReply(intent.intentType, input.stock ?? []);
  if (replenishment) { step("CLARIFICATION_REQUIRED", { reason: intent.intentType }); return done({ ...reply, ...replenishment }, "CLARIFICATION_REQUIRED"); }
  const soon = COMING_SOON[intent.intentType];
  if (soon) { step("CLARIFICATION_REQUIRED", { reason: intent.intentType }); return done({ ...reply, text: soon, choices: ["Tìm bỉm cho bé"] }, "CLARIFICATION_REQUIRED"); }
  if (intent.categoryId === "unsupported") { step("CLARIFICATION_REQUIRED", { reason: "unsupported_category" }); return done({ ...reply, text: "Hiện mình đang hoàn thiện tư vấn bỉm. Các danh mục khác sẽ được mở sau khi dữ liệu sản phẩm được kiểm tra.", choices: ["Tìm bỉm cho bé"] }, "CLARIFICATION_REQUIRED"); }
  if (!intent.categoryId) { step("CLARIFICATION_REQUIRED", { reason: "category" }); return done({ ...reply, text: "Bạn đang muốn tìm sản phẩm nào? Hiện mình có thể giúp chọn bỉm cho bé.", question: "Bạn cần tìm bỉm cho bé phải không?", choices: ["Tìm bỉm cho bé"] }, "CLARIFICATION_REQUIRED"); }
  if (intent.ambiguity.includes("member")) {
    step("CLARIFICATION_REQUIRED", { reason: "member" });
    // Choices carry weight/size so same-name children resolve on the next turn.
    const choices = children.filter((child) => child.name).map((child) => `Cho bé ${child.name}${child.weightKg ? ` ${child.weightKg}kg` : child.diaperSize ? ` size ${child.diaperSize}` : ""}`);
    return done({ ...reply, text: "Bạn đang tìm cho bé nào?", question: "Bạn đang tìm cho bé nào?", choices: choices.length ? choices : ["Bé 10kg", "Size L"] }, "CLARIFICATION_REQUIRED");
  }
  if (intent.ambiguity.includes("brand_conflict")) {
    step("CLARIFICATION_REQUIRED", { reason: "brand_conflict" });
    const conflicting = mentions.preferred.filter((brand) => intent.constraints.excludedBrands?.some((item) => item.toLocaleLowerCase("vi") === brand.toLocaleLowerCase("vi")));
    // "Vẫn tìm X" lifts the exclusion for this conversation only; the profile is unchanged.
    return done({ ...reply, text: `${conflicting.join(", ")} đang nằm trong danh sách muốn tránh. Bạn vẫn muốn tìm thương hiệu này cho lần này không?`, choices: [...conflicting.map((brand) => `Vẫn tìm ${brand}`), "Giữ nguyên, tìm loại khác"] }, "CLARIFICATION_REQUIRED");
  }
  const { weightKg, sizeLabel } = intent.requiredAttributes;
  if (weightKg === undefined && !sizeLabel) { step("CLARIFICATION_REQUIRED", { reason: "weight_or_size" }); return done({ ...reply, text: "Để tránh gợi ý bỉm sai cỡ, mình cần cân nặng hoặc size hiện tại của bé.", question: "Bé hiện nặng khoảng bao nhiêu kg hoặc đang dùng size nào?", choices: ["Bé 10kg", "Size L"] }, "CLARIFICATION_REQUIRED"); }

  step("CANDIDATES_RETRIEVED", { count: input.products.length });
  const { candidates, rejected } = hardFilter(input.products, intent);
  const candidateCount = candidates.length;
  const candidateProductIds = candidates.map((entry) => entry.product.id);
  step("HARD_FILTERED", { candidates: candidateCount, rejected: rejected.length });
  // Offers are ranked per variant inside rankCandidates, so OFFERS_RESOLVED and RANKED share one timing.
  const recommendations = rankCandidates(candidates, intent, input.now);
  step("RANKED", { shown: recommendations.length, version: RANKING_VERSION, offersRanked: true });
  if (!recommendations.length) {
    const advice = noResultAdvice(intent, rejected);
    step("RESPONSE_VALIDATED", { source: "template" });
    return done({ ...reply, text: advice.text, choices: advice.choices, candidateCount, candidateProductIds }, "RESPONDED", { rejected });
  }
  const summary = await composeSummary(intent, candidateCount, recommendations, input.allowAi, chat, input.products);
  step("RESPONSE_VALIDATED", { source: summary.source });
  return done({ ...reply, text: summary.text, recommendations, candidateCount, candidateProductIds }, "RESPONDED", { rejected });
}
