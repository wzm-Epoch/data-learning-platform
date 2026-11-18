import {ContentStatus} from "./ContentStatus";
import { ProjectProgress } from "../features/progress/ProgressViews";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { Project, Catalog } from "../content/catalog";
import s from "../styles/Library.module.css";
export function ProjectList({
  projects,
  catalog,
}: {
  projects: Project[];
  catalog: Catalog;
}) {
  return (
    <div className={s.projectList}>
      {projects.map((p) => (
        <article key={p.id} className={s.projectCard}>
          <div className={s.cardTop}>
            <span className={s.id}>{p.id}</span>
            <span>
              {catalog.categories.find((c) => c.id === p.categoryId)?.title} ·{" "}
              {p.difficulty}
            </span>
          </div>
          <Link to={"/projects/" + p.id} className={s.projectLink}>
            <h2>{p.title}</h2>
            <ArrowUpRight size={18} />
          </Link>
          <p>{p.summary}</p>
          <div className={s.tags}>
            {p.skillTags.slice(0, 3).map((t) => (
              <Link key={t} to={"/knowledge/" + encodeURIComponent(t)}>
                {t}
              </Link>
            ))}
          </div>
          <details className={s.smallDetails}>
            <summary>全部 {p.skillTags.length} 个核实标签</summary>
            <div className={s.tags}>
              {p.skillTags.map((t) => (
                <Link key={t} to={"/knowledge/" + encodeURIComponent(t)}>
                  {t}
                </Link>
              ))}
            </div>
          </details>
          <div className={s.cardStatus}>
            <span
              className={p.readiness.source === "known-gaps" ? s.warning : ""}
            >
              资料：
              {p.readiness.source === "known-gaps" ? "存在已知缺口" : "已审计"}
            </span>
            <span>
              课程：
              {p.learning.readyLessons
                ? `${p.learning.readyLessons}课 / ${p.learning.readySteps}步开放`
                : "步骤仅规划"}
            </span>
            <ContentStatus project={p}/>
          </div>
          <p className={s.note}><ProjectProgress id={p.id}/></p>
        </article>
      ))}
    </div>
  );
}
