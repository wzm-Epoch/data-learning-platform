import { z } from "zod";
import { chartSchema } from "./charts.mjs";
import { sourceSchema } from "./catalog.mjs";
const ref = z
  .string()
  .regex(/^learning\/[a-zA-Z0-9_./-]+\.json$/)
  .refine((x) => !x.split("/").includes(".."));
const brief = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  title: z.string().min(1),
  status: z.enum(["ready", "planned"]),
});
const code = z.object({
  path: z.string(),
  notebookSha256: z.string().regex(/^[a-f0-9]{64}$/),
  cell: z.number().int().positive(),
  code: z.string(),
  codeSha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export const stepSchema = brief.extend({
  status: z.literal("ready"),
  kind: z.enum([
    "orientation",
    "data",
    "cleaning",
    "analysis",
    "modeling",
    "interpretation",
    "practice",
  ]),
  knowledgeIds: z.array(z.string()).min(1),
  explanation: z.array(z.string()).min(1),
  teachingCode: z.string(),
  limitations: z.array(z.string()).min(1),
  codeRefs: z.array(code).min(1),
  inputRefs: z.array(sourceSchema.pick({ path: true, sha256: true })).min(1),
  outputRefs: z.array(ref).min(1),
  outputTitles:z.record(z.string(),z.string()).optional(),
  exercise: z.object({
    prompt: z.string(),
    hint: z.string(),
    checklist: z.array(z.string()).min(1),
    provenance: z.string(),
  }),
});
export const lessonSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    contentVersion: z.string(),
    projectId: z.string().regex(/^P\d{2}$/),
    id: z.string(),
    title: z.string(),
    status: z.enum(["ready", "planned"]),
    steps: z
      .array(
        z.union([stepSchema, brief.extend({ status: z.literal("planned") })]),
      )
      .min(1),
  })
  .superRefine((l, c) => {
    if (new Set(l.steps.map((s) => s.id)).size !== l.steps.length)
      c.addIssue({ code: "custom", message: "步骤ID重复" });
    if (l.steps.some((s) => s.status !== l.status))
      c.addIssue({ code: "custom", message: "课节与步骤就绪度不一致" });
  });
export const learningIndexSchema = z.object({
  schemaVersion: z.literal("1.0"),
  contentVersion: z.string(),
  projects: z.array(
    z.object({
      id: z.string(),
      lessons: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          status: z.enum(["ready", "planned"]),
          ref,
          steps: z.array(brief),
        }),
      ),
    }),
  ),
});
export const resourceSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    id: z.string(),
    title: z.string(),
    kind: z.enum(["table", "text", "image"]),
    chart: chartSchema.optional(),
    probabilities: z.boolean().optional(),
    images: z.array(z.string().regex(/^learning\/assets\/[a-zA-Z0-9_-]+\.png$/)).optional(),
    columns: z.array(z.string()),
    rows: z.array(
      z.array(
        z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
      ),
    ),
    text: z.string().nullable(),
    context: z.object({
      identity: z.enum([
        "new-precomputed",
        "original-saved",
        "teaching-adaptation",
      ]),
      buildId: z.string(),
      createdAt: z.string().datetime({ offset: true }),
      inputs: z.array(sourceSchema.pick({ path: true, sha256: true })),
      note: z.string(),
      unit: z.string(),
      sample: z.string().nullable(),
      modelRerun: z.boolean(),
      modelVersion: z.string().optional(),
    }),
  })
  .superRefine((r, c) => {
    if (
      r.kind === "table" &&
      r.rows.some((row) => row.length !== r.columns.length)
    )
      c.addIssue({ code: "custom", message: "输出表行列不匹配" });
    if(r.chart && (r.rows.length>5000 || [r.chart.x,...r.chart.ys,...(r.chart.filterColumn===undefined?[]:[r.chart.filterColumn])].some(i=>i>=r.columns.length))) c.addIssue({code:"custom",message:"图表超出点数预算或引用未知列"});
    if(r.chart){
      const chart=r.chart;
      const numericColumns=chart.type==='heatmap'?[chart.ys[1]]:['tree','table'].includes(chart.type)?[]:[...chart.ys];
      if(['scatter','roc'].includes(chart.type))numericColumns.push(chart.x);
      if(r.rows.some(row=>numericColumns.some(i=>row[i]!==null&&typeof row[i]!=="number")))c.addIssue({code:"custom",message:"图表数值轴必须使用数值或null"});
    }
    if(r.kind === "image" && !r.images?.length)c.addIssue({code:"custom",message:"原图资源缺失"});
    if(r.probabilities && (r.context.identity!=="teaching-adaptation" || !r.context.modelRerun || r.rows.some(row=>![0,1].includes(row[0])||typeof row[1]!=="number"||row[1]<0||row[1]>1)))c.addIssue({code:"custom",message:"阈值交互需要真实测试概率"});
    if (r.kind === "text" && !r.text)
      c.addIssue({ code: "custom", message: "保存输出文本缺失" });
  });
