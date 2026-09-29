import type { ChildProfile } from "../experience/types.ts";

/**
 * Catalog link prefilled from the child's profile. Weight is the current fact; the saved size is only
 * sent when the weight is unknown (a stale size next to a fresh weight can empty the results).
 */
export function findPath(child: Pick<ChildProfile, "weightKg" | "diaperSize"> | undefined): string {
  const query = new URLSearchParams();
  if (child?.weightKg) query.set("weightKg", String(child.weightKg));
  else if (child?.diaperSize) query.set("size", child.diaperSize);
  const text = query.toString();
  return `/shopping/find${text ? `?${text}` : ""}`;
}
