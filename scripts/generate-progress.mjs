import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
export async function generateProgress(source, output, index) {
  const read = async (ref) =>
    JSON.parse(await readFile(path.join(source, ref), "utf8"));
  const policy = await read("progress-policy.json");
  const steps = [];
  const projects = [];
  for (const p of index.projects) {
    const detail = await read(`projects/${p.id}/project.json`);
    projects.push({
      id: p.id,
      title: detail.title,
      prerequisites: detail.prerequisites,
      recommendedProjectIds: detail.recommendedProjectIds,
    });
    for (const l of p.lessons) {
      const lesson = await read(l.ref);
      for (const s of lesson.steps) {
        if (l.status !== "ready" || s.status !== "ready") continue;
        const key = `${p.id}/${l.id}/${s.id}`;
        const override = policy.steps[key] || {};
        if (override.applicable === false) continue;
        const outputs = [];
        for (const ref of s.outputRefs) {
          const r = await read(ref);
          outputs.push({
            ref,
            rows: r.rows,
            text: r.text,
            images: r.images,
            chart: r.chart,
            identity: r.context.identity,
            modelVersion: r.context.modelVersion,
          });
        }
        const revision = createHash("sha256")
          .update(
            JSON.stringify({
              code: s.codeRefs.map((c) => c.codeSha256),
              teachingCode: s.teachingCode,
              inputs: s.inputRefs,
              outputs,
              revision: override.semanticRevision || 1,
            }),
          )
          .digest("hex");
        steps.push({
          key,
          projectId: p.id,
          lessonId: l.id,
          stepId: s.id,
          title: s.title,
          required: override.required !== false,
          exerciseRequired:
            !!s.exercise?.prompt && override.exerciseRequired !== false,
          revision,
        });
      }
    }
  }
  const manifest = {
    schemaVersion: 1,
    contentVersion: index.contentVersion,
    projects,
    steps,
    deleted: policy.deleted,
    supportedContentVersions: policy.supportedContentVersions || [],
  };
  for (const [old, target] of Object.entries(manifest.deleted)) {
    if (
      steps.some((s) => s.key === old) ||
      (target !== null && !steps.some((s) => s.key === target))
    )
      throw Error("删除映射无效或复用旧ID：" + old);
  }
  await writeFile(
    path.join(output, "progress-manifest.json"),
    JSON.stringify(manifest),
  );
  return manifest;
}
