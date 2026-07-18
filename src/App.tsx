import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import type { Data, Task } from "./types";
import { initialData } from "./data";
import {
  isRestorableData,
  load,
  migrate,
  pct,
  phase,
  reset,
  save,
} from "./store";
import {
  aggregateMaterials,
  deadlineForecast,
  overdueTasks,
  rebalanceDay,
  rebalanceHomeworkToDeadline,
  reviewCopies,
  suggestedMoves,
} from "./planner";
const eigo = "https://naru18vr.github.io/eigo/";
const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
const addDays = (date: string, amount: number) => {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + amount);
  return next.toLocaleDateString("sv-SE");
};
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));
const validDateInput = (value: string | null): value is string =>
  Boolean(
    value &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(new Date(`${value}T00:00:00`).getTime()),
  );
const subjectIcon = (subject: string) =>
  ({
    国語: "📕",
    数学: "📘",
    英語: "📙",
    理科: "🧪",
    社会: "🌏",
    音楽: "🎵",
    美術: "🎨",
    保健体育: "🏃",
    家庭科: "🍳",
    英検: "🔤",
  })[subject] || "📝";
const notify = (message: string) =>
  window.dispatchEvent(
    new CustomEvent("natsumanabi-notify", { detail: message }),
  );
const safeMinutes = (value: unknown, fallback = 15) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(720, Math.max(1, number))
    : fallback;
};
const safeStorageSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    notify("端末に保存できません。バックアップを作成してください");
    return false;
  }
};
const safeStorageGet = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const safeStorageRemove = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // 保存領域へアクセスできなくても画面操作は続ける。
  }
};
const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
type TrashEntry = { task: Task; deletedAt: string };
const loadTrash = (): TrashEntry[] => {
  try {
    const parsed = JSON.parse(safeStorageGet("natsumanabi-trash") || "[]");
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry) =>
            entry &&
            typeof entry.deletedAt === "string" &&
            entry.task &&
            typeof entry.task.id === "string",
        )
      : [];
  } catch {
    return [];
  }
};
const duplicateExists = (tasks: Task[], date: string, title: string) =>
  tasks.some(
    (task) =>
      task.date === date &&
      task.title.trim().toLowerCase() === title.trim().toLowerCase() &&
      task.status !== "skipped",
  );
const allowDuplicate = (tasks: Task[], date: string, title: string) =>
  !duplicateExists(tasks, date, title) ||
  confirm(`「${title}」は同じ日にあります。もう1つ追加しますか？`);
const hashPin = async (pin: string) => {
  const bytes = new TextEncoder().encode(`natsumanabi-parent:${pin}`);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  }
  return btoa(String.fromCharCode(...bytes));
};
const summerRoutine = (hasClass: boolean) =>
  hasClass
    ? [
        ["7:30", "起きる・朝ごはん", "☀️"],
        ["9:00", "今日の必須を1つ", "📚"],
        ["10:00", "休憩・水分補給", "🥤"],
        ["10:30", "今日の必須をもう1つ", "✏️"],
        ["12:00", "昼ごはん・自由時間", "🍚"],
        ["14:00", "軽い学習・持ち物確認", "🎒"],
        ["17:30", "塾の夏期講習", "🏫"],
        ["22:30", "明日の確認・寝る準備", "🌙"],
      ]
    : [
        ["7:30", "起きる・朝ごはん", "☀️"],
        ["9:00", "今日の必須を1つ", "📚"],
        ["10:00", "休憩・水分補給", "🥤"],
        ["10:30", "今日の必須をもう1つ", "✏️"],
        ["12:00", "昼ごはん・自由時間", "🍚"],
        ["14:00", "調べ学習・制作・復習", "📝"],
        ["15:30", "運動・休憩・自由時間", "🏃"],
        ["20:00", "残りの確認・読書", "✅"],
        ["22:30", "明日の確認・寝る準備", "🌙"],
      ];
