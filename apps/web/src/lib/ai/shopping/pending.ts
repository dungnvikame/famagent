import type { ShoppingIntent } from "../../experience/types.ts";

/**
 * No-repeat clarifications (plan 260924-1036 §4). The intent of a clarifying turn carries `pendingQuestion`;
 * on the next turn a short yes/no is read against it instead of being parsed as a new request, and if the
 * same question would be asked twice in a row the wording changes and offers concrete choices.
 */
export type PendingQuestion = NonNullable<ShoppingIntent["pendingQuestion"]>;

const fold = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").trim();
const YES = /^(ok|oke|okie|okay|dc|duoc|vang|u|uh|um|co|dong y|chuan|chinh xac|dung|dung roi|phai|yes|y|noi di|noi|cu the|the cung duoc|sao cung duoc|tuy|tuy ban|lam di|tiep|tiep di|di)[.! ]*$/;
const NO = /^(khong|ko|k|thoi|khong can|khong dau|khong nhe|de sau|bo qua|no)[.! ]*$/;

export type Affirmation = "yes" | "no" | null;
export function readAffirmation(message: string): Affirmation {
  const plain = fold(message).replace(/\s+/g, " ");
  if (plain.length > 24) return null;
  return YES.test(plain) ? "yes" : NO.test(plain) ? "no" : null;
}

/** Rewrites a bare "ok/không" into the request the pending question implies; null = pass the message through. */
export function resolvePending(message: string, previous: ShoppingIntent | null): { message: string; note: string } | null {
  const pending = previous?.pendingQuestion;
  if (!pending) return null;
  const answer = readAffirmation(message);
  if (!answer) return null;
  switch (pending) {
    case "price": return answer === "yes" ? { message: "Bỏ giới hạn giá", note: "Mình nới mức giá theo ý bạn." } : { message: "Xem tất cả bỉm", note: "Mình giữ nguyên mức giá và mở rộng theo cân nặng/size." };
    case "category": return answer === "yes" ? { message: "Tìm bỉm cho bé", note: "" } : null;
    case "brand_conflict": return answer === "yes" && previous?.constraints.excludedBrands?.length ? { message: `Vẫn tìm ${previous.constraints.excludedBrands[0]}`, note: "" } : answer === "no" ? { message: "Tìm bỉm cho bé", note: "Mình vẫn tránh thương hiệu đó." } : null;
    default: return null;
  }
}

/** Second-time wording for a clarification the family did not answer (never the same sentence twice). */
export const RETRY_WORDING: Record<PendingQuestion, { text: string; choices: string[] }> = {
  weight_or_size: { text: "Mình vẫn chưa có cân nặng hay size của bé nên chưa lọc được. Chọn nhanh một mức gần đúng nhé — sửa sau trong Gia đình cũng được.", choices: ["Bé ~7 kg (size M)", "Bé ~10 kg (size L)", "Bé ~13 kg (size XL)"] },
  member: { text: "Mình cần biết đang chọn cho bé nào để dùng đúng cân nặng. Bạn chạm vào tên bé nhé.", choices: [] },
  category: { text: "Hiện mình chỉ tư vấn được bỉm cho bé; các món khác sẽ mở dần. Bạn muốn xem bỉm luôn không?", choices: ["Tìm bỉm cho bé", "Để sau"] },
  brand_conflict: { text: "Thương hiệu này đang trong danh sách tránh của bé. Bạn chọn: vẫn tìm cho lần này, hay để mình gợi ý hãng khác?", choices: [] },
  price: { text: "Trong mức giá này chưa có lựa chọn phù hợp. Bạn muốn mình nới giá, hay xem lựa chọn gói nhỏ hơn?", choices: ["Bỏ giới hạn giá", "Xem tất cả bỉm"] },
};
