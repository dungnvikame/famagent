import assert from "node:assert/strict";
import test from "node:test";
import { careHealth, screenGuide, sleepRange } from "../src/lib/care/nurturing.ts";
import { CARE_METHOD_LIST, fitsAges, suggestCareMethods } from "../src/lib/care/methods.ts";
import { buildAssessment } from "../src/lib/onboarding/assessment.ts";
import { buildQuestions } from "../src/lib/onboarding/questions.ts";
import { validProfile } from "../src/lib/experience/validate.ts";
import type { FamilyProfile, HouseholdContext } from "../src/lib/experience/types.ts";

const now = new Date("2026-09-24T09:00:00+07:00");
const base = (household: HouseholdContext, ages: number[] = [9]): FamilyProfile => ({ id: "p", pricePreference: "balanced", aiConsent: true, updatedAt: "x", household, children: ages.map((ageMonths, index) => ({ id: `0000000${index}-0000-4000-8000-000000000000`, name: index ? undefined : "Gold", ageMonths })) });

test("ngưỡng theo khuyến nghị: giờ ngủ (AASM) và màn hình (WHO 2019)", () => {
  assert.equal(sleepRange(9), "12–16 giờ"); assert.equal(sleepRange(30), "11–14 giờ"); assert.equal(sleepRange(100), "9–12 giờ");
  assert.equal(screenGuide(18).limitMinutes, 0); assert.equal(screenGuide(36).limitMinutes, 60);
});

test("8 chỉ số theo 5 thành phần của Khung Chăm sóc Nuôi dưỡng; chưa trả lời thì chưa chấm", () => {
  const empty = careHealth(base({}), now);
  assert.equal(empty.indicators.length, 8);
  assert.deepEqual([...new Set(empty.indicators.map((item) => item.component))], ["Sức khỏe", "Dinh dưỡng", "Chăm sóc đáp ứng", "Học sớm", "An toàn"]);
  assert.equal(empty.score, undefined);
});

test("bé 9 tháng xem màn hình 1–2 giờ là dễ tổn thương; vấn đề xếp theo mức khẩn cấp, an toàn lên trước", () => {
  const report = careHealth(base({ vaccines: "late", checkup: "recent", sleepQuality: "short", nutrition: "picky", playTime: "30to60", screenTime: "1to2h", reading: "rarely", safety: ["outlets"] }), now);
  const status = Object.fromEntries(report.indicators.map((item) => [item.key, item.status]));
  assert.deepEqual(status, { vaccines: "coping", checkup: "healthy", sleep: "vulnerable", nutrition: "coping", play: "coping", screen: "vulnerable", reading: "vulnerable", safety: "coping" });
  assert.deepEqual(report.problems.map((item) => item.key), ["sleep", "screen", "reading", "safety", "vaccines", "nutrition", "play"]);
  assert.match(report.problems[0].fix!, /9 tháng: 12–16 giờ/);
  assert.match(report.problems[1].fix!, /dưới 2 tuổi không xem màn hình/);
  assert.match(report.problems.find((item) => item.key === "safety")!.fix!, /chặn cầu thang.*cất thuốc.*mũ bảo hiểm/);
  assert.equal(report.tier, "coping");
});

test("bé 3 tuổi xem dưới 1 giờ là đạt; gia đình chăm tốt không có vấn đề", () => {
  const report = careHealth(base({ vaccines: "on_track", checkup: "recent", sleepQuality: "good", nutrition: "varied", playTime: "gt60", screenTime: "lt1h", reading: "daily", safety: ["stairs", "outlets", "chemicals", "vehicle"] }, [36]), now);
  assert.equal(report.score, 90); assert.deepEqual(report.problems, []);
});

test("6 phương pháp nuôi dạy có nguồn gốc và độ tuổi; gợi ý theo tuổi và câu trả lời (tối đa 2)", () => {
  assert.deepEqual(CARE_METHOD_LIST.map((item) => item.id), ["easy", "rie", "montessori", "positive-discipline", "emotion-coaching", "french"]);
  for (const method of CARE_METHOD_LIST) { assert.ok(method.origin.length > 10); assert.equal(method.practices.length, 3); }
  assert.equal(fitsAges(CARE_METHOD_LIST.find((item) => item.id === "easy")!, [30]), false);
  assert.deepEqual(suggestCareMethods(base({ sleepQuality: "short" }), now).map((item) => item.id), ["easy", "rie"]);
  assert.deepEqual(suggestCareMethods(base({ nutrition: "picky" }, [40]), now).map((item) => item.id), ["french", "emotion-coaching"]);
  assert.deepEqual(suggestCareMethods(base({ setup: "expecting" }, []), now).map((item) => item.id), ["easy", "rie"]);
});

test("câu hỏi đánh giá chăm con chỉ khi có con và người dùng đồng ý; kết quả vào assessment + facts không có tên con", () => {
  const ids = (h: HouseholdContext, ages?: number[]) => buildQuestions(base(h, ages), undefined, now.getTime()).map((q) => q.id);
  assert.ok(ids({}).includes("care-deep"));
  assert.ok(!ids({ setup: "no_kids" }, []).includes("care-deep"));
  assert.ok(!ids({ careDeepDive: false }).includes("vaccines"));
  const deep = ids({ careDeepDive: true });
  assert.deepEqual(deep.slice(deep.indexOf("care-deep") + 1, deep.indexOf("care-deep") + 9), ["vaccines", "checkup", "sleep", "nutrition", "play", "screen", "reading", "safety"]);
  const h: HouseholdContext = { careDeepDive: true, vaccines: "late", sleepQuality: "short", screenTime: "gt2h", careMethod: "easy" };
  assert.ok(validProfile(base(h)));
  const a = buildAssessment(base(h), now);
  assert.ok(a.careCheck.problems.length >= 3);
  assert.ok(a.facts.some((line) => /^Điểm chăm sóc con \d+\/100/.test(line)));
  assert.ok(a.facts.every((line) => !line.includes("Gold")));
});
