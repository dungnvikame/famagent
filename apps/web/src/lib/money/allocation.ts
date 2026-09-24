import { bucketOf, frameworkById, type Framework, type FrameworkId } from "./frameworks.ts";
import { SAVING_CATEGORIES, type AllocationBucket, type MoneyAllocation, type MoneyCategory } from "./types.ts";

/**
 * The family's own money split (money method "custom"): named parts, each a share of income and the ledger
 * categories that count toward it. Built from scratch or from a well-known framework, then edited freely.
 */

export const CUSTOM_NAME = "Cách chia của nhà mình";
export const BUCKET_COLORS = ["#7a5cff", "#ff9f7a", "#3fb68b", "#f2c14e", "#5aa9e6", "#e06c9f", "#8d7b68", "#4bb3a8", "#b58cf2", "#f08a5d", "#6c8ebf", "#9bbf5a"];

/** Every category a part can hold: active expense categories plus the saving ones. */
export const allocatable = (categories: MoneyCategory[]) => [...categories.filter((item) => item.kind === "expense" && !item.archived).map((item) => item.name), ...SAVING_CATEGORIES.filter((name) => name !== "Rút tiết kiệm")];

/** A part counts as "at least" (a saving target) when it holds a saving category; others are "at most". */
export const isSavingBucket = (bucket: Pick<AllocationBucket, "categories">) => bucket.categories.some((name) => SAVING_CATEGORIES.includes(name));

export const allocationTotal = (allocation: MoneyAllocation) => Math.round(allocation.buckets.reduce((sum, bucket) => sum + bucket.share, 0) * 1000) / 1000;

/** Categories not in any part yet (shown so the family can place them). */
export const unassigned = (allocation: MoneyAllocation, categories: MoneyCategory[]) => {
  const used = new Set(allocation.buckets.flatMap((bucket) => bucket.categories));
  return allocatable(categories).filter((name) => !used.has(name));
};

/** Starting point: an empty 3-part split, or a well-known framework with each category placed by its own rules. */
export function allocationFrom(preset: FrameworkId | "blank", categories: MoneyCategory[]): MoneyAllocation {
  const fw = preset === "blank" ? undefined : frameworkById(preset);
  if (!fw || fw.buckets.some((bucket) => bucket.share === undefined)) {
    return { buckets: [
      { key: "b1", label: "Thiết yếu", share: 0.5, categories: [] },
      { key: "b2", label: "Để dành", share: 0.2, categories: ["Tiết kiệm", "Tiết kiệm cho con"] },
      { key: "b3", label: "Hưởng thụ", share: 0.3, categories: [] },
    ] };
  }
  const buckets = fw.buckets.map((bucket) => ({ key: bucket.key, label: bucket.label, share: bucket.share ?? 0, categories: [] as string[] }));
  for (const name of allocatable(categories)) {
    const saving = SAVING_CATEGORIES.includes(name);
    const key = bucketOf(fw.id, { kind: saving ? "saving" : "expense", category: name, amount: 1 });
    buckets.find((bucket) => bucket.key === key)?.categories.push(name);
  }
  return { buckets };
}

/** The split as a Framework, so the Money page panel shows it like any other method. */
export function customFramework(allocation: MoneyAllocation): Framework {
  return {
    id: "custom", name: CUSTOM_NAME, origin: `Tự thiết kế · ${allocation.buckets.length} phần`,
    idea: "Các phần, tỷ lệ và nhóm chi do nhà mình tự đặt.", howTo: [], bestFor: "",
    buckets: allocation.buckets.map((bucket) => ({ key: bucket.key, label: bucket.label, share: bucket.share, hint: bucket.categories.join(", ").toLowerCase() || "chưa gắn nhóm chi nào", categories: bucket.categories, atLeast: isSavingBucket(bucket) })),
  };
}
