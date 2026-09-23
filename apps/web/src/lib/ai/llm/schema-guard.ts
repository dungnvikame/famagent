// Minimal JSON Schema check for the flat object schemas our agents use.
// json_object mode only guarantees syntactically valid JSON, so every model
// reply is checked here before callers trust it; anything off-shape → rules path.
import type { JsonSchema } from "./chat-json.ts";

type Property = { type?: string | string[]; enum?: unknown[] };

function matchesType(value: unknown, type: string): boolean {
  switch (type) {
    case "null": return value === null;
    case "string": return typeof value === "string";
    case "boolean": return typeof value === "boolean";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return Number.isInteger(value);
    case "array": return Array.isArray(value);
    case "object": return typeof value === "object" && value !== null && !Array.isArray(value);
    default: return false;
  }
}

/** True when `value` is an object with every required key present and each declared property matching its type/enum. */
export function matchesSchema(schema: JsonSchema, value: unknown): boolean {
  if (!matchesType(value, "object")) return false;
  const record = value as Record<string, unknown>;
  const properties = (schema.properties ?? {}) as Record<string, Property>;
  const required = (schema.required ?? []) as string[];
  if (required.some((key) => !(key in record))) return false;
  return Object.entries(properties).every(([key, property]) => {
    if (!(key in record)) return true;
    const item = record[key];
    const types = property.type === undefined ? [] : Array.isArray(property.type) ? property.type : [property.type];
    if (types.length && !types.some((type) => matchesType(item, type))) return false;
    return !property.enum || property.enum.includes(item);
  });
}
