import {ContentStatus} from "../components/ContentStatus";
import { ProjectProgress } from "../features/progress/ProgressViews";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, BookOpen, FileText, ShieldCheck } from "lucide-react";
import type { Catalog, ProjectDetail } from "../content/catalog";
import { loadProject } from "../content/catalog";
import { useResource } from "../content/useResource";
import { EmptyState } from "../components/States";
import a from "../styles/App.module.css";
import s from "../styles/Library.module.css";
function ProjectResource({
  catalog,
  children,
}: {
  catalog: Catalog;
  children: (p: ProjectDetail) => React.ReactNode;
}) {
  const { projectId = "" } = useParams();
  const known = catalog.projects.some((p) => p.id === projectId);
  const { data, error, retry } = useResource(projectId, () =>
    known
      ? loadProject(projectId)
      : Promise.reject(new Error("目录没有登记这个项目ID。")),
  );
  if (error)
    return (
      <EmptyState title="无法打开项目">
        {error}{" "}
        <button className={s.inlineButton} onClick={retry}>
          重试
        </button>{" "}
        <Link to="/projects">返回项目库</Link>
      </EmptyState>
    );
  if (!data) return <p role="status">正在读取此项目的本地内容包…</p>;
  return <>{children(data)}</>;
}
function MetaLinks({ p }: { p: ProjectDetail }) {
  return (
    <nav className={s.localNav} aria-label="项目页面">
      <Link to={"/projects/" + p.id}>项目总览</Link>
      <Link to={"/projects/" + p.id + "/dictionary"}>字段字典</Link>
      <Link to={"/projects/" + p.id + "/sources"}>原文件来源</Link>
    </nav>
  );
}
function Title({ p }: { p: ProjectDetail }) {
  return (
    <>
      <Link className={a.back} to={"/categories/" + p.categoryId}>
        ← 返回所属领域
      </Link>
      <span className={a.eyebrow}>
        {p.id} · {p.difficulty} · 原结果尚未重跑
      </span>
      <h1>{p.title}</h1><p><ProjectProgress id={p.id}/></p>
      <p className={a.lead}>{p.summary}</p>
      <MetaLinks p={p} />
    </>
  );
}
export function ProjectPage({ catalog }: { catalog: Catalog }) {
  return (
    <ProjectResource catalog={catalog}>
      {(p) => (
        <>
          <Title p={p} />
          <div className={s.projectHero}>
            <div>
              <BookOpen size={24} />
              <h2>从问题到解释，了解这条学习路径</h2>
              <p>
                {p.learning.readyLessons
                  ? `已开放${p.learning.readyLessons}节课、${p.learning.readySteps}个可学习步骤。代码、预计算结果和练习分别标明来源；网页不执行Python。`
                  : "专属步骤已规划，课程讲解与结果尚未制作。可先阅读数据字典、来源和方法限制。"}
              </p>
              <div className={a.actions}>
                {p.learning.readyLessons ? (
                  <Link
                    className={a.button}
                    to={
                      "/projects/" +
                      p.id +
                      "/lessons/" +
                      p.lessons.find((l) => l.status === "ready")?.id
                    }
                  >
                    进入课程 <ArrowRight size={16} />
                  </Link>
                ) : (
                  <button className={s.disabledButton} disabled>
                    课程待开放
                  </button>
                )}
                <Link
                  to={"/projects/" + p.id + "/dictionary"}
                  className={a.secondaryButton}
                >
                  查看字段字典 <ArrowRight size={16} />
                </Link>
              </div>
            </div>
            <div className={s.stateList}>
              <span>
                原资料：
                {p.readiness.source === "known-gaps" ? "有已知缺口" : "已审计"}
              </span>
              <span>
                教学课程：
                {p.learning.readyLessons
                  ? `${p.learning.readyLessons}课 / ${p.learning.readySteps}步已开放`
                  : "步骤仅规划"}
              </span>
              <ContentStatus project={p}/>
              <span>
                课程资源：{p.learning.readyLessons ? "课已打包" : "待生成"}
              </span>
              <span>学习记录：<ProjectProgress id={p.id}/></span>
            </div>
          </div>
          {p.scopeNotes.length > 0 && (
            <div className={s.notice}>
              <ShieldCheck size={22} />
              <div>
                {p.scopeNotes.map((x) => (
                  <p key={x}>{x}</p>
                ))}
              </div>
            </div>
          )}
          <div className={s.twoColumns}>
            <section className={s.infoBox}>
              <h2>学习目标</h2>
              <ul>
                {p.learningObjectives.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </section>
            <div>
              <section className={s.infoBox}>
                <h2>硬前置知识</h2>
                <p>{p.prerequisites}</p>
              </section>
              <section className={s.infoBox}>
                <h2>建议先学项目</h2>
                <p>{p.recommendationNote}</p>
                <div className={s.tags}>
                  {p.recommendedProjectIds.map((id) => (
                    <Link to={"/projects/" + id} key={id}>
                      {id} · {catalog.projects.find((x) => x.id === id)?.title}
                    </Link>
                  ))}
                </div>
                <p className={s.note}>这是建议练习关系，不是强制解锁条件。</p>
              </section>
            </div>
          </div>
          <section className={s.infoBox}>
            <h2>实际方法与原分析流程</h2>
            <p>{p.methods}</p>
            <p>{p.originalWorkflow || "原流程概述待整理。"}</p>
            <div className={s.tags}>
              {p.skillTags.map((t) => (
                <Link to={"/knowledge/" + encodeURIComponent(t)} key={t}>
                  {t}
                </Link>
              ))}
            </div>
          </section>
          <section className={s.infoBox}>
            <h2>数据规模与粒度</h2>
            <p className={s.note}>
              以下为审计时文件读取行数，包含字典、结果或说明行；不将各表行数相加作为独立样本数。未知来源和授权不补猜测。
            </p>
            <div className={s.datasetGrid}>
              {p.datasets.map((d) => (
                <Link
                  key={d.id}
                  className={s.datasetCard}
                  to={"/projects/" + p.id + "/dictionary?dataset=" + d.id}
                >
                  <FileText size={18} />
                  <strong>
                    {d.path.split("/").pop()}
                    {d.sheet ? " / " + d.sheet : ""}
                  </strong>
                  <span>
                    {d.rows.toLocaleString()} 行 × {d.columns} 列
                  </span>
                  <p>{d.grain}</p>
                  <span className={s.note}>
                    来源出处：{d.origin || "未独立核实"} · 授权：
                    {d.license || "未知"}
                  </span>
                </Link>
              ))}
            </div>
          </section>
          <section className={s.infoBox}>
            <h2>规划课节</h2>
            <p>
              课节来源对应正式Notebook；已开放与仅规划分别标明，不以步骤清单冒充完整课。
            </p>
            {p.lessons.map((l, i) => (
              <Link
                className={s.lesson}
                key={l.id}
                to={"/projects/" + p.id + "/lessons/" + l.id}
              >
                <span>0{i + 1}</span>
                <div>
                  <strong>{l.title}</strong>
                  <p>
                    {l.status === "ready"
                      ? `${l.stepCount}步可学习 · 进入课程`
                      : `${l.stepCount}步仅规划 · 查看准备状态`}
                  </p>
                </div>
                <ArrowRight size={18} />
              </Link>
            ))}
          </section>
          <section className={s.infoBox}>
            <h2>结果证据与限制</h2>
            <div className={s.notice}>
              <p>
                <strong>原文件保存结果，尚未重跑</strong>
                <br />
                {p.savedResult || "原保存结果概要待整理。"}
              </p>
            </div>
            <ul>
              {p.limitations.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p>本阶段没有生成新模型成绩，不以页面可访问代替分析结果复现。</p>
          </section>
          <section className={s.infoBox}>
            <h2>巩固练习概览</h2>
            <p>{p.exercise.text}</p>
            <p className={s.note}>
              {p.exercise.provenance}。{p.exercise.answerStatus}。
            </p>
          </section>
          <Link
            to={"/projects/" + p.id + "/sources"}
            className={a.secondaryButton}
          >
            核对原文件与来源 <ArrowRight size={16} />
          </Link>
        </>
      )}
    </ProjectResource>
  );
}
export function DictionaryPage({ catalog }: { catalog: Catalog }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get("dataset");
  return (
    <ProjectResource catalog={catalog}>
      {(p) => (
        <>
          <Title p={p} />
          <h2>字段字典</h2>
          <p className={a.lead}>
            物理字段、读取类型与缺失来自审计。未核实的业务语义和单位明确保留为未知。
          </p>
          <label className={s.datasetSelect}>
            选择数据表
            <select
              aria-label="选择数据表"
              value={selected || ""}
              onChange={(e) => {
                setParams(e.target.value ? { dataset: e.target.value } : {});
              }}
            >
              <option value="">全部数据表</option>
              {p.datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.path.split("/").pop()}
                  {d.sheet ? " / " + d.sheet : ""}
                </option>
              ))}
            </select>
          </label>
          {selected && !p.datasets.some((d) => d.id === selected) ? (
            <EmptyState title="没有找到这张数据表">
              请重新选择数据表。
            </EmptyState>
          ) : (
            p.datasets
              .filter((d) => !selected || d.id === selected)
              .map((d) => (
                <section className={s.infoBox} key={d.id}>
                  <h3>
                    {d.path.split("/").pop()}
                    {d.sheet ? " / " + d.sheet : ""}
                  </h3>
                  <p>
                    {d.rows.toLocaleString()} 行 × {d.columns} 列 · 编码：
                    {d.encoding || "工作簿或审计未注明"} · {d.grain}
                  </p>
                  <p className={s.path}>
                    原路径：{d.path}
                    <br />
                    SHA-256：{d.sha256}
                  </p>
                  <h3>物理读取字段（审计快照）</h3>
                  <div
                    className={s.tableScroll}
                    tabIndex={0}
                    aria-label="物理字段字典，可横向滚动"
                  >
                    <table>
                      <caption>物理读取字段；缺失数不代表清洗后缺失</caption>
                      <thead>
                        <tr>
                          {[
                            "字段名",
                            "读取类型",
                            "业务语义",
                            "缺失数",
                            "单位",
                            "来源证据",
                          ].map((x) => (
                            <th scope="col" key={x}>
                              {x}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {d.fields.map((f, i) => (
                          <tr key={i}>
                            <th scope="row">{f.name}</th>
                            <td>{f.dtype}</td>
                            <td>{f.meaning || "未知 / 待核实"}</td>
                            <td>{f.missing === null ? "未统计" : f.missing}</td>
                            <td>{f.unit || "未知 / 待核实"}</td>
                            <td>{f.evidence}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {p.id === "P25" || p.id === "P26" ? (
                    <div className={s.teaching}>
                      <h3>教学清洗字段与原代码映射</h3>
                      <p>
                        下方是原Notebook中的读取和重命名代码参考，与上方物理表头分开。尚未执行教学清洗，清洗后字段类型和缺失数未知。
                      </p>
                      {d.teachingMappings.length ? (
                        d.teachingMappings.map((m, i) => (
                          <details key={i}>
                            <summary>
                              {m.source.split("/").pop()} · 单元 {m.cell}
                            </summary>
                            {m.outputFields.length > 0 && (
                              <div>
                                <p>原代码定义的清洗字段：</p>
                                <div className={s.tags}>
                                  {m.outputFields.map((name, index) => (
                                    <span key={index}>
                                      {m.inputFields[index]
                                        ? m.inputFields[index] + " → "
                                        : ""}
                                      {name}
                                    </span>
                                  ))}
                                </div>
                                <p className={s.note}>
                                  这些名称来自原代码；清洗后类型、缺失数与单位仍需独立核对。
                                </p>
                              </div>
                            )}
                            <pre>{m.code}</pre>
                            <p>{m.note}</p>
                          </details>
                        ))
                      ) : (
                        <p>
                          该表清洗后字段映射尚未整理，不将物理表头冒充教学字段。
                        </p>
                      )}
                    </div>
                  ) : null}
                </section>
              ))
          )}
        </>
      )}
    </ProjectResource>
  );
}
import { useSearchParams } from "react-router-dom";
export function SourcesPage({ catalog }: { catalog: Catalog }) {
  return (
    <ProjectResource catalog={catalog}>
      {(p) => (
        <>
          <Title p={p} />
          <h2>原文件来源与审计证据</h2>
          <p className={a.lead}>
            原始资产保留在本机只读目录。此页登记相对路径与哈希，不直接运行Notebook、HTML脚本、模型或安装包。
          </p>
          <section className={s.infoBox}>
            <h3>原始名称</h3>
            {p.originalNames.map((n) => (
              <p className={s.path} key={n}>
                {n}
              </p>
            ))}
            <h3>文档证据</h3>
            {p.sourceEvidence.map((e) => (
              <p key={e}>{e}</p>
            ))}
            <p className={s.note}>
              这些文件位于已批准设计目录中；它们是资料证据，不是网页内可执行课程。
            </p>
          </section>
          <section className={s.infoBox}>
            <h3>{p.sourceRefs.length} 项原资产</h3>
            {p.sourceRefs.map((ref) => (
              <details key={ref.path} className={s.sourceRow}>
                <summary>
                  {ref.path} <span>· {ref.role}</span>
                </summary>
                <p className={s.path}>SHA-256：{ref.sha256}</p>
                <p>原资产只读登记；未作为网页执行资源发布。</p>
              </details>
            ))}
          </section>
        </>
      )}
    </ProjectResource>
  );
}
export function LaboratoryStatus({ catalog }: { catalog: Catalog }) {
  const { lessonId } = useParams();
  return (
    <ProjectResource catalog={catalog}>
      {(p) => {
        const lesson = p.lessons.find((x) => x.id === lessonId);
        return (
          <>
            <Title p={p} />
            <EmptyState title={lesson ? "分步骤课程待开放" : "未登记的课节"}>
              {lesson
                ? lesson.title +
                  "：来源Notebook已登记，教学步骤、数据快照与练习参考尚未制作。"
                : "当前地址的课节不在此项目规划中，请返回项目总览。"}
            </EmptyState>
            <div className={s.infoBox}>
              <h2>当前可查看的真实材料</h2>
              <p>
                项目目标、实际方法、数据规模、物理字段字典、原文件哈希及已知限制均可查看。
              </p>
              <Link
                className={a.secondaryButton}
                to={"/projects/" + p.id + "/dictionary"}
              >
                查看字段字典
              </Link>{" "}
              <Link
                className={a.secondaryButton}
                to={"/projects/" + p.id + "/sources"}
              >
                核对原文件
              </Link>
            </div>
          </>
        );
      }}
    </ProjectResource>
  );
}
