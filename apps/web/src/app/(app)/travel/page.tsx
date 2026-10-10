import { TravelPage } from "@/components/travel/travel-page";

export const metadata = { title: "FamAgent | Chuyến đi" };

/** Travel is not a nav tab: families reach it from the Home card and the Gia đình page. */
export default function Page() {
  return <TravelPage />;
}
