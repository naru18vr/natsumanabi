import { describe, expect, it } from "vitest";
import {
  addDays,
  deadlineForecast,
  overdueTasks,
  rebalanceDay,
  rebalanceHomeworkToDeadline,
  remainingMinutes,
  reviewCopies,
  suggestedMoves,
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
  it("移動候補の名前を具体的に返す", () => {
    const candidates = suggestedMoves(
      [
        task("必須", "2026-07-21", 60, "required"),
        task("復習", "2026-07-21", 30, "normal"),
      ],
      "2026-07-21",
      60,
    );
    expect(candidates.map((item) => item.title)).toEqual(["復習"]);
  });
  it("夏休み宿題を締切日まで均等に配る", () => {
    const homework = Array.from({ length: 4 }, (_, index) => ({
      ...task(`宿題${index}`, "2026-07-28", 30),
      category: "夏休み宿題",
    }));
    const result = rebalanceHomeworkToDeadline(
      homework,
      "2026-07-28",
      "2026-07-31",
      60,
    );
    expect(result.tasks.map((item) => item.date)).toEqual([
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
    ]);
    expect(result.overflowMinutes).toBe(0);
  });
  it("完了済みの宿題は移動しない", () => {
    const completed = {
      ...task("完了", "2026-07-28"),
      category: "夏休み宿題",
      status: "completed" as const,
    };
    const result = rebalanceHomeworkToDeadline(
      [completed],
      "2026-07-28",
      "2026-07-31",
      60,
    );
    expect(result.tasks[0].date).toBe("2026-07-28");
  });
  it("途中まで終えた宿題は残量分だけで配分する", () => {
    const partial = {
      ...task("途中", "2026-07-28", 50),
      status: "partial" as const,
      totalAmount: 5,
      completedAmount: 3,
    };
    expect(remainingMinutes(partial)).toBe(20);
  });
  it("期限内に上限を超える量は超過分を返す", () => {
    const homework = [
      { ...task("a", "2026-07-30", 80), category: "夏休み宿題" },
      { ...task("b", "2026-07-30", 80), category: "夏休み宿題" },
    ];
    const result = rebalanceHomeworkToDeadline(
      homework,
      "2026-07-30",
      "2026-07-31",
      60,
    );
    expect(result.overflowMinutes).toBe(40);
    expect(result.tasks.every((item) => item.date <= "2026-07-31")).toBe(true);
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
