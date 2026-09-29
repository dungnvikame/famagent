import { test } from "node:test";
import assert from "node:assert/strict";
import { bandOf, kgAtZ, lmsAt, normalCdf, percentile, whoCurves, whoPoints, zScore, zTrend, WHO_MAX_DAYS } from "../src/lib/family/who-growth.ts";

const near = (actual: number, expected: number, tol = 0.1) => assert.ok(Math.abs(actual - expected) <= tol, `${actual} ≉ ${expected}`);
const sd = (sex: "male" | "female", days: number) => [-3, -2, 0, 2, 3].map((z) => Math.round(kgAtZ(lmsAt(sex, days)!, z) * 10) / 10);

// Published WHO weight-for-age SD tables (kg, 1 decimal).
test("matches WHO SD tables", () => {
  assert.deepEqual(sd("male", 0), [2.1, 2.5, 3.3, 4.4, 5.0]);
  assert.deepEqual(sd("male", 365), [6.9, 7.7, 9.6, 12.0, 13.3]);
  assert.deepEqual(sd("female", 730), [8.1, 9.0, 11.5, 14.8, 17.0]);
  near(kgAtZ(lmsAt("female", 1826)!, 0), 18.2);
  near(kgAtZ(lmsAt("male", 1826)!, -2), 14.1);
  // WHO 2007 reference, 10 years.
  near(kgAtZ(lmsAt("male", WHO_MAX_DAYS)!, 0), 31.2);
  assert.equal(lmsAt("male", WHO_MAX_DAYS + 1), undefined);
  assert.equal(lmsAt("female", -1), undefined);
});

test("z-score, restricted tails, percentile", () => {
  const lms = lmsAt("male", 365)!;
  near(zScore(lms.m, lms), 0, 1e-9);
  near(zScore(kgAtZ(lms, -2), lms), -2, 1e-9);
  // Beyond +3 SD WHO extends linearly by the +2..+3 SD distance.
  const sd3 = kgAtZ(lms, 3), sd2 = kgAtZ(lms, 2);
  near(zScore(sd3 + (sd3 - sd2), lms), 4, 1e-9);
  near(normalCdf(0), 0.5, 1e-7); near(normalCdf(1.96), 0.975, 1e-4);
  assert.equal(percentile(0), 50); assert.equal(percentile(-2), 2); assert.equal(percentile(-4), 0.1);
  assert.deepEqual([-3.5, -2.5, 0, 2.5, 3.5].map(bandOf), ["very_low", "low", "normal", "high", "very_high"]);
});

test("points, trend and curves", () => {
  const points = whoPoints([{ date: "2025-07-20", kg: 3.3 }, { date: "2026-07-20", kg: 9.6 }, { date: "2026-09-01", kg: 10.1 }, { date: "2036-01-01", kg: 40 }], "2025-07-20", "male");
  assert.equal(points.length, 3);
  assert.equal(points[1].ageDays, 365); near(points[1].z, 0, 0.05);
  assert.equal(zTrend(points)?.kind, "steady");
  const falling = whoPoints([{ date: "2026-01-20", kg: 8.4 }, { date: "2026-07-20", kg: 8.6 }], "2025-07-20", "male");
  const trend = zTrend(falling)!;
  assert.equal(trend.kind, "down"); assert.equal(trend.crossing, true);
  const curves = whoCurves("female", 0, 730);
  assert.deepEqual(curves.map((line) => line.z), [-3, -2, 0, 2, 3]);
  assert.equal(curves[2].points.at(-1)![0], 730);
});
