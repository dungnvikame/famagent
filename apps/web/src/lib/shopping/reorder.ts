// Stock lines for the agent's reorder / "còn không?" answers (spec §5): item, prices the family paid, and whether the
// child is about to outgrow the size — everything the agent "already knows" about "Mua lại bỉm cho Gold".
import type { StockLine } from "../ai/shopping/pipeline.ts";
import type { FamilyProfile } from "../experience/types.ts";
import { purchasesOf, type ItemEstimate } from "./items.ts";
import type { Purchase } from "./purchases.ts";
import { upcomingStages } from "./stages.ts";

export function reorderLines(estimates: ItemEstimate[], purchases: Purchase[], profile: FamilyProfile | null, now = new Date()): StockLine[] {
  const sizeStages = upcomingStages(profile, [], now).filter((stage) => stage.key.startsWith("stage:size-"));
  return estimates.filter((estimate) => estimate.known && estimate.daysLeft !== null && estimate.lastPurchase).map((estimate) => {
    const packPrices = purchasesOf(estimate.item, purchases).map((purchase) => Math.round(purchase.amount / Math.max(1, purchase.packs)));
    const child = profile?.children.find((entry) => entry.id === estimate.item.childId) ?? (profile?.children.length === 1 ? profile.children[0] : undefined);
    const stage = estimate.item.category === "diapers" && child ? sizeStages.find((entry) => entry.childId === child.id) : undefined;
    return {
      productName: estimate.item.name, brand: estimate.item.brand, daysLeft: estimate.daysLeft!, remaining: estimate.remaining, lastPurchasedOn: estimate.lastPurchase!.purchasedOn,
      itemId: estimate.item.id, productId: estimate.item.productId, unit: estimate.item.unit, packSize: estimate.item.packSize, merchant: estimate.lastPurchase!.merchant ?? estimate.item.merchant,
      lastPackPrice: estimate.lastPackPrice, minPackPrice: packPrices.length ? Math.min(...packPrices) : undefined,
      sizeNote: stage ? stage.title.replace(/^bé \S+ /, "bé ") : undefined,
    };
  });
}
