import { useProgress } from "../features/progress/ProgressProvider";
import { projectProgress } from "../features/progress/engine.mjs";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Search, ArrowRight } from "lucide-react";
import type { Catalog, Filters } from "../content/catalog";
import { filterProjects } from "../content/catalog";
import { ProjectList } from "../components/ProjectList";
import { EmptyState } from "../components/States";
import a from "../styles/App.module.css";
import s from "../styles/Library.module.css";
export function ProjectDirectory({ catalog: c }: { catalog: Catalog }) {
  const [params, setParams] = useSearchParams();
  const f: Filters = Object.fromEntries(params);
  const {manifest,data}=useProgress();
  const results = filterProjects(c, f).filter(p=>!params.get("learning")||(manifest&&data&&projectProgress(manifest,data,p.id).status===params.get("learning")));
  const tags = [...new Set(c.projects.flatMap((p) => p.skillTags))].sort(
    (a, b) => a.localeCompare(b, "zh-CN"),
  );
  function change(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  }
  const filters = [
    ["learning","学习状态",[["not_started","未开始"],["in_progress","进行中"],["completed","完成"],["review_needed","待复习"],["unavailable","未开放"]]],
    ["category", "业务分类", c.categories.map((c) => [c.id, c.title])],
    [
      "difficulty",
      "学习难度",
      ["入门", "初级", "进阶", "高级"].map((x) => [x, x]),
    ],
    ["tag", "已核实技术", tags.map((x) => [x, x])],
    [
      "readiness",
      "资源就绪度",
      [
        ["audited", "资料已审计"],
        ["known-gaps", "资料存在缺口"],
        ["not-adapted", "课程待开放"],
        ["representative-ready", "课程已开放"],
        ["not-run", "结果未重跑"],
      ],
    ],
    [
      "sort",
      "排列顺序",
      [
        ["route", "推荐路线顺序"],
        ["category", "按业务分类"],
      ],
    ],
  ] as [string, string, string[][]][];
  return (
    <section>
      <span className={a.eyebrow}>PROJECT LIBRARY</span>
      <h1>为你的下一个问题，找到起点</h1>
      <p className={a.lead}>
        {c.projects.length} 个真实项目，{c.categories.length}{" "}
        个业务领域。先理解问题，再选择方法。
      </p>
      <div className={s.filterPanel}>
        <form
          role="search"
          className={a.librarySearch}
          onSubmit={(e) => e.preventDefault()}
        >
          <Search size={20} />
          <input
            aria-label="搜索项目名称、原名称或知识点"
            value={f.q || ""}
            onChange={(e) => change("q", e.target.value)}
            placeholder="搜索项目名称、原目录、知识点，例如：层次聚类"
          />
        </form>
        <div className={s.filters}>
          {filters.map(([name, label, options]) => (
            <label key={name}>
              {label}
              <select
                aria-label={label}
                value={params.get(name) || (name === "sort" ? "route" : "")}
                onChange={(e) => change(name, e.target.value)}
              >
                {name !== "sort" && <option value="">全部</option>}
                {options.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>
      <div className={s.results}>
        <p role="status">
          找到 <strong>{results.length}</strong> / {c.projects.length} 个项目
        </p>
        {params.size > 0 && (
          <button onClick={() => setParams({})}>清除全部条件</button>
        )}
      </div>
      <div className={s.chips}>
        {[...params]
          .filter(([k, v]) => v && !(k === "sort" && v === "route"))
          .map(([k, v]) => (
            <button
              key={k}
              onClick={() => change(k, "")}
              aria-label={"移除条件 " + k + " " + v}
            >
              {k === "q" ? "搜索" : filters.find((x) => x[0] === k)?.[1] || k}：
              {filters
                .find((x) => x[0] === k)?.[2]
                .find((x) => x[0] === v)?.[1] || v}{" "}
              ×
            </button>
          ))}
      </div>
      {results.length ? (
        <ProjectList projects={results} catalog={c} />
      ) : (
        <EmptyState title="没有符合全部条件的项目">
          减少筛选条件或清除搜索。仅展示已核实使用的技术，未导入虚构课程。
        </EmptyState>
      )}
    </section>
  );
}
export function CategoryPage({ catalog: c }: { catalog: Catalog }) {
  const { categoryId } = useParams();
  const cat = c.categories.find((x) => x.id === categoryId);
  if (!cat)
    return (
      <EmptyState title="未知分类">
        该分类未登记。<Link to="/projects">返回项目库</Link>
      </EmptyState>
    );
  const projects = cat.projectIds.map((id) =>
    c.projects.find((p) => p.id === id)!,
  );
  return (
    <section>
      <Link className={a.back} to="/projects">
        ← 全部项目
      </Link>
      <span className={a.eyebrow}>
        EXPLORE BY TOPIC · {cat.projectIds.length} 个项目
      </span>
      <h1>{cat.title}</h1>
      <p className={a.lead}>{cat.intro}</p>
      <div className={s.twoColumns}>
        <div className={s.infoBox}>
          <h2>在这个领域练习什么</h2>
          <ul>
            {cat.objectives.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className={s.note}>目标来自该领域项目的已批准学习设计。</p>
        </div>
        <div className={s.infoBox}>
          <h2>建议学习顺序</h2>
          <div className={s.sequence}>
            {projects.map((p, i) => (
              <span key={p.id}>
                <Link to={"/projects/" + p.id}>{p.id}</Link>
                {i < projects.length - 1 && <ArrowRight size={14} />}
              </span>
            ))}
          </div>
          <p>
            按已批准全局路线筛选本领域项目。具备前置知识时可直接选择，不要求全部依次完成。
          </p>
        </div>
      </div>
      <div className={s.results}>
        <h2>领域项目</h2>
        <Link to={"/projects?category=" + cat.id}>在项目库中筛选 →</Link>
      </div>
      <ProjectList projects={projects} catalog={c} />
    </section>
  );
}
