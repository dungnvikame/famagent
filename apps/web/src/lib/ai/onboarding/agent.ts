// Onboarding agent turn: the LLM (when allowed) extracts facts and drafts a reply;
// code validates every value, decides confirmations, slot progress and the next question.
import { chatJson, type ChatMessage } from "../llm/index.ts";
import { stampChanges } from "../../experience/profile-meta.ts";
import { validBirthDate, INPUT_BIRTH_YEARS } from "../../experience/validate.ts";
import { DELIVERY_PREFERENCES, DIAPER_SIZES, PRICE_PREFERENCES, SENSITIVITIES, SHOPPING_CONCERNS, WASHING_MACHINES, type ChildProfile, type FamilyProfile, type FieldSource } from "../../experience/types.ts";
import { emptyExtraction, turnSchema, type Extraction, type TurnOutput } from "./extraction.ts";
import { extractRules } from "./extract-rules.ts";
import { markSlot, nextSlot, slotId, slotSatisfied, type ActiveSlot, type SlotKind } from "./slots.ts";
import { acknowledgement, confirmationQuestion, profileSummary, questionFor, quickRepliesFor, REQUIRED_SKIP_NOTE, type PendingConfirmation } from "./templates.ts";

export type { PendingConfirmation } from "./templates.ts";
export interface HistoryItem { role: "user" | "assistant"; text: string; slot?: string }

export interface OnboardingTurnInput {
  message: string;
  profile: FamilyProfile;
  history: HistoryItem[];
  pending: PendingConfirmation[];
  /** Consent + configuration + rate limit already checked by the caller. */
  allowAi: boolean;
  now?: Date;
}

export interface OnboardingTurnResult {
  profile: FamilyProfile;
  reply: string;
  quickReplies: string[];
  activeSlot: string;
  pending: PendingConfirmation[];
  summary: string[];
  done: boolean;
  mode: "ai" | "rules";
}

type Update = { path: string; value: unknown; label: string };
type Chat = typeof chatJson;

const FIELD_SLOT: Record<string, SlotKind> = {
  adultsCount: "household", childrenCount: "household",
  childName: "child.basics", birthDate: "child.basics", ageMonths: "child.basics", weightKg: "child.basics", diaperSize: "child.basics",
  sensitivities: "child.care", currentBrand: "child.care", preferredBrands: "child.care", dislikedBrands: "child.care",
  pricePreference: "preferences", maxBudget: "preferences", mainConcern: "preferences", deliveryPreference: "preferences", avoidedIngredients: "preferences",
  washingMachine: "home",
};
const CHILD_FIELDS = new Set(["childName", "birthDate", "ageMonths", "weightKg", "diaperSize", "sensitivities", "currentBrand", "preferredBrands", "dislikedBrands"]);
const pathField = (path: string) => path.split(".").at(-1) ?? path;

// ---------- PII masking (spec v1 §6.2): child names never reach the provider ----------

function maskNames(names: string[]) {
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const mask = (text: string) => escaped.reduce((out, name, index) => out.replace(new RegExp(`(?<![\\p{L}])${name}(?![\\p{L}])`, "giu"), `[BE_${index + 1}]`), text);
  const unmask = (text: string) => text.replace(/\[BE_(\d+)\]/g, (placeholder, index) => names[Number(index) - 1] ?? placeholder);
  return { mask, unmask };
}

// Words that follow "bé/con" but are not names ("bé trai", "con mình", "bé nặng").
const NOT_NAMES = new Set([
  "trai", "gái", "mình", "em", "tôi", "nhà", "nặng", "được", "đang", "mới", "hay", "hơi", "dưới", "trên", "lớn", "nhỏ", "út", "đầu", "thứ", "sinh", "dùng",
  "bị", "có", "là", "này", "ấy", "cả", "hai", "ba", "một", "khoảng", "tầm", "chắc", "hình", "hiện", "da", "thích", "tránh", "cần", "rất", "không", "chưa",
  "bé", "con", "cháu", "tên", "vẫn", "cũng", "thì", "mặc", "size", "cỡ", "cân", "tháng", "tuổi", "ngủ", "đêm", "ban", "hăm", "dễ", "và", "với", "của", "cho", "nay", "giờ", "năm",
]);

