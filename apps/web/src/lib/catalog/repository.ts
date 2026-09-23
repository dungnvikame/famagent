import { createClient } from "@supabase/supabase-js";
import { demoProducts } from "./demo";
import type { Product } from "./types";

type Row = {
  id: string; slug: string; canonical_name: string; brand: string; description: string | null; image_url: string | null;
  diaper_attributes: { min_weight_kg: number; max_weight_kg: number; diaper_type: "tape" | "pants"; night_use_score: number | null; absorbency_score: number | null; softness_score: number | null; thickness_score: number | null; sensitive_skin_score: number | null } | null;
  product_variants: { id: string; name: string; size: string; quantity: number; quantity_unit: "piece"; product_offers: { id: string; merchant_id: string; source: "shopee" | "tiktok" | "lazada" | "affiliate" | "direct"; price: number; availability: "in_stock" | "out_of_stock" | "unknown"; updated_at: string; merchants: { name: string } | { name: string }[] }[] }[];
};

function mapProduct(row: Row): Product | null {
  const diaper = row.diaper_attributes;
  if (!diaper || !row.image_url || !row.product_variants.some((variant) => variant.product_offers.some((offer) => offer.availability === "in_stock"))) return null;
  return {
    id: row.id, slug: row.slug, canonicalName: row.canonical_name, brand: row.brand,
    category: "diapers", description: row.description ?? undefined, imageUrl: row.image_url ?? undefined,
    diaper: {
      minWeightKg: diaper.min_weight_kg, maxWeightKg: diaper.max_weight_kg, type: diaper.diaper_type,
      nightUseScore: diaper.night_use_score ?? undefined, absorbencyScore: diaper.absorbency_score ?? undefined,
      softnessScore: diaper.softness_score ?? undefined, thicknessScore: diaper.thickness_score ?? undefined,
      sensitiveSkinScore: diaper.sensitive_skin_score ?? undefined,
    },
    variants: row.product_variants.map((variant) => ({
      id: variant.id, name: variant.name, size: variant.size, quantity: variant.quantity, quantityUnit: variant.quantity_unit,
      offers: variant.product_offers.map((offer) => ({
        id: offer.id, merchantId: offer.merchant_id,
        merchantName: Array.isArray(offer.merchants) ? (offer.merchants[0]?.name ?? "Cửa hàng") : offer.merchants.name,
        source: offer.source, price: offer.price, currency: "VND" as const, availability: offer.availability, updatedAt: offer.updated_at,
      })),
    })),
  };
}

export function isDemoMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function getProducts(): Promise<Product[]> {
  if (isDemoMode()) return demoProducts;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, { auth: { persistSession: false } });
  const { data, error } = await client.from("products").select("id,slug,canonical_name,brand,description,image_url,diaper_attributes(min_weight_kg,max_weight_kg,diaper_type,night_use_score,absorbency_score,softness_score,thickness_score,sensitive_skin_score),product_variants(id,name,size,quantity,quantity_unit,product_offers(id,merchant_id,source,price,availability,updated_at,merchants(name)))").eq("category_slug", "diapers").eq("published", true).order("canonical_name");
  if (error) throw new Error(`Catalog query failed: ${error.message}`);
  return ((data ?? []) as unknown as Row[]).map(mapProduct).filter((product): product is Product => product !== null);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return (await getProducts()).find((product) => product.slug === slug) ?? null;
}
