import { MONEY_METHODS, type FamilyProfile } from "../experience/types.ts";
import type { MoneyBudget, MoneyTransaction } from "./types.ts";

/**
 * Well-known household money frameworks the family can choose from (the app suggests, the family decides).
 * Each maps the ledger's categories to its own buckets so the Money page can show target vs actual.
 */
export type FrameworkId = (typeof MONEY_METHODS)[number];

export interface Bucket {
  key: string; label: string; /** Share of income (0–1); undefined = no fixed share. */ share?: number; hint: string;
  /** Custom split only: the ledger categories that count toward this part. */ categories?: string[];
  /** A saving target ("at least") rather than a spending cap ("at most"). */ atLeast?: boolean;
  /** Custom split only: a fixed monthly amount instead of a share of income. */ amount?: number;
}
export interface Framework {
  id: FrameworkId;
  name: string;
  /** Author / origin, so the family knows it is a recognised method. */
  origin: string;
  idea: string;
  howTo: string[];
  bestFor: string;
  buckets: Bucket[];
}

export const FRAMEWORKS: Framework[] = [
  {
    id: "jars", name: "6 chiếc lọ (JARS)", origin: "T. Harv Eker — sách “Bí mật tư duy triệu phú” (2005)",
    idea: "Chia mỗi khoản thu nhập vào 6 “lọ”, mỗi lọ một mục đích, tiêu trong phần của lọ đó.",
    howTo: ["Nhận lương → chia ngay theo tỷ lệ 55/10/10/10/10/5.", "Lọ nào hết thì dừng tiêu nhóm đó đến tháng sau.", "Lọ Tự do tài chính chỉ để đầu tư, không bao giờ tiêu."],
    bestFor: "Gia đình muốn cân bằng: vừa lo hiện tại, vừa để dành, vừa có tiền học và hưởng thụ.",
    buckets: [
      { key: "nec", label: "Thiết yếu", share: 0.55, hint: "ăn uống, hóa đơn, con cái, trả góp" },
      { key: "ffa", label: "Tự do tài chính", share: 0.10, hint: "đầu tư tạo thu nhập thụ động" },
      { key: "ltss", label: "Tiết kiệm dài hạn", share: 0.10, hint: "quỹ dự phòng, mua nhà, xe" },
      { key: "edu", label: "Giáo dục", share: 0.10, hint: "học hành của cả nhà" },
      { key: "play", label: "Hưởng thụ", share: 0.10, hint: "ăn ngoài, mua sắm, du lịch" },
      { key: "give", label: "Cho đi", share: 0.05, hint: "hiếu hỉ, biếu bố mẹ, từ thiện" },
    ],
  },
  {
    id: "50-30-20", name: "Quy tắc 50/30/20", origin: "Elizabeth Warren & Amelia Tyagi — sách “All Your Worth” (2005)",
    idea: "Chia thu nhập thành ba phần: 50% thiết yếu, 30% mong muốn, 20% để dành và trả thêm nợ.",
    howTo: ["Liệt kê khoản thiết yếu (nhà, ăn, hóa đơn, con) — giữ dưới 50%.", "Mong muốn (ăn ngoài, mua sắm, giải trí) tối đa 30%.", "Chuyển 20% vào tiết kiệm hoặc trả nợ sớm."],
    bestFor: "Người mới bắt đầu, muốn một quy tắc dễ nhớ, không cần ghi quá chi tiết.",
    buckets: [
      { key: "needs", label: "Thiết yếu", share: 0.5, hint: "ăn uống, nhà, hóa đơn, con cái, trả góp tối thiểu" },
      { key: "wants", label: "Mong muốn", share: 0.3, hint: "ăn ngoài, mua sắm, giải trí, du lịch" },
      { key: "save", label: "Để dành & trả nợ", share: 0.2, hint: "tiết kiệm, đầu tư, trả nợ sớm" },
    ],
  },
  {
    id: "pay-first", name: "Trả cho mình trước", origin: "George S. Clason — “Người giàu nhất thành Babylon” (1926); David Bach phổ biến lại",
    idea: "Ngay khi nhận lương, chuyển một phần (tối thiểu 10%) vào tiết kiệm; phần còn lại mới là tiền tiêu.",
    howTo: ["Chọn tỷ lệ để dành: bắt đầu 10%, tăng dần lên 15–20%.", "Đặt chuyển tiền tự động ngay ngày nhận lương.", "Tiêu thoải mái phần còn lại, không cần ghi quá kỹ."],
    bestFor: "Gia đình mãi chưa để dành được vì “cuối tháng xem còn bao nhiêu”.",
    buckets: [
      { key: "save", label: "Trả cho mình (để dành)", share: 0.15, hint: "chuyển ngay khi nhận lương" },
      { key: "spend", label: "Chi tiêu", share: 0.85, hint: "mọi khoản chi còn lại" },
    ],
  },
  {
    id: "zero-based", name: "Ngân sách bằng 0 (Zero-based)", origin: "Phương pháp YNAB (You Need A Budget) — “mỗi đồng một việc”",
    idea: "Giao việc cho từng đồng thu nhập: thu − (các nhóm chi + để dành) = 0. Không có tiền “trôi nổi”.",
    howTo: ["Đầu tháng, đặt ngân sách cho từng nhóm chi và khoản để dành.", "Tổng các nhóm phải bằng đúng thu nhập.", "Lệch nhóm nào thì chuyển từ nhóm khác sang, không tiêu vượt tổng."],
    bestFor: "Gia đình đã quen ghi chép (Excel, app) và muốn kiểm soát chặt từng nhóm.",
    buckets: [
      { key: "assigned", label: "Đã giao việc", hint: "tổng ngân sách các nhóm + để dành" },
      { key: "unassigned", label: "Chưa giao việc", hint: "thu nhập chưa có kế hoạch — nên về 0" },
    ],
  },
  {
    id: "kakeibo", name: "Kakeibo", origin: "Hani Motoko — Nhật Bản (1904)",
    idea: "Đặt mục tiêu để dành đầu tháng, ghi chi tiêu theo 4 nhóm và tự hỏi cuối tháng: đã tiêu có đáng không?",
    howTo: ["Đầu tháng: thu bao nhiêu, muốn để dành bao nhiêu?", "Ghi mỗi khoản vào 4 nhóm: Sinh tồn, Mong muốn, Văn hóa, Phát sinh.", "Cuối tuần/tháng: tiêu thế nào, cải thiện gì?"],
    bestFor: "Gia đình “không biết tiền đi đâu”, muốn chi tiêu có ý thức hơn là theo tỷ lệ cứng.",
    buckets: [
      { key: "survival", label: "Sinh tồn", hint: "ăn uống, hóa đơn, con cái, đi lại" },
      { key: "wants", label: "Mong muốn", hint: "ăn ngoài, mua sắm, giải trí" },
      { key: "culture", label: "Văn hóa", hint: "học hành, sách, trải nghiệm" },
      { key: "unexpected", label: "Phát sinh", hint: "ốm đau, hiếu hỉ, sửa chữa" },
    ],
  },
  {
    id: "baby-steps", name: "7 bước nhỏ (Baby Steps)", origin: "Dave Ramsey — sách “The Total Money Makeover” (2003)",
    idea: "Đi lần lượt 7 bước: quỹ khẩn cấp nhỏ → trả hết nợ (từ khoản nhỏ nhất) → quỹ 3–6 tháng → đầu tư → học cho con → trả nhà → tích lũy.",
    howTo: ["Bước 1: quỹ khẩn cấp ban đầu (khoảng 1 tháng chi tiêu).", "Bước 2: trả nợ theo “quả cầu tuyết” — khoản nhỏ nhất trước.", "Bước 3: quỹ dự phòng 3–6 tháng chi tiêu, rồi mới đầu tư 15% thu nhập."],
    bestFor: "Gia đình đang có nợ, trả góp, muốn thoát nợ trước rồi mới tích lũy.",
    buckets: [
      { key: "debt", label: "Trả nợ", hint: "trả góp, thẻ tín dụng, nợ cá nhân" },
      { key: "save", label: "Quỹ khẩn cấp & tích lũy", hint: "tiết kiệm, đầu tư" },
      { key: "spend", label: "Chi tiêu", hint: "mọi khoản chi còn lại" },
    ],
  },
];

