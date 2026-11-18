import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const fetch = (url) =>
  globalThis.fetch(url, { signal: AbortSignal.timeout(5000) });
const base = "http://127.0.0.1:4173";
test("production serves HTML, CSS, JS modules and catalog via loopback only", async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-security-policy"),
    /connect-src 'self'/,
  );
  const html = await response.text();
  const queue = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(
    (x) => new URL(x[1], base + "/").href,
  );
  const visited = new Set();
  while (queue.length) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    assert.equal(new URL(url).origin, base);
    const asset = await fetch(url);
    assert.equal(asset.status, 200, url);
    const text = await asset.text();
    if (url.endsWith(".js")) {
      assert.match(asset.headers.get("content-type"), /javascript/);
      for (const m of text.matchAll(
        /(?:from\s*|import\()["`](\.\/[^"`\s]+\.js)["`]/g,
      ))
        queue.push(new URL(m[1], url).href);
    } else assert.match(asset.headers.get("content-type"), /css/);
  }
  const catalog = await fetch(base + "/content/catalog.json");
  assert.equal(catalog.status, 200);
  assert.equal((await catalog.json()).projects.length, 29);
  assert.ok(visited.size >= 3);
  console.log("Local assets verified:", visited.size);
  assert.equal((await fetch(base + "/nonexistent.json")).status, 404);
});
test("occupied port exits with explicit error instead of switching origin", () => {
  const result = spawnSync(process.execPath, ["scripts/serve.mjs"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /4173/);
  assert.match(result.stderr, /不会自动换端口/);
});

test("all 29 production project packages and knowledge index resolve by stable references", async () => {
  const c = await (await fetch(base + "/content/catalog.json")).json();
  for (const p of c.projects) {
    const response = await fetch(base + "/content/" + p.detailRef);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).id, p.id);
  }
  const response = await fetch(base + "/content/knowledge-index.json");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).tags.length, 102);
});

test("all production learning lessons and ready-step result files are accessible", async () => {
  const index = await (
    await fetch(base + "/content/learning/index.json")
  ).json();
  let steps = 0;
  const resources = new Set();
  for (const p of index.projects)
    for (const meta of p.lessons) {
      const response = await fetch(base + "/content/" + meta.ref);
      assert.equal(response.status, 200);
      const lesson = await response.json();
      assert.equal(lesson.projectId, p.id);
      if (lesson.status === "ready")
        for (const step of lesson.steps) {
          steps++;
          for (const ref of step.outputRefs) resources.add(ref);
        }
    }
  assert.ok(steps>=350);
  for (const ref of resources) {
    const response = await fetch(base + "/content/" + ref);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /json/);
  }
  assert.ok(resources.size>=500);
});
