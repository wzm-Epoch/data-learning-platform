import {
  originalDownloadsSchema,
  matchOriginalPackage,
  formatFileBytes,
} from "../../../schemas/original-downloads.mjs";
import { useResource } from "../content/useResource";
import type { SourceRef } from "../content/catalog";
import a from "../styles/App.module.css";
import s from "../styles/Library.module.css";

type Package = {
  id: string;
  fileCount: number;
  originalBytes: number;
  archive: string;
  archiveBytes: number;
  sha256: string;
  downloadUrl: string;
  files: { path: string; sha256: string; bytes: number }[];
};
type Manifest = {
  releaseUrl: string;
  manifestUrl: string;
  projects: Package[];
};
let pending: Promise<Manifest> | undefined;
function loadManifest() {
  if (!pending)
    pending = fetch(
      `${import.meta.env.BASE_URL}content/original-downloads.json`,
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error("原始资料下载清单暂不可用，原路径与哈希仍可查看。");
        return originalDownloadsSchema.parse(await response.json()) as Manifest;
      })
      .catch((error) => {
        pending = undefined;
        throw error;
      });
  return pending;
}

export function OriginalDownloads({
  projectId,
  sources,
}: {
  projectId: string;
  sources: SourceRef[];
}) {
  const { data, error, retry } = useResource(
    "original-downloads",
    loadManifest,
  );
  if (error)
    return (
      <section className={s.infoBox}>
        <h3>原始资料下载</h3>
        <p role="status">{error}</p>
        <button className={s.inlineButton} onClick={retry}>
          重试读取下载清单
        </button>
      </section>
    );
  if (!data) return <p role="status">正在读取原始资料下载清单…</p>;
  let pack: Package | null;
  try {
    pack = matchOriginalPackage(data, projectId, sources) as Package | null;
  } catch {
    return (
      <section className={s.infoBox}>
        <h3>原始资料下载</h3>
        <p>资料包与本项目来源清单不匹配，暂不提供下载。</p>
      </section>
    );
  }
  if (!pack)
    return (
      <section className={s.infoBox}>
        <h3>原始资料下载</h3>
        <p>本项目尚未发布原始资料包。</p>
      </section>
    );
  return (
    <section className={s.infoBox} aria-label="原始项目资料下载">
      <h3>下载完整原始项目</h3>
      <p>
        {pack.fileCount} 个原文件 · 原始大小{" "}
        {formatFileBytes(pack.originalBytes)} · ZIP大小{" "}
        {formatFileBytes(pack.archiveBytes)}
      </p>
      <p>
        保留原目录结构、代码、数据、保存结果及附带资源。点击后从GitHub下载，打开本页面不会自动下载资料包。
      </p>
      <div className={a.actions}>
        <a
          className={a.button}
          href={pack.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          下载原始项目资料包 · {pack.archive}
        </a>
        <a
          className={a.secondaryButton}
          href={data.releaseUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          查看全部{data.projects.length}个项目资料包
        </a>
      </div>
      <details>
        <summary>核对下载文件与原始资料</summary>
        <p className={s.path}>ZIP SHA-256：{pack.sha256}</p>
        <a href={data.manifestUrl} target="_blank" rel="noopener noreferrer">
          下载原始文件及资料包校验清单
        </a>
      </details>
      <p className={s.note}>
        资料下载与分析结果复现是两回事。网页不直接运行Notebook、HTML脚本、模型或安装包；各文件的来源及使用范围沿用原项目说明。
      </p>
    </section>
  );
}