export const frameworkById = (id?: string) => FRAMEWORKS.find((item) => item.id === id);

// Default ledger categories (lib/money/types DEFAULT_CATEGORIES) grouped once, reused by every mapping.
const ESSENTIAL = new Set(["Ăn uống", "Tiêu dùng", "Con", "Gia đình", "Tiền điện", "Tiền nước", "Tiền trả góp", "Tiền thẻ tín dụng", "Tiền trả nợ", "Tiền trả nợ quỹ", "Khám, thuốc"]);
const DEBT = new Set(["Tiền trả góp", "Tiền thẻ tín dụng", "Tiền trả nợ", "Tiền trả nợ quỹ"]);
const INVEST = new Set(["Chi phí đầu tư", "Tiền cho vay"]);

/** Bucket key a ledger entry counts toward in a framework (null = not counted, e.g. income). */
export function bucketOf(id: FrameworkId, tx: Pick<MoneyTransaction, "kind" | "category" | "amount">): string | null {
  if (tx.kind === "income") return null;
  const saving = tx.kind === "saving";
  const c = tx.category;
  switch (id) {
    case "jars": return saving ? "ltss" : INVEST.has(c) ? "ffa" : c === "Học tập" ? "edu" : c === "Hiếu hỉ" ? "give" : ESSENTIAL.has(c) ? "nec" : "play";
    case "50-30-20": return saving || INVEST.has(c) ? "save" : ESSENTIAL.has(c) || c === "Học tập" ? "needs" : "wants";
    case "pay-first": return saving || INVEST.has(c) ? "save" : "spend";
    case "kakeibo": return saving ? null : c === "Học tập" ? "culture" : c === "Khám, thuốc" || c === "Hiếu hỉ" ? "unexpected" : ESSENTIAL.has(c) ? "survival" : "wants";
    case "baby-steps": return saving || INVEST.has(c) ? "save" : DEBT.has(c) ? "debt" : "spend";
    case "zero-based": return null;
    case "custom": return null; // mapped by each part's own categories in frameworkProgress
  }
}

