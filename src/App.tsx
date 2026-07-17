import { useMemo, useRef, useState } from "react";
import {
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import type { Data, Task } from "./types";
import { initialData } from "./data";
import { load, pct, phase, reset, save } from "./store";
const eigo = "https://naru18vr.github.io/eigo/";
const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
export default function App() {
  const [d, setD] = useState<Data>(load);
  const upd = (x: Data) => {
    setD(x);
    save(x);
  };
  return (
    <div className="app">
      <header>
        <span className="logo">なつまなび</span>
        <span className="badge">端末だけに保存</span>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Today d={d} upd={upd} />} />
          <Route path="/week" element={<Week d={d} upd={upd} />} />
          <Route path="/calendar" element={<Calendar d={d} />} />
          <Route path="/homework" element={<Homework d={d} />} />
          <Route path="/eiken" element={<Eiken d={d} upd={upd} />} />
          <Route path="/report" element={<Report d={d} />} />
          <Route path="/settings" element={<Settings d={d} upd={upd} />} />
        </Routes>
      </main>
      <nav>
        {[
          ["/", "今日", "✓"],
          ["/week", "週間", "▦"],
          ["/calendar", "予定", "□"],
          ["/homework", "宿題", "▤"],
          ["/eiken", "英検", "E"],
          ["/report", "報告", "↗"],
          ["/settings", "設定", "⚙"],
        ].map((x) => (
          <NavLink key={x[0]} to={x[0]} end={x[0] === "/"}>
            <b>{x[2]}</b>
            <small>{x[1]}</small>
          </NavLink>
        ))}
      </nav>
      {!d.settings.setupDone && <Setup d={d} upd={upd} />}
    </div>
  );
}
function Card({
  children,
  className = "",
}: {
  children: any;
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
  };
  return (
    <div className="moveTask">
      <button type="button" onClick={() => setOpen(!open)}>
        📅 日付を移動
      </button>
      {open && (
        <div className="movePicker">
          <input
            aria-label="移動先の日付"
            type="date"
            min={d.settings.studyStartDate}
            max={d.settings.examDate}
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
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("その他");
  const [minutes, setMinutes] = useState(15);
  const [priority, setPriority] = useState<Task["priority"]>("required");
  const add = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const now = new Date().toISOString();
    const task: Task = {
      id: `user-${Date.now()}-${crypto.randomUUID()}`,
      source: "user",
      subject,
      category: "追加予定",
      type: "custom",
      title: cleanTitle,
      description: "自分で追加した予定",
      date,
      estimatedMinutes: Math.max(1, minutes || 1),
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
    upd({ ...d, tasks: [...d.tasks, task] });
    setTitle("");
    setMinutes(15);
    setOpen(false);
  };
  return (
    <Card className="addTaskCard">
      <button
        className="addTaskButton"
        type="button"
        onClick={() => setOpen(!open)}
      >
        ＋ この日に予定を追加
      </button>
      {open && (
        <div className="addTaskForm">
          <p className="notice">{date} に追加します</p>
          <Label t="タスク名">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：英単語を10個覚える"
            />
          </Label>
          <Label t="科目">
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
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
                <option key={item}>{item}</option>
              ))}
            </select>
          </Label>
          <Label t="予定時間（分）">
            <input
              type="number"
              min="1"
              max="300"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </Label>
          <Label t="区分">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task["priority"])}
            >
              <option value="required">今日の必須</option>
              <option value="normal">追加・短時間</option>
            </select>
          </Label>
          <div className="actions">
            <button
              className="primary"
              type="button"
              disabled={!title.trim()}
              onClick={add}
            >
              予定を追加
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              キャンセル
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
function Today({ d, upd }: { d: Data; upd: (d: Data) => void }) {
  const location = useLocation();
  const requestedDate = new URLSearchParams(location.search).get("date");
  const [date, setDate] = useState(requestedDate || today());
  const tasks = d.tasks.filter((t) => t.date === date);
  const events = d.events.filter((e) => e.date === date);
  const done = tasks.filter((t) => t.status === "completed");
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
  }
  return (
    <>
      <div className="hero">
        <div>
          <span>{phase(date)}期間</span>
          <h1>今日も、一歩ずつ。</h1>
          <input
            aria-label="表示日"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div
          className="ring"
          style={{ "--p": `${pct(done.length, tasks.length) * 3.6}deg` } as any}
        >
          <b>{pct(done.length, tasks.length)}%</b>
          <small>達成</small>
        </div>
      </div>
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
      <AddTask date={date} d={d} upd={upd} />
      <h2>今日の必須</h2>
      {tasks.length ? (
        tasks
          .filter((t) => t.priority === "required")
          .map((t) => (
            <TaskRow key={t.id} t={t} status={status} d={d} upd={upd} />
          ))
      ) : (
        <Card>
          <p>この日の予定はありません。設定や週間画面から確認できます。</p>
        </Card>
      )}
      <h2>追加・短時間</h2>
      {tasks
        .filter((t) => t.priority !== "required")
        .map((t) => (
          <TaskRow key={t.id} t={t} status={status} d={d} upd={upd} />
        ))}
      <a className="button secondary" href={eigo} target="_blank">
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
}: {
  t: Task;
  status: (t: Task, s: Task["status"]) => void;
  d: Data;
  upd: (d: Data) => void;
}) {
  return (
    <Card className={t.status === "completed" ? "done" : ""}>
      <div className="task">
        <button
          className="check"
          onClick={() =>
            status(t, t.status === "completed" ? "pending" : "completed")
          }
        >
          {t.status === "completed" ? "✓" : ""}
        </button>
        <div>
          <span className={"subject " + t.subject}>{t.subject}</span>
          <h3>{t.title}</h3>
          <p>
            {t.estimatedMinutes}分 ・ {t.availableLocations[0]}
          </p>
          {t.totalAmount && (
            <progress value={t.completedAmount || 0} max={t.totalAmount} />
          )}
        </div>
      </div>
      <div className="actions">
        <button onClick={() => status(t, "partial")}>一部完了</button>
        <button onClick={() => status(t, "rescheduled")}>明日に調整</button>
      </div>
      <MoveTask task={t} d={d} upd={upd} />
    </Card>
  );
}
function Week({ d, upd }: { d: Data; upd: (d: Data) => void }) {
  const [start, setStart] = useState("2026-07-21");
  const ds = Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start + "T00:00:00");
    x.setDate(x.getDate() + i);
    return x.toLocaleDateString("sv-SE");
  });
  return (
    <>
      <Title t="週間予定" sub="1週間の負担を見渡そう" />
      <input
        type="date"
        value={start}
        onChange={(e) => setStart(e.target.value)}
      />
      {ds.map((x) => {
        const ts = d.tasks.filter((t) => t.date === x);
        const es = d.events.filter((e) => e.date === x);
        const weekday = new Intl.DateTimeFormat("ja-JP", {
          weekday: "short",
        }).format(new Date(x + "T00:00:00"));
        return (
          <Card key={x}>
            <h3>
              {x}（{weekday}）{" "}
              <span className="muted">
                {ts.reduce((a, t) => a + t.estimatedMinutes, 0)}分
              </span>
            </h3>
            {es.map((event) => (
              <p key={event.id}>
                🏫 {event.startTime}〜{event.endTime} {event.title}
              </p>
            ))}
            {ts.map((t) => (
              <div className="weekTask" key={t.id}>
                <p>
                  {t.status === "completed" ? "✅" : "□"} {t.subject}　{t.title}
                </p>
                <MoveTask task={t} d={d} upd={upd} />
              </div>
            ))}
            {!ts.length && !es.length && <p className="muted">予定なし</p>}
          </Card>
        );
      })}
    </>
  );
}
function Calendar({ d }: { d: Data }) {
  const navigate = useNavigate();
  const dates = Array.from({ length: 67 }, (_, i) => {
    const x = new Date("2026-07-21T00:00:00");
    x.setDate(x.getDate() + i);
    return x.toLocaleDateString("sv-SE");
  });
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
      <div className="calendar">
        {dates.map((x) => {
          const classEvent = d.events.find(
            (event) => event.type === "class" && event.date === x,
          );
          return (
            <button
              type="button"
              aria-label={`${x}の学習画面を開く`}
              className={`day ${d.settings.accommodationDates.includes(x) ? "stay" : ""}`}
              key={x}
              onClick={() => navigate(`/?date=${x}`)}
            >
              <b>{Number(x.slice(-2))}</b>
              <small>{x.slice(5, 7)}月</small>
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
    </>
  );
}
function Homework({ d }: { d: Data }) {
  const grouped = d.tasks
    .filter((t) => t.category === "夏休み宿題")
    .reduce<Record<string, Task[]>>((g, t) => {
      (g[t.subject] ??= []).push(t);
      return g;
    }, {});
  return (
    <>
      <Title t="宿題一覧" sub="教科ごとの進み具合" />
      {Object.entries(grouped).map(([s, a]) => {
        const n = a.filter((t) => t.status === "completed").length;
        return (
          <Card key={s}>
            <div className="between">
              <h3>{s}</h3>
              <b>{pct(n, a.length)}%</b>
            </div>
            <progress value={n} max={a.length} />
            <p>
              {n} / {a.length}工程　目標 7月31日
            </p>
          </Card>
        );
      })}
    </>
  );
}
function Eiken({ d, upd }: { d: Data; upd: (d: Data) => void }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);
  function parse(raw: string) {
    try {
      let arr: any[] = [];
      try {
        const j = JSON.parse(raw);
        arr = j.tasks || [];
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
        const i = tasks.findIndex((t) => t.id === x.id);
        const base: Task = {
          id: x.id || crypto.randomUUID(),
          source: x.source || "eiken4-app",
          subject: "英検",
          category: "英検4級",
          type: x.type || "daily_15min",
          title: x.title || "英検学習",
          description: x.description || "",
          date: x.date || "2026-08-01",
          estimatedMinutes: Number(x.estimatedMinutes) || 15,
          actualMinutes: 0,
          priority: x.priority || "required",
          status: x.status || "pending",
          requiredTools: ["スマートフォン"],
          availableLocations: ["スマートフォンがあれば可能"],
          launchUrl: x.launchUrl || eigo,
          tags: x.tags || ["英検4級"],
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
            id: crypto.randomUUID(),
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
          <button className="primary" onClick={() => parse(text)}>
            内容を確認して取り込む
          </button>
          <button onClick={() => file.current?.click()}>JSONファイル</button>
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
      <a className="button" href={eigo} target="_blank">
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
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
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
function Settings({ d, upd }: { d: Data; upd: (d: Data) => void }) {
  const s = d.settings;
  const set = (k: keyof typeof s, v: any) =>
    upd({ ...d, settings: { ...s, [k]: v } });
  function backup() {
    const b = new Blob(
        [
          JSON.stringify(
            { ...d, appVersion: 1, exportedAt: new Date().toISOString() },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `なつまなび-backup-${today()}.json`;
    a.click();
  }
  return (
    <>
      <Title t="設定" sub="日程・教材・データ管理" />
      <Card>
        <h3>基本設定</h3>
        <Label t="1日の上限（分）">
          <input
            type="number"
            value={s.dailyLimitMinutes}
            onChange={(e) => set("dailyLimitMinutes", +e.target.value)}
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
            value={s.kihonPages}
            onChange={(e) => set("kihonPages", +e.target.value)}
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
        <button
          onClick={() => {
            const date = prompt("日付 YYYY-MM-DD", "2026-08-06"),
              title = prompt("講座名", "夏期講習");
            if (date && title)
              upd({
                ...d,
                events: [
                  ...d.events,
                  {
                    id: crypto.randomUUID(),
                    type: "class",
                    date,
                    title,
                    travelMinutes: 0,
                  },
                ],
              });
          }}
        >
          講習を追加
        </button>
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
        <button onClick={backup}>JSONを書き出す</button>
        <label className="button secondary">
          JSONから復元
          <input
            hidden
            type="file"
            accept=".json"
            onChange={async (e) => {
              try {
                const x = JSON.parse(await e.target.files![0].text());
                if (confirm("現在のデータをバックアップ内容で置き換えますか？"))
                  upd({
                    settings: x.settings,
                    tasks: x.tasks,
                    events: x.events || [],
                    importHistory: x.importHistory || [],
                  });
              } catch {
                alert("復元できませんでした");
              }
            }}
          />
        </label>
        <button
          className="danger"
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
    </>
  );
}
function Setup({ d, upd }: { d: Data; upd: (d: Data) => void }) {
  const [s, setS] = useState(d.settings);
  return (
    <div className="modal">
      <div>
        <span className="eyebrow">はじめまして</span>
        <h1>学習計画を整えよう</h1>
        <p>あとから設定で変更できます。未定は「未確認」のままで大丈夫です。</p>
        <Label t="1日に学習できる時間">
          <input
            type="number"
            value={s.dailyLimitMinutes}
            onChange={(e) => setS({ ...s, dailyLimitMinutes: +e.target.value })}
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
          onClick={() => upd({ ...d, settings: { ...s, setupDone: true } })}
        >
          計画をはじめる
        </button>
      </div>
    </div>
  );
}
function Label({ t, children }: { t: string; children: any }) {
  return (
    <label className="field">
      <span>{t}</span>
      {children}
    </label>
  );
}
function Title({ t, sub }: { t: string; sub: string }) {
  return (
    <div className="title">
      <span className="eyebrow">MY STUDY PLAN</span>
      <h1>{t}</h1>
      <p>{sub}</p>
    </div>
  );
}
