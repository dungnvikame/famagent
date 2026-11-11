// Analytics event names accepted by /api/events. Every name the app emits (trackEvent in lib/experience/storage.ts,
// money-page `act`) must be listed: an unknown name is rejected with 400 and the event is lost silently on the client.
// tests/event-names.test.ts scans src for emitted names, so adding an event without listing it here fails the suite.
export const EVENT_NAMES = [
  // Onboarding and family profile
  "onboarding_started", "onboarding_slot_filled", "onboarding_slot_skipped", "onboarding_completed", "family_profile_update_started", "family_profile_created", "family_profile_updated",
  // Money
  "money_budget_deleted", "money_budget_saved", "money_category_added", "money_custom_split_saved", "money_goal_deleted", "money_goal_saved",
  "money_loan_saved", "money_method_chosen", "money_position_saved", "money_quick_ai_refined", "money_quick_parsed", "money_quick_saved",
  "money_debt_added", "money_debt_deleted", "money_period_paid", "money_period_skipped", "money_saving_set", "money_recurring_deleted",
  "money_recurring_saved", "money_transaction_deleted", "money_transaction_saved", "money_transaction_saved_monthly",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];
export const isEventName = (name: unknown): name is EventName => typeof name === "string" && (EVENT_NAMES as readonly string[]).includes(name);
