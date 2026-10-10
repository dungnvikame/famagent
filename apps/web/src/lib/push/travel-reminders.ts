// Trip reminders (plan 261010-1335 acceptance #6): T-7 start packing, T-2 unpacked items + documents,
// the day after the return a wrap-up nudge. Pure; the cron route loads data, claims travel_push_log slots and sends.
import { countdownDays, tripPhase } from "../travel/trip-state.ts";
import type { Trip } from "../travel/types.ts";

export type TravelPushKind = "prep7" | "prep2" | "wrapup";
export interface TravelPush { tripId: string; kind: TravelPushKind; title: string; body: string; url: string; tag: string }

type TripSlice = Pick<Trip, "id" | "name" | "startDate" | "endDate" | "status" | "pushEnabled">;

/** Reminders due today for one family's trips; the (user, trip, kind, day) log keeps each one single-send. */
export function tripRemindersFor(trips: TripSlice[], packLeftByTrip: ReadonlyMap<string, number>, today: string): TravelPush[] {
  const out: TravelPush[] = [];
  for (const trip of trips) {
    if (!trip.pushEnabled || trip.status === "cancelled") continue;
    const countdown = countdownDays(trip, today);
    const left = packLeftByTrip.get(trip.id) ?? 0;
    if (countdown === 7) {
      out.push({ tripId: trip.id, kind: "prep7", title: `Còn 1 tuần đến chuyến ${trip.name} 🧳`, body: left > 0 ? `Checklist còn ${left} món chưa xếp — bắt đầu chuẩn bị dần từ hôm nay.` : "Bắt đầu chuẩn bị đồ dần — mở checklist để FamAgent gợi ý theo nhà mình.", url: `/travel/${trip.id}?tab=packing`, tag: `travel-prep7-${trip.id}` });
    } else if (countdown === 2) {
      out.push({ tripId: trip.id, kind: "prep2", title: `Còn 2 ngày đến chuyến ${trip.name} ⏳`, body: left > 0 ? `Còn ${left} món chưa xếp. Kiểm tra lại giấy tờ (khai sinh, BHYT, CCCD) lần cuối.` : "Đồ đã xếp xong — kiểm tra lại giấy tờ (khai sinh, BHYT, CCCD) lần cuối.", url: `/travel/${trip.id}?tab=${left > 0 ? "packing" : "overview"}`, tag: `travel-prep2-${trip.id}` });
    } else if (tripPhase(trip, today) === "done" && trip.status !== "done" && countdownDays({ startDate: trip.endDate }, today) === -1) {
      out.push({ tripId: trip.id, kind: "wrapup", title: `Về nhà rồi! Tổng kết ${trip.name}? 🧾`, body: "Ghi nốt các khoản chi còn thiếu để chốt chi phí chuyến đi so với ngân sách.", url: `/travel/${trip.id}?tab=money`, tag: `travel-wrapup-${trip.id}` });
    }
  }
  return out;
}
