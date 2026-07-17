import { describe, expect, it } from "vitest";
import {
  addDays,
  deadlineForecast,
  overdueTasks,
  rebalanceDay,
  reviewCopies,
} from "./planner";
import type { Task } from "./types";

const task = (
  id: string,
  date: string,
  minutes = 30,
  priority: Task["priority"] = "normal",
): Task => ({
  id,
  source: "test",
  subject: "数学",
  category: "宿題",
  type: "work",
  title: id,
  description: "",
  date,
  estimatedMinutes: minutes,
  actualMinutes: 0,
  priority,
  status: "pending",
  requiredTools: [],
  availableLocations: ["どこでも"],
  tags: [],
  rescheduleHistory: [],
  targetDueDate: "2026-07-31",
});

describe("planner", () => {
  it("日付を加算する", () =>
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01"));
  it("過去の未完了だけを抽出する", () => {
    const done = {
      ...task("done", "2026-07-20"),
      status: "completed" as const,
    };
    expect(
      overdueTasks([task("old", "2026-07-20"), done], "2026-07-21").map(
        (x) => x.id,
      ),
    ).toEqual(["old"]);
  });
  it("必須を残して上限に合わせる", () => {
    const result = rebalanceDay(
      [
        task("required", "2026-07-21", 60, "required"),
        task("extra", "2026-07-21", 60),
      ],
      "2026-07-21",
      60,
    );
    expect(result.find((x) => x.id === "required")?.date).toBe("2026-07-21");
    expect(result.find((x) => x.id === "extra")?.date).toBe("2026-07-22");
  });
  it("締切までの1日量を計算する", () => {
    expect(
      deadlineForecast([task("a", "2026-07-21", 100)], "2026-07-30")[0]
        .minutesPerDay,
    ).toBe(50);
  });
  it("翌日・3・7・14日後の復習を作る", () => {
    expect(reviewCopies(task("a", "2026-07-21")).map((x) => x.date)).toEqual([
      "2026-07-22",
      "2026-07-24",
      "2026-07-28",
      "2026-08-04",
    ]);
  });
});
