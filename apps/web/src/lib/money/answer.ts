import { shortVnd, type MonthSummary } from "./summary.ts";

/**
 * Family Coordinator, money side (SPEC_V2 §18): detect a finance question and answer it from the month
 * summary with templates — rules before models (§43). Shopping phrasing ("bỉm dưới 350k", "nới ngân sách")
 * is deliberately left to the shopping pipeline.
 */
export type MoneyQuestion = "overview" | "remaining" | "category" | "upcoming" | "savings" | "child" | "balance";

const fold = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
const SHOPPING = /\b(bim|ta|sua|khan|nuoc giat|mua|tim|so sanh|size|kg|mieng|noi|tang ngan sach|duoi \d|tren \d|goi y|de xuat)\b/;

export function detectMoneyQuestion(message: string): MoneyQuestion | null {
  const plain = fold(message);
  if (SHOPPING.test(plain)) return null;
  if (/(so du|con bao nhieu tien|tien mat|tai khoan con)/.test(plain)) return "balance";
  if (/(sap toi|den han|hoa don|dinh ky|phai tra)/.test(plain)) return "upcoming";
  if (/(tiet kiem|de danh|muc tieu)/.test(plain)) return "savings";
  if (/(cho con|cho be|tien con|em be)/.test(plain) && /(tieu|chi|ton|het)/.test(plain)) return "child";
  if (/(con bao nhieu|con lai|du bao nhieu|vuot|qua tay|ke hoach)/.test(plain) && /(ngan sach|ke hoach|tieu|chi|tien)/.test(plain)) return "remaining";
  if (/(an uong|tieu dung|gia dinh|kham|thuoc|giai tri|hoc tap|dien|nuoc|tra gop|nhom|di dau|vao dau|nhieu nhat)/.test(plain) && /(tieu|chi|tien|ton|het)/.test(plain)) return "category";
  if (/(tieu|chi tieu|da chi|thu nhap|thu chi|tinh hinh tai chinh|tien nong|tong ket)/.test(plain) && /(thang|tuan|nay|bao nhieu|the nao|sao|ra sao|tong)/.test(plain)) return "overview";
  return null;
}

