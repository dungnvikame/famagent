import { NextResponse } from "next/server";
import { chatJson, isAiConfigured, type JsonSchema } from "@/lib/ai/llm";
import { passesFactGuard } from "@/lib/ai/shopping/composer";
import { allowInMemory, ONBOARDING_LLM_PER_HOUR } from "@/lib/ai/onboarding/rate-limit";
import { validProfile } from "@/lib/experience/validate";
import { buildAssessment } from "@/lib/onboarding/assessment";
import { authConfigured, authenticated } from "@/lib/supabase/server";

const schema: JsonSchema = { type: "object", additionalProperties: false, properties: { note: { type: "string" } }, required: ["note"] };
const SYSTEM = [
  "Bạn là FamAgent, trợ lý riêng cho một gia đình Việt Nam. Viết lời nhận định mở đầu (3–4 câu, tiếng Việt, xưng 'mình', gọi người dùng là 'bạn'),",
  "ấm áp, thẳng thắn, cụ thể, dựa trên DỮ KIỆN và KẾ HOẠCH được cung cấp. Chỉ dùng những con số có trong dữ kiện; không thêm số mới, không hứa hẹn,",
  "không khuyên sản phẩm tài chính cụ thể, không chẩn đoán y tế. Không nhắc tên riêng của trẻ. Trả về JSON {\"note\": string}.",
].join(" ");

/**
 * POST { profile } → { assessment, source }. The assessment is computed by rules; when AI is allowed the opening note
 * is rewritten by the LLM and kept only if it passes the fact guard (numbers must come from the facts).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { profile?: unknown } | null;
  if (!validProfile(body?.profile)) return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const profile = body.profile;
  const assessment = buildAssessment(profile);

  let allowAi = profile.aiConsent && isAiConfigured();
  if (allowAi) {
    if (authConfigured()) {
      const auth = await authenticated();
      const quota = auth ? await auth.client.rpc("consume_request_quota", { p_endpoint: "onboarding", p_limit: ONBOARDING_LLM_PER_HOUR }) : null;
      allowAi = Boolean(quota && !quota.error && quota.data === true);
    } else {
      allowAi = allowInMemory(`assessment:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`);
    }
  }
  if (!allowAi) return NextResponse.json({ assessment, source: "rules" });

  // Facts only: assessment.facts already has child names replaced (spec v1 §6.2).
  const facts = [
    `Kết luận: ${assessment.headline}.`, "Gia đình sẽ tự chọn một phương pháp quản lý tiền (6 chiếc lọ, 50/30/20, trả cho mình trước, ngân sách bằng 0, Kakeibo, 7 bước nhỏ).",
    ...assessment.facts, `Số con: ${profile.children.length}.`, profile.household?.setup === "expecting" ? "Gia đình đang chờ em bé." : "",
  ].filter(Boolean).join("\n");
  const result = await chatJson({ name: "onboarding_assessment", system: SYSTEM, messages: [{ role: "user", content: `DỮ KIỆN:\n${facts}` }], schema, timeoutMs: 8000,
    validate: (value): value is { note: string } => typeof (value as { note?: unknown })?.note === "string" });
  const note = result?.data.note.trim();
  const names = profile.children.map((child) => child.name).filter((name): name is string => Boolean(name));
  if (!note || !passesFactGuard(note, facts) || names.some((name) => note.toLocaleLowerCase("vi").includes(name.toLocaleLowerCase("vi")))) return NextResponse.json({ assessment, source: "rules" });
  return NextResponse.json({ assessment: { ...assessment, note }, source: "ai" });
}