/**
 * Likely child names in a message, case-insensitive, for masking only (over-masking is safe).
 * Names without a cue ("Gold 10kg") can still slip through — disclosed in the consent text.
 */
function nameCandidates(message: string): string[] {
  return [...message.matchAll(/(?:tên(?:\s+(?:bé|con|cháu))?(?:\s+là)?|gọi\s+là|bé|con|cháu)\s+([\p{L}]{2,24})/giu)].map((match) => match[1]).filter((word) => !NOT_NAMES.has(word.toLocaleLowerCase("vi")));
}

const PLACEHOLDER = /\[BE_\d+\]/;

/**
 * Restores names in every string field the model returned; unresolved placeholders become null.
 * Masking is deliberately wide (over-masking is safe), so a placeholder may stand for an ordinary
 * word — childName/childRef therefore only accept names already in the profile or found by the rules.
 */
function unmaskOutput(output: TurnOutput, unmask: (text: string) => string, trustedNames: string[]): TurnOutput {
  const restore = (value: string | null) => { if (value === null) return null; const text = unmask(value); return PLACEHOLDER.test(text) ? null : text; };
  const trusted = new Set(trustedNames.map((name) => name.toLocaleLowerCase("vi")));
  const restoreName = (value: string | null) => { const text = restore(value); return text && (!PLACEHOLDER.test(value ?? "") || trusted.has(text.toLocaleLowerCase("vi"))) ? text : null; };
  const restoreList = (list: string[] | null) => list?.map((item) => restore(item)).filter((item): item is string => item !== null) ?? null;
  return {
    ...output, childRef: restoreName(output.childRef), childName: restoreName(output.childName), currentBrand: restore(output.currentBrand),
    preferredBrands: restoreList(output.preferredBrands), dislikedBrands: restoreList(output.dislikedBrands), avoidedIngredients: restoreList(output.avoidedIngredients),
    reply: output.reply ? unmask(output.reply) : null,
  };
}

// ---------- Extraction merge (P1 carry-over: AI wins only on non-null) ----------

function hasData(extraction: Extraction): boolean {
  return Object.entries(extraction).some(([key, value]) => !["uncertainFields", "childRef"].includes(key) && value !== null && value !== false && !(Array.isArray(value) && !value.length));
}

function mergeExtraction(ai: Extraction | null, rules: Extraction): Extraction {
  if (!ai) return rules;
  const merged = emptyExtraction();
  for (const key of Object.keys(merged) as (keyof Extraction)[]) {
    if (key === "uncertainFields") continue;
    const aiValue = Array.isArray(ai[key]) && !(ai[key] as unknown[]).length ? null : ai[key];
    const ruleValue = rules[key];
    (merged as unknown as Record<string, unknown>)[key] = typeof aiValue === "boolean" ? aiValue || Boolean(ruleValue) : aiValue ?? ruleValue;
  }
  // Tentative if the AI flagged a value it supplied, or the rules saw a hedge (never let AI erase a hedge — spec v1 §3).
  const aiFlagged = ai.uncertainFields.filter((key) => ai[key as keyof Extraction] !== null && ai[key as keyof Extraction] !== undefined);
  merged.uncertainFields = [...new Set([...aiFlagged, ...rules.uncertainFields])];
  return merged;
}

// ---------- Validation of individual values (never trust extractor output) ----------

const cleanText = (value: unknown, max = 40) => typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
const cleanList = (value: unknown) => Array.isArray(value) ? [...new Set(value.map((item) => cleanText(item)).filter((item): item is string => Boolean(item)))].slice(0, 10) : null;
const oneOf = (list: readonly string[], value: unknown) => typeof value === "string" && list.includes(value);
const inRange = (value: unknown, min: number, max: number, integer = false) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value));