export function answerMoney(kind: MoneyQuestion, summary: MonthSummary, message = ""): { text: string; choices: string[] } {
  const m = `tháng ${Number(summary.month.slice(5))}`;
  if (summary.transactionCount === 0 && kind !== "upcoming" && kind !== "balance") return { text: `Sổ thu chi ${m} chưa có khoản nào nên mình chưa trả lời được. Ghi vài khoản ở mục Tiền (như Excel: ngày · nội dung · nhóm · số tiền) rồi hỏi lại nhé.`, choices: ["Mở Tiền", "Khoản nào sắp đến hạn?"] };
  const top = summary.byCategory.slice(0, 3).map((line) => `${line.category} ${shortVnd(line.spent)}${line.limit ? ` (${Math.round((line.ratio ?? 0) * 100)}% ngân sách)` : ""}`).join(", ");
  const pace = summary.plan && summary.expectedExpense ? summary.paceRatio! > 1.05 ? ` Với nhịp này, cuối tháng sẽ chi khoảng ${shortVnd(summary.expectedExpense)} — cao hơn kế hoạch ${shortVnd(summary.plan)} khoảng ${Math.round((summary.paceRatio! - 1) * 100)}%.` : ` Nhịp chi đang trong kế hoạch ${shortVnd(summary.plan)} (dự kiến ${shortVnd(summary.expectedExpense)}).` : "";
  switch (kind) {
    case "overview":
      return { text: `${m.charAt(0).toUpperCase()}${m.slice(1)}: thu ${shortVnd(summary.income)}, đã chi ${shortVnd(summary.expense)}${summary.saving ? `, chuyển tiết kiệm ${shortVnd(summary.saving)}` : ""}.${top ? ` Chi nhiều nhất: ${top}.` : ""}${pace}`, choices: ["Tiền đi đâu nhiều nhất?", "Còn bao nhiêu trong kế hoạch?", "Khoản nào sắp đến hạn?"] };
    case "remaining":
      if (!summary.plan) return { text: `Bạn chưa đặt kế hoạch chi tháng nên mình chưa so được. ${m.charAt(0).toUpperCase()}${m.slice(1)} đã chi ${shortVnd(summary.expense)}; đặt kế hoạch ở Tiền → Định kỳ & mục tiêu để mình theo dõi nhịp chi.`, choices: ["Mở Tiền", "Tháng này tiêu thế nào?"] };
      return { text: `Kế hoạch ${shortVnd(summary.plan)}, đã chi ${shortVnd(summary.expense)} → còn ${shortVnd(summary.remainingOfPlan!)}.${pace}${summary.byCategory.some((line) => line.limit && line.spent > line.limit) ? ` Nhóm vượt ngân sách: ${summary.byCategory.filter((line) => line.limit && line.spent > line.limit).map((line) => `${line.category} (+${shortVnd(line.spent - line.limit!)})`).join(", ")}.` : ""}`, choices: ["Tiền đi đâu nhiều nhất?", "Khoản nào sắp đến hạn?"] };
    case "category": {
      const asked = summary.byCategory.find((line) => fold(message).includes(fold(line.category)));
      if (asked) return { text: `${asked.category} ${m}: đã chi ${shortVnd(asked.spent)}${asked.limit ? ` trên ngân sách ${shortVnd(asked.limit)} (${Math.round((asked.ratio ?? 0) * 100)}%)` : ", chưa đặt ngân sách"}${asked.forChild ? `, trong đó cho con ${shortVnd(asked.forChild)}` : ""}.`, choices: [`Đặt ngân sách ${asked.category}`, "Tháng này tiêu thế nào?"] };
      return { text: top ? `Tiền ${m} đi nhiều nhất vào: ${top}.${summary.childSpend ? ` Chi cho con tổng ${shortVnd(summary.childSpend)}.` : ""}` : `${m.charAt(0).toUpperCase()}${m.slice(1)} chưa có khoản chi nào.`, choices: ["Còn bao nhiêu trong kế hoạch?", "Chi cho con bao nhiêu?"] };
    }
    case "upcoming":
      return { text: summary.upcoming.length ? `Sắp đến hạn: ${summary.upcoming.map((item) => `${item.name} ${shortVnd(item.amount)} (${item.daysLeft === 0 ? "hôm nay" : `còn ${item.daysLeft} ngày`})`).join(", ")}. Các khoản này sẽ tự ghi vào sổ khi tới ngày.` : "Không có khoản định kỳ nào đến hạn trong 7 ngày tới. Bạn có thể thêm hóa đơn định kỳ ở Tiền → Định kỳ & mục tiêu để mình nhắc.", choices: ["Tháng này tiêu thế nào?", "Số dư còn bao nhiêu?"] };
    case "savings":
      return { text: `Tiết kiệm hiện ${shortVnd(summary.balances.savings)}${summary.saving ? `; ${m} đã chuyển thêm ${shortVnd(summary.saving)}${summary.income ? ` (${Math.round(summary.saving / summary.income * 100)}% thu nhập)` : ""}` : `; ${m} chưa chuyển khoản nào`}.`, choices: ["Tháng này tiêu thế nào?", "Còn bao nhiêu trong kế hoạch?"] };
    case "child":
      return { text: summary.childSpend ? `Chi cho con ${m}: ${shortVnd(summary.childSpend)}${summary.expense ? ` — ${Math.round(summary.childSpend / summary.expense * 100)}% tổng chi` : ""}. ${summary.byCategory.filter((line) => line.forChild).map((line) => `${line.category} ${shortVnd(line.forChild)}`).join(", ")}.` : `${m.charAt(0).toUpperCase()}${m.slice(1)} chưa có khoản nào đánh dấu “cho con”. Tick ô Cho con khi ghi để mình theo dõi riêng.`, choices: ["Tiền đi đâu nhiều nhất?", "Tìm bỉm cho bé"] };
    case "balance":
      return { text: `Số dư ước tính: tiền mặt/tài khoản ${shortVnd(summary.balances.cash)}, tiết kiệm ${shortVnd(summary.balances.savings)} (từ số dư đầu kỳ và các khoản đã ghi).`, choices: ["Tháng này tiêu thế nào?", "Khoản nào sắp đến hạn?"] };
  }
}
