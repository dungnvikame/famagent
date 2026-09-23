import { NextResponse } from "next/server";
import { getProducts } from "@/lib/catalog/repository";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = (await getProducts()).find((item) => item.id === id);
  return product ? NextResponse.json({ product }) : NextResponse.json({ error: "Product not found" }, { status: 404 });
}

