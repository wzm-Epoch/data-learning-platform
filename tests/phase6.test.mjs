import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { catalogSchema, knowledgeSchema } from "../schemas/catalog.mjs";
import { availability, dependencyCycle } from "../schemas/availability.mjs";
const read = async (p) =>
  JSON.parse(await readFile(new URL("../" + p, import.meta.url), "utf8"));
const resource = (name) =>
  read("content-source/learning/resources/" + name + ".json");
test("multi-node recommendation and hard knowledge cycles rejected including unknown dependencies", async () => {
  const c = await read("app/public/content/catalog.json");
  const x = structuredClone(c);
  x.projects[0].recommendedProjectIds = [x.projects[1].id];
  x.projects[1].recommendedProjectIds = [x.projects[0].id];
  assert.equal(catalogSchema.safeParse(x).success, false);
  assert.equal(catalogSchema.safeParse(c).success, true);
  const k = await read("content-source/knowledge.json");
  const y = structuredClone(k);
  y.branches[0].requires = [y.branches[1].id];
  y.branches[1].requires = [y.branches[0].id];
  assert.equal(knowledgeSchema.safeParse(y).success, false);
  assert.throws(
    () =>
      dependencyCycle(
        [{ id: "a", requires: ["unknown"] }],
        (n) => n.id,
        (n) => n.requires,
      ),
    /未知/,
  );
});
test("content partial readiness, result validation and personal learning state are distinct", async () => {
  const c = await read("app/public/content/catalog.json");
  assert.equal(
    c.projects.find((p) => p.id === "P07").availability.course,
    "partial",
  );
  assert.equal(
    c.projects.find((p) => p.id === "P21").availability.course,
    "readable",
  );
  assert.match(
    c.projects.find((p) => p.id === "P23").availability.result,
    /新教学版本/,
  );
  assert.match(
    c.projects.find((p) => p.id === "P21").availability.result,
    /无新增训练/,
  );
  assert.equal(
    availability({ id: "P21", methods: "无机器学习模型" }, null, {
      readySteps: 0,
    }).course,
    "unavailable",
  );
});
test("P14 saved matrix really 4x4 with correct test total and accuracy, unit example excluded", async () => {
  const r = await resource("p14-v6-saved-confusion");
  assert.equal(r.context.identity, "original-saved");
  assert.equal(r.context.modelRerun, false);
  assert.equal(r.rows.length, 16);
  assert.equal(
    r.rows.reduce((n, x) => n + x[2], 0),
    26653,
  );
  assert.ok(
    Math.abs(
      r.rows.filter((x) => x[0] === x[1]).reduce((n, x) => n + x[2], 0) /
        26653 -
        0.6287097137282858,
    ) < 1e-12,
  );
  assert.match(r.context.note, /3×3单位阵.*演示/);
  const detail = await read("content-source/projects/P14/project.json"),
    config = await read("local-config/paths.json");
  const nb = JSON.parse(
    await readFile(config.sourceRoot + "/" + detail.lessons[0].source, "utf8"),
  );
  const saved = nb.cells[14].outputs
    .map((o) => (o.text || []).join(""))
    .join("\n");
  assert.match(saved, /13505\s+1078\s+1048\s+385/);
  assert.match(
    nb.cells[17].source.join(""),
    /confusion_matrix\(\[1,2,3\], \[1,2,3\]\)/,
  );
});
test("P24 true missing rates and independent low R2 stay separate from fitted claims", async () => {
  const missing = await resource("p24-v4-missing"),
    holdout = await resource("p24-v4-holdout");
  const age = missing.rows.find((r) => r[0] === "age");
  assert.equal(age[1], 12736);
  assert.equal(age[2], 29452);
  assert.ok(Math.abs(age[3] - 12736 / 29452) < 1e-12);
  assert.ok(holdout.rows.find((r) => r[0] === "R²")[1] < 0.04);
  assert.equal(holdout.context.modelRerun, true);
  const l = await read(
    "content-source/learning/projects/P24/main-analysis.json",
  );
  assert.match(l.steps[0].limitations.join(""), /均值填充造峰.*默认年龄/);
});
test("P25 age segments do not overlap and population is not mislabeled GDP", async () => {
  const ages = await resource("p25-v4-ages");
  assert.equal(ages.rows.length, 31);
  assert.equal(ages.columns.length, 4);
  for (const row of ages.rows)
    assert.ok(Math.abs(row.slice(1).reduce((a, b) => a + b, 0) - 1) < 0.0002);
  assert.match((await resource("p25-v4-population")).title, /人口/);
});
test("P28 group rate uses within-group denominator instead of headcount and encoded causality", async () => {
  const salary = await resource("p28-v4-salary");
  const low = salary.rows.find((r) => r[0] === "low");
  assert.deepEqual(low.slice(1, 3), [7316, 2172]);
  assert.ok(Math.abs(low[3] - 2172 / 7316) < 1e-12);
  const l = await read(
    "content-source/learning/projects/P28/main-analysis.json",
  );
  assert.match(l.steps[0].limitations.join(""), /名义部门.*Pearson/);
  assert.match(l.steps[0].limitations.join(""), /人数多与离职率高不同/);
});
test("light and dark token text contrast meets normal-text AA for declared pairs", async () => {
  const css = await readFile(
    new URL("../app/src/styles/tokens.css", import.meta.url),
    "utf8",
  );
  const luminance = (h) => {
    if (h.length === 4)
      h =
        "#" +
        h
          .slice(1)
          .split("")
          .map((x) => x + x)
          .join("");
    return h
      .slice(1)
      .match(/../g)
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const blocks = [
    css.match(/:root \{([\s\S]*?)\}/)[1],
    css.match(/:root\[data-theme="dark"\] \{([\s\S]*?)\}/)[1],
  ];
  for (const block of blocks) {
    const colors = Object.fromEntries(
      [...block.matchAll(/--([\w-]+):\s*(#[\da-f]+)/gi)].map((m) => [
        m[1],
        m[2],
      ]),
    );
    for (const fg of [
      "text",
      "muted",
      "primary-text",
      "success",
      "warning",
      "error",
    ]) {
      const a = luminance(colors[fg]),
        b = luminance(colors.surface);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      assert.ok(ratio >= 4.5, fg + " contrast " + ratio);
    }
  }
});

test('corrupt runtime progress manifest rejected before any storage access',async()=>{const {parseManifest}=await import('../app/src/features/progress/engine.mjs');const m=await read('app/public/content/progress-manifest.json');assert.equal(parseManifest(m).steps.length,385);assert.throws(()=>parseManifest({...m,steps:null}),/清单/);const bad=structuredClone(m);bad.steps[0].key='wrong';assert.throws(()=>parseManifest(bad),/ID不一致/);});
