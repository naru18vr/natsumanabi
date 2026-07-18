// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialData } from "./data";
import { isRestorableData, load, migrate, pct, phase, save } from "./store";

describe("日程ルール", () => {
  it("期間を切り替える", () => {
    expect(phase("2026-07-21")).toBe("夏休み宿題集中");
    expect(phase("2026-08-16")).toBe("定期テスト対策");
    expect(phase("2026-09-18")).toBe("英検直前");
  });
  it("進捗率", () => expect(pct(3, 4)).toBe(75));
});

describe("保存データ", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("保存した予定を読み直せる", () => {
    const data = initialData();
    data.tasks[0].title = "保存テスト";
    save(data);
    expect(load().tasks[0].title).toBe("保存テスト");
  });

  it("古いデータに足りない項目を補う", () => {
    const migrated = migrate({
      settings: { ...initialData().settings, version: 1 },
      tasks: [{ id: "old", title: "昔の予定", date: "2026-08-01" }],
    } as never);
    expect(migrated.settings.version).toBe(2);
    expect(migrated.tasks[0].estimatedMinutes).toBe(15);
    expect(migrated.tasks[0].requiredTools).toEqual([]);
    expect(migrated.events.filter((event) => event.type === "class")).toHaveLength(10);
  });

  it("壊れたデータを退避して初期表示できる", () => {
    localStorage.setItem("natsumanabi-v1", "not-json");
    const restored = load();
    expect(restored.tasks.length).toBeGreaterThan(0);
    expect(
      Object.keys(localStorage).some((key) =>
        key.startsWith("natsumanabi-v1-broken-"),
      ),
    ).toBe(true);
  });

  it("不正なタスク項目を安全な値へ直す", () => {
    const migrated = migrate({
      settings: { ...initialData().settings, dailyLimitMinutes: -100 },
      tasks: [
        null,
        {
          id: "bad",
          title: "",
          date: "not-a-date",
          estimatedMinutes: "NaN",
          priority: "unknown",
          status: "unknown",
          requiredTools: null,
        },
      ],
    } as never);
    expect(migrated.settings.dailyLimitMinutes).toBe(15);
    expect(migrated.tasks).toHaveLength(2);
    expect(migrated.tasks[1].date).toBe("2026-07-21");
    expect(migrated.tasks[1].estimatedMinutes).toBe(15);
    expect(migrated.tasks[1].priority).toBe("normal");
    expect(migrated.tasks[1].requiredTools).toEqual([]);
  });

  it("重複IDを分離し、進捗量を上限内へ直す", () => {
    const migrated = migrate({
      settings: initialData().settings,
      tasks: [
        { id: "same", title: "A", totalAmount: 5, completedAmount: 99 },
        { id: "same", title: "B" },
      ],
    } as never);
    expect(new Set(migrated.tasks.map((task) => task.id)).size).toBe(2);
    expect(migrated.tasks[0].completedAmount).toBe(5);
  });

  it("保存領域が満杯でも例外停止しない", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(save(initialData())).toBe(false);
  });

  it("復元ファイルの最低限の形式を確認する", () => {
    expect(isRestorableData({ settings: {}, tasks: [] })).toBe(true);
    expect(isRestorableData({ tasks: [] })).toBe(false);
    expect(isRestorableData([])).toBe(false);
  });
});
