import { redirect } from "next/navigation";
import { ShoppingPlanPage } from "@/components/shopping/shopping-plan-page";

export const metadata = { title: "FamAgent | Mua sắm" };

type Search = Record<string, string | string[] | undefined>;

/** Shopping = the family's own plan and behaviour; the catalog lives at /shopping/find. Old tab links still resolve. */
export default async function ShoppingPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  if (params.tab === "saved") redirect("/shopping/find#saved");
  if (params.tab === "search" || typeof params.weightKg === "string" || typeof params.size === "string" || typeof params.maxPrice === "string" || typeof params.brand === "string") {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (typeof value === "string" && key !== "tab") query.set(key, value);
    redirect(`/shopping/find${query.size ? `?${query}` : ""}`);
  }
  return <ShoppingPlanPage />;
}
