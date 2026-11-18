import { z } from "zod";
export const KEY = "da-learning:progress:v1";
export const MAX_BYTES = 1024 * 1024;
const id = z
  .string()
  .regex(/^[a-zA-Z0-9-]+$/)
  .max(90);
const timestamp = z.string().datetime({ offset: true });
const state = z.enum([
  "not_started",
  "in_progress",
  "completed",
  "review_needed",
]);
const location = z.object({ projectId: id, lessonId: id, stepId: id }).strict();
const row = location
  .extend({
    status: state,
    selfReview: z.enum(["none", "practice", "explained"]),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    updatedAt: timestamp,
  })
  .strict();
const schema = z
  .object({
    schemaVersion: z.literal(1),
    contentVersion: z.string().min(1).max(80),
    revision: z.number().int().nonnegative(),
    updatedAt: timestamp,
    stepStates: z.record(z.string().max(280), row),
    lastLocation: location.nullable(),
    preferences: z
      .object({
        theme: z.enum(["light", "dark"]),
        size: z.enum(["normal", "large"]),
      })
      .strict(),
    events: z
      .array(
        location
          .extend({
            action: z.enum([
              "in_progress",
              "completed",
              "review_needed",
              "not_started",
              "self_review",
            ]),
            at: timestamp,
          })
          .strict(),
      )
      .max(100),
    archived: z.record(z.string().max(280), row),
    prerequisiteConfirmations: z.array(id).max(100).default([]),
  })
  .strict();
