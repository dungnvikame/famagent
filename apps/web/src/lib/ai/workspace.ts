import type { AgentView } from "@/lib/experience/types";
import type { Product } from "@/lib/catalog/types";

export function routeWorkspace(message: string, products: Product[]): { text: string; view: AgentView } | null {
  const normalized = message.toLocaleLowerCase("vi").trim();
  if (/^(?:xem|mở|cho (?:tôi|mình) xem|hiển thị).*(?:hồ sơ|thông tin (?:gia đình|của bé|của con))/.test(normalized)) return { text: "Đây là những thông tin tôi đang dùng để tư vấn. Bạn có thể nói điều cần sửa, ví dụ ‘đổi cân nặng của Gold thành 11kg’.", view: { kind: "family" } };
  if (/(?:xem|mở|cho (?:tôi|mình) xem).*(?:đã lưu|yêu thích)|^(?:sản phẩm )?đã lưu$/.test(normalized)) return { text: "Tôi đã mở các sản phẩm bạn lưu. Hãy nói tên sản phẩm nếu muốn xem kỹ hoặc so sánh.", view: { kind: "saved" } };
  if (/(?:xem|mở|cho (?:tôi|mình) xem).*(?:lịch sử|cuộc trò chuyện|đã hỏi)/.test(normalized)) return { text: "Đây là các cuộc trò chuyện gần đây. Bạn có thể tiếp tục bất kỳ cuộc nào.", view: { kind: "history" } };
  if (/so sánh|khác nhau (?:thế nào|ra sao)/.test(normalized)) return { text: "Tôi đặt các lựa chọn gần nhất cạnh nhau để bạn thấy chênh lệch về giá, size và điểm dùng ban đêm.", view: { kind: "compare" } };
  const detail = /(?:xem|mở|cho (?:tôi|mình) xem).*(?:chi tiết|thông tin|sản phẩm)/.test(normalized);
  if (detail) {
    const product = products.find((item) => normalized.includes(item.canonicalName.toLocaleLowerCase("vi"))) ?? products.find((item) => normalized.includes(item.brand.toLocaleLowerCase("vi")));
    if (product) return { text: `Đây là thông tin đang có về ${product.canonicalName}. Tôi sẽ chỉ nêu thuộc tính đã có trong catalog.`, view: { kind: "product", productId: product.id } };
  }
  if (/^(?:xem|mở|hiển thị|cho (?:tôi|mình) xem).*(?:catalog|danh sách|tất cả (?:sản phẩm|bỉm))/.test(normalized)) return { text: "Tôi đã mở danh sách bỉm hiện có. Hãy nói cân nặng, size hoặc ngân sách để tôi thu hẹp lựa chọn.", view: { kind: "catalog" } };
  if (/^(?:giúp|hướng dẫn|tôi có thể hỏi gì|bạn làm được gì)/.test(normalized)) return { text: "Bạn có thể nói nhu cầu mua bỉm, yêu cầu so sánh, xem hồ sơ gia đình, sản phẩm đã lưu hoặc chi tiết một lựa chọn. Tôi sẽ mở nội dung ngay tại đây.", view: { kind: "help" } };
  return null;
}
