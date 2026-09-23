type JsonSchema = Record<string, unknown>;

export function isAiConfigured(): boolean { return Boolean(process.env.AI_ENABLED === "true" && process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL); }

export async function structuredOutput<T>(name: string, schema: JsonSchema, instruction: string, input: string): Promise<T | null> {
  if (!isAiConfigured()) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL,
        store: false,
        input: [{ role: "system", content: instruction }, { role: "user", content: input }],
        text: { format: { type: "json_schema", name, strict: true, schema } },
      }),
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return null;
    const data = await response.json() as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> };
    const text = data.output?.filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    return text ? JSON.parse(text) as T : null;
  } catch { return null; }
}
