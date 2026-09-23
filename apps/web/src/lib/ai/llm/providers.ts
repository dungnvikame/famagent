// Reads LLM provider settings from server env. Every provider speaks the
// OpenAI-compatible /chat/completions API, so switching between free tiers
// (Gemini, Groq, OpenRouter) or a paid plan is a config change, not a code change.

export type JsonMode = "json_schema" | "json_object";

export interface LlmProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Preferred structured-output mode; downgraded to json_object if the provider rejects it. */
  jsonMode: JsonMode;
}

type Env = Record<string, string | undefined>;

const DEFAULTS: Record<string, { baseUrl: string; jsonMode: JsonMode }> = {
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", jsonMode: "json_schema" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", jsonMode: "json_object" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", jsonMode: "json_object" },
  openai: { baseUrl: "https://api.openai.com/v1", jsonMode: "json_schema" },
};

/**
 * Providers in fallback order from LLM_PROVIDERS (e.g. "gemini,groq"); entries without key/model are skipped.
 * Unset LLM_PROVIDERS keeps the original OPENAI_API_KEY/OPENAI_MODEL setup working.
 */
export function getProviders(env: Env = process.env): LlmProvider[] {
  const names = (env.LLM_PROVIDERS?.trim() || "openai").split(",").map((name) => name.trim().toLowerCase()).filter(Boolean);
  return names.flatMap((name) => {
    const prefix = name.toUpperCase();
    const apiKey = env[`${prefix}_API_KEY`];
    const model = env[`${prefix}_MODEL`];
    const baseUrl = env[`${prefix}_BASE_URL`] ?? DEFAULTS[name]?.baseUrl;
    if (!apiKey || !model || !baseUrl) return [];
    const jsonMode = env[`${prefix}_JSON_MODE`] === "json_object" || env[`${prefix}_JSON_MODE`] === "json_schema"
      ? env[`${prefix}_JSON_MODE`] as JsonMode
      : DEFAULTS[name]?.jsonMode ?? "json_object";
    return [{ name, baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, model, jsonMode }];
  });
}

/** Master switch: AI_ENABLED=true and at least one usable provider. */
export function isAiConfigured(env: Env = process.env): boolean {
  return env.AI_ENABLED === "true" && getProviders(env).length > 0;
}
