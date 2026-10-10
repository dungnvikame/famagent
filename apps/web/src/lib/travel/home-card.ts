// The one Home card for travel (plan 261010-1335 §4.8): the nearest trip, one context-aware action.
// No trip coming up = no card (never a nag). Pure; the Home brief adapts it into its card shape.
import { vndCompact } from "../money/format-vnd.ts";
import { countdownDays, nextAction, orderTrips, tripPhase, tripReadiness } from "./trip-state.ts";
import type { TravelState } from "./types.ts";

export interface TravelCard { tone: "warn" | "ok" | "info"; badge: string; title: string; detail: string; cta: { label: string; href: string }; /** Urgent cards go to the top of "Cần chú ý". */ urgent: boolean }

export function travelHomeCard(state: TravelState | null, today: string): TravelCard | null {
  if (!state?.trips.length) return null;
  const { active, past } = orderTrips(state.trips, today);
  const slices = (tripId: string) => ({
    itinerary: state.itinerary.filter((entry) => entry.tripId === tripId),
    packing: state.packing.filter((item) => item.tripId === tripId),
    expenses: state.expenses.filter((expense) => expense.tripId === tripId),
  });

  const trip = active[0];
  if (trip) {
    const { itinerary, packing, expenses } = slices(trip.id);
    const ready = tripReadiness(trip, itinerary, packing, expenses);
    const countdown = countdownDays(trip, today);
    if (tripPhase(trip, today) === "ongoing") {
      return { tone: "ok", badge: "✈️", title: `Đang trong chuyến ${trip.name}`, detail: "Ghi chi phí ngay lúc chi để về nhà khỏi phải nhớ lại — mỗi khoản vào thẳng sổ Tài chính.", cta: { label: "Ghi chi phí", href: `/travel/${trip.id}?tab=money` }, urgent: false };
    }
    if (countdown <= 2) {
      const docsLeft = packing.filter((item) => item.category === "documents" && item.status === "todo").length;
      const detail = ready.packLeft > 0 ? `Còn ${ready.packLeft} món chưa xếp${docsLeft ? `, ${docsLeft} giấy tờ chưa kiểm` : ""} — kiểm lần cuối trước ngày đi.` : "Tất cả đã sẵn sàng · kiểm tra lại giấy tờ lần cuối.";
      return { tone: ready.packLeft > 0 ? "warn" : "ok", badge: countdown <= 0 ? "Nay" : `${countdown}d`, title: `${trip.name} · ${countdown <= 0 ? "khởi hành hôm nay" : `còn ${countdown} ngày`}`, detail, cta: { label: ready.packLeft > 0 ? "Xếp nốt" : "Giấy tờ ✓", href: `/travel/${trip.id}?tab=${ready.packLeft > 0 ? "packing" : "overview"}` }, urgent: true };
    }
    const action = nextAction(ready, countdown);
    return { tone: countdown <= 7 ? "warn" : "info", badge: `${countdown}d`, title: `${trip.name} · còn ${countdown} ngày`, detail: ready.packTotal === 0 ? "Chưa có checklist đồ — để FamAgent gợi ý theo tuổi các bé và kiểu chuyến." : `${ready.packed}/${ready.packTotal} món đã xếp · lịch trình ${ready.daysPlanned}/${ready.daysTotal} ngày.`, cta: { label: action.label, href: `/travel/${trip.id}?tab=${action.tab}` }, urgent: countdown <= 7 };
  }

  // Just back (within 3 days of the return date): one wrap-up nudge, then the card disappears.
  const justBack = past.find((entry) => entry.status !== "cancelled" && entry.endDate < today && countdownDays({ startDate: entry.endDate }, today) >= -3);
  if (justBack) {
    const { expenses } = slices(justBack.id);
    const spent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const spentText = spent > 0 ? `Đã chi ${vndCompact(spent)}${justBack.budgetAmount > 0 ? `/${vndCompact(justBack.budgetAmount)} ngân sách` : ""}` : "Chưa ghi khoản chi nào";
    return { tone: "info", badge: "🧾", title: `Về nhà rồi! Tổng kết ${justBack.name}?`, detail: `${spentText} — ghi nốt khoản còn thiếu để chốt chuyến đi.`, cta: { label: "Tổng kết", href: `/travel/${justBack.id}?tab=money` }, urgent: false };
  }
  return null;
}
