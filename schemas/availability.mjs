export function availability(project, coverage, learning) {
  const blocks = coverage?.blocked || [],
    models = coverage?.models || [];
  const hasOriginalModel =
    !/^(无|没有)/.test(project.methods || "") && project.id !== "P18";
  return {
    course: !learning.readySteps
      ? "unavailable"
      : blocks.length
        ? "partial"
        : "readable",
    label: !learning.readySteps
      ? "未开放"
      : blocks.length
        ? "部分可学"
        : "已发布内容完整可学",
    result: models.length
      ? "新教学版本已计算；原模型待复现"
      : hasOriginalModel
        ? "原模型待复现；已提供保存证据和只读核对"
        : "只读结果已核对；无新增训练",
    models: models.map((m) => m.version),
    gaps: blocks.map((b) => b.step + "：" + b.reason),
  };
}
export function dependencyCycle(nodes, getId, getRequires) {
  const done = new Set(),
    stack = new Set();
  function visit(node) {
    const id = getId(node);
    if (stack.has(id)) return id;
    if (done.has(id)) return null;
    stack.add(id);
    for (const nextId of getRequires(node)) {
      const next = nodes.find((n) => getId(n) === nextId);
      if (!next) throw Error("未知依赖：" + nextId);
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.delete(id);
    done.add(id);
    return null;
  }
  for (const node of nodes) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}
