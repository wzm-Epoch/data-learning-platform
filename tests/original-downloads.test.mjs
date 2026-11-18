import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  originalDownloadsSchema,
  matchOriginalPackage,
} from "../schemas/original-downloads.mjs";
const read = async (path) =>
  JSON.parse(await readFile(new URL("../" + path, import.meta.url), "utf8"));
const root = "https://github.com/wzm-Epoch/data-learning-platform/releases/";
const fixture = () => ({
  schemaVersion: "1.0",
  releaseTag: "test",
  releaseUrl: root + "tag/test",
  manifestUrl: root + "download/test/original-assets-manifest.json",
  fileCount: 2,
  originalBytes: 3,
  projects: [
    {
      id: "P01",
      originalDirectory: "原项目",
      fileCount: 2,
      originalBytes: 3,
      archive: "P01-original.zip",
      archiveBytes: 100,
      sha256: "a".repeat(64),
      downloadUrl: root + "download/test/P01-original.zip",
      files: [
        { path: "原项目/a.py", bytes: 1, sha256: "b".repeat(64) },
        { path: "原项目/b.csv", bytes: 2, sha256: "c".repeat(64) },
      ],
    },
  ],
});

test("download manifest rejects unsafe and mismatched archive identities", () => {
  assert.equal(originalDownloadsSchema.safeParse(fixture()).success, true);
  for (const mutate of [
    (x) => (x.projects[0].downloadUrl = "https://example.com/P01-original.zip"),
    (x) => (x.projects[0].downloadUrl = "javascript:alert(1)"),
    (x) =>
      (x.projects[0].downloadUrl = root + "download/test/P02-original.zip"),
    (x) => (x.projects[0].files[0].path = "原项目/../outside.py"),
    (x) => (x.projects[0].files[0].path = "别的项目/a.py"),
    (x) => (x.projects[0].fileCount = 3),
    (x) => (x.originalBytes = 4),
    (x) => x.projects.push(structuredClone(x.projects[0])),
    (x) => (x.releaseUrl = root + "tag/another"),
    (x) =>
      (x.manifestUrl = root + "download/another/original-assets-manifest.json"),
  ]) {
    const x = fixture();
    mutate(x);
    assert.equal(originalDownloadsSchema.safeParse(x).success, false);
  }
});

test("source matching refuses altered, duplicate or missing source references", () => {
  const m = fixture(),
    refs = m.projects[0].files.map((f) => ({
      ...f,
      path: f.path.replaceAll("/", "\\"),
    }));
  assert.equal(matchOriginalPackage(m, "P01", refs).id, "P01");
  assert.equal(matchOriginalPackage(m, "P30", refs), null);
  assert.throws(() => matchOriginalPackage(m, "P01", refs.slice(1)), /不匹配/);
  assert.throws(
    () => matchOriginalPackage(m, "P01", [refs[0], refs[0]]),
    /不匹配/,
  );
  assert.throws(
    () =>
      matchOriginalPackage(m, "P01", [
        { ...refs[0], sha256: "d".repeat(64) },
        refs[1],
      ]),
    /不匹配/,
  );
});

test("published downloads cover all 29 projects and 424 audited source files", async () => {
  const m = originalDownloadsSchema.parse(
    await read("content-source/original-downloads.json"),
  );
  const catalog = await read("app/public/content/catalog.json");
  assert.equal(m.projects.length, 29);
  assert.equal(m.fileCount, 424);
  for (const p of catalog.projects) {
    const detail = await read("app/public/content/" + p.detailRef);
    assert.equal(matchOriginalPackage(m, p.id, detail.sourceRefs).id, p.id);
  }
  assert.deepEqual(await read("app/public/content/original-downloads.json"), m);
});
