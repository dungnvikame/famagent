// Travel domain types (plan 261010-1335-travel-feature). Pure data — pages, stores and tests all share this file,
// so imports stay relative with .ts extensions (node --test strips types but does not resolve "@/").

export const DEST_TYPES = ["beach", "mountain", "city", "hometown", "abroad", "other"] as const;
export type DestType = (typeof DEST_TYPES)[number];
export const DEST_TYPE_LABELS: Record<DestType, { label: string; emoji: string }> = {
  beach: { label: "Biển", emoji: "🏖️" },
  mountain: { label: "Núi", emoji: "⛰️" },
  city: { label: "Thành phố", emoji: "🏙️" },
  hometown: { label: "Về quê", emoji: "🏡" },
  abroad: { label: "Nước ngoài", emoji: "✈️" },
  other: { label: "Khác", emoji: "🧳" },
};

export const TRIP_STATUSES = ["planning", "ongoing", "done", "cancelled"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const EXPENSE_BUCKETS = ["transport", "lodging", "food", "activity", "misc"] as const;
export type ExpenseBucket = (typeof EXPENSE_BUCKETS)[number];
export const BUCKET_LABELS: Record<ExpenseBucket, string> = { transport: "Đi lại", lodging: "Lưu trú", food: "Ăn uống", activity: "Hoạt động", misc: "Dự phòng" };
/** Suggested split (percent of the trip budget), from the common 35/25/25/10/5 frame; the family can edit it. */
export const DEFAULT_BUDGET_SPLIT: Record<ExpenseBucket, number> = { transport: 35, lodging: 25, food: 25, activity: 10, misc: 5 };

export const PACKING_CATEGORIES = ["clothes", "kids", "health", "documents", "electronics", "food", "other"] as const;
export type PackingCategory = (typeof PACKING_CATEGORIES)[number];
export const PACKING_CATEGORY_LABELS: Record<PackingCategory, string> = {
  clothes: "Quần áo", kids: "Đồ bé", health: "Thuốc & y tế", documents: "Giấy tờ", electronics: "Điện tử", food: "Đồ ăn mang theo", other: "Khác",
};

export const PACKING_STATUSES = ["todo", "packed", "buy_there"] as const;
export type PackingStatus = (typeof PACKING_STATUSES)[number];

export const PACKING_SOURCES = ["manual", "template", "ai"] as const;
export type PackingSource = (typeof PACKING_SOURCES)[number];

export interface TripLink { label: string; url: string }

export interface Trip {
  id: string;
  name: string;
  destination: string;
  destType: DestType;
  /** YYYY-MM-DD. */
  startDate: string;
  endDate: string;
  status: TripStatus;
  /** VND. */
  budgetAmount: number;
  /** Percent per bucket; empty object = DEFAULT_BUDGET_SPLIT. */
  budgetSplit?: Partial<Record<ExpenseBucket, number>>;
  /** member_avatars ids (child uuid or adult id); empty = the whole family. */
  memberIds?: string[];
  links?: TripLink[];
  goalId?: string;
  /** T-7/T-2/T+1 reminders; on unless the family switches this trip off. */
  pushEnabled: boolean;
  note?: string;
}

export interface ItineraryEntry {
  id: string;
  tripId: string;
  /** YYYY-MM-DD within the trip, or undefined = not scheduled yet. */
  dayDate?: string;
  position: number;
  /** Free text: "08:00", "Chiều"… */
  timeLabel?: string;
  title: string;
  note?: string;
  url?: string;
  /** Planned cost in VND (0 = none); shown as "sắp chi" against the budget. */
  estAmount: number;
}

export interface PackingItem {
  id: string;
  tripId: string;
  name: string;
  qty: number;
  category: PackingCategory;
  /** member_avatars id; undefined = the whole family. */
  memberId?: string;
  status: PackingStatus;
  source: PackingSource;
}

export interface TripExpense {
  id: string;
  tripId: string;
  /** YYYY-MM-DD. */
  occurredOn: string;
  content: string;
  bucket: ExpenseBucket;
  /** VND. */
  amount: number;
  paidFrom?: string;
  /** The mirrored money_transactions row (Đợt 3); undefined until mirrored. */
  transactionId?: string;
}

/** Everything /api/travel returns in one request. */
export interface TravelState {
  trips: Trip[];
  itinerary: ItineraryEntry[];
  packing: PackingItem[];
  expenses: TripExpense[];
}
