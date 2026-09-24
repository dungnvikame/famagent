import assert from "node:assert/strict";
import test from "node:test";
import { parseVnd } from "../src/lib/money/parse.ts";

test("parseVnd hiểu cách gõ tiền phổ biến", () => {
  const cases: Array<[string, number | null]> = [
    ["350k", 350_000], ["350K", 350_000], ["350.000", 350_000], ["350,000", 350_000], ["1.200.000", 1_200_000], ["1,5m", 1_500_000], ["1.5tr", 1_500_000], ["2tr5", 2_500_000], ["25 triệu", 25_000_000],
    ["450000", 450_000], ["450000đ", 450_000], ["-698k", -698_000], ["−698000", -698_000], ["0", null], ["abc", null], ["", null], ["12k5", null],
  ];
  for (const [input, expected] of cases) assert.equal(parseVnd(input), expected, input);
});
