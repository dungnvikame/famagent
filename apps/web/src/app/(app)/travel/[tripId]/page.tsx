import { TripWorkspace } from "@/components/travel/trip-workspace";

export const metadata = { title: "FamAgent | Chuyến đi" };

/** One trip's workspace: Tổng quan · Lịch trình · Đồ đạc · Chi phí. */
export default async function Page({ params }: { params: Promise<{ tripId: string }> }) {
  return <TripWorkspace tripId={(await params).tripId} />;
}