function childUpdates(extraction: Extraction, childId: string, now: Date): Update[] {
  const base = `children.${childId}`;
  const updates: Update[] = [];
  const name = cleanText(extraction.childName, 30);
  if (name) updates.push({ path: `${base}.name`, value: name, label: `tên gọi ${name}` });
  if (extraction.birthDate && validBirthDate(extraction.birthDate, now, INPUT_BIRTH_YEARS)) updates.push({ path: `${base}.birthDate`, value: extraction.birthDate, label: `ngày sinh ${extraction.birthDate.split("-").reverse().join("/")}` });
  else if (inRange(extraction.ageMonths, 0, 72, true)) updates.push({ path: `${base}.ageMonths`, value: extraction.ageMonths, label: `${extraction.ageMonths} tháng tuổi` });
  if (inRange(extraction.weightKg, 2, 30)) updates.push({ path: `${base}.weightKg`, value: Math.round(extraction.weightKg! * 10) / 10, label: `cân nặng ${extraction.weightKg} kg` });
  const size = typeof extraction.diaperSize === "string" ? extraction.diaperSize.toUpperCase() : null;
  if (size && (DIAPER_SIZES as readonly string[]).includes(size)) updates.push({ path: `${base}.diaperSize`, value: size, label: `size ${size}` });
  const sensitivities = Array.isArray(extraction.sensitivities) ? [...new Set(extraction.sensitivities.filter((item) => oneOf(SENSITIVITIES, item)))] : [];
  if (sensitivities.length) updates.push({ path: `${base}.sensitivities`, value: sensitivities, label: "lưu ý về da" });
  const brand = cleanText(extraction.currentBrand);
  if (brand) updates.push({ path: `${base}.currentBrand`, value: brand, label: `đang dùng ${brand}` });
  const liked = cleanList(extraction.preferredBrands);
  if (liked?.length) updates.push({ path: `${base}.preferredBrands`, value: liked, label: `thích ${liked.join(", ")}` });
  const disliked = cleanList(extraction.dislikedBrands);
  if (disliked?.length) updates.push({ path: `${base}.dislikedBrands`, value: disliked, label: `tránh ${disliked.join(", ")}` });
  return updates;
}

function familyUpdates(extraction: Extraction): Update[] {
  const updates: Update[] = [];
  if (inRange(extraction.adultsCount, 1, 10, true)) updates.push({ path: "adultsCount", value: extraction.adultsCount, label: `${extraction.adultsCount} người lớn` });
  if (oneOf(PRICE_PREFERENCES, extraction.pricePreference)) updates.push({ path: "pricePreference", value: extraction.pricePreference, label: "ưu tiên giá" });
  if (inRange(extraction.maxBudget, 50_000, 100_000_000, true)) updates.push({ path: "maxBudget", value: extraction.maxBudget, label: `ngân sách ${extraction.maxBudget!.toLocaleString("vi-VN")}đ` });
  if (oneOf(SHOPPING_CONCERNS, extraction.mainConcern)) updates.push({ path: "mainConcern", value: extraction.mainConcern, label: "điều quan trọng nhất" });
  if (oneOf(DELIVERY_PREFERENCES, extraction.deliveryPreference)) updates.push({ path: "deliveryPreference", value: extraction.deliveryPreference, label: "ưu tiên giao hàng" });
  const avoided = cleanList(extraction.avoidedIngredients);
  if (avoided?.length) updates.push({ path: "avoidedIngredients", value: avoided, label: `tránh ${avoided.join(", ")}` });
  if (oneOf(WASHING_MACHINES, extraction.washingMachine)) updates.push({ path: "appliances.washingMachine", value: extraction.washingMachine, label: "loại máy giặt" });
  return updates;
}

// ---------- Applying updates ----------

function readPath(profile: FamilyProfile, path: string): unknown {
  const [head, childId, field] = path.split(".");
  if (head === "children") return profile.children.find((child) => child.id === childId)?.[field as keyof ChildProfile];
  if (head === "appliances") return profile.appliances?.washingMachine;
  return profile[head as keyof FamilyProfile];
}

function applyUpdates(profile: FamilyProfile, updates: Update[]): FamilyProfile {
  const next: FamilyProfile = { ...profile, children: profile.children.map((child) => ({ ...child })) };
  for (const { path, value } of updates) {
    const [head, childId, field] = path.split(".");
    if (head === "children") {
      const child = next.children.find((item) => item.id === childId);
      if (child) Object.assign(child, { [field]: value }, field === "birthDate" ? { ageMonths: undefined } : {});
    } else if (head === "appliances") next.appliances = { washingMachine: value as NonNullable<FamilyProfile["appliances"]>["washingMachine"] };
    else Object.assign(next, { [head]: value });
  }
  return next;
}

