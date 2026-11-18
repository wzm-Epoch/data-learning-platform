import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  KEY,
  MAX_BYTES,
  emptyProgress,
  parseProgress,
  migrateProgress,
  projectProgress,
  overallProgress,
  importPreview,
  storageAdapter,
  mergeProgress,
} from "../app/src/features/progress/engine.mjs";
const manifest = JSON.parse(
  await readFile(
    new URL("../app/public/content/progress-manifest.json", import.meta.url),
  ),
);
const s = manifest.steps.find((s) => s.projectId === "P21");
const completed = (m = manifest, step = s) => {
  const d = emptyProgress(m);
  d.stepStates[step.key] = {
    projectId: step.projectId,
    lessonId: step.lessonId,
    stepId: step.stepId,
    status: "completed",
    selfReview: "explained",
    revision: step.revision,
    updatedAt: "2026-11-17T01:00:00.000Z",
  };
  return d;
};
function memory(initial = null) {
  let raw = initial;
  return {
    getItem: () => raw,
    setItem: (k, v) => {
      assert.equal(k, KEY);
      raw = v;
    },
    raw: () => raw,
  };
}
test("actual curriculum: 29 projects, 30 lessons, 385 valid explicit required steps, no false initial events", () => {
  assert.equal(manifest.projects.length, 29);
  assert.equal(manifest.steps.length, 385);
  assert.equal(
    new Set(manifest.steps.map((s) => s.projectId + "/" + s.lessonId)).size,
    30,
  );
  assert.ok(manifest.steps.every((s) => s.required && s.exerciseRequired));
  const d = emptyProgress(manifest);
  assert.equal(d.events.length, 0);
  assert.equal(d.lastLocation, null);
  assert.equal(overallProgress(manifest, d).ratio, 0);
});
test("project denominator includes P21 both lessons, completion requires self-review; overall projects equally weighted", () => {
  const d = completed();
  const p = projectProgress(manifest, d, "P21");
  assert.equal(p.total, 12);
  assert.equal(p.done, 1);
  assert.equal(overallProgress(manifest, d).ratio, 1 / 12 / 29);
  d.stepStates[s.key].selfReview = "none";
  assert.equal(projectProgress(manifest, d, "P21").done, 0);
  assert.equal(projectProgress(manifest, d, "P21").status, "in_progress");
});
test("review precedence, all complete derived, unavailable projects and zero denominator", () => {
  const m = { ...manifest, projects: manifest.projects.slice(0, 2), steps: [] };
  assert.deepEqual(overallProgress(m, emptyProgress(m)), {
    ratio: 0,
    open: 0,
    complete: 0,
    total: 2,
  });
  assert.equal(
    projectProgress(m, emptyProgress(m), "P01").status,
    "unavailable",
  );
  const d = emptyProgress(manifest);
  for (const t of manifest.steps.filter((t) => t.projectId === "P21"))
    Object.assign(d.stepStates, completed(manifest, t).stepStates);
  assert.equal(projectProgress(manifest, d, "P21").status, "completed");
  d.stepStates[s.key].status = "review_needed";
  assert.equal(projectProgress(manifest, d, "P21").status, "review_needed");
});
test("round trip export/import preserves all effective states and location; preview is pure", () => {
  const d = completed();
  d.lastLocation = {
    projectId: s.projectId,
    lessonId: s.lessonId,
    stepId: s.stepId,
  };
  const prior = JSON.stringify(d);
  const preview = importPreview(
    prior,
    manifest,
    emptyProgress(manifest),
    "replace",
  );
  assert.deepEqual(preview.data, d);
  assert.equal(preview.changed, 1);
  assert.equal(JSON.stringify(d), prior);
});
test("malformed structure, enums, IDs, nested keys, future versions and oversized backups rejected", () => {
  const d = completed();
  for (const raw of [
    "{",
    JSON.stringify({ ...d, schemaVersion: 2 }),
    JSON.stringify({ ...d, contentVersion: "99.0.0" }),
    JSON.stringify({ ...d, unexpected: true }),
    " ".repeat(MAX_BYTES + 1),
  ])
    assert.throws(() => parseProgress(raw, manifest));
  for (const update of [
    { status: "passed" },
    { projectId: "P99" },
    { selfReview: "graded" },
  ]) {
    const x = structuredClone(d);
    Object.assign(x.stepStates[s.key], update);
    assert.throws(() => parseProgress(JSON.stringify(x), manifest));
  }
  const x = structuredClone(d);
  x.lastLocation = { projectId: "P99", lessonId: "main", stepId: "bad" };
  assert.throws(() => parseProgress(JSON.stringify(x), manifest));
});
test("text-only revision retains completion, added step starts empty, substantive revision needs review", () => {
  const d = completed();
  const m = structuredClone(manifest);
  m.steps.find((t) => t.key === s.key).title = "文字修订";
  assert.equal(
    migrateProgress(d, m).data.stepStates[s.key].status,
    "completed",
  );
  m.steps.push({ ...s, key: "P21/sales-explore/new-step", stepId: "new-step" });
  const n = migrateProgress(d, m).data;
  assert.equal(n.stepStates["P21/sales-explore/new-step"], undefined);
  m.steps.find((t) => t.key === s.key).revision = "b".repeat(64);
  const migration = migrateProgress(d, m);
  assert.equal(migration.data.stepStates[s.key].status, "review_needed");
  assert.equal(migration.data.stepStates[s.key].selfReview, "none");
  assert.equal(d.stepStates[s.key].status, "completed");
});
test("deleted steps archived and mapped replacements require review; deleted location maps", () => {
  const d = completed();
  d.lastLocation = {
    projectId: s.projectId,
    lessonId: s.lessonId,
    stepId: s.stepId,
  };
  const t = manifest.steps.find(
    (t) => t.projectId === "P21" && t.key !== s.key,
  );
  const m = {
    ...manifest,
    steps: manifest.steps.filter((t) => t.key !== s.key),
    deleted: { [s.key]: t.key },
  };
  const n = migrateProgress(parseProgress(JSON.stringify(d), m), m).data;
  assert.ok(n.archived[s.key]);
  assert.equal(n.stepStates[s.key], undefined);
  assert.equal(n.stepStates[t.key].status, "review_needed");
  assert.equal(n.lastLocation.stepId, t.stepId);
  assert.doesNotThrow(() => parseProgress(JSON.stringify(n), m));
});
test("storage refresh restoration and CAS rejects stale tabs including externally cleared data", () => {
  const mem = memory(),
    a = storageAdapter(mem, manifest),
    b = storageAdapter(mem, manifest);
  a.read();
  b.read();
  const saved = a.save(completed());
  assert.equal(saved.revision, 1);
  assert.throws(() => b.save(emptyProgress(manifest)), /冲突/);
  const fresh = storageAdapter(mem, manifest);
  assert.equal(fresh.read().data.stepStates[s.key].status, "completed");
  mem.setItem(KEY, null);
  assert.throws(() => a.save(saved), /冲突/);
});
test("corrupt and future stored data retained, no automatic overwrite", () => {
  for (const raw of [
    "broken",
    JSON.stringify({ ...emptyProgress(manifest), schemaVersion: 99 }),
  ]) {
    const mem = memory(raw),
      a = storageAdapter(mem, manifest);
    assert.ok(a.read().error);
    assert.throws(() => a.save(emptyProgress(manifest)), /受保护/);
    assert.equal(mem.raw(), raw);
  }
});
test("disabled reads and quota failures surfaced to caller for visible backup fallback", () => {
  const bad = {
    getItem() {
      throw Error("SecurityError");
    },
    setItem() {
      throw Error("QuotaExceededError");
    },
  };
  const a = storageAdapter(bad, manifest);
  assert.match(a.read().error, /SecurityError/);
  assert.throws(() => a.save(emptyProgress(manifest)), /受保护/);
  const b = storageAdapter(
    {
      ...bad,
      getItem() {
        return null;
      },
    },
    manifest,
  );
  b.read();
  assert.throws(() => b.save(completed()), /QuotaExceededError/);
});
test("merge keeps newer step, deterministic ties, bounded deduplicated events; replace clears absent states", () => {
  const old = completed(),
    n = completed();
  n.stepStates[s.key].status = "review_needed";
  n.stepStates[s.key].updatedAt = "2026-11-17T02:00:00.000Z";
  assert.equal(mergeProgress(old, n).stepStates[s.key].status, "review_needed");
  n.stepStates[s.key].updatedAt = old.stepStates[s.key].updatedAt;
  assert.equal(mergeProgress(old, n).stepStates[s.key].status, "completed");
  assert.equal(
    importPreview(
      JSON.stringify(emptyProgress(manifest)),
      manifest,
      old,
      "replace",
    ).data.stepStates[s.key],
    undefined,
  );
});

