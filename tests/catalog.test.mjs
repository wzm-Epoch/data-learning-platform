import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { catalogSchema } from "../schemas/catalog.mjs";
import { searchProjects } from "../app/src/content/catalog.ts";
const details = JSON.parse(
  await readFile(
    new URL("../content-source/projects.json", import.meta.url),
    "utf8",
  ),
);
const c = JSON.parse(
  await readFile(
    new URL("../app/public/content/catalog.json", import.meta.url),
    "utf8",
  ),
);
test("29 stable IDs, 12 categories, P21 is one project with two planned lessons", () => {
  catalogSchema.parse(c);
  assert.equal(c.projects.length, 29);
  assert.equal(c.categories.length, 12);
  assert.deepEqual(
    c.projects.map((p) => p.id),
    Array.from({ length: 29 }, (_, i) => "P" + String(i + 1).padStart(2, "0")),
  );
  assert.equal(details.find((p) => p.id === "P21").lessons.length, 2);
  assert.equal(
    details.reduce((s, p) => s + p.sourceRefs.length, 0),
    424,
  );
});
test("search title, original name, verified tag, case and no results", () => {
  assert.equal(searchProjects(c.projects, "超市销售").length, 1);
  assert.ok(
    searchProjects(c.projects, "数据透视分析").some((p) => p.id === "P21"),
  );
  assert.ok(searchProjects(c.projects, "altair").some((p) => p.id === "P26"));
  assert.equal(searchProjects(c.projects, "p21")[0].id, "P21");
  assert.equal(searchProjects(c.projects, "不存在的标签XYZ").length, 0);
  assert.equal(searchProjects(c.projects, "SQL").length, 0);
  assert.equal(searchProjects(c.projects, "").length, 29);
});
test("reject duplicate IDs and invalid category references", () => {
  const bad = structuredClone(c);
  bad.projects[1].id = "P01";
  assert.equal(catalogSchema.safeParse(bad).success, false);
  const other = structuredClone(c);
  other.projects[0].categoryId = "unknown";
  assert.equal(catalogSchema.safeParse(other).success, false);
});
test("projects disclose actual representative readiness and unchanged rerun state", () => {
  for (const p of c.projects) {
    assert.equal(
      p.readiness.course,
      "representative-ready",
    );
    assert.equal(p.readiness.rerun, "not-run");

    assert.ok(p.originalNames.length >= 2);
  }
  assert.equal(
    c.projects.find((p) => p.id === "P07").readiness.source,
    "known-gaps",
  );
  assert.equal(
    c.projects.find((p) => p.id === "P14").readiness.source,
    "known-gaps",
  );
});
