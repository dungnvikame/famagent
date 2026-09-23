import { NextResponse } from "next/server";
import { filterProducts } from "@/lib/catalog/filter";
import { getProducts } from "@/lib/catalog/repository";
import type { CatalogFilters } from "@/lib/catalog/types";

export async function POST(request: Request) {
  let body: CatalogFilters;
  try { body = await request.json() as CatalogFilters; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body !== "object" || body === null || Array.isArray(body)
    || (body.weightKg !== undefined && (typeof body.weightKg !== "number" || !Number.isFinite(body.weightKg) || body.weightKg <= 0))
    || (body.maxPrice !== undefined && (typeof body.maxPrice !== "number" || !Number.isFinite(body.maxPrice) || body.maxPrice <= 0))
    || (body.size !== undefined && (typeof body.size !== "string" || body.size.length > 30))
    || (body.brand !== undefined && (typeof body.brand !== "string" || body.brand.length > 100))) {
    return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
  }
  const products = filterProducts(await getProducts(), body);
  return NextResponse.json({ products, count: products.length });
}
