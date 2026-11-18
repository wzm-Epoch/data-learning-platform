import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { generateLearning } from "../scripts/generate-learning.mjs";
import { lessonSchema, resourceSchema } from "../schemas/learning.mjs";
import {
  readLocation,
  writeLocation,
  validLocation,
  locationKey,
} from "../app/src/features/learning/location.ts";
const root = new URL("..", import.meta.url);
const read = async (ref) =>
  JSON.parse(await readFile(new URL(ref, root), "utf8"));
const index = await read("app/public/content/learning/index.json");
const lessons = await Promise.all(
  index.projects
    .flatMap((p) => p.lessons)
    .map((l) => read("app/public/content/" + l.ref)),
);
const ready = lessons.filter((l) => l.status === "ready");
const manifest = await read("content-source/learning/build.json");
test("30 ready lessons retain the original 25 stable representative steps",async()=>{
 assert.equal(index.projects.length,29);assert.equal(ready.length,30);
 const inherited=ready.filter(l=>['P21','P11','P17'].includes(l.projectId));
 assert.equal(inherited.reduce((n,l)=>n+l.steps.filter(s=>s.id!=='phase4-data').length,0),25);
 for(const l of lessons)lessonSchema.parse(l);
});
test("every ready step binds exact notebook source and only matching input/result identities", async () => {
  const config = await read("local-config/paths.json");
  const notebooks = new Map();
  for (const l of ready)
    for (const s of l.steps) {
      assert.ok(s.exercise.hint && s.exercise.checklist.length);
      for (const ref of s.codeRefs) {
        if (!notebooks.has(ref.path))
          notebooks.set(
            ref.path,
            JSON.parse(
              await readFile(path.join(config.sourceRoot, ref.path), "utf8"),
            ),
          );
        const code = notebooks
          .get(ref.path)
          .cells[ref.cell - 1].source.join("");
        assert.equal(ref.code, code);
        assert.equal(
          createHash("sha256").update(code).digest("hex"),
          ref.codeSha256,
        );
      }
      for (const ref of s.outputRefs) {
        const resource = resourceSchema.parse(
          await read("app/public/content/" + ref),
        );
        for (const input of resource.context.inputs)
          assert.ok(
            s.inputRefs.some(
              (i) => i.path === input.path && i.sha256 === input.sha256,
            ) ||
              s.codeRefs.some(
                (c) =>
                  c.path === input.path && c.notebookSha256 === input.sha256,
              ),
          );
        if(resource.context.modelRerun){assert.equal(resource.context.identity,"teaching-adaptation");assert.ok(resource.context.modelVersion);} else if(resource.context.identity==="original-saved")assert.equal(resource.context.modelRerun,false);
      }
    }
});
test("P21 lesson A/B inputs never cross, exact totals and period null policy are recomputed", async () => {
  const a = ready.find(
    (l) => l.projectId === "P21" && l.id === "sales-explore",
  );
  const b = ready.find(
    (l) => l.projectId === "P21" && l.id === "monthly-report",
  );
  for (const s of a.steps.filter(s=>s.id!=="phase4-data"))
    assert.ok(s.inputRefs.every((r) => r.path.endsWith("/order-14.3.csv")));
  for (const s of b.steps.filter(s=>s.id!=="phase4-data"))
    assert.ok(
      s.inputRefs.every(
        (r) =>
          r.path.endsWith("/order-14.1.csv") || r.path.endsWith("/order.csv"),
      ),
    );
  assert.equal(manifest.checks.aRows, 3478);
  assert.equal(manifest.checks.aOrders, 918);
  assert.equal(manifest.checks.aExactAmount, "28950.06645");
  assert.equal(manifest.checks.bAllEmpty, 266);
  assert.equal(manifest.checks.bCleanRows, 3478);
  assert.equal(manifest.checks.bAttachedResultMatches, true);
  const stores = await read(
    "app/public/content/learning/resources/p21-a-stores.json",
  );
  assert.equal(stores.rows.at(-1)[1], "28950.06645");
  const empty = await read(
    "app/public/content/learning/resources/p21-b-zero.json",
  );
  assert.equal(empty.rows[0][4], null);
  assert.equal(empty.rows[0][5], null);
  const periods = await read(
    "app/public/content/learning/resources/p21-b-periods.json",
  );
  assert.ok(periods.rows.every((row) => row[4] === 0));
});
test("P11 anomaly is retained and P17 saved std/labels are never presented as new trained means", async () => {
  assert.equal(manifest.checks.p11Rows, 18907);
  assert.equal(manifest.checks.p11CleanRows, 18906);
  assert.equal(manifest.checks.p17FeatureColumns, 33);
  assert.equal(manifest.originalModelRerun, false);
  assert.equal(manifest.notebookExecution, false);
  assert.deepEqual(manifest.checks.p17SavedCounts, [73, 154, 313, 349]);
  const anomaly = await read(
    "app/public/content/learning/resources/p11-anomaly.json",
  );
  assert.equal(anomaly.rows[0][0], 12546);
  assert.equal(anomaly.rows[0][3], 10871);
  for (const ref of ["p17-scores", "p17-counts", "p17-profile-saved"]) {
    const res = await read(
      "app/public/content/learning/resources/" + ref + ".json",
    );
    assert.equal(res.context.identity, "original-saved");
  }
  assert.match(
    ready
      .find((l) => l.projectId === "P17")
      .steps.filter(s=>s.id!=="phase4-data").at(-1)
      .explanation.join(),
    /标准差std/,
  );
});
test("reading position round trip, invalid/version/unknown-step rejection and quota failure", () => {
  const db = new Map([["da-learning:progress:v1", "do-not-change"]]);
  const storage = {
    getItem: (key) => db.get(key) || null,
    setItem: (key, value) => db.set(key, value),
  };
  const location = {
    schemaVersion: "1.0",
    contentVersion: index.contentVersion,
    projectId: "P21",
    lessonId: "sales-explore",
    stepId: "a-stores",
    updatedAt: new Date().toISOString(),
  };
  assert.equal(writeLocation(location, index, storage), "");
  assert.deepEqual(readLocation(index, storage).location, location);
  assert.equal(validLocation({ ...location, stepId: "unknown" }, index), false);
  assert.equal(
    validLocation({ ...location, contentVersion: "old" }, index),
    false,
  );
  assert.equal(validLocation({ ...location, projectId: "P01" }, index), false);
  assert.match(
    writeLocation(location, index, {
      setItem() {
        throw new Error("quota");
      },
    }),
    /无法保存/,
  );
  assert.equal(db.get("da-learning:progress:v1"), "do-not-change");
  storage.setItem(locationKey, "{bad");
  assert.equal(readLocation(index, storage).location, null);
});
test("duplicate step IDs and absent result text fail validation", async () => {
  const bad = structuredClone(ready[0]);
  bad.steps[1].id = bad.steps[0].id;
  assert.equal(lessonSchema.safeParse(bad).success, false);
  const res = await read(
    "app/public/content/learning/resources/p17-profile-saved.json",
  );
  res.text = null;
  assert.equal(resourceSchema.safeParse(res).success, false);
});
test("generator refuses a result whose input has been switched to the other P21 lesson", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "learning-source-test-"));
  assert.equal(path.resolve(path.dirname(temp)), path.resolve(os.tmpdir()));
  try {
    const source = path.join(temp, "source");
    await cp(new URL("content-source/", root), source, { recursive: true });
    const resourcePath = path.join(
      source,
      "learning/resources/p21-a-grain.json",
    );
    const res = JSON.parse(await readFile(resourcePath, "utf8"));
    const b = ready.find(
      (l) => l.projectId === "P21" && l.id === "monthly-report",
    );
    res.context.inputs = [b.steps[0].inputRefs[0]];
    await writeFile(resourcePath, JSON.stringify(res));
    await assert.rejects(
      generateLearning(source, path.join(temp, "out")),
      /结果与步骤来源不一致/,
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
