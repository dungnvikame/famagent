import type { ExtractedIntent } from "./context";

export function extractRules(message: string): ExtractedIntent {
  const lower = message.toLocaleLowerCase("vi");
  const category = /bỉm|tã|diaper/.test(lower) ? "diapers" : /khăn|giặt|rửa|giấy|túi rác|sữa|thuốc/.test(lower) ? "unsupported" : null;
  const weight = message.match(/(\d{1,2}(?:[.,]\d)?)\s*(?:kg|ký|kí)/i);
  const size = message.match(/(?:size|cỡ)\s*(NB|S|M|L|XL|XXL)\b/i);
  let maxPrice: number | null = null;
  for (const budget of message.matchAll(/(\d{2,7})\s*(k|nghìn|ngàn|triệu|đ|vnd)?/gi)) {
    const base = Number(budget[1]); const unit = budget[2] ?? "";
    const amount = /triệu/i.test(unit) ? base * 1_000_000 : /^(k|nghìn|ngàn)$/i.test(unit) || (base >= 50 && base < 10000 && !unit) ? base * 1000 : base;
    if (amount >= 50_000 && amount <= 10_000_000) { maxPrice = amount; break; }
  }
  const name = message.match(/(?:cho\s+)?(?:bé|con)\s+([\p{Lu}][\p{L}]{1,23})/u)?.[1] ?? message.match(/cho\s+([\p{Lu}][\p{L}]{1,23})/u)?.[1] ?? null;
  return { category, childName: name, weightKg: weight ? Number(weight[1].replace(",", ".")) : null, diaperSize: size?.[1].toUpperCase() ?? null, maxPrice, nightUse: /ban đêm|dùng đêm|ngủ đêm/.test(lower) ? true : null, leakProtection: /chống tràn|hay tràn|hạn chế tràn/.test(lower) ? true : null, sensitiveSkin: /da nhạy cảm|kích ứng/.test(lower) ? true : null, brand: null };
}
