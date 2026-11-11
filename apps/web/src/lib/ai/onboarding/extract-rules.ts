// Money-amount parsing for free-form Vietnamese shopping messages (budget cues like "dưới 400k").

/** VND amount from "400k", "1,2 triệu", "350.000đ", "dưới 400". */
export function parseVnd(message: string): number | null {
  // Units and cue words also in their no-diacritics forms ("380 nghin", "duoi 400k") — common phone typing.
  for (const match of message.matchAll(/(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d)?)\s*(k|nghìn|ngàn|nghin|ngan|triệu|trieu|tr|đ|vnd|vnđ)?(?![\p{L}\d])/giu)) {
    const raw = match[1]; const unit = (match[2] ?? "").toLocaleLowerCase("vi");
    const base = /^\d{1,3}(?:[.,]\d{3})+$/.test(raw) ? Number(raw.replace(/[.,]/g, "")) : Number(raw.replace(",", "."));
    const amount = /^(triệu|trieu|tr)$/.test(unit) ? base * 1_000_000 : /^(k|nghìn|ngàn|nghin|ngan)$/.test(unit) ? base * 1000 : !unit && base >= 50 && base < 10_000 ? base * 1000 : base;
    if (amount >= 50_000 && amount <= 100_000_000 && (unit || /(dưới|tối đa|ngân sách|tầm|khoảng|giá|duoi|toi da|ngan sach|tam|khoang|gia)\s*$/i.test(message.slice(0, match.index)))) return Math.round(amount);
  }
  return null;
}

