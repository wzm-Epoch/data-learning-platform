import { imageCaption } from "../../../../schemas/image-caption.mjs";
import ChartBoundary from "../../charts/ChartBoundary";
import { lazy, Suspense } from "react";
const ChartView=lazy(()=>import("../../charts/ChartView"));
import { loadResource } from "./content";
import { useResource } from "../../content/useResource";
import { EmptyState } from "../../components/States";
import s from "../../styles/Laboratory.module.css";
const labels = {
  "new-precomputed": "本次只读预计算",
  "original-saved": "原文件保存结果 · 尚未重跑",
  "teaching-adaptation": "教学改编 · 本次预计算",
};
export function ResultView({ resourceRef }: { resourceRef: string }) {
  const { data, error, retry } = useResource(resourceRef, () =>
    loadResource(resourceRef),
  );
  if (error)
    return (
      <EmptyState title="这份结果资源暂不可用">
        {error}。可继续阅读讲解与原代码。
        <button className={s.textButton} onClick={retry}>
          重试资源
        </button>
      </EmptyState>
    );
  if (!data) return <p role="status">正在读取本步结果…</p>;
  return (
    <article className={s.result}>
      <span className={s.identity}>{labels[data.context.identity]}</span>
      <h3>{data.title}</h3>
      <p>{data.context.note}</p>
      <p className={s.caption}>
        单位：{data.context.unit}
        {data.context.sample
          ? " · 展示范围：" + data.context.sample
          : " · 未抽样的已说明范围统计/保存输出"}
      </p>
      {data.chart || data.probabilities || data.rows.length>100 ? <ChartBoundary key={resourceRef}><Suspense fallback={<p>正在读取本地图表引擎…</p>}><ChartView data={data}/></Suspense></ChartBoundary> : data.kind === "image" ? <div>{data.images?.map(ref=><figure key={ref}><img src={`${import.meta.env.BASE_URL}content/${ref}`} alt={data.title+" · "+imageCaption(data)} style={{width:"100%",height:"auto"}} onError={e=>{e.currentTarget.alt="这张原图暂不可用；可继续阅读讲解和代码。"}}/><figcaption>{imageCaption(data)}</figcaption></figure>)}</div> : data.kind === "text" ? (
        <pre className={s.savedText}>{data.text}</pre>
      ) : (
        <div
          className={s.tableScroll}
          tabIndex={0}
          aria-label="本步结果表，可横向滚动"
        >
          <table>
            <caption>{data.title}</caption>
            <thead>
              <tr>
                {data.columns.map((c, i) => (
                  <th scope="col" key={i}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((v, j) => (
                    <td key={j}>
                      {v === null ? (
                        <span className={s.null}>缺失 / 不可计算</span>
                      ) : typeof v === "number" ? (
                        v.toLocaleString("zh-CN", { maximumFractionDigits: 8 })
                      ) : (
                        String(v)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details className={s.evidence}>
        <summary>输入与构建证据</summary>
        <p>
          构建版本：{data.context.buildId} · {data.context.createdAt}
        </p>
        <p>{data.context.modelRerun ? "该教学版本已在网页外训练；不替代原成绩。版本："+(data.context.modelVersion||"见清单") : "原模型未重跑；预处理/聚合与模型训练分别记录。"}</p>
        {data.context.inputs.map((r) => (
          <p className={s.hash} key={r.path}>
            {r.path}
            <br />
            SHA-256：{r.sha256}
          </p>
        ))}
      </details>
    </article>
  );
}
