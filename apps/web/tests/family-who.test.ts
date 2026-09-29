import { test } from "node:test";
import assert from "node:assert/strict";
import { bandOf, bodyStatus, kgAtZ, lmsAt, normalCdf, percentile, whoCurves, whoPoints, zScore, zTrend, WHO_MAX_DAYS } from "../src/lib/family/who-growth.ts";

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
  const points = whoPoints([{ date: "2025-07-20", value: 3.3 }, { date: "2026-07-20", value: 9.6 }, { date: "2026-09-01", value: 10.1 }, { date: "2036-01-01", value: 40 }], "2025-07-20", "male");
  assert.equal(points.length, 3);
  assert.equal(points[1].ageDays, 365); near(points[1].z, 0, 0.05);
  assert.equal(zTrend(points)?.kind, "steady");
  const falling = whoPoints([{ date: "2026-01-20", value: 8.4 }, { date: "2026-07-20", value: 8.6 }], "2025-07-20", "male");
  const trend = zTrend(falling)!;
  assert.equal(trend.kind, "down"); assert.equal(trend.crossing, true);
  const curves = whoCurves("female", 0, 730);
  assert.deepEqual(curves.map((line) => line.z), [-3, -2, 0, 2, 3]);
  assert.equal(curves[2].points.at(-1)![0], 730);
});

test("height-for-age, weight-for-height and BMI-for-age", () => {
  const hfa = (sex: "male" | "female", days: number, z: number) => Math.round(kgAtZ(lmsAt(sex, days, "hfa")!, z) * 10) / 10;
  assert.deepEqual([-2, 0, 2].map((z) => hfa("male", 365, z)), [71.0, 75.7, 80.5]);
  near(hfa("female", 730, 0), 86.4); near(hfa("female", 731, 0), 85.7); // lying → standing at 2 years
  near(hfa("male", 1826, 0), 110.0);
  near(kgAtZ(lmsAt("male", Math.round(120 * 30.4375), "bfa")!, 0), 16.4);
  assert.equal(lmsAt("male", 40, "wfl"), undefined);
  // Height points use plain LMS (no restricted tails).
  const points = whoPoints([{ date: "2026-07-20", value: 75.7 }], "2025-07-20", "male", "hfa");
  near(points[0].z, 0, 0.02);
  // Under 2: weight-for-length; the median weight for 75 cm is "normal".
  const wflMedian = lmsAt("male", 75, "wfl")!.m;
  const body = bodyStatus("male", "2025-07-20", { date: "2026-07-20", value: wflMedian }, { date: "2026-07-10", value: 75 })!;
  assert.equal(body.indicator, "wfl"); assert.equal(body.band, "normal"); near(body.z, 0, 1e-6);
  // Heavy for height, 3 years old → weight-for-height, above +2 SD.
  const heavy = bodyStatus("female", "2023-03-12", { date: "2026-03-12", value: kgAtZ(lmsAt("female", 95, "wfh")!, 2.5) }, { date: "2026-03-12", value: 95 })!;
  assert.equal(heavy.indicator, "wfh"); assert.equal(heavy.band, "over");
  // 8 years old → BMI-for-age.
  const bmi = bodyStatus("male", "2018-01-01", { date: "2026-01-01", value: 25.6 }, { date: "2026-01-01", value: 128 })!;
  assert.equal(bmi.indicator, "bfa"); assert.equal(bmi.bmi, 15.6); assert.equal(bmi.band, "normal");
  // Measurements more than a month apart are not paired.
  assert.equal(bodyStatus("male", "2025-07-20", { date: "2026-07-20", value: 9 }, { date: "2026-05-01", value: 74 }), null);
});
