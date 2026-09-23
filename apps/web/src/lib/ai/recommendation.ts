import type { Recommendation, ShoppingIntent } from "@/lib/experience/types";

export function explainRecommendations(intent: ShoppingIntent, candidateCount: number, recommendations: Recommendation[]): string {
  if (!recommendations.length) return "Chưa có sản phẩm đáp ứng đủ điều kiện trong catalog. Bạn có thể nới mức giá hoặc kiểm tra lại size/cân nặng.";
  const child = intent.childName ? ` cho ${intent.childName}` : "";
  return `Tôi tìm được ${candidateCount} sản phẩm phù hợp${child}${intent.weightKg ? ` ở mức ${intent.weightKg} kg` : ""}. Đây là ${recommendations.length} lựa chọn nên xem trước.`;
}

