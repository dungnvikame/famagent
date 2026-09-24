// Structured JSON completion over a provider chain. Callers get `null` whenever
// no provider produced valid JSON in time and must fall back to rule-based logic.
import { getProviders, isAiConfigured, type JsonMode, type LlmProvider } from "./providers.ts";
import { matchesSchema } from "./schema-guard.ts";

export type JsonSchema = Record<string, unknown>;
/** OpenAI-compatible content parts; image parts carry a data: URL (vision-capable providers only). */
export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export interface ChatMessage { role: "user" | "assistant"; content: string | ContentPart[] }

export interface ChatJsonRequest<T> {
  /** Schema name, [a-z0-9_]. */
  name: string;
  system: string;
  messages: ChatMessage[];
  schema: JsonSchema;
  /** Extra check on top of the built-in schema check; failing it counts as a bad response. */
  validate?: (value: unknown) => value is T;
  /** Total budget across all providers. */
  timeoutMs?: number;
}

export interface ChatJsonResult<T> { data: T; provider: string }

export interface ChatJsonDeps {
  fetch: typeof fetch;
  providers: LlmProvider[];
  enabled: boolean;
  now: () => number;
  timeoutSignal: (ms: number) => AbortSignal;
  log: (entry: Record<string, string | number>) => void;
}

const defaultDeps = (): ChatJsonDeps => ({
  fetch: globalThis.fetch,
  providers: getProviders(),
  enabled: isAiConfigured(),
  now: Date.now,
  timeoutSignal: (ms) => AbortSignal.timeout(ms),
  // Metadata only — never log user content.
  log: (entry) => console.warn("[llm]", JSON.stringify(entry)),
});

const RETRY_NOTE = "Phản hồi trước không phải JSON hợp lệ theo schema. Chỉ trả về đúng một JSON object theo schema, không thêm chữ nào khác.";

type Attempt = { ok: true; value: unknown } | { ok: false; reason: string; status?: number };

function body(provider: LlmProvider, request: ChatJsonRequest<unknown>, mode: JsonMode, retry: boolean) {
  // Without native json_schema support the schema travels in the system prompt; code validation stays the gate.
  const system = mode === "json_schema" ? request.system
    : `${request.system}\n\nChỉ trả về một JSON object hợp lệ theo JSON Schema sau, không kèm giải thích:\n${JSON.stringify(request.schema)}`;
  return {
    model: provider.model,
    temperature: 0.2,
    messages: [{ role: "system", content: system }, ...request.messages, ...(retry ? [{ role: "user", content: RETRY_NOTE }] : [])],
    response_format: mode === "json_schema"
      ? { type: "json_schema", json_schema: { name: request.name, strict: true, schema: request.schema } }
      : { type: "json_object" },
  };
}

async function attempt(provider: LlmProvider, request: ChatJsonRequest<unknown>, mode: JsonMode, retry: boolean, timeoutMs: number, deps: ChatJsonDeps): Promise<Attempt> {
  try {
    const response = await deps.fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body(provider, request, mode, retry)),
      signal: deps.timeoutSignal(timeoutMs),
    });
    if (!response.ok) return { ok: false, reason: "http", status: response.status };
    const data = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
    const text = data.choices?.[0]?.message?.content;
    if (!text) return { ok: false, reason: "empty" };
    // Some models wrap JSON in a markdown fence despite instructions.
    const value: unknown = JSON.parse(text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
    if (!matchesSchema(request.schema, value) || (request.validate && !request.validate(value))) return { ok: false, reason: "invalid" };
    return { ok: true, value };
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : "";
    return { ok: false, reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : name === "SyntaxError" ? "parse" : "network" };
  }
}

export async function chatJson<T>(request: ChatJsonRequest<T>, overrides: Partial<ChatJsonDeps> = {}): Promise<ChatJsonResult<T> | null> {
  const deps = { ...defaultDeps(), ...overrides };
  if (!deps.enabled || !deps.providers.length) return null;
  const deadline = deps.now() + (request.timeoutMs ?? 9000);
  for (const [index, provider] of deps.providers.entries()) {
    let mode = provider.jsonMode;
    let retry = false;
    // One retry per provider: downgrade json_schema on 400, or re-ask once after bad JSON.
    for (let tries = 0; tries < 2; tries++) {
      const remaining = deadline - deps.now();
      if (remaining < 500) { deps.log({ provider: provider.name, reason: "budget" }); return null; }
      // Share the budget so a hung provider cannot starve the rest of the chain.
      const providersLeft = deps.providers.length - index;
      const timeoutMs = providersLeft > 1 ? Math.min(remaining, Math.max(3000, Math.floor(remaining / providersLeft))) : remaining;
      const started = deps.now();
      const result = await attempt(provider, request as ChatJsonRequest<unknown>, mode, retry, timeoutMs, deps);
      if (result.ok) return { data: result.value as T, provider: provider.name };
      deps.log({ provider: provider.name, mode, ms: deps.now() - started, reason: result.reason, status: result.status ?? 0 });
      if (result.reason === "http" && result.status === 400 && mode === "json_schema") { mode = "json_object"; continue; }
      if (result.reason === "parse" || result.reason === "invalid") { retry = true; continue; }
      break; // 429/5xx/timeout/network → next provider
    }
  }
  return null;
}
