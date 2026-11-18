import { z } from "zod";
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const bytes = z.number().int().nonnegative();
const repository = "https://github.com/wzm-Epoch/data-learning-platform/";
const link = (segment) =>
  z
    .string()
    .url()
    .refine(
      (value) => value.startsWith(repository + segment),
      "下载链接必须来自本项目GitHub仓库",
    );
const relative = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !/^[A-Za-z]:|^[/\\]/.test(value) && !value.split(/[\\/]/).includes(".."),
    "原路径必须为安全相对路径",
  );
const project = z.object({
  id: z.string().regex(/^P\d{2}$/),
  originalDirectory: relative,
  fileCount: z.number().int().positive(),
  originalBytes: bytes,
  archive: z.string().regex(/^P\d{2}-original\.zip$/),
  archiveBytes: z.number().int().positive(),
  sha256: sha,
  downloadUrl: link("releases/download/"),
  files: z.array(z.object({ path: relative, bytes, sha256: sha })).min(1),
});
export const originalDownloadsSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    releaseTag: z.string().regex(/^[A-Za-z0-9._-]+$/),
    releaseUrl: link("releases/tag/"),
    manifestUrl: link("releases/download/"),
    fileCount: z.number().int().positive(),
    originalBytes: bytes,
    projects: z.array(project).min(1),
  })
  .superRefine((manifest, ctx) => {
    const fail = (message) => ctx.addIssue({ code: "custom", message });
    if (
      manifest.releaseUrl !==
        `${repository}releases/tag/${manifest.releaseTag}` ||
      manifest.manifestUrl !==
        `${repository}releases/download/${manifest.releaseTag}/original-assets-manifest.json`
    )
      fail("发布地址与资料版本不匹配");
    if (
      new Set(manifest.projects.map((p) => p.id)).size !==
      manifest.projects.length
    )
      fail("项目资料包ID重复");
    if (
      manifest.fileCount !==
        manifest.projects.reduce((sum, p) => sum + p.fileCount, 0) ||
      manifest.originalBytes !==
        manifest.projects.reduce((sum, p) => sum + p.originalBytes, 0)
    )
      fail("总文件数或字节数不匹配");
    for (const p of manifest.projects) {
      if (
        p.archive !== `${p.id}-original.zip` ||
        p.downloadUrl !==
          `${repository}releases/download/${manifest.releaseTag}/${p.archive}`
      )
        fail("资料包链接与项目ID不匹配");
      if (
        p.fileCount !== p.files.length ||
        new Set(p.files.map((f) => f.path)).size !== p.files.length ||
        p.originalBytes !== p.files.reduce((sum, f) => sum + f.bytes, 0)
      )
        fail("项目文件数或字节数不匹配");
      if (p.files.some((f) => !f.path.startsWith(p.originalDirectory + "/")))
        fail("资料包包含其他项目路径");
    }
  });

export function matchOriginalPackage(manifest, projectId, refs) {
  const p = manifest.projects.find((p) => p.id === projectId);
  if (!p) return null;
  const normalize = (path) => path.replaceAll("\\", "/");
  const files = new Map(p.files.map((f) => [f.path, f.sha256]));
  if (
    refs.length !== p.fileCount ||
    new Set(refs.map((ref) => normalize(ref.path))).size !== refs.length ||
    refs.some((ref) => files.get(normalize(ref.path)) !== ref.sha256)
  )
    throw new Error("资料包与本项目来源清单不匹配，暂不提供下载。");
  return p;
}

export function formatFileBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  if (value < 1024 * 1024 * 1024)
    return `${(value / 1024 / 1024).toFixed(1)} MiB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GiB`;
}
