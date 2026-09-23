import type { FamilyProfile, ShoppingIntent } from "@/lib/experience/types";

export type ExtractedIntent = { category: "diapers" | "unsupported" | null; childName: string | null; weightKg: number | null; diaperSize: string | null; maxPrice: number | null; nightUse: boolean | null; leakProtection: boolean | null; sensitiveSkin: boolean | null; brand: string | null };

export function mergeContext(message: string, data: ExtractedIntent, profile: FamilyProfile | null, previous: ShoppingIntent | null): ShoppingIntent {
  const child = profile?.children.find((item) => data.childName && item.name?.toLocaleLowerCase("vi") === data.childName.toLocaleLowerCase("vi")) ?? (data.childName ? undefined : profile?.children[0]);
  return {
    category: data.category ?? previous?.category ?? null,
    childName: data.childName ?? previous?.childName ?? child?.name,
    weightKg: data.weightKg && data.weightKg >= 2 && data.weightKg <= 30 ? data.weightKg : previous?.weightKg ?? child?.weightKg,
    diaperSize: data.diaperSize && /^(NB|S|M|L|XL|XXL)$/.test(data.diaperSize.toUpperCase()) ? data.diaperSize.toUpperCase() : previous?.diaperSize ?? child?.diaperSize,
    maxPrice: /bỏ (?:giới hạn )?giá|không giới hạn giá/i.test(message) ? undefined : data.maxPrice && data.maxPrice >= 50_000 ? data.maxPrice : previous?.maxPrice ?? profile?.maxBudget,
    nightUse: data.nightUse ?? previous?.nightUse ?? (profile?.mainConcern === "night" ? true : undefined),
    leakProtection: data.leakProtection ?? previous?.leakProtection ?? (profile?.mainConcern === "leak" ? true : undefined),
    sensitiveSkin: data.sensitiveSkin ?? previous?.sensitiveSkin ?? (profile?.mainConcern === "sensitive" ? true : undefined),
    brand: data.brand ?? previous?.brand,
  };
}