export const keyOf = (r) => `${r.projectId}/${r.lessonId}/${r.stepId}`;
export function emptyProgress(manifest) {
  return {
    schemaVersion: 1,
    contentVersion: manifest.contentVersion,
    revision: 0,
    updatedAt: new Date().toISOString(),
    stepStates: {},
    lastLocation: null,
    preferences: { theme: "light", size: "normal" },
    events: [],
    archived: {},
    prerequisiteConfirmations: [],
  };
}
export function parseProgress(raw, manifest) {
  if (
    typeof raw !== "string" ||
    new TextEncoder().encode(raw).length > MAX_BYTES
  )
    throw Error("备份超过1 MiB上限");
  let object;
  try {
    object = JSON.parse(raw);
  } catch {
    throw Error("JSON 格式错误，请选择完整的进度备份");
  }
  if (object?.schemaVersion !== 1)
    throw Error(
      "不支持的进度版本，请使用本平台 schemaVersion 1 的备份；原记录未改变",
    );
  const parsed = schema.safeParse(object);
  if (!parsed.success)
    throw Error(
      "备份结构或状态无效，请检查：" +
        parsed.error.issues
          .slice(0, 3)
          .map((i) => i.path.join("."))
          .join("、"),
    );
  const value = parsed.data;
  if (
    value.prerequisiteConfirmations.some(
      (id) => !manifest.projects.some((p) => p.id === id),
    )
  )
    throw Error("未知的前置知识确认项目ID");
  if (
    value.contentVersion !== manifest.contentVersion &&
    !(manifest.supportedContentVersions || []).includes(value.contentVersion)
  )
    throw Error("未知或较新课程版本，请先更新课程或使用对应版本备份");
  if (
    Object.keys(value.stepStates).length + Object.keys(value.archived).length >
    2000
  )
    throw Error("记录数量超限");
  for (const [k, r] of [
    ...Object.entries(value.stepStates),
    ...Object.entries(value.archived),
  ]) {
    if (k !== keyOf(r)) throw Error("步骤身份不匹配");
    if (
      !manifest.steps.some((s) => s.key === k) &&
      !Object.hasOwn(manifest.deleted, k)
    )
      throw Error("未知步骤ID：" + k);
  }
  for (const r of [
    ...value.events,
    ...(value.lastLocation ? [value.lastLocation] : []),
  ])
    if (
      !manifest.steps.some((s) => s.key === keyOf(r)) &&
      !Object.hasOwn(manifest.deleted, keyOf(r))
    )
      throw Error("未知位置或事件ID");
  return value;
}
export function migrateProgress(value, manifest) {
  const next = structuredClone(value),
    notes = [];
  next.contentVersion = manifest.contentVersion;
  for (const [key, r] of Object.entries(next.stepStates)) {
    const s = manifest.steps.find((s) => s.key === key);
    if (!s) {
      const target = manifest.deleted[key];
      next.archived[key] = r;
      delete next.stepStates[key];
      notes.push("删除归档：" + key);
      if (target) {
        const t = manifest.steps.find((s) => s.key === target);
        if (t && !next.stepStates[target])
          next.stepStates[target] = {
            ...r,
            projectId: t.projectId,
            lessonId: t.lessonId,
            stepId: t.stepId,
            status: "review_needed",
            revision: t.revision,
          };
      }
      continue;
    }
    if (r.revision !== s.revision) {
      if (r.status !== "not_started") {
        r.status = "review_needed";
        r.selfReview = "none";
        notes.push("方法/数据变化，待复习：" + key);
      }
      r.revision = s.revision;
    }
  }
  if (
    next.lastLocation &&
    !manifest.steps.some((s) => s.key === keyOf(next.lastLocation))
  ) {
    const target = manifest.deleted[keyOf(next.lastLocation)];
    const t = manifest.steps.find((s) => s.key === target);
    next.lastLocation = t
      ? { projectId: t.projectId, lessonId: t.lessonId, stepId: t.stepId }
      : null;
  }
  return { data: next, notes };
}
export function effectiveStatus(s, r) {
  if (!r) return "not_started";
  if (
    r.status === "completed" &&
    s.exerciseRequired &&
    r.selfReview !== "explained"
  )
    return "in_progress";
  return r.status;
}
export function projectProgress(manifest, data, id) {
  const steps = manifest.steps.filter((s) => s.projectId === id && s.required);
  const done = steps.filter(
    (s) => effectiveStatus(s, data.stepStates[s.key]) === "completed",
  ).length;
  const states = steps.map((s) => effectiveStatus(s, data.stepStates[s.key]));
  return {
    total: steps.length,
    done,
    ratio: steps.length ? done / steps.length : 0,
    status: !steps.length
      ? "unavailable"
      : states.includes("review_needed")
        ? "review_needed"
        : done === steps.length
          ? "completed"
          : states.some((s) => s !== "not_started")
            ? "in_progress"
            : "not_started",
  };
}
export function overallProgress(manifest, data) {
  const all = manifest.projects.map((p) =>
      projectProgress(manifest, data, p.id),
    ),
    open = all.filter((p) => p.total);
  return {
    ratio: open.length
      ? open.reduce((n, p) => n + p.ratio, 0) / open.length
      : 0,
    open: open.length,
    complete: open.filter((p) => p.status === "completed").length,
    total: all.length,
  };
}
export function mergeProgress(current, incoming) {
  const next = structuredClone(current);
  for (const field of ["stepStates", "archived"])
    for (const [k, r] of Object.entries(incoming[field]))
      if (!next[field][k] || r.updatedAt > next[field][k].updatedAt)
        next[field][k] = r;
  if (incoming.updatedAt > current.updatedAt) {
    next.lastLocation = incoming.lastLocation;
    next.preferences = incoming.preferences;
    next.prerequisiteConfirmations = incoming.prerequisiteConfirmations;
  }
  next.events = [
    ...new Map(
      [...current.events, ...incoming.events].map((e) => [
        JSON.stringify(e),
        e,
      ]),
    ).values(),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-100);
  return next;
}
export function importPreview(raw, manifest, current, mode) {
  const parsed = parseProgress(raw, manifest);
  const migration = migrateProgress(parsed, manifest);
  const data =
    mode === "merge" ? mergeProgress(current, migration.data) : migration.data;
  return {
    data,
    notes: migration.notes,
    changed: manifest.steps.filter(
      (s) =>
        JSON.stringify(data.stepStates[s.key]) !==
        JSON.stringify(current.stepStates[s.key]),
    ).length,
    before: overallProgress(manifest, current),
    after: overallProgress(manifest, data),
  };
}
export function storageAdapter(storage, manifest) {
  let baseline = null;
  let blocked = false;
  return {
    read() {
      try {
        blocked = false;
        baseline = storage.getItem(KEY);
        if (!baseline)
          return { data: emptyProgress(manifest), notes: [], raw: null };
        const result = migrateProgress(
          parseProgress(baseline, manifest),
          manifest,
        );
        return { ...result, raw: baseline };
      } catch (e) {
        blocked = true;
        return {
          data: emptyProgress(manifest),
          notes: [],
          raw: baseline,
          error: "本地记录无法读取，原数据未覆盖：" + e.message,
        };
      }
    },
    save(data) {
      if (blocked)
        throw Error("原存储受保护，请先导出原始记录，再明确替换或重置");
      const latest = storage.getItem(KEY);
      if (latest !== baseline)
        throw Error("跨标签页冲突：存储已变化，请先读取或合并较新记录");
      const next = {
        ...data,
        revision: data.revision + 1,
        updatedAt: new Date().toISOString(),
      };
      const raw = JSON.stringify(next);
      if (new TextEncoder().encode(raw).length > MAX_BYTES)
        throw Error("记录超过1 MiB，请先备份");
      storage.setItem(KEY, raw);
      baseline = raw;
      return next;
    },
    unlock() {
      if (storage.getItem(KEY) !== baseline)
        throw Error("跨标签页冲突：替换前存储已变化，请读取最新记录并重新预览");
      blocked = false;
    },
    raw() {
      return baseline;
    },
  };
}

