import type { Data, Task } from "./types";
import { initialData } from "./data";
const KEY = "natsumanabi-v1";

export function migrate(input: Partial<Data>): Data {
  const defaults = initialData();
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  const events = Array.isArray(input.events) ? input.events : [];
  const knownEvents = new Set(events.map((event) => event.id));
  return {
    settings: {
      ...defaults.settings,
      ...(input.settings || {}),
      version: 2,
    },
    tasks: tasks.map((item, index) => {
      const task = item as Partial<Task>;
      return {
        id: task.id || `recovered-${index}-${Date.now()}`,
        source: task.source || "saved",
        subject: task.subject || "その他",
        category: task.category || "学習",
        type: task.type || "homework",
        title: task.title || "名前のない予定",
        description: task.description || "",
        date: task.date || defaults.settings.studyStartDate,
        estimatedMinutes: Number(task.estimatedMinutes) || 15,
        actualMinutes: Number(task.actualMinutes) || 0,
        priority: task.priority || "normal",
        status: task.status || "pending",
        requiredTools: Array.isArray(task.requiredTools)
          ? task.requiredTools
          : [],
        availableLocations: Array.isArray(task.availableLocations)
          ? task.availableLocations
          : ["自宅のみ"],
        tags: Array.isArray(task.tags) ? task.tags : [],
        rescheduleHistory: Array.isArray(task.rescheduleHistory)
          ? task.rescheduleHistory
          : [],
        ...task,
      } as Task;
    }),
    events: [
      ...events,
      ...defaults.events.filter(
        (event) => event.type === "class" && !knownEvents.has(event.id),
      ),
    ],
    importHistory: Array.isArray(input.importHistory)
      ? input.importHistory
      : [],
  };
}

export function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialData();
    const x = JSON.parse(raw) as Partial<Data>;
    if (!x.settings || !Array.isArray(x.tasks)) throw Error();
    return migrate(x);
  } catch {
    localStorage.setItem(
      `${KEY}-broken-${Date.now()}`,
      localStorage.getItem(KEY) || "",
    );
    return initialData();
  }
}
export const save = (d: Data) => localStorage.setItem(KEY, JSON.stringify(d));
export const reset = () => localStorage.removeItem(KEY);
export const phase = (d: string) =>
  d < "2026-07-21"
    ? "開始前"
    : d <= "2026-07-31"
      ? "夏休み宿題集中"
      : d <= "2026-08-15"
        ? "英検集中"
        : d <= "2026-09-17"
          ? "定期テスト対策"
          : d <= "2026-09-24"
            ? "英検直前"
            : "試験当日";
export const pct = (a: number, b: number) =>
  b ? Math.round((a / b) * 100) : 0;
