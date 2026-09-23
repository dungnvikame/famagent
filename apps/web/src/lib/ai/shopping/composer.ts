// Response composer (spec v1 §18): template from structured results; optional LLM wording that must
// pass a fact-guard (only numbers present in the facts, no "best" claims) or the template is used.
import { chatJson, type JsonSchema } from "../llm/index.ts";
import { vnd } from "../../catalog/format.ts";
import type { Product } from "../../catalog/types.ts";
import type { Recommendation, ShoppingIntent } from "../../experience/types.ts";
import type { Rejection, RejectReason } from "../../ranking/recommend.ts";

/** What to tell the user when nothing passes the hard filter: name the constraint, never drop it (spec v1 §9). */
export function noResultAdvice(intent: ShoppingIntent, rejected: Rejection[]): { text: string; choices: string[] } {
  const onlyBy = (reason: RejectReason) => rejected.filter((item) => item.reasons.length === 1 && item.reasons[0] === reason).length;
  const { maxTotalPriceVnd, maxUnitPriceVnd, excludedBrands } = intent.constraints;
  if (maxTotalPriceVnd !== undefined && onlyBy("price_total")) return { text: `Chưa có sản phẩm đúng cân nặng/size trong mức ${vnd(maxTotalPriceVnd)}. Có ${onlyBy("price_total")} lựa chọn chỉ vượt ngân sách — bạn có muốn nới mức giá không?`, choices: ["Bỏ giới hạn giá", "Xem tất cả bỉm"] };
  if (maxUnitPriceVnd !== undefined && onlyBy("price_unit")) return { text: `Chưa có lựa chọn nào dưới ${vnd(maxUnitPriceVnd)}/miếng. Bạn có muốn bỏ giới hạn giá mỗi miếng không?`, choices: ["Bỏ giới hạn giá", "Xem tất cả bỉm"] };
  if (excludedBrands?.length && onlyBy("excluded_brand")) return { text: `Các lựa chọn phù hợp đều thuộc thương hiệu bạn muốn tránh (${excludedBrands.join(", ")}). Mình giữ nguyên điều kiện này; bạn có thể đổi cân nặng/size hoặc ngân sách.`, choices: ["Xem tất cả bỉm"] };
  if (onlyBy("size") && intent.requiredAttributes.sizeLabel) return { text: `Catalog hiện chưa có size ${intent.requiredAttributes.sizeLabel} phù hợp với các điều kiện khác. Bạn có thể thử theo cân nặng thay vì size.`, choices: ["Xem tất cả bỉm"] };
  return { text: "Chưa có sản phẩm đáp ứng đủ điều kiện trong catalog. Bạn có thể kiểm tra lại cân nặng/size hoặc nới mức giá.", choices: ["Bỏ giới hạn giá", "Xem tất cả bỉm"] };
}

export function templateSummary(intent: ShoppingIntent, candidateCount: number, items: Recommendation[]): string {
  const { weightKg, nightUse } = intent.requiredAttributes;
  const who = intent.householdMemberRef ? ` cho bé ${intent.householdMemberRef}` : "";
  const context = [weightKg !== undefined ? `${weightKg} kg` : null, nightUse ? "dùng ban đêm" : null, intent.constraints.maxTotalPriceVnd !== undefined ? `tối đa ${vnd(intent.constraints.maxTotalPriceVnd)}` : null].filter(Boolean).join(", ");
  const tradeoff = items[0]?.tradeoffs.find((line) => line.includes("rẻ hơn"));
  return `Mình tìm được ${candidateCount} sản phẩm phù hợp${who}${context ? ` (${context})` : ""}. Đây là ${items.length} lựa chọn nên xem trước.${tradeoff ? ` ${tradeoff}.` : ""}`;
}

