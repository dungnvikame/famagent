// Offer freshness and redirect decisions (spec v1 §10.3, §12): a price older than the window keeps the
// product visible but hides the buy CTA; /go never redirects to an unverified or off-domain URL.
import type { ProductOffer } from "./types.ts";

export const STALE_AFTER_HOURS = 48;
const HOUR = 3_600_000;

/** Demo offers lead to the demo purchase page, so freshness does not apply to them. */
export function isOfferFresh(offer: Pick<ProductOffer, "updatedAt">, now = Date.now(), isDemo = false): boolean {
  if (isDemo) return true;
  const observed = Date.parse(offer.updatedAt);
  return Number.isFinite(observed) && now - observed <= STALE_AFTER_HOURS * HOUR;
}

/** "08:00 23/09" in Vietnam time, used as "Giá cập nhật lúc …". */
export function priceTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "chưa rõ";
  // Assembled from parts: separators differ between ICU builds (server vs browser → hydration mismatch).
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", hourCycle: "h23" }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}`;
}

export interface RedirectOfferRow { productSlug: string; domain: string | null; affiliateUrl: string | null; updatedAt: string | Date }
export type RedirectDecision =
  | { kind: "redirect"; url: URL }
  | { kind: "stale"; productSlug: string }
  | { kind: "invalid" }
  | { kind: "missing" };

/** Decides what /go/:offerId does with an in-stock, published offer row (or none). Pure for testing. */
export function decideRedirect(row: RedirectOfferRow | undefined, now = Date.now()): RedirectDecision {
  if (!row?.affiliateUrl || !row.domain) return { kind: "missing" };
  let url: URL;
  try { url = new URL(row.affiliateUrl); } catch { return { kind: "invalid" }; }
  const host = url.hostname.toLowerCase(); const domain = row.domain.toLowerCase();
  if (url.protocol !== "https:" || (host !== domain && !host.endsWith(`.${domain}`))) return { kind: "invalid" };
  const updatedAt = row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt;
  if (!isOfferFresh({ updatedAt }, now)) return { kind: "stale", productSlug: row.productSlug };
  return { kind: "redirect", url };
}
