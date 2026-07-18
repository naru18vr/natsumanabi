import type { Task } from "./types";

export const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toLocaleDateString("sv-SE");
};

export const overdueTasks = (tasks: Task[], date: string) =>
  tasks.filter(
    (task) =>
      task.date < date && !["completed", "skipped"].includes(task.status),
  );

export function rebalanceDay(tasks: Task[], date: string, limit: number) {
  const todays = tasks.filter(
    (task) => task.date === date && task.status !== "completed",
  );
  let total = todays.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  const rank = { optional: 0, normal: 1, high: 2, required: 3 };
  const candidates = [...todays].sort(
    (a, b) => rank[a.priority] - rank[b.priority],
  );
  const moved = new Set<string>();
  for (const task of candidates) {
    if (total <= limit || task.priority === "required") break;
    total -= task.estimatedMinutes;
    moved.add(task.id);
  }
  return tasks.map((task) =>
    moved.has(task.id)
      ? {
          ...task,
          date: addDays(date, 1),
          status: "pending" as const,
          rescheduleHistory: [
            ...task.rescheduleHistory,
            `${date}→${addDays(date, 1)}（自動調整）`,
          ],
        }
      : task,
  );
}

export function suggestedMoves(tasks: Task[], date: string, limit: number) {
  const balanced = rebalanceDay(tasks, date, limit);
  const moved = new Set(
    balanced
      .filter((task) => task.date !== date)
      .map((task) => task.id),
  );
  return tasks.filter((task) => task.date === date && moved.has(task.id));
}

export function rebalanceHomeworkToDeadline(
  tasks: Task[],
  fromDate: string,
  dueDate: string,
  dailyLimit: number,
) {
  const days: string[] = [];
  for (let date = fromDate; date <= dueDate; date = addDays(date, 1)) {
    days.push(date);
  }
  if (!days.length) return { tasks, daily: [], overflowMinutes: 0 };

  const candidates = tasks.filter(
    (task) =>
      task.category === "夏休み宿題" &&
      task.status !== "completed" &&
      task.status !== "skipped",
  );
  const candidateIds = new Set(candidates.map((task) => task.id));
  const load = new Map(days.map((day) => [day, 0]));
  tasks.forEach((task) => {
    if (
      days.includes(task.date) &&
      !candidateIds.has(task.id) &&
      task.status !== "completed" &&
      task.status !== "skipped"
    ) {
      load.set(task.date, (load.get(task.date) || 0) + task.estimatedMinutes);
    }
  });

  const destination = new Map<string, string>();
  [...candidates]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((task) => {
      const bestDay = [...days].sort((a, b) => {
        const loadDiff = (load.get(a) || 0) - (load.get(b) || 0);
        return loadDiff || a.localeCompare(b);
      })[0];
      destination.set(task.id, bestDay);
      load.set(bestDay, (load.get(bestDay) || 0) + task.estimatedMinutes);
    });

  const overflowMinutes = days.reduce(
    (sum, day) => sum + Math.max(0, (load.get(day) || 0) - dailyLimit),
    0,
  );
  return {
    tasks: tasks.map((task) => {
      const nextDate = destination.get(task.id);
      if (!nextDate || nextDate === task.date) return task;
      return {
        ...task,
        date: nextDate,
        status: "pending" as const,
        rescheduleHistory: [
          ...task.rescheduleHistory,
          `${task.date}→${nextDate}（${dueDate}まで再配分）`,
        ],
      };
    }),
    daily: days.map((date) => ({ date, minutes: load.get(date) || 0 })),
    overflowMinutes,
  };
}

export function deadlineForecast(tasks: Task[], today: string) {
  const pending = tasks.filter(
    (task) =>
      task.targetDueDate &&
      task.targetDueDate >= today &&
      task.status !== "completed",
  );
  const groups = new Map<string, Task[]>();
  pending.forEach((task) => {
    const key = task.targetDueDate!;
    groups.set(key, [...(groups.get(key) || []), task]);
  });
  return [...groups.entries()].map(([dueDate, group]) => {
    const days = Math.max(
      1,
      Math.ceil(
        (new Date(`${dueDate}T00:00:00`).getTime() -
          new Date(`${today}T00:00:00`).getTime()) /
          86400000,
      ) + 1,
    );
    const minutes = group.reduce((sum, task) => sum + task.estimatedMinutes, 0);
    return {
      dueDate,
      count: group.length,
      minutes,
      minutesPerDay: Math.ceil(minutes / days),
    };
  });
}

export function reviewCopies(task: Task): Task[] {
  return [1, 3, 7, 14].map((days) => ({
    ...task,
    id: `${task.id}-review-${days}`,
    source: "auto-review",
    category: "復習予定",
    title: `復習：${task.title}`,
    date: addDays(task.date, days),
    estimatedMinutes: Math.min(15, task.estimatedMinutes),
    actualMinutes: 0,
    priority: "normal",
    status: "pending",
    completedAmount: 0,
    completedAt: undefined,
    rescheduleHistory: [],
  }));
}

export function aggregateMaterials(tasks: Task[]) {
  const groups = new Map<string, Task[]>();
  tasks.forEach((task) => {
    const title = task.title
      .split(/[：]/)[0]
      .replace(/\s+\d+(ページ|枚|問|回)$/, "");
    const key = `${task.subject}|${title}`;
    groups.set(key, [...(groups.get(key) || []), task]);
  });
  return [...groups.entries()].map(([key, group]) => {
    const [subject, title] = key.split("|");
    const total = group.reduce((sum, task) => sum + (task.totalAmount || 1), 0);
    const completed = group.reduce(
      (sum, task) =>
        sum +
        (task.status === "completed"
          ? task.totalAmount || 1
          : task.completedAmount || 0),
      0,
    );
    return { subject, title, total, completed, unit: group[0]?.unit || "工程" };
  });
}
