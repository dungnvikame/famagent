// Photo of money movements (bank statement, banking-app screenshot, receipt, a notebook page) → lines for quick add.
// The vision model only reads; code validates, and the family reviews every line before anything is saved.
import type { JsonSchema } from "../ai/llm/index.ts";
import type { ImageLine } from "./quick-add.ts";

export const MAX_IMAGE_LINES = 40;

export const MONEY_IMAGE_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["lines"],
  properties: {
    lines: { type: "array", items: { type: "object", additionalProperties: false, required: ["date", "content", "amount", "direction"], properties: { date: { type: ["string", "null"] }, content: { type: "string" }, amount: { type: "integer" }, direction: { type: "string", enum: ["in", "out"] } } } },
  },
};

export const MONEY_IMAGE_SYSTEM = `Bạn đọc ảnh các khoản tiền của một gia đình Việt Nam: sao kê hoặc lịch sử giao dịch ngân hàng, ảnh chụp màn hình app ngân hàng/ví (MoMo, ZaloPay), hóa đơn, hoặc trang sổ tay ghi chi tiêu.
Trả về từng khoản: date (YYYY-MM-DD nếu thấy, không thì null), content (nội dung ngắn gọn bằng tiếng Việt, ví dụ "Cà phê Highlands", "Lương tháng 9", "Chuyển tiền nhà"), amount (số tiền, đồng, số nguyên dương), direction ("out" nếu là tiền ra/chi/trừ tiền, "in" nếu là tiền vào/nhận/cộng tiền).
Hóa đơn mua hàng: trả một dòng tổng số tiền đã trả cho cả hóa đơn, content là tên cửa hàng hoặc món chính.
Không bịa: dòng nào không đọc rõ số tiền thì bỏ qua. Bỏ số dư tài khoản, mã giao dịch, phí 0đ.`;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Strict check of the model's reply. */
export function isMoneyImage(value: unknown): value is { lines: ImageLine[] } {
  if (!isRecord(value) || !Array.isArray(value.lines) || value.lines.length > MAX_IMAGE_LINES) return false;
  return value.lines.every((line) => isRecord(line)
    && (line.date === null || (typeof line.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(line.date) && !Number.isNaN(Date.parse(line.date))))
    && typeof line.content === "string" && line.content.trim().length > 0 && line.content.length <= 120
    && Number.isInteger(line.amount) && (line.amount as number) > 0 && (line.amount as number) <= 100_000_000_000
    && (line.direction === "in" || line.direction === "out"));
}