export function recommendStep(manifest, data) {
  const active =
    manifest.steps.find(
      (s) => effectiveStatus(s, data.stepStates[s.key]) === "review_needed",
    ) ||
    manifest.steps.find(
      (s) => effectiveStatus(s, data.stepStates[s.key]) === "in_progress",
    );
  const confirmed = (id) => Number(data.prerequisiteConfirmations.includes(id));
  const unmet = (p) =>
    p.recommendedProjectIds.filter(
      (id) => projectProgress(manifest, data, id).status !== "completed",
    ).length;
  const sorted = [...manifest.projects].sort(
    (a, b) =>
      confirmed(b.id) - confirmed(a.id) ||
      unmet(a) - unmet(b) ||
      Number(a.id !== "P21") - Number(b.id !== "P21"),
  );
  const project = active
    ? manifest.projects.find((p) => p.id === active.projectId)
    : sorted.find(
        (p) =>
          manifest.steps.some((s) => s.projectId === p.id) &&
          projectProgress(manifest, data, p.id).status !== "completed",
      );
  if (!project) return null;
  const step =
    active ||
    manifest.steps.find(
      (s) =>
        s.projectId === project.id &&
        effectiveStatus(s, data.stepStates[s.key]) !== "completed",
    );
  return step ? { project, step, active: !!active } : null;
}

export function parseManifest(value) {
  const item = location
    .extend({
      key: z.string(),
      title: z.string(),
      required: z.boolean(),
      exerciseRequired: z.boolean(),
      revision: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict();
  const result = z
    .object({
      schemaVersion: z.literal(1),
      contentVersion: z.string().min(1),
      supportedContentVersions: z.array(z.string()).optional(),
      projects: z.array(
        z
          .object({
            id,
            title: z.string(),
            prerequisites: z.string(),
            recommendedProjectIds: z.array(id),
          })
          .strict(),
      ),
      steps: z.array(item),
      deleted: z.record(z.string(), z.string().nullable()),
    })
    .strict()
    .safeParse(value);
  if (!result.success)
    throw Error(
      "进度课程清单结构或版本不匹配；学习记录未修改，请恢复课程清单。",
    );
  const m = result.data;
  if (
    new Set(m.steps.map((s) => s.key)).size !== m.steps.length ||
    m.steps.some(
      (s) =>
        s.key !== keyOf(s) || !m.projects.some((p) => p.id === s.projectId),
    )
  )
    throw Error("进度课程清单ID不一致，停止记录以保护原数据。");
  return m;
}
