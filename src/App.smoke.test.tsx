// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { initialData } from "./data";
import { load, save } from "./store";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

describe("画面操作", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("natsumanabi-guide", "done");
    const data = initialData();
    data.settings.setupDone = true;
    save(data);
  });

  it("今日画面を開いてタスクを完了できる", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/?date=2026-07-21"]}>
          <App />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("今日の必須");
    const complete = container.querySelector<HTMLButtonElement>(
      ".completeAction",
    );
    expect(complete).not.toBeNull();
    await act(async () => complete?.click());
    expect(load().tasks.some((task) => task.status === "completed")).toBe(true);
    const undo = container.querySelector<HTMLButtonElement>(
      ".globalUndo button",
    );
    await act(async () => undo?.click());
    expect(load().tasks.every((task) => task.status !== "completed")).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });

  it("7月31日までの宿題リバランスを画面から実行できる", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/?date=2026-07-21"]}>
          <App />
        </MemoryRouter>,
      );
    });
    const button = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((item) => item.textContent?.includes("7月31日までに均等"));
    expect(button).not.toBeUndefined();
    await act(async () => button?.click());
    const homework = load().tasks.filter(
      (task) => task.category === "夏休み宿題" && task.status !== "completed",
    );
    expect(homework.every((task) => task.date <= "2026-07-31")).toBe(true);
    expect(
      homework.some((task) =>
        task.rescheduleHistory.some((entry) => entry.includes("まで再配分")),
      ),
    ).toBe(true);
    await act(async () => root.unmount());
    container.remove();
  });

  it("カレンダーを月別・曜日付きで描画する", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/calendar"]}>
          <App />
        </MemoryRouter>,
      );
    });
    expect(container.textContent).toContain("カレンダー");
    expect(container.querySelectorAll(".weekdayRow span")).toHaveLength(21);
    expect(container.querySelectorAll(".day").length).toBeGreaterThan(60);
    await act(async () => root.unmount());
    container.remove();
  });
});
