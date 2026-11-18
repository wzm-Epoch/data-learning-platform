import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  learningIndexSchema,
  lessonSchema,
  resourceSchema,
} from "../schemas/learning.mjs";
export async function generateLearning(source, output) {
  let data;
  try {
    await access(path.join(source, "learning/index.json"));
  } catch {
    return null;
  }
  const read = async (ref) =>
    JSON.parse(await readFile(path.join(source, ref), "utf8"));
  const write = async (ref, value) => {
    await mkdir(path.dirname(path.join(output, ref)), { recursive: true });
    await writeFile(path.join(output, ref), value);
  };
  data = learningIndexSchema.parse(await read("learning/index.json"));
  const manifest = await read("learning/build.json");
  const resources = new Set();
  for (const project of data.projects) {
    const detail = await read(`projects/${project.id}/project.json`);
    for (const meta of project.lessons) {
      const lesson = lessonSchema.parse(await read(meta.ref));
      if (
        lesson.projectId !== project.id ||
        lesson.id !== meta.id ||
        JSON.stringify(
          lesson.steps.map(({ id, title, status }) => ({ id, title, status })),
        ) !== JSON.stringify(meta.steps)
      )
        throw new Error("课节索引与内容不一致");
      for (const s of lesson.steps) {
        if (s.status !== "ready") continue;
        for (const code of s.codeRefs) {
          if (
            !detail.sourceRefs.some(
              (r) => r.path === code.path && r.sha256 === code.notebookSha256,
            )
          )
            throw new Error("代码Notebook来源不一致");
          if (
            createHash("sha256").update(code.code).digest("hex") !==
            code.codeSha256
          )
            throw new Error("代码片段哈希不一致");
        }
        for (const input of s.inputRefs)
          if (
            !detail.sourceRefs.some(
              (r) => r.path === input.path && r.sha256 === input.sha256,
            )
          )
            throw new Error("步骤输入不属于项目");
        for (const ref of s.outputRefs) {
          const bytes = await readFile(path.join(source, ref));
          const resource = resourceSchema.parse(JSON.parse(bytes));
          for (const input of resource.context.inputs) {
            const match =
              s.inputRefs.some(
                (r) => r.path === input.path && r.sha256 === input.sha256,
              ) ||
              s.codeRefs.some(
                (r) =>
                  r.path === input.path && r.notebookSha256 === input.sha256,
              );
            if (!match)
              throw new Error(`结果与步骤来源不一致：${s.id}/${resource.id}`);
          }
          const expected = manifest.outputs.find((o) => o.ref === ref);
          if (
            !expected ||
            createHash("sha256").update(bytes).digest("hex") !== expected.sha256
          )
            throw new Error("结果哈希不匹配");
          for(const asset of resource.images||[]) {
            const imageBytes=await readFile(path.join(source,asset));
            const record=manifest.outputs.find(o=>o.ref===asset);
            if(!record || createHash("sha256").update(imageBytes).digest("hex")!==record.sha256)throw new Error("原图哈希不匹配");
            await write(asset,imageBytes);
          }
          if (!resources.has(ref)) {
            await write(ref, bytes);
            resources.add(ref);
          }
        }
      }
      await write(meta.ref, JSON.stringify(lesson));
    }
  }
  await write("learning/index.json", JSON.stringify(data));
  await write("learning/build.json", JSON.stringify(manifest));
  try { await write("learning/coverage.json",JSON.stringify(await read("learning/coverage.json"))); } catch {}
  console.log(
    `学习内容：${data.projects.length}项目规划，${data.projects.flatMap((p) => p.lessons).filter((l) => l.status === "ready").length}课已开放，${resources.size}份轻量结果`,
  );
  return data;
}
export function learningSummary(index, id) {
  const p = index?.projects.find((p) => p.id === id);
  const lessons = p?.lessons || [];
  return {
    readyLessons: lessons.filter((l) => l.status === "ready").length,
    readySteps: lessons
      .filter((l) => l.status === "ready")
      .reduce((n, l) => n + l.steps.length, 0),
    plannedSteps: lessons
      .filter((l) => l.status === "planned")
      .reduce((n, l) => n + l.steps.length, 0),
  };
}
