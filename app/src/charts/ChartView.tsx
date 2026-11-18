import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  LineChart,
  ScatterChart,
  BoxplotChart,
  HeatmapChart,
  RadarChart,
  TreeChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapComponent,
  AriaComponent,
  RadarComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { selectRows, thresholdMetrics } from "../../../schemas/charts.mjs";
import type { Resource } from "../features/learning/content";
import s from "./Charts.module.css";
echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  BoxplotChart,
  HeatmapChart,
  RadarChart,
  TreeChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapComponent,
  AriaComponent,
  RadarComponent,
  CanvasRenderer,
]);
export default function ChartView({ data }: { data: Resource }) {
  const c = data.chart;
  const host = useRef<HTMLDivElement>(null);
  const [metric, setMetric] = useState(c?.ys[0] ?? 1),
    [filter, setFilter] = useState(""),
    [chosen, setChosen] = useState(-1),
    [page, setPage] = useState(0),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [threshold, setThreshold] = useState(0.5);
  const rows = c
    ? selectRows(data.rows, {
        column: c.filterColumn,
        value: filter,
        from,
        to,
        x: c.x,
      })
    : data.rows;
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]),
    [resetVersion, setResetVersion] = useState(0);
  const legendNames =
    !c || ["tree", "heatmap", "boxplot", "table"].includes(c.type)
      ? []
      : c.type === "radar"
        ? c.ys.map((j) => data.columns[j])
        : c.type === "line" && c.filterColumn !== undefined && !filter
          ? [...new Set(rows.map((r) => String(r[c.filterColumn!] ?? "缺失")))]
          : [data.columns[metric]];
  const [chartError, setChartError] = useState(""),
    [themeVersion, setThemeVersion] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeVersion((v) => v + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-size"],
    });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!host.current || !c || c.type === "table") return;
    let instance: ReturnType<typeof echarts.init> | undefined;
    try {
      const color = getComputedStyle(document.documentElement)
        .getPropertyValue("--text")
        .trim();
      instance = echarts.init(host.current, undefined, { renderer: "canvas" });
      const cats = rows.map((r) => String(r[c.x] ?? "缺失"));
      const numeric = c.type === "scatter" || c.type === "roc";
      const base: any = {
        animation: false,
        color: ["#2563eb", "#16a34a", "#d97706", "#9333ea"],
        textStyle: { color, fontFamily: "Microsoft YaHei, sans-serif" },
        aria: {
          enabled: true,
          label: {
            description:
              data.title + "。范围：" + c.range + "。完整数值见同源数据表。",
          },
        },
        tooltip: { trigger: numeric ? "item" : "axis", renderMode: "richText" },
        grid: { left: 70, right: 24, top: 45, bottom: 100, containLabel: true },
        legend: {
          textStyle: { color },
          selected: Object.fromEntries(
            hiddenSeries.map((name) => [name, false]),
          ),
        },
        dataZoom: [{ type: "inside" }, { type: "slider", bottom: 25 }],
        xAxis: {
          type: numeric ? "value" : "category",
          data: numeric ? undefined : cats,
          name: c.xLabel,
          nameLocation: "middle",
          nameGap: 55,
          axisLabel: { color, hideOverlap: true },
        },
        yAxis: { type: "value", name: c.yLabel, axisLabel: { color } },
      };
      if (numeric)
        base.series = [
          {
            type: c.type === "roc" ? "line" : "scatter",
            name: data.columns[metric],
            symbolSize: c.type === "roc" ? 2 : 5,
            showSymbol: c.type !== "roc",
            data: rows.map((r) => [r[c.x], r[metric]]),
          },
        ];
      else if (c.type === "heatmap") {
        const xs = [...new Set(rows.map((r) => String(r[c.x])))],
          ys = [...new Set(rows.map((r) => String(r[c.ys[0]])))];
        base.xAxis = {
          type: "category",
          data: xs,
          axisLabel: { color, rotate: 30 },
        };
        base.yAxis = { type: "category", data: ys, axisLabel: { color } };
        base.visualMap = {
          min: Math.min(...rows.map((r) => Number(r[c.ys[1]]))),
          max: Math.max(...rows.map((r) => Number(r[c.ys[1]]))),
          calculable: true,
          orient: "horizontal",
          bottom: 0,
          textStyle: { color },
        };
        base.dataZoom = [];
        base.series = [
          {
            type: "heatmap",
            data: rows.map((r) => [
              xs.indexOf(String(r[c.x])),
              ys.indexOf(String(r[c.ys[0]])),
              r[c.ys[1]],
            ]),
            label: { show: rows.length <= 36, color },
          },
        ];
      } else if (c.type === "boxplot")
        base.series = [
          { type: "boxplot", data: rows.map((r) => c.ys.map((i) => r[i])) },
        ];
      else if (c.type === "radar") {
        delete base.xAxis;
        delete base.yAxis;
        delete base.grid;
        base.dataZoom = [];
        const all = rows.flatMap((r) => c.ys.map((j) => Number(r[j]))),
          min = Math.min(0, ...all),
          max = Math.max(0.01, ...all);
        base.radar = {
          indicator: cats.map((name) => ({
            name,
            min: min < 0 ? min * 1.15 : 0,
            max: max * 1.15,
          })),
          axisName: { color },
        };
        base.series = [
          {
            type: "radar",
            data: c.ys.map((j) => ({
              name: data.columns[j],
              value: rows.map((r) => r[j]),
            })),
          },
        ];
      } else if (c.type === "tree") {
        delete base.xAxis;
        delete base.yAxis;
        base.dataZoom = [];
        base.series = [
          {
            type: "tree",
            data: [c.tree],
            roam: true,
            expandAndCollapse: true,
            initialTreeDepth: 3,
            left: 95,
            right: 95,
            top: 20,
            bottom: 20,
            label: {
              color,
              fontSize: 11,
              position: "left",
              align: "right",
              formatter: (item: any) =>
                item.data.children?.length
                  ? "d=" + Number(item.value).toFixed(4)
                  : item.name,
            },
            leaves: { label: { color, position: "right", align: "left" } },
            symbolSize: 5,
          },
        ];
      } else if (c.type === "line" && c.filterColumn !== undefined && !filter) {
        const xs = [...new Set(rows.map((r) => String(r[c.x])))].sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true }),
        );
        base.xAxis.data = xs;
        const groups = [
          ...new Set(rows.map((r) => String(r[c.filterColumn!] ?? "缺失"))),
        ];
        base.series = groups.map((name) => {
          const group = rows.filter(
            (r) => String(r[c.filterColumn!] ?? "缺失") === name,
          );
          return {
            type: "line",
            name,
            showSymbol: false,
            connectNulls: false,
            data: xs.map(
              (x) => group.find((r) => String(r[c.x]) === x)?.[metric] ?? null,
            ),
          };
        });
      } else
        base.series = [
          {
            type: c.type === "line" ? "line" : "bar",
            name: data.columns[metric],
            data: rows.map((r) => r[metric]),
            barMaxWidth: 44,
            connectNulls: false,
          },
        ];
      instance.setOption(base);
      instance.on("legendselectchanged", (event: any) =>
        setHiddenSeries(
          Object.entries(event.selected)
            .filter(([, selected]) => !selected)
            .map(([name]) => name),
        ),
      );
      instance.on("click", (event: any) => {
        if (
          ["tree", "radar", "heatmap"].includes(c.type) ||
          (c.type === "line" && c.filterColumn !== undefined && !filter)
        )
          return;
        setChosen(event.dataIndex);
        setPage(Math.floor(event.dataIndex / 100));
      });
      const resize = new ResizeObserver(() => instance?.resize());
      resize.observe(host.current);
      setChartError("");
      return () => {
        resize.disconnect();
        instance?.dispose();
      };
    } catch (e) {
      instance?.dispose();
      setChartError("图形暂不可用，可继续查看同源数据表。" + String(e));
    }
  }, [
    data,
    metric,
    filter,
    from,
    to,
    c,
    themeVersion,
    hiddenSeries.join("|"),
    resetVersion,
  ]);
  if (data.probabilities) {
    const m = thresholdMetrics(data.rows, threshold);
    return (
      <div className={s.panel}>
        <label>
          分类阈值 {threshold.toFixed(2)}
          <input
            aria-label="分类阈值"
            type="range"
            min="0"
            max="1"
            step=".01"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
        </label>
        <p>
          浏览器确定性派生 · 真实独立测试集 {data.rows.length}{" "}
          行；调整阈值不会重新训练，测试集阈值探索不作为调参后的最终成绩。
        </p>
        <p role="status">
          TN {m.tn} · FP {m.fp} · FN {m.fn} · TP {m.tp} · Precision{" "}
          {m.precision === null ? "不可计算" : m.precision.toFixed(4)} · Recall{" "}
          {m.recall === null ? "不可计算" : m.recall.toFixed(4)}
        </p>
        <p>输入顺序为 [真实标签, 预测正类概率]；完整明细仅按页查看。</p>
        <DataTable
          data={data}
          rows={rows}
          page={page}
          setPage={setPage}
          chosen={chosen}
        />
      </div>
    );
  }
  if (!c)
    return (
      <DataTable
        data={data}
        rows={rows}
        page={page}
        setPage={setPage}
        chosen={chosen}
      />
    );
  const values =
    c.filterColumn === undefined
      ? []
      : [
          ...new Set(
            data.rows.map((r) => String(r[c.filterColumn!] ?? "缺失")),
          ),
        ];
  return (
    <div className={s.panel}>
      <h4>{c.question}</h4>
      <p>{c.interpretation}</p>
      <p>
        范围：{c.range} · 分母：{c.denominator} · 条件：{c.filters} · 缺值：
        {c.nullPolicy}
      </p>
      {c.type === "map" && <p>本地地图资源未核验；使用相同数据的条形图。</p>}
      <div className={s.controls}>
        {!["heatmap", "boxplot", "tree", "radar"].includes(c.type) &&
          c.ys.length > 1 && (
            <label>
              指标
              <select
                aria-label="图表指标"
                value={metric}
                onChange={(e) => {
                  setMetric(Number(e.target.value));
                  setChosen(-1);
                }}
              >
                {c.ys.map((j) => (
                  <option value={j} key={j}>
                    {data.columns[j]}
                  </option>
                ))}
              </select>
            </label>
          )}
        {values.length > 0 && (
          <label>
            类别筛选
            <select
              aria-label="图表类别筛选"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(0);
                setChosen(-1);
              }}
            >
              <option value="">全部</option>
              {values.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        )}
        {c.type === "line" && (
          <>
            <label>
              起始值
              <input
                aria-label="范围起始值"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(0);
                  setChosen(-1);
                }}
              />
            </label>
            <label>
              结束值
              <input
                aria-label="范围结束值"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(0);
                  setChosen(-1);
                }}
              />
            </label>
          </>
        )}
        <button
          onClick={() => {
            setMetric(c.ys[0]);
            setFilter("");
            setFrom("");
            setTo("");
            setPage(0);
            setChosen(-1);
            setHiddenSeries([]);
            setResetVersion((v) => v + 1);
          }}
        >
          重置筛选
        </button>
      </div>
      <p role="status">
        当前同源表 {rows.length} 行 / 导出 {data.rows.length}{" "}
        行。选择柱/点会定位表格行；缩放仅改变图形视窗，统计分母保持上述口径。
      </p>
      <p>
        横轴：{c.xLabel} · 纵轴：{c.yLabel}
      </p>
      {legendNames.length > 0 && (
        <div className={s.controls} role="group" aria-label="键盘图例">
          {legendNames.map((name) => (
            <button
              key={name}
              aria-pressed={!hiddenSeries.includes(name)}
              onClick={() =>
                setHiddenSeries((old) =>
                  old.includes(name)
                    ? old.filter((x) => x !== name)
                    : [...old, name],
                )
              }
            >
              {hiddenSeries.includes(name) ? "显示" : "隐藏"}系列：{name}
            </button>
          ))}
        </div>
      )}
      {chartError && <p role="alert">{chartError}</p>}
      {c.type !== "table" && (
        <div
          ref={host}
          className={s.chart}
          role="img"
          aria-label={data.title + "；下方有可键盘访问的同源表格"}
        />
      )}
      <DataTable
        data={data}
        rows={rows}
        page={page}
        setPage={setPage}
        chosen={chosen}
      />
    </div>
  );
}
function DataTable({
  data,
  rows,
  page,
  setPage,
  chosen,
}: {
  data: Resource;
  rows: Resource["rows"];
  page: number;
  setPage: (p: number) => void;
  chosen: number;
}) {
  const count = Math.max(1, Math.ceil(rows.length / 100));
  const current = Math.min(page, count - 1);
  return (
    <>
      <div className={s.table} tabIndex={0}>
        <table>
          <caption>
            {data.title} · 同源表 · 第 {current + 1}/{count} 页
          </caption>
          <thead>
            <tr>
              {data.columns.map((v, i) => (
                <th key={i}>{v}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(current * 100, current * 100 + 100).map((r, i) => (
              <tr key={i} aria-selected={chosen === current * 100 + i}>
                {r.map((v, j) => (
                  <td key={j}>{v === null ? "缺失 / 不可计算" : String(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {count > 1 && (
        <div className={s.controls}>
          <button disabled={!current} onClick={() => setPage(current - 1)}>
            上一页
          </button>
          <span>
            {current + 1} / {count}
          </span>
          <button
            disabled={current >= count - 1}
            onClick={() => setPage(current + 1)}
          >
            下一页
          </button>
        </div>
      )}
    </>
  );
}
