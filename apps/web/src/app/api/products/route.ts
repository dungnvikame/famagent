import { NextResponse } from "next/server";
import { filterProducts, parseFilters } from "@/lib/catalog/filter";
import { getProducts } from "@/lib/catalog/repository";

export async function GET(request: Request) {
  const products = filterProducts(await getProducts(), parseFilters(new URL(request.url).searchParams));
  return NextResponse.json({ products, count: products.length });
}

