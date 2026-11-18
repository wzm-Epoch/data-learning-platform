import type { Project } from "../content/catalog";
export function ContentStatus({ project: p }: { project: Project }) {
  return (
    <>
      <span>内容：{p.availability?.label || "状态待核对"}</span>
      <span>结果：{p.availability?.result || "见项目证据说明"}</span>
    </>
  );
}
