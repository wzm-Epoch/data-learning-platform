import { dependencyCycle } from "./availability.mjs";
import { z } from "zod";
const relative = z
  .string()
  .min(1)
  .refine(
    (p) => !p.split("/").includes("..") && !/^[A-Za-z]:|^[/\\]/.test(p),
    "必须为安全相对路径",
  );
export const sourceSchema = z.object({
  path: relative,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  role: z.enum(["code", "data", "output", "other"]),
});
const readiness = z.object({
  source: z.enum(["audited", "known-gaps"]),
  course: z.enum(["not-adapted", "representative-ready"]),
  rerun: z.literal("not-run"),
  offline: z.enum(["not-packaged", "representative-packaged"]),
});
export const summarySchema = z.object({
  id: z.string().regex(/^P\d{2}$/),
  title: z.string().min(1),
  originalNames: z.array(z.string()).min(2),
  categoryId: z.string(),
  summary: z.string(),
  difficulty: z.enum(["入门", "初级", "进阶", "高级"]),
  skillTags: z.array(z.string()),
  readiness,
  availability: z
    .object({
      course: z.enum(["readable", "partial", "unavailable"]),
      label: z.string(),
      result: z.string(),
      models: z.array(z.string()),
      gaps: z.array(z.string()),
    })
    .optional(),
  learning: z
    .object({
      readyLessons: z.number().int().nonnegative(),
      readySteps: z.number().int().nonnegative(),
      plannedSteps: z.number().int().nonnegative(),
    })
    .default({ readyLessons: 0, readySteps: 0, plannedSteps: 0 }),
  detailRef: relative,
  searchKeywords: z.array(z.string()),
  prerequisites: z.string().min(1),
  recommendedProjectIds: z.array(z.string()),
  recommendationNote: z.string(),
});
export const detailSchema = summarySchema.extend({
  schemaVersion: z.literal("1.0"),
  contentVersion: z.string(),
  methods: z.string(),
  sourceRefs: z.array(sourceSchema).min(1),
  limitations: z.array(z.string()).min(1),
  learningObjectives: z.array(z.string().min(1)).min(1),
  lessons: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        source: relative,
        status: z.enum(["ready", "planned"]).default("planned"),
        stepCount: z.number().int().nonnegative().default(0),
      }),
    )
    .min(1),
  exercise: z.object({
    text: z.string(),
    provenance: z.string(),
    answerStatus: z.string(),
  }),
  datasets: z.array(
    z.object({
      id: z.string(),
      path: relative,
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      sheet: z.string().nullable(),
      rows: z.number().int().nonnegative(),
      columns: z.number().int().nonnegative(),
      encoding: z.string().nullable(),
      grain: z.string(),
      origin: z.string().nullable(),
      license: z.string().nullable(),
      fields: z.array(
        z.object({
          name: z.string(),
          dtype: z.string(),
          missing: z.number().int().nonnegative().nullable(),
          meaning: z.string().nullable(),
          unit: z.string().nullable(),
          evidence: z.string(),
        }),
      ),
      teachingMappings: z.array(
        z.object({
          source: relative,
          cell: z.number().int().positive(),
          code: z.string(),
          inputFields: z.array(z.string()),
          outputFields: z.array(z.string()),
          note: z.string(),
        }),
      ),
    }),
  ),
  scopeNotes: z.array(z.string()),
  originalWorkflow: z.string().nullable(),
  savedResult: z.string().nullable(),
  sourceEvidence: z.array(z.string()),
});
export const catalogSchema = z
  .object({
    schemaVersion: z.literal("1.1"),
    contentVersion: z.string(),
    categories: z.array(
      z.object({
        id: z.string().regex(/^[a-z]+$/),
        title: z.string(),
        intro: z.string(),
        objectives: z.array(z.string()),
        projectIds: z.array(z.string()),
      }),
    ),
    stages: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        goal: z.string(),
        projectIds: z.array(z.string()),
      }),
    ),
    projects: z.array(summarySchema),
  })
  .superRefine((c, ctx) => {
    const fail = (message) => ctx.addIssue({ code: "custom", message });
    const ids = c.projects.map((p) => p.id);
    if (new Set(ids).size !== ids.length) fail("项目ID重复");
    if (new Set(c.categories.map((x) => x.id)).size !== c.categories.length)
      fail("分类ID重复");
    for (const p of c.projects) {
      if (!c.categories.some((x) => x.id === p.categoryId)) fail("未知分类");
      if (p.detailRef !== `projects/${p.id}/project.json`)
        fail("内容引用与ID不一致");
      if (
        p.recommendedProjectIds.some((id) => !ids.includes(id) || id === p.id)
      )
        fail("无效推荐项目");
    }
    try {
      if (
        dependencyCycle(
          c.projects,
          (p) => p.id,
          (p) => p.recommendedProjectIds,
        )
      )
        fail("推荐依赖存在循环");
    } catch (e) {
      fail(e.message);
    }
    const route = c.stages.flatMap((s) => s.projectIds);
    const cats = c.categories.flatMap((s) => s.projectIds);
    for (const assigned of [route, cats])
      if (
        assigned.length !== ids.length ||
        new Set(assigned).size !== ids.length ||
        assigned.some((id) => !ids.includes(id))
      )
        fail("路线或分类覆盖错误");
    for (const cat of c.categories)
      if (
        cat.projectIds.some(
          (id) => c.projects.find((p) => p.id === id)?.categoryId !== cat.id,
        )
      )
        fail("分类归属不一致");
  });
export const knowledgeSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    tags: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        evidenceNote: z.string(),
        usages: z.array(
          z.object({
            projectId: z.string(),
            auditEvidence: z.string(),
            codeRefs: z.array(
              z.object({
                source: relative,
                cell: z.number().int().positive(),
                snippet: z.string(),
              }),
            ),
          }),
        ),
      }),
    ),
    branches: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        requires: z.array(z.string()),
      }),
    ),
  })
  .superRefine((k, ctx) => {
    try {
      if (
        dependencyCycle(
          k.branches,
          (b) => b.id,
          (b) => b.requires,
        )
      )
        ctx.addIssue({ code: "custom", message: "知识硬前置存在循环" });
    } catch (e) {
      ctx.addIssue({ code: "custom", message: e.message });
    }
  });