test("bounded events merge keeps only newest 100 without duplicated identities", () => {
  const a = emptyProgress(manifest),
    b = emptyProgress(manifest);
  const event = (i) => ({
    projectId: s.projectId,
    lessonId: s.lessonId,
    stepId: s.stepId,
    action: "in_progress",
    at: new Date(Date.UTC(2026, 10, 17, 0, 0, i)).toISOString(),
  });
  a.events = Array.from({ length: 100 }, (_, i) => event(i));
  b.events = Array.from({ length: 100 }, (_, i) => event(i + 50));
  const n = mergeProgress(a, b);
  assert.equal(n.events.length, 100);
  assert.equal(n.events[0].at, event(50).at);
  assert.equal(n.events[99].at, event(149).at);
});
test("explicit null deletion archives without mapping or contributing completion", () => {
  const d = completed();
  d.lastLocation = {
    projectId: s.projectId,
    lessonId: s.lessonId,
    stepId: s.stepId,
  };
  const m = {
    ...manifest,
    steps: manifest.steps.filter((t) => t.key !== s.key),
    deleted: { [s.key]: null },
  };
  const n = migrateProgress(d, m).data;
  assert.equal(n.lastLocation, null);
  assert.ok(n.archived[s.key]);
  assert.equal(projectProgress(m, n, "P21").done, 0);
});
test("generator excludes planned/inapplicable content and fingerprints substantive changes only", async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const { generateProgress } = await import("../scripts/generate-progress.mjs");
  const dir = await mkdtemp(path.join(tmpdir(), "phase5-manifest-"));
  const source = path.join(dir, "source"),
    out = path.join(dir, "out");
  const put = async (p, d) => {
    await mkdir(path.dirname(path.join(source, p)), { recursive: true });
    await writeFile(path.join(source, p), JSON.stringify(d));
  };
  try {
    await mkdir(out, { recursive: true });
    await put("progress-policy.json", {
      steps: { "P21/main/skip": { applicable: false } },
      deleted: {},
    });
    await put("projects/P21/project.json", {
      title: "项目",
      prerequisites: "基础",
      recommendedProjectIds: [],
    });
    const step = {
      id: "real",
      title: "文字",
      status: "ready",
      codeRefs: [{ codeSha256: "a".repeat(64) }],
      inputRefs: [],
      outputRefs: ["learning/result.json"],
      teachingCode: "x=1",
      exercise: { prompt: "自评" },
    };
    const lesson = {
      steps: [
        step,
        { ...step, id: "skip" },
        { id: "planned", status: "planned" },
      ],
    };
    await put("lesson.json", lesson);
    await put("learning/result.json", {
      rows: [[1]],
      text: null,
      context: { identity: "new-precomputed" },
    });
    const index = {
      contentVersion: "0.4.0",
      projects: [
        {
          id: "P21",
          lessons: [{ id: "main", status: "ready", ref: "lesson.json" }],
        },
      ],
    };
    const a = await generateProgress(source, out, index);
    assert.equal(a.steps.length, 1);
    step.title = "文字更正";
    step.explanation = ["解释修改"];
    await put("lesson.json", lesson);
    const b = await generateProgress(source, out, index);
    assert.equal(a.steps[0].revision, b.steps[0].revision);
    step.teachingCode = "x=2";
    await put("lesson.json", lesson);
    const c = await generateProgress(source, out, index);
    assert.notEqual(b.steps[0].revision, c.steps[0].revision);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("replace unlock cannot bypass a newer tab write", () => {
  const mem = memory(),
    a = storageAdapter(mem, manifest),
    b = storageAdapter(mem, manifest);
  a.read();
  b.read();
  b.save(completed());
  assert.throws(() => a.unlock(), /冲突/);
});

test("recommendation considers confirmed knowledge ahead of soft ordering and prioritizes real review state", async () => {
  const { recommendStep } =
    await import("../app/src/features/progress/engine.mjs");
  const d = emptyProgress(manifest);
  assert.equal(recommendStep(manifest, d).project.id, "P21");
  d.prerequisiteConfirmations = ["P17"];
  assert.equal(recommendStep(manifest, d).project.id, "P17");
  const n = completed();
  n.prerequisiteConfirmations = ["P17"];
  n.stepStates[s.key].status = "review_needed";
  assert.equal(recommendStep(manifest, n).step.key, s.key);
  const invalid = { ...d, prerequisiteConfirmations: ["P99"] };
  assert.throws(() => parseProgress(JSON.stringify(invalid), manifest), /未知/);
});
