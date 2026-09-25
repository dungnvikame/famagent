// Second pass for quick add: lines the rules could not place are sent (text only) to the model with the family's
// category list. Code validates every answer against that list; the family still reviews before saving.
import type { JsonSchema } from "../ai/llm/index.ts";

export const MAX_CLASSIFY_LINES = 80;

export interface ClassifyLine { i: number; content: string; kind: "expense" | "income" }
export interface ClassifyRequest { lines: ClassifyLine[]; categories: { expense: string[]; income: string[] }; children: string[] }
export interface ClassifyAnswer { i: number; kind: "expense" | "income"; category: string }

export const CLASSIFY_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: { items: { type: "array", items: { type: "object", additionalProperties: false, required: ["i", "kind", "category"], properties: { i: { type: "integer" }, kind: { type: "string", enum: ["expense", "income"] }, category: { type: "string" } } } } },
};

export function classifySystem(request: ClassifyRequest): string {
  return `Bạn xếp nhóm cho các khoản thu chi của một gia đình Việt Nam. Mỗi dòng là nội dung một khoản (viết tắt, không dấu, tên người, tên cửa hàng đều có thể gặp).
Nhóm chi được phép: ${request.categories.expense.join(" | ")}.
Nhóm thu được phép: ${request.categories.income.join(" | ")}.
${request.children.length ? `Tên các con trong nhà: ${request.children.join(", ")} — khoản nhắc tên con là chi cho con (nhóm "Con" nếu có).` : ""}
Quy ước: "<tên người> vay/mượn" = nhà mình cho người đó vay (chi, "Tiền cho vay"); "vay/mượn <ai>" ở đầu câu = nhà mình đi vay (thu, "Vay cá nhân" hoặc "Vay ngân hàng"); "<ai> trả nợ" = được trả lại (thu, "Tiền trả nợ nhận về"); đồ em bé (bỉm, sữa bột, hút mũi, rơ lưỡi, ăn dặm) = "Con"; đồ uống, đi chợ, siêu thị = "Ăn uống"; SIM, cước, internet, đồ dùng nhà = "Tiêu dùng"; quần áo, mỹ phẩm, đồ gia dụng = "Mua sắm".
Trả về mỗi dòng: i (giữ nguyên), kind ("expense" chi hoặc "income" thu — giữ như đầu vào trừ khi nội dung rõ ràng là ngược lại), category (đúng một tên trong danh sách của kind đó). Không chắc thì chọn "Others".`;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const names = (value: unknown, max: number) => Array.isArray(value) && value.length <= max && value.every((name) => typeof name === "string" && name.trim().length > 0 && name.length <= 40) ? value as string[] : null;

/** Request body from the browser → a clean request, or null. */
export function validClassifyRequest(input: unknown): ClassifyRequest | null {
  if (!isRecord(input) || !Array.isArray(input.lines) || !input.lines.length || input.lines.length > MAX_CLASSIFY_LINES || !isRecord(input.categories)) return null;
  const expense = names(input.categories.expense, 80); const income = names(input.categories.income, 80); const children = names(input.children ?? [], 10);
  if (!expense?.length || !income?.length || !children) return null;
  const lines: ClassifyLine[] = [];
  for (const line of input.lines) {
    if (!isRecord(line) || !Number.isInteger(line.i) || (line.i as number) < 0 || (line.i as number) > 1000 || typeof line.content !== "string" || !line.content.trim() || line.content.length > 120 || (line.kind !== "expense" && line.kind !== "income")) return null;
    lines.push({ i: line.i as number, content: line.content.trim(), kind: line.kind });
  }
  return { lines, categories: { expense, income }, children };
}

/** Model reply → answers whose index was asked and whose category exists for that kind (others are dropped). */
export function cleanAnswers(value: unknown, request: ClassifyRequest): ClassifyAnswer[] {
  if (!isRecord(value) || !Array.isArray(value.items)) return [];
  const asked = new Set(request.lines.map((line) => line.i));
  const out: ClassifyAnswer[] = [];
  for (const item of value.items) {
    if (!isRecord(item) || !Number.isInteger(item.i) || !asked.has(item.i as number) || (item.kind !== "expense" && item.kind !== "income") || typeof item.category !== "string") continue;
    if (!request.categories[item.kind].includes(item.category)) continue;
    if (!out.some((answer) => answer.i === item.i)) out.push({ i: item.i as number, kind: item.kind, category: item.category });
  }
  return out;
}

export const isClassifyReply = (value: unknown): value is { items: unknown[] } => isRecord(value) && Array.isArray(value.items) && value.items.length <= MAX_CLASSIFY_LINES;
