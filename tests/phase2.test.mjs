import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateCatalog } from "../scripts/generate-catalog.mjs";
import { detailSchema, knowledgeSchema } from "../schemas/catalog.mjs";
import { filterProjects, searchProjects } from "../app/src/content/catalog.ts";
const root = new URL("..", import.meta.url);
const read = async (name) =>
  JSON.parse(await readFile(new URL(name, root), "utf8"));
const c = await read("app/public/content/catalog.json");
const details = await Promise.all(
  c.projects.map((p) => read("app/public/content/" + p.detailRef)),
);
const k = await read("app/public/content/knowledge-index.json");
test("all project packages validate, categories and route cover each stable ID exactly once", () => {
  for (const d of details) detailSchema.parse(d);
  knowledgeSchema.parse(k);
  for (const lists of [c.categories, c.stages])
    assert.deepEqual(
      lists.flatMap((x) => x.projectIds).sort(),
      c.projects.map((p) => p.id).sort(),
    );
  assert.ok(
    c.projects.every((p) => !("datasets" in p) && !("sourceRefs" in p)),
  );
  assert.equal(
    details.reduce((n, d) => n + d.sourceRefs.length, 0),
    424,
  );
  assert.equal(
    details.reduce((n, d) => n + d.datasets.length, 0),
    79,
  );
});
test("combined category/difficulty/tag/readiness filters, stable sorts and knowledge search", () => {
  assert.deepEqual(
    filterProjects(c, {
      category: "society",
      difficulty: "高级",
      tag: "Altair",
    }).map((p) => p.id),
    ["P26"],
  );
  assert.deepEqual(
    filterProjects(c, { readiness: "known-gaps" })
      .map((p) => p.id)
      .sort(),
    ["P07", "P14"],
  );
  assert.equal(filterProjects(c, { readiness: "not-adapted" }).length, 0);
  assert.equal(
    filterProjects(c, { readiness: "representative-ready" }).length,
    29,
  );
  assert.equal(filterProjects(c, { q: "P21", category: "sport" }).length, 0);
  assert.equal(filterProjects(c, {})[0].id, "P21");
  assert.equal(
    filterProjects(c, { sort: "category" })[0].categoryId,
    "commerce",
  );
  assert.equal(searchProjects(c.projects, "一单多行")[0].id, "P21");
  assert.equal(searchProjects(c.projects, "SQL").length, 0);
});
test("required factual distinctions, dictionary physical types and unknown units", () => {
  const get = (id) => details.find((d) => d.id === id);
  assert.match(get("P14").title, /微博/);
  assert.ok(get("P26").skillTags.includes("层次聚类"));
  assert.ok(get("P26").skillTags.includes("Altair"));
  assert.match(get("P21").methods, /无机器学习/);
  assert.match(get("P28").methods, /没有训练/);
  assert.match(get("P04").scopeNotes.join(), /2015—2017/);
  assert.match(get("P07").scopeNotes.join(), /4图/);
  assert.match(get("P07").scopeNotes.join(), /未证实一一对应/);
  assert.notEqual(get("P25").id, get("P26").id);
  assert.notDeepEqual(get("P09").sourceRefs, get("P11").sourceRefs);
  const p21 = get("P21");
  assert.equal(p21.lessons.length, 2);
  assert.equal(
    p21.datasets[0].fields.find((f) => f.name === "商品ID").missing,
    266,
  );
  for (const p of details)
    for (const d of p.datasets) {
      assert.equal(d.fields.length, d.columns);
      for (const f of d.fields) {
        assert.ok(f.meaning === null || typeof f.meaning === "string");
        assert.ok(f.unit === null || typeof f.unit === "string");
        assert.ok(f.evidence);
      }
    }
  assert.ok(
    get("P25").datasets.some(
      (d) =>
        d.fields.some((f) => f.name.startsWith("Unnamed:")) &&
        d.teachingMappings.some((m) => m.code.includes("df.columns")),
    ),
  );
});
test("knowledge evidence resolves to actual source code cell, no fabricated steps", async () => {
  const config = await read("local-config/paths.json");
  for (const tag of k.tags)
    for (const usage of tag.usages) {
      const p = details.find((d) => d.id === usage.projectId);
      assert.ok(p.skillTags.includes(tag.id));
      for (const ref of usage.codeRefs) {
        const notebook = JSON.parse(
          await readFile(path.join(config.sourceRoot, ref.source), "utf8"),
        );
        assert.ok(
          notebook.cells[ref.cell - 1].source.join("").includes(ref.snippet),
        );
        assert.equal(notebook.cells[ref.cell - 1].cell_type, "code");
      }
    }
  assert.ok(
    k.tags
      .find((t) => t.id === "Altair")
      .usages.some((u) => u.projectId === "P26" && u.codeRefs.length),
  );
});
test("temporary registry addition generates a 30th project without page code changes, then cleans up", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "learning-registry-"));
  try {
    const source = path.join(temp, "source"),
      out = path.join(temp, "out");
    await cp(new URL("content-source/", root), source, { recursive: true });
    const registry = await read("content-source/registry.json");
    const p = structuredClone(registry[0]);
    p.id = "P30";
    p.title = "临时注册表验收条目";
    p.detailRef = "projects/P30/project.json";
    registry.push(p);
    const stages = structuredClone(c.stages);
    stages[0].projectIds.push("P30");
    const categories = structuredClone(c.categories);
    categories.find((x) => x.id === p.categoryId).projectIds.push("P30");
    const detail = structuredClone(details[0]);
    Object.assign(detail, p);
    await cp(
      path.join(source, "projects", "P01"),
      path.join(source, "projects", "P30"),
      { recursive: true },
    );
    for (const [file, value] of [
      ["registry.json", registry],
      ["stages.json", stages],
      ["categories.json", categories],
      ["projects/P30/project.json", detail],
    ])
      await writeFile(path.join(source, file), JSON.stringify(value));
    const generated = await generateCatalog(source, out);
    assert.equal(generated.projects.length, 30);
    assert.equal(
      searchProjects(generated.projects, "临时注册表验收条目")[0].id,
      "P30",
    );
    assert.equal(
      JSON.parse(await readFile(path.join(out, p.detailRef), "utf8")).id,
      "P30",
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
  assert.equal(
    (await read("app/public/content/catalog.json")).projects.length,
    29,
  );
});

test("population mapped names survive runtime validation and source dictionaries supply only documented semantics", () => {
  const population = details.find((d) => d.id === "P26");
  assert.ok(
    population.datasets.some((d) =>
      d.teachingMappings.some((m) => m.outputFields.includes("a14-")),
    ),
  );
  const loan = details
    .find((d) => d.id === "P08")
    .datasets.find((d) => d.path.endsWith("/LC.csv"));
  assert.equal(loan.fields.find((f) => f.name === "借款期限").unit, "月");
  assert.equal(loan.fields.find((f) => f.name === "借款金额").unit, null);
  const air = details
    .find((d) => d.id === "P03")
    .datasets.find((d) => d.path.endsWith("/air_data.csv"));
  assert.equal(
    air.fields.find((f) => f.name === "MEMBER_NO").meaning,
    "会员卡号",
  );
});
