import { NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/ai/llm";
import { allowInMemory } from "@/lib/ai/onboarding/rate-limit";
import { composeCompareSummary } from "@/lib/ai/shopping/compare-summary";
import { resolveCompareItems } from "@/lib/catalog/compare";
import { getProducts } from "@/lib/catalog/repository";
import { authenticated, authConfigured } from "@/lib/supabase/server";

// Compare summary (spec v1 §17 POST /api/compare): template always; AI wording only with consent + quota.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { items?: unknown; aiConsent?: unknown } | null;
  if (!body || typeof body.items !== "string" || body.items.length > 400) return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  const products = await getProducts();
  const items = resolveCompareItems(products, { items: body.items });
  if (items.length < 2) return NextResponse.json({ error: "Cần 2–3 sản phẩm để so sánh" }, { status: 400 });

  let allowAi = false;
  if (isAiConfigured()) {
    if (authConfigured()) {
      const account = await authenticated();
      if (account) {
        const { data } = await account.client.from("family_profiles").select("ai_consent").eq("user_id", account.user.id).maybeSingle();
        if (data?.ai_consent) {
          const { data: allowed } = await account.client.rpc("consume_request_quota", { p_endpoint: "compare", p_limit: 30 });
          allowAi = allowed === true;
        }
      }
    } else {
      // Local/demo mode: consent comes from the browser profile; per-IP budget (dev only).
      allowAi = body.aiConsent === true && allowInMemory(`compare:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`, Date.now(), 30);
    }
  }
  const summary = await composeCompareSummary(items, allowAi, products);
  return NextResponse.json(summary);
}
