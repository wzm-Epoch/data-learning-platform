import p from "./Progress.module.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useProgress, downloadJson } from "./ProgressProvider";
import {
  recommendStep,
  projectProgress,
  overallProgress,
  effectiveStatus,
  importPreview,
  emptyProgress,
  MAX_BYTES,
  type Status,
  type Data,
} from "./engine.mjs";
import { stepUrl } from "../learning/content";
import a from "../../styles/App.module.css";
export const labels: Record<Status | "unavailable", string> = {
  not_started: "未开始",
  in_progress: "进行中",
  completed: "完成",
  review_needed: "待复习",
  unavailable: "未开放",
};
export function ProjectProgress({ id }: { id: string }) {
  const { manifest, data } = useProgress();
  if (!manifest || !data) return <span>进度读取中…</span>;
  const p = projectProgress(manifest, data, id);
  return (
    <span>
      {labels[p.status]} ·{" "}
      {p.total
        ? `${p.done}/${p.total} 必修步骤，${Math.round(p.ratio * 100)}%`
        : "暂无有效必修步骤"}
    </span>
  );
}
export function ProgressSummary() {
  const { manifest, data } = useProgress();
  if (!manifest || !data) return <p>正在读取学习记录…</p>;
  const p = overallProgress(manifest, data);
  return (
    <div>
      <p>
        总体进度：{p.open ? `${(p.ratio * 100).toFixed(1)}%` : "暂无可学习项目"}
      </p>
      <progress value={p.ratio} max={1} aria-label="总体学习进度" />
      <p>
        完整完成 {p.complete}/{p.total} 项目 · 可学习内容覆盖 {p.open}/{p.total}{" "}
        项目
      </p>
      <p className={a.caption}>
        按可学习项目等权平均；每个项目按有效必修步骤计算，必修练习自评通过后才能主动完成。打开页面不表示学会。
      </p>
    </div>
  );
}
export function Recommendation() {
  const { manifest, data, save } = useProgress();
  if (!manifest || !data) return null;
  const next = recommendStep(manifest, data);
  if (!next) return <p>所有当前必修内容均已完成，可以自主选择复习。</p>;
  const { project: p, step: s, active } = next;
  return (
    <div className={a.infoPanel}>
      <h2>下一步建议</h2>
      <Link to={stepUrl(s.projectId, s.lessonId, s.stepId)}>
        {p.id} · {s.title} →
      </Link>
      <p>
        {active
          ? "优先继续进行中或待复习步骤。"
          : "结合已完成项目与建议先学顺序选择。"}
      </p>
      <p>知识硬前置：{p.prerequisites}</p>
      <p>
        {data.prerequisiteConfirmations.includes(p.id)
          ? "你已自行确认具备以上前置知识；推荐优先考虑已确认的项目。"
          : "前置知识尚未确认，请先核对以上要求；也可以主动进入课程查阅。"}
      </p>
      <button
        onClick={() =>
          void save({
            ...data,
            prerequisiteConfirmations: data.prerequisiteConfirmations.includes(
              p.id,
            )
              ? data.prerequisiteConfirmations.filter((id) => id !== p.id)
              : [...data.prerequisiteConfirmations, p.id],
          })
        }
      >
        {data.prerequisiteConfirmations.includes(p.id)
          ? "撤回本项前置知识确认"
          : "我已具备以上前置知识"}
      </button>
      <p>
        建议先学项目：{p.recommendedProjectIds.join("、") || "无指定项目"}
        。项目完成只表示自我确认，不证明已掌握全部知识；请对照前置知识判断。可随时从项目库主动跳转。
      </p>
    </div>
  );
}
export function ProgressPage() {
  const { manifest, data } = useProgress();
  const [filter, setFilter] = useState("all");
  if (!manifest || !data) return <p>正在读取进度课程清单…</p>;
  return (
    <section className={`${a.reading} ${p.records}`}>
      <h1>你的学习足迹</h1>
      <ProgressSummary />
      <Recommendation />
      <label>
        学习状态{" "}
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">全部项目</option>
          {Object.entries(labels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {manifest.projects
        .filter(
          (p) =>
            filter === "all" ||
            projectProgress(manifest, data, p.id).status === filter,
        )
        .map((p) => (
          <details key={p.id}>
            <summary>
              {p.id} · {p.title} · <ProjectProgress id={p.id} />
            </summary>
            <ol>
              {manifest.steps
                .filter((s) => s.projectId === p.id)
                .map((s) => (
                  <li key={s.key}>
                    <Link to={stepUrl(s.projectId, s.lessonId, s.stepId)}>
                      {s.title}
                    </Link>{" "}
                    · {labels[effectiveStatus(s, data.stepStates[s.key])]} ·{" "}
                    {s.required ? "必修" : "选修"}
                  </li>
                ))}
            </ol>
          </details>
        ))}
      <h2>最近主动学习事件（最多100条）</h2>
      {!data.events.length ? (
        <p>尚无学习事件。阅读位置独立记录，不虚构完成或时长。</p>
      ) : (
        <ol>
          {[...data.events].reverse().map((e, i) => (
            <li key={i}>
              <Link to={stepUrl(e.projectId, e.lessonId, e.stepId)}>
                {e.projectId} · {e.stepId}
              </Link>{" "}
              · {e.action === "self_review" ? "练习自评" : labels[e.action]} ·{" "}
              {new Date(e.at).toLocaleString("zh-CN")}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
export function BackupPanel() {
  const { manifest, data, save, replace, raw } = useProgress();
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [text, setText] = useState(""),
    [mode, setMode] = useState("merge"),
    [preview, setPreview] = useState<ReturnType<typeof importPreview> | null>(
      null,
    ),
    [base, setBase] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [reset, setReset] = useState(false),
    [ack, setAck] = useState(false);
  if (!manifest || !data) return <p>备份功能等待本地课程清单…</p>;
  async function executeImport() {
    if (!preview || !data) return;
    if (data !== base) {
      setError("预览后本页记录已改变，请重新预览");
      setPreview(null);
      setConfirmReplace(false);
      return;
    }
    const ok =
      mode === "replace"
        ? await replace(preview.data)
        : await save(preview.data);
    if (ok) {
      setPreview(null);
      setConfirmReplace(false);
      setError("导入完成。");
    }
  }
  function check(t = text, m = mode) {
    setConfirmReplace(false);
    try {
      setPreview(importPreview(t, manifest!, data!, m));
      setBase(data);
      setError("");
    } catch (e) {
      setPreview(null);
      setError("未导入：版本、ID或结构校验失败。" + (e as Error).message);
    }
  }
  return (
    <div className={`${a.infoPanel} ${p.panel}`}>
      <h2>进度备份与恢复</h2>
      <p>
        记录仅在当前浏览器、当前来源。隐私模式结束、清理浏览器数据或浏览器故障可能丢失，网页不能可靠识别隐私模式。导出由你主动下载，不会后台写磁盘。
      </p>
      <button onClick={() => downloadJson(data)}>导出学习进度 JSON</button>
      <button
        onClick={() =>
          downloadJson(
            {
              progress: raw,
              location: localStorageSafe("da-learning:location:v1"),
              preferences: localStorageSafe("da-learning:preferences:v1"),
            },
            "原始存储恢复副本.json",
          )
        }
      >
        导出原始存储恢复副本
      </button>
      <label>
        选择备份（最大1 MiB）
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > MAX_BYTES) {
              setPreview(null);
              setError("文件超过1 MiB上限");
              return;
            }
            try {
              const t = await f.text();
              setText(t);
              check(t);
            } catch {
              setError("无法读取所选文件");
            }
          }}
        />
      </label>
      <details>
        <summary>或粘贴备份 JSON</summary>
        <label>
          备份 JSON 文本
          <textarea
            rows={5}
            maxLength={MAX_BYTES}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPreview(null);
            }}
          />
        </label>
      </details>
      <label>
        恢复方式{" "}
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setPreview(null);
          }}
        >
          <option value="merge">合并：逐条取较新更新时间</option>
          <option value="replace">替换：只保留备份有效记录和偏好</option>
        </select>
      </label>
      <button disabled={!text} onClick={() => check()}>
        预览导入影响
      </button>
      {error && <p role="alert">{error}</p>}
      {preview && (
        <div>
          <h3>导入预览</h3>
          <p>
            变化步骤：{preview.changed}；完整完成项目 {preview.before.complete}{" "}
            → {preview.after.complete}；进度{" "}
            {(preview.before.ratio * 100).toFixed(1)}% →{" "}
            {(preview.after.ratio * 100).toFixed(1)}%。
            {mode === "replace"
              ? "将替换当前进度、事件、位置及偏好。"
              : "事件去重保留最近100条，位置与偏好取较新备份。"}
          </p>
          <p>{preview.notes.join("；") || "无需实质变更迁移。"}</p>
          <button
            onClick={() => {
              if (mode === "replace") setConfirmReplace(true);
              else void executeImport();
            }}
          >
            确认执行导入
          </button>
          {confirmReplace && (
            <section role="alertdialog" aria-label="确认替换学习记录">
              <h3>再次确认替换范围</h3>
              <p>
                将使用预览中的备份替换当前浏览器学习状态、事件、位置、前置知识确认和偏好；课程与原始文件保留。
              </p>
              <button autoFocus onClick={() => void executeImport()}>
                确认替换本地记录
              </button>
              <button onClick={() => setConfirmReplace(false)}>取消替换</button>
            </section>
          )}
        </div>
      )}
      <h3>重置学习记录</h3>
      <p>
        仅重置本来源的进度、事件、阅读位置、前置知识确认和阅读偏好。不会删除课程、结果或原始项目文件。历史旧版键保留在原始恢复副本中，不再用于恢复。
      </p>
      <button
        onClick={() => {
          setReset(true);
          setAck(false);
        }}
      >
        准备重置
      </button>
      {reset && (
        <div>
          <label>
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            我已导出所需记录，确认上述重置范围
          </label>
          <button
            disabled={!ack}
            onClick={async () => {
              if (ack) {
                await replace(emptyProgress(manifest));
                setReset(false);
              }
            }}
          >
            再次确认并重置
          </button>
          <button onClick={() => setReset(false)}>取消</button>
        </div>
      )}
    </div>
  );
}
function localStorageSafe(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return "存储被禁用，无法读取";
  }
}