function applyWithSource(profile: FamilyProfile, updates: Update[], source: FieldSource, now: string): FamilyProfile {
  return updates.length ? stampChanges(profile, applyUpdates(profile, updates), source, now) : profile;
}

/**
 * Pending confirmations round-trip through the client, so they are untrusted: only known
 * profile paths are accepted and each value is re-validated by the same rules as fresh input.
 */
function acceptPending(pending: PendingConfirmation[], profile: FamilyProfile, now: Date): Update[] {
  return pending.slice(0, 10).flatMap((item) => {
    if (typeof item?.path !== "string") return [];
    const [head, childId, field] = item.path.split(".");
    if (head === "children") {
      if (!profile.children.some((child) => child.id === childId) || !CHILD_FIELDS.has(field === "name" ? "childName" : field)) return [];
      const probe = { ...emptyExtraction(), [field === "name" ? "childName" : field]: item.value };
      return childUpdates(probe, childId, now).filter((update) => update.path === item.path);
    }
    const probe = { ...emptyExtraction(), [item.path === "appliances.washingMachine" ? "washingMachine" : head]: item.value };
    return familyUpdates(probe).filter((update) => update.path === item.path);
  });
}

/** Picks (or creates) the child the message is about. */
function resolveChild(profile: FamilyProfile, extraction: Extraction, active: ActiveSlot): { profile: FamilyProfile; childId?: string } {
  const named = extraction.childRef ?? extraction.childName;
  const byName = named ? profile.children.find((child) => child.name?.toLocaleLowerCase("vi") === named.toLocaleLowerCase("vi")) : undefined;
  if (byName) return { profile, childId: byName.id };
  let children = profile.children;
  const wanted = inRange(extraction.childrenCount, 1, 5, true) ? extraction.childrenCount! : 0;
  const hasChildData = [...CHILD_FIELDS].some((field) => { const value = extraction[field as keyof Extraction]; return value !== null && !(Array.isArray(value) && !value.length); });
  const activeChild = "childId" in active ? children.find((child) => child.id === active.childId) : undefined;
  // A new name while the current child is already named refers to another child: reuse the first
  // declared-but-unnamed child ("2 bé") before creating a new one.
  const namesAnother = Boolean(extraction.childName && activeChild?.name);
  const unnamed = namesAnother ? children.find((child) => !child.name && child.id !== activeChild?.id) : undefined;
  const isNewChild = namesAnother && !unnamed && children.length < 5;
  const target = Math.max(wanted, children.length + (isNewChild ? 1 : 0), hasChildData ? 1 : 0);
  if (target > children.length) children = [...children, ...Array.from({ length: target - children.length }, () => ({ id: crypto.randomUUID() }))];
  const updated = children === profile.children ? profile : { ...profile, children };
  const childId = unnamed?.id ?? (isNewChild ? children[children.length - 1].id : activeChild?.id ?? children.find((child) => !slotSatisfied({ kind: "child.basics", childId: child.id, required: true }, updated))?.id ?? children[0]?.id);
  return { profile: updated, childId };
}

// ---------- LLM prompt ----------

