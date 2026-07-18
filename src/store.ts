import type { Data, Event as StudyEvent, Task } from "./types";
import { initialData } from "./data";
const KEY = "natsumanabi-v1";
const statuses = new Set(["pending", "completed", "partial", "skipped", "rescheduled"]);
const priorities = new Set(["required", "high", "normal", "optional"]);
const validDate = (value: unknown, fallback: string) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : value;
};
const numberInRange = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback;
};

export const isRestorableData = (value: unknown): value is Partial<Data> => {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<Data>;
  return Boolean(data.settings && Array.isArray(data.tasks));
};

export function migrate(input: Partial<Data>): Data {
  const defaults = initialData();
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  const seenEventIds = new Set<string>();
  const events: StudyEvent[] = (Array.isArray(input.events) ? input.events : [])
    .filter((event) => event && typeof event.id === "string")
    .map((event) => ({
      ...event,
      id: String(event.id),
      type: ["class", "stay", "exam"].includes(event.type)
        ? event.type
        : "exam",
      title: typeof event.title === "string" ? event.title : "予定",
      date: validDate(event.date, defaults.settings.studyStartDate),
    }))
    .filter((event) => {
      if (seenEventIds.has(event.id)) return false;
      seenEventIds.add(event.id);
      return true;
    });
  const knownEvents = new Set(events.map((event) => event.id));
  const seenTaskIds = new Set<string>();
  return {
    settings: {
      ...defaults.settings,
      ...(input.settings || {}),
      dailyLimitMinutes: numberInRange(
        input.settings?.dailyLimitMinutes,
        defaults.settings.dailyLimitMinutes,
        15,
        720,
      ),
      studyStartDate: validDate(
        input.settings?.studyStartDate,
        defaults.settings.studyStartDate,
      ),
      homeworkGoalDate: validDate(
        input.settings?.homeworkGoalDate,
        defaults.settings.homeworkGoalDate,
      ),
      examDate: validDate(input.settings?.examDate, defaults.settings.examDate),
      periodicTestDates: Array.isArray(input.settings?.periodicTestDates)
        ? input.settings.periodicTestDates.filter((date) =>
            /^\d{4}-\d{2}-\d{2}$/.test(date),
          )
        : defaults.settings.periodicTestDates,
      accommodationDates: Array.isArray(input.settings?.accommodationDates)
        ? input.settings.accommodationDates.filter((date) =>
            /^\d{4}-\d{2}-\d{2}$/.test(date),
          )
        : [],
      setupDone:
        typeof input.settings?.setupDone === "boolean"
          ? input.settings.setupDone
          : defaults.settings.setupDone,
      kihonPages: numberInRange(
        input.settings?.kihonPages,
        defaults.settings.kihonPages,
        0,
        999,
      ),
      mathReviewPages: numberInRange(
        input.settings?.mathReviewPages,
        defaults.settings.mathReviewPages,
        0,
        999,
      ),
      version: 2,
    },
    tasks: tasks.map((item, index) => {
      const task =
        item && typeof item === "object" ? (item as Partial<Task>) : {};
      const totalAmount =
        task.totalAmount == null
          ? undefined
          : numberInRange(task.totalAmount, 1, 1, 10000);
      const requestedId =
        typeof task.id === "string" && task.id ? task.id : "";
      const id =
        requestedId && !seenTaskIds.has(requestedId)
          ? requestedId
          : `recovered-${index}-${Date.now()}`;
      seenTaskIds.add(id);
      return {
        ...task,
        id,
        source: typeof task.source === "string" ? task.source : "saved",
        subject: typeof task.subject === "string" ? task.subject : "その他",
        category: typeof task.category === "string" ? task.category : "学習",
        type: typeof task.type === "string" ? task.type : "homework",
        title:
          typeof task.title === "string" && task.title.trim()
            ? task.title
            : "名前のない予定",
        description:
          typeof task.description === "string" ? task.description : "",
        date: validDate(task.date, defaults.settings.studyStartDate),
        estimatedMinutes: numberInRange(task.estimatedMinutes, 15, 1, 720),
        actualMinutes: numberInRange(task.actualMinutes, 0, 0, 1440),
        totalAmount,
        completedAmount: numberInRange(
          task.completedAmount,
          0,
          0,
          totalAmount || 10000,
        ),
        unit: typeof task.unit === "string" ? task.unit : undefined,
        priority: priorities.has(String(task.priority))
          ? task.priority
          : "normal",
        status: statuses.has(String(task.status)) ? task.status : "pending",
        requiredTools: Array.isArray(task.requiredTools)
          ? task.requiredTools
          : [],
        availableLocations: Array.isArray(task.availableLocations)
          ? task.availableLocations
          : ["自宅のみ"],
        tags: Array.isArray(task.tags) ? task.tags : [],
        rescheduleHistory: Array.isArray(task.rescheduleHistory)
          ? task.rescheduleHistory.filter((item) => typeof item === "string")
          : [],
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
    try {
      localStorage.setItem(
        `${KEY}-broken-${Date.now()}`,
        localStorage.getItem(KEY) || "",
      );
    } catch {
      // 保存領域が使えなくても初期画面は表示する。
    }
    return initialData();
  }
}
export const save = (d: Data) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
};
export const reset = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // すでに保存領域へアクセスできない場合は何もしない。
  }
};
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