export interface BucketProgress extends Bucket { target?: number; actual: number }

/** Target (share × income) vs actual for the month; zero-based compares budgets to income instead. */
export function frameworkProgress(fw: Framework, income: number, transactions: MoneyTransaction[], budgets: MoneyBudget[] = []): BucketProgress[] {
  if (fw.id === "zero-based") {
    const saved = transactions.filter((tx) => tx.kind === "saving" && tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
    const assigned = budgets.reduce((sum, item) => sum + item.limitAmount, 0) + saved;
    return [{ ...fw.buckets[0], target: income, actual: assigned }, { ...fw.buckets[1], target: 0, actual: Math.max(0, income - assigned) }];
  }
  const actual = new Map<string, number>();
  const byCategory = new Map(fw.buckets.flatMap((bucket) => (bucket.categories ?? []).map((name) => [name, bucket.key] as const)));
  for (const tx of transactions) {
    const key = fw.id === "custom" ? (tx.kind === "income" ? null : byCategory.get(tx.category) ?? null) : bucketOf(fw.id, tx);
    if (key && !(tx.kind === "saving" && tx.amount < 0)) actual.set(key, (actual.get(key) ?? 0) + tx.amount);
  }
  return fw.buckets.map((bucket) => ({ ...bucket, target: bucket.amount ?? (bucket.share !== undefined && income > 0 ? Math.round(income * bucket.share) : undefined), actual: actual.get(bucket.key) ?? 0 }));
}

/** Dave Ramsey step the family is on, from onboarding answers (1-based). */
export function babyStep(profile: FamilyProfile): { step: number; text: string } {
  const h = profile.household ?? {};
  if (h.emergency === "none" || h.emergency === undefined) return { step: 1, text: "Bước 1 — lập quỹ khẩn cấp ban đầu, khoảng 1 tháng chi tiêu." };
  if ((h.monthlyDebt ?? 0) > 0) return { step: 2, text: "Bước 2 — trả hết các khoản nợ, trả góp theo “quả cầu tuyết”, khoản nhỏ nhất trước." };
  if (h.emergency === "lt3") return { step: 3, text: "Bước 3 — nâng quỹ dự phòng lên 3–6 tháng chi tiêu." };
  return { step: 4, text: "Bước 4 — đầu tư 15% thu nhập cho tương lai, rồi quỹ học cho con (bước 5)." };
}

/** Frameworks that fit the family's answers, with the reason — shown as a tag; the family still chooses. */
export function suggestFrameworks(profile: FamilyProfile): Array<{ id: FrameworkId; reason: string }> {
  const h = profile.household ?? {};
  const pains = new Set(h.moneyPains ?? []);
  const debtRate = h.monthlyIncome && h.monthlyDebt ? h.monthlyDebt / h.monthlyIncome : 0;
  const out: Array<{ id: FrameworkId; reason: string }> = [];
  const add = (id: FrameworkId, reason: string) => { if (!out.some((item) => item.id === id)) out.push({ id, reason }); };
  const highInterest = (h.debtTypes ?? []).some((item) => item === "credit_card" || item === "consumer_loan");
  if (pains.has("debt") || debtRate > 0.36 || highInterest) add("baby-steps", highInterest ? "Có khoản vay lãi cao cần trả dứt trước" : "Bạn đang có nợ, trả góp đáng kể");
  if (h.incomeStability === "irregular") add("zero-based", "Thu nhập không đều — giao việc cho từng khoản khi tiền về");
  if (pains.has("cant_save")) add("pay-first", "Bạn nói mãi chưa để dành được");
  if (pains.has("unknown_spending") || h.tracking === "none" || h.tracking === "memory") add("kakeibo", "Bạn chưa rõ tiền đi đâu");
  if (pains.has("short_month_end")) add("50-30-20", "Cuối tháng hay hụt — cần giới hạn rõ ràng");
  if (h.tracking === "spreadsheet" || h.tracking === "app") add("zero-based", "Bạn đã quen ghi chép chi tiết");
  if (profile.children.length || h.setup === "expecting") add("jars", "Có lọ riêng cho Giáo dục của các con");
  if (!out.length) add("50-30-20", "Dễ bắt đầu, dễ nhớ");
  return out.slice(0, 2);
}
