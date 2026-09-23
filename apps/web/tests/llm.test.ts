import assert from "node:assert/strict";
import test from "node:test";
import { getProviders, isAiConfigured } from "../src/lib/ai/llm/providers.ts";
import { chatJson, type ChatJsonDeps } from "../src/lib/ai/llm/chat-json.ts";

const env = { AI_ENABLED: "true", LLM_PROVIDERS: "gemini, groq", GEMINI_API_KEY: "g", GEMINI_MODEL: "gemini-flash", GROQ_API_KEY: "q", GROQ_MODEL: "llama" };
const schema = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] };
const request = { name: "t", system: "s", messages: [{ role: "user" as const, content: "hi" }], schema };

function reply(status: number, content?: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}

function harness(responses: Array<Response | Error>, providers = getProviders(env)) {
  const calls: Array<{ url: string; body: { response_format: { type: string }; messages: Array<{ content: string }> } }> = [];
  const deps: Partial<ChatJsonDeps> = {
    enabled: true, providers, log: () => {},
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      const next = responses.shift();
      if (!next) throw new Error("no more responses");
      if (next instanceof Error) throw next;
      return next;
    }) as typeof fetch,
  };
  return { calls, deps };
}

test("providers theo thứ tự LLM_PROVIDERS, bỏ provider thiếu key", () => {
  const providers = getProviders({ ...env, LLM_PROVIDERS: "gemini,openrouter,groq" });
  assert.deepEqual(providers.map((p) => p.name), ["gemini", "groq"]);
  assert.equal(providers[0].baseUrl, "https://generativelanguage.googleapis.com/v1beta/openai");
  assert.equal(providers[0].jsonMode, "json_schema");
  assert.equal(providers[1].jsonMode, "json_object");
});

test("thiếu LLM_PROVIDERS vẫn dùng cấu hình OpenAI cũ", () => {
  assert.deepEqual(getProviders({ OPENAI_API_KEY: "k", OPENAI_MODEL: "m" }).map((p) => p.name), ["openai"]);
});

test("AI_ENABLED khác true thì không cấu hình AI", () => {
  assert.equal(isAiConfigured({ ...env, AI_ENABLED: "false" }), false);
  assert.equal(isAiConfigured(env), true);
});

test("provider đầu lỗi 429 thì chuyển sang provider kế", async () => {
  const { calls, deps } = harness([reply(429), reply(200, '{"ok":true}')]);
  const result = await chatJson(request, deps);
  assert.deepEqual(result, { data: { ok: true }, provider: "groq" });
  assert.match(calls[1].url, /api\.groq\.com/);
  assert.equal(calls[1].body.response_format.type, "json_object");
  assert.match(calls[1].body.messages[0].content, /JSON Schema/);
});

test("400 với json_schema thì thử lại cùng provider ở json_object", async () => {
  const { calls, deps } = harness([reply(400), reply(200, '{"ok":true}')]);
  const result = await chatJson(request, deps);
  assert.equal(result?.provider, "gemini");
  assert.deepEqual(calls.map((c) => c.body.response_format.type), ["json_schema", "json_object"]);
});

test("bỏ markdown fence quanh JSON", async () => {
  const { deps } = harness([reply(200, '```json\n{"ok":false}\n```')]);
  assert.deepEqual((await chatJson(request, deps))?.data, { ok: false });
});

test("JSON hỏng/không qua validate ở mọi provider thì trả null", async () => {
  const validate = (value: unknown): value is { ok: boolean } => typeof (value as { ok?: unknown })?.ok === "boolean";
  const { calls, deps } = harness([reply(200, "not json"), reply(200, '{"ok":"yes"}'), reply(200, "{}"), new Error("down")]);
  assert.equal(await chatJson({ ...request, validate }, deps), null);
  assert.equal(calls.length, 4);
});

test("tắt AI hoặc không có provider thì không gọi mạng", async () => {
  const { calls, deps } = harness([]);
  assert.equal(await chatJson(request, { ...deps, enabled: false }), null);
  assert.equal(await chatJson(request, { ...deps, providers: [] }), null);
  assert.equal(calls.length, 0);
});

const intentLike = {
  type: "object",
  properties: { category: { type: ["string", "null"], enum: ["diapers", "unsupported", null] }, diaperSize: { type: ["string", "null"] }, weightKg: { type: ["number", "null"] } },
  required: ["category", "diaperSize", "weightKg"],
};

test("JSON đúng cú pháp nhưng sai schema bị loại, lần thử lại có nhắc chỉ trả JSON", async () => {
  const { calls, deps } = harness([reply(200, "{}"), reply(200, '{"category":"diapers","diaperSize":4,"weightKg":10}'), reply(200, '{"category":"Diapers","diaperSize":null,"weightKg":null}'), reply(200, '{"category":"diapers","diaperSize":"L","weightKg":"10"}')]);
  assert.equal(await chatJson({ ...request, schema: intentLike }, deps), null);
  assert.equal(calls.length, 4);
  const lastMessage = (call: (typeof calls)[number]) => call.body.messages.at(-1)?.content ?? "";
  assert.doesNotMatch(lastMessage(calls[0]), /Chỉ trả về đúng một JSON/);
  assert.match(lastMessage(calls[1]), /Chỉ trả về đúng một JSON/);
});

test("JSON khớp schema (có null) được chấp nhận", async () => {
  const { deps } = harness([reply(200, '{"category":"diapers","diaperSize":null,"weightKg":10.5}')]);
  assert.deepEqual((await chatJson({ ...request, schema: intentLike }, deps))?.data, { category: "diapers", diaperSize: null, weightKg: 10.5 });
});

test("chia timeout để provider treo không chặn provider sau", async () => {
  const budgets: number[] = [];
  const { deps } = harness([new DOMException("timed out", "TimeoutError"), reply(200, '{"ok":true}')]);
  const result = await chatJson(request, { ...deps, timeoutSignal: (ms) => { budgets.push(ms); return new AbortController().signal; } });
  assert.equal(result?.provider, "groq");
  assert.equal(budgets[0], 4500);
  assert.ok(budgets[1] > 4500);
});

test("LLM_PROVIDERS rỗng vẫn dùng openai", () => {
  assert.deepEqual(getProviders({ LLM_PROVIDERS: " ", OPENAI_API_KEY: "k", OPENAI_MODEL: "m" }).map((p) => p.name), ["openai"]);
});
