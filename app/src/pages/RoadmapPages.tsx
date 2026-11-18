import {
  Recommendation,
  ProjectProgress,
} from "../features/progress/ProgressViews";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { Catalog } from "../content/catalog";
import { loadKnowledge } from "../content/catalog";
import { useResource } from "../content/useResource";
import { EmptyState } from "../components/States";
import a from "../styles/App.module.css";
import s from "../styles/Library.module.css";
export function RoadmapPage({ catalog: c }: { catalog: Catalog }) {
  const { data, error, retry } = useResource("knowledge", loadKnowledge);
  const [graph, setGraph] = useState(false);
  return (
    <section>
      <span className={a.eyebrow}>LEARNING ROADMAP</span>
      <h1>循序渐进，也可以选择自己的分支</h1>
      <p className={a.lead}>
        四阶段是学习负担分层。项目建议顺序与知识硬前置分别列出，已有相关技能时可以跳过前序练习。
      </p>
      <div className={s.notice}>
        <p>
          基础桥梁：Python变量/函数、DataFrame、编码与日期、缺失与重复、均值与比例等短单元仍待制作，不计入29项目。P09采集是可选支线，不阻断其他项目。
        </p>
      </div>
      <Recommendation />
      <button
        className={a.secondaryButton}
        aria-pressed={graph}
        onClick={() => setGraph(!graph)}
      >
        {graph ? "显示阶段列表" : "显示知识依赖图"}
      </button>
      {graph && data && <DependencyGraph branches={data.branches} />}
      {!graph &&
        c.stages.map((stage, i) => (
          <section className={s.infoBox} key={stage.id}>
            <span className={a.eyebrow}>
              0{i + 1} · {stage.projectIds.length} 个项目
            </span>
            <h2>{stage.title}阶段</h2>
            <p>{stage.goal}</p>
            <ol className={s.roadmapList}>
              {stage.projectIds.map((id) => {
                const p = c.projects.find((x) => x.id === id)!;
                return (
                  <li key={id}>
                    <Link to={"/projects/" + id}>
                      <strong>
                        {id} · {p.title}
                      </strong>
                    </Link>
                    <p>
                      <ProjectProgress id={p.id} />
                    </p>
                    <p>知识硬前置：{p.prerequisites}</p>
                    <p>建议先学：{p.recommendationNote}</p>
                    <span className={s.note}>
                      {p.learning.readySteps
                        ? `${p.learning.readySteps}步已开放`
                        : "步骤仅规划"}{" "}
                      · {p.availability?.label || "内容待核对"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      <h2>按知识分支浏览</h2>
      <p className={a.lead}>
        以下为批准设计中的知识依赖；项目推荐不作为强制解锁门槛。
      </p>
      {error ? (
        <EmptyState title="知识分支读取失败">
          {error}
          <button onClick={retry}>重试</button>
        </EmptyState>
      ) : !data ? (
        <p role="status">正在读取知识分支…</p>
      ) : (
        <div className={s.branchGrid}>
          {data.branches.map((b) => (
            <article key={b.id} className={s.infoBox}>
              <h3>{b.title}</h3>
              <p>
                硬知识前置：
                {b.requires
                  .map((id) => data.branches.find((n) => n.id === id)?.title)
                  .join("；") || "从基础开始"}
              </p>
              <Link to={"/knowledge?branch=" + b.id}>浏览分支与知识索引 →</Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
function DependencyGraph({
  branches,
}: {
  branches: { id: string; title: string; requires: string[] }[];
}) {
  const level = (id: string): number => {
    const branch = branches.find((b) => b.id === id)!;
    return branch.requires.length
      ? 1 + Math.max(...branch.requires.map(level))
      : 0;
  };
  const levels = branches.map((b) => level(b.id));
  const max = Math.max(0, ...levels);
  const positions = new Map(
    branches.map((b, i) => {
      const rank = branches
        .slice(0, i)
        .filter((n) => level(n.id) === levels[i]).length;
      return [b.id, { x: 20 + levels[i] * 260, y: 35 + rank * 90 }];
    }),
  );
  const height = Math.max(...[...positions.values()].map((p) => p.y)) + 80;
  return (
    <section className={s.infoBox}>
      <h2>知识硬前置依赖图</h2>
      <p>
        箭头从前置知识指向后续知识。项目建议顺序不作为强制解锁门槛；下方保留文字前置列表。
      </p>
      <div
        style={{ overflowX: "auto" }}
        tabIndex={0}
        role="region"
        aria-label="知识依赖图，可横向滚动"
      >
        <svg
          role="img"
          aria-label="知识分支及其前置关系，详见下方文字列表"
          width={(max + 1) * 260}
          height={height}
        >
          <defs>
            <marker
              id="arrow"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8" fill="var(--muted)" />
            </marker>
          </defs>
          {branches.flatMap((b) =>
            b.requires.map((id) => {
              const start = positions.get(id)!,
                end = positions.get(b.id)!;
              return (
                <line
                  key={id + b.id}
                  x1={start.x + 210}
                  y1={start.y + 25}
                  x2={end.x}
                  y2={end.y + 25}
                  stroke="var(--muted)"
                  markerEnd="url(#arrow)"
                />
              );
            }),
          )}
          {branches.map((b) => {
            const p = positions.get(b.id)!;
            return (
              <g key={b.id}>
                <rect
                  x={p.x}
                  y={p.y}
                  width={210}
                  height={50}
                  rx={8}
                  fill="var(--surface)"
                  stroke="var(--primary-text)"
                />
                <text
                  x={p.x + 10}
                  y={p.y + 30}
                  fill="var(--text)"
                  fontSize={13}
                >
                  {b.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
const definitions: Record<string, string> = {
  Pandas: "用于表格读取、筛选、分组、连接和统计的Python数据分析库。",
  NumPy: "用于多维数组及数值运算的Python库。",
  EDA: "探索性数据分析，通过数据质量检查、分布和关系观察形成可验证的问题。",
  groupby: "按一个或多个键分组，再对各组聚合、变换或筛选。",
  pivot_table: "通过索引、列和聚合函数生成透视统计表。",
  KMeans: "按样本到簇中心的距离迭代分组，需要关注缩放、簇数与随机初始化。",
  Altair: "以声明式图形语法描述数据与视觉编码的Python可视化库。",
  SciPy: "提供科学计算算法；本目录P26实际使用层次聚类相关方法。",
  层次聚类: "逐层合并或拆分样本构造聚类层次，结果依赖距离和连接准则。",
  逻辑回归:
    "常用于二分类的统计模型；系数位于对数odds尺度，不能直接解释为概率增量。",
  线性回归:
    "建立响应变量与解释变量的线性关系，需要区分拟合内表现和独立测试评估。",
};
export function KnowledgePage({ catalog: c }: { catalog: Catalog }) {
  const { tagId } = useParams();
  const [params] = useSearchParams();
  const selectedBranch = params.get("branch");
  const { data, error, retry } = useResource("knowledge", loadKnowledge);
  if (error)
    return (
      <EmptyState title="知识索引读取失败">
        {error}
        <button onClick={retry}>重试</button>
      </EmptyState>
    );
  if (!data) return <p role="status">正在读取本地知识索引…</p>;
  const tag = tagId ? data.tags.find((t) => t.id === tagId) : null;
  if (tagId && !tag)
    return (
      <EmptyState title="未登记的知识标签">
        该标签没有已核实的项目使用证据。
        <Link to="/knowledge">返回知识索引</Link>
      </EmptyState>
    );
  return (
    <section>
      <span className={a.eyebrow}>KNOWLEDGE INDEX</span>
      <h1>{tag ? tag.title : "把方法与真实项目连接起来"}</h1>
      <p className={a.lead}>
        {tag
          ? definitions[tag.id] ||
            "此页提供已核实使用该知识的项目与证据索引；独立概念教材和练习仍待课程制作阶段补齐。"
          : `${data.tags.length} 个已核实标签。仅列实际使用方法，不将导入未用和岗位文本词汇计入技术。`}
      </p>
      {selectedBranch && (
        <section className={s.infoBox}>
          <h2>
            {data.branches.find((b) => b.id === selectedBranch)?.title ||
              "未登记的知识分支"}
          </h2>
          <p>
            硬前置：
            {data.branches
              .find((b) => b.id === selectedBranch)
              ?.requires.map(
                (id) => data.branches.find((b) => b.id === id)?.title,
              )
              .join("、") || "见完整路线中的基础起点"}
            。以下标签保留全部核实证据，不把分支名称当作自动掌握记录。
          </p>
          <Link to="/roadmap">查看完整依赖关系 →</Link>
        </section>
      )}
      {tag ? (
        <>
          <Link to="/knowledge" className={a.back}>
            ← 全部知识标签
          </Link>
          <p className={s.note}>
            {tag.evidenceNote}{" "}
            代码单元证据有明确定位才展示；其余保留资产审计证据。
          </p>
          {tag.usages.map((u) => {
            const p = c.projects.find((p) => p.id === u.projectId)!;
            return (
              <section key={u.projectId} className={s.infoBox}>
                <Link to={"/projects/" + p.id}>
                  <h2>
                    {p.id} · {p.title} →
                  </h2>
                </Link>
                <p>硬前置：{p.prerequisites}</p>
                <p>证据：{u.auditEvidence}</p>
                {u.codeRefs.length ? (
                  u.codeRefs.map((ref, i) => (
                    <details key={i}>
                      <summary>
                        {ref.source.split("/").pop()} · 单元 {ref.cell} ·
                        原代码定位
                      </summary>
                      <pre>{ref.snippet}</pre>
                      <p className={s.note}>
                        来自原代码，只读引用，未在网页运行。
                      </p>
                    </details>
                  ))
                ) : (
                  <p className={s.note}>
                    已由资产审计核实；精确代码单元的逐课定位待整理，不虚构步骤地址。
                  </p>
                )}
                <p className={s.note}>对应练习见项目总览；参考答案尚未制作。</p>
              </section>
            );
          })}
        </>
      ) : (
        <>
          <div className={s.tags}>
            {data.tags.map((t) => (
              <Link key={t.id} to={"/knowledge/" + encodeURIComponent(t.id)}>
                {t.title} <span>{t.usages.length}</span>
              </Link>
            ))}
          </div>
          <section className={s.infoBox}>
            <h2>知识硬前置分支</h2>
            <div className={s.branchGrid}>
              {data.branches.map((b) => (
                <article key={b.id}>
                  <h3>{b.title}</h3>
                  <p>
                    前置：
                    {b.requires
                      .map(
                        (id) => data.branches.find((n) => n.id === id)?.title,
                      )
                      .join("；") || "基础起点"}
                  </p>
                </article>
              ))}
            </div>
            <Link to="/roadmap">查看项目学习路线 →</Link>
          </section>
        </>
      )}
    </section>
  );
}
