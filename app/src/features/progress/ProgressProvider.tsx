import p from "./Progress.module.css";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  storageAdapter,
  parseManifest,
  emptyProgress,
  mergeProgress,
  keyOf,
  KEY,
  type Data,
  type Manifest,
  type Status,
  type Row,
} from "./engine.mjs";
import a from "../../styles/App.module.css";
type Context = {
  manifest: Manifest | null;
  data: Data | null;
  notice: string;
  change: (
    key: string,
    status?: Status,
    selfReview?: Row["selfReview"],
  ) => void;
  visit: (key: string) => void;
  save: (next: Data) => Promise<boolean>;
  replace: (next: Data) => Promise<boolean>;
  raw: string | null;
};
const context = createContext<Context | null>(null);
export function useProgress() {
  const value = useContext(context);
  if (!value) throw Error("ProgressProvider missing");
  return value;
}
export function downloadJson(value: unknown, name = "学习进度备份.json") {
  const blob = new Blob(
    [typeof value === "string" ? value : JSON.stringify(value, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [manifest, setManifest] = useState<Manifest | null>(null),
    [data, setData] = useState<Data | null>(null),
    [notice, setNotice] = useState(""),
    [conflict, setConflict] = useState(false),
    [raw, setRaw] = useState<string | null>(null);
  const adapter = useRef<ReturnType<typeof storageAdapter> | null>(null),
    latest = useRef<Data | null>(null),
    pending = useRef<Data | null>(null);
  function publish(d: Data) {
    latest.current = d;
    setData(d);
    document.documentElement.dataset.theme = d.preferences.theme;
    document.documentElement.dataset.size = d.preferences.size;
  }
  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.BASE_URL}content/progress-manifest.json`)
      .then((r) => {
        if (!r.ok) throw Error("进度课程清单缺失");
        return r.json();
      })
      .then((rawManifest: unknown) => {
        const m = parseManifest(rawManifest);
        if (!active) return;
        setManifest(m);
        const safeStorage = {
          getItem: (k: string) => window.localStorage.getItem(k),
          setItem: (k: string, v: string) => window.localStorage.setItem(k, v),
        };
        adapter.current = storageAdapter(safeStorage, m);
        const result = adapter.current.read();
        setRaw(result.raw);
        if (!result.raw && !result.error) {
          try {
            const p = JSON.parse(
              localStorage.getItem("da-learning:preferences:v1") || "null",
            );
            if (
              p &&
              ["light", "dark"].includes(p.theme) &&
              ["normal", "large"].includes(p.size)
            )
              result.data.preferences = p;
            const old = JSON.parse(
              localStorage.getItem("da-learning:location:v1") || "null",
            );
            if (old && m.steps.some((s) => s.key === keyOf(old)))
              result.data.lastLocation = {
                projectId: old.projectId,
                lessonId: old.lessonId,
                stepId: old.stepId,
              };
          } catch {
            setNotice(
              "旧版位置或偏好无法读取；未覆盖原记录，可在设置中导出原始数据。",
            );
          }
        }
        publish(result.data);
        if (result.error) setNotice(result.error);
        else if (result.notes.length) setNotice(result.notes.join("；"));
        else if (!navigator.locks)
          setNotice(
            "此浏览器不支持跨标签写入锁。已启用写前版本检查，但请仅使用一个标签页修改进度。",
          );
      })
      .catch((e) => setNotice("进度功能不可用：" + e.message));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    function update(e: StorageEvent) {
      if (e.key === KEY || e.key === null) {
        setConflict(true);
        setNotice(
          "检测到其他标签页更新或清除记录。请选择读取最新或合并本页记录，避免静默覆盖。",
        );
      }
    }
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);
  async function locked<T>(task: () => T): Promise<T> {
    return navigator.locks ? navigator.locks.request(KEY, task) : task();
  }
  function persist(next: Data) {
    try {
      const d = adapter.current!.save(next);
      pending.current = null;
      publish(d);
      setRaw(adapter.current!.raw());
      setNotice("已保存到当前浏览器。");
      return true;
    } catch (e) {
      next = { ...next, updatedAt: new Date().toISOString() };
      pending.current = next;
      publish(next);
      setNotice(
        "保存失败，当前更改仅在内存中，请立即导出备份。" + (e as Error).message,
      );
      if ((e as Error).message.includes("冲突")) setConflict(true);
      return false;
    }
  }
  async function save(next: Data) {
    return locked(() => persist(next));
  }
  async function replace(next: Data) {
    return locked(() => {
      try {
        adapter.current!.unlock();
        const d = adapter.current!.save(next);
        pending.current = null;
        publish(d);
        setRaw(adapter.current!.raw());
        setConflict(false);
        setNotice("已替换当前浏览器记录。");
        return true;
      } catch (e) {
        setNotice("替换保存失败，请导出备份：" + (e as Error).message);
        if ((e as Error).message.includes("冲突")) setConflict(true);
        return false;
      }
    });
  }
  function change(
    key: string,
    status?: Status,
    selfReview?: Row["selfReview"],
  ) {
    void locked(() => {
      if (!manifest || !latest.current) return;
      const s = manifest.steps.find((s) => s.key === key);
      if (!s) return;
      const next = structuredClone(latest.current),
        old = next.stepStates[key];
      const row: Row = {
        projectId: s.projectId,
        lessonId: s.lessonId,
        stepId: s.stepId,
        status: status || old?.status || "in_progress",
        selfReview: selfReview || old?.selfReview || "none",
        revision: s.revision,
        updatedAt: new Date().toISOString(),
      };
      if (status === "not_started") row.selfReview = "none";
      if (selfReview === "practice" && row.status === "completed")
        row.status = "review_needed";
      if (
        row.status === "completed" &&
        s.exerciseRequired &&
        row.selfReview !== "explained"
      ) {
        setNotice("请先完成必修练习自评“我能解释”，再标记本步完成。");
        return;
      }
      next.stepStates[key] = row;
      next.events = [
        ...next.events,
        {
          projectId: s.projectId,
          lessonId: s.lessonId,
          stepId: s.stepId,
          action: status || ("self_review" as const),
          at: row.updatedAt,
        },
      ].slice(-100);
      persist(next);
    });
  }
  function visit(key: string) {
    void locked(() => {
      if (!manifest || !latest.current) return;
      const s = manifest.steps.find((s) => s.key === key);
      if (
        !s ||
        keyOf(
          latest.current.lastLocation || {
            projectId: "",
            lessonId: "",
            stepId: "",
          },
        ) === key
      )
        return;
      persist({
        ...latest.current,
        lastLocation: {
          projectId: s.projectId,
          lessonId: s.lessonId,
          stepId: s.stepId,
        },
      });
    });
  }
  async function resolve(merge: boolean) {
    await locked(() => {
      const prior = pending.current || latest.current;
      const result = adapter.current!.read();
      setRaw(result.raw);
      if (result.error) {
        setNotice(result.error);
        return;
      }
      if (merge && prior) {
        const d = mergeProgress(result.data, prior);
        try {
          publish(adapter.current!.save(d));
        } catch (e) {
          setNotice("合并保存失败：" + (e as Error).message);
          return;
        }
      } else publish(result.data);
      pending.current = null;
      setConflict(false);
      setNotice(
        merge
          ? "已按每条记录更新时间合并；同时间冲突保留磁盘记录。"
          : "已读取最新记录。",
      );
    });
  }
  return (
    <context.Provider
      value={{ manifest, data, notice, change, visit, save, replace, raw }}
    >
      {notice && (
        <aside className={p.notice} role="status">
          <p>{notice}</p>
          <Link to="/settings">备份与恢复 →</Link>
          {data ? (
            <button onClick={() => downloadJson(data)}>导出当前内存记录</button>
          ) : (
            <button
              onClick={() => {
                try {
                  downloadJson(
                    localStorage.getItem(KEY) || "尚无本地学习记录",
                    "原始进度恢复副本.json",
                  );
                } catch {
                  setNotice(
                    "存储不可访问，无法读取原文；请保留此前下载的备份。",
                  );
                }
              }}
            >
              导出原始进度恢复副本
            </button>
          )}
          {conflict && (
            <>
              <button onClick={() => void resolve(false)}>
                读取其他标签页最新记录
              </button>
              <button onClick={() => void resolve(true)}>
                合并本页与最新记录
              </button>
            </>
          )}
        </aside>
      )}
      {location.protocol === "https:" ? (
        <p role="status">
          当前为在线版本。进度保存在当前浏览器，与本机版不自动同步；可在设置中导入或导出学习进度。
        </p>
      ) : location.origin !== "http://127.0.0.1:4173" && (
        <p role="status">
          当前为非正式来源。正式学习请使用{" "}
          <a href="http://127.0.0.1:4173">http://127.0.0.1:4173</a>
          ，不同来源的记录互不相通。
        </p>
      )}
      {children}
    </context.Provider>
  );
}
