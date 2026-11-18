import { test } from "node:test";
import assert from "node:assert/strict";
test("formal origin serves versioned progress manifest with local valid stable IDs", async () => {
  const response = await fetch(
    "http://127.0.0.1:4173/content/progress-manifest.json",
  );
  assert.equal(response.status, 200);
  const m = await response.json();
  assert.equal(m.projects.length, 29);
  assert.equal(m.steps.length, 385);
  assert.equal(new Set(m.steps.map((s) => s.key)).size, 385);
  assert.equal(m.contentVersion, (await (await fetch("http://127.0.0.1:4173/content/learning/index.json")).json()).contentVersion);
  assert.ok(
    m.steps.every(
      (s) =>
        s.key === `${s.projectId}/${s.lessonId}/${s.stepId}` &&
        /^[a-f0-9]{64}$/.test(s.revision),
    ),
  );
});
test("temporary fault injection pages excluded from final delivery", async () => {
  for (const p of ["phase5-storage-failure.html", "phase5-storage-fault.js"])
    assert.equal((await fetch("http://127.0.0.1:4173/" + p)).status, 404);
});
