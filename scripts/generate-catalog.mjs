import { availability } from "../schemas/availability.mjs";
import {
  originalDownloadsSchema,
  matchOriginalPackage,
} from "../schemas/original-downloads.mjs";
import { generateProgress } from "./generate-progress.mjs";
import { generateLearning, learningSummary } from "./generate-learning.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  catalogSchema,
  detailSchema,
  knowledgeSchema,
} from "../schemas/catalog.mjs";
export async function generateCatalog(source, output) {
  const read = async (name) =>
    JSON.parse(await readFile(path.join(source, name), "utf8"));
  const learningIndex = await generateLearning(source, output);
  await generateProgress(source, output, learningIndex);
  const phase4 = await read("learning/coverage.json").catch(() => []);
  const registry = await read("registry.json");
  const details = new Map(
    await Promise.all(
      registry.map(async (p) => [p.id, await read(p.detailRef)]),
    ),
  );
  const enrich = (p) => {
    const learning = learningSummary(learningIndex, p.id);
    return {
      ...p,
      learning,
      availability: availability(
        details.get(p.id) || p,
        phase4.find((x) => x.projectId === p.id),
        learning,
      ),
      readiness: {
        ...p.readiness,
        course: learning.readyLessons ? "representative-ready" : "not-adapted",
        offline: learning.readyLessons
          ? "representative-packaged"
          : "not-packaged",
      },
    };
  };
  const catalog = catalogSchema.parse({
    schemaVersion: "1.1",
    contentVersion: learningIndex.contentVersion,
    categories: await read("categories.json"),
    stages: await read("stages.json"),
    projects: registry.map(enrich),
  });
  const knowledge = knowledgeSchema.parse(await read("knowledge.json"));
  for (const tag of knowledge.tags)
    for (const u of tag.usages)
      if (
        !catalog.projects.some(
          (p) => p.id === u.projectId && p.skillTags.includes(tag.id),
        )
      )
        throw new Error("知识索引与注册表不一致");
  for (const p of catalog.projects) {
    const raw = await read(p.detailRef);
    const plan = learningIndex?.projects.find((x) => x.id === p.id);
    const detail = detailSchema.parse({
      ...enrich(raw),
      scopeNotes: [
        ...raw.scopeNotes.map(
          (t) => "前期审计说明（后续变化见本阶段课程）：" + t,
        ),
        ...phase4
          .filter((x) => x.projectId === p.id)
          .flatMap((x) => [
            "第四阶段：已接入" +
              x.readySteps +
              "个可阅读步骤；原模型尚未独立复现。新教学模型版本：" +
              (x.models.map((m) => m.version).join("、") ||
                "无，本次只读聚合/提取原保存输出") +
              "。",
            ...x.blocked.map((b) => "受阻步骤：" + b.step + "。" + b.reason),
          ]),
      ],
      contentVersion: learningIndex.contentVersion,
      lessons: raw.lessons.map((l) => {
        const meta = plan?.lessons.find((x) => x.id === l.id);
        return {
          ...l,
          status: meta?.status || "planned",
          stepCount: meta?.steps.length || 0,
        };
      }),
    });
    if (
      detail.id !== p.id ||
      JSON.stringify(detail.skillTags) !== JSON.stringify(p.skillTags) ||
      detail.categoryId !== p.categoryId
    )
      throw new Error("详情与目录不一致：" + p.id);
    for (const d of detail.datasets) {
      if (d.fields.length !== d.columns)
        throw new Error("字段数错误：" + d.path);
      if (
        !detail.sourceRefs.some(
          (r) => r.path === d.path && r.sha256 === d.sha256,
        )
      )
        throw new Error("数据来源哈希不匹配");
    }
    const out = path.join(output, p.detailRef);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(detail));
  }
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "catalog.json"), JSON.stringify(catalog));
  await writeFile(
    path.join(output, "knowledge-index.json"),
    JSON.stringify(knowledge),
  );
  let downloads;
  try {
    downloads = await read("original-downloads.json");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (downloads) {
    const manifest = originalDownloadsSchema.parse(downloads);
    for (const project of manifest.projects) {
      if (!details.has(project.id))
        throw new Error("资料包引用未知项目：" + project.id);
      matchOriginalPackage(
        manifest,
        project.id,
        details.get(project.id).sourceRefs,
      );
    }
    await writeFile(
      path.join(output, "original-downloads.json"),
      JSON.stringify(manifest),
    );
  }
  console.log(
    `目录校验通过：${catalog.projects.length}项目 / ${catalog.categories.length}分类 / 独立详情包`,
  );
  return catalog;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  await generateCatalog(
    path.join(root, "content-source"),
    path.join(root, "app/public/content"),
  );
}