const FORBIDDEN = /tốt nhất|rẻ nhất thị trường|giá thấp nhất thị trường|best|số 1|cam kết|chữa|điều trị|an toàn tuyệt đối/i;
// Product claims the model might add; allowed only when the same words appear in the facts.
const CLAIMS = ["siêu mỏng", "mỏng nhất", "không mùi", "kháng khuẩn", "hữu cơ", "organic", "chống hăm", "an toàn", "dịu nhẹ", "thấm hút tốt", "mềm mại", "thoáng khí", "chính hãng", "giảm giá", "khuyến mãi", "freeship", "giao nhanh", "được yêu thích", "bán chạy"];
const numbers = (text: string) => (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((item) => item.replace(/[.,]/g, ""));
const percents = (text: string) => (text.match(/\d+(?:[.,]\d+)?\s*%/g) ?? []).map((item) => item.replace(/\s/g, ""));

export interface GuardContext {
  /** Names/brands of the ranked items (allowed), in rank order. */
  items: Array<{ name: string; brand: string }>;
  /** Every product name/brand in the catalog; any not among the items is rejected. */
  catalog: Array<{ name: string; brand: string }>;
}

/**
 * Spec v1 §18 validator: numbers and percentages must come from the facts, no superlatives/health
 * claims or unsourced product claims, no products/brands outside the results, and rank 1 first.
 */
export function passesFactGuard(text: string, facts: string, context?: GuardContext): boolean {
  if (!text.trim() || text.length > 600 || FORBIDDEN.test(text) || /https?:\/\//.test(text)) return false;
  const lowerText = text.toLocaleLowerCase("vi"); const lowerFacts = facts.toLocaleLowerCase("vi");
  const allowed = new Set(numbers(facts));
  if (!numbers(text).every((item) => allowed.has(item))) return false;
  const factPercents = new Set(percents(facts));
  if (!percents(text).every((item) => factPercents.has(item))) return false;
  if (CLAIMS.some((claim) => lowerText.includes(claim) && !lowerFacts.includes(claim))) return false;
  if (!context) return true;
  const allowedNames = new Set(context.items.flatMap((item) => [item.name, item.brand]).map((name) => name.toLocaleLowerCase("vi")));
  if (context.catalog.some((item) => [item.name, item.brand].some((name) => !allowedNames.has(name.toLocaleLowerCase("vi")) && lowerText.includes(name.toLocaleLowerCase("vi"))))) return false;
  // The first product the summary names must be the rank-1 item (no reordering).
  const firstNamed = context.items.map((item, rank) => ({ rank, at: lowerText.indexOf(item.name.toLocaleLowerCase("vi")) })).filter((hit) => hit.at >= 0).sort((a, b) => a.at - b.at)[0];
  return !firstNamed || firstNamed.rank === 0;
}

const schema: JsonSchema = { type: "object", additionalProperties: false, properties: { summary: { type: "string" }, followUpQuestion: { type: ["string", "null"] } }, required: ["summary", "followUpQuestion"] };

/** Facts the LLM may use: ranked items only, no child name (spec v1 §6.2). */
export function factSheet(intent: ShoppingIntent, candidateCount: number, items: Recommendation[]): string {
  return JSON.stringify({
    candidateCount,
    request: { weightKg: intent.requiredAttributes.weightKg, sizeLabel: intent.requiredAttributes.sizeLabel, nightUse: intent.requiredAttributes.nightUse, maxTotalPriceVnd: intent.constraints.maxTotalPriceVnd },
    items: items.map((item) => ({ rank: item.rank, name: item.product.canonicalName, brand: item.product.brand, reasons: item.reasons, tradeoffs: item.tradeoffs })),
  });
}

export async function composeSummary(intent: ShoppingIntent, candidateCount: number, items: Recommendation[], allowAi: boolean, chat = chatJson, catalog: Product[] = []): Promise<{ text: string; source: "ai" | "template" }> {
  const template = templateSummary(intent, candidateCount, items);
  if (!allowAi || !items.length) return { text: template, source: "template" };
  const facts = factSheet(intent, candidateCount, items);
  const result = await chat<{ summary: string; followUpQuestion: string | null }>({
    name: "recommendation_summary", schema,
    system: "Bạn tóm tắt kết quả gợi ý bỉm cho phụ huynh Việt Nam bằng 2–3 câu ngắn, xưng 'mình'. Chỉ dùng dữ kiện trong JSON; không thêm giá, số liệu, đánh giá hay tính năng khác; không nói 'tốt nhất'; không đổi thứ tự xếp hạng; không tạo link. followUpQuestion: tối đa 1 câu hỏi gợi ý bước tiếp (vd so sánh) hoặc null.",
    messages: [{ role: "user", content: facts }],
  });
  const text = result ? [result.data.summary.trim(), result.data.followUpQuestion?.trim()].filter(Boolean).join(" ") : "";
  const context: GuardContext = { items: items.map((item) => ({ name: item.product.canonicalName, brand: item.product.brand })), catalog: catalog.map((product) => ({ name: product.canonicalName, brand: product.brand })) };
  return text && passesFactGuard(text, facts, context) ? { text, source: "ai" } : { text: template, source: "template" };
}
