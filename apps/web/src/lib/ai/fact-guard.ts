// Guard for optional LLM wording: only numbers present in the facts, no superlatives or health claims,
// no links. A text that fails is dropped and the rule-based wording is used instead.

// "rank" is an internal field name the model sometimes echoes ("(rank 1)"); never user-facing.
const FORBIDDEN = /tốt nhất|rẻ nhất thị trường|giá thấp nhất thị trường|best|số 1|cam kết|chữa|điều trị|an toàn tuyệt đối|\brank\b/i;
// Product-style claims the model might add; allowed only when the same words appear in the facts.
const CLAIMS = ["siêu mỏng", "mỏng nhất", "không mùi", "kháng khuẩn", "hữu cơ", "organic", "chống hăm", "an toàn", "dịu nhẹ", "thấm hút tốt", "mềm mại", "thoáng khí", "chính hãng", "giảm giá", "khuyến mãi", "freeship", "giao nhanh", "được yêu thích", "bán chạy"];
const numbers = (text: string) => (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((item) => item.replace(/[.,]/g, ""));
const percents = (text: string) => (text.match(/\d+(?:[.,]\d+)?\s*%/g) ?? []).map((item) => item.replace(/\s/g, ""));

export function passesFactGuard(text: string, facts: string): boolean {
  if (!text.trim() || text.length > 600 || FORBIDDEN.test(text) || /https?:\/\//.test(text)) return false;
  const allowed = new Set(numbers(facts));
  if (!numbers(text).every((item) => allowed.has(item))) return false;
  const factPercents = new Set(percents(facts));
  if (!percents(text).every((item) => factPercents.has(item))) return false;
  const lowerText = text.toLocaleLowerCase("vi"); const lowerFacts = facts.toLocaleLowerCase("vi");
  return !CLAIMS.some((claim) => lowerText.includes(claim) && !lowerFacts.includes(claim));
}
