import type { Product } from "./types";

// Tên và giá giả lập chỉ để thử giao diện; không phải sản phẩm hoặc báo giá thực.
const definitions = [
  ["Dòng Êm Đêm", "Nhãn mẫu A", "M", 6, 11, 48, 289000, 4],
  ["Dòng Êm Đêm", "Nhãn mẫu A", "L", 9, 14, 56, 379000, 4],
  ["Dòng Thoáng Nhẹ", "Nhãn mẫu B", "L", 9, 14, 60, 349000, 3],
  ["Dòng Tiết Kiệm", "Nhãn mẫu C", "L", 9, 14, 72, 329000, 2],
  ["Dòng Mềm Dịu", "Nhãn mẫu D", "XL", 12, 17, 48, 399000, 3],
  ["Dòng Hằng Ngày", "Nhãn mẫu B", "M", 6, 11, 64, 319000, 2],
] as const;

export const demoProducts: Product[] = definitions.map(([name, brand, size, min, max, count, price, night], index) => ({
  id: `demo-${index + 1}`,
  slug: `demo-${index + 1}`,
  canonicalName: `${name} ${size}${count}`,
  brand,
  category: "diapers",
  description: "Dữ liệu minh họa để kiểm tra giao diện và bộ lọc. Thông số và giá không đại diện cho sản phẩm đang bán.",
  diaper: { minWeightKg: min, maxWeightKg: max, type: "pants", nightUseScore: night },
  variants: [{
    id: `demo-variant-${index + 1}`,
    name: `${size} · ${count} miếng`,
    size,
    quantity: count,
    quantityUnit: "piece",
    offers: [{ id: `demo-offer-${index + 1}`, merchantId: "demo", merchantName: "Cửa hàng minh họa", source: "direct", price, currency: "VND", availability: "in_stock", updatedAt: "2026-01-01T00:00:00Z" }],
  }],
  isDemo: true,
}));

