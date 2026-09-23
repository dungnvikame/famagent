// One extraction contract for both the LLM and the rule parser. Every field is null
// unless the user stated it; code validates values before they touch the profile.
import { DELIVERY_PREFERENCES, DIAPER_SIZES, PRICE_PREFERENCES, SENSITIVITIES, SHOPPING_CONCERNS, WASHING_MACHINES } from "../../experience/types.ts";
import type { DeliveryPreference, PricePreference, Sensitivity, ShoppingConcern, WashingMachine } from "../../experience/types.ts";
import type { JsonSchema } from "../llm/index.ts";

export interface Extraction {
  adultsCount: number | null;
  childrenCount: number | null;
  /** Name (or [BE_n] placeholder) of the child the details refer to. */
  childRef: string | null;
  childName: string | null;
  birthDate: string | null;
  ageMonths: number | null;
  weightKg: number | null;
  diaperSize: string | null;
  sensitivities: Sensitivity[] | null;
  currentBrand: string | null;
  preferredBrands: string[] | null;
  dislikedBrands: string[] | null;
  pricePreference: PricePreference | null;
  maxBudget: number | null;
  mainConcern: ShoppingConcern | null;
  deliveryPreference: DeliveryPreference | null;
  avoidedIngredients: string[] | null;
  washingMachine: WashingMachine | null;
  /** Fields the user stated tentatively ("chắc tầm 10kg") — confirmed before saving (spec v1 §3). */
  uncertainFields: string[];
  /** "bỏ qua", "không nhớ", "để sau". */
  skip: boolean;
  /** "không có", "bình thường" — a valid answer with nothing to record. */
  nothing: boolean;
  /** "đúng", "ok" — accepts pending confirmations. */
  confirm: boolean;
  /** Explicit correction ("à 11kg chứ", "nhầm") — may overwrite a confirmed value. */
  correction: boolean;
}

export const emptyExtraction = (): Extraction => ({
  adultsCount: null, childrenCount: null, childRef: null, childName: null, birthDate: null, ageMonths: null, weightKg: null, diaperSize: null,
  sensitivities: null, currentBrand: null, preferredBrands: null, dislikedBrands: null, pricePreference: null, maxBudget: null, mainConcern: null,
  deliveryPreference: null, avoidedIngredients: null, washingMachine: null, uncertainFields: [], skip: false, nothing: false, confirm: false, correction: false,
});

const nullable = (type: string, extra: Record<string, unknown> = {}) => ({ type: [type, "null"], ...extra });
const nullableEnum = (values: readonly string[]) => ({ type: ["string", "null"], enum: [...values, null] });
const stringList = { type: ["array", "null"], items: { type: "string" } };

export const EXTRACTION_FIELDS = ["adultsCount", "childrenCount", "childName", "birthDate", "ageMonths", "weightKg", "diaperSize", "sensitivities", "currentBrand", "preferredBrands", "dislikedBrands", "pricePreference", "maxBudget", "mainConcern", "deliveryPreference", "avoidedIngredients", "washingMachine"] as const;

/** LLM output = extraction + proposed reply for the slot it thinks comes next. */
export const turnSchema: JsonSchema = {
  type: "object", additionalProperties: false,
  properties: {
    adultsCount: nullable("integer"), childrenCount: nullable("integer"), childRef: nullable("string"), childName: nullable("string"),
    birthDate: nullable("string"), ageMonths: nullable("integer"), weightKg: nullable("number"), diaperSize: nullableEnum(DIAPER_SIZES),
    sensitivities: { type: ["array", "null"], items: { type: "string", enum: [...SENSITIVITIES] } }, currentBrand: nullable("string"),
    preferredBrands: stringList, dislikedBrands: stringList, pricePreference: nullableEnum(PRICE_PREFERENCES), maxBudget: nullable("integer"),
    mainConcern: nullableEnum(SHOPPING_CONCERNS), deliveryPreference: nullableEnum(DELIVERY_PREFERENCES), avoidedIngredients: stringList,
    washingMachine: nullableEnum(WASHING_MACHINES),
    uncertainFields: { type: "array", items: { type: "string", enum: [...EXTRACTION_FIELDS] } },
    skip: { type: "boolean" }, nothing: { type: "boolean" }, confirm: { type: "boolean" }, correction: { type: "boolean" },
    askingSlot: { type: ["string", "null"] }, reply: { type: ["string", "null"] },
  },
  required: ["adultsCount", "childrenCount", "childRef", "childName", "birthDate", "ageMonths", "weightKg", "diaperSize", "sensitivities", "currentBrand", "preferredBrands", "dislikedBrands", "pricePreference", "maxBudget", "mainConcern", "deliveryPreference", "avoidedIngredients", "washingMachine", "uncertainFields", "skip", "nothing", "confirm", "correction", "askingSlot", "reply"],
};

export type TurnOutput = Extraction & { askingSlot: string | null; reply: string | null };