function systemPrompt(active: ActiveSlot, profile: FamilyProfile, now: Date): string {
  // completedSlots come from the client: only known slot kinds may reach the system prompt (spec v1 §19).
  const kinds = new Set(["household", "child.basics", "child.care", "preferences", "home"]);
  const doneKinds = [...new Set((profile.onboarding?.completedSlots ?? []).map((id) => id.split(":")[0]).filter((kind) => kinds.has(kind)))];
  const done = doneKinds.length ? doneKinds.join(", ") : "chưa có";
  return [
    "Bạn là trợ lý onboarding của Family AI, giúp gia đình Việt Nam có con nhỏ mua đồ tiêu hao. Nhiệm vụ: hiểu câu trả lời của người dùng về gia đình và soạn câu hỏi tiếp theo.",
    "Quy tắc trích xuất: chỉ điền trường người dùng nói rõ trong tin nhắn cuối; không đoán, không suy ra từ tuổi; trường không có để null. Tiền đổi sang VND (400k = 400000). birthDate dạng YYYY-MM-DD chỉ khi có đủ ngày tháng năm; chỉ có tháng/năm thì tính ageMonths. Tên bé có thể xuất hiện dạng [BE_n]; giữ nguyên placeholder trong childRef và reply.",
    "Nếu người dùng nói không chắc (chắc, khoảng, tầm, hình như) về cân nặng, size hay tuổi của bé, thêm tên trường vào uncertainFields. skip=true khi họ muốn bỏ qua/không nhớ; nothing=true khi trả lời 'không có gì đặc biệt'; confirm=true khi họ đồng ý ('đúng', 'ok'); correction=true khi họ sửa thông tin trước đó.",
    "Quy tắc trả lời (reply): tiếng Việt, xưng 'mình', gọi 'bạn', thân thiện, tối đa 2 câu hỏi, không quá 3 câu; ghi nhận ngắn điều vừa nghe rồi hỏi nhóm thông tin tiếp theo. Không tư vấn hay nhắc tên sản phẩm, không nói về sức khỏe/điều trị. askingSlot là nhóm bạn hỏi trong reply.",
    "Các nhóm theo thứ tự: household (số người lớn, số bé) → child.basics (tên gọi, tuổi/ngày sinh, cân nặng, size bỉm — cân nặng hoặc size là bắt buộc) → child.care (da nhạy cảm, dễ hăm, thương hiệu đang dùng/thích/tránh) → preferences (ưu tiên giá, ngân sách, giao hàng, điều quan trọng) → home (máy giặt cửa trước/cửa trên) → review.",
    `Hôm nay: ${now.toISOString().slice(0, 10)}. Nhóm đang hỏi: ${active.kind}. Đã xong: ${done}. Số bé đã biết: ${profile.children.length}.`,
  ].join("\n");
}

/**
 * The LLM reply is used only if it asks the slot code chose, stays short (≤2 questions) and
 * every number it mentions is one we actually saved — so it cannot acknowledge a value the
 * validators dropped (e.g. "45kg").
 */
function replyUsable(output: TurnOutput | null, next: ActiveSlot, saved: Update[]): output is TurnOutput & { reply: string } {
  if (!output?.reply) return false;
  const reply = output.reply.trim();
  const savedNumbers = new Set(saved.flatMap((update) => update.label.match(/\d+(?:[.,]\d+)*/g) ?? []));
  const mentioned = reply.match(/\d+(?:[.,]\d+)*/g) ?? [];
  return output.askingSlot === next.kind && reply.length > 0 && reply.length <= 400 && (reply.match(/\?/g) ?? []).length <= 2
    && !/https?:\/\//.test(reply) && mentioned.every((number) => savedNumbers.has(number));
}

// ---------- Turn ----------

