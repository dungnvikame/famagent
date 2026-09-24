// Vietnamese wording for rules mode and for any LLM reply that fails checks.
// Each question asks one slot group with at most 2 questions (spec v1 §9).
import { childAgeMonths } from "../../experience/profile-mapper.ts";
import { PRICE_PREFERENCE_LABELS, SHOPPING_CONCERN_LABELS, WASHING_MACHINE_LABELS, type ChildProfile, type FamilyProfile } from "../../experience/types.ts";
import type { ActiveSlot } from "./slots.ts";
import { formatWeight } from "../../onboarding/questions.ts";

export interface PendingConfirmation { path: string; value: unknown; label: string }

const childLabel = (child?: ChildProfile, index = 0) => child?.name ? `bé ${child.name}` : index > 0 ? `bé thứ ${index + 1}` : "bé";

export function questionFor(slot: ActiveSlot, profile: FamilyProfile): string {
  const index = "childId" in slot ? profile.children.findIndex((child) => child.id === slot.childId) : -1;
  const child = index >= 0 ? profile.children[index] : undefined;
  switch (slot.kind) {
    case "household": return "Nhà mình có mấy người lớn và mấy bé? Bạn có thể bỏ qua nếu muốn.";
    case "child.basics": return `${child?.name ? `Bé ${child.name}` : index > 0 ? `Bé thứ ${index + 1}` : "Bé"} hiện nặng khoảng bao nhiêu kg, đang dùng bỉm size nào? Cho mình biết thêm tên gọi và tuổi nếu tiện.`;
    case "child.care": return `Khi chọn đồ cho ${childLabel(child, index)}, có lưu ý gì không — ví dụ da nhạy cảm, dễ hăm? Bé đang dùng hoặc muốn tránh thương hiệu nào?`;
    case "preferences": return "Khi mua đồ, bạn ưu tiên điều gì (giá thấp, giá trị tốt, cao cấp)? Có mức ngân sách tối đa thường dùng không?";
    case "home": return "Câu cuối: nhà mình dùng máy giặt cửa trước hay cửa trên? Mình hỏi để sau này chọn nước giặt phù hợp.";
    case "review": return "Mình đã có đủ thông tin ban đầu. Bạn xem lại tóm tắt bên dưới, cần sửa gì cứ nói; nếu ổn, nói “bắt đầu” để vào tư vấn.";
  }
}

export function quickRepliesFor(slot: ActiveSlot): string[] {
  switch (slot.kind) {
    case "household": return ["2 người lớn, 1 bé", "2 người lớn, 2 bé", "Bỏ qua"];
    case "child.basics": return ["Bé 10kg, size L", "Chưa biết size", "Bỏ qua"];
    case "child.care": return ["Da nhạy cảm", "Không có gì đặc biệt", "Bỏ qua"];
    case "preferences": return ["Ưu tiên giá trị tốt, dưới 400k", "Ưu tiên chống tràn", "Bỏ qua"];
    case "home": return ["Cửa trước", "Cửa trên", "Không dùng máy giặt"];
    case "review": return ["Bắt đầu", "Sửa ngân sách"];
  }
}

/** Why the required slot matters, shown once when the user skips it. */
export const REQUIRED_SKIP_NOTE = "Không sao. Chỉ cần cân nặng hoặc size là mình tránh được gợi ý sai cỡ — bạn có thể cho mình size đang dùng thay cho cân nặng. Nếu chưa tiện, mình sẽ hỏi lại lúc bạn tìm bỉm.";

export function confirmationQuestion(pending: PendingConfirmation[]): string {
  return `Mình ghi ${pending.map((item) => item.label).join(", ")} nhé? Bấm “Đúng” để lưu hoặc nói lại số chính xác.`;
}

export function acknowledgement(applied: string[]): string {
  return applied.length ? `Mình đã ghi nhận ${applied.slice(0, 4).join(", ")}${applied.length > 4 ? "…" : ""}.` : "";
}

/** Short readable summary for the review step. */
export function profileSummary(profile: FamilyProfile): string[] {
  const lines: string[] = [];
  if (profile.adultsCount) lines.push(`${profile.adultsCount} người lớn`);
  profile.children.forEach((child, index) => {
    const age = childAgeMonths(child);
    const details = [child.weightKg ? formatWeight(child.weightKg) : null, child.diaperSize ? `size ${child.diaperSize}` : null, age !== undefined ? `${age} tháng` : null].filter(Boolean);
    lines.push(`${childLabel(child, index).replace(/^b/, "B")}: ${details.length ? details.join(", ") : "chưa có cân nặng/size"}`);
  });
  // Only what the user actually said: the default price preference is not shown as a choice.
  const priorities = [profile.fieldMeta?.pricePreference ? PRICE_PREFERENCE_LABELS[profile.pricePreference] : null, profile.mainConcern ? SHOPPING_CONCERN_LABELS[profile.mainConcern] : null, profile.maxBudget ? `tối đa ${profile.maxBudget.toLocaleString("vi-VN")}đ` : null].filter(Boolean);
  if (priorities.length) lines.push(`Ưu tiên: ${priorities.join(", ")}`);
  if (profile.appliances?.washingMachine) lines.push(`Máy giặt: ${WASHING_MACHINE_LABELS[profile.appliances.washingMachine].toLowerCase()}`);
  return lines;
}

