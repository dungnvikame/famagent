// Analytics event names accepted by /api/events. Every name the app emits (trackEvent in lib/experience/storage.ts,
// money-page `act`) must be listed: an unknown name is rejected with 400 and the event is lost silently on the client.
// tests/event-names.test.ts scans src for emitted names, so adding an event without listing it here fails the suite.
export const EVENT_NAMES = [
  // Spec §41 + v1 §17 + onboarding funnel (funnel views in migration 202609240005 read these names)
  "homepage_view", "onboarding_started", "onboarding_slot_filled", "onboarding_slot_skipped", "onboarding_completed", "family_profile_update_started",
  "family_profile_created", "family_profile_updated", "child_weight_logged", "child_height_logged", "measure_reminder_set", "ai_message_sent", "intent_created", "recommendation_generated", "recommendation_viewed",
  "product_clicked", "product_saved", "compare_started", "product_compared", "offer_clicked",
  // Family notes, routine, care
  "family_note_recorded", "daily_task_done", "care_method_chosen",
  // Shopping
  "purchase_recorded", "stock_checked", "receipt_read", "ledger_linked",
  // Money
  "money_budget_deleted", "money_budget_saved", "money_category_added", "money_custom_split_saved", "money_goal_deleted", "money_goal_saved",
  "money_loan_saved", "money_method_chosen", "money_position_saved", "money_quick_ai_refined", "money_quick_parsed", "money_quick_saved",
  "money_debt_added", "money_period_paid", "money_period_skipped", "money_saving_set", "money_recurring_deleted", "money_recurring_saved", "money_settings_saved", "money_transaction_deleted", "money_transaction_saved", "money_transaction_saved_monthly",
  // Push
  "push_enabled", "push_disabled",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];
export const isEventName = (name: unknown): name is EventName => typeof name === "string" && (EVENT_NAMES as readonly string[]).includes(name);
