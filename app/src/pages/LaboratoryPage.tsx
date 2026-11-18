import { useProgress } from "../features/progress/ProgressProvider";
import { labels, ProjectProgress } from "../features/progress/ProgressViews";
import { effectiveStatus } from "../features/progress/engine.mjs";
import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import type { Catalog } from "../content/catalog";
import { useResource } from "../content/useResource";
import {
  loadLearningIndex,
  loadLesson,
  stepUrl,
  type LearningIndex,
  type Lesson,
  type ReadyStep,
} from "../features/learning/content";
import { CodeView } from "../features/learning/CodeView";
import { ResultView } from "../features/learning/ResultView";
import { Exercise } from "../features/learning/Exercise";
import { EmptyState } from "../components/States";
import a from "../styles/App.module.css";
import s from "../styles/Laboratory.module.css";
export default function LaboratoryPage({ catalog }: { catalog: Catalog }) {
  const { projectId = "", lessonId = "", stepId } = useParams();
  const {
    data: index,
    error,
    retry,
  } = useResource("learning-index", loadLearningIndex);
  if (error)
    return (
      <EmptyState title="课程目录暂不可用">
        {error}
        <button onClick={retry}>重试</button>
      </EmptyState>
    );
  if (!index) return <p role="status">正在读取本地课程目录…</p>;
  const project = catalog.projects.find((p) => p.id === projectId);
  const lesson = index.projects
    .find((p) => p.id === projectId)
    ?.lessons.find((l) => l.id === lessonId);
  if (!project || !lesson)
    return (
      <EmptyState title="未登记的项目或课节">
        请返回<Link to="/projects">项目库</Link>选择已登记课程。
      </EmptyState>
    );
  return (
    <LessonLoader
      key={projectId + "/" + lessonId}
      index={index}
      lessonRef={lesson.ref}
      projectTitle={project.title}
      projectId={projectId}
      lessonId={lessonId}
      stepId={stepId}
    />
  );
}
function LessonLoader(props: {
  index: LearningIndex;
  lessonRef: string;
  projectTitle: string;
  projectId: string;
  lessonId: string;
  stepId?: string;
}) {
  const {
    data: lesson,
    error,
    retry,
  } = useResource(props.lessonRef, () => loadLesson(props.lessonRef));
  if (error)
    return (
      <EmptyState title="课节内容暂不可用">
        {error} <button onClick={retry}>重试</button>
        <Link to={"/projects/" + props.projectId}>返回项目总览</Link>
      </EmptyState>
    );
  if (!lesson) return <p role="status">正在读取此课的步骤内容…</p>;
  if (lesson.projectId !== props.projectId || lesson.id !== props.lessonId)
    return (
      <EmptyState title="课节资源身份不匹配">
        停止展示此内容，请重新构建课程资源。
      </EmptyState>
    );
  return <LoadedLesson {...props} lesson={lesson} />;
}
function LoadedLesson({
  index,
  lesson,
  projectTitle,
  projectId,
  lessonId,
  stepId,
}: {
  index: LearningIndex;
  lesson: Lesson;
  projectTitle: string;
  projectId: string;
  lessonId: string;
  stepId?: string;
}) {
  const navigate = useNavigate();
  const { manifest, data, visit, change } = useProgress();
  const progressKey = `${projectId}/${lessonId}/${stepId}`;
  const [layout, setLayout] = useState("parallel");
  const [tab, setTab] = useState("explain");
  const [result, setResult] = useState(0);

  const current = lesson.steps.find((s) => s.id === stepId);
  const ready = current?.status === "ready" ? (current as ReadyStep) : null;
  useEffect(() => {
    if (lesson.status === "ready" && !stepId) {
      const prior = data?.lastLocation;
      const resume =
        prior && prior.projectId === projectId && prior.lessonId === lessonId
          ? prior.stepId
          : lesson.steps[0].id;
      navigate(stepUrl(projectId, lessonId, resume), { replace: true });
    }
  }, [lesson, stepId, index, projectId, lessonId, navigate, data]);
  useEffect(() => {
    setResult(0);
    setTab("explain");
    if (ready && manifest && data)
      visit(`${projectId}/${lessonId}/${ready.id}`);
  }, [stepId, lesson, index, manifest, !!data]);
  const i = lesson.steps.findIndex((s) => s.id === stepId);
  const links = (
    <nav aria-label="本课步骤" className={s.stepNav}>
      {lesson.steps.map((step, j) => (
        <Link
          key={step.id}
          aria-current={current?.id === step.id ? "step" : undefined}
          to={stepUrl(projectId, lessonId, step.id)}
        >
          <span>{String(j + 1).padStart(2, "0")}</span>
          <span>
            {step.title}
            <small>
              {step.status === "ready"
                ? labels[
                    manifest?.steps.find(
                      (s) => s.key === `${projectId}/${lessonId}/${step.id}`,
                    )
                      ? effectiveStatus(
                          manifest.steps.find(
                            (s) =>
                              s.key === `${projectId}/${lessonId}/${step.id}`,
                          )!,
                          data?.stepStates[
                            `${projectId}/${lessonId}/${step.id}`
                          ],
                        )
                      : "not_started"
                  ]
                : "仅规划"}
            </small>
          </span>
        </Link>
      ))}
    </nav>
  );
  return (
    <section className={s.lab}>
      <div className={s.breadcrumb}>
        <Link to={"/projects/" + projectId}>← 项目总览</Link>
        <span>
          {projectId} · {projectTitle}
        </span>
      </div>
      <div className={s.labHeading}>
        <div>
          <span className={a.eyebrow}>
            LEARNING LAB ·{" "}
            {lesson.status === "ready" ? "课程可学习" : "专属步骤已规划"}
          </span>
          <h1>{lesson.title}</h1>
          <p>
            课内阅读位置 {i >= 0 ? i + 1 : "—"} / {lesson.steps.length} ·{" "}
            {lesson.status === "ready"
              ? "本页不执行Python，学习状态由你主动确认"
              : "内容未制作，不计为可学习课程"}
          </p>
        </div>
        <Link
          to={"/projects/" + projectId + "/sources"}
          className={s.textButton}
        >
          原文件与哈希
        </Link>
      </div>
      <details className={s.mobileOutline}>
        <summary>展开本课步骤目录</summary>
        {links}
      </details>
      {lesson.status === "ready" && (
        <div className={s.toolbar}>
          <div className={s.desktopModes} aria-label="内容聚焦布局">
            {[
              ["parallel", "讲解与结果并排"],
              ["explain", "讲解代码全宽"],
              ["results", "结果全宽"],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={layout === value}
                onClick={() => setLayout(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className={s.mobileTabs}
            role="tablist"
            aria-label="当前步骤内容"
          >
            {[
              ["explain", "讲解"],
              ["code", "代码"],
              ["results", "结果"],
            ].map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div
        className={`${s.grid} ${layout === "explain" ? s.explainWide : layout === "results" ? s.resultsWide : ""}`}
      >
        <aside className={s.outline}>
          <h2>本课步骤</h2>
          {links}
          <p>打开页面仅记录位置；完成和练习自评需主动确认。</p>
        </aside>
        {lesson.status === "planned" ? (
          <div className={s.planned}>
            <EmptyState title="专属步骤已规划，课程内容待制作">
              {current?.title || "请选择左侧步骤查看本项目专属规划。"}
              。尚未准备讲解、代码快照或学习结果，不用示例数据替代。
            </EmptyState>
            <Link
              className={a.secondaryButton}
              to={"/projects/" + projectId + "/dictionary"}
            >
              查看真实字段字典
            </Link>
          </div>
        ) : !stepId ? (
          <p role="status">正在恢复阅读步骤…</p>
        ) : !ready ? (
          <div className={s.planned}>
            <EmptyState title="没有找到这个学习步骤">
              当前地址的stepId不在此课中。无效地址不会覆盖此前有效阅读位置。
            </EmptyState>
            <Link
              className={a.button}
              to={stepUrl(projectId, lessonId, lesson.steps[0].id)}
            >
              回到第一步
            </Link>
          </div>
        ) : (
          <>
            <div
              className={`${s.explanation} ${tab === "explain" ? s.showMobile : ""}`}
            >
              <section className={s.lessonText}>
                <span className={s.identity}>
                  步骤 {i + 1} ·{" "}
                  {{
                    orientation: "认识问题",
                    data: "数据读取",
                    cleaning: "质量检查",
                    analysis: "分析解释",
                    modeling: "模型证据",
                    interpretation: "结果审辨",
                    practice: "巩固练习",
                  }[ready.kind] || "学习步骤"}
                </span>
                <h2>{ready.title}</h2>
                <div className={s.knowledge}>
                  {ready.knowledgeIds.map((id) => (
                    <Link key={id} to={"/knowledge/" + encodeURIComponent(id)}>
                      {id}
                    </Link>
                  ))}
                </div>
                {ready.explanation.map((t) => (
                  <p key={t}>{t}</p>
                ))}
                <details>
                  <summary>本步输入与局限</summary>
                  {ready.inputRefs.map((r) => (
                    <p className={s.hash} key={r.path}>
                      {r.path}
                      <br />
                      SHA-256：{r.sha256}
                    </p>
                  ))}
                  <ul>
                    {ready.limitations.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </details>
              </section>
              <div className={s.desktopCode}>
                <CodeView key={ready.id} step={ready} />
              </div>
              <section className={a.infoPanel}>
                <h3>本步学习状态</h3>
                <p>
                  当前步骤：
                  {
                    labels[
                      manifest?.steps.find((s) => s.key === progressKey)
                        ? effectiveStatus(
                            manifest.steps.find((s) => s.key === progressKey)!,
                            data?.stepStates[progressKey],
                          )
                        : "not_started"
                    ]
                  }
                </p>
                <p>
                  <ProjectProgress id={projectId} />
                </p>
                {(
                  [
                    ["in_progress", "开始本步"],
                    ["completed", "标记本步完成"],
                    ["review_needed", "标记待复习"],
                    ["not_started", "恢复未开始"],
                  ] as const
                ).map(([status, label]) => (
                  <button
                    key={status}
                    onClick={() => change(progressKey, status)}
                  >
                    {label}
                  </button>
                ))}
              </section>
              <Exercise key={ready.id} step={ready} progressKey={progressKey} />
            </div>
            <div
              className={`${s.onlyMobileCode} ${tab === "code" ? s.showMobile : ""}`}
            >
              <h2>{ready.title} · 代码</h2>
              <CodeView key={ready.id} step={ready} />
            </div>
            <section
              className={`${s.results} ${tab === "results" ? s.showMobile : ""}`}
            >
              <div className={s.resultTop}>
                <h2>本步结果</h2>
                {ready.outputRefs.length > 1 && (
                  <label>
                    切换结果
                    <select
                      aria-label="切换本步结果"
                      value={Math.min(result, ready.outputRefs.length - 1)}
                      onChange={(e) => setResult(Number(e.target.value))}
                    >
                      {ready.outputRefs.map((ref, j) => (
                        <option key={ref} value={j}>
                          {j + 1}.{" "}
                          {ready.outputTitles?.[ref] ||
                            `结果 ${j + 1} / ${ready.outputRefs.length}`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <ResultView
                key={
                  ready.outputRefs[
                    Math.min(result, ready.outputRefs.length - 1)
                  ]
                }
                resourceRef={
                  ready.outputRefs[
                    Math.min(result, ready.outputRefs.length - 1)
                  ]
                }
              />
              <p className={s.caption}>
                表、图与代码绑定当前步骤。原保存与教学版本分别标识；没有模拟数据。
              </p>
            </section>
          </>
        )}
      </div>
      {ready && (
        <nav className={s.previousNext} aria-label="步骤上下导航">
          {i > 0 ? (
            <Link to={stepUrl(projectId, lessonId, lesson.steps[i - 1].id)}>
              ← 上一步：{lesson.steps[i - 1].title}
            </Link>
          ) : (
            <Link to={"/projects/" + projectId}>← 项目总览</Link>
          )}
          {i < lesson.steps.length - 1 ? (
            <Link to={stepUrl(projectId, lessonId, lesson.steps[i + 1].id)}>
              下一步：{lesson.steps[i + 1].title} →
            </Link>
          ) : (
            <Link to={"/projects/" + projectId}>返回项目，选择下一课 →</Link>
          )}
        </nav>
      )}
    </section>
  );
}