export default function App() {
  const [d, setD] = useState<Data>(load);
  const [parentUnlocked, setParentUnlocked] = useState(false);
  const [simpleMode, setSimpleMode] = useState(
    () => safeStorageGet("natsumanabi-view") !== "detail",
  );
  const [largeText, setLargeText] = useState(
    () => safeStorageGet("natsumanabi-text") === "large",
  );
  const [toast, setToast] = useState("");
  const [guideOpen, setGuideOpen] = useState(
    () => safeStorageGet("natsumanabi-guide") !== "done",
  );
  const [undoHistory, setUndoHistory] = useState<Data[]>([]);
  const [undoVisible, setUndoVisible] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [saveState, setSaveState] = useState("保存済み");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const handler = (event: Event) => {
      setToast((event as CustomEvent<string>).detail);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(""), 2400);
    };
    window.addEventListener("natsumanabi-notify", handler);
    return () => {
      window.removeEventListener("natsumanabi-notify", handler);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);
  useEffect(() => {
    if (!undoVisible) return;
    const timer = setTimeout(() => setUndoVisible(false), 10000);
    return () => clearTimeout(timer);
  }, [undoVisible, undoHistory]);
  const upd = (x: Data) => {
    setUndoHistory((history) => [d, ...history].slice(0, 5));
    setUndoVisible(true);
    setSaveState("保存中…");
    setD(x);
    const saved = save(x);
    setSaveState(saved ? "保存済み" : "保存失敗");
    if (!saved) notify("保存できません。設定からバックアップしてください");
  };
  const undoLast = () => {
    const previous = undoHistory[0];
    if (!previous) return;
    setD(previous);
    const saved = save(previous);
    setSaveState(saved ? "保存済み" : "保存失敗");
    setUndoHistory((history) => history.slice(1));
    setUndoVisible(false);
    notify("元に戻しました ✓");
  };
  const lockParent = () => {
    setParentUnlocked(false);
    setUndoHistory([]);
    setUndoVisible(false);
  };
  return (
    <div
      className={`app ${simpleMode ? "simpleMode" : "detailMode"} ${largeText ? "largeText" : ""}`}
    >
      {toast && (
        <div className="successToast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
      <UpdateBanner />
      <header>
        <span className="logo">なつまなび</span>
        <div className="headerTools">
          <span className={`saveStatus ${online ? "" : "offline"}`}>
            {online ? `● ${saveState}` : "● オフライン"}
          </span>
          <InstallButton />
          <button
            type="button"
            onClick={() => {
              const next = !simpleMode;
              setSimpleMode(next);
              safeStorageSet(
                "natsumanabi-view",
                next ? "simple" : "detail",
              );
            }}
          >
            {simpleMode ? "かんたん" : "詳細"}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !largeText;
              setLargeText(next);
              safeStorageSet(
                "natsumanabi-text",
                next ? "large" : "normal",
              );
            }}
          >
            文字{largeText ? "大" : "標準"}
          </button>
          {parentUnlocked && (
            <button
              className="parentActive"
              type="button"
              onClick={() => {
                lockParent();
                notify("保護者モードを終了しました");
              }}
            >
              🔓 保護者
            </button>
          )}
          <span className="badge">v1.12</span>
        </div>
      </header>
      <main>
        <Routes>
          <Route
            path="/"
            element={<Today d={d} upd={upd} canManage={parentUnlocked} />}
          />
          <Route
            path="/week"
            element={<Week d={d} upd={upd} canManage={parentUnlocked} />}
          />
          <Route path="/calendar" element={<Calendar d={d} />} />
          <Route
            path="/homework"
            element={<Homework d={d} upd={upd} canManage={parentUnlocked} />}
          />
          <Route
            path="/eiken"
            element={
              <ParentGate
                unlocked={parentUnlocked}
                onUnlock={() => setParentUnlocked(true)}
              >
                <Eiken d={d} upd={upd} />
              </ParentGate>
            }
          />
          <Route path="/report" element={<Report d={d} />} />
          <Route
            path="/settings"
            element={
              <ParentGate
                unlocked={parentUnlocked}
                onUnlock={() => setParentUnlocked(true)}
              >
                <Settings
                  d={d}
                  upd={upd}
                  undoCount={undoHistory.length}
                  onUndo={undoLast}
                />
              </ParentGate>
            }
          />
          <Route path="/more" element={<More />} />
          <Route
            path="/parent"
            element={
              <ParentGate
                unlocked={parentUnlocked}
                onUnlock={() => setParentUnlocked(true)}
              >
                <ParentDashboard
                  d={d}
                  onLock={lockParent}
                />
              </ParentGate>
            }
          />
        </Routes>
      </main>
      <nav>
        {[
          ["/", "今日", "✓"],
          ["/week", "週間", "▦"],
          ["/calendar", "予定", "□"],
          ["/homework", "宿題", "▤"],
          ["/more", "その他", "•••"],
        ].map((x) => (
          <NavLink key={x[0]} to={x[0]} end={x[0] === "/"}>
            <b>{x[2]}</b>
            <small>{x[1]}</small>
          </NavLink>
        ))}
      </nav>
      {undoVisible && undoHistory.length > 0 && (
        <div className="globalUndo" role="status">
          <span>変更しました</span>
          <button
            type="button"
            onClick={undoLast}
          >
            ↶ 元に戻す
          </button>
          <button type="button" aria-label="閉じる" onClick={() => setUndoVisible(false)}>
            ×
          </button>
        </div>
      )}
      {!d.settings.setupDone && <Setup d={d} upd={upd} />}
      {d.settings.setupDone && guideOpen && (
        <QuickGuide onClose={() => setGuideOpen(false)} />
      )}
    </div>
  );
}
function InstallButton() {
  const [prompt, setPrompt] = useState<
    (Event & { prompt: () => Promise<void> }) | null
  >(null);
  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPrompt(event as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  if (!prompt) return null;
  return (
    <button
      className="installButton"
      type="button"
      onClick={async () => {
        try {
          await prompt.prompt();
        } catch {
          notify("ホーム画面への追加を開始できませんでした");
        }
        setPrompt(null);
      }}
    >
      ＋アプリ
    </button>
  );
}
function UpdateBanner() {
  const [ready, setReady] = useState(false);
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((nextRegistration) => {
      setRegistration(nextRegistration);
      if (nextRegistration.waiting) setReady(true);
      nextRegistration.update().catch(() => undefined);
      nextRegistration.addEventListener("updatefound", () => {
        const worker = nextRegistration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setReady(true);
          }
        });
      });
    }).catch(() => undefined);
  }, []);
  if (!ready) return null;
  return (
    <div className="updateBanner">
      <span>新しいバージョンがあります</span>
      <button
        type="button"
        onClick={() => {
          registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
          location.reload();
        }}
      >
        更新する
      </button>
    </div>
  );
}
function QuickGuide({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const guides = [
    ["① 今日やることを見る", "最初の画面に、次にやる1つが出ます。"],
    ["② 終わったら『できた』", "少しだけなら『少しできた』で大丈夫。"],
    ["③ 予定を変える", "『別の日へ』を押せば、いつでも動かせます。"],
  ];
  const finish = () => {
    safeStorageSet("natsumanabi-guide", "done");
    onClose();
  };
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="使い方">
      <div className="guideCard">
        <span className="eyebrow">30秒でわかる使い方</span>
        <div className="guideIcon">{["📋", "✅", "📅"][step]}</div>
        <h1>{guides[step][0]}</h1>
        <p>{guides[step][1]}</p>
        <div className="guideDots">
          {guides.map((_, index) => (
            <i key={index} className={index === step ? "active" : ""} />
          ))}
        </div>
        <button
          className="primary wide"
          type="button"
          onClick={() => (step < 2 ? setStep(step + 1) : finish())}
        >
          {step < 2 ? "次へ →" : "わかった！はじめる"}
        </button>
        <button className="guideSkip" type="button" onClick={finish}>
          あとで見る
        </button>
      </div>
    </div>
  );
}
function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={"card " + className}>{children}</section>;
}
function MoveTask({
  task,
  d,
  upd,
}: {
  task: Task;
  d: Data;
  upd: (d: Data) => void;
}) {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState(task.date);
  if (task.status === "completed") return null;
  const move = () => {
    if (!destination || destination === task.date) return;
    const from = task.date;
    upd({
      ...d,
      tasks: d.tasks.map((item) =>
        item.id === task.id
          ? {
              ...item,
              date: destination,
              status: "pending",
              rescheduleHistory: [
                ...item.rescheduleHistory,
                `${from}→${destination}`,
              ],
            }
          : item,
      ),
    });
    setOpen(false);
    notify(`${dateLabel(destination)}に移動しました ✓`);
  };
  const weekend = (targetDay: 6 | 0) => {
    const current = new Date(`${task.date}T00:00:00`);
    const diff = (targetDay - current.getDay() + 7) % 7 || 7;
    return addDays(task.date, diff);
  };
  return (
    <div className="moveTask">
      <button type="button" onClick={() => setOpen(!open)}>
        📅 別の日へ
      </button>
      {open && (
        <div className="movePicker">
          <b>いつにする？</b>
          <div className="moveQuick">
            <button type="button" onClick={() => setDestination(addDays(task.date, 1))}>明日</button>
            <button type="button" onClick={() => setDestination(weekend(6))}>土曜日</button>
            <button type="button" onClick={() => setDestination(weekend(0))}>日曜日</button>
          </div>
          <input
            aria-label="移動先の日付"
            type="date"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <button className="primary" type="button" onClick={move}>
            この日に移動
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            閉じる
          </button>
        </div>
      )}
    </div>
  );
}
function DeleteTask({
  task,
  d,
  upd,
}: {
  task: Task;
  d: Data;
  upd: (d: Data) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const remove = () => {
    setConfirming(false);
    const trash = loadTrash();
      safeStorageSet(
        "natsumanabi-trash",
        JSON.stringify(
          [{ task, deletedAt: new Date().toISOString() }, ...trash].slice(
            0,
            30,
          ),
        ),
      );
    upd({ ...d, tasks: d.tasks.filter((item) => item.id !== task.id) });
    notify("削除しました。下のボタンで元に戻せます");
  };
  if (confirming)
    return (
      <div className="deleteConfirm">
        <b>この予定を削除する？</b>
        <span>削除後も「設定」から復元できます</span>
        <div>
          <button className="confirmDelete" type="button" onClick={remove}>
            削除する
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            やめる
          </button>
        </div>
      </div>
    );
  return (
    <button
      className="deleteTask"
      type="button"
      onClick={() => setConfirming(true)}
    >
      🗑 削除
    </button>
  );
}
function TrashRestore({ d, upd }: { d: Data; upd: (d: Data) => void }) {
  const [items, setItems] = useState<TrashEntry[]>(loadTrash);
  const restore = (entry: TrashEntry) => {
    if (!d.tasks.some((task) => task.id === entry.task.id))
      upd({ ...d, tasks: [...d.tasks, entry.task] });
    const next = items.filter((item) => item.deletedAt !== entry.deletedAt);
    setItems(next);
    safeStorageSet("natsumanabi-trash", JSON.stringify(next));
    notify("予定を元に戻しました ✓");
  };
  if (!items.length) return <p className="muted">削除履歴はありません。</p>;
  return (
    <div className="trashList">
      {items.slice(0, 10).map((entry) => (
        <div key={entry.deletedAt}>
          <span>
            {entry.task.title}
            <small>{entry.task.date}</small>
          </span>
          <button type="button" onClick={() => restore(entry)}>
            復元
          </button>
        </div>
      ))}
    </div>
  );
}
function EditTask({
  task,
  d,
  upd,
}: {
  task: Task;
  d: Data;
  upd: (d: Data) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [subject, setSubject] = useState(task.subject);
  const [minutes, setMinutes] = useState(task.estimatedMinutes);
  const [priority, setPriority] = useState(task.priority);
  const saveEdit = () => {
    if (!title.trim()) return;
    upd({
      ...d,
      tasks: d.tasks.map((item) =>
        item.id === task.id
          ? {
              ...item,
              title: title.trim(),
              subject,
              estimatedMinutes: safeMinutes(minutes, task.estimatedMinutes),
              priority,
            }
          : item,
      ),
    });
    setOpen(false);
    notify("変更を保存しました ✓");
  };
  return (
    <div className="editTask">
      <button type="button" onClick={() => setOpen(!open)}>
        ✏️ 編集
      </button>
      {open && (
        <div className="editPanel">
          <Label t="タスク名">
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Label>
          <Label t="科目">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </Label>
          <Label t="予定時間（分）">
            <input
              type="number"
              min="1"
              max="720"
              value={minutes}
              onChange={(e) => setMinutes(safeMinutes(e.target.value, minutes))}
            />
          </Label>
          <Label t="表示場所">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task["priority"])}
            >
              <option value="required">今日の必須</option>
              <option value="normal">余裕があれば</option>
            </select>
          </Label>
          <div className="actions">
            <button className="primary" type="button" onClick={saveEdit}>
              保存
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function AddTask({
  date,
  d,
  upd,
}: {
  date: string;
  d: Data;
  upd: (d: Data) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [taskName, setTaskName] = useState("ワーク");
  const [customName, setCustomName] = useState("");
  const [range, setRange] = useState("指定なし");
  const [customRange, setCustomRange] = useState("");
  const [contents, setContents] = useState<string[]>([]);
  const [subject, setSubject] = useState("その他");
  const [minutes, setMinutes] = useState(15);
  const [priority, setPriority] = useState<Task["priority"]>("required");
  const [quickSubject, setQuickSubject] = useState("数学");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickMinutes, setQuickMinutes] = useState(15);
  const draftKey = `natsumanabi-draft-${date}`;
  const loadDraft = () => {
    try {
      const draft = JSON.parse(safeStorageGet(draftKey) || "null");
      if (!draft || typeof draft !== "object") return;
      setTaskName(typeof draft.taskName === "string" ? draft.taskName : "ワーク");
      setCustomName(typeof draft.customName === "string" ? draft.customName : "");
      setRange(typeof draft.range === "string" ? draft.range : "指定なし");
      setCustomRange(
        typeof draft.customRange === "string" ? draft.customRange : "",
      );
      setContents(
        Array.isArray(draft.contents)
          ? draft.contents.filter((item: unknown) => typeof item === "string")
          : [],
      );
      setSubject(typeof draft.subject === "string" ? draft.subject : "その他");
      setMinutes(safeMinutes(draft.minutes));
      setPriority(
        ["required", "high", "normal", "optional"].includes(draft.priority)
          ? draft.priority
          : "required",
      );
      setStep([1, 2, 3, 4].includes(draft.step) ? draft.step : 1);
      notify("入力途中から再開しました");
    } catch {
      safeStorageRemove(draftKey);
    }
  };
  useEffect(() => {
    if (!open) return;
    safeStorageSet(
      draftKey,
      JSON.stringify({
        taskName,
        customName,
        range,
        customRange,
        contents,
        subject,
        minutes,
        priority,
        step,
      }),
    );
  }, [open, draftKey, taskName, customName, range, customRange, contents, subject, minutes, priority, step]);
  const add = () => {
    const baseName =
      taskName === "その他（自由入力）" ? customName.trim() : taskName;
    if (!baseName) return;
    const selectedRange = range === "その他の範囲" ? customRange.trim() : range;
    const rangeText =
      selectedRange && selectedRange !== "指定なし" ? `：${selectedRange}` : "";
    const contentText = contents.length ? `（${contents.join("・")}）` : "";
    const cleanTitle = `${baseName}${rangeText}${contentText}`;
    if (!allowDuplicate(d.tasks, date, cleanTitle)) return;
    const now = new Date().toISOString();
    const task: Task = {
      id: `user-${makeId()}`,
      source: "user",
      subject,
      category: "追加予定",
      type: "custom",
      title: cleanTitle,
      description: "自分で追加した予定",
      date,
      estimatedMinutes: safeMinutes(minutes),
      actualMinutes: 0,
      priority,
      status: "pending",
      requiredTools: [],
      availableLocations: ["どこでも実施可能"],
      tags: [subject],
      rescheduleHistory: [],
      createdAt: now,
      updatedAt: now,
    } as Task;
    const reviews = contents.includes("間違い直し") ? reviewCopies(task) : [];
    upd({ ...d, tasks: [...d.tasks, task, ...reviews] });
    notify(`${dateLabel(date)}に追加しました ✓`);
    setTaskName("ワーク");
    setCustomName("");
    setRange("指定なし");
    setCustomRange("");
    setContents([]);
    setMinutes(15);
    setStep(1);
    safeStorageRemove(draftKey);
    setOpen(false);
  };
  const quickAddNow = () => {
    if (!quickTitle.trim()) return;
    if (!allowDuplicate(d.tasks, date, quickTitle.trim())) return;
    const base = initialData().tasks[0];
    const task: Task = {
      ...base,
      id: `quick-${makeId()}`,
      source: "quick-add",
      subject: quickSubject,
      category: "追加予定",
      type: "custom",
      title: quickTitle.trim(),
      description: "すぐ追加した予定",
      date,
      estimatedMinutes: quickMinutes,
      actualMinutes: 0,
      priority: "required",
      status: "pending",
      totalAmount: undefined,
      completedAmount: 0,
      unit: undefined,
      requiredTools: [],
      availableLocations: ["どこでも実施可能"],
      tags: [quickSubject],
      rescheduleHistory: [],
    };
    upd({ ...d, tasks: [...d.tasks, task] });
    setQuickTitle("");
    notify(`${quickTitle.trim()}を追加しました ✓`);
  };
  const previewBase =
    taskName === "その他（自由入力）"
      ? customName.trim() || "タスク名"
      : taskName;
  const previewRange = range === "その他の範囲" ? customRange.trim() : range;
  const previewTitle = `${previewBase}${previewRange && previewRange !== "指定なし" ? `：${previewRange}` : ""}${contents.length ? `（${contents.join("・")}）` : ""}`;
  const subjectMaterials: Record<string, string[]> = {
    数学: ["ドラゴン桜計算プリント", "キホンの夏", "1年生の復習評価テスト"],
    英語: ["めきめきEnglish 2", "英単語", "プリント"],
    理科: ["3年間の総仕上げ問題集", "学習整理 理科", "プリント"],
    英検: ["英検4級学習", "英単語", "リスニング"],
    国語: ["読書", "レポート", "調べ学習"],
  };
  return (
    <Card className="addTaskCard">
      <details className="quickAdd">
        <summary>⚡ すぐ追加（教科・名前・時間だけ）</summary>
        <div>
          <select
            aria-label="教科"
            value={quickSubject}
            onChange={(event) => setQuickSubject(event.target.value)}
          >
            {["国語", "数学", "英語", "理科", "社会", "その他"].map(
              (item) => <option key={item}>{item}</option>,
            )}
          </select>
          <input
            aria-label="予定の名前"
            value={quickTitle}
            onChange={(event) => setQuickTitle(event.target.value)}
            placeholder="例：数学プリント"
          />
          <select
            aria-label="予定時間"
            value={quickMinutes}
            onChange={(event) => setQuickMinutes(Number(event.target.value))}
          >
            {[10, 15, 20, 30, 45, 60].map((value) => (
              <option value={value} key={value}>{value}分</option>
            ))}
          </select>
          <button
            className="primary"
            type="button"
            disabled={!quickTitle.trim()}
            onClick={quickAddNow}
          >
            ＋ 追加
          </button>
        </div>
      </details>
      <button
        className="addTaskButton"
        type="button"
        onClick={() => {
          if (!open) loadDraft();
          setOpen(!open);
        }}
      >
        ＋ この日に予定を追加
      </button>
      {open && (
        <div className="addTaskForm">
          <div className="addGuide">
            <b>かんたん予定追加</b>
            <span>{date} に追加</span>
          </div>
          <div className="stepProgress" aria-label={`4ステップ中${step}番目`}>
            {[1, 2, 3, 4].map((value) => (
              <i key={value} className={value <= step ? "active" : ""} />
            ))}
            <span>{step} / 4</span>
          </div>
          <div className="selectionTrail">
            {step > 1 && <span>✓ {subject}</span>}
            {step > 2 && <span>✓ {taskName}</span>}
            {step > 3 && (
              <span>
                ✓ {contents.length ? contents.join("・") : "内容指定なし"}
              </span>
            )}
          </div>
          {step === 2 && (
            <div className="stepPanel">
              <h3>📚 なにを、どこまで？</h3>
              <Label t="① なにをする？">
                <select
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                >
                  {(subjectMaterials[subject] || []).length > 0 && (
                    <optgroup label={`${subject}のおすすめ`}>
                      {subjectMaterials[subject].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="ワーク・教材">
                    <option>ワーク</option>
                    <option>ドラゴン桜計算プリント</option>
                    <option>めきめきEnglish 2</option>
                    <option>キホンの夏</option>
                    <option>1年生の復習評価テスト</option>
                    <option>3年間の総仕上げ問題集</option>
                    <option>学習整理 理科</option>
                    <option>英検4級学習</option>
                  </optgroup>
                  <optgroup label="学習内容">
                    <option>プリント</option>
                    <option>宿題</option>
                    <option>予習</option>
                    <option>復習</option>
                    <option>間違い直し</option>
                    <option>テスト対策</option>
                    <option>英単語</option>
                    <option>リスニング</option>
                    <option>読書</option>
                    <option>レポート</option>
                    <option>調べ学習</option>
                    <option>制作</option>
                  </optgroup>
                  <option>その他（自由入力）</option>
                </select>
              </Label>
              {taskName === "その他（自由入力）" && (
                <Label t="タスク名を入力">
                  <input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="タスク名"
                  />
                </Label>
              )}
              <Label t="② どこまでやる？">
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                >
                  <option>指定なし</option>
                  <option>1ページ</option>
                  <option>2ページ</option>
                  <option>3ページ</option>
                  <option>5ページ</option>
                  <option>10ページ</option>
                  <option>15ページ</option>
                  <option>20ページ</option>
                  <option>1枚</option>
                  <option>2枚</option>
                  <option>3枚</option>
                  <option>5枚</option>
                  <option>10問</option>
                  <option>20問</option>
                  <option>全部</option>
                  <option>その他の範囲</option>
                </select>
              </Label>
              {range === "その他の範囲" && (
                <Label t="範囲を入力">
                  <input
                    value={customRange}
                    onChange={(e) => setCustomRange(e.target.value)}
                    placeholder="例：p.10〜15、英単語10個"
                  />
                </Label>
              )}
            </div>
          )}
          {step === 3 && (
            <fieldset className="contentChecks">
              <legend>✅ やることをタップ（いくつでもOK）</legend>
              {[
                "問題を解く",
                "丸付け",
                "間違い直し",
                "復習",
                "予習",
                "暗記",
                "読む",
                "聴く",
                "調べる",
                "下書き",
                "清書",
                "提出",
              ].map((item) => (
                <label key={item}>
                  <input
                    type="checkbox"
                    checked={contents.includes(item)}
                    onChange={(e) =>
                      setContents(
                        e.target.checked
                          ? [...contents, item]
                          : contents.filter((value) => value !== item),
                      )
                    }
                  />
                  <span>{item}</span>
                </label>
              ))}
            </fieldset>
          )}
          {step === 1 && (
            <div className="stepPanel">
              <h3>🎒 何の教科？</h3>
              <div className="subjectChoices">
                {[
                  "国語",
                  "数学",
                  "英語",
                  "理科",
                  "社会",
                  "音楽",
                  "美術",
                  "保健体育",
                  "家庭科",
                  "英検",
                  "その他",
                ].map((item) => (
                  <button
                    className={subject === item ? "selected" : ""}
                    type="button"
                    key={item}
                    onClick={() => setSubject(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="stepPanel">
              <h3>⏱ あと少しで完成！</h3>
              <div className="choiceSection">
                <b>何分くらい？</b>
                <div className="quickChoices">
                  {[10, 15, 30, 45, 60].map((value) => (
                    <button
                      className={minutes === value ? "selected" : ""}
                      type="button"
                      key={value}
                      onClick={() => setMinutes(value)}
                    >
                      {value}分
                    </button>
                  ))}
                </div>
                <label className="customMinutes">
                  その他
                  <input
                    aria-label="予定時間（分）"
                    type="number"
                    min="1"
                    max="300"
                    value={minutes}
              onChange={(e) => setMinutes(safeMinutes(e.target.value, minutes))}
                  />
                  分
                </label>
              </div>
              <div className="choiceSection">
                <b>どっちに入れる？</b>
                <div className="priorityChoices">
                  <button
                    className={priority === "required" ? "selected" : ""}
                    type="button"
                    onClick={() => setPriority("required")}
                  >
                    ⭐ 今日の必須
                  </button>
                  <button
                    className={priority === "normal" ? "selected" : ""}
                    type="button"
                    onClick={() => setPriority("normal")}
                  >
                    🌱 余裕があれば
                  </button>
                </div>
              </div>
              <div className="taskPreview">
                <small>この予定を追加します</small>
                <b>
                  {subject}　{previewTitle}
                </b>
                <span>
                  {minutes}分・
                  {priority === "required" ? "今日の必須" : "余裕があれば"}
                </span>
              </div>
            </div>
          )}
          <div className="wizardActions">
            {step > 1 ? (
              <button type="button" onClick={() => setStep(step - 1)}>
                ← もどる
              </button>
            ) : (
              <button type="button" onClick={() => setOpen(false)}>
                やめる
              </button>
            )}
            {step < 4 ? (
              <button
                className="primary"
                type="button"
                disabled={
                  step === 2 &&
                  taskName === "その他（自由入力）" &&
                  !customName.trim()
                }
                onClick={() => setStep(step + 1)}
              >
                次へ →
              </button>
            ) : (
              <button
                className="primary"
                type="button"
                disabled={
                  taskName === "その他（自由入力）" && !customName.trim()
                }
                onClick={add}
              >
                ✓ この予定を追加
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
function Today({
  d,
  upd,
  canManage,
}: {
  d: Data;
  upd: (d: Data) => void;
  canManage: boolean;
}) {
  const location = useLocation();
  const requestedDate = new URLSearchParams(location.search).get("date");
  const [date, setDate] = useState(
    validDateInput(requestedDate) ? requestedDate : today(),
  );
  useEffect(() => {
    if (validDateInput(requestedDate)) setDate(requestedDate);
  }, [requestedDate]);
  const [success, setSuccess] = useState("");
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    },
    [],
  );
  const [focusMode, setFocusMode] = useState(false);
  const tasks = d.tasks.filter((t) => t.date === date);
  const events = d.events.filter((e) => e.date === date);
  const done = tasks.filter((t) => t.status === "completed");
  const classMinutes = events
    .filter(
      (event) => event.type === "class" && event.startTime && event.endTime,
    )
    .reduce((sum, event) => {
      const [sh, sm] = event.startTime!.split(":").map(Number);
      const [eh, em] = event.endTime!.split(":").map(Number);
      return sum + (eh * 60 + em - sh * 60 - sm) + (event.travelMinutes || 0);
    }, 0);
  const lastBackup = Number(
    safeStorageGet("natsumanabi-last-backup") || 0,
  );
  const needsBackup =
    !lastBackup || Date.now() - lastBackup > 7 * 24 * 60 * 60 * 1000;
  const overdue = overdueTasks(d.tasks, date);
  const forecasts = deadlineForecast(d.tasks, date);
  const requiredTasks = tasks.filter((task) => task.priority === "required");
  const optionalTasks = tasks.filter((task) => task.priority !== "required");
  const moveSuggestions = suggestedMoves(
    d.tasks,
    date,
    d.settings.dailyLimitMinutes,
  );
  const balanceStart =
    date < d.settings.studyStartDate ? d.settings.studyStartDate : date;
  const homeworkBalance =
    date <= d.settings.homeworkGoalDate
      ? rebalanceHomeworkToDeadline(
          d.tasks,
          balanceStart,
          d.settings.homeworkGoalDate,
          d.settings.dailyLimitMinutes,
        )
      : null;
  const remainingHomework = d.tasks.filter(
    (task) =>
      task.category === "夏休み宿題" &&
      task.status !== "completed" &&
      task.status !== "skipped",
  );
  const balanceChangeCount = homeworkBalance
    ? d.tasks.filter(
        (task, index) => homeworkBalance.tasks[index]?.date !== task.date,
      ).length
    : 0;
  const displayedRequired = focusMode
    ? requiredTasks.filter((task) => task.status !== "completed").slice(0, 1)
    : requiredTasks;
  const mins = tasks.reduce((s, t) => s + t.estimatedMinutes, 0);
  const actual = done.reduce(
    (s, t) => s + (t.actualMinutes || t.estimatedMinutes),
    0,
  );
  function status(t: Task, s: Task["status"]) {
    let date2 = t.date,
      h = [...t.rescheduleHistory];
    if (s === "rescheduled") {
      const x = new Date(t.date + "T00:00:00");
      x.setDate(x.getDate() + 1);
      date2 = x.toLocaleDateString("sv-SE");
      h.push(`${t.date}→${date2}`);
    }
    upd({
      ...d,
      tasks: d.tasks.map((a) =>
        a.id === t.id
          ? {
              ...a,
              status: s,
              date: date2,
              rescheduleHistory: h,
              completedAt:
                s === "completed" ? new Date().toISOString() : undefined,
              actualMinutes:
                s === "completed"
                  ? a.actualMinutes || a.estimatedMinutes
                  : a.actualMinutes,
            }
          : a,
      ),
    });
    if (s === "completed") {
      const next = requiredTasks.find(
        (task) => task.id !== t.id && task.status !== "completed",
      );
      setSuccess(
        next
          ? `できた！ 次は「${next.title}」`
          : "できた！ 今日の必須は全部おわり 🎉",
      );
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSuccess(""), 3200);
    }
  }
  const changeDate = (days: number) => {
    const next = new Date(date + "T00:00:00");
    next.setDate(next.getDate() + days);
    setDate(next.toLocaleDateString("sv-SE"));
  };
  const moveOverdueToToday = () =>
    upd({
      ...d,
      tasks: d.tasks.map((task) =>
        overdue.some((item) => item.id === task.id)
          ? {
              ...task,
              date,
              rescheduleHistory: [
                ...task.rescheduleHistory,
                `${task.date}→${date}（未完了整理）`,
              ],
            }
          : task,
      ),
    });
  const reorder = (task: Task, direction: -1 | 1) => {
    const indices = d.tasks
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item }) =>
          item.date === task.date && item.priority === task.priority,
      );
    const position = indices.findIndex(({ item }) => item.id === task.id);
    const target = indices[position + direction];
    if (!target) return;
    const sourceIndex = indices[position].index;
    const next = [...d.tasks];
    [next[sourceIndex], next[target.index]] = [
      next[target.index],
      next[sourceIndex],
    ];
    upd({ ...d, tasks: next });
  };
  const quickAdd = (title: string, subject: string, minutes: number) => {
    if (!allowDuplicate(d.tasks, date, title)) return;
    const base = initialData().tasks[0];
    upd({
      ...d,
      tasks: [
        ...d.tasks,
        {
          ...base,
          id: `quick-${makeId()}`,
          source: "quick-template",
          category: "追加予定",
          type: "custom",
          title,
          subject,
          date,
          estimatedMinutes: minutes,
          totalAmount: undefined,
          completedAmount: 0,
          unit: undefined,
          status: "pending",
          priority: "required",
          rescheduleHistory: [],
        },
      ],
    });
    notify(`${title}を追加しました ✓`);
  };
  return (
    <>
      {success && (
        <div className="successToast" role="status" aria-live="polite">
          🎉 {success}
        </div>
      )}
      <div className="hero">
        <div>
          <span>{phase(date)}期間</span>
          <h1>今日も、一歩ずつ。</h1>
          <p className="displayDate">{dateLabel(date)}</p>
          <input
            aria-label="表示日"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div
          className="ring"
          style={
            {
              "--p": `${pct(done.length, tasks.length) * 3.6}deg`,
            } as CSSProperties
          }
        >
          <b>{pct(done.length, tasks.length)}%</b>
          <small>達成</small>
        </div>
      </div>
      {requiredTasks.find((task) => task.status !== "completed") && (
        <Card className="nextTaskCard">
          <span className="eyebrow">次はこれ！</span>
          <h2>
            {subjectIcon(
              requiredTasks.find((task) => task.status !== "completed")!
                .subject,
            )}{" "}
            {requiredTasks.find((task) => task.status !== "completed")!.subject}
          </h2>
          <h3>
            {requiredTasks.find((task) => task.status !== "completed")!.title}
          </h3>
          <p>
            目安{" "}
            {
              requiredTasks.find((task) => task.status !== "completed")!
                .estimatedMinutes
            }
            分
          </p>
          <button
            className="primary wide"
            type="button"
            onClick={() => setFocusMode(true)}
          >
            ▶ はじめる
          </button>
        </Card>
      )}
      <div className="stats">
        <div>
          <b>{mins}</b>
          <small>予定 分</small>
        </div>
        <div>
          <b>{actual}</b>
          <small>完了 分</small>
        </div>
        <div>
          <b>{tasks.length - done.length}</b>
          <small>残り</small>
        </div>
      </div>
      <div className="dateNav">
        <button type="button" onClick={() => changeDate(-1)}>
          ← 前の日
        </button>
        <button type="button" onClick={() => setDate(today())}>
          今日
        </button>
        <button type="button" onClick={() => changeDate(1)}>
          次の日 →
        </button>
      </div>
      {date >= addDays(d.settings.studyStartDate, -7) &&
        date <= d.settings.summerVacationEndDate && (
          <Card className="summerRoutine">
            <div className="routineHeading">
              <div>
                <span className="eyebrow">毎日の目安</span>
                <h2>🌻 夏休みの基本スケジュール</h2>
              </div>
              {classMinutes > 0 && <b>塾の日</b>}
            </div>
            <p>
              {date < d.settings.studyStartDate
                ? `${dateLabel(d.settings.studyStartDate)}からこの流れで始めます。`
                : "時間がずれても大丈夫。上から順に進めよう。"}
            </p>
            <ol>
              {summerRoutine(classMinutes > 0).map(([time, label, icon]) => (
                <li key={`${time}-${label}`}>
                  <time>{time}</time>
                  <span aria-hidden="true">{icon}</span>
                  <b>{label}</b>
                </li>
              ))}
            </ol>
          </Card>
        )}
      <button
        className={`focusButton ${focusMode ? "active" : ""}`}
        type="button"
        onClick={() => setFocusMode(!focusMode)}
      >
        {focusMode ? "一覧に戻る" : "🎯 今からやる1つだけを見る"}
      </button>
      <details className="todaySupport">
        <summary>＋ 予定の追加・整理</summary>
        <div>
      {canManage && <div className="quickTemplates">
        <b>よく使う予定</b>
        <div>
          <button type="button" onClick={() => quickAdd("英単語", "英語", 10)}>
            英単語 10分
          </button>
          <button
            type="button"
            onClick={() => quickAdd("数学プリント：2枚", "数学", 20)}
          >
            数学プリント
          </button>
          <button
            type="button"
            onClick={() => quickAdd("間違い直し", "その他", 15)}
          >
            間違い直し
          </button>
        </div>
      </div>}
      {overdue.length > 0 && (
        <Card className="overdueCard">
          <h3>📦 前の日から残っている予定</h3>
          <p>{overdue.length}件あります。責めずに、今日へ調整しよう。</p>
          {overdue.slice(0, 4).map((task) => (
            <small key={task.id}>・{task.title}</small>
          ))}
          {canManage && <button
            className="primary wide"
            type="button"
            onClick={moveOverdueToToday}
          >
            まとめて今日へ移動
          </button>}
        </Card>
      )}
      {homeworkBalance && remainingHomework.length > 0 && (
        <Card className="balanceCard">
          <h3>📚 7月31日までにちょうどよく配分</h3>
          <p>
            残り{remainingHomework.length}件を、{dateLabel(balanceStart)}から締切までの
            {homeworkBalance.daily.length}日間へ均等に組み直します。
          </p>
          <p>{balanceChangeCount}件の日付を調整します。</p>
          <div className="balancePreview">
            {homeworkBalance.daily.map((day) => (
              <span
                className={
                  day.minutes > d.settings.dailyLimitMinutes ? "over" : ""
                }
                key={day.date}
              >
                <b>{Number(day.date.slice(-2))}日</b>
                {day.minutes}分
              </span>
            ))}
          </div>
          {homeworkBalance.overflowMinutes > 0 && (
            <p className="balanceWarning">
              ⚠️ 全部終えるには、上限を超える日が合計
              {homeworkBalance.overflowMinutes}分あります。
            </p>
          )}
          {canManage && <button
            className="primary wide"
            type="button"
            disabled={!balanceChangeCount}
            onClick={() => {
              upd({ ...d, tasks: homeworkBalance.tasks });
              notify("7月31日までの宿題を組み直しました ✓");
            }}
          >
            {balanceChangeCount
              ? "7月31日までに均等に組み直す"
              : "すでに均等です ✓"}
          </button>}
        </Card>
      )}
      {mins > d.settings.dailyLimitMinutes && !homeworkBalance && (
        <Card className="adjustCard">
          <h3>🪄 今日は少し多め</h3>
          <p>
            {mins}分の予定を、上限{d.settings.dailyLimitMinutes}分に近づけます。
          </p>
          {moveSuggestions.length > 0 && (
            <div className="moveSuggestion">
              <b>明日へ移す候補</b>
              {moveSuggestions.map((task) => (
                <span key={task.id}>・{task.title}（{task.estimatedMinutes}分）</span>
              ))}
            </div>
          )}
          {canManage && <button
            className="primary wide"
            type="button"
            onClick={() =>
              upd({
                ...d,
                tasks: rebalanceDay(
                  d.tasks,
                  date,
                  d.settings.dailyLimitMinutes,
                ),
              })
            }
          >
            余裕タスクを明日へ調整
          </button>}
        </Card>
      )}
      {forecasts[0] && (
        <div className="forecastNotice">
          🏁 {forecasts[0].dueDate}まで、1日約{forecasts[0].minutesPerDay}
          分で進めると間に合います
        </div>
      )}
      {classMinutes > 0 && (
        <div className="loadNotice">
          🏫 今日は塾が{Math.round(classMinutes / 60)}
          時間。家の勉強は少なめでOK！
        </div>
      )}
      {needsBackup && (
        <NavLink className="backupNotice" to="/settings">
          💾 記録を守るため、バックアップしておこう
        </NavLink>
      )}
        </div>
      </details>
      {events.map((event) => (
        <Card key={event.id} className="classEvent">
          <span className="subject">夏期講習</span>
          <h3>{event.title}</h3>
          <p>
            🕒 {event.startTime}〜{event.endTime}　📍{event.location}
          </p>
          {event.notes && <p>{event.notes}</p>}
        </Card>
      ))}
      {canManage ? (
        <AddTask date={date} d={d} upd={upd} />
      ) : (
        <NavLink className="parentHint" to="/parent">
          🔒 予定の追加・変更は保護者モード
        </NavLink>
      )}
      <h2>今日の必須</h2>
      {displayedRequired.length ? (
        displayedRequired.map((t) => (
          <TaskRow
            key={t.id}
            t={t}
            status={status}
            d={d}
            upd={upd}
            onUp={() => reorder(t, -1)}
            onDown={() => reorder(t, 1)}
            canManage={canManage}
          />
        ))
      ) : (
        <Card>
          <p>この日の必須予定はありません。「この日に予定を追加」から作れます。</p>
        </Card>
      )}
      <h2>追加・短時間</h2>
      {!focusMode &&
        optionalTasks.map((t) => (
          <TaskRow
            key={t.id}
            t={t}
            status={status}
            d={d}
            upd={upd}
            onUp={() => reorder(t, -1)}
            onDown={() => reorder(t, 1)}
            canManage={canManage}
          />
        ))}
      <a
        className="button secondary"
        href={eigo}
        target="_blank"
        rel="noopener noreferrer"
      >
        英検アプリを開く ↗
      </a>
    </>
  );
}
function TaskRow({
  t,
  status,
  d,
  upd,
  onUp,
  onDown,
  canManage,
}: {
  t: Task;
  status: (t: Task, s: Task["status"]) => void;
  d: Data;
  upd: (d: Data) => void;
  onUp?: () => void;
  onDown?: () => void;
  canManage: boolean;
}) {
  const [partialOpen, setPartialOpen] = useState(false);
  const [partialAmount, setPartialAmount] = useState(t.completedAmount || 0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);
  const saveTime = () => {
    const actualMinutes = Math.max(1, Math.ceil(seconds / 60));
    upd({
      ...d,
      tasks: d.tasks.map((item) =>
        item.id === t.id ? { ...item, actualMinutes } : item,
      ),
    });
    setRunning(false);
  };
  const savePartial = () => {
    upd({
      ...d,
      tasks: d.tasks.map((item) =>
        item.id === t.id
          ? { ...item, status: "partial", completedAmount: partialAmount }
          : item,
      ),
    });
    setPartialOpen(false);
  };
  return (
    <Card className={t.status === "completed" ? "done" : ""}>
      <div className="task">
        <button
          className="check"
          type="button"
          aria-label={`${t.title}を${t.status === "completed" ? "未完了に戻す" : "完了にする"}`}
          onClick={() =>
            status(t, t.status === "completed" ? "pending" : "completed")
          }
        >
          {t.status === "completed" ? "✓" : ""}
        </button>
        <div>
          <span className={"subject " + t.subject}>
            {subjectIcon(t.subject)} {t.subject}
          </span>
          <h3>{t.title}</h3>
          <p>
            予定 {t.estimatedMinutes}分
            {t.actualMinutes > 0 && ` → 実際 ${t.actualMinutes}分`} ・{" "}
            {t.availableLocations[0]}
          </p>
          {t.totalAmount && (
            <progress value={t.completedAmount || 0} max={t.totalAmount} />
          )}
        </div>
      </div>
      <div className="actions">
        <button
          className="completeAction"
          type="button"
          onClick={() => status(t, "completed")}
        >
          ✅ できた
        </button>
        <button
          type="button"
          onClick={() =>
            t.totalAmount ? setPartialOpen(!partialOpen) : status(t, "partial")
          }
        >
          ◐ 少しできた
        </button>
        {canManage && <MoveTask task={t} d={d} upd={upd} />}
      </div>
      {partialOpen && t.totalAmount && (
        <div className="partialPanel">
          <b>どこまでできた？</b>
          <div>
            <input
              type="number"
              min="0"
              max={t.totalAmount}
              value={partialAmount}
              onChange={(e) =>
                setPartialAmount(
                  Math.min(t.totalAmount || 0, Math.max(0, Number(e.target.value) || 0)),
                )
              }
            />
            <span>
              ／ {t.totalAmount}
              {t.unit}
            </span>
          </div>
          <button className="primary" type="button" onClick={savePartial}>
            記録する
          </button>
        </div>
      )}
      <details className="moreActions">
        <summary>… その他</summary>
        {canManage && <div className="taskTools">
          <div className="orderButtons">
            <button type="button" onClick={onUp}>
              ↑ 上へ
            </button>
            <button type="button" onClick={onDown}>
              ↓ 下へ
            </button>
          </div>
          <EditTask task={t} d={d} upd={upd} />
          <DeleteTask task={t} d={d} upd={upd} />
        </div>}
        <div className="timerPanel">
          <b>
            ⏱ {String(Math.floor(seconds / 60)).padStart(2, "0")}:
            {String(seconds % 60).padStart(2, "0")}
          </b>
          <button type="button" onClick={() => setRunning(!running)}>
            {running ? "一時停止" : "スタート"}
          </button>
          {seconds > 0 && (
            <button className="primary" type="button" onClick={saveTime}>
              時間を記録
            </button>
          )}
        </div>
      </details>
    </Card>
  );
}
function Week({
  d,
  upd,
  canManage,
}: {
  d: Data;
  upd: (d: Data) => void;
  canManage: boolean;
}) {
  const [start, setStart] = useState("2026-07-21");
  const [openDay, setOpenDay] = useState("");
  const ds = Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start + "T00:00:00");
    x.setDate(x.getDate() + i);
    return x.toLocaleDateString("sv-SE");
  });
  return (
    <>
      <Title t="週間予定" sub="1週間の負担を見渡そう" />
      <input
        aria-label="週の開始日"
        type="date"
        value={start}
        onChange={(e) => setStart(e.target.value)}
      />
      <div className="weekNav">
        <button type="button" onClick={() => setStart(addDays(start, -7))}>
          ← 前の週
        </button>
        <button
          type="button"
          onClick={() =>
            setStart(today() < d.settings.studyStartDate ? d.settings.studyStartDate : today())
          }
        >
          今週
        </button>
        <button type="button" onClick={() => setStart(addDays(start, 7))}>
          次の週 →
        </button>
      </div>
      {ds.map((x) => {
        const ts = d.tasks.filter((t) => t.date === x);
        const es = d.events.filter((e) => e.date === x);
        return (
          <Card key={x}>
            <button
              className="dayToggle"
              type="button"
              onClick={() => setOpenDay(openDay === x ? "" : x)}
            >
              <span>
                <b>{dateLabel(x)}</b>
                <small>
                  {ts.length}個・
                  {ts.reduce((a, t) => a + t.estimatedMinutes, 0)}分
                </small>
              </span>
              <b>{openDay === x ? "▲" : "▼"}</b>
            </button>
            {openDay === x && (
              <div className="dayContents">
                {es.map((event) => (
                  <p key={event.id}>
                    🏫 {event.startTime}〜{event.endTime} {event.title}
                  </p>
                ))}
                {ts.map((t) => (
                  <div className="weekTask" key={t.id}>
                    <p>
                      {t.status === "completed" ? "✅" : "□"}{" "}
                      {subjectIcon(t.subject)} {t.subject}　{t.title}
                    </p>
                    {canManage && <div className="taskTools">
                      <EditTask task={t} d={d} upd={upd} />
                      <MoveTask task={t} d={d} upd={upd} />
                      <DeleteTask task={t} d={d} upd={upd} />
                    </div>}
                  </div>
                ))}
                {!ts.length && !es.length && <p className="muted">予定なし</p>}
                {canManage && <AddTask date={x} d={d} upd={upd} />}
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}
function Calendar({ d }: { d: Data }) {
  const navigate = useNavigate();
  const knownDates = [
    today(),
    d.settings.studyStartDate,
    d.settings.examDate,
    ...d.tasks.map((task) => task.date),
    ...d.events.map((event) => event.date),
  ].filter(Boolean).sort();
  const firstDate = knownDates[0];
  const lastDate = knownDates[knownDates.length - 1];
  const rawDateCount = Math.max(
    1,
    Math.round(
      (new Date(`${lastDate}T00:00:00`).getTime() -
        new Date(`${firstDate}T00:00:00`).getTime()) /
        86400000,
    ) + 1,
  );
  const dateCount = Math.min(rawDateCount, 550);
  const dates = Array.from({ length: dateCount }, (_, i) => {
    const x = new Date(`${firstDate}T00:00:00`);
    x.setDate(x.getDate() + i);
    return x.toLocaleDateString("sv-SE");
  });
  const months = [...new Set(dates.map((date) => date.slice(0, 7)))];
  return (
    <>
      <Title
        t="カレンダー"
        sub="日付をタップすると、その日の学習画面へ移動します"
      />
      <div className="legend">
        <span>🟧 宿題</span>
        <span>🟦 英検</span>
        <span>🟪 テスト</span>
      </div>
      {rawDateCount > dateCount && (
        <p className="notice">表示期間が長いため、最初の550日を表示しています。</p>
      )}
      {months.map((month) => {
        const monthDates = dates.filter((date) => date.startsWith(month));
        const leading = new Date(`${monthDates[0]}T00:00:00`).getDay();
        return (
          <section className="calendarMonth" key={month}>
            <h2>{Number(month.slice(5))}月</h2>
            <div className="weekdayRow" aria-hidden="true">
              {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="calendar">
              {Array.from({ length: leading }, (_, index) => (
                <span className="calendarBlank" key={`blank-${index}`} />
              ))}
              {monthDates.map((x) => {
                const classEvent = d.events.find(
                  (event) => event.type === "class" && event.date === x,
                );
                return (
                  <button
                    type="button"
                    aria-label={`${dateLabel(x)}の学習画面を開く`}
                    className={`day ${d.settings.accommodationDates.includes(x) ? "stay" : ""}`}
                    key={x}
                    onClick={() => navigate(`/?date=${x}`)}
                  >
                    <b>{Number(x.slice(-2))}</b>
                    <small>
                      {new Intl.DateTimeFormat("ja-JP", {
                        weekday: "short",
                      }).format(new Date(`${x}T00:00:00`))}
                    </small>
                    <i>
                      {x === "2026-07-31"
                        ? "🏁宿題"
                        : x === "2026-08-31"
                          ? "🏫終了"
                          : d.settings.periodicTestDates.includes(x)
                            ? "📝テスト"
                            : x === "2026-09-25"
                              ? "E 英検"
                              : classEvent
                                ? "🏫17:30"
                                : d.settings.accommodationDates.includes(x)
                                  ? "🧳宿泊"
                                  : ""}
                    </i>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
function Homework({
  d,
  upd,
  canManage,
}: {
  d: Data;
  upd: (d: Data) => void;
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("すべて");
  const [statusFilter, setStatusFilter] = useState("未完了");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkDate, setBulkDate] = useState(today());
  const materials = aggregateMaterials(
    d.tasks.filter((task) => task.category === "夏休み宿題"),
  );
  const foundTasks = d.tasks.filter((task) => {
    const matchesQuery = `${task.subject} ${task.title}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    const matchesSubject =
      subjectFilter === "すべて" || task.subject === subjectFilter;
    const matchesStatus =
      statusFilter === "すべて" ||
      (statusFilter === "完了" && task.status === "completed") ||
      (statusFilter === "未完了" && task.status !== "completed");
    return matchesQuery && matchesSubject && matchesStatus;
  });
  const clearSelection = () => setSelected([]);
  const completeSelected = () => {
    upd({
      ...d,
      tasks: d.tasks.map((task) =>
        selected.includes(task.id)
          ? {
              ...task,
              status: "completed" as const,
              completedAt: new Date().toISOString(),
              actualMinutes: task.actualMinutes || task.estimatedMinutes,
            }
          : task,
      ),
    });
    notify(`${selected.length}件を完了にしました ✓`);
    clearSelection();
  };
  const moveSelected = () => {
    upd({
      ...d,
      tasks: d.tasks.map((task) =>
        selected.includes(task.id)
          ? {
              ...task,
              date: bulkDate,
              status: "pending" as const,
              rescheduleHistory: [
                ...task.rescheduleHistory,
                ...(task.date === bulkDate
                  ? []
                  : [`${task.date}→${bulkDate}（まとめて移動）`]),
              ],
            }
          : task,
      ),
    });
    notify(`${selected.length}件を${dateLabel(bulkDate)}へ移動しました ✓`);
    clearSelection();
  };
  const deleteSelected = () => {
    if (!confirm(`${selected.length}件を削除しますか？ 設定から復元できます。`)) return;
    const trash = loadTrash();
    const deleted = d.tasks
      .filter((task) => selected.includes(task.id))
      .map((task, index) => ({
        task,
        deletedAt: `${new Date().toISOString()}-${index}`,
      }));
    safeStorageSet(
      "natsumanabi-trash",
      JSON.stringify([...deleted, ...trash].slice(0, 30)),
    );
    upd({ ...d, tasks: d.tasks.filter((task) => !selected.includes(task.id)) });
    notify(`${selected.length}件を削除しました`);
    clearSelection();
  };
  return (
    <>
      <Title t="宿題一覧" sub="教材ごとの累計進捗" />
      <Card className="taskSearch">
        <h3>🔎 予定を探す</h3>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="名前を入力（例：プリント）"
          aria-label="予定名で検索"
        />
        <div>
          <select
            aria-label="教科で絞り込み"
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
          >
            <option>すべて</option>
            {[...new Set(d.tasks.map((task) => task.subject))].map((subject) => (
              <option key={subject}>{subject}</option>
            ))}
          </select>
          <select
            aria-label="完了状態で絞り込み"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option>未完了</option>
            <option>完了</option>
            <option>すべて</option>
          </select>
        </div>
        <small>{foundTasks.length}件見つかりました</small>
        {canManage && selected.length > 0 && (
          <div className="bulkActions">
            <b>{selected.length}件を選択中</b>
            <input
              type="date"
              aria-label="まとめて移動する日"
              value={bulkDate}
              onChange={(event) => setBulkDate(event.target.value)}
            />
            <button className="primary" type="button" onClick={moveSelected}>
              まとめて移動
            </button>
            <button type="button" onClick={completeSelected}>
              まとめて完了
            </button>
            <button className="danger" type="button" onClick={deleteSelected}>
              まとめて削除
            </button>
            <button type="button" onClick={clearSelection}>
              選択をやめる
            </button>
          </div>
        )}
        <div className="searchResults">
          {foundTasks.slice(0, 20).map((task) => (
            <div
              className={`searchResult ${canManage ? "" : "readOnly"}`}
              key={task.id}
            >
              {canManage && <label>
                <input
                  type="checkbox"
                  aria-label={`${task.title}を選択`}
                  checked={selected.includes(task.id)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, task.id]
                        : selected.filter((id) => id !== task.id),
                    )
                  }
                />
              </label>}
              <NavLink to={`/?date=${task.date}`}>
                <span>{subjectIcon(task.subject)} {task.title}</span>
                <small>{dateLabel(task.date)}・{task.estimatedMinutes}分</small>
              </NavLink>
            </div>
          ))}
          {!foundTasks.length && <p className="muted">当てはまる予定はありません。</p>}
        </div>
      </Card>
      <h2>教材ごとの進み具合</h2>
      {materials.map((material) => (
        <Card key={`${material.subject}-${material.title}`}>
          <div className="between">
            <div>
              <span className={`subject ${material.subject}`}>
                {material.subject}
              </span>
              <h3>{material.title}</h3>
            </div>
            <b>{pct(material.completed, material.total)}%</b>
          </div>
          <progress value={material.completed} max={material.total} />
          <p>
            {material.completed} / {material.total}
            {material.unit}　目標 7月31日
          </p>
        </Card>
      ))}
    </>
  );
}
function Eiken({ d, upd }: { d: Data; upd: (d: Data) => void }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);
  function parse(raw: string) {
    if (!raw.trim()) {
      setMsg("取り込む文章またはJSONを入力してください。");
      return;
    }
    try {
      let arr: any[] = [];
      try {
        const j = JSON.parse(raw);
        arr = Array.isArray(j.tasks) ? j.tasks : [];
      } catch {
        arr = raw
          .split("\n")
          .filter(Boolean)
          .map((x, i) => ({
            id: `text-${Date.now()}-${i}`,
            date: "2026-08-01",
            title: x,
            estimatedMinutes: 15,
            type: "daily_15min",
            priority: "required",
          }));
      }
      let add = 0,
        update = 0,
        dup = 0;
      const tasks = [...d.tasks];
      for (const x of arr) {
        const importedId =
          typeof x.id === "string" && x.id ? x.id : makeId();
        const i = tasks.findIndex((t) => t.id === importedId);
        const base: Task = {
          id: importedId,
          source: x.source || "eiken4-app",
          subject: "英検",
          category: "英検4級",
          type: x.type || "daily_15min",
          title:
            typeof x.title === "string" && x.title.trim()
              ? x.title.trim()
              : "英検学習",
          description: typeof x.description === "string" ? x.description : "",
          date: validDateInput(x.date) ? x.date : "2026-08-01",
          estimatedMinutes: safeMinutes(x.estimatedMinutes),
          actualMinutes: 0,
          priority: ["required", "high", "normal", "optional"].includes(
            x.priority,
          )
            ? x.priority
            : "required",
          status: ["pending", "completed", "partial", "skipped"].includes(
            x.status,
          )
            ? x.status
            : "pending",
          requiredTools: ["スマートフォン"],
          availableLocations: ["スマートフォンがあれば可能"],
          launchUrl: x.launchUrl || eigo,
          tags: Array.isArray(x.tags)
            ? x.tags.filter((tag: unknown) => typeof tag === "string")
            : ["英検4級"],
          rescheduleHistory: [],
        };
        if (i < 0) {
          tasks.push(base);
          add++;
        } else if (tasks[i].status === "completed") {
          dup++;
        } else {
          tasks[i] = {
            ...tasks[i],
            ...base,
            result: tasks[i].result || base.result,
          };
          update++;
        }
      }
      upd({
        ...d,
        tasks,
        importHistory: [
          ...d.importHistory,
          {
            id: makeId(),
            addedCount: add,
            updatedCount: update,
            duplicateCount: dup,
            importedAt: new Date().toISOString(),
          },
        ],
      });
      setMsg(`追加 ${add}件・更新 ${update}件・重複 ${dup}件`);
    } catch {
      setMsg("読み込みに失敗しました。JSONの形式を確認してください。");
    }
  }
  return (
    <>
      <Title t="英検4級" sub="計画を取り込んで、全体予定に合流" />
      <Card>
        <h3>英検アプリと連携</h3>
        <p>JSONまたは1行1タスクの文章を貼り付けます。外部へ送信しません。</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ここに貼り付け"
        />
        <div className="actions">
          <button className="primary" type="button" onClick={() => parse(text)}>
            内容を確認して取り込む
          </button>
          <button type="button" onClick={() => file.current?.click()}>
            JSONファイル
          </button>
        </div>
        <input
          hidden
          ref={file}
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              const s = await f.text();
              setText(s);
              parse(s);
            }
          }}
        />
        {msg && <p className="notice">{msg}</p>}
      </Card>
      <a
        className="button"
        href={eigo}
        target="_blank"
        rel="noopener noreferrer"
      >
        英検アプリを開く ↗
      </a>
      {d.tasks
        .filter((t) => t.category === "英検4級")
        .slice(-10)
        .map((t) => (
          <Card key={t.id}>
            <span className="subject 英検">{t.type}</span>
            <h3>{t.title}</h3>
            <p>
              {t.date}・{t.estimatedMinutes}分
            </p>
          </Card>
        ))}
    </>
  );
}
function reportText(d: Data, date = today()) {
  const ts = d.tasks.filter((t) => t.date === date),
    done = ts.filter((t) => t.status === "completed"),
    adj = d.tasks.filter((t) =>
      t.rescheduleHistory.some((x) => x.startsWith(date)),
    );
  return `【${date}の学習報告】\n\n■ 今日の学習\n予定：${ts.length}項目・${ts.reduce((a, t) => a + t.estimatedMinutes, 0)}分\n完了：${done.length}項目・${done.reduce((a, t) => a + (t.actualMinutes || t.estimatedMinutes), 0)}分\n\nできたこと\n${done.map((t) => `・${t.subject} ${t.title}`).join("\n") || "・これから記録します"}\n\n明日に調整\n${adj.map((t) => `・${t.title}`).join("\n") || "・なし"}\n\n次回も一歩ずつ進めます。`;
}
function Report({ d }: { d: Data }) {
  const [date, setDate] = useState(today()),
    [copied, setCopied] = useState(false),
    text = reportText(d, date);
  return (
    <>
      <Title t="今日の報告" sub="この画面をスクリーンショットできます" />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <Card className="report">
        <pre>{text}</pre>
      </Card>
      <button
        className="primary wide"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          } catch {
            notify("コピーできませんでした。文章を長押ししてコピーしてください");
          }
        }}
      >
        {copied ? "コピーしました ✓" : "Google Chat用にコピー"}
      </button>
      <p className="privacy">
        自動送信はしません。コピー後にGoogle Chatへ貼り付けてください。
      </p>
    </>
  );
}
function Settings({
  d,
  upd,
  undoCount,
  onUndo,
}: {
  d: Data;
  upd: (d: Data) => void;
  undoCount: number;
  onUndo: () => void;
}) {
  const s = d.settings;
  const [restoreCandidate, setRestoreCandidate] = useState<Data | null>(null);
  const set = (k: keyof typeof s, v: any) =>
    upd({ ...d, settings: { ...s, [k]: v } });
  const backupFile = () =>
    new File(
      [
        JSON.stringify(
          { ...d, appVersion: 2, exportedAt: new Date().toISOString() },
          null,
          2,
        ),
      ],
      `なつまなび-backup-${today()}.json`,
      { type: "application/json" },
    );
  function backup() {
    const file = backupFile();
    const a = document.createElement("a");
    const url = URL.createObjectURL(file);
    a.href = url;
    a.download = `なつまなび-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    safeStorageSet("natsumanabi-last-backup", String(Date.now()));
    notify("バックアップを保存しました ✓");
  }
  async function shareBackup() {
    const file = backupFile();
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "なつまなびバックアップ",
          text: "別の端末へ移すためのバックアップです。",
          files: [file],
        });
        notify("バックアップを共有しました ✓");
      } else {
        backup();
        notify("共有に未対応のため、ファイルに保存しました");
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") {
        notify("共有できませんでした。JSONを書き出してください");
      }
    }
  }
  return (
    <>
      <Title t="設定" sub="日程・教材・データ管理" />
      <Card>
        <h3>↶ 変更履歴</h3>
        <p>直前から最大5回分まで、順番に元へ戻せます。</p>
        <button type="button" disabled={!undoCount} onClick={onUndo}>
          {undoCount ? `1つ元に戻す（残り${undoCount}回）` : "戻せる変更はありません"}
        </button>
      </Card>
      <Card>
        <h3>基本設定</h3>
        <Label t="1日の上限（分）">
          <input
            type="number"
            min="15"
            max="720"
            value={s.dailyLimitMinutes}
            onChange={(e) =>
              set(
                "dailyLimitMinutes",
                safeMinutes(e.target.value, s.dailyLimitMinutes),
              )
            }
          />
        </Label>
        <Label t="国語の課題">
          <select
            value={s.japaneseChoice}
            onChange={(e) => set("japaneseChoice", e.target.value)}
          >
            <option>未確認</option>
            <option>読書感想文</option>
            <option>調べる学習</option>
          </select>
        </Label>
        <Label t="理科の臓器">
          <input
            value={s.organChoice}
            onChange={(e) => set("organChoice", e.target.value)}
          />
        </Label>
        <Label t="キホンの夏 総ページ">
          <input
            type="number"
            min="0"
            max="999"
            value={s.kihonPages}
            onChange={(e) =>
              set(
                "kihonPages",
                Math.min(999, Math.max(0, Number(e.target.value) || 0)),
              )
            }
          />
        </Label>
        <Label t="宿泊日（カンマ区切り）">
          <input
            value={s.accommodationDates.join(",")}
            onChange={(e) =>
              set(
                "accommodationDates",
                e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              )
            }
            placeholder="2026-07-25,2026-07-26"
          />
        </Label>
      </Card>
      <Card>
        <h3>夏期講習</h3>
        <p>登録済みの夏期講習予定です。</p>
        {d.events
          .filter((e) => e.type === "class")
          .map((e) => (
            <p key={e.id}>
              {e.date} {e.title}
            </p>
          ))}
      </Card>
      <Card>
        <h3>バックアップ</h3>
        <p>
          ブラウザのサイトデータを削除すると記録も消えます。定期的に保存してください。
        </p>
        <button type="button" onClick={backup}>
          JSONを書き出す
        </button>
        <button type="button" onClick={shareBackup}>
          スマホ・別端末へ共有
        </button>
        <label className="button secondary">
          JSONから復元
          <input
            hidden
            type="file"
            accept=".json"
            onChange={async (e) => {
              try {
                const file = e.target.files?.[0];
                if (!file) return;
                const parsed: unknown = JSON.parse(await file.text());
                if (!isRestorableData(parsed)) throw new Error("invalid backup");
                setRestoreCandidate(migrate(parsed));
                e.target.value = "";
              } catch {
                alert("復元できませんでした");
              }
            }}
          />
        </label>
        {restoreCandidate && (
          <div className="restorePreview" role="dialog" aria-label="復元内容の確認">
            <b>この内容に置き換えますか？</b>
            <span>予定：{restoreCandidate.tasks.length}件</span>
            <span>行事：{restoreCandidate.events.length}件</span>
            <small>現在の記録は置き換わります。先に書き出すと安心です。</small>
            <div className="actions">
              <button
                className="primary"
                type="button"
                onClick={() => {
                  upd(restoreCandidate);
                  setRestoreCandidate(null);
                  notify("バックアップから復元しました ✓");
                }}
              >
                復元する
              </button>
              <button type="button" onClick={() => setRestoreCandidate(null)}>
                やめる
              </button>
            </div>
          </div>
        )}
        <button
          className="danger"
          type="button"
          onClick={() => {
            if (
              confirm("全記録を初期化します。元に戻せません。よろしいですか？")
            ) {
              reset();
              location.reload();
            }
          }}
        >
          データを初期化
        </button>
      </Card>
      <Card>
        <h3>🗑 最近削除した予定</h3>
        <p>間違えて削除したタスクを戻せます。</p>
        <TrashRestore d={d} upd={upd} />
      </Card>
    </>
  );
}
function ParentGate({
  unlocked,
  onUnlock,
  children,
}: {
  unlocked: boolean;
  onUnlock: () => void;
  children: ReactNode;
}) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const storedHash = safeStorageGet("natsumanabi-parent-pin");
  if (unlocked) return <>{children}</>;
  const setup = !storedHash;
  const submit = async () => {
    if (!/^\d{4,6}$/.test(pin)) {
      setError("PINは4〜6桁の数字にしてください。");
      return;
    }
    if (setup) {
      if (pin !== confirmPin) {
        setError("確認用PINが一致しません。");
        return;
      }
      safeStorageSet("natsumanabi-parent-pin", await hashPin(pin));
      notify("保護者PINを設定しました ✓");
      onUnlock();
      return;
    }
    if ((await hashPin(pin)) !== storedHash) {
      setError("PINが違います。");
      setPin("");
      return;
    }
    onUnlock();
    notify("保護者モードを開始しました ✓");
  };
  return (
    <>
      <Title
        t={setup ? "保護者PINを設定" : "保護者モード"}
        sub="予定の変更や設定を保護します"
      />
      <Card className="parentGate">
        <div className="parentLockIcon">🔐</div>
        <h3>{setup ? "お母さま用のPINを決める" : "PINを入力してください"}</h3>
        <p>
          {setup
            ? "本人が誤って予定や設定を変更しないための番号です。"
            : "追加・編集・削除・リバランスは、解除後に使えます。"}
        </p>
        <Label t="4〜6桁のPIN">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            type="password"
            maxLength={6}
            value={pin}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
          />
        </Label>
        {setup && (
          <Label t="確認のため、もう一度">
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              type="password"
              maxLength={6}
              value={confirmPin}
              onChange={(event) =>
                setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </Label>
        )}
        {error && <p className="formError" role="alert">{error}</p>}
        <button className="primary wide" type="button" onClick={submit}>
          {setup ? "PINを設定してはじめる" : "保護者モードを開く"}
        </button>
      </Card>
    </>
  );
}
function ParentDashboard({ d, onLock }: { d: Data; onLock: () => void }) {
  const now = today();
  const weekEnd = addDays(now, 6);
  const pending = d.tasks.filter(
    (task) => !["completed", "skipped"].includes(task.status),
  );
  const overdue = pending.filter((task) => task.date < now);
  const completedThisWeek = d.tasks.filter(
    (task) =>
      task.status === "completed" &&
      task.completedAt &&
      task.completedAt.slice(0, 10) >= addDays(now, -6),
  );
  const days = Array.from({ length: 7 }, (_, index) => addDays(now, index));
  return (
    <>
      <Title t="保護者ダッシュボード" sub="学習状況と管理メニュー" />
      <div className="parentStats">
        <Card><b>{pending.length}</b><span>未完了</span></Card>
        <Card><b>{overdue.length}</b><span>期限・予定日超過</span></Card>
        <Card><b>{completedThisWeek.length}</b><span>7日間の完了</span></Card>
      </div>
      <Card>
        <h3>📊 今週の予定量</h3>
        <div className="parentWeekLoad">
          {days.map((date) => {
            const minutes = pending
              .filter((task) => task.date === date)
              .reduce((sum, task) => sum + task.estimatedMinutes, 0);
            return (
              <div className={minutes > d.settings.dailyLimitMinutes ? "over" : ""} key={date}>
                <b>{dateLabel(date)}</b>
                <span>{minutes}分</span>
              </div>
            );
          })}
        </div>
        <small>{dateLabel(now)}〜{dateLabel(weekEnd)}</small>
      </Card>
      {overdue.length > 0 && (
        <Card className="overdueCard">
          <h3>⚠️ 確認が必要な未完了</h3>
          {overdue.slice(0, 8).map((task) => (
            <p key={task.id}>・{task.subject}　{task.title}（{dateLabel(task.date)}）</p>
          ))}
          <NavLink className="button primary" to="/homework">一覧で調整する</NavLink>
        </Card>
      )}
      <div className="parentMenu">
        <NavLink to="/"><b>📅 今日を管理</b><span>追加・編集・移動・リバランス</span></NavLink>
        <NavLink to="/week"><b>▦ 週間予定</b><span>1週間を見ながら調整</span></NavLink>
        <NavLink to="/homework"><b>📚 宿題一覧</b><span>検索・一括操作・進捗</span></NavLink>
        <NavLink to="/settings"><b>⚙️ 設定と保存</b><span>バックアップ・復元・削除履歴</span></NavLink>
      </div>
      <div className="parentSessionActions">
        <button type="button" onClick={onLock}>🔒 保護者モードを終了</button>
        <button
          className="dangerText"
          type="button"
          onClick={() => {
            if (confirm("保護者PINを変更しますか？")) {
              safeStorageRemove("natsumanabi-parent-pin");
              onLock();
              notify("新しいPINを設定してください");
            }
          }}
        >
          PINを変更
        </button>
      </div>
    </>
  );
}
function More() {
  return (
    <>
      <Title t="その他" sub="使いたいメニューを選んでね" />
      <div className="moreMenu">
        <NavLink to="/parent">
          <b>👩 保護者モード</b>
          <span>学習状況の確認・予定の管理</span>
        </NavLink>
        <NavLink to="/eiken">
          <b>🔤 英検4級</b>
          <span>英検の計画と進み具合</span>
        </NavLink>
        <NavLink to="/report">
          <b>📤 学習報告</b>
          <span>家の人へ送る文章を作る</span>
        </NavLink>
        <NavLink to="/settings">
          <b>⚙️ 設定</b>
          <span>時間・バックアップ・元に戻す</span>
        </NavLink>
        <button
          className="moreGuide"
          type="button"
          onClick={() => {
            safeStorageRemove("natsumanabi-guide");
            location.reload();
          }}
        >
          <b>❓ 使い方を見る</b>
          <span>最初のかんたん説明をもう一度見る</span>
        </button>
      </div>
    </>
  );
}
function Setup({ d, upd }: { d: Data; upd: (d: Data) => void }) {
  const [s, setS] = useState(d.settings);
  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label="初期設定"
    >
      <div>
        <span className="eyebrow">はじめまして</span>
        <h1>学習計画を整えよう</h1>
        <p>あとから設定で変更できます。未定は「未確認」のままで大丈夫です。</p>
        <Label t="1日に学習できる時間">
          <input
            type="number"
            min="15"
            max="720"
            value={s.dailyLimitMinutes}
            onChange={(e) =>
              setS({
                ...s,
                dailyLimitMinutes: safeMinutes(
                  e.target.value,
                  s.dailyLimitMinutes,
                ),
              })
            }
          />
        </Label>
        <Label t="国語の課題">
          <select
            value={s.japaneseChoice}
            onChange={(e) => setS({ ...s, japaneseChoice: e.target.value })}
          >
            <option>未確認</option>
            <option>読書感想文</option>
            <option>調べる学習</option>
          </select>
        </Label>
        <Label t="理科で調べる臓器">
          <input
            value={s.organChoice}
            onChange={(e) => setS({ ...s, organChoice: e.target.value })}
            placeholder="未確認"
          />
        </Label>
        <button
          className="primary wide"
          type="button"
          onClick={() => upd({ ...d, settings: { ...s, setupDone: true } })}
        >
          計画をはじめる
        </button>
      </div>
    </div>
  );
}
function Label({ t, children }: { t: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{t}</span>
      {children}
    </label>
  );
}
function Title({ t, sub }: { t: string; sub: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const childPage = ["/eiken", "/report", "/settings"].includes(
    location.pathname,
  );
  return (
    <div className="title">
      {childPage && (
        <button
          className="backButton"
          type="button"
          onClick={() => navigate("/more")}
        >
          ← もどる
        </button>
      )}
      <span className="eyebrow">MY STUDY PLAN</span>
      <h1>{t}</h1>
      <p>{sub}</p>
    </div>
  );
}
