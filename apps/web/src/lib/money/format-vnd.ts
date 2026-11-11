/**
 * Money at three sizes: `vnd` is the exact figure; `vndCompact` is the compact one for tight places
 * ("329k", "11,65tr", "1,2 tỷ"). Whole numbers drop the decimals, at most two decimals otherwise.
 */
export function vndCompact(amount: number): string {
  const value = Math.abs(Math.round(amount));
  const trim = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  if (value >= 1_000_000_000) return `${trim(value / 1_000_000_000)} tỷ`;
  if (value >= 1_000_000) return `${trim(value / 1_000_000)}tr`;
  if (value >= 1_000) return `${trim(value / 1_000)}k`;
  return `${value}đ`;
}

/** The exact figure, e.g. "1.250.000đ". */
export const vnd = (amount: number): string => `${Math.round(amount).toLocaleString("vi-VN")}đ`;
