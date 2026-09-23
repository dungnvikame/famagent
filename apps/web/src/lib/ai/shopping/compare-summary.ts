// Compare summary (plan P7, spec §11): a deterministic template from catalog facts; optional LLM wording
// that must pass the same fact-guard as recommendation summaries, otherwise the template is shown.
import { chatJson, type JsonSchema } from "../llm/index.ts";
import { vnd } from "../../catalog/format.ts";
import type { CompareItem } from "../../catalog/compare.ts";
import type { Product } from "../../catalog/types.ts";
import { passesFactGuard } from "./composer.ts";

export function compareFacts(items: CompareItem[]): string {
  return JSON.stringify(items.map(({ product, variant, offer, unitPrice }) => ({
    name: product.canonicalName, brand: product.brand, size: variant.size, quantity: variant.quantity,
    priceVnd: offer?.price ?? null, unitPriceVnd: unitPrice === null ? null : Math.round(unitPrice),
    weightKg: [product.diaper.minWeightKg, product.diaper.maxWeightKg], type: product.diaper.type,
    nightUseScore: product.diaper.nightUseScore ?? null, absorbencyScore: product.diaper.absorbencyScore ?? null,
    thicknessScore: product.diaper.thicknessScore ?? null, sellerRating: offer?.sellerRating ?? null,
  })));
}

/** Only statements derivable from the facts; missing data is named as missing, never guessed. */
export function compareTemplate(items: CompareItem[]): string {
  if (items.length < 2) return "";
  const parts: string[] = [];
  const priced = items.filter((item) => item.unitPrice !== null).sort((a, b) => a.unitPrice! - b.unitPrice!);
  if (priced.length >= 2) parts.push(`${priced[0].product.canonicalName} có giá mỗi miếng thấp nhất trong nhóm (${vnd(Math.round(priced[0].unitPrice!))}/miếng).`);
  const night = items.filter((item) => item.product.diaper.nightUseScore !== undefined).sort((a, b) => b.product.diaper.nightUseScore! - a.product.diaper.nightUseScore!);
  if (night.length >= 2 && night[0].product.diaper.nightUseScore! > night[1].product.diaper.nightUseScore!) parts.push(`${night[0].product.canonicalName} có điểm dùng ban đêm cao hơn trong catalog (${night[0].product.diaper.nightUseScore}/5).`);
  if (night.length < items.length) parts.push("Một số sản phẩm chưa có dữ liệu dùng ban đêm.");
  if (new Set(items.map((item) => item.variant.quantity)).size > 1) parts.push("Các gói có số miếng khác nhau, nên hãy so theo giá mỗi miếng.");
  parts.push("Giá chưa gồm phí giao.");
  return parts.join(" ");
}

const schema: JsonSchema = { type: "object", additionalProperties: false, properties: { summary: { type: "string" } }, required: ["summary"] };

export async function composeCompareSummary(items: CompareItem[], allowAi: boolean, catalog: Product[], chat = chatJson): Promise<{ text: string; source: "ai" | "template" }> {
  const template = compareTemplate(items);
  if (!allowAi || items.length < 2) return { text: template, source: "template" };
  const facts = compareFacts(items);
  const result = await chat<{ summary: string }>({
    name: "compare_summary", schema,
    system: "Bạn tóm tắt điểm khác nhau giữa các sản phẩm bỉm cho phụ huynh Việt Nam bằng 1–2 câu ngắn, xưng 'mình'. Chỉ dùng dữ kiện trong JSON; dữ liệu null nghĩa là chưa có thông tin, không được đoán; không nói 'tốt nhất'; không tạo link; nhắc giá chưa gồm phí giao.",
    messages: [{ role: "user", content: facts }],
  });
  const context = { items: items.map((item) => ({ name: item.product.canonicalName, brand: item.product.brand })), catalog: catalog.map((product) => ({ name: product.canonicalName, brand: product.brand })), ordered: false };
  const text = result?.data.summary.trim() ?? "";
  return text && passesFactGuard(text, facts, context) ? { text, source: "ai" } : { text: template, source: "template" };
}
