// Family Policy (core journey spec §1): the onboarding style (Tiết kiệm / Cân bằng / Tiện lợi) turned into rules the
// attention engine, reminders and shopping suggestions read. Derived, not stored: changing the style changes the policy.
import type { FamilyProfile, HouseholdStyle } from "../experience/types.ts";

export interface FamilyPolicy {
  style: HouseholdStyle;
  /** "Sắp hết" shows on Home when an item has at most this many days left. */
  reorderWindowDays: number;
  /** Push reminder threshold (days left). */
  lowStockPushDays: number;
  /** Month spend this % above pace counts as "cần chú ý". */
  spendAlertPct: number;
  /** A category's week this % above its 4-week average counts as unusual. */
  spikePct: number;
  /** Offer a cheaper option / price per unit comparison first. */
  suggestCheaper: boolean;
  /** Say "có thể chờ sale" when stock lasts until a sale day. */
  waitForSale: boolean;
  /** How FamAgent will work for this family, in plain words (onboarding summary, Gia đình). */
  lines: string[];
}

const POLICIES: Record<HouseholdStyle, Omit<FamilyPolicy, "style">> = {
  saving: { reorderWindowDays: 5, lowStockPushDays: 3, spendAlertPct: 5, spikePct: 25, suggestCheaper: true, waitForSale: true, lines: ["So giá mỗi miếng/đơn vị trước khi gợi ý mua", "Báo sớm khi chi tiêu vượt nhịp khoảng 5%", "Gợi ý chờ ngày sale nếu đồ dùng còn đủ"] },
  balanced: { reorderWindowDays: 7, lowStockPushDays: 3, spendAlertPct: 10, spikePct: 30, suggestCheaper: false, waitForSale: true, lines: ["Gợi ý món quen với giá hợp lý", "Báo khi chi tiêu vượt nhịp khoảng 10%", "Nhắc mua lại khi còn khoảng một tuần"] },
  convenience: { reorderWindowDays: 10, lowStockPushDays: 5, spendAlertPct: 15, spikePct: 40, suggestCheaper: false, waitForSale: false, lines: ["Mua lại nhanh món quen, ít phải so sánh", "Nhắc sớm (còn khoảng 10 ngày) để không bị hết", "Chỉ báo khi chi tiêu vượt nhịp rõ rệt (~15%)"] },
};

export const STYLE_LABELS: Record<HouseholdStyle, string> = { saving: "Tiết kiệm", balanced: "Cân bằng", convenience: "Tiện lợi" };

/** The family's policy; families from before onboarding v6 (no style) get the balanced one. */
export function familyPolicy(profile: Pick<FamilyProfile, "household"> | null): FamilyPolicy {
  const style = profile?.household?.style ?? "balanced";
  return { style, ...POLICIES[style] };
}
