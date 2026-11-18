import { useProgress } from "../features/progress/ProgressProvider";
import {
  ProgressSummary,
  Recommendation,
  BackupPanel,
} from "../features/progress/ProgressViews";
import { ResumeLink } from "../features/learning/ResumeLink";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Search,
  Layers,
  FolderOpen,
  Clock3,
  Route,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import type { Catalog, Project } from "../content/catalog";
import { searchProjects } from "../content/catalog";
import { EmptyState, Pending } from "../components/States";
import s from "../styles/App.module.css";
function Heading({
  label,
  title,
  to,
}: {
  label: string;
  title: string;
  to?: string;
}) {
  return (
    <div className={s.sectionHeading}>
      <div>
        <span className={s.eyebrow}>{label}</span>
        <h2>{title}</h2>
      </div>
      {to && (
        <Link to={to}>
          查看全部 <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
function ProjectRow({ p, catalog }: { p: Project; catalog: Catalog }) {
  return (
    <Link to={"/projects/" + p.id} className={s.projectRow}>
      <span className={s.projectId}>{p.id}</span>
      <div className={s.projectCopy}>
        <div className={s.projectTitle}>{p.title}</div>
        <p>{p.summary}</p>
        <div className={s.meta}>
          <span>
            {catalog.categories.find((c) => c.id === p.categoryId)?.title}
          </span>
          <span>{p.difficulty}</span>
          {p.skillTags.slice(0, 3).map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
      <span className={s.status}>
        {p.learning.readySteps
          ? `${p.learning.readySteps}步可学习`
          : "步骤仅规划"}
      </span>
      <ArrowUpRight className={s.rowArrow} size={18} />
    </Link>
  );
}
export function Home({ catalog: c }: { catalog: Catalog }) {
  const recommended = c.stages[0].projectIds.map((id) =>
    c.projects.find((p) => p.id === id)!,
  );
  return (
    <>
      <section className={s.hero}>
        <div className={s.heroContent}>
          <div className={s.pill}>
            <span /> 真实项目 · 循序学习
          </div>
          <h1>
            从读懂数据，
            <br />
            到独立完成分析。
          </h1>
          <p className={s.heroText}>
            把业务问题、分析代码与结果解释连成一条学习路径。
            <br className={s.desktopBreak} />
            从一个真实项目开始，逐步建立自己的数据分析方法。
          </p>
          <div className={s.actions}>
            <Link to="/projects/P21" className={s.button}>
              查看入门项目 <ArrowRight size={18} />
            </Link>
            <Link to="/projects" className={s.secondaryButton}>
              浏览项目库 <ArrowUpRight size={17} />
            </Link>
          </div>
          <p className={s.heroNote}>
            <ShieldCheck size={15} />{" "}
            29个项目的可核实内容已接入；原保存结果与新教学计算分别标明。
          </p>
        </div>
        <aside className={s.heroAside}>
          <div className={s.asideTop}>
            <span className={s.smallIcon}>
              <BookOpen size={20} />
            </span>
            <span className={s.eyebrow}>你的学习空间</span>
          </div>
          <h2>你的阅读起点</h2>
          <ProgressSummary />

          <ResumeLink />
        </aside>
      </section>
      <Recommendation />
      <section className={s.stats} aria-label="内容目录统计">
        {[
          [c.projects.length, "个真实项目", "来自已审计的原始资料", FolderOpen],
          [c.categories.length, "个业务分类", "从兴趣领域切入学习", Layers],
          [c.stages.length, "个学习阶段", "入门到高级，按需选学", Route],
        ].map(([n, label, desc, Icon]) => {
          const I = Icon as typeof FolderOpen;
          return (
            <div key={String(label)}>
              <I size={23} />
              <div>
                <strong>{String(n)}</strong>
                <span>{String(label)}</span>
                <p>{String(desc)}</p>
              </div>
            </div>
          );
        })}
      </section>
      <section className={s.section}>
        <Heading label="LEARNING PATH" title="建立你的分析体系" to="/roadmap" />
        <div className={s.stageGrid}>
          {c.stages.map((stage, i) => (
            <Link to="/roadmap" key={stage.id} className={s.stageCard}>
              <div className={s.stageTop}>
                <span>0{i + 1}</span>
                <ArrowUpRight size={18} />
              </div>
              <h3>
                {stage.title}
                <span>{stage.projectIds.length} 个项目</span>
              </h3>
              <p>{stage.goal}</p>
              <div className={s.stageBottom}>
                {i === 0
                  ? "读取 · 分组 · 图表"
                  : i === 1
                    ? "清洗 · 探索 · 解释"
                    : i === 2
                      ? "特征 · 建模 · 评估"
                      : "方法审辨 · 多源分析"}
              </div>
            </Link>
          ))}
        </div>
        <p className={s.caption}>
          学习阶段用于分层选学；推荐顺序不代表必须完成所有前序项目。可在学习路线中查看知识前置与可选分支。
        </p>
      </section>
      <div className={s.learningGrid}>
        <section>
          <Heading label="START HERE" title="推荐学习入口" to="/projects" />
          <div className={s.panel}>
            {recommended.map((p) => (
              <ProjectRow key={p.id} p={p} catalog={c} />
            ))}
          </div>
          <p className={s.caption}>
            依据已批准路线推荐入门项目。可进入项目课程、真实图表和字段字典；资料缺口在对应步骤说明。
          </p>
        </section>
        <section>
          <Heading label="YOUR ACTIVITY" title="最近学习" />
          <div className={`${s.panel} ${s.activity}`}>
            <Clock3 size={30} />
            <h3>最近位置与主动学习记录</h3>
            <ProgressSummary />
            <div className={s.activityBottom}>
              <span>继续最近阅读</span>
              <ResumeLink />
            </div>
            <Link to="/progress">
              查看学习记录 <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </div>
      <section className={s.section}>
        <Heading
          label="EXPLORE BY TOPIC"
          title="从感兴趣的领域出发"
          to="/projects"
        />
        <div className={s.categoryGrid}>
          {c.categories.map((category, i) => (
            <Link
              key={category.id}
              to={"/categories/" + category.id}
              className={s.categoryCard}
            >
              <span className={s.categoryNumber}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{category.title}</h3>
                <p>
                  {
                    c.projects.filter((p) => p.categoryId === category.id)
                      .length
                  }{" "}
                  个登记项目
                </p>
              </div>
              <ArrowUpRight size={17} />
            </Link>
          ))}
        </div>
      </section>
      <div className={s.sourceNotice}>
        <ShieldCheck size={22} />
        <div>
          <strong>让每一步都有依据</strong>
          <p>
            项目名称、方法与资料缺口来自审计目录。原始文件只读保留，课程改编与结果复现分阶段验收。
          </p>
        </div>
        <Link to="/projects">
          查看目录 <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
}
type Preferences = { theme: "light" | "dark"; size: "normal" | "large" };
function getPreferences(): Preferences {
  return { theme: "light", size: "normal" };
}
export function applyPreferences(p = getPreferences()) {
  document.documentElement.dataset.theme = p.theme;
  document.documentElement.dataset.size = p.size;
}
export function SettingsPage({ catalog }: { catalog: Catalog }) {
  const { data, save } = useProgress();
  const p = data?.preferences || getPreferences();
  const [notice, setNotice] = useState("");
  function update(next: Preferences) {
    applyPreferences(next);
    if (data) void save({ ...data, preferences: next });
    else setNotice("进度存储未就绪，设置仅临时应用。");
  }
  return (
    <section className={s.reading}>
      <span className={s.eyebrow}>MAKE IT YOURS</span>
      <h1>舒适地阅读，专注地学习</h1>
      <p className={s.lead}>阅读偏好保存在当前浏览器，不影响原始项目文件。</p>
      <div className={s.infoPanel}>
        <h2>
          <SlidersHorizontal size={20} /> 阅读设置
        </h2>
        <fieldset>
          <legend>页面主题</legend>
          {(["light", "dark"] as const).map((t) => (
            <label key={t}>
              <input
                type="radio"
                name="theme"
                checked={p.theme === t}
                onChange={() => update({ ...p, theme: t })}
              />
              {t === "light" ? "浅色" : "深色"}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>正文字号</legend>
          {(["normal", "large"] as const).map((size) => (
            <label key={size}>
              <input
                type="radio"
                name="size"
                checked={p.size === size}
                onChange={() => update({ ...p, size })}
              />
              {size === "normal" ? "标准 · 16px" : "大号 · 18px"}
            </label>
          ))}
        </fieldset>
        <p role="status">{notice}</p>
      </div>
      <div className={s.infoPanel}>
        <h2>本地运行与内容状态</h2>
        <p>正式入口：http://127.0.0.1:4173</p>
        <p>
          首页、目录与界面资源由本机提供，不请求公网字体或脚本。当前
          {catalog.projects.reduce((n, p) => n + p.learning.readyLessons, 0)}
          节课已纳入本地资源。原资料缺口与尚未独立重跑的流程按项目说明。
        </p>
        <BackupPanel />
      </div>
    </section>
  );
}
