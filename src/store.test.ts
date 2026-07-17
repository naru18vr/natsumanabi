// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { initialData } from "./data";
import { load, migrate, pct, phase, save } from "./store";

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
});
