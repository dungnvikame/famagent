import { structuredOutput } from "./openai";
import type { ExtractedIntent } from "./context";
import { extractRules } from "./intent-rules";

type Extracted = ExtractedIntent;

const schema = {
  type: "object", additionalProperties: false,
  properties: {
    category: { type: ["string", "null"], enum: ["diapers", "unsupported", null] }, childName: { type: ["string", "null"] }, weightKg: { type: ["number", "null"] },
    diaperSize: { type: ["string", "null"] }, maxPrice: { type: ["number", "null"] }, nightUse: { type: ["boolean", "null"] },
    leakProtection: { type: ["boolean", "null"] }, sensitiveSkin: { type: ["boolean", "null"] }, brand: { type: ["string", "null"] },
  },
  required: ["category", "childName", "weightKg", "diaperSize", "maxPrice", "nightUse", "leakProtection", "sensitiveSkin", "brand"],
};

export async function extractIntent(message: string, aiConsent: boolean): Promise<{ extracted: Extracted; mode: "ai" | "rules" }> {
  const ai = aiConsent ? await structuredOutput<Extracted>("shopping_intent", schema,
    "Bạn là Intent Agent cho mua sắm gia đình tại Việt Nam. Chỉ trích xuất yêu cầu từ câu người dùng. Danh mục hiện hỗ trợ bỉm (diapers); danh mục khác trả unsupported. Không gợi ý sản phẩm, không đoán giá hoặc thông tin trẻ. Nếu không có dữ liệu trả null.", message) : null;
  return { extracted: ai ?? extractRules(message), mode: ai ? "ai" : "rules" };
}
