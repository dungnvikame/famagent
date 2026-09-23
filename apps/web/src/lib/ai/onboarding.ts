import { structuredOutput } from "./openai";
import type { FamilyProfile, PricePreference, ShoppingConcern } from "@/lib/experience/types";

type Extracted = { childName: string | null; weightKg: number | null; ageMonths: number | null; diaperSize: string | null; pricePreference: PricePreference | null; mainConcern: ShoppingConcern | null; maxBudget: number | null };

const schema = {
  type: "object", additionalProperties: false,
  properties: {
    childName: { type: ["string", "null"] }, weightKg: { type: ["number", "null"] }, ageMonths: { type: ["number", "null"] },
    diaperSize: { type: ["string", "null"] }, pricePreference: { type: ["string", "null"], enum: ["budget", "balanced", "premium", null] },
    mainConcern: { type: ["string", "null"], enum: ["night", "leak", "soft", "sensitive", "value", null] }, maxBudget: { type: ["number", "null"] },
  },
  required: ["childName", "weightKg", "ageMonths", "diaperSize", "pricePreference", "mainConcern", "maxBudget"],
};

function amount(message: string): number | null {
  const match = message.match(/(?:dưới|tối đa|ngân sách|khoảng|tầm|giá)?\s*(\d{2,7})(?:[.,](\d{3}))?\s*(k|nghìn|ngàn|triệu|đ|vnd)?/i);
  if (!match) return null;
  const base = Number(match[1] + (match[2] ?? ""));
  const multiplier = /triệu/i.test(match[3] ?? "") ? 1_000_000 : /^(k|nghìn|ngàn)$/i.test(match[3] ?? "") ? 1_000 : 1;
  const value = base * multiplier;
  if (value >= 50_000 && value <= 10_000_000) return value;
  if (base >= 50 && base <= 10_000 && !match[3]) return base * 1_000;
  return null;
}

function fallback(message: string): Extracted {
  const lower = message.toLocaleLowerCase("vi");
  const weight = message.match(/(\d{1,2}(?:[.,]\d)?)\s*(?:kg|ký|kí)/i);
  const age = message.match(/(\d{1,2})\s*(?:tháng|month)/i);
  const size = message.match(/(?:size|cỡ)\s*(NB|S|M|L|XL|XXL)\b/i);
  const name = message.match(/(?:[Bb]é|[Cc]on|[Tt]ên)\s+([\p{Lu}][\p{L}]{1,23})/u);
  const concern: ShoppingConcern | null = /tràn|rò rỉ/.test(lower) ? "leak" : /ban đêm|đêm/.test(lower) ? "night" : /nhạy cảm|kích ứng/.test(lower) ? "sensitive" : /mỏng|mềm/.test(lower) ? "soft" : /giá|tiết kiệm/.test(lower) ? "value" : null;
  const preference: PricePreference | null = /rẻ nhất|tiết kiệm|giá tốt/.test(lower) ? "budget" : /cao cấp|premium/.test(lower) ? "premium" : /cân bằng|hợp lý|balanced/.test(lower) ? "balanced" : null;
  return { childName: name?.[1] ?? null, weightKg: weight ? Number(weight[1].replace(",", ".")) : null, ageMonths: age ? Number(age[1]) : null, diaperSize: size?.[1].toUpperCase() ?? null, pricePreference: preference, mainConcern: concern, maxBudget: amount(message) };
}

export async function processOnboarding(step: "child" | "preferences", message: string, profile: FamilyProfile): Promise<{ profile: FamilyProfile; reply: string; nextStep: "preferences" | "review"; mode: "ai" | "rules" }> {
  const ai = profile.aiConsent ? await structuredOutput<Extracted>("onboarding_context", schema,
    "Bạn là agent thu thập bối cảnh mua sắm cho gia đình. Chỉ trích xuất thông tin người dùng nói rõ. Không đoán thông tin trẻ, không đưa tư vấn sản phẩm. Giá tiền đổi thành VND; trường không có trả null.", message) : null;
  const data = ai ?? fallback(message);
  const updated: FamilyProfile = { ...profile, updatedAt: new Date().toISOString() };
  if (step === "child") {
    const child = { ...(profile.children[0] ?? { id: crypto.randomUUID() }) };
    if (data.childName && data.childName.length <= 30) child.name = data.childName;
    if (data.weightKg && data.weightKg >= 2 && data.weightKg <= 30) child.weightKg = data.weightKg;
    if (data.ageMonths !== null && data.ageMonths >= 0 && data.ageMonths <= 48) child.ageMonths = data.ageMonths;
    if (data.diaperSize && /^(NB|S|M|L|XL|XXL)$/.test(data.diaperSize.toUpperCase())) child.diaperSize = data.diaperSize.toUpperCase();
    updated.children = Object.keys(child).length > 1 ? [child, ...profile.children.slice(1)] : profile.children;
    const context = child.name ? `Tôi đã ghi nhận bé ${child.name}${child.weightKg ? `, ${child.weightKg} kg` : ""}.` : child.weightKg ? `Tôi đã ghi nhận bé nặng ${child.weightKg} kg.` : "Bạn có thể bổ sung thông tin của bé sau.";
    return { profile: updated, reply: `${context} Khi mua đồ, bạn ưu tiên điều gì? Có mức giá tối đa thường dùng không?`, nextStep: "preferences", mode: ai ? "ai" : "rules" };
  }
  if (data.pricePreference) updated.pricePreference = data.pricePreference;
  if (data.mainConcern) updated.mainConcern = data.mainConcern;
  if (data.maxBudget) updated.maxBudget = data.maxBudget;
  return { profile: updated, reply: "Tôi đã có bối cảnh ban đầu. Bạn có thể xem lại và chỉnh sửa trước khi bắt đầu hỏi mua sản phẩm.", nextStep: "review", mode: ai ? "ai" : "rules" };
}