export async function runOnboardingTurn(input: OnboardingTurnInput, chat: Chat = chatJson): Promise<OnboardingTurnResult> {
  const now = input.now ?? new Date();
  const stamp = now.toISOString();
  const active = nextSlot(input.profile);
  const rules = extractRules(input.message, now);

  const known = input.profile.children.map((child) => child.name).filter((name): name is string => Boolean(name));
  const recent = [input.message, ...input.history.slice(-6).map((item) => item.text)].flatMap(nameCandidates);
  const names = [...new Set([...known, ...recent].map((name) => name.trim()))];
  const { mask, unmask } = maskNames(names);
  const history: ChatMessage[] = input.history.slice(-6).map((item) => ({ role: item.role, content: mask(item.text).slice(0, 600) }));
  const raw = input.allowAi ? (await chat<TurnOutput>({ name: "onboarding_turn", system: systemPrompt(active, input.profile, now), messages: [...history, { role: "user", content: mask(input.message) }], schema: turnSchema }))?.data ?? null : null;
  const ai = raw ? unmaskOutput(raw, unmask, [...known, ...(rules.childName ? [rules.childName] : [])]) : null;
  const aiUseful = Boolean(ai && hasData(ai));
  const extraction = mergeExtraction(aiUseful ? ai : null, rules);

  let profile = input.profile;
  // 1. Pending confirmations: accepted → saved as user_confirmed; anything else drops them.
  if (input.pending.length && extraction.confirm) profile = applyWithSource(profile, acceptPending(input.pending, profile, now), "user_confirmed", stamp);

  // 2. New facts from this message.
  const resolved = resolveChild(profile, extraction, active);
  profile = resolved.profile;
  const candidates = [...familyUpdates(extraction), ...(resolved.childId ? childUpdates(extraction, resolved.childId, now) : [])];
  const pending: PendingConfirmation[] = [];
  const certain: Update[] = [];
  for (const update of candidates) {
    const field = pathField(update.path);
    const current = readPath(profile, update.path);
    const conflicts = current !== undefined && JSON.stringify(current) !== JSON.stringify(update.value) && Boolean(profile.fieldMeta?.[update.path]) && !extraction.correction;
    if (extraction.uncertainFields.includes(field === "name" ? "childName" : field) || conflicts) pending.push(conflicts ? { ...update, label: `${update.label} (thay cho thông tin cũ)` } : update);
    else certain.push(update);
  }
  profile = applyWithSource(profile, certain, "user_entered", stamp);

  // 3. Slot progress for the slot we asked about.
  let skipNote = "";
  let reask = false;
  // "Sửa lại" on a pending confirmation without a new value: ask for the exact value, keep the slot.
  const correctingPending = input.pending.length > 0 && !extraction.confirm && !candidates.length;
  if (active.kind !== "review" && !correctingPending) {
    const answeredHere = [...certain, ...pending].some((update) => FIELD_SLOT[pathField(update.path) === "name" ? "childName" : pathField(update.path)] === active.kind) || (active.kind === "household" && extraction.childrenCount !== null);
    // Child slots created before any child existed get the child resolved this turn.
    const slot = active.kind === "child.basics" || active.kind === "child.care" ? { ...active, childId: active.childId ?? resolved.childId } : active;
    if (extraction.skip && !answeredHere) {
      // Required slot: explain once and offer size instead of weight; only a second skip moves on.
      const explained = input.history.some((item) => item.role === "assistant" && item.slot === slotId(slot) && item.text.includes(REQUIRED_SKIP_NOTE));
      if (!slot.required || explained) profile = markSlot(profile, slot, "skipped");
      else skipNote = REQUIRED_SKIP_NOTE;
    } else if (extraction.nothing && !answeredHere) {
      profile = slot.required ? profile : markSlot(profile, slot, "completed");
      reask = slot.required;
    } else if (answeredHere) {
      if (!slot.required || slotSatisfied(slot, profile)) profile = markSlot(profile, slot, "completed");
    } else if (!certain.length && !pending.length && !(input.pending.length && extraction.confirm)) {
      // Nothing understood: re-ask once, then move on from optional slots.
      const askedBefore = input.history.filter((item) => item.role === "assistant" && item.slot === slotId(slot)).length >= 2;
      if (askedBefore && !slot.required) profile = markSlot(profile, slot, "skipped");
      else reask = true;
    }
  }

  const next = nextSlot(profile);
  const summary = profileSummary(profile);
  const mode = aiUseful ? "ai" : "rules";
  const nextId = next.kind === "review" ? "review" : slotId(next);
  if (pending.length) {
    return { profile, reply: [acknowledgement(certain.map((item) => item.label)), confirmationQuestion(pending)].filter(Boolean).join(" "), quickReplies: ["Đúng", "Sửa lại"], activeSlot: active.kind === "review" ? "review" : slotId(active), pending, summary, done: false, mode };
  }
  if (correctingPending) return { profile, reply: "Bạn nói lại giúp mình con số chính xác nhé.", quickReplies: quickRepliesFor(next), activeSlot: nextId, pending: [], summary, done: false, mode };
  const template = [acknowledgement(certain.map((item) => item.label)), skipNote, reask ? `Mình chưa nắm rõ ý bạn. ${questionFor(next, profile)}` : questionFor(next, profile)].filter(Boolean).join(" ");
  const reply = aiUseful && !skipNote && !reask && replyUsable(ai, next, certain) ? ai.reply.trim() : template;
  return { profile, reply, quickReplies: quickRepliesFor(next), activeSlot: nextId, pending: [], summary, done: next.kind === "review", mode };
}
